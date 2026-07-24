import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const SECTORS = [
  'Alimentaire & Boissons',
  'Cosmétique & Hygiène',
  'Pharmacie & Parapharmacie',
  'Produits ménagers',
  'Textile & Habillement',
  'Jouets & Puériculture',
  'Papeterie & Fournitures',
  'Autre',
];

const ROLES = [
  'Importateur',
  'Distributeur',
  'Grossiste',
  'Détaillant',
  'Agent / Courtier',
  'Autre',
];

const COUNTRIES = [
  'France', 'Espagne', 'Italie', 'Belgique', 'Pays-Bas', 'Allemagne', 'Portugal',
  'Royaume-Uni', 'Suisse', 'Canada', 'États-Unis', 'Sénégal', 'Côte d\'Ivoire',
  'Cameroun', 'Tunisie', 'Algérie', 'Égypte', 'Arabie Saoudite', 'Émirats Arabes Unis',
  'Autre',
];

export default function SignUp() {
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

  if (session) return <Navigate to="/catalog" replace />;

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
      setError(signUpErr?.message ?? 'Erreur lors de la création du compte.');
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
      setError('Compte créé, mais erreur lors de l\'enregistrement du profil. Contactez-nous.');
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
        <option value="">Sélectionner…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
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
          <h1 className="text-2xl font-bold text-white">Créer un accès acheteur</h1>
          <p className="text-stone-400 text-sm mt-2">
            Accédez au catalogue complet et aux fiches produits détaillées
          </p>
        </div>

        <div className="bg-stone-800/60 border border-stone-700 rounded-2xl p-8 shadow-xl backdrop-blur">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Identité */}
            <div>
              <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-4">
                Vos informations
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Nom complet', 'full_name', 'text', 'Prénom Nom')}
                {field('Email professionnel', 'email', 'email', 'you@company.com')}
                {field('Mot de passe', 'password', 'password', 'Minimum 8 caractères')}
                {field('Téléphone / WhatsApp', 'phone', 'tel', '+33 6 00 00 00 00', false)}
              </div>
            </div>

            {/* Entreprise */}
            <div>
              <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-4">
                Votre entreprise
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Société / Raison sociale', 'company_name', 'text', 'Nom de votre entreprise')}
                {select('Pays', 'country', COUNTRIES)}
                {select('Secteur d\'activité', 'sector', SECTORS)}
                {select('Votre rôle', 'role', ROLES)}
              </div>
            </div>

            {/* Message optionnel */}
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Message <span className="text-stone-500">(optionnel)</span>
              </label>
              <textarea
                value={form.message}
                onChange={set('message')}
                rows={3}
                placeholder="Décrivez vos besoins, volumes envisagés, marchés cibles…"
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
              {loading ? 'Création en cours…' : 'Créer mon accès & accéder au catalogue'}
            </button>
          </form>

          <p className="text-center text-sm text-stone-400 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
