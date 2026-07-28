import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MessageSquare, Tag, Truck, X, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import { productImage } from '../lib/img';
import type { Brand, Product } from '../types';

const PAGE_SIZE = 24;
const SELECT = '*, category:categories(name,slug), brand:brands(name,slug), supplier:suppliers(name,slug)';

interface FilterOpt { id: string; name: string; }

export default function BrandPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [categoryOpts, setCategoryOpts] = useState<FilterOpt[]>([]);
  const [supplierOpts, setSupplierOpts] = useState<FilterOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState<Product | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [page, setPage] = useState(1);

  // Load brand + lightweight metadata (hero images, filter options)
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: br } = await supabase.from('brands').select('*').eq('slug', slug).maybeSingle();
      if (cancelled) return;
      if (!br) { navigate('/catalog', { replace: true }); return; }
      setBrand(br);
      setFilterCategory('');
      setFilterSupplier('');
      setPage(1);

      // Fetch filter options and hero images in parallel
      const [catRes, supRes, imgRes] = await Promise.all([
        supabase.from('products').select('category:categories!inner(id,name)').eq('marque_id', br.id).eq('is_active', true),
        supabase.from('products').select('supplier:suppliers!inner(id,name)').eq('marque_id', br.id).eq('is_active', true).not('fournisseur_id', 'is', null),
        supabase.from('products').select('image_url').eq('marque_id', br.id).eq('is_active', true).not('image_url', 'is', null).limit(6),
      ]);
      if (cancelled) return;

      const catMap = new Map<string, string>();
      (catRes.data || []).forEach((r: any) => { if (r.category?.id) catMap.set(r.category.id, r.category.name); });
      setCategoryOpts([...catMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));

      const supMap = new Map<string, string>();
      (supRes.data || []).forEach((r: any) => { if (r.supplier?.id) supMap.set(r.supplier.id, r.supplier.name); });
      setSupplierOpts([...supMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));

      setHeroImages((imgRes.data || []).map((r: any) => r.image_url).filter(Boolean));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug, navigate]);

  // Load paginated products when brand/filters/page change
  useEffect(() => {
    if (!brand) return;
    let cancelled = false;
    (async () => {
      setGridLoading(true);
      let q = supabase.from('products')
        .select(SELECT, { count: 'exact' })
        .eq('marque_id', brand.id)
        .eq('is_active', true);
      if (filterCategory) q = q.eq('category_id', filterCategory);
      if (filterSupplier) q = q.eq('fournisseur_id', filterSupplier);
      q = q.order('sort_order').order('id').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      const { data, count } = await q;
      if (cancelled) return;
      setProducts((data || []) as Product[]);
      setTotal(count || 0);
      setGridLoading(false);
    })();
    return () => { cancelled = true; };
  }, [brand, filterCategory, filterSupplier, page]);

  const hasFilters = !!(filterCategory || filterSupplier);
  const hasFilterOptions = categoryOpts.length > 0 || supplierOpts.length > 0;

  const changeFilter = (cat: string, sup: string) => { setFilterCategory(cat); setFilterSupplier(sup); setPage(1); };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
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
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-ma-sand animate-pulse h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!brand) return null;

  const initials = brand.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-ma-cream">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="relative bg-[#0F2044] pt-24 pb-12 px-4 overflow-hidden">

        {/* Background: blurred product image collage */}
        {heroImages.length > 0 && (
          <div className="absolute inset-0 flex">
            {heroImages.map((src, i) => (
              <div
                key={i}
                className="flex-1 overflow-hidden"
                style={{ opacity: 0.18 }}
              >
                <img
                  src={productImage(src, 400)}
                  loading="lazy"
                  decoding="async"
                  alt=""
                  className="w-full h-full object-cover blur-md scale-110"
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                />
              </div>
            ))}
            {/* Dark overlay on top of collage */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0F2044]/60 via-[#0F2044]/50 to-[#0F2044]" />
          </div>
        )}

        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <Link
            to="/catalog"
            className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-sm mb-7 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Catalogue
          </Link>

          {/* Brand identity row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

            {/* Logo block */}
            <div className="shrink-0">
              {brand.logo_url ? (
                <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center shadow-xl p-3">
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    className="w-full h-full object-contain drop-shadow-lg"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white/70 tracking-tight">{initials}</span>
                </div>
              )}
            </div>

            {/* Name + description */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">{brand.name}</h1>
              {brand.description && (
                <p className="text-stone-400 mt-2 text-sm leading-relaxed max-w-xl">{brand.description}</p>
              )}
            </div>
          </div>

          {/* Stats row */}
          {!loading && (
            <div className="flex items-center gap-5 mt-7 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 text-stone-300 text-sm">
                <Package className="w-4 h-4 text-stone-500" />
                <span className="font-semibold text-white">{total}</span>
                <span>produit{total !== 1 ? 's' : ''}</span>
              </div>
              {categoryOpts.length > 0 && (
                <div className="flex items-center gap-2 text-stone-300 text-sm">
                  <Layers className="w-4 h-4 text-stone-500" />
                  <span className="font-semibold text-white">{categoryOpts.length}</span>
                  <span>catégorie{categoryOpts.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {supplierOpts.length > 0 && (
                <div className="flex items-center gap-2 text-stone-300 text-sm">
                  <Truck className="w-4 h-4 text-stone-500" />
                  <span className="font-semibold text-white">{supplierOpts.length}</span>
                  <span>grossiste{supplierOpts.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Filters */}
        {hasFilterOptions && (
          <div className="mb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {supplierOpts.length > 0 && (
                <label className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide shrink-0">
                    <Truck className="w-3.5 h-3.5" /> Grossiste
                  </span>
                  <select value={filterSupplier} onChange={e => changeFilter(filterCategory, e.target.value)}
                    className="text-sm bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-700 focus:outline-none focus:border-stone-400 max-w-[220px]">
                    <option value="">Tous ({supplierOpts.length})</option>
                    {supplierOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              )}

              {categoryOpts.length > 0 && (
                <label className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide shrink-0">
                    <Tag className="w-3.5 h-3.5" /> Catégorie
                  </span>
                  <select value={filterCategory} onChange={e => changeFilter(e.target.value, filterSupplier)}
                    className="text-sm bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-700 focus:outline-none focus:border-ma-red max-w-[220px]">
                    <option value="">Toutes ({categoryOpts.length})</option>
                    {categoryOpts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
            </div>

            {hasFilters && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-stone-400">
                  {total} produit{total !== 1 ? 's' : ''} affiché{total !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => changeFilter('', '')}
                  className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                >
                  <X className="w-3 h-3" /> Réinitialiser
                </button>
              </div>
            )}
          </div>
        )}

        {/* Products grid */}
        {!gridLoading && total === 0 && !hasFilters ? (
          <div className="text-center py-20">
            <Package className="w-14 h-14 text-stone-300 mx-auto mb-4" />
            <h3 className="text-stone-500 font-medium mb-2">Aucun produit disponible</h3>
            <p className="text-stone-400 text-sm mb-6">
              Contactez-nous pour la disponibilité des produits {brand.name}.
            </p>
            <Link
              to="/quote"
              className="inline-flex items-center gap-2 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <MessageSquare className="w-4 h-4" /> Demander un devis
            </Link>
          </div>
        ) : !gridLoading && total === 0 && hasFilters ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 font-medium">Aucun produit pour ces filtres</p>
            <button
              onClick={() => changeFilter('', '')}
              className="mt-3 text-sm text-ma-red hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <>
            {!hasFilters && (
              <p className="text-stone-500 text-sm mb-6">
                {total} produit{total !== 1 ? 's' : ''} — {brand.name}
              </p>
            )}
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
                  Précédent
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-stone-400">…</span>}
                      <button onClick={() => goTo(p)}
                        className={`min-w-[38px] px-3 py-2 text-sm rounded-lg border transition-colors ${
                          p === currentPage
                            ? 'bg-ma-red text-white border-ma-red'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-ma-red'
                        }`}>
                        {p}
                      </button>
                    </span>
                  ))}
                <button onClick={() => goTo(currentPage + 1)} disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Suivant
                </button>
              </div>
            )}
          </>
        )}

        {/* CTA banner */}
        <div className="mt-12 relative overflow-hidden bg-gradient-to-br from-ma-navy to-[#0A1833] rounded-2xl p-8 text-center">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="relative">
            {brand.logo_url && (
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center p-2">
                  <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain" />
                </div>
              </div>
            )}
            <h3 className="text-white font-semibold mb-2">Intéressé par {brand.name} ?</h3>
            <p className="text-stone-400 text-sm mb-5">
              Obtenez un devis personnalisé avec tailles, conditionnement et tarifs export.
            </p>
            <Link
              to={`/quote?brand=${encodeURIComponent(brand.name)}`}
              className="inline-flex items-center gap-2 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold px-7 py-3 rounded-xl transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Devis pour {brand.name}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Quick quote modal ─────────────────────────────────────────────────── */}
      {quoteProduct && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setQuoteProduct(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-stone-800 mb-1">Demande de devis</h3>
            {quoteProduct.supplier?.name && (
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-2">
                {quoteProduct.supplier.name}
              </p>
            )}
            <p className="text-stone-500 text-sm mb-4">
              Produit sélectionné : <strong>{quoteProduct.name}</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setQuoteProduct(null)}
                className="flex-1 border border-stone-200 text-stone-600 text-sm py-2.5 rounded-xl hover:bg-stone-50 transition-colors"
              >
                Annuler
              </button>
              <Link
                to={`/quote?product=${encodeURIComponent(quoteProduct.name)}&brand=${encodeURIComponent(brand.name)}`}
                className="flex-1 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors text-center"
              >
                Continuer
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
