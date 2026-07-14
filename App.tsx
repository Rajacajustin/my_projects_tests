import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { User as AppUser, Chat, Message } from './types';

// Screens & components
import AuthScreen from './components/AuthScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import DashboardScreen from './components/DashboardScreen';
import ChatCanvas from './components/ChatCanvas';
import CallScreen from './components/CallScreen';
import ToastNotification from './components/ToastNotification';

import { Loader2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [activeCall, setActiveCall] = useState<{ type: 'voice' | 'video'; otherUser: AppUser } | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true); // Default to Dark Mode as per user screenshots
  const [notification, setNotification] = useState<{
    show: boolean;
    senderName: string;
    senderUidString: string;
    messageText: string;
    photoURL?: string | null;
    chat: Chat;
  } | null>(null);

  const activeChatIdRef = useRef<string | null>(null);
  const loadedTimeRef = useRef<string>(new Date().toISOString());
  const listenersRef = useRef<{ [chatId: string]: () => void }>({});

  // Sync ref with state to allow access inside dynamic callbacks
  useEffect(() => {
    activeChatIdRef.current = activeChat ? activeChat.chatId : null;
  }, [activeChat]);

  // Handle Authentication State Changes
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        if (!user) {
          setUserProfile(null);
          setLoading(false);
        }
      }, (err) => {
        console.error('Auth state change error:', err);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error('Failed to subscribe to auth state:', err);
      setLoading(false);
    }
  }, []);

  // Stream user profile real-time when authenticated
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    let unsubProfile = () => {};
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      unsubProfile = onSnapshot(
        userDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as AppUser);
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching user profile:', err);
          setUserProfile(null);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('Synchronous error in profile snapshot registration:', err);
      setUserProfile(null);
      setLoading(false);
    }

    return () => unsubProfile();
  }, [currentUser]);

  // Set up background notifications listener for user chats
  useEffect(() => {
    if (!currentUser) {
      // Clear existing listeners when user logs out
      (Object.values(listenersRef.current) as any[]).forEach((unsub) => unsub());
      listenersRef.current = {};
      return;
    }

    // Stream user's chats list
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      snapshot.docs.forEach((chatDoc) => {
        const chatData = chatDoc.data() as Chat;
        const chatId = chatData.chatId;

        // Only start listening to messages if not already listening
        if (!listenersRef.current[chatId]) {
          // Keep track of other user details for notification
          let otherUserProfile: AppUser | undefined;
          const otherUid = chatData.participants.find((id) => id !== currentUser.uid);
          
          if (otherUid) {
            onSnapshot(doc(db, 'users', otherUid), (uDoc) => {
              if (uDoc.exists()) {
                otherUserProfile = uDoc.data() as AppUser;
              }
            }, (err) => {
              console.warn('Error fetching user profile for notification:', err);
            });
          }

          const msgsQuery = query(
            collection(db, 'chats', chatId, 'messages')
          );

          const unsubMessages = onSnapshot(msgsQuery, (msgSnap) => {
            msgSnap.docChanges().forEach((change) => {
              // Only trigger for newly added messages
              if (change.type === 'added') {
                const msg = change.doc.data() as Message;
                
                // Exclude messages sent by self
                if (msg.senderId === currentUser.uid) return;

                // Exclude old messages (from before app boot/load)
                if (msg.timestamp < loadedTimeRef.current) return;

                // Exclude messages in the currently active chat
                if (chatId === activeChatIdRef.current) return;

                // Parse out image attachments for clean display in notification
                const cleanText = msg.text.replace(/\[IMAGE:data:image\/[^;]+;base64,[^\]]+\]/, '📷 Sent an image attachment');

                // Trigger toast notification
                setNotification({
                  show: true,
                  senderName: otherUserProfile?.displayName || 'Anonymous',
                  senderUidString: otherUserProfile?.uniqueID || 'user_xxxx',
                  messageText: cleanText,
                  photoURL: otherUserProfile?.photoURL,
                  chat: {
                    ...chatData,
                    otherUser: otherUserProfile,
                  },
                });

                // Auto-dismiss after 6 seconds
                setTimeout(() => {
                  setNotification((prev) =>
                    prev?.chat.chatId === chatId ? { ...prev, show: false } : prev
                  );
                }, 6000);
              }
            });
          }, (err) => {
            console.warn('Error fetching messages for notification:', err);
          });

          listenersRef.current[chatId] = unsubMessages;
        }
      });
    }, (err) => {
      console.warn('Error streaming chats for notifications:', err);
    });

    return () => {
      unsubChats();
      (Object.values(listenersRef.current) as any[]).forEach((unsub) => unsub());
      listenersRef.current = {};
    };
  }, [currentUser]);

  const handleToggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const handleSelectChat = (chat: Chat) => {
    setActiveChat(chat);
  };

  const handleStartCall = (type: 'voice' | 'video') => {
    if (activeChat?.otherUser) {
      setActiveCall({
        type,
        otherUser: activeChat.otherUser,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 text-[#00a884] animate-spin mb-4" />
        <p className="text-sm font-semibold opacity-75">Loading Messenger...</p>
      </div>
    );
  }

  // 1. Not Authenticated State
  if (!currentUser) {
    return (
      <AuthScreen
        onSuccess={() => {}}
        darkMode={darkMode}
      />
    );
  }

  // 2. Profile Setup / Onboarding State or Profile Editing State
  if (!userProfile || isEditingProfile) {
    return (
      <ProfileSetupScreen
        initialProfile={userProfile}
        onSave={(profile) => {
          setUserProfile(profile);
          setIsEditingProfile(false);
        }}
        darkMode={darkMode}
      />
    );
  }

  // 3. Active Video/Voice Call Overlay
  if (activeCall) {
    return (
      <CallScreen
        type={activeCall.type}
        otherUser={activeCall.otherUser}
        onEndCall={() => setActiveCall(null)}
      />
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      {/* Toast Notification dropdown */}
      {notification && (
        <ToastNotification
          show={notification.show}
          photoURL={notification.photoURL}
          senderName={notification.senderName}
          senderUidString={notification.senderUidString}
          messageText={notification.messageText}
          onClose={() => setNotification(null)}
          onClick={() => {
            setActiveChat(notification.chat);
            setNotification(null);
          }}
        />
      )}

      {/* Primary Screens */}
      {activeChat ? (
        <ChatCanvas
          chat={activeChat}
          currentUser={userProfile}
          onBack={() => setActiveChat(null)}
          onStartCall={handleStartCall}
          darkMode={darkMode}
        />
      ) : (
        <DashboardScreen
          currentUser={userProfile}
          onSelectChat={handleSelectChat}
          darkMode={darkMode}
          onToggleTheme={handleToggleTheme}
          onOpenProfile={() => setIsEditingProfile(true)} // Click on own avatar opens Profile setup to edit without resetting state
        />
      )}
    </div>
  );
}
