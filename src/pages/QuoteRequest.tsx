import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  CheckCircle, Send, ArrowLeft, ArrowRight, Search, X, Package,
  Loader2, Building2, Truck, User, MapPin, FileText, Settings2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  'France','Espagne','Allemagne','Royaume-Uni','Italie','Pays-Bas','Belgique',
  'Suisse','Portugal','Pologne','États-Unis','Canada','Australie',
  'Arabie Saoudite','Émirats Arabes Unis','Qatar','Koweït','Bahreïn','Oman',
  'Sénégal',"Côte d'Ivoire",'Ghana','Nigeria','Cameroun',
  'Algérie','Tunisie','Égypte','Libye','Mauritanie','Maroc','Autre',
];

const INCOTERMS = ['EXW','FCA','FOB','CFR','CIF','DAP','DDP','FAS','CPT','CIP'];

const PAYMENT_TERMS = [
  'Paiement 100% avance',
  'Lettre de crédit (LC)',
  'Virement 30 jours date facture',
  'Virement 60 jours date facture',
  'Documents contre paiement (D/P)',
  'Documents contre acceptation (D/A)',
  'Compte ouvert 30 jours',
  'À discuter',
];

const CONTAINER_TYPES = [
  'Conteneur 20 pieds (FCL)',
  'Conteneur 40 pieds (FCL)',
  'Conteneur 40 pieds HC (FCL)',
  'Groupage (LCL)',
  'Vrac',
  'Fret aérien',
  'À déterminer',
];

const ORDER_FREQUENCIES = [
  'Commande unique',
  'Mensuelle',
  'Trimestrielle',
  'Semestrielle',
  'Annuelle',
  'À la demande',
];

const CERTIFICATIONS = [
  'Halal','Bio / Organique','Casher','ISO 22000','HACCP',
  'IFS Food','BRC','GlobalGAP','Fairtrade','Sans gluten',
];

const UNITS = ['Cartons','Palettes','Kg','Tonnes','Pièces','Caisses','Litres'];

type SearchMode = 'product' | 'brand' | 'supplier';

interface SearchProduct {
  id: string;
  name: string;
  image_url: string;
  description: string;
  category?: { name: string };
  brand?: { name: string };
  supplier?: { name: string };
}

interface SelectedProduct extends SearchProduct {
  quantity: string;
  unit: string;
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Acheteur',    icon: User },
  { id: 2, label: 'Produits',    icon: Package },
  { id: 3, label: 'Conditions',  icon: FileText },
  { id: 4, label: 'Exigences',   icon: Settings2 },
];

// ─── Helper components ────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = 'w-full border border-ma-sand rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-ma-navy focus:ring-2 focus:ring-ma-navy/5 transition bg-white';
const SELECT = `${INPUT} appearance-none`;

function CheckPill({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
        checked ? 'bg-ma-red text-white border-ma-red' : 'border-stone-200 text-stone-600 hover:border-ma-red'
      }`}>
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuoteRequest() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // ── Step 1: Buyer ──────────────────────────────────────────────────────────
  const [buyer, setBuyer] = useState({
    company_name: '',
    buyer_vat_number: '',
    contact_name: '',
    email: '',
    phone: '',
    buyer_address: '',
    buyer_city: '',
    buyer_postal_code: '',
    country: '',
    delivery_address: '',
    delivery_country: '',
  });

  // ── Step 2: Products ───────────────────────────────────────────────────────
  const [searchMode, setSearchMode] = useState<SearchMode>('product');
  const [productQuery, setProductQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Step 3: Commercial terms ───────────────────────────────────────────────
  const [terms, setTerms] = useState({
    incoterm: '',
    port_loading: '',
    port_destination: '',
    currency: 'EUR',
    payment_terms: '',
    container_type: '',
    delivery_date: '',
    order_frequency: '',
  });

  // ── Step 4: Requirements ───────────────────────────────────────────────────
  const [reqs, setReqs] = useState({
    required_certifications: [] as string[],
    labeling_requirements: '',
    private_label: false,
    sample_request: false,
    message: '',
  });

  // Pre-select product from URL
  useEffect(() => {
    const productName = searchParams.get('product');
    if (!productName) return;
    supabase
      .from('products')
      .select('id, name, image_url, description, category:categories(name), brand:brands(name), supplier:suppliers(name)')
      .eq('is_active', true)
      .ilike('name', `%${productName}%`)
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setSelectedProducts([{ ...(data[0] as unknown as SearchProduct), quantity: '', unit: 'Cartons' }]);
      });
  }, []);

  // Debounced product search
  useEffect(() => {
    if (productQuery.trim().length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      let ids: string[] | null = null;
      if (searchMode === 'brand') {
        const { data } = await supabase.from('brands').select('id').ilike('name', `%${productQuery.trim()}%`).limit(10);
        ids = (data || []).map(b => b.id);
        if (!ids.length) { setSearchResults([]); setShowDropdown(true); setSearching(false); return; }
      }
      if (searchMode === 'supplier') {
        const { data } = await supabase.from('suppliers').select('id').ilike('name', `%${productQuery.trim()}%`).limit(10);
        ids = (data || []).map(s => s.id);
        if (!ids.length) { setSearchResults([]); setShowDropdown(true); setSearching(false); return; }
      }
      let q = supabase
        .from('products')
        .select('id, name, image_url, description, category:categories(name), brand:brands(name), supplier:suppliers(name)')
        .eq('is_active', true).limit(8);
      if (searchMode === 'product') q = q.ilike('name', `%${productQuery.trim()}%`);
      if (searchMode === 'brand' && ids) q = q.in('marque_id', ids);
      if (searchMode === 'supplier' && ids) q = q.in('fournisseur_id', ids);
      const { data } = await q;
      setSearchResults((data || []) as unknown as SearchProduct[]);
      setShowDropdown(true);
      setSearching(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [productQuery, searchMode]);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const addProduct = (p: SearchProduct) => {
    if (!selectedProducts.find(s => s.id === p.id))
      setSelectedProducts(prev => [...prev, { ...p, quantity: '', unit: 'Cartons' }]);
    setProductQuery(''); setShowDropdown(false);
  };
  const removeProduct = (id: string) => setSelectedProducts(prev => prev.filter(p => p.id !== id));
  const updateProduct = (id: string, field: 'quantity' | 'unit', val: string) =>
    setSelectedProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));

  // Step validation
  const canProceed = (): boolean => {
    if (step === 1) return !!(buyer.company_name && buyer.contact_name && buyer.email && buyer.country);
    if (step === 2) return selectedProducts.length > 0;
    if (step === 3) return !!(terms.incoterm && terms.payment_terms);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const products_interested = selectedProducts
      .map(p => `${p.name}${p.category?.name ? ` (${p.category.name})` : ''}${p.quantity ? ` — ${p.quantity} ${p.unit}` : ''}`)
      .join('\n');

    const quantity_notes = selectedProducts
      .filter(p => p.quantity)
      .map(p => `${p.name} : ${p.quantity} ${p.unit}`)
      .join(', ');

    // Full payload (requires migration 20260525_update_quote_requests_comprehensive.sql)
    const fullPayload = {
      ...buyer,
      products_interested,
      quantity_notes,
      ...terms,
      ...reqs,
    };

    const { error: err } = await supabase.from('quote_requests').insert([fullPayload]);

    if (!err) { setSubmitted(true); return; }

    // Fallback: migration not yet applied — encode extra fields into message
    console.warn('Insert with full schema failed, trying base schema fallback:', err.message);

    const extraDetails = [
      buyer.buyer_vat_number && `N° TVA : ${buyer.buyer_vat_number}`,
      buyer.buyer_address && `Adresse : ${[buyer.buyer_address, buyer.buyer_postal_code, buyer.buyer_city].filter(Boolean).join(', ')}`,
      buyer.delivery_address && `Livraison : ${buyer.delivery_address}`,
      buyer.delivery_country && `Pays livraison : ${buyer.delivery_country}`,
      terms.incoterm && `Incoterm : ${terms.incoterm}`,
      terms.currency && `Devise : ${terms.currency}`,
      terms.port_loading && `Port chargement : ${terms.port_loading}`,
      terms.port_destination && `Port destination : ${terms.port_destination}`,
      terms.payment_terms && `Paiement : ${terms.payment_terms}`,
      terms.container_type && `Transport : ${terms.container_type}`,
      terms.delivery_date && `Livraison souhaitée : ${terms.delivery_date}`,
      terms.order_frequency && `Fréquence : ${terms.order_frequency}`,
      reqs.required_certifications.length && `Certifications : ${reqs.required_certifications.join(', ')}`,
      reqs.labeling_requirements && `Étiquetage : ${reqs.labeling_requirements}`,
      reqs.private_label && 'Private label : Oui',
      reqs.sample_request && 'Échantillons : Oui',
      reqs.message && `Notes : ${reqs.message}`,
    ].filter(Boolean).join('\n');

    const fallbackPayload = {
      company_name: buyer.company_name,
      contact_name: buyer.contact_name,
      email: buyer.email,
      phone: buyer.phone || '',
      country: buyer.country,
      products_interested,
      quantity_notes,
      message: extraDetails,
    };

    const { error: fallbackErr } = await supabase.from('quote_requests').insert([fallbackPayload]);
    if (fallbackErr) {
      console.error('Supabase insert error:', fallbackErr);
      setError(`Envoi échoué (${fallbackErr.message}). Contactez-nous directement.`);
      setSubmitting(false);
    } else {
      setSubmitted(true);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-ma-cream flex items-center justify-center px-4 pt-16">
        <div className="bg-white rounded-3xl shadow-lg p-5 sm:p-10 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">Demande envoyée !</h2>
          <p className="text-stone-500 text-sm leading-relaxed mb-5">
            Merci <strong>{buyer.contact_name}</strong> — notre équipe va préparer votre proforma sous 24 h
            et vous la transmettra à <strong>{buyer.email}</strong>.
          </p>

          {/* Summary */}
          <div className="bg-ma-cream rounded-2xl p-4 text-left space-y-3 mb-6 border border-ma-sand">
            <div className="text-xs text-stone-400 font-semibold uppercase tracking-wide">Récapitulatif</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div><span className="text-stone-400">Société : </span><strong>{buyer.company_name}</strong></div>
              {terms.incoterm && <div><span className="text-stone-400">Incoterm : </span><strong>{terms.incoterm}</strong></div>}
              {terms.currency && <div><span className="text-stone-400">Devise : </span><strong>{terms.currency}</strong></div>}
              {terms.payment_terms && <div><span className="text-stone-400">Paiement : </span><strong className="line-clamp-1">{terms.payment_terms}</strong></div>}
            </div>
            {selectedProducts.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-stone-100">
                <p className="text-xs text-stone-400">{selectedProducts.length} produit{selectedProducts.length > 1 ? 's' : ''}</p>
                {selectedProducts.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-ma-sand overflow-hidden shrink-0">
                      {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-xs text-stone-700 font-medium truncate flex-1">{p.name}</span>
                    {p.quantity && <span className="text-xs text-stone-400 shrink-0">{p.quantity} {p.unit}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-stone-400 mb-6">Urgences : <a href="tel:+212605268946" className="text-ma-red">+212 605 268 946</a></p>
          <div className="flex gap-3">
            <Link to="/catalog" className="flex-1 border border-ma-sand text-stone-600 text-sm py-3 rounded-xl hover:bg-ma-cream transition-colors font-medium">Catalogue</Link>
            <button onClick={() => { setSubmitted(false); setStep(1); setSelectedProducts([]); }}
              className="flex-1 bg-ma-navy hover:bg-[#1A3570] text-white text-sm py-3 rounded-xl font-medium transition-colors">
              Nouvelle demande
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  const filteredResults = searchResults.filter(r => !selectedProducts.find(s => s.id === r.id));

  return (
    <div className="min-h-screen bg-ma-cream">
      {/* Header */}
      <div className="bg-gradient-to-b from-ma-navy to-[#0A1833] pt-24 pb-10 px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/catalog" className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour au catalogue
          </Link>
          <h1 className="text-3xl font-bold text-white">Demande de Proforma</h1>
          <p className="text-stone-400 text-sm mt-2">Renseignez vos informations — nous générons votre devis formel sous 24 h.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    done ? 'bg-emerald-500' : active ? 'bg-ma-red' : 'bg-stone-200'
                  }`}>
                    {done
                      ? <CheckCircle className="w-5 h-5 text-white" />
                      : <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-stone-400'}`} />}
                  </div>
                  <span className={`text-[9px] sm:text-xs mt-1 font-medium text-center hidden sm:block ${active ? 'text-ma-red' : done ? 'text-emerald-600' : 'text-stone-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${done ? 'bg-emerald-400' : 'bg-stone-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4 sm:p-8">

            {/* ══════════════════════════════════════════════════════════════
                STEP 1 — ACHETEUR
            ══════════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-base font-bold text-stone-800 pb-3 border-b border-stone-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-ma-gold" /> Informations acheteur
                </h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Raison sociale" required>
                    <input type="text" required value={buyer.company_name} onChange={e => setBuyer(b => ({ ...b, company_name: e.target.value }))} placeholder="SARL Exemple" className={INPUT} />
                  </Field>
                  <Field label="N° TVA / SIRET / Registre">
                    <input type="text" value={buyer.buyer_vat_number} onChange={e => setBuyer(b => ({ ...b, buyer_vat_number: e.target.value }))} placeholder="FR 12 345678901" className={INPUT} />
                  </Field>
                  <Field label="Nom du contact" required>
                    <input type="text" required value={buyer.contact_name} onChange={e => setBuyer(b => ({ ...b, contact_name: e.target.value }))} placeholder="Jean Dupont" className={INPUT} />
                  </Field>
                  <Field label="E-mail" required>
                    <input type="email" required value={buyer.email} onChange={e => setBuyer(b => ({ ...b, email: e.target.value }))} placeholder="jean@societe.com" className={INPUT} />
                  </Field>
                  <Field label="Téléphone / WhatsApp">
                    <input type="tel" value={buyer.phone} onChange={e => setBuyer(b => ({ ...b, phone: e.target.value }))} placeholder="+33 6 00 00 00 00" className={INPUT} />
                  </Field>
                  <Field label="Pays" required>
                    <select required value={buyer.country} onChange={e => setBuyer(b => ({ ...b, country: e.target.value }))} className={SELECT}>
                      <option value="">Sélectionner</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="pt-2 border-t border-stone-100">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Adresse de facturation
                  </p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-3">
                      <input type="text" value={buyer.buyer_address} onChange={e => setBuyer(b => ({ ...b, buyer_address: e.target.value }))} placeholder="N° et rue" className={INPUT} />
                    </div>
                    <input type="text" value={buyer.buyer_city} onChange={e => setBuyer(b => ({ ...b, buyer_city: e.target.value }))} placeholder="Ville" className={INPUT} />
                    <input type="text" value={buyer.buyer_postal_code} onChange={e => setBuyer(b => ({ ...b, buyer_postal_code: e.target.value }))} placeholder="Code postal" className={INPUT} />
                    <select value={buyer.delivery_country} onChange={e => setBuyer(b => ({ ...b, delivery_country: e.target.value }))} className={SELECT}>
                      <option value="">Pays (livraison)</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-stone-600 mb-2 cursor-pointer">
                    Adresse de livraison différente ? (optionnel)
                  </label>
                  <textarea rows={2} value={buyer.delivery_address} onChange={e => setBuyer(b => ({ ...b, delivery_address: e.target.value }))}
                    placeholder="Adresse complète de livraison si différente de la facturation…"
                    className={`${INPUT} resize-none`} />
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 2 — PRODUITS
            ══════════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-base font-bold text-stone-800 pb-3 border-b border-stone-100 flex items-center gap-2">
                  <Package className="w-4 h-4 text-ma-gold" /> Produits & Quantités
                </h2>

                {/* Search mode toggle */}
                <div className="flex gap-1.5 p-1 bg-stone-100 rounded-xl w-fit">
                  {([
                    { mode: 'product' as SearchMode,  label: 'Produit',   Icon: Package },
                    { mode: 'brand' as SearchMode,    label: 'Marque',    Icon: Building2 },
                    { mode: 'supplier' as SearchMode, label: 'Grossiste', Icon: Truck },
                  ]).map(({ mode, label, Icon }) => (
                    <button key={mode} type="button"
                      onClick={() => { setSearchMode(mode); setProductQuery(''); setShowDropdown(false); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${searchMode === mode ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>

                {/* Selected products */}
                {selectedProducts.length > 0 && (
                  <div className="space-y-2">
                    {selectedProducts.map(p => (
                      <div key={p.id} className="flex items-start gap-3 bg-ma-cream border border-ma-sand rounded-xl p-3">
                        <div className="w-12 h-12 rounded-xl bg-white border border-stone-200 overflow-hidden shrink-0">
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            : <Package className="w-5 h-5 text-stone-300 m-auto mt-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          {p.supplier?.name && <p className="text-xs font-bold text-stone-700 uppercase tracking-wide leading-none mb-0.5">{p.supplier.name}</p>}
                          <p className="text-sm font-semibold text-stone-800 truncate">{p.name}</p>
                          {p.category?.name && <p className="text-xs text-stone-400">{p.category.name}</p>}
                          {/* Quantity + unit */}
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              value={p.quantity}
                              onChange={e => updateProduct(p.id, 'quantity', e.target.value)}
                              placeholder="Quantité"
                              className="flex-1 border border-ma-sand rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-ma-gold bg-white"
                            />
                            <select
                              value={p.unit}
                              onChange={e => updateProduct(p.id, 'unit', e.target.value)}
                              className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400 bg-white"
                            >
                              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeProduct(p.id)}
                          className="w-7 h-7 rounded-full border border-stone-200 flex items-center justify-center text-stone-400 hover:text-red-500 hover:border-red-300 bg-white transition-colors shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search field */}
                <div ref={searchRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ma-gold animate-spin" />}
                    <input type="text" value={productQuery}
                      onChange={e => setProductQuery(e.target.value)}
                      onFocus={() => filteredResults.length > 0 && setShowDropdown(true)}
                      placeholder={searchMode === 'product' ? 'Rechercher par nom de produit…' : searchMode === 'brand' ? 'Rechercher par marque…' : 'Rechercher par grossiste…'}
                      className={INPUT + ' pl-10 pr-10'} />
                  </div>
                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1.5 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden">
                      {filteredResults.length > 0 ? (
                        <div className="max-h-64 overflow-y-auto divide-y divide-stone-50">
                          {filteredResults.map(p => (
                            <button key={p.id} type="button" onClick={() => addProduct(p)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 transition-colors text-left">
                              <div className="w-11 h-11 rounded-xl bg-stone-100 overflow-hidden shrink-0">
                                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-stone-300 m-auto mt-3.5" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                {p.supplier?.name && <p className="text-xs font-bold text-stone-600 uppercase tracking-wide leading-none mb-0.5">{p.supplier.name}</p>}
                                <p className="text-sm font-semibold text-stone-800 truncate">{p.name}</p>
                                <div className="flex gap-1.5 flex-wrap">
                                  {p.category?.name && <span className="text-xs text-stone-400">{p.category.name}</span>}
                                  {p.brand?.name && <span className="text-xs text-blue-500 font-medium">{p.brand.name}</span>}
                                </div>
                              </div>
                              <span className="shrink-0 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">+ Ajouter</span>
                            </button>
                          ))}
                        </div>
                      ) : !searching && productQuery.length >= 2 ? (
                        <div className="px-4 py-5 text-center text-sm text-stone-400">
                          Aucun résultat pour <strong>"{productQuery}"</strong>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                {selectedProducts.length === 0 && (
                  <p className="text-xs text-stone-400 text-center">Tapez au moins 2 caractères pour rechercher un produit, une marque ou un grossiste.</p>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 3 — CONDITIONS COMMERCIALES
            ══════════════════════════════════════════════════════════════ */}
            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-base font-bold text-stone-800 pb-3 border-b border-stone-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-ma-gold" /> Conditions commerciales
                </h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Incoterm" required>
                    <select required value={terms.incoterm} onChange={e => setTerms(t => ({ ...t, incoterm: e.target.value }))} className={SELECT}>
                      <option value="">Sélectionner</option>
                      {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </Field>
                  <Field label="Devise">
                    <select value={terms.currency} onChange={e => setTerms(t => ({ ...t, currency: e.target.value }))} className={SELECT}>
                      {['EUR','USD','GBP','MAD','AED','SAR'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Port / lieu de chargement">
                    <input type="text" value={terms.port_loading} onChange={e => setTerms(t => ({ ...t, port_loading: e.target.value }))} placeholder="Ex : Casablanca, Agadir…" className={INPUT} />
                  </Field>
                  <Field label="Port / lieu de destination">
                    <input type="text" value={terms.port_destination} onChange={e => setTerms(t => ({ ...t, port_destination: e.target.value }))} placeholder="Ex : Marseille, Rotterdam…" className={INPUT} />
                  </Field>
                </div>

                <Field label="Conditions de paiement" required>
                  <select required value={terms.payment_terms} onChange={e => setTerms(t => ({ ...t, payment_terms: e.target.value }))} className={SELECT}>
                    <option value="">Sélectionner</option>
                    {PAYMENT_TERMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Type de transport / conteneur">
                    <select value={terms.container_type} onChange={e => setTerms(t => ({ ...t, container_type: e.target.value }))} className={SELECT}>
                      <option value="">Sélectionner</option>
                      {CONTAINER_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Date de livraison souhaitée">
                    <input type="date" value={terms.delivery_date} onChange={e => setTerms(t => ({ ...t, delivery_date: e.target.value }))} className={INPUT} />
                  </Field>
                </div>

                <Field label="Fréquence de commande">
                  <div className="flex flex-wrap gap-2">
                    {ORDER_FREQUENCIES.map(f => (
                      <CheckPill key={f} label={f} checked={terms.order_frequency === f}
                        onChange={() => setTerms(t => ({ ...t, order_frequency: t.order_frequency === f ? '' : f }))} />
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 4 — EXIGENCES SPÉCIFIQUES
            ══════════════════════════════════════════════════════════════ */}
            {step === 4 && (
              <div className="space-y-5">
                <h2 className="text-base font-bold text-stone-800 pb-3 border-b border-stone-100 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-ma-gold" /> Exigences & Notes
                </h2>

                <Field label="Certifications requises">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {CERTIFICATIONS.map(c => (
                      <CheckPill key={c} label={c}
                        checked={reqs.required_certifications.includes(c)}
                        onChange={() => setReqs(r => ({
                          ...r,
                          required_certifications: r.required_certifications.includes(c)
                            ? r.required_certifications.filter(x => x !== c)
                            : [...r.required_certifications, c],
                        }))} />
                    ))}
                  </div>
                </Field>

                <Field label="Exigences d'étiquetage">
                  <textarea rows={2} value={reqs.labeling_requirements}
                    onChange={e => setReqs(r => ({ ...r, labeling_requirements: e.target.value }))}
                    placeholder="Langue, mentions obligatoires, marque distributeur, format barcode…"
                    className={`${INPUT} resize-none`} />
                </Field>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="flex items-start gap-3 cursor-pointer p-3 border border-ma-sand rounded-xl hover:bg-ma-cream transition-colors">
                    <input type="checkbox" checked={reqs.private_label}
                      onChange={e => setReqs(r => ({ ...r, private_label: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 rounded border-stone-300 text-ma-gold" />
                    <div>
                      <p className="text-sm font-semibold text-stone-800">Marque distributeur</p>
                      <p className="text-xs text-stone-400">Je souhaite un étiquetage à ma marque (private label)</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-3 border border-ma-sand rounded-xl hover:bg-ma-cream transition-colors">
                    <input type="checkbox" checked={reqs.sample_request}
                      onChange={e => setReqs(r => ({ ...r, sample_request: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 rounded border-stone-300 text-ma-gold" />
                    <div>
                      <p className="text-sm font-semibold text-stone-800">Demande d'échantillons</p>
                      <p className="text-xs text-stone-400">Je souhaite recevoir des échantillons avant commande</p>
                    </div>
                  </label>
                </div>

                <Field label="Instructions complémentaires">
                  <textarea rows={4} value={reqs.message}
                    onChange={e => setReqs(r => ({ ...r, message: e.target.value }))}
                    placeholder="Toute autre information utile à la préparation du devis : port spécifique, contraintes douanières, réglementation d'import, délais impératifs…"
                    className={`${INPUT} resize-none`} />
                </Field>

                {/* Quick recap */}
                <div className="bg-ma-cream border border-ma-sand rounded-xl p-4 text-xs space-y-1 text-stone-500">
                  <p className="font-semibold text-stone-700 mb-2">Récapitulatif avant envoi</p>
                  <p><span className="font-medium">Acheteur :</span> {buyer.company_name} — {buyer.contact_name} ({buyer.email})</p>
                  <p><span className="font-medium">Produits :</span> {selectedProducts.length} produit{selectedProducts.length > 1 ? 's' : ''} sélectionné{selectedProducts.length > 1 ? 's' : ''}</p>
                  {terms.incoterm && <p><span className="font-medium">Incoterm :</span> {terms.incoterm} — {terms.port_destination || '(destination à préciser)'}</p>}
                  {terms.payment_terms && <p><span className="font-medium">Paiement :</span> {terms.payment_terms}</p>}
                  {terms.currency && <p><span className="font-medium">Devise :</span> {terms.currency}</p>}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3 mt-5">
            {step > 1 && (
              <button type="button" onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-2 border border-ma-sand text-stone-600 text-sm font-medium px-5 py-3 rounded-xl hover:bg-white transition-colors bg-ma-cream">
                <ArrowLeft className="w-4 h-4" /> Précédent
              </button>
            )}

            {step < 4 ? (
              <button type="button" onClick={() => { setError(''); if (canProceed()) setStep(s => s + 1); else setError('Veuillez compléter les champs obligatoires avant de continuer.'); }}
                className="flex-1 flex items-center justify-center gap-2 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                Suivant <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-ma-red hover:bg-[#9B1E24] disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : <><Send className="w-4 h-4" /> Envoyer la demande de proforma</>}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-stone-400 mt-4">
            <a href="mailto:filalianas0001@gmail.com" className="text-ma-red hover:underline">filalianas0001@gmail.com</a>
            {' '}/{' '}
            <a href="tel:+212605268946" className="text-ma-red hover:underline">+212 605 268 946</a>
          </p>
        </form>
      </div>
    </div>
  );
}
