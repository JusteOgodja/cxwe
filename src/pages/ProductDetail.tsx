import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, CheckCircle, MessageSquare, Tag,
  ChevronLeft, ChevronRight, Thermometer, MapPin, Award,
  Truck, Box, Layers, AlertTriangle, Info, Scale,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { productImage } from '../lib/img';
import type { Product, PricingTier } from '../types';

const TEMP_COLORS: Record<string, string> = {
  'Ambiante': 'bg-stone-100 text-stone-700',
  'Réfrigéré': 'bg-blue-100 text-blue-700',
  'Frais': 'bg-cyan-100 text-cyan-700',
  'Surgelé': 'bg-indigo-100 text-indigo-700',
};

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-ma-sand/70 rounded-2xl p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-4">
        <Icon className="w-4 h-4 text-ma-red" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function Chip({ label, color = 'stone' }: { label: string; color?: string }) {
  const palette: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-600',
    amber: 'bg-green-50 text-ma-green border border-green-100',
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border border-blue-100',
    red: 'bg-red-50 text-red-600 border border-red-100',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${palette[color] || palette.stone}`}>
      {label}
    </span>
  );
}

function DimRow({ label, dim }: { label: string; dim?: Product['dimensions_unite'] }) {
  if (!dim || (!dim.length && !dim.width && !dim.height)) return null;
  return (
    <tr className="border-b border-stone-50 last:border-0">
      <td className="py-2 pr-4 text-xs text-stone-500 font-medium whitespace-nowrap">{label}</td>
      <td className="py-2 text-xs text-stone-700">
        {[dim.length, dim.width, dim.height].filter(Boolean).join(' × ')} cm
        {dim.weight_net && <span className="ml-3 text-stone-400">Net {dim.weight_net} kg</span>}
        {dim.weight_brut && <span className="ml-2 text-stone-400">Brut {dim.weight_brut} kg</span>}
      </td>
    </tr>
  );
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('*, category:categories(name,slug), brand:brands(name,slug), supplier:suppliers(name,slug)')
        .eq('id', id)
        .maybeSingle();

      if (!data) { navigate('/catalog', { replace: true }); return; }
      setProduct(data as Product);

      const [tiersRes, relRes] = await Promise.all([
        supabase.from('product_pricing_tiers').select('*').eq('product_id', id).order('min_quantity'),
        supabase.from('products')
          .select('*, category:categories(name,slug)')
          .eq('category_id', data.category_id)
          .eq('is_active', true)
          .neq('id', id)
          .order('sort_order')
          .limit(4),
      ]);

      setPricingTiers((tiersRes.data || []) as PricingTier[]);
      setRelated((relRes.data || []) as Product[]);
      setLoading(false);
    })();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ma-cream pt-24">
        <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse">
          <div className="h-6 bg-stone-200 rounded w-40 mb-8" />
          <div className="grid md:grid-cols-2 gap-10">
            <div className="rounded-2xl bg-ma-sand aspect-square" />
            <div className="space-y-4">
              <div className="h-8 bg-stone-200 rounded w-3/4" />
              <div className="h-4 bg-stone-200 rounded w-full" />
              <div className="h-4 bg-stone-200 rounded w-5/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const images = product.image_url ? [product.image_url] : [];
  const categorySlug = product.category?.slug;
  const categoryName = product.category?.name;

  return (
    <div className="min-h-screen bg-ma-cream">
      {/* Header */}
      <div className="bg-ma-navy pt-24 pb-8 px-4">
        <div className="max-w-5xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-stone-400 mb-4 flex-wrap">
            <Link to="/catalog" className="hover:text-white transition-colors">Catalogue</Link>
            {categoryName && categorySlug && (
              <>
                <span>/</span>
                <Link to={`/catalog/${categorySlug}`} className="hover:text-white transition-colors">{categoryName}</Link>
              </>
            )}
            <span>/</span>
            <span className="text-stone-300 truncate max-w-xs">{product.name}</span>
          </nav>
          <Link
            to={categorySlug ? `/catalog/${categorySlug}` : '/catalog'}
            className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">

        {/* ── Hero: image + infos principales ──────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-8">

          {/* Image gallery */}
          <div>
            <div className="relative rounded-2xl overflow-hidden bg-stone-100 aspect-square shadow-sm">
              {images.length > 0 ? (
                <img src={productImage(images[imgIdx], 800)} alt={product.name} loading="eager" decoding="async" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-stone-300">
                  <Package className="w-16 h-16" />
                  <span className="text-sm">Aucune image disponible</span>
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button onClick={() => setImgIdx(i => Math.max(0, i - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow">
                    <ChevronLeft className="w-4 h-4 text-stone-700" />
                  </button>
                  <button onClick={() => setImgIdx(i => Math.min(images.length - 1, i + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow">
                    <ChevronRight className="w-4 h-4 text-stone-700" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Infos principales */}
          <div className="flex flex-col">

            {/* ── Wholesaler / Supplier — top, bold ────────────────────────── */}
            {product.supplier?.name && (
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-stone-100">
                <Truck className="w-4 h-4 text-stone-400 shrink-0" />
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide leading-none mb-0.5">Grossiste</p>
                  <p className="text-lg font-extrabold text-stone-900 leading-tight">{product.supplier.name}</p>
                </div>
              </div>
            )}

            {/* Badges de statut */}
            <div className="flex flex-wrap gap-2 mb-3">
              {categoryName && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ma-green bg-green-50 border border-green-200 rounded-full px-3 py-1">
                  <Tag className="w-3 h-3" />{categoryName}
                </span>
              )}
              {product.is_new && <Chip label="NOUVEAU" color="green" />}
              {product.is_promo && <Chip label="PROMO" color="red" />}
              {product.temperature && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${TEMP_COLORS[product.temperature] || TEMP_COLORS['Ambiante']}`}>
                  <Thermometer className="w-3 h-3" />{product.temperature}
                </span>
              )}
            </div>

            {/* Brand */}
            {product.brand?.name && (
              <p className="text-sm font-semibold text-ma-navy mb-1">{product.brand.name}</p>
            )}

            <h1 className="text-2xl font-bold text-stone-900 leading-snug mb-2">{product.name}</h1>

            {product.description && (
              <p className="text-stone-600 text-sm leading-relaxed mb-4">{product.description}</p>
            )}

            {/* Régimes alimentaires */}
            {product.regimes && product.regimes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {product.regimes.map(r => <Chip key={r} label={r} color="green" />)}
              </div>
            )}

            {/* Détails (checklist) */}
            {product.details && product.details.length > 0 && (
              <div className="bg-ma-cream rounded-xl p-4 mb-5">
                <ul className="space-y-2">
                  {product.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-stone-700">
                      <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Infos rapides */}
            <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
              {product.commande_min > 1 && (
                <div className="bg-white border border-stone-100 rounded-xl p-3">
                  <p className="text-stone-400 mb-0.5">Commande min.</p>
                  <p className="font-semibold text-stone-800">{product.commande_min} unités</p>
                </div>
              )}
              {product.colisage > 1 && (
                <div className="bg-white border border-stone-100 rounded-xl p-3">
                  <p className="text-stone-400 mb-0.5">Colisage</p>
                  <p className="font-semibold text-stone-800">{product.colisage} u./carton</p>
                </div>
              )}
              {product.pays_origine && (
                <div className="bg-white border border-stone-100 rounded-xl p-3">
                  <p className="text-stone-400 mb-0.5">Pays d'origine</p>
                  <p className="font-semibold text-stone-800">{product.pays_origine}</p>
                </div>
              )}
              {product.duree_conservation > 0 && (
                <div className="bg-white border border-stone-100 rounded-xl p-3">
                  <p className="text-stone-400 mb-0.5">Conservation</p>
                  <p className="font-semibold text-stone-800">{product.duree_conservation} j</p>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="mt-auto space-y-2.5">
              <Link
                to={`/quote?product=${encodeURIComponent(product.name)}${categoryName ? `&category=${encodeURIComponent(categoryName)}` : ''}`}
                className="flex items-center justify-center gap-2 w-full bg-ma-red hover:bg-[#9B1E24] text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Demander un devis
              </Link>
              <Link
                to="/catalog"
                className="flex items-center justify-center w-full border border-stone-200 text-stone-600 hover:bg-stone-100 text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Parcourir le catalogue
              </Link>
            </div>
          </div>
        </div>

        {/* ── Tarifs dégressifs ─────────────────────────────────────────────── */}
        {pricingTiers.length > 0 && (
          <Section icon={Scale} title="Tarifs dégressifs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left pb-2 text-xs font-semibold text-stone-500 uppercase tracking-wide">Quantité min.</th>
                    <th className="text-right pb-2 text-xs font-semibold text-stone-500 uppercase tracking-wide">Prix unitaire</th>
                    <th className="text-right pb-2 text-xs font-semibold text-stone-500 uppercase tracking-wide hidden sm:table-cell">Devise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {pricingTiers.map((tier, i) => (
                    <tr key={i} className={i === 0 ? 'font-medium text-stone-800' : 'text-stone-600'}>
                      <td className="py-2">{tier.min_quantity.toLocaleString()} unités</td>
                      <td className="py-2 text-right text-ma-green font-semibold">
                        {Number(tier.price).toFixed(2)}
                      </td>
                      <td className="py-2 text-right text-stone-400 text-xs hidden sm:table-cell">{tier.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-stone-400 mt-3">* Prix indicatifs — contactez-nous pour un devis personnalisé.</p>
          </Section>
        )}

        {/* ── Logistique & Dimensions ───────────────────────────────────────── */}
        {(product.dimensions_unite || product.dimensions_carton || product.dimensions_palette || product.palettisation) && (
          <Section icon={Box} title="Logistique & Dimensions">
            <table className="w-full">
              <tbody>
                <DimRow label="Unité" dim={product.dimensions_unite} />
                <DimRow label="Carton" dim={product.dimensions_carton} />
                <DimRow label="Palette" dim={product.dimensions_palette} />
                {product.palettisation && (
                  <tr>
                    <td className="py-2 pr-4 text-xs text-stone-500 font-medium whitespace-nowrap">Palettisation</td>
                    <td className="py-2 text-xs text-stone-700">
                      {product.palettisation.cartons_per_layer} cartons/couche · {product.palettisation.layers_per_palette} couches/palette
                      {' '}→ <strong>{product.palettisation.cartons_per_layer * product.palettisation.layers_per_palette} cartons/palette</strong>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>
        )}

        {/* ── Origine & Commerce ────────────────────────────────────────────── */}
        {(product.pays_origine || (product.incoterms_dispo && product.incoterms_dispo.length > 0) ||
          (product.pays_export_autorises && product.pays_export_autorises.length > 0) ||
          (product.certifications && product.certifications.length > 0)) && (
          <Section icon={Truck} title="Origine & Commerce">
            <div className="space-y-4">
              {product.pays_origine && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-stone-400 mb-0.5">Pays d'origine</p>
                    <p className="text-sm font-medium text-stone-700">{product.pays_origine}</p>
                  </div>
                </div>
              )}

              {product.incoterms_dispo && product.incoterms_dispo.length > 0 && (
                <div>
                  <p className="text-xs text-stone-400 mb-2">Incoterms disponibles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.incoterms_dispo.map(inc => (
                      <span key={inc} className="text-xs font-mono font-semibold bg-stone-100 text-stone-700 px-2 py-1 rounded-lg">{inc}</span>
                    ))}
                  </div>
                </div>
              )}

              {product.pays_export_autorises && product.pays_export_autorises.length > 0 && (
                <div>
                  <p className="text-xs text-stone-400 mb-2">Pays d'export autorisés</p>
                  <p className="text-sm text-stone-700">{product.pays_export_autorises.join(', ')}</p>
                </div>
              )}

              {product.certifications && product.certifications.length > 0 && (
                <div>
                  <p className="text-xs text-stone-400 mb-2">Certifications</p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.certifications.map(c => (
                      <span key={c} className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-lg">
                        <Award className="w-3 h-3" />{c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </Section>
        )}

        {/* ── Composition ──────────────────────────────────────────────────── */}
        {(product.allergenes?.length || product.ingredients_texte || product.nutrition_texte) ? (
          <Section icon={Layers} title="Composition & Nutrition">
            <div className="space-y-4">
              {product.allergenes && product.allergenes.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    <p className="text-xs font-semibold text-orange-600">Allergènes</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {product.allergenes.map(a => (
                      <span key={a} className="text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-1 rounded-lg">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {product.ingredients_texte && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 mb-1.5">Ingrédients</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{product.ingredients_texte}</p>
                </div>
              )}

              {product.nutrition_texte && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 mb-1.5">Informations nutritionnelles</p>
                  <pre className="text-xs text-stone-700 font-mono leading-relaxed whitespace-pre-wrap bg-ma-cream rounded-xl p-3">
                    {product.nutrition_texte}
                  </pre>
                </div>
              )}
            </div>
          </Section>
        ) : null}

        {/* ── Codes & Références ───────────────────────────────────────────── */}
        {(product.hs_code || product.ean) && (
          <Section icon={Info} title="Codes & Références">
            <div className="grid sm:grid-cols-2 gap-6 text-sm">
              {product.hs_code && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 mb-1">Code SH (Système Harmonisé)</p>
                  <p className="font-mono text-lg font-bold text-stone-800 tracking-widest mb-1">{product.hs_code}</p>
                  <p className="text-[11px] text-stone-400 leading-snug">
                    Nomenclature douanière internationale à 6 chiffres (OMD) — détermine les droits de douane, taxes et restrictions applicables dans 195 pays.
                  </p>
                </div>
              )}
              {product.ean && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 mb-1">Code EAN-13</p>
                  <p className="font-mono text-stone-700 tracking-widest">{product.ean}</p>
                  <p className="text-[11px] text-stone-400 mt-1">Code-barres international d'identification produit.</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Produits similaires ───────────────────────────────────────────── */}
        {related.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-stone-800 mb-4">
              Autres produits dans {categoryName || 'cette catégorie'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map(p => (
                <Link key={p.id} to={`/product/${p.id}`}
                  className="group bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
                  <div className="h-36 bg-stone-100 overflow-hidden">
                    {p.image_url ? (
                      <img src={productImage(p.image_url, 400)} alt={p.name} loading="lazy" decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-stone-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-stone-800 line-clamp-2 leading-snug">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{p.description}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
