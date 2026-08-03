import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const SECTORS = ['food', 'cosmetics', 'pharma', 'household', 'textile', 'baby', 'paper', 'other'] as const;
const ROLES = ['importer', 'distributor', 'wholesaler', 'retailer', 'agent', 'other'] as const;
const COUNTRIES = ['france', 'spain', 'italy', 'belgium', 'netherlands', 'germany', 'portugal', 'uk', 'switzerland', 'canada', 'usa', 'senegal', 'ivoryCoast', 'cameroon', 'tunisia', 'algeria', 'egypt', 'saudiArabia', 'uae', 'other'] as const;

export default function SignUp() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    company_name: '',
    country: '',
    phone: '',
    sector: '',
    role: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  if (session) return <Navigate to="/catalog" replace />;

  if (emailSent) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center px-4">
      <div className="bg-stone-800/60 border border-stone-700 rounded-2xl p-10 max-w-md text-center shadow-xl">
        <div className="w-16 h-16 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0-10.5 6.75L3.75 6.75" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t('signup.confirmTitle')}</h2>
        <p className="text-stone-400 text-sm leading-relaxed">
          {t('signup.confirmTextBefore')} <span className="text-amber-400 font-medium">{form.email}</span>.<br />
          {t('signup.confirmTextAfter')}
        </p>
        <Link to="/" className="inline-block mt-6 text-sm text-stone-400 hover:text-white transition-colors">
          {t('signup.backHome')}
        </Link>
      </div>
    </div>
  );

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { role: 'buyer', full_name: form.full_name } },
    });

    if (signUpErr || !data.user) {
      setError(signUpErr?.message ?? t('signup.createError'));
      setLoading(false);
      return;
    }

    const { error: profileErr } = await supabase.from('buyer_profiles').insert({
      user_id: data.user.id,
      full_name: form.full_name,
      company_name: form.company_name,
      country: form.country,
      phone: form.phone || null,
      sector: form.sector || null,
      role: form.role || null,
      message: form.message || null,
    });

    if (profileErr) {
      setError(t('signup.profileError'));
      setLoading(false);
      return;
    }

    // If Supabase email confirmation is enabled, data.session will be null
    if (!data.session) {
      setEmailSent(true);
      setLoading(false);
      return;
    }

    navigate('/catalog', { replace: true });
  };

  const field = (
    label: string,
    key: string,
    type = 'text',
    placeholder = '',
    required = true
  ) => (
    <div>
      <label className="block text-xs font-medium text-stone-300 mb-1.5">
        {label}{required && <span className="text-amber-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={(form as Record<string, string>)[key]}
        onChange={set(key)}
        placeholder={placeholder}
        className="w-full bg-stone-900 border border-stone-600 text-white rounded-xl px-4 py-3 text-sm placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition"
      />
    </div>
  );

  const select = (label: string, key: string, options: string[], required = true) => (
    <div>
      <label className="block text-xs font-medium text-stone-300 mb-1.5">
        {label}{required && <span className="text-amber-400 ml-0.5">*</span>}
      </label>
      <select
        required={required}
        value={(form as Record<string, string>)[key]}
        onChange={set(key)}
        className="w-full bg-stone-900 border border-stone-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition"
      >
        <option value="">{t('signup.selectPlaceholder')}</option>
        {options.map(o => <option key={o} value={o}>{t(`signup.options.${o}`)}</option>)}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Link to="/">
            <img src="/logo.png" alt="Morocco Food Export" className="h-20 w-auto mx-auto mb-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">{t('signup.title')}</h1>
          <p className="text-stone-400 text-sm mt-2">
            {t('signup.subtitle')}
          </p>
        </div>

        <div className="bg-stone-800/60 border border-stone-700 rounded-2xl p-8 shadow-xl backdrop-blur">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Identité */}
            <div>
              <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-4">
                {t('signup.personalSection')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field(t('signup.fullName'), 'full_name', 'text', t('signup.fullNamePlaceholder'))}
                {field(t('signup.email'), 'email', 'email', 'you@company.com')}
                {field(t('signup.password'), 'password', 'password', t('signup.passwordPlaceholder'))}
                {field(t('signup.phone'), 'phone', 'tel', '+33 6 00 00 00 00', false)}
              </div>
            </div>

            {/* Entreprise */}
            <div>
              <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-4">
                {t('signup.companySection')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field(t('signup.companyName'), 'company_name', 'text', t('signup.companyPlaceholder'))}
                {select(t('signup.country'), 'country', COUNTRIES as unknown as string[])}
                {select(t('signup.sector'), 'sector', SECTORS as unknown as string[])}
                {select(t('signup.role'), 'role', ROLES as unknown as string[])}
              </div>
            </div>

            {/* Message optionnel */}
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                {t('signup.message')} <span className="text-stone-500">{t('signup.optional')}</span>
              </label>
              <textarea
                value={form.message}
                onChange={set('message')}
                rows={3}
                placeholder={t('signup.messagePlaceholder')}
                className="w-full bg-stone-900 border border-stone-600 text-white rounded-xl px-4 py-3 text-sm placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition resize-none"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-700 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <UserPlus className="w-4 h-4" />}
              {loading ? t('signup.submitting') : t('signup.submit')}
            </button>
          </form>

          <p className="text-center text-sm text-stone-400 mt-6">
            {t('signup.hasAccount')}{' '}
            <Link to="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              {t('signup.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
