import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  doc,
  writeBatch,
  getDocs,
  where
} from 'firebase/firestore';
import { User, Chat, Message } from '../types';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Loader2,
  Trash
} from 'lucide-react';

interface ChatCanvasProps {
  chat: Chat;
  currentUser: User;
  onBack: () => void;
  onStartCall: (type: 'voice' | 'video') => void;
  darkMode: boolean;
}

const EMOJIS = ['🎨', '🚀', '👍', '🔥', '❤️', '😂', '🌟', '👏', '🙏', '🎉'];

export default function ChatCanvas({
  chat,
  currentUser,
  onBack,
  onStartCall,
  darkMode,
}: ChatCanvasProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [imageAttachment, setImageAttachment] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const otherUser = chat.otherUser;
  const isSelfChat = chat.chatId === `${currentUser.uid}_self` || 
                     chat.participants.length === 1 || 
                     (chat.participants.length === 2 && chat.participants[0] === currentUser.uid && chat.participants[1] === currentUser.uid);

  // 1. Stream chat messages
  useEffect(() => {
    const q = query(
      collection(db, 'chats', chat.chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((d) => {
        msgs.push(d.data() as Message);
      });
      setMessages(msgs);
      scrollToBottom();

      // Automatically update status from delivered -> seen for incoming messages
      const batch = writeBatch(db);
      let hasUpdates = false;

      snapshot.docs.forEach((docSnap) => {
        const msg = docSnap.data() as Message;
        if (msg.senderId !== currentUser.uid && msg.status !== 'seen') {
          batch.update(docSnap.ref, { status: 'seen' });
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        batch.commit().catch((err) => {
          console.error('Error updating message statuses:', err);
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chat.chatId}/messages`);
    });

    return () => unsubscribe();
  }, [chat.chatId, currentUser.uid]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 2. Typing Simulator: When currentUser types, trigger typing feedback after a tiny delay
  useEffect(() => {
    if (isSelfChat) return;
    if (!inputText.trim()) return;

    // Simulate other user typing back occasionally
    const rand = Math.random();
    if (rand > 0.7 && !otherUserTyping) {
      setOtherUserTyping(true);
      const timer = setTimeout(() => {
        setOtherUserTyping(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [inputText, isSelfChat, otherUserTyping]);

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText.trim();
    if (!text && !imageAttachment) return;

    setInputText('');
    const currentAttachment = imageAttachment;
    setImageAttachment(null);

    const messageId = `msg_${Math.random().toString(36).substring(2, 11)}`;
    const messagePath = `chats/${chat.chatId}/messages/${messageId}`;

    const textWithAttachment = currentAttachment
      ? `${text} [IMAGE:${currentAttachment}]`
      : text;

    const newMessage: Message = {
      messageId,
      senderId: currentUser.uid,
      text: textWithAttachment,
      timestamp: new Date().toISOString(),
      status: isSelfChat ? 'seen' : 'sent',
    };

    try {
      // 1. Save message to Firestore subcollection
      await setDoc(doc(db, 'chats', chat.chatId, 'messages', messageId), newMessage);

      // 2. Update parent chat doc
      await setDoc(
        doc(db, 'chats', chat.chatId),
        {
          lastMessage: currentAttachment ? '📷 Sent an image attachment' : text,
          lastMessageTimestamp: new Date().toISOString(),
        },
        { merge: true }
      );

      scrollToBottom();

      if (!isSelfChat) {
        // Simulate 'delivered' state after 1 second
        setTimeout(async () => {
          try {
            await setDoc(
              doc(db, 'chats', chat.chatId, 'messages', messageId),
              { status: 'delivered' },
              { merge: true }
            );
          } catch (e) {
            console.error('Error updating status to delivered:', e);
          }
        }, 1000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, messagePath);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImageAttachment(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImageAttachment(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const insertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div
      onDragEnter={handleDrag}
      className={`fixed inset-0 z-40 flex flex-col md:pl-20 transition-colors duration-300 ${
        darkMode ? 'bg-[#121212] text-[#f5f5f7]' : 'bg-[#F5F5F7] text-gray-900'
      }`}
    >
      {/* Top Header Bar */}
      <header
        className={`flex items-center justify-between px-4 h-16 border-b z-10 transition-colors duration-300 ${
          darkMode ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-white/5 active:scale-95 transition-all text-[#00a884]"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-zinc-800">
            {otherUser?.photoURL ? (
              <img
                className="w-full h-full object-cover"
                src={otherUser.photoURL}
                alt="Avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#00a884] text-white font-bold">
                {otherUser?.displayName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight text-[#f5f5f7]">
              {otherUser?.displayName || 'Anonymous'}
            </span>
            <span
              className={`text-[10px] font-semibold ${
                isSelfChat ? 'text-[#00a884]' : otherUser?.status === 'online' ? 'text-[#00a884]' : 'text-gray-400'
              }`}
            >
              {isSelfChat ? 'Message yourself' : otherUser?.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {!isSelfChat && (
            <>
              <button
                onClick={() => onStartCall('voice')}
                className="p-2 rounded-full hover:bg-white/5 text-[#00a884] transition-colors active:scale-95"
                title="Voice Call"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={() => onStartCall('video')}
                className="p-2 rounded-full hover:bg-white/5 text-[#00a884] transition-colors active:scale-95"
                title="Video Call"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}
          <button className="p-2 rounded-full hover:bg-white/5 text-[#00a884] transition-colors active:scale-95">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Drag & Drop Overlay */}
      {dragActive && (
        <div
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className="absolute inset-x-0 bottom-0 top-16 bg-[#00a884]/10 backdrop-blur-sm border-4 border-dashed border-[#00a884] z-50 flex flex-col items-center justify-center text-[#00a884] font-bold"
        >
          <ImageIcon className="w-16 h-16 mb-2 animate-bounce" />
          Drop Image to Attach
        </div>
      )}

      {/* Main Canvas Area */}
      <main className={`flex-1 overflow-y-auto px-4 py-6 space-y-4 select-none relative ${darkMode ? 'sleek-chat-pattern bg-[#0b141a]' : 'bg-[#F5F5F7]'}`}>
        <div className="flex justify-center my-2 relative z-10">
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-250 text-gray-500'
            }`}
          >
            Today
          </span>
        </div>

        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUser.uid;
          
          // Check for embedded images
          const imageRegex = /\[IMAGE:(data:image\/[^;]+;base64,[^\]]+)\]/;
          const imageMatch = msg.text.match(imageRegex);
          const cleanText = msg.text.replace(imageRegex, '').trim();
          const base64Image = imageMatch ? imageMatch[1] : null;

          return (
            <div
              key={msg.messageId || idx}
              className={`flex flex-col max-w-[75%] relative z-10 ${
                isMe ? 'items-end self-end ml-auto' : 'items-start self-start mr-auto'
              }`}
            >
              <div
                className={`p-3 rounded-2xl shadow-sm relative transition-all duration-300 ${
                  isMe
                    ? 'bg-[#005c4b] text-[#f5f5f7] rounded-tr-none'
                    : darkMode
                    ? 'bg-[#202c33] text-[#f5f5f7] rounded-tl-none border border-white/5'
                    : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'
                }`}
              >
                {/* Attached Base64 Image inside bubble */}
                {base64Image && (
                  <div className="rounded-xl overflow-hidden mb-2 max-w-full max-h-60 border border-black/10">
                    <img className="w-full object-cover" src={base64Image} alt="Attachment" />
                  </div>
                )}

                {cleanText && (
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
                    {cleanText}
                  </p>
                )}

                {/* Info & checkticks */}
                <div className="flex items-center justify-end mt-1 gap-1 select-none">
                  <span className="text-[10px] opacity-60 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  
                  {isMe && (
                    <span className="flex-shrink-0">
                      {msg.status === 'sent' && (
                        <Check className="w-3.5 h-3.5 opacity-60 text-white" />
                      )}
                      {msg.status === 'delivered' && (
                        <CheckCheck className="w-3.5 h-3.5 opacity-65 text-white" />
                      )}
                      {msg.status === 'seen' && (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing feedback simulation */}
        {otherUserTyping && (
          <div className="flex flex-col items-start max-w-[75%] relative z-10">
            <div className="bg-[#202c33] text-[#f5f5f7] px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1 items-center border border-white/5">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Attachment / Preview bar */}
      {imageAttachment && (
        <div className="px-6 py-3 bg-[#00a884]/10 border-t border-[#00a884]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#00a884]/40">
              <img className="w-full h-full object-cover" src={imageAttachment} alt="Preview" />
            </div>
            <p className="text-xs font-semibold text-[#00a884]">Image attachment ready to send</p>
          </div>
          <button
            onClick={() => setImageAttachment(null)}
            className="p-1 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
          >
            <Trash className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Input Panel */}
      <footer
        className={`p-4 border-t flex items-center gap-3 relative ${
          darkMode ? 'bg-[#1c1c1e] border-white/10' : 'bg-white border-gray-200'
        }`}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-full hover:bg-white/5 text-[#00a884] transition-colors outline-none"
          title="Attach Image"
        >
          <Paperclip className="w-5 h-5" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleSelectFile}
          />
        </button>

        <div className="flex-1 relative flex items-center">
          <input
            className={`w-full border-none rounded-full py-3 pl-5 pr-12 text-sm focus:ring-2 focus:ring-[#00a884] outline-none transition-all ${
              darkMode ? 'bg-[#2a2a2e] text-[#f5f5f7] placeholder-zinc-500' : 'bg-gray-100 text-gray-900 placeholder-gray-400'
            }`}
            placeholder="Type a message..."
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
          />

          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute right-3 p-1 rounded-full text-[#00a884] hover:bg-white/5 transition-colors outline-none"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Emoji Picker Popover */}
          {showEmojiPicker && (
            <div
              className={`absolute bottom-14 right-2 p-2 rounded-xl border flex gap-1.5 shadow-2xl z-50 ${
                darkMode ? 'bg-[#2a2a2e] border-white/10 text-white' : 'bg-white border-gray-200'
              }`}
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="text-lg hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => handleSendMessage()}
          className="w-12 h-12 flex items-center justify-center bg-[#00a884] hover:bg-[#008f70] text-white rounded-full shadow-lg active:scale-90 transition-all duration-200 cursor-pointer"
        >
          <Send className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}
