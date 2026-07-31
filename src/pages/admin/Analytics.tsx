import { useEffect, useState } from 'react';
import { TrendingUp, Users, Package, MessageSquare, Globe, Tag, BarChart2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface MonthStat { month: string; count: number; }
interface CountryStat { country: string; count: number; }
interface CatStat { name: string; count: number; }

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof TrendingUp; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
        <Icon className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-bold text-stone-700">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Analytics() {
  const { t } = useTranslation();
  const [quotesByMonth, setQuotesByMonth]   = useState<MonthStat[]>([]);
  const [buyersByMonth, setBuyersByMonth]   = useState<MonthStat[]>([]);
  const [topCountries, setTopCountries]     = useState<CountryStat[]>([]);
  const [topCategories, setTopCategories]   = useState<CatStat[]>([]);
  const [topCatProds, setTopCatProds]       = useState<CatStat[]>([]);
  const [productStatus, setProductStatus]   = useState<{ active: number; inactive: number; draft: number }>({ active: 0, inactive: 0, draft: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    (async () => {
      const since12m = new Date();
      since12m.setMonth(since12m.getMonth() - 11);
      since12m.setDate(1);
      const since12mISO = since12m.toISOString();

      const [quotesRes, buyersRes, quoteCountryRes, quoteCatRes, activeRes, inactiveRes, draftRes, prodCatRes] = await Promise.all([
        supabase.from('quote_requests').select('created_at').gte('created_at', since12mISO).order('created_at'),
        supabase.from('buyer_profiles').select('created_at').gte('created_at', since12mISO).order('created_at'),
        supabase.from('quote_requests').select('country'),
        supabase.from('quote_requests').select('category_name'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', false).neq('statut', 'brouillon'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('statut', 'brouillon'),
        supabase.from('products').select('categories(name)').eq('is_active', true).limit(2000),
      ]);

      // Quotes by month
      const qMap: Record<string, number> = {};
      (quotesRes.data || []).forEach((r: any) => {
        const k = r.created_at.slice(0, 7);
        qMap[k] = (qMap[k] || 0) + 1;
      });
      setQuotesByMonth(buildMonths(qMap));

      // Buyers by month
      const bMap: Record<string, number> = {};
      (buyersRes.data || []).forEach((r: any) => {
        const k = r.created_at.slice(0, 7);
        bMap[k] = (bMap[k] || 0) + 1;
      });
      setBuyersByMonth(buildMonths(bMap));

      // Top countries from quotes
      const cMap: Record<string, number> = {};
      (quoteCountryRes.data || []).forEach((r: any) => { if (r.country) cMap[r.country] = (cMap[r.country] || 0) + 1; });
      setTopCountries(Object.entries(cMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([country, count]) => ({ country, count })));

      // Top categories from quotes
      const catMap: Record<string, number> = {};
      (quoteCatRes.data || []).forEach((r: any) => { if (r.category_name) catMap[r.category_name] = (catMap[r.category_name] || 0) + 1; });
      setTopCategories(Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })));

      // Product status breakdown — server-side counts bypass PostgREST 1000-row cap
      setProductStatus({
        active:   activeRes.count ?? 0,
        inactive: inactiveRes.count ?? 0,
        draft:    draftRes.count ?? 0,
      });

      // Top categories by product count
      const pCatMap: Record<string, number> = {};
      (prodCatRes.data || []).forEach((r: any) => {
        const name = (r as any).categories?.name;
        if (name) pCatMap[name] = (pCatMap[name] || 0) + 1;
      });
      setTopCatProds(Object.entries(pCatMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })));

      setLoading(false);
    })().catch(() => {
      setError(t('admin.pages.analytics.loadError'));
      setLoading(false);
    });
  }, [retryCount]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">{t('admin.pages.analytics.title')}</h1>
        <p className="text-stone-500 text-sm mt-1">{t('admin.pages.analytics.subtitle')}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1); }}
            className="text-xs font-semibold underline hover:no-underline whitespace-nowrap">{t('admin.common.retry')}</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Quotes by month */}
        <Card title={t('admin.pages.analytics.quotesByMonth')} icon={MessageSquare}>
          <MiniBarChart data={quotesByMonth} loading={loading} color="bg-amber-500" noDataMsg={t('admin.pages.analytics.noData')} />
        </Card>

        {/* Buyers by month */}
        <Card title={t('admin.pages.analytics.buyersByMonth')} icon={Users}>
          <MiniBarChart data={buyersByMonth} loading={loading} color="bg-emerald-500" noDataMsg={t('admin.pages.analytics.noData')} />
        </Card>

        {/* Top countries */}
        <Card title={t('admin.pages.analytics.topCountries')} icon={Globe}>
          {loading
            ? <LoadingSkel />
            : topCountries.length === 0
              ? <Empty msg={t('admin.pages.analytics.noData')} />
              : <RankList items={topCountries.map(c => ({ label: c.country, count: c.count }))} color="bg-amber-400" />}
        </Card>

        {/* Top categories from quotes */}
        <Card title={t('admin.pages.analytics.topCategoriesQuotes')} icon={Tag}>
          {loading
            ? <LoadingSkel />
            : topCategories.length === 0
              ? <Empty msg={t('admin.pages.analytics.noData')} />
              : <RankList items={topCategories.map(c => ({ label: c.name, count: c.count }))} color="bg-sky-400" />}
        </Card>

        {/* Products by category */}
        <Card title={t('admin.pages.analytics.topCategoriesCatalog')} icon={Package}>
          {loading
            ? <LoadingSkel />
            : topCatProds.length === 0
              ? <Empty msg={t('admin.pages.analytics.noData')} />
              : <RankList items={topCatProds.map(c => ({ label: c.name, count: c.count }))} color="bg-purple-400" />}
        </Card>

        {/* Product status */}
        <Card title={t('admin.pages.analytics.productStatus')} icon={BarChart2}>
          {loading
            ? <LoadingSkel />
            : <div className="space-y-3">
                {[
                  { label: t('admin.pages.analytics.statusActive'),   value: productStatus.active,   color: 'bg-emerald-500', textColor: 'text-emerald-600' },
                  { label: t('admin.pages.analytics.statusInactive'), value: productStatus.inactive, color: 'bg-stone-300',   textColor: 'text-stone-500' },
                  { label: t('admin.pages.analytics.statusDraft'),    value: productStatus.draft,    color: 'bg-blue-400',    textColor: 'text-blue-600' },
                ].map(item => {
                  const total = productStatus.active + productStatus.inactive + productStatus.draft || 1;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-stone-600">{item.label}</span>
                        <span className={`text-sm font-bold ${item.textColor}`}>
                          {item.value.toLocaleString('fr-FR')} <span className="text-stone-400 font-normal text-xs">({Math.round(item.value / total * 100)}%)</span>
                        </span>
                      </div>
                      <Bar value={item.value} max={total} color={item.color} />
                    </div>
                  );
                })}
              </div>}
        </Card>

      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMonths(map: Record<string, number>): MonthStat[] {
  const months: MonthStat[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ month: k, count: map[k] || 0 });
  }
  return months;
}

function MiniBarChart({ data, loading, color, noDataMsg }: { data: MonthStat[]; loading: boolean; color: string; noDataMsg?: string }) {
  if (loading) return <LoadingSkel />;
  if (data.every(d => d.count === 0)) return <Empty msg={noDataMsg} />;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map(d => {
        const h = Math.max(4, Math.round((d.count / max) * 100));
        const label = d.month.slice(5); // "MM"
        const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        const mLabel = months[parseInt(label, 10) - 1];
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-[10px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {d.count}
            </div>
            <div className="w-full flex items-end justify-center" style={{ height: '88px' }}>
              <div className={`w-full rounded-t-sm transition-all duration-500 ${d.count > 0 ? color : 'bg-stone-100'}`} style={{ height: `${h}%` }} />
            </div>
            <span className="text-[10px] text-stone-400">{mLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

function RankList({ items, color }: { items: { label: string; count: number }[]; color: string }) {
  const max = items[0]?.count || 1;
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={item.label}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-stone-400 w-4 shrink-0">{i + 1}</span>
              <span className="text-sm text-stone-700 truncate">{item.label || '—'}</span>
            </div>
            <span className="text-sm font-bold text-stone-600 ml-2 shrink-0">{item.count}</span>
          </div>
          <Bar value={item.count} max={max} color={color} />
        </div>
      ))}
    </div>
  );
}

function LoadingSkel() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-6 bg-stone-100 rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

function Empty({ msg }: { msg?: string }) {
  return <p className="text-sm text-stone-400 text-center py-4">{msg ?? '—'}</p>;
}
