import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { User, FriendRequest, Chat, Message } from '../types';
import {
  Search,
  UserPlus,
  Moon,
  Sun,
  Check,
  CheckCheck,
  LogOut,
  UserCheck,
  PlusCircle,
  MessageSquare,
  Settings,
  X,
  Plus
} from 'lucide-react';

interface DashboardScreenProps {
  currentUser: User;
  onSelectChat: (chat: Chat) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  onOpenProfile: () => void;
}

export default function DashboardScreen({
  currentUser,
  onSelectChat,
  darkMode,
  onToggleTheme,
  onOpenProfile,
}: DashboardScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchUserId, setSearchUserId] = useState('');
  const [searchUserResult, setSearchUserResult] = useState<User | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);

  // Auto-initialize self-chat document so "You" is always ready and available in the Recent Chats
  useEffect(() => {
    const initSelfChat = async () => {
      try {
        const chatId = `${currentUser.uid}_self`;
        const chatRef = doc(db, 'chats', chatId);
        await setDoc(chatRef, {
          chatId,
          participants: [currentUser.uid],
          lastMessage: 'Message yourself (Keep notes, tasks, files)',
          lastMessageTimestamp: new Date().toISOString(),
        }, { merge: true });
      } catch (err) {
        console.warn('Silent warning setting up self-chat:', err);
      }
    };
    initSelfChat();
  }, [currentUser.uid]);

  // 1. Stream incoming pending friend requests & resolve sender profiles
  useEffect(() => {
    const q = query(
      collection(db, 'friendRequests'),
      where('receiverId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const requestsData: FriendRequest[] = [];
      for (const d of snapshot.docs) {
        const req = d.data() as FriendRequest;
        // Fetch sender user profile
        try {
          const userSnap = await getDocs(
            query(collection(db, 'users'), where('uid', '==', req.senderId))
          );
          if (!userSnap.empty) {
            req.senderProfile = userSnap.docs[0].data() as User;
          }
        } catch (err) {
          console.error('Error fetching request sender profile:', err);
        }
        requestsData.push(req);
      }
      setFriendRequests(requestsData);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // 2. Stream user's chats and resolve other participant profiles
  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );

    // Track active sub-listeners for each chatId
    // Key format: `profile_${chatId}` and `unread_${chatId}`
    const activeUnsubs = new Map<string, () => void>();

    const unsubscribeChats = onSnapshot(q, (snapshot) => {
      const chatDocs = snapshot.docs.map(doc => doc.data() as Chat);
      const currentChatIds = new Set(chatDocs.map(c => c.chatId));

      // Clean up any sub-listeners for chats that are no longer in currentChatIds
      for (const [key, unsub] of activeUnsubs.entries()) {
        const chatId = key.split('_').slice(1).join('_');
        if (!currentChatIds.has(chatId)) {
          unsub();
          activeUnsubs.delete(key);
        }
      }

      // Initialize or update basic chats state first
      setChats((prevChats) => {
        const chatMap = new Map<string, Chat>();
        prevChats.forEach(c => chatMap.set(c.chatId, c));

        return chatDocs.map((chatData) => {
          const isSelfChat = chatData.chatId === `${currentUser.uid}_self` || 
                             chatData.participants.length === 1 || 
                             (chatData.participants.length === 2 && chatData.participants[0] === currentUser.uid && chatData.participants[1] === currentUser.uid);
          
          const existingChat = chatMap.get(chatData.chatId);
          return {
            ...chatData,
            otherUser: existingChat?.otherUser || (isSelfChat ? {
              ...currentUser,
              displayName: `${currentUser.displayName || 'Me'} (You)`,
              bio: 'Message yourself',
            } : undefined),
            unreadCount: existingChat?.unreadCount || 0,
          };
        });
      });

      // Register sub-listeners for each chat outside of the setChats state updater
      chatDocs.forEach((chatData) => {
        const chatId = chatData.chatId;
        const isSelfChat = chatId === `${currentUser.uid}_self` || 
                           chatData.participants.length === 1 || 
                           (chatData.participants.length === 2 && chatData.participants[0] === currentUser.uid && chatData.participants[1] === currentUser.uid);
        const otherUid = isSelfChat ? currentUser.uid : chatData.participants.find((id) => id !== currentUser.uid);

        if (otherUid) {
          const profileKey = `profile_${chatId}`;
          if (!activeUnsubs.has(profileKey)) {
            const unsubProfile = onSnapshot(doc(db, 'users', otherUid), (userDoc) => {
              if (userDoc.exists()) {
                let otherUserData = userDoc.data() as User;
                if (isSelfChat) {
                  otherUserData = {
                    ...otherUserData,
                    displayName: `${otherUserData.displayName || 'Me'} (You)`,
                    bio: 'Message yourself',
                  };
                }
                setChats((currChats) =>
                  currChats.map((cc) =>
                    cc.chatId === chatId ? { ...cc, otherUser: otherUserData } : cc
                  )
                );
              }
            }, (err) => {
              console.error('Error fetching profile snapshot for chat:', chatId, err);
            });
            activeUnsubs.set(profileKey, unsubProfile);
          }

          const unreadKey = `unread_${chatId}`;
          if (!activeUnsubs.has(unreadKey)) {
            const msgQuery = query(
              collection(db, 'chats', chatId, 'messages'),
              where('senderId', '!=', currentUser.uid),
              where('status', '!=', 'seen')
            );
            const unsubUnread = onSnapshot(msgQuery, (msgSnap) => {
              setChats((currChats) =>
                currChats.map((cc) =>
                  cc.chatId === chatId ? { ...cc, unreadCount: msgSnap.size } : cc
                )
              );
            }, (err) => {
              console.error('Error fetching unread snapshot for chat:', chatId, err);
            });
            activeUnsubs.set(unreadKey, unsubUnread);
          }
        }
      });
    }, (error) => {
      console.error("Error streaming chats:", error);
    });

    return () => {
      unsubscribeChats();
      activeUnsubs.forEach((unsub) => unsub());
    };
  }, [currentUser.uid]);

  // Handle Friend Request Actions: Accept
  const handleAcceptRequest = async (request: FriendRequest) => {
    try {
      // 1. Update request status to accepted
      await setDoc(doc(db, 'friendRequests', request.requestId), {
        ...request,
        status: 'accepted',
      });

      // 2. Create chat document
      const chatId = [currentUser.uid, request.senderId].sort().join('_');
      await setDoc(doc(db, 'chats', chatId), {
        chatId,
        participants: [currentUser.uid, request.senderId],
        lastMessage: 'Friend request accepted! Say hello.',
        lastMessageTimestamp: new Date().toISOString(),
      });

      // 3. Remove from UI state
      setFriendRequests((prev) => prev.filter((r) => r.requestId !== request.requestId));
    } catch (err) {
      console.error('Error accepting friend request:', err);
    }
  };

  // Handle Friend Request Actions: Decline
  const handleDeclineRequest = async (request: FriendRequest) => {
    try {
      await setDoc(doc(db, 'friendRequests', request.requestId), {
        ...request,
        status: 'declined',
      });
      setFriendRequests((prev) => prev.filter((r) => r.requestId !== request.requestId));
    } catch (err) {
      console.error('Error declining friend request:', err);
    }
  };

  // Search User by Unique ID
  const handleSearchUser = async () => {
    setSearchError(null);
    setSearchSuccess(null);
    setSearchUserResult(null);

    const inputId = searchUserId.trim();
    if (!inputId) {
      setSearchError('Please enter a Unique ID.');
      return;
    }

    if (inputId === currentUser.uniqueID) {
      setSearchUserResult(currentUser);
      return;
    }

    try {
      const q = query(collection(db, 'users'), where('uniqueID', '==', inputId));
      const snap = await getDocs(q);

      if (snap.empty) {
        setSearchError('User not found. Please double-check the Unique ID.');
      } else {
        const targetUser = snap.docs[0].data() as User;
        setSearchUserResult(targetUser);
      }
    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || 'Error searching for user.');
    }
  };

  // Open / Initialize self-chat directly
  const handleOpenSelfChat = async () => {
    try {
      const chatId = `${currentUser.uid}_self`;
      const chatRef = doc(db, 'chats', chatId);
      
      await setDoc(chatRef, {
        chatId,
        participants: [currentUser.uid],
        lastMessage: 'Message yourself (Keep notes, tasks, files)',
        lastMessageTimestamp: new Date().toISOString(),
      }, { merge: true });

      const selfChat: Chat = {
        chatId,
        participants: [currentUser.uid],
        lastMessage: 'Message yourself (Keep notes, tasks, files)',
        lastMessageTimestamp: new Date().toISOString(),
        otherUser: {
          ...currentUser,
          displayName: `${currentUser.displayName || 'Me'} (You)`,
          bio: 'Message yourself',
        },
      };

      onSelectChat(selfChat);
      setShowAddFriendModal(false);
      setSearchUserId('');
      setSearchUserResult(null);
    } catch (err) {
      console.error('Error opening self chat:', err);
    }
  };

  // Send Friend Request
  const handleSendRequest = async () => {
    if (!searchUserResult) return;
    setSendingRequest(true);
    setSearchError(null);
    setSearchSuccess(null);

    try {
      // Check if a request already exists
      const q1 = query(
        collection(db, 'friendRequests'),
        where('senderId', '==', currentUser.uid),
        where('receiverId', '==', searchUserResult.uid)
      );
      const q2 = query(
        collection(db, 'friendRequests'),
        where('senderId', '==', searchUserResult.uid),
        where('receiverId', '==', currentUser.uid)
      );

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

      if (!snap1.empty || !snap2.empty) {
        setSearchError('A friend request already exists between you two.');
        setSendingRequest(false);
        return;
      }

      const reqId = `${currentUser.uid}_to_${searchUserResult.uid}`;
      const newRequest: FriendRequest = {
        requestId: reqId,
        senderId: currentUser.uid,
        receiverId: searchUserResult.uid,
        status: 'pending',
        timestamp: new Date().toISOString(),
      };

      await setDoc(doc(db, 'friendRequests', reqId), newRequest);
      setSearchSuccess(`Friend request sent successfully to ${searchUserResult.displayName}!`);
      setSearchUserId('');
      setSearchUserResult(null);
    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || 'Failed to send request.');
    } finally {
      setSendingRequest(false);
    }
  };

  // Filter chats by search query (displayName or uniqueID)
  const filteredChats = chats.filter((chat) => {
    if (!chat.otherUser) return false;
    const term = searchQuery.toLowerCase();
    return (
      chat.otherUser.displayName?.toLowerCase().includes(term) ||
      chat.otherUser.uniqueID.toLowerCase().includes(term)
    );
  });

  return (
    <div
      className={`min-h-screen flex flex-col md:pl-20 transition-colors duration-300 ${
        darkMode ? 'bg-[#121212] text-[#F5F5F7]' : 'bg-[#F5F5F7] text-[#121212]'
      }`}
    >
      {/* Top Header */}
      <header
        className={`fixed top-0 left-0 right-0 h-16 z-40 flex items-center justify-between px-6 border-b transition-colors duration-300 md:pl-24 ${
          darkMode ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            onClick={onOpenProfile}
            className="relative cursor-pointer active:scale-95 transition-transform duration-150 group"
          >
            <div className="w-10 h-10 rounded-full border-2 border-[#00a884] overflow-hidden bg-zinc-800">
              {currentUser.photoURL ? (
                <img
                  className="w-full h-full object-cover"
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || ''}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#00a884] text-white font-bold">
                  {currentUser.displayName?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-white dark:border-[#121212]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#00a884] truncate max-w-[120px] sm:max-w-none">
              Messenger
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-wider font-semibold">
              ID: {currentUser.uniqueID}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Friend Button */}
          <button
            onClick={() => setShowAddFriendModal(true)}
            className={`p-2 rounded-full transition-colors active:scale-95 outline-none ${
              darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'
            }`}
            title="Add Friend by ID"
          >
            <UserPlus className="w-5 h-5 text-[#00a884]" />
          </button>

          {/* Toggle Theme */}
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-full transition-colors active:scale-95 outline-none ${
              darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'
            }`}
            title="Toggle Theme"
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={() => auth.signOut()}
            className={`p-2 rounded-full transition-colors active:scale-95 outline-none hover:text-red-500 ${
              darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'
            }`}
            title="Log Out"
          >
            <LogOut className="w-5 h-5 text-zinc-400 hover:text-white" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="pt-20 pb-24 md:pb-8 flex flex-col min-h-screen">
        {/* Search Input */}
        <div className="px-6 py-4 sticky top-16 z-10 bg-inherit">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              className={`w-full pl-11 pr-4 py-3 border border-white/5 rounded-xl text-sm focus:ring-2 focus:ring-[#00a884] outline-none shadow-sm ${
                darkMode ? 'bg-[#2a2a2e] text-white placeholder-zinc-500' : 'bg-gray-250 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Search chats..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Friend Requests Section */}
        {friendRequests.length > 0 && (
          <section className="px-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Friend Requests ({friendRequests.length})
              </h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 custom-scrollbar snap-x">
              {friendRequests.map((req) => (
                <div
                  key={req.requestId}
                  className={`flex-shrink-0 w-52 p-3 rounded-xl border snap-start flex flex-col justify-between ${
                    darkMode
                      ? 'bg-[#1c1c1e] border-white/10'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800">
                      {req.senderProfile?.photoURL ? (
                        <img
                          className="w-full h-full object-cover"
                          src={req.senderProfile.photoURL}
                          alt="Sender avatar"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#00a884] text-white font-bold">
                          {req.senderProfile?.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold truncate">
                        {req.senderProfile?.displayName || 'Anonymous'}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate font-mono">
                        {req.senderProfile?.uniqueID}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptRequest(req)}
                      className="flex-1 py-1.5 bg-[#00a884] hover:bg-[#008f70] text-white rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(req)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                        darkMode
                          ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Chats History List */}
        <section
          className={`flex-1 rounded-t-[32px] border-t pt-6 ${
            darkMode
              ? 'bg-[#1c1c1e]/60 border-white/5'
              : 'bg-white border-gray-250/50'
          }`}
        >
          <div className="px-6 pb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Recent Chats
            </h2>
          </div>

          <div className="divide-y divide-white/5 dark:divide-white/5">
            {filteredChats.length === 0 ? (
              <div className="text-center py-12 px-6">
                <MessageSquare className="w-12 h-12 text-zinc-600 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-semibold opacity-65 text-zinc-400">
                  No recent chats found.
                </p>
                <button
                  onClick={() => setShowAddFriendModal(true)}
                  className="text-xs font-bold text-[#00a884] mt-2 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-4.5 h-4.5" />
                  Search & Add Friends by ID
                </button>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const other = chat.otherUser;
                if (!other) return null;

                const hasUnread = (chat.unreadCount || 0) > 0;
                
                return (
                  <div
                    key={chat.chatId}
                    onClick={() => onSelectChat(chat)}
                    className={`relative h-[72px] flex items-center px-6 hover:bg-white/5 transition-colors cursor-pointer group`}
                  >
                    {hasUnread && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00a884]" />
                    )}

                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-zinc-800">
                        {other.photoURL ? (
                          <img
                            className="w-full h-full object-cover"
                            src={other.photoURL}
                            alt={other.displayName || ''}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#00a884] text-white font-bold">
                            {other.displayName?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#121212] ${
                          other.status === 'online' ? 'bg-[#00a884]' : 'bg-zinc-500'
                        }`}
                      />
                    </div>

                    <div className="flex-1 ml-4 overflow-hidden">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className="text-sm font-bold truncate max-w-[150px]">
                          {other.displayName || 'Anonymous'}
                        </h3>
                        {chat.lastMessageTimestamp && (
                          <span
                            className={`text-[10px] ${
                              hasUnread ? 'text-[#00a884] font-bold' : 'text-zinc-500'
                            }`}
                          >
                            {new Date(chat.lastMessageTimestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center">
                        <p
                          className={`text-xs truncate pr-4 ${
                            hasUnread
                              ? 'text-white font-bold'
                              : 'text-zinc-400'
                          }`}
                        >
                          {chat.lastMessage || 'No messages yet.'}
                        </p>

                        {hasUnread && (
                          <div className="flex-shrink-0 w-5 h-5 bg-[#00a884] rounded-full flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white">
                              {chat.unreadCount}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* Floating Action Button for New Chat (Mobile) */}
      <button
        onClick={() => setShowAddFriendModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#00a884] hover:bg-[#008f70] text-white rounded-2xl shadow-lg flex items-center justify-center active:scale-90 transition-all duration-200 z-40 md:hidden cursor-pointer"
      >
        <UserPlus className="w-6 h-6" />
      </button>

      {/* Add Friend modal */}
      {showAddFriendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div
            className={`w-full max-w-md rounded-2xl p-6 border shadow-2xl relative transition-all duration-300 ${
              darkMode ? 'bg-[#1c1c1e] border-white/10 text-[#f5f5f7]' : 'bg-white border-gray-200'
            }`}
          >
            <button
              onClick={() => {
                setShowAddFriendModal(false);
                setSearchUserResult(null);
                setSearchUserId('');
                setSearchError(null);
                setSearchSuccess(null);
              }}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-700/10 dark:hover:bg-gray-100/10 text-gray-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4 pr-6">Search Friend by ID</h3>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  className={`flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#00a884] ${
                    darkMode
                      ? 'bg-[#2a2a2e] border-white/5 text-white placeholder-zinc-500'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter Unique ID (e.g. user_9821x)"
                  type="text"
                  value={searchUserId}
                  onChange={(e) => setSearchUserId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchUser();
                  }}
                />
                <button
                  onClick={handleSearchUser}
                  className="bg-[#00a884] hover:bg-[#008f70] text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
                >
                  Search
                </button>
              </div>

              {searchError && (
                <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                  {searchError}
                </div>
              )}

              {searchSuccess && (
                <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg">
                  {searchSuccess}
                </div>
              )}

              {searchUserResult && (
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    darkMode ? 'bg-[#2a2a2e] border-white/5' : 'bg-gray-50 border-gray-250'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-850">
                      {searchUserResult.photoURL ? (
                        <img
                          className="w-full h-full object-cover"
                          src={searchUserResult.photoURL}
                          alt="Search result"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#00a884] text-white font-bold">
                          {searchUserResult.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold">
                        {searchUserResult.displayName || 'Anonymous'}
                      </p>
                      <p className="text-xs text-zinc-500 font-mono">
                        {searchUserResult.uniqueID}
                      </p>
                    </div>
                  </div>

                  {searchUserResult.uid === currentUser.uid ? (
                    <button
                      onClick={handleOpenSelfChat}
                      className="bg-[#00a884] hover:bg-[#008f70] text-white px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      Message Yourself
                    </button>
                  ) : (
                    <button
                      onClick={handleSendRequest}
                      disabled={sendingRequest}
                      className="bg-[#00a884] hover:bg-[#008f70] text-white px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {sendingRequest ? 'Sending...' : 'Add Friend'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
