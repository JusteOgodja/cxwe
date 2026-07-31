import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Tag, Package, MessageSquare, TrendingUp, Building2, Users,
  AlertTriangle, AlertCircle, CheckCircle, Clock, Globe, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface Stats {
  categories: number;
  products: number;
  productsActive: number;
  productsInactive: number;
  brands: number;
  quotes: number;
  newQuotes: number;
  quotesThisMonth: number;
  quotesLastMonth: number;
  quotesResponded: number;
  buyers: number;
  buyersThisWeek: number;
  // Quality
  productsNoImage: number;
  productsNoEAN: number;
  productsNoBrand: number;
  productsNoCategory: number;
  brandsNoProducts: number;
}

interface TopItem { name: string; count: number; }

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({
    categories: 0, products: 0, productsActive: 0, productsInactive: 0,
    brands: 0, quotes: 0, newQuotes: 0, quotesThisMonth: 0, quotesLastMonth: 0,
    quotesResponded: 0, buyers: 0, buyersThisWeek: 0,
    productsNoImage: 0, productsNoEAN: 0, productsNoBrand: 0,
    productsNoCategory: 0, brandsNoProducts: 0,
  });
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [topCategories, setTopCategories] = useState<TopItem[]>([]);
  const [topCountries, setTopCountries] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        catRes, prodRes, prodActiveRes, prodInactiveRes, brandRes,
        quoteRes, newQuoteRes, quoteMonthRes, quoteLastMonthRes, quoteRespondedRes,
        buyerRes, buyerWeekRes,
        qualityRes,
        recentRes, quoteAllRes,
      ] = await Promise.all([
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', false),
        supabase.from('brands').select('id', { count: 'exact', head: true }),
        supabase.from('quote_requests').select('id', { count: 'exact', head: true }),
        supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('quote_requests').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
        supabase.from('quote_requests').select('id', { count: 'exact', head: true }).gte('created_at', startOfLastMonth).lt('created_at', startOfMonth),
        supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'responded'),
        supabase.from('buyer_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('buyer_profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeek),
        supabase.rpc('get_quality_stats').maybeSingle(),
        supabase.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('quote_requests').select('country,category_name').gte('created_at', startOfMonth),
      ]);

      const qs = (qualityRes as any).data ?? {};
      setStats({
        categories: catRes.count || 0,
        products: prodRes.count || 0,
        productsActive: prodActiveRes.count || 0,
        productsInactive: prodInactiveRes.count || 0,
        brands: brandRes.count || 0,
        quotes: quoteRes.count || 0,
        newQuotes: newQuoteRes.count || 0,
        quotesThisMonth: quoteMonthRes.count || 0,
        quotesLastMonth: quoteLastMonthRes.count || 0,
        quotesResponded: quoteRespondedRes.count || 0,
        buyers: buyerRes.count || 0,
        buyersThisWeek: buyerWeekRes.count || 0,
        productsNoImage: qs.no_image ?? 0,
        productsNoEAN: qs.no_ean ?? 0,
        productsNoBrand: qs.no_brand ?? 0,
        productsNoCategory: qs.no_category ?? 0,
        brandsNoProducts: qs.brands_no_products ?? 0,
      });

      setRecentQuotes(recentRes.data || []);

      // Top categories & countries from quotes this month
      const allQuotes = quoteAllRes.data || [];
      const catCounts: Record<string, number> = {};
      const countryCounts: Record<string, number> = {};
      allQuotes.forEach((q: any) => {
        if (q.category_name) catCounts[q.category_name] = (catCounts[q.category_name] || 0) + 1;
        if (q.country) countryCounts[q.country] = (countryCounts[q.country] || 0) + 1;
      });
      setTopCategories(
        Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([name, count]) => ({ name, count }))
      );
      setTopCountries(
        Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([name, count]) => ({ name, count }))
      );

      setLoading(false);
    })().catch(() => {
      setError(t('admin.common.loadError'));
      setLoading(false);
    });
  }, [retryCount]);

  const STATUS_COLORS: Record<string, string> = {
    new: 'bg-red-100 text-red-700',
    in_review: 'bg-amber-100 text-amber-700',
    responded: 'bg-blue-100 text-blue-700',
    closed: 'bg-stone-100 text-stone-600',
  };

  const totalActive = stats.productsActive + stats.productsInactive || 1;
  const activeRatio = Math.round((stats.productsActive / totalActive) * 100);
  const totalProducts = stats.products || 1;
  const completenessImage = Math.round(((totalProducts - stats.productsNoImage) / totalProducts) * 100);
  const completenessEAN = Math.round(((totalProducts - stats.productsNoEAN) / totalProducts) * 100);
  const treatmentRate = stats.quotes ? Math.round(((stats.quotesResponded) / stats.quotes) * 100) : 0;

  const monthTrend = stats.quotesLastMonth
    ? Math.round(((stats.quotesThisMonth - stats.quotesLastMonth) / stats.quotesLastMonth) * 100)
    : null;

  const Trend = ({ pct }: { pct: number | null }) => {
    if (pct === null) return null;
    if (pct > 0) return <span className="flex items-center gap-0.5 text-emerald-600 text-xs font-semibold"><ArrowUp className="w-3 h-3" />+{pct}%</span>;
    if (pct < 0) return <span className="flex items-center gap-0.5 text-red-500 text-xs font-semibold"><ArrowDown className="w-3 h-3" />{pct}%</span>;
    return <span className="flex items-center gap-0.5 text-stone-400 text-xs font-semibold"><Minus className="w-3 h-3" />0%</span>;
  };

  const Skel = () => <span className="inline-block w-12 h-4 bg-stone-200 rounded animate-pulse" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">{t('admin.dashboard.title')}</h1>
        <p className="text-stone-500 text-sm mt-1">{t('admin.dashboard.subtitle')}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1); }}
            className="text-xs font-semibold underline hover:no-underline whitespace-nowrap">{t('admin.common.retry')}</button>
        </div>
      )}

      {/* ── Ligne 1 : stats volume ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('admin.dashboard.categories'), value: stats.categories, icon: Tag, color: 'bg-amber-500', to: '/admin/categories' },
          { label: t('admin.dashboard.products'), value: stats.products, icon: Package, color: 'bg-emerald-500', to: '/admin/products' },
          { label: t('admin.dashboard.brands'), value: stats.brands, icon: Building2, color: 'bg-blue-500', to: '/admin/brands' },
          { label: t('admin.dashboard.buyers'), value: stats.buyers, icon: Users, color: 'bg-purple-500', to: '/admin/buyers' },
        ].map(card => (
          <Link key={card.label} to={card.to}
            className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 ${card.color} rounded-xl flex items-center justify-center mb-3`}>
              <card.icon className="w-4 h-4 text-white" />
            </div>
            <div className="text-2xl font-bold text-stone-800">
              {loading ? <Skel /> : card.value.toLocaleString('fr-FR')}
            </div>
            <div className="text-stone-500 text-xs mt-1">{card.label}</div>
          </Link>
        ))}
      </div>

      {/* ── Ligne 2 : commercial + acheteurs ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Devis ce mois */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-red-600" />
            </div>
            {!loading && <Trend pct={monthTrend} />}
          </div>
          <div className="text-2xl font-bold text-stone-800">{loading ? <Skel /> : stats.quotesThisMonth}</div>
          <div className="text-stone-500 text-xs mt-1">{t('admin.dashboard.quotesThisMonth')}</div>
          {!loading && <div className="text-stone-400 text-xs mt-0.5">{t('admin.dashboard.quotesWaiting', { n: stats.newQuotes })}</div>}
        </div>

        {/* Taux de traitement */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center mb-3">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-stone-800">{loading ? <Skel /> : `${treatmentRate}%`}</div>
          <div className="text-stone-500 text-xs mt-1">{t('admin.dashboard.quotesTreated')}</div>
          {!loading && <div className="text-stone-400 text-xs mt-0.5">{t('admin.dashboard.quotesRespondedOf', { responded: stats.quotesResponded, total: stats.quotes })}</div>}
        </div>

        {/* Acheteurs cette semaine */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-stone-800">{loading ? <Skel /> : `+${stats.buyersThisWeek}`}</div>
          <div className="text-stone-500 text-xs mt-1">{t('admin.dashboard.newBuyers7d')}</div>
          {!loading && <div className="text-stone-400 text-xs mt-0.5">{t('admin.dashboard.buyersTotal', { n: stats.buyers })}</div>}
        </div>

        {/* Produits actifs */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
          <div className="w-9 h-9 bg-stone-100 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-stone-600" />
          </div>
          <div className="text-2xl font-bold text-stone-800">{loading ? <Skel /> : `${activeRatio}%`}</div>
          <div className="text-stone-500 text-xs mt-1">{t('admin.dashboard.productsActive')}</div>
          {!loading && (
            <div className="mt-2 h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${activeRatio}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Ligne 3 : qualité catalogue ──────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-stone-800 text-sm">{t('admin.dashboard.catalogQuality')}</h2>
          </div>
          <Link to="/admin/data-quality" className="text-amber-600 hover:text-amber-700 text-xs font-medium">
            {t('admin.common.viewDetails')}
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-stone-100">
          {[
            {
              label: t('admin.dashboard.noImage'), value: stats.productsNoImage,
              pct: completenessImage, good: completenessImage >= 90,
              desc: t('admin.dashboard.withImage'),
            },
            {
              label: t('admin.dashboard.noEAN'), value: stats.productsNoEAN,
              pct: completenessEAN, good: completenessEAN >= 80,
              desc: t('admin.dashboard.withEAN'),
            },
            {
              label: t('admin.dashboard.noBrand'), value: stats.productsNoBrand,
              pct: null, good: stats.productsNoBrand === 0,
              desc: t('admin.dashboard.unlinked'),
            },
            {
              label: t('admin.dashboard.noCategory'), value: stats.productsNoCategory,
              pct: null, good: stats.productsNoCategory === 0,
              desc: t('admin.dashboard.unlinked'),
            },
          ].map(kpi => (
            <div key={kpi.label} className="p-4">
              <div className={`text-xl font-bold ${kpi.good ? 'text-emerald-600' : 'text-red-600'}`}>
                {loading ? <Skel /> : kpi.value.toLocaleString('fr-FR')}
              </div>
              <div className="text-stone-600 text-xs font-medium mt-0.5">{kpi.label}</div>
              {kpi.pct !== null && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-stone-400 mb-1">
                    <span>{kpi.desc}</span>
                    <span className={kpi.good ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>{kpi.pct}%</span>
                  </div>
                  <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${kpi.good ? 'bg-emerald-500' : 'bg-amber-400'}`}
                      style={{ width: `${kpi.pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Ligne 4 : devis récents + top pays + top catégories ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Devis récents */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-semibold text-stone-800 text-sm">{t('admin.dashboard.recentQuotes')}</h2>
            <Link to="/admin/quotes" className="text-amber-600 hover:text-amber-700 text-xs font-medium">
              {t('admin.common.viewAll')}
            </Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2].map(i => <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />)}
            </div>
          ) : recentQuotes.length === 0 ? (
            <div className="p-10 text-center text-stone-400 text-sm">{t('admin.dashboard.noQuotes')}</div>
          ) : (
            <div className="divide-y divide-stone-50">
              {recentQuotes.map(q => (
                <Link key={q.id} to="/admin/quotes"
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-stone-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-800 text-sm truncate">{q.company_name}</div>
                    <div className="text-stone-400 text-xs truncate">{q.contact_name} · {q.country}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status] || 'bg-stone-100 text-stone-500'}`}>
                      {q.status?.replace('_', ' ')}
                    </span>
                    <span className="text-stone-400 text-xs hidden sm:block">
                      {new Date(q.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top pays + top catégories */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="p-4 border-b border-stone-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-stone-400" />
              <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">{t('admin.dashboard.topCountries')}</span>
            </div>
            <div className="divide-y divide-stone-50">
              {loading ? (
                [0, 1, 2].map(i => <div key={i} className="m-3 h-6 bg-stone-100 rounded animate-pulse" />)
              ) : topCountries.length === 0 ? (
                <div className="p-4 text-xs text-stone-400 text-center">{t('admin.dashboard.noDataMonth')}</div>
              ) : topCountries.map((c, i) => {
                const max = topCountries[0]?.count || 1;
                return (
                  <div key={c.name} className="flex items-center gap-2 px-4 py-2.5">
                    <span className="text-xs text-stone-400 w-4 font-tabular-nums">{i + 1}</span>
                    <span className="flex-1 text-sm text-stone-700 truncate">{c.name}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(c.count / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-stone-500 w-4 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="p-4 border-b border-stone-100 flex items-center gap-2">
              <Tag className="w-4 h-4 text-stone-400" />
              <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">{t('admin.dashboard.topCategories')}</span>
            </div>
            <div className="divide-y divide-stone-50">
              {loading ? (
                [0, 1, 2].map(i => <div key={i} className="m-3 h-6 bg-stone-100 rounded animate-pulse" />)
              ) : topCategories.length === 0 ? (
                <div className="p-4 text-xs text-stone-400 text-center">{t('admin.dashboard.noDataMonth')}</div>
              ) : topCategories.map((c, i) => {
                const max = topCategories[0]?.count || 1;
                return (
                  <div key={c.name} className="flex items-center gap-2 px-4 py-2.5">
                    <span className="text-xs text-stone-400 w-4">{i + 1}</span>
                    <span className="flex-1 text-xs text-stone-700 truncate">{c.name}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(c.count / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-stone-500 w-4 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions rapides ──────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-4 gap-3">
        {[
          { label: t('admin.dashboard.quickAdd'), to: '/admin/products', icon: Package },
          { label: t('admin.dashboard.quickQuotes'), to: '/admin/quotes', icon: MessageSquare },
          { label: t('admin.dashboard.quickQuality'), to: '/admin/data-quality', icon: AlertTriangle },
          { label: t('admin.dashboard.quickSettings'), to: '/admin/settings', icon: Clock },
        ].map(a => (
          <Link key={a.label} to={a.to}
            className="bg-white border border-stone-100 rounded-xl px-4 py-3.5 flex items-center gap-2.5 hover:border-amber-200 hover:bg-amber-50 transition-all text-sm font-medium text-stone-700 hover:text-amber-700 shadow-sm">
            <a.icon className="w-4 h-4 shrink-0" />
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
