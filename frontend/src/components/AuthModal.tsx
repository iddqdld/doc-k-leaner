import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
  }
}

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const { login, register, googleLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !GOOGLE_CLIENT_ID || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        setError('');
        setLoading(true);
        try {
          await googleLogin(response.credential);
          onClose();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Google login failed');
        } finally {
          setLoading(false);
        }
      },
    });
    if (googleBtnRef.current) {
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: mode === 'login' ? 'signin_with' : 'signup_with',
      });
    }
  }, [open, mode, googleLogin, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        if (mode === 'login') {
          await login(email, password);
        } else {
          await register(email, password, name);
        }
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, name, login, register, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-[#3a165d] px-6 py-5">
          <h2 className="text-xl font-black text-orange-500 tracking-tight">
            {mode === 'login' ? 'Se connecter' : 'Créer un compte'}
          </h2>
          <p className="text-violet-200/60 text-xs mt-1">
            {mode === 'login'
              ? 'Connectez-vous pour voir votre historique'
              : 'Inscrivez-vous pour suivre vos scans'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Nom</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5d2e8e]/40 focus:border-[#5d2e8e]"
                placeholder="Votre nom"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5d2e8e]/40 focus:border-[#5d2e8e]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5d2e8e]/40 focus:border-[#5d2e8e]"
              placeholder="Min. 6 caractères"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3a165d] hover:bg-[#5d2e8e] text-white font-semibold text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '...' : mode === 'login' ? 'Connexion' : "S'inscrire"}
          </button>

          {GOOGLE_CLIENT_ID && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">ou</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
              <div ref={googleBtnRef} className="flex justify-center" />
            </>
          )}

          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <button type="button" onClick={() => { setMode('register'); setError(''); }} className="text-orange-500 font-semibold hover:underline">
                  S'inscrire
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{' '}
                <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-orange-500 font-semibold hover:underline">
                  Se connecter
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
