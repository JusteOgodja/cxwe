import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Handshake, LogIn, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'ع' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const { t, i18n } = useTranslation();

  // Statut admin déterminé côté serveur (public.is_admin()), jamais via une liste
  // d'emails côté navigateur. `false` par défaut : le menu admin n'apparaît qu'une
  // fois le contrôle serveur terminé — aucun clignotement pour un utilisateur ordinaire.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!session) { setIsAdmin(false); return; }
    // Session présente : la RPC protégée peut être appelée.
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (!cancelled) setIsAdmin(!error && data === true);
    });
    return () => { cancelled = true; };
  }, [session]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const changeLang = (code: string) => {
    i18n.changeLanguage(code);
    document.documentElement.lang = code;
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    const lang = i18n.language?.split('-')[0] || 'fr';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location]);

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-ma-gold font-semibold'
      : 'text-stone-300 hover:text-white';

  const currentLang = i18n.language?.split('-')[0] || 'fr';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? 'bg-ma-navy/96 backdrop-blur-md shadow-nav'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className="relative rounded-full shrink-0 transition-all duration-300"
              style={{
                background: 'radial-gradient(circle, rgba(201,136,58,0.18) 0%, transparent 70%)',
                boxShadow: '0 0 14px rgba(201,136,58,0.30), 0 0 28px rgba(201,136,58,0.12)',
              }}
            >
              <img
                src="/logo.png"
                alt="Morocco Food Export"
                className="h-14 w-auto rounded-full block"
                style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
              />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-white font-bold text-sm tracking-wide">Morocco Food Export</div>
              <div className="text-ma-gold text-[10px] tracking-widest uppercase font-medium">Quality from Morocco</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className={`text-sm transition-colors ${isActive('/')}`}>{t('nav.home')}</Link>
            <Link to="/catalog" className={`text-sm transition-colors ${isActive('/catalog')}`}>{t('nav.catalog')}</Link>
            <Link to="/confiance" className={`text-sm transition-colors ${isActive('/confiance')}`}>{t('nav.trust')}</Link>
            <Link to="/comment-ca-marche" className={`text-sm transition-colors ${isActive('/comment-ca-marche')}`}>{t('nav.howItWorks')}</Link>
            <Link to="/quote" className={`text-sm transition-colors ${isActive('/quote')}`}>{t('nav.quote')}</Link>
          </nav>

          {/* Right side: lang switcher + CTA */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Language switcher */}
            <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
              {LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => changeLang(l.code)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    currentLang === l.code
                      ? 'bg-ma-gold text-white'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <Link
              to="/partner"
              className="flex items-center gap-1.5 border border-ma-green/40 hover:border-ma-green text-ma-green hover:text-white hover:bg-ma-green text-sm font-medium px-4 py-2 rounded-lg transition-all"
            >
              <Handshake className="w-3.5 h-3.5" /> {t('nav.collaborate')}
            </Link>
            {session ? (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    className="flex items-center gap-1.5 text-sm text-stone-100 border border-ma-gold/50 hover:border-ma-gold hover:bg-ma-gold/10 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-ma-gold" /> {t('nav.dashboard')}
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 text-stone-400 hover:text-white border border-stone-600 hover:border-stone-400 text-sm px-3 py-1.5 rounded-lg transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" /> {t('nav.access')}
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-ma-navy border-t border-white/5 px-4 py-4 space-y-1">
          {[
            { to: '/', label: t('nav.home') },
            { to: '/catalog', label: t('nav.catalog') },
            { to: '/confiance', label: t('nav.trust') },
            { to: '/comment-ca-marche', label: t('nav.howItWorks') },
            { to: '/quote', label: t('nav.quote') },
          ].map(l => (
            <Link key={l.to} to={l.to} className="block text-stone-300 hover:text-white hover:bg-white/5 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors">
              {l.label}
            </Link>
          ))}
          <Link to="/partner" className="flex items-center gap-1.5 text-ma-green hover:text-white hover:bg-white/5 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors">
            <Handshake className="w-4 h-4" /> {t('nav.collaborate')}
          </Link>

          {/* Language switcher mobile */}
          <div className="flex items-center gap-2 pt-2 px-3">
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentLang === l.code
                    ? 'bg-ma-gold text-white'
                    : 'bg-white/10 text-stone-400 hover:text-white'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {session ? (
            <>
              {isAdmin && (
                <Link
                  to="/admin/dashboard"
                  className="flex items-center gap-2 text-ma-gold hover:text-white hover:bg-white/5 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" /> {t('nav.dashboard')}
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-stone-300 hover:text-white hover:bg-white/5 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors w-full"
              >
                <LogOut className="w-4 h-4" /> {t('nav.signout')}
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-center text-sm font-semibold px-4 py-2.5 rounded-lg mt-2 transition-colors"
            >
              <LogIn className="w-4 h-4" /> {t('nav.access')}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
