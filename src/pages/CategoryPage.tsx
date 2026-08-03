import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MessageSquare, Building2, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import type { Category, Product } from '../types';

const PAGE_SIZE = 24;
const SELECT = '*, category:categories(name,slug), brand:brands(name,slug), supplier:suppliers(name,slug)';

interface BrandOpt { id: string; name: string; slug: string; }

const DLUO_OPTIONS = [
  { labelKey: 'all', value: '' },
  { label: '< 6 mois', value: 'lt6' },
  { label: '6–12 mois', value: '6to12' },
  { label: '12–24 mois', value: '12to24' },
  { label: '> 24 mois', value: 'gt24' },
];

const CERT_OPTIONS = ['Halal', 'Bio / Organique', 'HACCP', 'ISO 22000', 'Casher', 'IFS Food', 'BRC', 'GlobalGAP', 'Fairtrade', 'Sans gluten'];

export default function CategoryPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | null>(null);
  const [brandOptions, setBrandOptions] = useState<BrandOpt[]>([]);
  const [origineOptions, setOrigineOptions] = useState<string[]>([]);
  const [filterBrand, setFilterBrand] = useState('');
  const [filterOrigine, setFilterOrigine] = useState('');
  const [filterCert, setFilterCert] = useState('');
  const [filterDluo, setFilterDluo] = useState('');
  const [filterMoqMax, setFilterMoqMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState<Product | null>(null);

  // 1) Load category + its distinct brands (once per slug)
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: cat } = await supabase.from('categories').select('*').eq('slug', slug).maybeSingle();
      if (cancelled) return;
      if (!cat) { navigate('/catalog', { replace: true }); return; }
      setCategory(cat);
      setFilterBrand(''); setFilterOrigine(''); setFilterCert(''); setFilterDluo(''); setFilterMoqMax('');
      setPage(1);
      setLoading(false);

      // Distinct pays_origine for this category
      const { data: origines } = await supabase.from('products')
        .select('pays_origine').eq('category_id', cat.id).eq('is_active', true)
        .not('pays_origine', 'is', null);
      if (origines && !cancelled) {
        const uniq = [...new Set(origines.map(r => r.pays_origine as string).filter(Boolean))].sort();
        setOrigineOptions(uniq);
      }

      // Distinct brand ids present in this category (paginated, marque_id only = light)
      const ids = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('products')
          .select('marque_id').eq('category_id', cat.id).eq('is_active', true)
          .not('marque_id', 'is', null).range(from, from + 999);
        if (!data || !data.length) break;
        data.forEach(r => r.marque_id && ids.add(r.marque_id as string));
        if (data.length < 1000) break;
      }
      const opts: BrandOpt[] = [];
      const idArr = [...ids];
      for (let i = 0; i < idArr.length; i += 200) {
        const { data } = await supabase.from('brands').select('id,name,slug').in('id', idArr.slice(i, i + 200));
        if (data) opts.push(...(data as BrandOpt[]));
      }
      if (cancelled) return;
      opts.sort((a, b) => a.name.localeCompare(b.name));
      setBrandOptions(opts);
    })();
    return () => { cancelled = true; };
  }, [slug, navigate]);

  // 2) Load one page of products (server-side) on filter/page change
  useEffect(() => {
    if (!category) return;
    let cancelled = false;
    (async () => {
      setGridLoading(true);
      let q = supabase.from('products')
        .select(SELECT, { count: 'exact' })
        .eq('category_id', category.id).eq('is_active', true);
      if (filterBrand) q = q.eq('marque_id', filterBrand);
      if (filterOrigine) q = q.eq('pays_origine', filterOrigine);
      if (filterCert) q = q.contains('certifications', [filterCert]);
      if (filterMoqMax) q = q.lte('commande_min', parseInt(filterMoqMax));
      if (filterDluo === 'lt6') q = q.lt('dluo', 6);
      else if (filterDluo === '6to12') q = q.gte('dluo', 6).lte('dluo', 12);
      else if (filterDluo === '12to24') q = q.gte('dluo', 12).lte('dluo', 24);
      else if (filterDluo === 'gt24') q = q.gt('dluo', 24);
      q = q.order('sort_order').order('id').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      const { data, count } = await q;
      if (cancelled) return;
      setProducts((data || []) as Product[]);
      setTotal(count || 0);
      setGridLoading(false);
    })();
    return () => { cancelled = true; };
  }, [category, filterBrand, filterOrigine, filterCert, filterDluo, filterMoqMax, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const hasFilters = !!(filterBrand || filterOrigine || filterCert || filterDluo || filterMoqMax);
  const activeFilterCount = [filterBrand, filterOrigine, filterCert, filterDluo, filterMoqMax].filter(Boolean).length;

  const resetFilters = () => { setFilterBrand(''); setFilterOrigine(''); setFilterCert(''); setFilterDluo(''); setFilterMoqMax(''); setPage(1); };
  const goTo = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ma-cream pt-24">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="h-8 bg-stone-200 rounded w-48 animate-pulse mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-ma-sand animate-pulse h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!category) return null;

  return (
    <div className="min-h-screen bg-ma-cream">
      {/* Header */}
      <div className="bg-gradient-to-b from-ma-navy to-[#0A1833] pt-24 pb-10 px-4">
        <div className="max-w-6xl mx-auto">
          <Link to="/catalog"
            className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('brandPage.catalog')}
          </Link>
          <h1 className="text-3xl font-bold text-white">{category.name}</h1>
          {category.description && (
            <p className="text-stone-400 mt-2 text-sm max-w-xl">{category.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* ── Filters bar ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setShowFilters(f => !f)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${showFilters || activeFilterCount > 0 ? 'bg-ma-navy text-white border-ma-navy' : 'bg-white text-stone-700 border-stone-200 hover:border-ma-navy'}`}>
              <SlidersHorizontal className="w-4 h-4" />
              {t('categoryPage.filters')} {activeFilterCount > 0 && <span className="bg-white text-ma-navy text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {hasFilters && (
              <button onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                <X className="w-3 h-3" /> {t('categoryPage.resetAllFilters')}
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-3 bg-white border border-stone-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Marque */}
              {brandOptions.length > 0 && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> {t('brandPage.brand')}
                  </span>
                  <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setPage(1); }}
                    className="text-sm bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:border-ma-green">
                    <option value="">{t('categoryPage.allFeminine')}</option>
                    {brandOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
              )}

              {/* Pays d'origine */}
              {origineOptions.length > 1 && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                    <span>🌍</span> {t('categoryPage.originCountry')}
                  </span>
                  <select value={filterOrigine} onChange={e => { setFilterOrigine(e.target.value); setPage(1); }}
                    className="text-sm bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:border-ma-green">
                    <option value="">{t('catalog.all')}</option>
                    {origineOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              )}

              {/* Certification */}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                  <span>🏅</span> {t('categoryPage.certification')}
                </span>
                <select value={filterCert} onChange={e => { setFilterCert(e.target.value); setPage(1); }}
                  className="text-sm bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:border-ma-green">
                  <option value="">{t('categoryPage.allFeminine')}</option>
                  {CERT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              {/* Shelf life */}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                  <span>📅</span> {t('categoryPage.shelfLife')}
                </span>
                <select value={filterDluo} onChange={e => { setFilterDluo(e.target.value); setPage(1); }}
                  className="text-sm bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:border-ma-green">
                  {DLUO_OPTIONS.map(o => <option key={o.value} value={o.value}>{'labelKey' in o ? t('catalog.all') : o.label}</option>)}
                </select>
              </label>

              {/* MOQ max */}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('categoryPage.maxMoq')}</span>
                <input type="number" min="1" placeholder={t('categoryPage.maxMoqPlaceholder')}
                  value={filterMoqMax} onChange={e => { setFilterMoqMax(e.target.value); setPage(1); }}
                  className="text-sm bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:border-ma-green" />
              </label>
            </div>
          )}
        </div>

        {/* ── Products grid ────────────────────────────────────────────────── */}
        {total === 0 && !gridLoading ? (
          <div className="text-center py-20">
            <Package className="w-14 h-14 text-stone-300 mx-auto mb-4" />
            <h3 className="text-stone-500 font-medium mb-2">{t('brandPage.noProducts')}</h3>
            <p className="text-stone-400 text-sm mb-6">
              {t('categoryPage.contactAvailability', { category: category.name })}
            </p>
            <Link to="/quote"
              className="inline-flex items-center gap-2 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors">
              <MessageSquare className="w-4 h-4" /> {t('brandPage.requestQuote')}
            </Link>
          </div>
        ) : (
          <>
            <p className="text-stone-500 text-sm mb-6">
              {hasFilters
                ? t('categoryPage.foundProducts', { count: total })
                : t('categoryPage.productsInCategory', { count: total, category: category.name })}
            </p>
            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 transition-opacity ${gridLoading ? 'opacity-50' : ''}`}>
              {products.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuote={p => setQuoteProduct(p)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-1.5 flex-wrap">
                <button onClick={() => goTo(currentPage - 1)} disabled={currentPage === 1}
                  className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {t('admin.common.previous')}
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-stone-400">…</span>}
                      <button onClick={() => goTo(p)}
                        className={`min-w-[38px] px-3 py-2 text-sm rounded-lg border transition-colors ${
                          p === currentPage
                            ? 'bg-ma-green text-white border-ma-green'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-ma-green'
                        }`}>
                        {p}
                      </button>
                    </span>
                  ))}
                <button onClick={() => goTo(currentPage + 1)} disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {t('admin.common.next')}
                </button>
              </div>
            )}
          </>
        )}

        {/* CTA banner */}
        <div className="mt-12 bg-gradient-to-br from-ma-navy to-[#0A1833] rounded-2xl p-8 text-center">
          <h3 className="text-white font-semibold mb-2">{t('brandPage.interested', { brand: category.name })}</h3>
          <p className="text-stone-400 text-sm mb-5">
            {t('categoryPage.ctaText')}
          </p>
          <Link
            to={`/quote?category=${encodeURIComponent(category.name)}`}
            className="inline-flex items-center gap-2 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold px-7 py-3 rounded-xl transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            {t('brandPage.quoteFor', { brand: category.name })}
          </Link>
        </div>
      </div>

      {/* Quick quote modal */}
      {quoteProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setQuoteProduct(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-stone-800 mb-1">{t('brandPage.quoteRequest')}</h3>
            {quoteProduct.supplier?.name && (
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-2">{quoteProduct.supplier.name}</p>
            )}
            <p className="text-stone-500 text-sm mb-4">
              {t('brandPage.selectedProduct')} <strong>{quoteProduct.name}</strong>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setQuoteProduct(null)}
                className="flex-1 border border-stone-200 text-stone-600 text-sm py-2.5 rounded-xl hover:bg-stone-50 transition-colors">
                {t('admin.common.cancel')}
              </button>
              <Link
                to={`/quote?product=${encodeURIComponent(quoteProduct.name)}&category=${encodeURIComponent(category.name)}`}
                className="flex-1 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors text-center">
                {t('brandPage.continue')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
