import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MessageSquare, Tag, Truck, X, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import { productImage } from '../lib/img';
import type { Brand, Product } from '../types';

export default function BrandPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoteProduct, setQuoteProduct] = useState<Product | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  // Pagination
  const PAGE_SIZE = 24;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: br } = await supabase
        .from('brands')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (!br) { navigate('/catalog', { replace: true }); return; }
      setBrand(br);

      const { data: prods } = await supabase
        .from('products')
        .select('*, category:categories(name,slug), brand:brands(name,slug), supplier:suppliers(name,slug)')
        .eq('marque_id', br.id)
        .eq('is_active', true)
        .order('sort_order');
      setProducts((prods || []) as Product[]);
      setLoading(false);
    })();
  }, [slug, navigate]);

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach(p => { if (p.category?.name) map.set(p.category.name, p.category.name); });
    return [...map.keys()].sort();
  }, [products]);

  const supplierNames = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach(p => { if (p.supplier?.name) map.set(p.supplier.name, p.supplier.name); });
    return [...map.keys()].sort();
  }, [products]);

  const heroImages = useMemo(
    () => products.map(p => p.image_url).filter(Boolean).slice(0, 6) as string[],
    [products]
  );

  const filtered = useMemo(() => products.filter(p => {
    if (filterCategory && p.category?.name !== filterCategory) return false;
    if (filterSupplier && p.supplier?.name !== filterSupplier) return false;
    return true;
  }), [products, filterCategory, filterSupplier]);

  const hasFilters = filterCategory || filterSupplier;
  const hasFilterOptions = categoryNames.length > 0 || supplierNames.length > 0;

  // Reset to first page when filters or brand change
  useEffect(() => { setPage(1); }, [filterCategory, filterSupplier, slug]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );
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
                <span className="font-semibold text-white">{products.length}</span>
                <span>produit{products.length !== 1 ? 's' : ''}</span>
              </div>
              {categoryNames.length > 0 && (
                <div className="flex items-center gap-2 text-stone-300 text-sm">
                  <Layers className="w-4 h-4 text-stone-500" />
                  <span className="font-semibold text-white">{categoryNames.length}</span>
                  <span>catégorie{categoryNames.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {supplierNames.length > 0 && (
                <div className="flex items-center gap-2 text-stone-300 text-sm">
                  <Truck className="w-4 h-4 text-stone-500" />
                  <span className="font-semibold text-white">{supplierNames.length}</span>
                  <span>grossiste{supplierNames.length !== 1 ? 's' : ''}</span>
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
              {supplierNames.length > 0 && (
                <label className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide shrink-0">
                    <Truck className="w-3.5 h-3.5" /> Grossiste
                  </span>
                  <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
                    className="text-sm bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-700 focus:outline-none focus:border-stone-400 max-w-[220px]">
                    <option value="">Tous ({supplierNames.length})</option>
                    {supplierNames.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              )}

              {categoryNames.length > 0 && (
                <label className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide shrink-0">
                    <Tag className="w-3.5 h-3.5" /> Catégorie
                  </span>
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                    className="text-sm bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-700 focus:outline-none focus:border-ma-red max-w-[220px]">
                    <option value="">Toutes ({categoryNames.length})</option>
                    {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}
            </div>

            {hasFilters && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-stone-400">
                  {filtered.length} produit{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => { setFilterCategory(''); setFilterSupplier(''); }}
                  className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                >
                  <X className="w-3 h-3" /> Réinitialiser
                </button>
              </div>
            )}
          </div>
        )}

        {/* Products grid */}
        {products.length === 0 ? (
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
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 font-medium">Aucun produit pour ces filtres</p>
            <button
              onClick={() => { setFilterCategory(''); setFilterSupplier(''); }}
              className="mt-3 text-sm text-ma-red hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <>
            {!hasFilters && (
              <p className="text-stone-500 text-sm mb-6">
                {products.length} produit{products.length !== 1 ? 's' : ''} — {brand.name}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {pageItems.map(product => (
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
