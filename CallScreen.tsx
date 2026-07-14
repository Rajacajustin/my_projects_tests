import React, { useState, useEffect } from 'react';
import { User } from '../types';
import {
  Mic,
  MicOff,
  Volume2,
  PhoneOff,
  Video,
  VideoOff,
  Grid,
  RefreshCw,
  ScreenShare,
  Lock,
  ChevronDown,
  UserPlus
} from 'lucide-react';
import { motion } from 'motion/react';

interface CallScreenProps {
  type: 'voice' | 'video';
  otherUser: User;
  onEndCall: () => void;
}

export default function CallScreen({ type, otherUser, onEndCall }: CallScreenProps) {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(type === 'voice'); // Speaker default on for voice in mock, off or on
  const [isVideoOn, setIsVideoOn] = useState(type === 'video');
  const [isScreenSharing, setIsScreenSharing] = useState(type === 'video'); // Screen share is active by default in the mockup image

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const defaultAvatar = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCV-fJ4RgIuPpf5pv7jxdUDSuRF5eKNcQV3zSv9DFsf1sgXZxi7eJ9IXKZ6C47XvpVuuoOMknX323D8s2yUl4OJhYGaZ-hIxpsFYyYTX6BefxVxGJxrOMT88LvmVCuhFxMTS9rJ84LnDa9hCCwbAJXSEcnFH5Nbnif4P3fudkxdCOGXm-xt4wfvhDs7k8ul5wxAO0IyDm0CT603DxK7MN5y4GTpipR0HQ5Jw906WvBP126xfNUJ9W6XIL1T4vV1OlOZi5ugrQZxSlU';
  const remoteUserAvatar = otherUser.photoURL || defaultAvatar;

  if (type === 'voice') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0B141A] text-white flex flex-col justify-between overflow-hidden">
        {/* Blurred Background Image */}
        <div className="absolute inset-0 z-0 opacity-40">
          <div
            className="w-full h-full bg-cover bg-center filter blur-3xl scale-110"
            style={{ backgroundImage: `url('${remoteUserAvatar}')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
        </div>

        {/* Top Bar */}
        <header className="relative z-10 flex items-center justify-between px-6 py-4 w-full">
          <button
            onClick={onEndCall}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors active:scale-95"
          >
            <ChevronDown className="w-6 h-6 text-white" />
          </button>
          <div className="flex items-center gap-1.5 opacity-80">
            <Lock className="w-3.5 h-3.5 text-[#00a884]" />
            <span className="text-xs uppercase tracking-widest font-medium">
              End-to-End Encrypted
            </span>
          </div>
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors active:scale-95">
            <UserPlus className="w-6 h-6 text-white" />
          </button>
        </header>

        {/* Center Caller Info */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
          {/* Pulsing Avatar */}
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-[#00a884] animate-ping opacity-25" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 rounded-full border-2 border-[#00a884] animate-ping opacity-15" style={{ animationDuration: '3s', animationDelay: '1s' }} />
            <div className="w-48 h-48 rounded-full border-4 border-white/10 p-1 relative z-10 overflow-hidden bg-gray-800">
              <img
                className="w-full h-full object-cover rounded-full"
                src={remoteUserAvatar}
                alt={otherUser.displayName || 'User'}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              {otherUser.displayName || 'Anonymous'}
            </h1>
            <p className="text-base text-[#00a884] font-mono tracking-wider tabular-nums">
              {formatTime(seconds)}
            </p>
          </div>

          <div className="mt-6 flex gap-4 items-center">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 border border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
              <span className="text-xs font-semibold text-white/90">Voice HD</span>
            </div>
          </div>
        </main>

        {/* Bottom Control Dock */}
        <footer className="relative z-10 flex flex-col items-center pb-12 pt-8 bg-gradient-to-t from-[#0B141A] to-transparent w-full">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-around w-[90%] max-w-md px-6 py-5 rounded-[2rem] shadow-2xl">
            {/* Mute Button */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="flex flex-col items-center gap-2 group outline-none"
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
                  isMuted
                    ? 'bg-white text-gray-950'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </div>
              <span className="text-xs font-medium text-white/60">Mute</span>
            </button>

            {/* Speaker Button */}
            <button
              onClick={() => setIsSpeaker(!isSpeaker)}
              className="flex flex-col items-center gap-2 group outline-none"
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
                  isSpeaker
                    ? 'bg-white text-gray-950'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Volume2 className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-white/60">Speaker</span>
            </button>

            {/* Video Toggle (Muted icon style) */}
            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className="flex flex-col items-center gap-2 group outline-none"
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
                  isVideoOn
                    ? 'bg-white text-gray-950'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </div>
              <span className="text-xs font-medium text-white/60">Video</span>
            </button>

            {/* Keypad Button */}
            <button className="flex flex-col items-center gap-2 group outline-none">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-all duration-200 active:scale-90 text-white">
                <Grid className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-white/60">Keypad</span>
            </button>
          </div>

          {/* End Call Button */}
          <button
            onClick={onEndCall}
            className="mt-8 group outline-none active:scale-95 transition-all duration-200"
          >
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-all duration-300 shadow-lg shadow-red-900/30 ring-4 ring-transparent hover:ring-red-600/20 text-white">
              <PhoneOff className="w-8 h-8" />
            </div>
          </button>
        </footer>
      </div>
    );
  }

  // VIDEO CALL
  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden">
      {/* Background Remote Video Call representation */}
      <div className="absolute inset-0 z-0">
        {isVideoOn ? (
          <img
            className="w-full h-full object-cover"
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=1000" // Use high quality Unsplash office portrait for remote caller
            alt={otherUser.displayName || 'Video Stream'}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-800 border-2 border-white/10 mb-4">
              <img className="w-full h-full object-cover" src={remoteUserAvatar} alt="Avatar" />
            </div>
            <p className="text-gray-400">Camera is off</p>
          </div>
        )}
      </div>

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 w-full pointer-events-none">
        <div className="flex items-center gap-3 p-2 rounded-full bg-white/70 backdrop-blur-md border border-white/20 shadow-sm pointer-events-auto text-gray-900">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
            <img className="w-full h-full object-cover" src={remoteUserAvatar} alt="Sarah" />
          </div>
          <div className="pr-4">
            <h1 className="text-sm font-bold text-gray-900 leading-tight">
              {otherUser.displayName || 'User'}
            </h1>
            <p className="text-xs text-[#00a884] font-mono tracking-wider tabular-nums font-bold">
              {formatTime(seconds)}
            </p>
          </div>
        </div>

        {/* Screen Share Active Badge */}
        {isScreenSharing && (
          <div className="flex items-center gap-2 bg-[#00a884] px-4 py-2 rounded-full shadow-lg pointer-events-auto animate-pulse">
            <ScreenShare className="w-4 h-4 text-white" />
            <span className="text-xs font-semibold text-white">Screen Share Active</span>
          </div>
        )}
      </header>

      {/* Picture-in-Picture window */}
      <div className="absolute top-20 right-4 w-32 md:w-48 aspect-[3/4] rounded-xl overflow-hidden border-2 border-white shadow-xl z-20 transition-all hover:scale-105 cursor-pointer bg-gray-900">
        <img
          className="w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400" // Unsplash young man profile representing "You"
          alt="You"
        />
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded text-white text-[10px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          You
        </div>
      </div>

      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* Video Call Controls Toolbar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-4 flex items-center justify-around shadow-2xl border border-white/25 text-gray-800">
          {/* Flip Camera */}
          <button className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors active:scale-90 text-gray-700">
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Mute Mic */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors active:scale-90 ${
              isMuted ? 'bg-red-500 text-white hover:bg-red-600' : 'hover:bg-gray-200 text-gray-700'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera On/Off */}
          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors active:scale-90 ${
              !isVideoOn ? 'bg-red-500 text-white hover:bg-red-600' : 'hover:bg-gray-200 text-gray-700'
            }`}
          >
            {!isVideoOn ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Screen Share Toggle */}
          <button
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors active:scale-90 ${
              isScreenSharing ? 'bg-[#00a884] text-white hover:bg-[#008f70]' : 'hover:bg-gray-200 text-gray-700'
            }`}
          >
            <ScreenShare className="w-5 h-5" />
          </button>

          {/* End Call */}
          <button
            onClick={onEndCall}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 active:scale-90 transition-all"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
