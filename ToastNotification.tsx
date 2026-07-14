import React from 'react';
import { MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastNotificationProps {
  show: boolean;
  photoURL?: string | null;
  senderName: string;
  senderUidString: string;
  messageText: string;
  onClose: () => void;
  onClick: () => void;
}

export default function ToastNotification({
  show,
  photoURL,
  senderName,
  senderUidString,
  messageText,
  onClose,
  onClick,
}: ToastNotificationProps) {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none z-[100] flex justify-center pt-8 px-4">
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            className="pointer-events-auto flex items-center gap-4 bg-[#1c1c1e] border border-white/10 p-4 rounded-xl shadow-2xl max-w-md w-full ring-1 ring-white/5 cursor-pointer hover:bg-[#2a2a2e] text-[#f5f5f7]"
            onClick={onClick}
          >
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#00a884]/30 bg-zinc-800">
                {photoURL ? (
                  <img
                    className="w-full h-full object-cover"
                    src={photoURL}
                    alt={senderName}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#00a884] text-white font-bold text-lg">
                    {senderName[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#00a884] rounded-full flex items-center justify-center border-2 border-gray-900 text-white">
                <MessageSquare className="w-3 h-3" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[10px] font-semibold text-[#00a884] uppercase tracking-wider">
                  New Message
                </span>
                <span className="text-xs text-zinc-500">
                  Just now
                </span>
              </div>
              <h3 className="text-sm font-bold text-white leading-tight truncate">
                {senderName} ({senderUidString})
              </h3>
              <p className="text-sm text-zinc-400 truncate">
                {messageText}
              </p>
            </div>

            <button
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-colors flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
