import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { User as AppUser } from '../types';
import { Copy, Check, Camera, Plus, LogOut } from 'lucide-react';

interface ProfileSetupScreenProps {
  onSave: (profile: AppUser) => void;
  initialProfile?: AppUser | null;
  darkMode: boolean;
}

export default function ProfileSetupScreen({
  onSave,
  initialProfile,
  darkMode,
}: ProfileSetupScreenProps) {
  const [displayName, setDisplayName] = useState(
    initialProfile?.displayName || auth.currentUser?.displayName || ''
  );
  const [photoURL, setPhotoURL] = useState(
    initialProfile?.photoURL || auth.currentUser?.photoURL || ''
  );
  const [bio, setBio] = useState(initialProfile?.bio || "I'm using Messenger...");
  const [uniqueID, setUniqueID] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProfile) {
      setDisplayName(initialProfile.displayName || '');
      setPhotoURL(initialProfile.photoURL || '');
      setBio(initialProfile.bio || "I'm using Messenger...");
      setUniqueID(initialProfile.uniqueID);
    } else {
      if (!displayName) {
        setDisplayName(auth.currentUser?.displayName || '');
      }
      if (!photoURL) {
        setPhotoURL(auth.currentUser?.photoURL || '');
      }
      if (!uniqueID) {
        const randomPart = Math.random().toString(36).substring(2, 7);
        setUniqueID(`user_${randomPart}`);
      }
    }
  }, [initialProfile]);

  const copyUniqueID = () => {
    if (!uniqueID.trim()) return;
    navigator.clipboard.writeText(uniqueID.trim().toLowerCase()).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Compress and resize image to maximum 200x200 using Canvas to keep payload small
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 200;
            const MAX_HEIGHT = 200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              // Output compressed JPEG representation (quality 0.7)
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
              setPhotoURL(compressedBase64);
            }
          };
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setError(null);
    const cleanDisplayName = displayName.trim();
    const cleanID = uniqueID.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!cleanDisplayName) {
      setError('Display Name is required.');
      return;
    }
    if (!cleanID) {
      setError('Unique User ID is required.');
      return;
    }
    if (cleanID.length < 3) {
      setError('Unique User ID must be at least 3 characters long.');
      return;
    }
    if (bio.length > 140) {
      setError('Bio cannot exceed 140 characters.');
      return;
    }

    setSaving(true);
    const user = auth.currentUser;
    if (!user) {
      setError('User is not authenticated.');
      setSaving(false);
      return;
    }

    try {
      // Uniqueness check for Unique User ID
      const q = query(
        collection(db, 'users'),
        where('uniqueID', '==', cleanID)
      );
      const querySnapshot = await getDocs(q);
      
      let taken = false;
      querySnapshot.forEach((docSnap) => {
        if (docSnap.id !== user.uid) {
          taken = true;
        }
      });

      if (taken) {
        setError('This Unique User ID is already taken. Please choose another one.');
        setSaving(false);
        return;
      }

      const updatedProfile: AppUser = {
        uid: user.uid,
        email: user.email || '',
        displayName: cleanDisplayName,
        photoURL,
        bio: bio.trim(),
        uniqueID: cleanID,
        status: 'online',
        lastSeen: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      onSave(updatedProfile);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save profile. Please check firestore.rules.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center transition-colors duration-300 ${
        darkMode ? 'bg-[#121212] text-[#f5f5f7]' : 'bg-[#F5F5F7] text-[#121212]'
      }`}
    >
      <main className="w-full max-w-lg px-6 pt-12 pb-32 flex flex-col items-center">
        {/* Header */}
        <header className="w-full mb-8 flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold mb-2">Setup Profile</h1>
          <p className={`text-sm opacity-85 ${darkMode ? 'text-zinc-500' : 'text-gray-600'}`}>
            Make it yours. This information is visible to your contacts.
          </p>
        </header>

        {error && (
          <div className="w-full p-3 text-sm bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Avatar View */}
        <div className="relative group cursor-pointer mb-6">
          <div className="w-32 h-32 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-zinc-700 hover:border-[#00a884] transition-all duration-300 shadow-md">
            {photoURL ? (
              <img className="w-full h-full object-cover" src={photoURL} alt="Avatar" referrerPolicy="no-referrer" />
            ) : (
              <Camera className="w-10 h-10 text-zinc-500" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-[#00a884] p-2.5 rounded-full shadow-lg border-2 border-[#121212] group-hover:scale-110 transition-transform cursor-pointer">
            <Plus className="w-4 h-4 text-white font-bold" />
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        {/* Form Fields */}
        <div className="w-full space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#00a884] px-1" htmlFor="display-name">
              Display Name
            </label>
            <input
              className={`w-full border-b-2 border-x-0 border-t-0 focus:border-[#00a884] focus:ring-0 text-base py-3 px-4 rounded-t-lg transition-all outline-none ${
                darkMode
                  ? 'bg-[#1c1c1e] border-white/10 text-white placeholder-zinc-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              id="display-name"
              placeholder="E.g. Alex Rivera"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold text-[#00a884]" htmlFor="unique-id">
                Unique User ID
              </label>
              <button
                type="button"
                onClick={copyUniqueID}
                className="text-[10px] font-bold text-zinc-500 hover:text-[#00a884] transition-colors flex items-center gap-1 outline-none"
                title="Copy Unique ID"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#00a884]" /> Copy ID
                  </>
                )}
              </button>
            </div>
            <input
              className={`w-full border-b-2 border-x-0 border-t-0 focus:border-[#00a884] focus:ring-0 text-base py-3 px-4 rounded-t-lg transition-all outline-none font-mono ${
                darkMode
                  ? 'bg-[#1c1c1e] border-white/10 text-white placeholder-zinc-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              id="unique-id"
              placeholder="e.g. alex_rivera"
              type="text"
              value={uniqueID}
              onChange={(e) => {
                // Keep only lowercase alphanumeric and underscore, no spaces
                const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                setUniqueID(val);
              }}
              required
            />
            <p className="text-[10px] text-zinc-500 px-1 leading-normal">
              Your Unique User ID is used by other users to search and add you. It must contain only lowercase letters, numbers, and underscores (at least 3 characters).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#00a884] px-1" htmlFor="status-bio">
              Status / Bio
            </label>
            <textarea
              className={`w-full border-b-2 border-x-0 border-t-0 focus:border-[#00a884] focus:ring-0 text-sm py-3 px-4 rounded-t-lg transition-all outline-none resize-none ${
                darkMode
                  ? 'bg-[#1c1c1e] border-white/10 text-white placeholder-zinc-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              id="status-bio"
              placeholder="I'm using Messenger..."
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <p
              className={`text-right text-xs ${
                bio.length > 140
                  ? 'text-red-500 font-bold'
                  : darkMode
                  ? 'text-zinc-500'
                  : 'text-gray-400'
              }`}
            >
              {bio.length}/140
            </p>
          </div>
        </div>

        {/* Action Items */}
        <div className="w-full mt-8 space-y-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#00a884] hover:bg-[#008f70] text-white py-4 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>

          <button
            onClick={async () => {
              await auth.signOut();
            }}
            className="w-full py-3 rounded-full text-xs font-bold text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 outline-none"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </main>
    </div>
  );
}
