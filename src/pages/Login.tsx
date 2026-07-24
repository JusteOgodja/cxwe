import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/catalog';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (session) return <Navigate to={from} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError('Email ou mot de passe incorrect.');
      setLoading(false);
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/">
            <img src="/logo.png" alt="Morocco Food Export" className="h-20 w-auto mx-auto mb-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Accéder au catalogue</h1>
          <p className="text-stone-400 text-sm mt-2">Connectez-vous à votre espace acheteur</p>
        </div>

        <div className="bg-stone-800/60 border border-stone-700 rounded-2xl p-8 shadow-xl backdrop-blur">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">Email professionnel</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-stone-900 border border-stone-600 text-white rounded-xl px-4 py-3 text-sm placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-stone-900 border border-stone-600 text-white rounded-xl px-4 py-3 text-sm placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition"
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
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <LogIn className="w-4 h-4" />}
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-sm text-stone-400 mt-6">
            Pas encore de compte ?{' '}
            <Link to="/signup" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Créer un accès acheteur
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
