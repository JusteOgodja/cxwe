import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Send, Loader2, FlaskConical, Package, MapPin, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

const COUNTRIES = [
  'France','Espagne','Allemagne','Royaume-Uni','Italie','Pays-Bas','Belgique',
  'Suisse','Portugal','Pologne','États-Unis','Canada','Australie',
  'Arabie Saoudite','Émirats Arabes Unis','Qatar','Koweït','Bahreïn','Oman',
  'Sénégal',"Côte d'Ivoire",'Ghana','Nigeria','Cameroun',
  'Algérie','Tunisie','Égypte','Libye','Mauritanie','Maroc','Autre',
];

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

export default function SampleRequest() {
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    country: '',
    delivery_address: '',
    products_interested: searchParams.get('product') || '',
    quantity_notes: '',
    message: '',
  });

  useEffect(() => {
    const p = searchParams.get('product');
    if (p) setForm(f => ({ ...f, products_interested: p }));
  }, [searchParams]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const payload = {
      ...form,
      sample_request: true,
      quantity_notes: form.quantity_notes || "Demande d'échantillon",
    };

    const { error: err } = await supabase.from('quote_requests').insert([payload]);
    if (err) {
      setError(t('sample.error', { msg: err.message }));
      setSubmitting(false);
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-ma-cream flex items-center justify-center px-4 pt-16">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">{t('sample.successTitle')}</h2>
          <p className="text-stone-500 text-sm leading-relaxed mb-6">
            {t('sample.successMsg', { name: form.contact_name, email: form.email })}
          </p>
          <div className="flex gap-3">
            <Link to="/catalog" className="flex-1 border border-ma-sand text-stone-600 text-sm py-3 rounded-xl hover:bg-ma-cream transition-colors font-medium">
              {t('sample.toCatalog')}
            </Link>
            <Link to="/quote" className="flex-1 bg-ma-red hover:bg-[#9B1E24] text-white text-sm py-3 rounded-xl font-medium transition-colors text-center">
              {t('sample.toQuote')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ma-cream">
      {/* Header */}
      <div className="bg-gradient-to-b from-ma-navy to-[#0A1833] pt-24 pb-10 px-4">
        <div className="max-w-xl mx-auto">
          <Link to="/catalog" className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('sample.backToCatalog')}
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-ma-gold" />
            </div>
            <h1 className="text-2xl font-bold text-white">{t('sample.title')}</h1>
          </div>
          <p className="text-stone-400 text-sm">
            {t('sample.sub')}
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-10">
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 sm:p-8 space-y-5">

            <h2 className="text-sm font-bold text-stone-700 pb-3 border-b border-stone-100 flex items-center gap-2">
              <User className="w-4 h-4 text-ma-gold" /> {t('sample.sectionContact')}
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('sample.company')} required>
                <input type="text" required value={form.company_name} onChange={set('company_name')} placeholder="SARL Exemple" className={INPUT} />
              </Field>
              <Field label={t('sample.contactName')} required>
                <input type="text" required value={form.contact_name} onChange={set('contact_name')} placeholder="Jean Dupont" className={INPUT} />
              </Field>
              <Field label={t('sample.email')} required>
                <input type="email" required value={form.email} onChange={set('email')} placeholder="jean@societe.com" className={INPUT} />
              </Field>
              <Field label={t('sample.phone')}>
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+33 6 00 00 00 00" className={INPUT} />
              </Field>
              <Field label={t('sample.country')} required>
                <select required value={form.country} onChange={set('country')} className={SELECT}>
                  <option value="">{t('sample.selectCountry')}</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <h2 className="text-sm font-bold text-stone-700 pt-2 pb-3 border-b border-stone-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-ma-gold" /> {t('sample.sectionProduct')}
            </h2>

            <Field label={t('sample.products')} required>
              <textarea required rows={3} value={form.products_interested} onChange={set('products_interested')}
                placeholder={t('sample.productsPlaceholder')}
                className={`${INPUT} resize-none`} />
            </Field>

            <Field label={t('sample.quantity')}>
              <input type="text" value={form.quantity_notes} onChange={set('quantity_notes')}
                placeholder={t('sample.quantityPlaceholder')} className={INPUT} />
            </Field>

            <h2 className="text-sm font-bold text-stone-700 pt-2 pb-3 border-b border-stone-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-ma-gold" /> {t('sample.sectionAddress')}
            </h2>

            <Field label={t('sample.address')} required>
              <textarea required rows={3} value={form.delivery_address} onChange={set('delivery_address')}
                placeholder={t('sample.addressPlaceholder')}
                className={`${INPUT} resize-none`} />
            </Field>

            <Field label={t('sample.notes')}>
              <textarea rows={2} value={form.message} onChange={set('message')}
                placeholder={t('sample.notesPlaceholder')}
                className={`${INPUT} resize-none`} />
            </Field>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}
          </div>

          <button type="submit" disabled={submitting}
            className="w-full mt-5 flex items-center justify-center gap-2 bg-ma-navy hover:bg-[#1A3570] disabled:opacity-60 text-white text-sm font-semibold py-3.5 rounded-xl transition-colors">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('sample.sending')}</>
              : <><Send className="w-4 h-4" /> {t('sample.submit')}</>}
          </button>

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
