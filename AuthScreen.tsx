import React, { useState } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { Mail, Lock, Eye, EyeOff, LogIn, MessageSquare } from 'lucide-react';

interface AuthScreenProps {
  onSuccess: () => void;
  darkMode: boolean;
}

export default function AuthScreen({ onSuccess, darkMode }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // If display name is entered, set it
        if (displayName.trim()) {
          await updateProfile(userCredential.user, {
            displayName: displayName.trim(),
          });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errMsg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email address is already in use.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password must be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Please enter a valid email address.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-300 ${
        darkMode ? 'bg-[#121212] text-[#f5f5f7]' : 'bg-[#F5F5F7] text-[#121212]'
      }`}
    >
      {/* Top Branding */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-[#00a884] flex items-center justify-center rounded-xl mb-4 transition-transform hover:scale-105 active:scale-95 duration-200 cursor-default shadow-md">
          <MessageSquare className="text-white w-9 h-9" />
        </div>
        <h1 className={`text-3xl font-extrabold tracking-tight ${darkMode ? 'text-[#f5f5f7]' : 'text-zinc-900'}`}>Messenger</h1>
        <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-500' : 'text-gray-600'}`}>
          Efficient, reliable, and unobtrusive.
        </p>
      </div>

      {/* Auth Container */}
      <main
        className={`w-full max-w-[400px] rounded-xl p-8 border shadow-lg transition-colors duration-300 ${
          darkMode
            ? 'bg-[#1c1c1e] border-white/10'
            : 'bg-white border-gray-200'
        }`}
      >
        <form className="space-y-4" onSubmit={handleAuth}>
          {error && (
            <div className="p-3 text-sm bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
              {error}
            </div>
          )}

          {isSignUp && (
            <div className="space-y-1">
              <label
                className={`text-xs font-semibold px-1 ${
                  darkMode ? 'text-zinc-400' : 'text-gray-600'
                }`}
                htmlFor="displayName"
              >
                Full Name
              </label>
              <input
                className={`block w-full px-3 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-[#00a884] outline-none transition-all ${
                  darkMode
                    ? 'bg-[#2a2a2e] border-white/5 text-white placeholder-zinc-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
                id="displayName"
                placeholder="E.g. Alex Rivera"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-1">
            <label
              className={`text-xs font-semibold px-1 ${
                darkMode ? 'text-zinc-400' : 'text-gray-600'
              }`}
              htmlFor="email"
            >
              Email address
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#00a884] transition-colors">
                <Mail className="w-5 h-5" />
              </div>
              <input
                className={`block w-full pl-10 pr-3 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-[#00a884] outline-none transition-all ${
                  darkMode
                    ? 'bg-[#2a2a2e] border-white/5 text-white placeholder-zinc-500'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                id="email"
                placeholder="name@company.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label
                className={`text-xs font-semibold ${
                  darkMode ? 'text-zinc-400' : 'text-gray-600'
                }`}
                htmlFor="password"
              >
                Password
              </label>
              {!isSignUp && (
                <button
                  type="button"
                  className="text-xs font-semibold text-[#00a884] hover:underline outline-none"
                  onClick={() => alert('Reset link will be sent to your email.')}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#00a884] transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                className={`block w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-[#00a884] outline-none transition-all ${
                  darkMode
                    ? 'bg-[#2a2a2e] border-white/5 text-white placeholder-zinc-500'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                id="password"
                placeholder="••••••••"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <button
            className="w-full bg-[#00a884] hover:bg-[#008f70] text-white font-semibold text-sm py-3 rounded-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Login'}
            <LogIn className="w-4 h-4" />
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div aria-hidden="true" className="absolute inset-0 flex items-center">
            <div className={`w-full border-t ${darkMode ? 'border-white/5' : 'border-gray-200'}`} />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className={`px-4 text-xs font-semibold ${darkMode ? 'bg-[#1c1c1e] text-zinc-500' : 'bg-white text-gray-400'}`}>
              Or continue with
            </span>
          </div>
        </div>

        {/* Social Login */}
        <div className="space-y-2">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={`w-full border text-sm font-semibold py-2.5 rounded-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer ${
              darkMode
                ? 'bg-transparent border-white/10 text-white hover:bg-white/5'
                : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
            }`}
            type="button"
          >
            <svg height="18" viewBox="0 0 18 18" width="18">
              <path
                d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.89 2.69-6.62z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.3C2.43 15.98 5.48 18 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.97 10.72A5.41 5.41 0 0 1 3.64 9c0-.6.1-1.17.27-1.72V4.98H.95A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.95 4.02l3.02-2.3z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.43 2.02.95 4.98l3.02 2.3c.71-2.11 2.69-3.7 5.03-3.7z"
                fill="#EA4335"
              />
            </svg>
            Sign In with Google
          </button>
        </div>
      </main>

      {/* Footer Links */}
      <footer className="mt-8 text-center">
        <p className={`text-sm ${darkMode ? 'text-zinc-500' : 'text-gray-600'}`}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[#00a884] font-bold hover:underline transition-all outline-none"
          >
            {isSignUp ? 'Log in here' : 'Sign up now'}
          </button>
        </p>
        <div className="mt-4 flex justify-center gap-4 text-xs opacity-60">
          <a className="hover:underline" href="#">
            Privacy Policy
          </a>
          <a className="hover:underline" href="#">
            Terms of Service
          </a>
        </div>
      </footer>

      {/* Top background aesthetic bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00a884] to-[#005c4b] opacity-80" />
    </div>
  );
}
