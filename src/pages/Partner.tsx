import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle, Send, Loader2,
  Package, Globe, Award, Truck, ChevronDown, ChevronUp,
  Leaf, Factory, BarChart3, Handshake,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  'Maroc','France','Espagne','Algérie','Tunisie','Égypte','Sénégal',
  "Côte d'Ivoire",'Mauritanie','Autre',
];
const COUNTRY_CODES = ['MA','FR','ES','DZ','TN','EG','SN','CI','MR',null] as const;

const CATEGORIES = [
  'Huiles (Olive / Argan)','Olives & Conserves','Épices & Aromates',
  'Légumineuses & Céréales','Fruits Secs & Dattes','Confiture & Miel',
  'Produits Laitiers','Viandes & Charcuterie','Poissons & Fruits de Mer',
  'Jus & Boissons','Thés & Tisanes','Pâtisseries & Gâteaux',
  'Couscous & Pâtes','Légumes & Fruits Frais','Surgelés','Autre',
];

const CERTIFICATIONS = [
  'Halal','Bio / Organique','Casher','ISO 22000','HACCP',
  'IFS Food','BRC','GlobalGAP','Fairtrade','Sans gluten','Autre',
];

const TARGET_MARKETS = [
  'France','Espagne','Italie','Allemagne','Pays-Bas','Belgique',
  'Royaume-Uni','États-Unis','Canada','Arabie Saoudite','Émirats Arabes Unis',
  'Sénégal',"Côte d'Ivoire",'Australie','Autre',
];
const TARGET_MARKET_CODES = ['FR','ES','IT','DE','NL','BE','GB','US','CA','SA','AE','SN','CI','AU',null] as const;

const BENEFITS = [
  { icon: Globe, titleKey: 'benefit1Title', descKey: 'benefit1Desc' },
  { icon: Award, titleKey: 'benefit2Title', descKey: 'benefit2Desc' },
  { icon: Truck, titleKey: 'benefit3Title', descKey: 'benefit3Desc' },
  { icon: BarChart3, titleKey: 'benefit4Title', descKey: 'benefit4Desc' },
] as const;

const INPUT = 'w-full border border-ma-sand rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-ma-navy focus:ring-2 focus:ring-ma-navy/5 transition bg-white';
const SELECT = `${INPUT} appearance-none`;

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

// ─── FAQ accordion ────────────────────────────────────────────────────────────
const FAQS = [
  { qKey: 'faq1q', aKey: 'faq1a' }, { qKey: 'faq2q', aKey: 'faq2a' },
  { qKey: 'faq3q', aKey: 'faq3a' }, { qKey: 'faq4q', aKey: 'faq4a' },
  { qKey: 'faq5q', aKey: 'faq5a' },
] as const;

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-100">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left gap-4">
        <span className="font-medium text-stone-800 text-sm">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-ma-red shrink-0" /> : <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />}
      </button>
      {open && <p className="text-stone-500 text-sm pb-4 leading-relaxed">{a}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Partner() {
  const { t, i18n } = useTranslation();
  const optionLabel = (group: string, index: number, fallback: string) =>
    t(`partner.options.${group}.item${index}`, { defaultValue: fallback });
  const regionNames = new Intl.DisplayNames([i18n.resolvedLanguage || i18n.language], { type: 'region' });
  const countryLabel = (index: number, fallback: string) => COUNTRY_CODES[index]
    ? regionNames.of(COUNTRY_CODES[index]!) || fallback : t('partner.other');
  const marketLabel = (index: number, fallback: string) => TARGET_MARKET_CODES[index]
    ? regionNames.of(TARGET_MARKET_CODES[index]!) || fallback : t('partner.other');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Identité producteur
  const [producer, setProducer] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    country: 'Maroc',
    city: '',
    website: '',
  });

  // Step 2 — Produit
  const [product, setProduct] = useState({
    product_name: '',
    product_category: '',
    product_description: '',
    annual_capacity: '',
    certifications: [] as string[],
    packaging_types: '',
  });

  // Step 3 — Export & message
  const [xp, setXp] = useState({
    already_exporting: false,
    current_markets: [] as string[],
    target_markets: [] as string[],
    message: '',
  });

  const canProceed = () => {
    if (step === 1) return !!(producer.company_name && producer.contact_name && producer.email && producer.country);
    if (step === 2) return !!(product.product_name && product.product_category);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const payload = {
      ...producer,
      ...product,
      already_exporting: xp.already_exporting,
      current_markets: xp.current_markets.join(', '),
      target_markets: xp.target_markets.join(', '),
      message: xp.message,
    };

    const { error: err } = await supabase.from('collaboration_requests').insert([payload]);
    if (err) {
      console.error(err);
      setError(t('partner.submitError'));
      setSubmitting(false);
    } else {
      setSubmitted(true);
    }
  };

  // ── Success ────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-ma-cream flex items-center justify-center px-4 pt-16">
        <div className="bg-white rounded-3xl shadow-lg p-5 sm:p-10 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Handshake className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">{t('partner.successTitle')}</h2>
          <p className="text-stone-500 text-sm leading-relaxed mb-6">
            {t('partner.successBefore')} <strong>{producer.contact_name}</strong>{t('partner.successMiddle')}
            <strong>{producer.email}</strong>{t('partner.successAfter')}
          </p>
          <div className="bg-red-50 rounded-2xl p-4 text-left space-y-2 mb-6 text-xs text-stone-600">
            <p><span className="font-semibold">{t('partner.company')} :</span> {producer.company_name}</p>
            <p><span className="font-semibold">{t('partner.product')} :</span> {product.product_name} ({product.product_category})</p>
            {xp.target_markets.length > 0 && <p><span className="font-semibold">{t('partner.targetMarkets')} :</span> {xp.target_markets.join(', ')}</p>}
          </div>
          <div className="flex gap-3">
            <Link to="/" className="flex-1 border border-stone-200 text-stone-600 text-sm py-3 rounded-xl hover:bg-stone-50 font-medium">
              {t('partner.home')}
            </Link>
            <Link to="/catalog" className="flex-1 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold py-3 rounded-xl">
              {t('partner.viewCatalog')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const STEPS = [
    { id: 1, label: t('partner.steps.company') },
    { id: 2, label: t('partner.steps.product') },
    { id: 3, label: t('partner.steps.export') },
  ];

  return (
    <div className="min-h-screen bg-ma-cream">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-b from-ma-navy to-[#0A1833] pt-24 pb-16 px-4 overflow-hidden">
        <div className="relative max-w-3xl mx-auto text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('partner.back')}
          </Link>
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px w-10 bg-ma-red/50" />
            <Handshake className="w-5 h-5 text-ma-red" />
            <div className="h-px w-10 bg-ma-red/50" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {t('partner.title')}
          </h1>
          <p className="text-stone-300 text-base max-w-xl mx-auto leading-relaxed">
            {t('partner.subtitle')}
          </p>
        </div>
      </div>

      {/* ── Benefits band ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-stone-100">
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {BENEFITS.map(b => (
            <div key={b.titleKey} className="flex items-start gap-3">
              <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <b.icon className="w-4 h-4 text-ma-red" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">{t(`partner.${b.titleKey}`)}</p>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{t(`partner.${b.descKey}`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* ── Step progress ─────────────────────────────────────────────── */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    done ? 'bg-ma-green text-white' : active ? 'bg-ma-red text-white' : 'bg-stone-200 text-stone-400'
                  }`}>
                    {done ? <CheckCircle className="w-4 h-4" /> : s.id}
                  </div>
                  <span className={`text-[10px] sm:text-xs mt-1 font-medium text-center hidden sm:block ${active ? 'text-ma-red' : done ? 'text-ma-green' : 'text-stone-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 ${done ? 'bg-ma-green' : 'bg-stone-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Form ─────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4 sm:p-8 space-y-5">

            {/* ══ STEP 1 — PRODUCTEUR ══ */}
            {step === 1 && (
              <>
                <h2 className="text-base font-bold text-stone-800 pb-3 border-b border-stone-100 flex items-center gap-2">
                  <Factory className="w-4 h-4 text-ma-red" /> {t('partner.companySection')}
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label={t('partner.company')} required>
                    <input type="text" required value={producer.company_name}
                      onChange={e => setProducer(p => ({ ...p, company_name: e.target.value }))}
                      placeholder="Coopérative Exemple" className={INPUT} />
                  </Field>
                  <Field label={t('partner.contactName')} required>
                    <input type="text" required value={producer.contact_name}
                      onChange={e => setProducer(p => ({ ...p, contact_name: e.target.value }))}
                      placeholder="Mohamed Alami" className={INPUT} />
                  </Field>
                  <Field label={t('partner.email')} required>
                    <input type="email" required value={producer.email}
                      onChange={e => setProducer(p => ({ ...p, email: e.target.value }))}
                      placeholder="contact@exemple.ma" className={INPUT} />
                  </Field>
                  <Field label={t('partner.phone')}>
                    <input type="tel" value={producer.phone}
                      onChange={e => setProducer(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+212 6 00 00 00 00" className={INPUT} />
                  </Field>
                  <Field label={t('partner.country')} required>
                    <select required value={producer.country}
                      onChange={e => setProducer(p => ({ ...p, country: e.target.value }))}
                      className={SELECT}>
                      {COUNTRIES.map((c, i) => <option key={c} value={c}>{countryLabel(i, c)}</option>)}
                    </select>
                  </Field>
                  <Field label={t('partner.city')}>
                    <input type="text" value={producer.city}
                      onChange={e => setProducer(p => ({ ...p, city: e.target.value }))}
                      placeholder={t('partner.cityPlaceholder')} className={INPUT} />
                  </Field>
                </div>
                <Field label={t('partner.website')}>
                  <input type="url" value={producer.website}
                    onChange={e => setProducer(p => ({ ...p, website: e.target.value }))}
                    placeholder="https://www.monentreprise.ma" className={INPUT} />
                </Field>
              </>
            )}

            {/* ══ STEP 2 — PRODUIT ══ */}
            {step === 2 && (
              <>
                <h2 className="text-base font-bold text-stone-800 pb-3 border-b border-stone-100 flex items-center gap-2">
                  <Package className="w-4 h-4 text-ma-red" /> {t('partner.productSection')}
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label={t('partner.productName')} required>
                    <input type="text" required value={product.product_name}
                      onChange={e => setProduct(p => ({ ...p, product_name: e.target.value }))}
                      placeholder={t('partner.productNamePlaceholder')} className={INPUT} />
                  </Field>
                  <Field label={t('partner.category')} required>
                    <select required value={product.product_category}
                      onChange={e => setProduct(p => ({ ...p, product_category: e.target.value }))}
                      className={SELECT}>
                      <option value="">{t('partner.select')}</option>
                      {CATEGORIES.map((c, i) => <option key={c} value={c}>{optionLabel('categories', i, c)}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label={t('partner.productDescription')}>
                  <textarea rows={3} value={product.product_description}
                    onChange={e => setProduct(p => ({ ...p, product_description: e.target.value }))}
                    placeholder={t('partner.productDescriptionPlaceholder')}
                    className={`${INPUT} resize-none`} />
                </Field>
                <Field label={t('partner.annualCapacity')}>
                  <input type="text" value={product.annual_capacity}
                    onChange={e => setProduct(p => ({ ...p, annual_capacity: e.target.value }))}
                    placeholder={t('partner.annualCapacityPlaceholder')} className={INPUT} />
                </Field>
                <Field label={t('partner.availableCertifications')}>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {CERTIFICATIONS.map((c, i) => (
                      <CheckPill key={c} label={optionLabel('certifications', i, c)}
                        checked={product.certifications.includes(c)}
                        onChange={() => setProduct(p => ({
                          ...p,
                          certifications: p.certifications.includes(c)
                            ? p.certifications.filter(x => x !== c)
                            : [...p.certifications, c],
                        }))} />
                    ))}
                  </div>
                </Field>
                <Field label={t('partner.availablePackaging')}>
                  <input type="text" value={product.packaging_types}
                    onChange={e => setProduct(p => ({ ...p, packaging_types: e.target.value }))}
                    placeholder={t('partner.packagingPlaceholder')} className={INPUT} />
                </Field>
              </>
            )}

            {/* ══ STEP 3 — EXPORT & MESSAGE ══ */}
            {step === 3 && (
              <>
                <h2 className="text-base font-bold text-stone-800 pb-3 border-b border-stone-100 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-ma-red" /> {t('partner.exportExperience')}
                </h2>

                <label className="flex items-start gap-3 cursor-pointer p-3 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">
                  <input type="checkbox" checked={xp.already_exporting}
                    onChange={e => setXp(x => ({ ...x, already_exporting: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border-stone-300 text-ma-red" />
                  <div>
                    <p className="text-sm font-semibold text-stone-800">{t('partner.alreadyExporting')}</p>
                    <p className="text-xs text-stone-400">{t('partner.alreadyExportingDescription')}</p>
                  </div>
                </label>

                {xp.already_exporting && (
                  <Field label={t('partner.currentMarkets')}>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {TARGET_MARKETS.map((m, i) => (
                        <CheckPill key={m} label={marketLabel(i, m)}
                          checked={xp.current_markets.includes(m)}
                          onChange={() => setXp(x => ({
                            ...x,
                            current_markets: x.current_markets.includes(m)
                              ? x.current_markets.filter(v => v !== m)
                              : [...x.current_markets, m],
                          }))} />
                      ))}
                    </div>
                  </Field>
                )}

                <Field label={t('partner.targetMarkets')}>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {TARGET_MARKETS.map((m, i) => (
                      <CheckPill key={m} label={marketLabel(i, m)}
                        checked={xp.target_markets.includes(m)}
                        onChange={() => setXp(x => ({
                          ...x,
                          target_markets: x.target_markets.includes(m)
                            ? x.target_markets.filter(v => v !== m)
                            : [...x.target_markets, m],
                        }))} />
                    ))}
                  </div>
                </Field>

                <Field label={t('partner.additionalMessage')}>
                  <textarea rows={4} value={xp.message}
                    onChange={e => setXp(x => ({ ...x, message: e.target.value }))}
                    placeholder={t('partner.additionalMessagePlaceholder')}
                    className={`${INPUT} resize-none`} />
                </Field>

                {/* Recap */}
                <div className="bg-red-50 rounded-xl p-4 text-xs space-y-1 text-stone-600">
                  <p className="font-semibold text-stone-700 mb-2">{t('partner.preSubmitSummary')}</p>
                  <p><span className="font-medium">{t('partner.company')} :</span> {producer.company_name} — {producer.city || producer.country}</p>
                  <p><span className="font-medium">{t('partner.product')} :</span> {product.product_name} ({product.product_category})</p>
                  {product.certifications.length > 0 && <p><span className="font-medium">{t('partner.certifications')} :</span> {product.certifications.join(' · ')}</p>}
                  {xp.target_markets.length > 0 && <p><span className="font-medium">{t('partner.targetMarkets')} :</span> {xp.target_markets.join(', ')}</p>}
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-5">
            {step > 1 && (
              <button type="button" onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
                className="flex items-center gap-2 border border-stone-200 text-stone-600 text-sm font-medium px-5 py-3 rounded-xl hover:bg-white bg-stone-50 transition-colors">
                <ArrowLeft className="w-4 h-4" /> {t('partner.previous')}
              </button>
            )}
            {step < 3 ? (
              <button type="button"
                onClick={() => {
                  setError('');
                  if (canProceed()) setStep(s => (s + 1) as 2 | 3);
                  else setError(t('partner.requiredFieldsError'));
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-ma-red hover:bg-[#9B1E24] text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                {t('partner.next')} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-ma-red hover:bg-[#9B1E24] disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('partner.sending')}</>
                  : <><Send className="w-4 h-4" /> {t('partner.submit')}</>}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-stone-400 mt-4">
            {t('partner.questions')} <a href="mailto:filalianas0001@gmail.com" className="text-ma-red hover:underline">filalianas0001@gmail.com</a>
            {' · '}
            <a href="tel:+212605268946" className="text-ma-red hover:underline">+212 605 268 946</a>
          </p>
        </form>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <div className="mt-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-stone-200" />
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">{t('partner.faqTitle')}</h3>
            <div className="h-px flex-1 bg-stone-200" />
          </div>
          <div className="bg-white rounded-2xl border border-stone-100 px-6 divide-y divide-stone-100">
            {FAQS.map(f => <FAQ key={f.qKey} q={t(`partner.${f.qKey}`)} a={t(`partner.${f.aKey}`)} />)}
          </div>
        </div>

        {/* ── Social proof mini ─────────────────────────────────────────── */}
        <div className="mt-12 bg-ma-navy rounded-2xl p-8 text-center">
          <div className="flex justify-center gap-6 mb-4">
            {[Leaf, Package, Globe].map((Icon, i) => (
              <div key={i} className="w-10 h-10 bg-ma-red/20 rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5 text-ma-red" />
              </div>
            ))}
          </div>
          <p className="text-white font-semibold mb-1">{t('partner.socialProofTitle')}</p>
          <p className="text-stone-400 text-sm">{t('partner.socialProofDescription')}</p>
        </div>
      </div>
    </div>
  );
}
