import { useState } from 'react';
import {
  X, Mail, MessageCircle, FileDown, Send, Edit3,
  CheckCircle, Loader2, Copy, Check,
} from 'lucide-react';
import type { QuoteRequest } from '../../types';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

interface Props {
  quote: QuoteRequest;
  onClose: () => void;
}

// ─── Template builders ────────────────────────────────────────────────────────

function buildEmailBody(q: QuoteRequest, t: TFunction, locale: string): string {
  const productList = (q.products_interested || '')
    .split('\n')
    .filter(Boolean)
    .map(l => `  • ${l}`)
    .join('\n');

  const terms = [
    q.incoterm && `Incoterm : ${q.incoterm}`,
    q.payment_terms && `${t('admin.pages.quotes.response.paymentTerms')} : ${q.payment_terms}`,
    q.currency && `${t('admin.pages.quotes.response.currency')} : ${q.currency}`,
    q.port_loading && `${t('admin.pages.quotes.response.loadingPort')} : ${q.port_loading}`,
    q.port_destination && `${t('admin.pages.quotes.response.destinationPort')} : ${q.port_destination}`,
    q.container_type && `${t('admin.pages.quotes.response.transport')} : ${q.container_type}`,
    q.delivery_date && `${t('admin.pages.quotes.response.requestedDelivery')} : ${new Date(q.delivery_date).toLocaleDateString(locale)}`,
  ].filter(Boolean).join('\n');
  return t('admin.pages.quotes.response.emailTemplate', {
    company: q.company_name, contact: q.contact_name,
    products: productList || t('admin.pages.quotes.response.seeAttachment'),
    terms: terms || t('admin.pages.quotes.response.termsToDefine'),
  });
}

function buildWhatsAppMessage(q: QuoteRequest, t: TFunction): string {
  const productList = (q.products_interested || '')
    .split('\n')
    .filter(Boolean)
    .map(l => `• ${l}`)
    .join('\n');

  return t('admin.pages.quotes.response.whatsappTemplate', {
    contact: q.contact_name, company: q.company_name,
    products: productList || t('admin.pages.quotes.response.seeProforma'),
    incoterm: q.incoterm ? `*📦 Incoterm :* ${q.incoterm}` : '',
    payment: q.payment_terms ? `*💳 ${t('admin.pages.quotes.response.payment')} :* ${q.payment_terms}` : '',
    currency: q.currency ? `*💱 ${t('admin.pages.quotes.response.currency')} :* ${q.currency}` : '',
    destination: q.port_destination ? `*🚢 ${t('admin.pages.quotes.response.destination')} :* ${q.port_destination}` : '',
    email: q.email,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const TA = 'w-full border border-stone-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition bg-white resize-none leading-relaxed';

export default function ResponseModal({ quote, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const [tab, setTab] = useState<'email' | 'whatsapp'>('email');
  const [emailSubject, setEmailSubject] = useState(t('admin.pages.quotes.response.emailSubject', { company: quote.company_name }));
  const [emailBody, setEmailBody] = useState(() => buildEmailBody(quote, t, locale));
  const [waMessage, setWaMessage] = useState(() => buildWhatsAppMessage(quote, t));
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (generating) return; // évite un double export lors de clics répétés
    setGenerating(true);
    try {
      // Import dynamique : la lib docx (lourde) n'est chargée qu'au déclenchement
      // réel de l'export, jamais dans le bundle initial.
      const { generateProforma } = await import('../../lib/generateProforma');
      await generateProforma(quote);
    } catch (e) {
      console.error('Erreur génération proforma:', e);
      alert(t('admin.pages.quotes.response.generationError'));
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = () => {
    const body = encodeURIComponent(emailBody);
    const subject = encodeURIComponent(emailSubject);
    window.open(`mailto:${quote.email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleWhatsApp = () => {
    const phone = (quote.phone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(waMessage);
    if (!phone) {
      alert(t('admin.pages.quotes.response.noPhone'));
      return;
    }
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    if (tab === 'email') setEmailBody(buildEmailBody(quote, t, locale));
    else setWaMessage(buildWhatsAppMessage(quote, t));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
          <div>
            <h2 className="font-bold text-stone-800">{t('admin.pages.quotes.response.title')}</h2>
            <p className="text-xs text-stone-400 mt-0.5">{quote.company_name} — {quote.contact_name}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Generate proforma banner */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center justify-between gap-4 shrink-0">
          <div>
            <p className="text-sm font-semibold text-amber-800">{t('admin.pages.quotes.response.stepGenerate')}</p>
            <p className="text-xs text-amber-600">{t('admin.pages.quotes.response.generateHelp')}</p>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shrink-0">
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('admin.pages.quotes.response.generating')}</>
              : <><FileDown className="w-4 h-4" /> {t('admin.pages.quotes.response.downloadDocx')}</>
            }
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 px-6 pt-4 pb-2 shrink-0">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider self-center mr-2">{t('admin.pages.quotes.response.stepSend')}</p>
          <button
            onClick={() => setTab('email')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'email' ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-500 hover:text-stone-700'}`}>
            <Mail className="w-4 h-4" /> E-mail
          </button>
          <button
            onClick={() => setTab('whatsapp')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'whatsapp' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-500 hover:text-stone-700'}`}>
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button onClick={handleReset} title={t('admin.pages.quotes.response.resetMessage')}
            className="ml-auto flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors">
            <Edit3 className="w-3.5 h-3.5" /> {t('admin.common.reset')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">

          {tab === 'email' && (
            <>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">{t('admin.pages.quotes.response.subject')}</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition bg-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-stone-500">{t('admin.pages.quotes.response.emailBody')}</label>
                  <button onClick={() => handleCopy(emailBody)}
                    className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors">
                    {copied ? <><Check className="w-3 h-3 text-emerald-500" /> {t('admin.pages.quotes.response.copied')}</> : <><Copy className="w-3 h-3" /> {t('admin.pages.quotes.response.copy')}</>}
                  </button>
                </div>
                <textarea rows={18} value={emailBody} onChange={e => setEmailBody(e.target.value)} className={TA} />
              </div>
              <div className="text-xs text-stone-400 bg-stone-50 rounded-xl p-3">
                <span className="font-semibold text-stone-600">{t('admin.pages.quotes.response.note')} :</span> {t('admin.pages.quotes.response.attachmentNote')}
              </div>
            </>
          )}

          {tab === 'whatsapp' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-stone-500">Message WhatsApp</label>
                  <button onClick={() => handleCopy(waMessage)}
                    className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors">
                    {copied ? <><Check className="w-3 h-3 text-emerald-500" /> {t('admin.pages.quotes.response.copied')}</> : <><Copy className="w-3 h-3" /> {t('admin.pages.quotes.response.copy')}</>}
                  </button>
                </div>
                <textarea rows={18} value={waMessage} onChange={e => setWaMessage(e.target.value)} className={TA} />
              </div>
              {quote.phone ? (
                <div className="text-xs text-stone-400 bg-emerald-50 rounded-xl p-3">
                  <span className="font-semibold text-emerald-700">{t('admin.pages.quotes.response.phoneNumber')} :</span> {quote.phone} — {t('admin.pages.quotes.response.whatsappHelp')}
                </div>
              ) : (
                <div className="text-xs text-red-500 bg-red-50 rounded-xl p-3">
                  {t('admin.pages.quotes.response.noPhone')}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-stone-100 shrink-0 bg-white">
          <button onClick={onClose}
            className="flex-1 border border-stone-200 text-stone-600 text-sm font-medium py-3 rounded-xl hover:bg-stone-50 transition-colors">
            {t('admin.common.close')}
          </button>

          {tab === 'email' ? (
            <button onClick={handleSendEmail}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
              <Send className="w-4 h-4" />
              {t('admin.pages.quotes.response.openEmail')}
            </button>
          ) : (
            <button onClick={handleWhatsApp} disabled={!quote.phone}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
              <MessageCircle className="w-4 h-4" />
              {t('admin.pages.quotes.response.sendWhatsapp')}
            </button>
          )}

          {tab === 'email' && (
            <button onClick={() => { handleGenerate(); handleSendEmail(); }}
              disabled={generating}
              title={t('admin.pages.quotes.response.downloadAndOpen')}
              className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-colors">
              <CheckCircle className="w-4 h-4" />
              {t('admin.pages.quotes.response.sendAll')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
