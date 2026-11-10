import React, { useState } from 'react';
import { X, Mail, Lock, LogIn, LogOut, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { loginWithGoogle, loginWithEmail, signupWithEmail, logoutUser } from '../lib/firebase.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await loginWithGoogle();
      setSuccess('Successfully signed in with Google!');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1000);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Google Sign-In failed. Please verify popup permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (isSignUp) {
        await signupWithEmail(email.trim(), password);
        setSuccess('Account created and signed in successfully!');
      } else {
        await loginWithEmail(email.trim(), password);
        setSuccess('Signed in successfully!');
      }
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1000);
    } catch (err: any) {
      console.error('Email auth error:', err);
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await logoutUser();
      setSuccess('Signed out successfully.');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#1C1C1C] border border-[#333333] rounded-2xl shadow-2xl overflow-hidden p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-[#9E9E9E] hover:text-white hover:bg-[#2C2C2C] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo and Title */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)] mx-auto mb-3">
            <img
              src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
              alt="RaOne Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-xl font-display font-bold text-white">
            {currentUser ? 'RaOne Account' : isSignUp ? 'Create RaOne Account' : 'Sign in to RaOne'}
          </h2>
          <p className="text-xs text-[#8E8E8E] mt-1">
            RaOne AI by RavanaTec · Think. Create. Act.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {currentUser ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#262626] border border-[#3A3A3A] flex items-center gap-3">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border border-amber-500/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center">
                  {currentUser.email ? currentUser.email[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="text-sm font-semibold text-white truncate">
                  {currentUser.displayName || 'RaOne Member'}
                </div>
                <div className="text-xs text-[#9E9E9E] truncate">{currentUser.email}</div>
              </div>
            </div>

            <div className="text-xs text-[#8E8E8E] space-y-1 p-3 rounded-lg bg-[#222]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Active Sovereign RaOne Member Session</span>
              </div>
              <div>Secured with enterprise single sign-on & TLS 256-bit encryption.</div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Google Sign-In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors shadow-md"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-[#333] w-full" />
              <span className="bg-[#1C1C1C] px-2 text-[10px] text-[#777] uppercase font-mono">
                or with email
              </span>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#B4B4B4] mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#777] absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hello@example.com"
                    required
                    className="w-full bg-[#262626] border border-[#3A3A3A] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#666] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#B4B4B4] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#777] absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-[#262626] border border-[#3A3A3A] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#666] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-[11px] text-[#9E9E9E] hover:text-amber-300 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
