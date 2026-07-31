import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface Props {
  onLogin: () => void;
  isLoggedIn: boolean;
}

export default function AdminLogin({ onLogin, isLoggedIn }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  if (isLoggedIn) return <Navigate to="/admin/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(t('admin.login.errorInvalid'));
      setLoading(false);
      return;
    }
    const userEmail = (data.user?.email ?? '').toLowerCase();
    if (ADMIN_EMAILS.length === 0 || !ADMIN_EMAILS.includes(userEmail)) {
      await supabase.auth.signOut();
      setError(t('admin.login.errorForbidden'));
      setLoading(false);
      return;
    }
    onLogin();
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Morocco Food Export"
            className="h-24 w-auto mx-auto mb-4"
          />
          <h1 className="text-xl font-bold text-stone-800">{t('admin.login.title')}</h1>
          <p className="text-stone-500 text-sm mt-1">{t('admin.login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">{t('admin.login.emailLabel')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              placeholder="admin@redmac.ma"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">{t('admin.login.passwordLabel')}</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-300 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {loading ? t('admin.login.submitting') : t('admin.login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
