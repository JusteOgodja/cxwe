import { useState, useEffect } from 'react';
import { Link, useLocation, Navigate, Outlet } from 'react-router-dom';
import {
  Globe, LayoutDashboard, Tag, Package, MessageSquare,
  LogOut, Menu, ChevronRight, Building2, Truck, Handshake, Users,
  AlertTriangle, Settings, BarChart2, Languages,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface Props {
  isLoggedIn: boolean;
  onLogout: () => void;
}

const LANGS = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'AR' },
];

export default function AdminLayout({ isLoggedIn, onLogout }: Props) {
  const { t, i18n } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newQuotes, setNewQuotes] = useState(0);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const location = useLocation();

  const NAV = [
    { key: 'dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
    { key: 'categories', to: '/admin/categories', icon: Tag },
    { key: 'products', to: '/admin/products', icon: Package },
    { key: 'brands', to: '/admin/brands', icon: Building2 },
    { key: 'suppliers', to: '/admin/suppliers', icon: Truck },
    { key: 'quotes', to: '/admin/quotes', icon: MessageSquare },
    { key: 'partners', to: '/admin/partners', icon: Handshake },
    { key: 'buyers', to: '/admin/buyers', icon: Users },
    { key: 'sources', to: '/admin/sources', icon: Globe },
    { key: 'dataQuality', to: '/admin/data-quality', icon: AlertTriangle },
    { key: 'analytics', to: '/admin/analytics', icon: BarChart2 },
    { key: 'settings', to: '/admin/settings', icon: Settings },
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      // Pas de session -> pas admin. Ne pas appeler la RPC protégée en anonyme.
      if (!sess.session) { if (!cancelled) setIsAdmin(false); return; }
      // Autorité déterminée côté serveur (public.is_admin()), jamais côté client.
      const { data, error } = await supabase.rpc('is_admin');
      if (!cancelled) setIsAdmin(!error && data === true);
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchBadge = async () => {
      const { count } = await supabase
        .from('quote_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new');
      setNewQuotes(count ?? 0);
    };
    fetchBadge();
    const timer = setInterval(fetchBadge, 60_000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  if (!isLoggedIn || isAdmin === false) return <Navigate to="/admin/login" replace />;
  if (isAdmin === null) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
    </div>
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const isActive = (path: string) => location.pathname === path;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-stone-700 flex items-center gap-3">
        <img
          src="/logo.png"
          alt="Morocco Food Export"
          className="h-10 w-auto shrink-0"
        />
        <div className="min-w-0">
          <div className="text-white font-bold text-xs truncate">{t('admin.layout.panel')}</div>
          <div className="text-stone-400 text-xs truncate">Morocco Food Export</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(item => {
          const badge = item.to === '/admin/quotes' && newQuotes > 0 ? newQuotes : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(item.to)
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white hover:bg-stone-700'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {t(`admin.nav.${item.key}`)}
              {badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
              {isActive(item.to) && badge === 0 && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* Language switcher */}
      <div className="px-3 py-2 border-t border-stone-700">
        <div className="flex items-center gap-1.5 px-1 py-1">
          <Languages className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          <div className="flex gap-1">
            {LANGS.map(lang => (
              <button
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                  i18n.language === lang.code
                    ? 'bg-amber-500 text-white'
                    : 'text-stone-400 hover:text-white hover:bg-stone-700'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-stone-700 space-y-1">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-400 hover:text-white hover:bg-stone-700 transition-all"
        >
          <Globe className="w-4 h-4 shrink-0" />
          {t('admin.layout.viewSite')}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-400 hover:text-red-400 hover:bg-stone-700 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t('admin.layout.signOut')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-stone-800 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-60 bg-stone-800 flex flex-col">
            <SidebarContent />
          </div>
          <div
            className="flex-1 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-stone-600">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-stone-800 text-sm">{t('admin.layout.panel')}</span>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
