import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MessageSquare, Building2, Truck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import type { Category, Product } from '../types';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoteProduct, setQuoteProduct] = useState<Product | null>(null);

  // Filters
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  // Pagination
  const PAGE_SIZE = 24;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: cat } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (!cat) { navigate('/catalog', { replace: true }); return; }
      setCategory(cat);

      const { data: prods } = await supabase
        .from('products')
        .select('*, category:categories(name,slug), brand:brands(name,slug), supplier:suppliers(name,slug)')
        .eq('category_id', cat.id)
        .eq('is_active', true)
        .order('sort_order');

      setProducts((prods || []) as Product[]);
      setLoading(false);
    })();
  }, [slug, navigate]);

  // Extract unique brands & suppliers from loaded products
  const brands = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach(p => { if (p.brand?.name) map.set(p.brand.name, p.brand.name); });
    return [...map.keys()].sort();
  }, [products]);

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach(p => { if (p.supplier?.name) map.set(p.supplier.name, p.supplier.name); });
    return [...map.keys()].sort();
  }, [products]);

  // Apply filters client-side
  const filtered = useMemo(() => products.filter(p => {
    if (filterBrand && p.brand?.name !== filterBrand) return false;
    if (filterSupplier && p.supplier?.name !== filterSupplier) return false;
    return true;
  }), [products, filterBrand, filterSupplier]);

  const hasFilters = filterBrand || filterSupplier;
  const hasFilterOptions = brands.length > 0 || suppliers.length > 0;

  // Reset to first page when the filters or the category change
  useEffect(() => { setPage(1); }, [filterBrand, filterSupplier, slug]);

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

  if (!category) return null;

  return (
    <div className="min-h-screen bg-ma-cream">
      {/* Header */}
      <div className="bg-gradient-to-b from-ma-navy to-[#0A1833] pt-24 pb-10 px-4">
        <div className="max-w-6xl mx-auto">
          <Link to="/catalog"
            className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Catalogue
          </Link>
          <h1 className="text-3xl font-bold text-white">{category.name}</h1>
          {category.description && (
            <p className="text-stone-400 mt-2 text-sm max-w-xl">{category.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* ── Filters bar ─────────────────────────────────────────────────── */}
        {hasFilterOptions && (
          <div className="mb-6 space-y-3">

            {/* Supplier filter */}
            {suppliers.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide shrink-0">
                  <Truck className="w-3.5 h-3.5" /> Grossiste
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suppliers.map(s => (
                    <button key={s} type="button"
                      onClick={() => setFilterSupplier(filterSupplier === s ? '' : s)}
                      className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all ${
                        filterSupplier === s
                          ? 'bg-stone-800 text-white border-stone-800'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Brand filter */}
            {brands.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide shrink-0">
                  <Building2 className="w-3.5 h-3.5" /> Marque
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {brands.map(b => (
                    <button key={b} type="button"
                      onClick={() => setFilterBrand(filterBrand === b ? '' : b)}
                      className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all ${
                        filterBrand === b
                          ? 'bg-ma-green text-white border-ma-green'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-ma-green'
                      }`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active filter summary + clear */}
            {hasFilters && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-stone-400">
                  {filtered.length} produit{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
                </span>
                <button onClick={() => { setFilterBrand(''); setFilterSupplier(''); }}
                  className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                  <X className="w-3 h-3" /> Réinitialiser
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Products grid ────────────────────────────────────────────────── */}
        {products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-14 h-14 text-stone-300 mx-auto mb-4" />
            <h3 className="text-stone-500 font-medium mb-2">Aucun produit disponible</h3>
            <p className="text-stone-400 text-sm mb-6">
              Contactez-nous directement pour la disponibilité et les tarifs de {category.name}.
            </p>
            <Link to="/quote"
              className="inline-flex items-center gap-2 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors">
              <MessageSquare className="w-4 h-4" /> Demander un devis
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 font-medium">Aucun produit pour ces filtres</p>
            <button onClick={() => { setFilterBrand(''); setFilterSupplier(''); }}
              className="mt-3 text-sm text-amber-600 hover:underline">
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <>
            {!hasFilters && (
              <p className="text-stone-500 text-sm mb-6">
                {products.length} produit{products.length !== 1 ? 's' : ''} dans {category.name}
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

            {/* ── Pagination ─────────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-1.5 flex-wrap">
                <button
                  onClick={() => goTo(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Précédent
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-stone-400">…</span>}
                      <button
                        onClick={() => goTo(p)}
                        className={`min-w-[38px] px-3 py-2 text-sm rounded-lg border transition-colors ${
                          p === currentPage
                            ? 'bg-ma-green text-white border-ma-green'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-ma-green'
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  onClick={() => goTo(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}

        {/* CTA banner */}
        <div className="mt-12 bg-gradient-to-br from-ma-navy to-[#0A1833] rounded-2xl p-8 text-center">
          <h3 className="text-white font-semibold mb-2">Intéressé par {category.name} ?</h3>
          <p className="text-stone-400 text-sm mb-5">
            Obtenez un devis personnalisé avec tailles, conditionnement et tarifs.
          </p>
          <Link
            to={`/quote?category=${encodeURIComponent(category.name)}`}
            className="inline-flex items-center gap-2 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold px-7 py-3 rounded-xl transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Devis pour {category.name}
          </Link>
        </div>
      </div>

      {/* Quick quote modal */}
      {quoteProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setQuoteProduct(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-stone-800 mb-1">Demande de devis</h3>
            {quoteProduct.supplier?.name && (
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-2">{quoteProduct.supplier.name}</p>
            )}
            <p className="text-stone-500 text-sm mb-4">
              Produit sélectionné : <strong>{quoteProduct.name}</strong>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setQuoteProduct(null)}
                className="flex-1 border border-stone-200 text-stone-600 text-sm py-2.5 rounded-xl hover:bg-stone-50 transition-colors">
                Annuler
              </button>
              <Link
                to={`/quote?product=${encodeURIComponent(quoteProduct.name)}&category=${encodeURIComponent(category.name)}`}
                className="flex-1 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors text-center">
                Continuer
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
