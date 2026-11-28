import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  LogIn,
  LogOut,
  Check,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  KeyRound,
  User,
  RefreshCw,
} from 'lucide-react';
import { loginWithGoogle, loginWithEmail, signupWithEmail, logoutUser } from '../lib/firebase.ts';
import { setDemoSession, clearDemoSession } from '../lib/demoSession.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  initialMode?: 'signin' | 'signup' | 'demo';
}

interface DemoStatusResponse {
  demoEnabled: boolean;
  configuredViaEnv: boolean;
  requiresFirstRunSetup: boolean;
  isAdminSignedIn: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialMode = 'signin',
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'demo'>(
    initialMode === 'demo' ? 'demo' : 'account'
  );
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoName, setDemoName] = useState('');
  const [demoPasscode, setDemoPasscode] = useState('');
  const [rotatePasscode, setRotatePasscode] = useState('');
  const [demoStatus, setDemoStatus] = useState<DemoStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadDemoStatus = async () => {
    try {
      const res = await fetch('/api/auth/demo-status');
      if (res.ok) {
        const data = (await res.json()) as DemoStatusResponse;
        setDemoStatus(data);
      }
    } catch {
      // ignore transient network check error
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode === 'demo' ? 'demo' : 'account');
      setIsSignUp(initialMode === 'signup');
      setError(null);
      setSuccess(null);
      setDemoPasscode('');
      setRotatePasscode('');
      loadDemoStatus();
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const isDemoUser = Boolean(currentUser?.isDemo);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      clearDemoSession();
      await loginWithGoogle();
      setSuccess('Successfully signed in with Google!');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 900);
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
      clearDemoSession();
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
      }, 900);
    } catch (err: any) {
      console.error('Email auth error:', err);
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPasscode = demoPasscode.trim();
    if (!cleanPasscode) {
      setError('Please enter a Demo Invite Passcode.');
      return;
    }

    const isSetup = Boolean(demoStatus?.requiresFirstRunSetup);
    if (isSetup && cleanPasscode.length < 8) {
      setError('For security, your Demo Invite Passcode must be at least 8 characters.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const endpoint = isSetup ? '/api/auth/demo-setup' : '/api/auth/demo-login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: cleanPasscode,
          displayName: demoName.trim() || (isSetup ? 'Demo Owner' : 'Demo Tester'),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token || !data?.user) {
        throw new Error(data?.message || data?.error || 'Demo sign-in failed.');
      }

      setDemoSession({
        token: data.token,
        uid: data.user.uid,
        tenantId: data.user.tenantId,
        displayName: data.user.displayName || 'Demo Tester',
        email: data.user.email || 'demo-tester@raone.ai',
        isDemo: true,
        expiresAt: data.expiresAt,
      });

      setSuccess(
        isSetup
          ? 'Demo passcode activated! Share that passcode with your friends for unrestricted testing.'
          : 'Demo Unlimited Access activated — all Studios unlocked!'
      );
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 900);
    } catch (err: any) {
      setError(err?.message || 'Unable to verify Demo Passcode.');
    } finally {
      setLoading(false);
    }
  };

  const handleRotateDemoPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rotatePasscode.trim().length < 8) {
      setError('New demo passcode must be at least 8 characters.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/auth/demo-rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: rotatePasscode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Failed to rotate passcode.');
      }
      setRotatePasscode('');
      setSuccess('Demo invite passcode rotated! Previous demo sessions were revoked.');
      await loadDemoStatus();
    } catch (err: any) {
      setError(err?.message || 'Failed to rotate demo passcode.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      if (isDemoUser) {
        await fetch('/api/auth/demo-logout', { method: 'POST' }).catch(() => {});
        clearDemoSession();
      } else {
        await logoutUser();
      }
      setSuccess('Signed out successfully.');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 750);
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
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo and Title */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)] mx-auto mb-3">
            <img
              src="/assets/aistudio/RaOne_Logo_c8b49006.png"
              alt="RaOne Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-xl font-display font-bold text-white">
            {currentUser
              ? isDemoUser
                ? 'Demo Tester Session'
                : 'RaOne Account'
              : activeTab === 'demo'
              ? 'Unrestricted Demo Access'
              : isSignUp
              ? 'Create RaOne Account'
              : 'Sign in to RaOne'}
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
                <div
                  className={`w-10 h-10 rounded-full font-bold flex items-center justify-center ${
                    isDemoUser
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {currentUser.displayName
                    ? String(currentUser.displayName)[0].toUpperCase()
                    : currentUser.email
                    ? currentUser.email[0].toUpperCase()
                    : 'U'}
                </div>
              )}
              <div className="overflow-hidden min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
                  <span className="truncate">{currentUser.displayName || 'RaOne Member'}</span>
                  {isDemoUser && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold uppercase shrink-0">
                      DEMO UNLIMITED
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#9E9E9E] truncate">
                  {isDemoUser ? `Isolated Demo Workspace · ${currentUser.uid}` : currentUser.email}
                </div>
              </div>
            </div>

            <div className="text-xs text-[#8E8E8E] space-y-1 p-3 rounded-lg bg-[#222]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {isDemoUser
                    ? 'Active Demo Sandbox (All Studios, 4K & Unlimited Credits)'
                    : 'Active Sovereign RaOne Member Session'}
                </span>
              </div>
              <div>
                {isDemoUser
                  ? 'Signed HMAC session stored strictly in memory, isolated from production user accounts.'
                  : 'Secured with Firebase JWT verification & AES-256-GCM per-tenant vault.'}
              </div>
            </div>

            {/* Owner Control: Rotate Demo Passcode without editing env vars */}
            {!isDemoUser && demoStatus?.isAdminSignedIn && !demoStatus?.configuredViaEnv && (
              <form
                onSubmit={handleRotateDemoPasscode}
                className="p-3.5 rounded-xl bg-[#222222] border border-[#343434] space-y-2.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Owner Control: Update / Rotate Demo Invite Passcode</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={rotatePasscode}
                    onChange={(e) => setRotatePasscode(e.target.value)}
                    placeholder="New 8+ char demo passcode..."
                    minLength={8}
                    className="flex-1 bg-[#181818] border border-[#3A3A3A] focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#666] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Rotate</span>
                  </button>
                </div>
              </form>
            )}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{isDemoUser ? 'Exit Demo Session' : 'Sign Out'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode Switcher: Standard Account vs Unrestricted Demo Access */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#141414] border border-[#2c2c2c]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('account');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'account'
                    ? 'bg-[#2a2a2a] text-white shadow'
                    : 'text-[#8E8E8E] hover:text-white'
                }`}
              >
                Account Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('demo');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'demo'
                    ? 'bg-gradient-to-r from-purple-600/80 to-amber-500/80 text-white shadow'
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Demo Login</span>
              </button>
            </div>

            {activeTab === 'demo' ? (
              <form onSubmit={handleDemoSubmit} className="space-y-3">
                <div className="p-3 rounded-xl bg-purple-950/25 border border-purple-500/30 text-[11px] text-purple-200 leading-relaxed">
                  {demoStatus?.requiresFirstRunSetup ? (
                    <span>
                      <strong className="text-amber-300">First-Time Owner Setup:</strong> Set a secret Demo
                      Invite Passcode (8+ characters) once. Share that passcode with your friends to give them{' '}
                      <strong>unrestricted Ultimate access</strong> inside an isolated sandbox while blocking
                      external bots &amp; attackers.
                    </span>
                  ) : (
                    <span>
                      Enter the <strong>Demo Invite Passcode</strong> shared with you for full unrestricted
                      access across Code, Vision 4K, Cinema, Music, Document Studios &amp; Libraries.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#B4B4B4] mb-1">
                    Your Name (Tester Label)
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-[#777] absolute left-3 top-3" />
                    <input
                      type="text"
                      value={demoName}
                      onChange={(e) => setDemoName(e.target.value)}
                      placeholder={demoStatus?.requiresFirstRunSetup ? 'Owner / Reviewer' : 'e.g. Kasun'}
                      maxLength={48}
                      className="w-full bg-[#262626] border border-[#3A3A3A] focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#666] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#B4B4B4] mb-1">
                    {demoStatus?.requiresFirstRunSetup
                      ? 'Create Demo Invite Passcode (8+ chars)'
                      : 'Demo Invite Passcode'}
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-[#777] absolute left-3 top-3" />
                    <input
                      type="password"
                      value={demoPasscode}
                      onChange={(e) => setDemoPasscode(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={demoStatus?.requiresFirstRunSetup ? 8 : 1}
                      className="w-full bg-[#262626] border border-[#3A3A3A] focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#666] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-amber-500 hover:opacity-95 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 mt-2 shadow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {demoStatus?.requiresFirstRunSetup
                      ? 'Activate Passcode & Enter Demo Studio'
                      : 'Enter Unrestricted Demo Studio'}
                  </span>
                </button>
              </form>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
