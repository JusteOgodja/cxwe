import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, LayoutGrid, Building2, X, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { productImage } from '../lib/img';
import CategoryCard from '../components/CategoryCard';
import BrandCard from '../components/BrandCard';
import type { Category, Brand } from '../types';

const BRANDS_PER_PAGE = 24;

interface ProductHit { id: string; name: string; image_url: string; brand: { name: string }[] | { name: string } | null; }

export default function Catalog() {
  const [view, setView] = useState<'categories' | 'brands'>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Brand filters
  const [letter, setLetter] = useState('');
  const [brandCategory, setBrandCategory] = useState('');           // category id
  const [catBrandIds, setCatBrandIds] = useState<Set<string> | null>(null);
  const [brandPage, setBrandPage] = useState(1);

  // Product search (autocomplete)
  const [prodQuery, setProdQuery] = useState('');
  const [prodHits, setProdHits] = useState<ProductHit[]>([]);
  const [prodOpen, setProdOpen] = useState(false);
  const prodRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order');
      setCategories(cats || []);
      // brands can exceed the 1000-row cap → fetch all pages
      const all: Brand[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('brands').select('*').eq('is_active', true).order('name').range(from, from + 999);
        if (!data || !data.length) break;
        all.push(...(data as Brand[]));
        if (data.length < 1000) break;
      }
      setBrands(all);
      setLoading(false);
    })();
  }, []);

  // Brand pipeline: search → letter → category
  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brands.filter(b => {
      if (q && !b.name.toLowerCase().includes(q) && !b.description?.toLowerCase().includes(q)) return false;
      if (letter) {
        const c = (b.name[0] || '').toUpperCase();
        if (letter === '#') { if (/[A-Z]/.test(c)) return false; }
        else if (c !== letter) return false;
      }
      if (brandCategory && catBrandIds && !catBrandIds.has(b.id)) return false;
      return true;
    });
  }, [brands, search, letter, brandCategory, catBrandIds]);

  const totalBrandPages = Math.max(1, Math.ceil(filteredBrands.length / BRANDS_PER_PAGE));
  const currentBrandPage = Math.min(brandPage, totalBrandPages);
  const pageBrands = useMemo(
    () => filteredBrands.slice((currentBrandPage - 1) * BRANDS_PER_PAGE, currentBrandPage * BRANDS_PER_PAGE),
    [filteredBrands, currentBrandPage],
  );

  // Reset to page 1 when brand filters change
  useEffect(() => { setBrandPage(1); }, [search, letter, brandCategory]);

  // Available first letters (for the A-Z bar)
  const letters = useMemo(() => {
    const set = new Set<string>();
    brands.forEach(b => { const c = (b.name[0] || '').toUpperCase(); set.add(/[A-Z]/.test(c) ? c : '#'); });
    return set;
  }, [brands]);

  // Fetch distinct brand ids for the selected category (paginated, light)
  useEffect(() => {
    if (!brandCategory) { setCatBrandIds(null); return; }
    let cancelled = false;
    (async () => {
      const ids = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('products')
          .select('marque_id').eq('category_id', brandCategory).eq('is_active', true)
          .not('marque_id', 'is', null).range(from, from + 999);
        if (!data || !data.length) break;
        data.forEach(r => r.marque_id && ids.add(r.marque_id as string));
        if (data.length < 1000) break;
      }
      if (!cancelled) setCatBrandIds(ids);
    })();
    return () => { cancelled = true; };
  }, [brandCategory]);

  // Fetch product counts ONLY for the brands on the current page (was 1875 queries → ~24)
  useEffect(() => {
    if (view !== 'brands') return;
    const missing = pageBrands.filter(b => brandCounts[b.id] === undefined);
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(missing.map(b =>
      supabase.from('products').select('id', { count: 'exact', head: true })
        .eq('marque_id', b.id).eq('is_active', true)
        .then(({ count }) => ({ id: b.id, count: count ?? 0 }))
    )).then(res => {
      if (cancelled) return;
      setBrandCounts(prev => { const m = { ...prev }; res.forEach(r => { m[r.id] = r.count; }); return m; });
    });
    return () => { cancelled = true; };
  }, [view, pageBrands, brandCounts]);

  // Product search (debounced)
  useEffect(() => {
    const q = prodQuery.trim();
    if (q.length < 2) { setProdHits([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('products')
        .select('id, name, image_url, brand:brands(name)')
        .eq('is_active', true).ilike('name', `%${q}%`).limit(10);
      setProdHits((data || []) as ProductHit[]);
      setProdOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [prodQuery]);

  // Close product dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (prodRef.current && !prodRef.current.contains(e.target as Node)) setProdOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filteredCats = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  const brandOf = (h: ProductHit) => Array.isArray(h.brand) ? h.brand[0]?.name : h.brand?.name;

  const goBrandPage = (p: number) => {
    setBrandPage(Math.min(Math.max(1, p), totalBrandPages));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-ma-cream">
      {/* Header */}
      <div className="bg-gradient-to-b from-ma-navy to-[#0A1833] pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-ma-gold text-xs font-semibold uppercase tracking-widest mb-3">Export B2B · Maroc</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Catalogue produits</h1>
          <p className="text-stone-400 text-sm max-w-xl mx-auto mb-6">
            Parcourez nos produits alimentaires marocains authentiques disponibles à l'export.
          </p>

          {/* Product search (autocomplete over the whole catalogue) */}
          <div className="relative max-w-lg mx-auto mb-5" ref={prodRef}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type="text"
              placeholder="Rechercher un produit dans tout le catalogue…"
              value={prodQuery}
              onChange={e => setProdQuery(e.target.value)}
              onFocus={() => prodHits.length && setProdOpen(true)}
              className="w-full pl-11 pr-9 py-3 bg-white border border-white/10 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-ma-gold/40 text-sm"
            />
            {prodQuery && (
              <button onClick={() => { setProdQuery(''); setProdHits([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            )}
            {prodOpen && prodQuery.trim().length >= 2 && (
              <div className="absolute z-30 mt-2 w-full bg-white rounded-xl shadow-2xl border border-stone-100 overflow-hidden text-left max-h-96 overflow-y-auto">
                {prodHits.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-stone-400">Aucun produit trouvé</p>
                ) : prodHits.map(h => (
                  <Link key={h.id} to={`/product/${h.id}`} onClick={() => setProdOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-ma-cream transition-colors border-b border-stone-50 last:border-0">
                    <div className="w-11 h-11 rounded-lg bg-ma-sand/40 overflow-hidden shrink-0 flex items-center justify-center">
                      {h.image_url
                        ? <img src={productImage(h.image_url, 100)} alt="" loading="lazy" className="w-full h-full object-cover" />
                        : <Package className="w-4 h-4 text-stone-300" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-stone-800 line-clamp-1">{h.name}</p>
                      {brandOf(h) && <p className="text-[11px] text-stone-400 uppercase tracking-wide">{brandOf(h)}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="inline-flex bg-[#0A1833] rounded-xl p-1 border border-white/5">
            <button
              onClick={() => { setView('categories'); setSearch(''); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                view === 'categories' ? 'bg-ma-red text-white shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" /> Catégories
            </button>
            <button
              onClick={() => { setView('brands'); setSearch(''); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                view === 'brands' ? 'bg-ma-red text-white shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" /> Marques
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-ma-sand animate-pulse h-52" />
            ))}
          </div>
        ) : view === 'categories' ? (
          <>
            <div className="relative max-w-sm mb-6">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input type="text" placeholder="Filtrer les catégories…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-ma-red" />
            </div>
            {filteredCats.length === 0 ? (
              <div className="text-center py-20 text-stone-400">
                <p className="text-lg font-medium">Aucune catégorie trouvée</p>
              </div>
            ) : (
              <>
                <p className="text-stone-500 text-sm mb-6">{filteredCats.length} {filteredCats.length === 1 ? 'catégorie' : 'catégories'}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredCats.map((cat, i) => <CategoryCard key={cat.id} category={cat} index={i} />)}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* ── Brand controls ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                {/* Brand name search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input type="text" placeholder="Filtrer les marques par nom…" value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-ma-green" />
                </div>
                {/* Category filter */}
                <select value={brandCategory} onChange={e => setBrandCategory(e.target.value)}
                  className="text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-stone-700 focus:outline-none focus:border-ma-green max-w-[220px]">
                  <option value="">Toutes les catégories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {(search || letter || brandCategory) && (
                  <button onClick={() => { setSearch(''); setLetter(''); setBrandCategory(''); }}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium">
                    <X className="w-3 h-3" /> Réinitialiser
                  </button>
                )}
              </div>

              {/* A-Z bar */}
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setLetter('')}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${letter === '' ? 'bg-ma-navy text-white' : 'bg-white text-stone-500 border border-stone-200 hover:border-ma-navy'}`}>
                  Tous
                </button>
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(L => {
                  const has = letters.has(L);
                  return (
                    <button key={L} disabled={!has} onClick={() => setLetter(letter === L ? '' : L)}
                      className={`w-7 text-xs font-semibold py-1 rounded-md transition-colors ${
                        letter === L ? 'bg-ma-green text-white'
                          : has ? 'bg-white text-stone-600 border border-stone-200 hover:border-ma-green'
                          : 'bg-transparent text-stone-300 cursor-not-allowed'
                      }`}>
                      {L}
                    </button>
                  );
                })}
                {letters.has('#') && (
                  <button onClick={() => setLetter(letter === '#' ? '' : '#')}
                    className={`w-7 text-xs font-semibold py-1 rounded-md transition-colors ${letter === '#' ? 'bg-ma-green text-white' : 'bg-white text-stone-600 border border-stone-200 hover:border-ma-green'}`}>
                    #
                  </button>
                )}
              </div>
            </div>

            {filteredBrands.length === 0 ? (
              <div className="text-center py-20 text-stone-400">
                <p className="text-lg font-medium">Aucune marque trouvée</p>
                <p className="text-sm mt-2">Essayez d'autres filtres</p>
              </div>
            ) : (
              <>
                <p className="text-stone-500 text-sm mb-6">
                  {filteredBrands.length} {filteredBrands.length === 1 ? 'marque' : 'marques'}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {pageBrands.map(b => <BrandCard key={b.id} brand={b} productCount={brandCounts[b.id]} />)}
                </div>

                {/* Pagination */}
                {totalBrandPages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-1.5 flex-wrap">
                    <button onClick={() => goBrandPage(currentBrandPage - 1)} disabled={currentBrandPage === 1}
                      className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      Précédent
                    </button>
                    {Array.from({ length: totalBrandPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalBrandPages || Math.abs(p - currentBrandPage) <= 1)
                      .map((p, idx, arr) => (
                        <span key={p} className="flex items-center">
                          {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-stone-400">…</span>}
                          <button onClick={() => goBrandPage(p)}
                            className={`min-w-[38px] px-3 py-2 text-sm rounded-lg border transition-colors ${
                              p === currentBrandPage ? 'bg-ma-green text-white border-ma-green'
                                : 'bg-white text-stone-600 border-stone-200 hover:border-ma-green'
                            }`}>
                            {p}
                          </button>
                        </span>
                      ))}
                    <button onClick={() => goBrandPage(currentBrandPage + 1)} disabled={currentBrandPage === totalBrandPages}
                      className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Contact note */}
        <div className="mt-16 bg-white border border-ma-sand rounded-2xl p-6 text-center shadow-card">
          <p className="text-ma-navy font-semibold text-sm">
            Contactez-nous pour les tailles, conditionnements et tarifs spécifiques.
          </p>
          <p className="text-ma-red text-xs mt-1.5 font-medium">
            filalianas0001@gmail.com — +212 605 268 946
          </p>
        </div>
      </div>
    </div>
  );
}
