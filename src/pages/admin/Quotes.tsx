import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, Trash2, Eye, X, Mail, Phone, MapPin, Package,
  Building2, FileText, Settings2, CheckCircle, Anchor, CreditCard,
  Container, Calendar, RefreshCw, Tag, Layers, Send, Download, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { QuoteRequest, QuoteStatus } from '../../types';
import ResponseModal from '../../components/admin/ResponseModal';

const STATUS_OPTIONS: QuoteStatus[] = ['new', 'in_review', 'responded', 'closed'];

const STATUS_LABELS: Record<QuoteStatus, string> = {
  new: 'Nouveau',
  in_review: 'En cours',
  responded: 'Répondu',
  closed: 'Clôturé',
};

const STATUS_COLORS: Record<QuoteStatus, string> = {
  new: 'bg-red-100 text-red-700 border-red-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  responded: 'bg-blue-100 text-blue-700 border-blue-200',
  closed: 'bg-stone-100 text-stone-600 border-stone-200',
};

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      <div className="bg-stone-50 rounded-xl p-3.5 space-y-1.5 text-sm text-stone-700">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | boolean | null }) {
  if (value === undefined || value === null || value === '' || value === false) return null;
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 shrink-0 w-36">{label} :</span>
      <span className="font-medium">{value === true ? 'Oui' : String(value)}</span>
    </div>
  );
}

export default function Quotes() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');
  const [selected, setSelected] = useState<QuoteRequest | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [responding, setResponding] = useState<QuoteRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data } = await supabase
        .from('quote_requests')
        .select('*')
        .order('created_at', { ascending: false });
      setQuotes(data || []);
      setLoading(false);
    } catch {
      setError(t('admin.pages.quotes.loadError'));
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = quotes.filter(q => {
    const matchSearch = !search || [q.company_name, q.contact_name, q.email, q.country]
      .some(f => f?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !filterStatus || q.status === filterStatus;
    const created = new Date(q.created_at);
    const matchFrom = !dateFrom || created >= new Date(dateFrom);
    const matchTo   = !dateTo   || created <= new Date(dateTo + 'T23:59:59');
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const daysSince = (iso: string) =>
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

  const exportCSV = () => {
    const headers = ['Société', 'Contact', 'Email', 'Pays', 'Statut', 'Produits', 'Incoterm', 'Devise', 'Date'];
    const rows = filtered.map(q => [
      q.company_name, q.contact_name, q.email, q.country ?? '',
      STATUS_LABELS[q.status], (q.products_interested ?? '').replace(/\n/g, ' '),
      q.incoterm ?? '', q.currency ?? '',
      new Date(q.created_at).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `devis_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const updateStatus = async (id: string, status: QuoteStatus) => {
    setUpdatingStatus(id);
    await supabase.from('quote_requests').update({ status }).eq('id', id);
    setUpdatingStatus(null);
    load();
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.pages.quotes.confirmDelete'))) return;
    setDeleting(id);
    await supabase.from('quote_requests').delete().eq('id', id);
    setDeleting(null);
    if (selected?.id === id) setSelected(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{t('admin.pages.quotes.title')}</h1>
          <p className="text-stone-500 text-sm mt-1">{quotes.length} · {filtered.length}</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Download className="w-4 h-4" /> {t('admin.pages.quotes.exportCsv')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => { setError(null); load(); }}
            className="text-xs font-semibold underline hover:no-underline whitespace-nowrap">Réessayer</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Rechercher société, contact, e-mail, pays…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 bg-white" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white">
          <option value="">Tous les statuts</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          title="Date de début"
          className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white text-stone-600" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          title="Date de fin"
          className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white text-stone-600" />
        {(search || filterStatus || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-stone-400 hover:text-stone-600 px-3 py-2.5 border border-stone-200 rounded-xl bg-white transition-colors">
            {t('admin.common.reset')}
          </button>
        )}
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {STATUS_OPTIONS.map(s => {
          const count = quotes.filter(q => q.status === s).length;
          return (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-medium text-center transition-all ${
                filterStatus === s ? STATUS_COLORS[s] : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
              }`}>
              <div className="text-xl font-bold mb-0.5">{count}</div>
              {STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl animate-pulse border border-stone-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 text-center py-16 text-stone-400 text-sm">
          {t('admin.pages.quotes.noResults')}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 divide-y divide-stone-50">
          {filtered.map(q => (
            <div key={q.id} className="flex items-start gap-4 p-4 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-stone-800 text-sm">{q.company_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[q.status]}`}>
                    {STATUS_LABELS[q.status]}
                  </span>
                  {q.incoterm && (
                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-mono font-semibold">
                      {q.incoterm}
                    </span>
                  )}
                  {q.private_label && (
                    <span className="text-xs bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full font-medium">
                      Private label
                    </span>
                  )}
                  {q.sample_request && (
                    <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">
                      Échantillons
                    </span>
                  )}
                </div>
                <div className="text-stone-500 text-xs mt-1">
                  {q.contact_name} · {q.email}
                  {q.country && ` · ${q.country}`}
                  {q.currency && ` · ${q.currency}`}
                </div>
                <div className="text-stone-400 text-xs mt-0.5 truncate max-w-sm">
                  {q.products_interested?.split('\n')[0]}
                  {(q.products_interested?.split('\n').length ?? 0) > 1
                    ? ` +${(q.products_interested?.split('\n').length ?? 1) - 1} autre(s)` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {q.status === 'new' && daysSince(q.created_at) >= 3 && (
                  <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                    <AlertCircle className="w-3 h-3" /> {daysSince(q.created_at)}j
                  </span>
                )}
                <span className="text-stone-400 text-xs hidden sm:block whitespace-nowrap">
                  {new Date(q.created_at).toLocaleDateString('fr-FR')}
                </span>
                <button onClick={() => setSelected(q)}
                  className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(q.id)} disabled={deleting === q.id}
                  className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Response modal ────────────────────────────────────────────────────── */}
      {responding && (
        <ResponseModal quote={responding} onClose={() => setResponding(null)} />
      )}

      {/* ── Detail modal ───────────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-stone-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="font-bold text-stone-800 text-base">{selected.company_name}</h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Reçu le {new Date(selected.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-stone-400 hover:text-stone-600 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">

              {/* Status management */}
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Statut</p>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)}
                      disabled={updatingStatus === selected.id}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                        selected.status === s ? STATUS_COLORS[s] : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                      }`}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buyer identity */}
              <Section icon={Building2} title="Identité acheteur">
                <Row label="Société" value={selected.company_name} />
                <Row label="N° TVA / SIRET" value={selected.buyer_vat_number} />
                <Row label="Contact" value={selected.contact_name} />
                <div className="flex gap-2">
                  <span className="text-stone-400 shrink-0 w-36">E-mail :</span>
                  <a href={`mailto:${selected.email}`} className="font-medium text-amber-600 hover:underline flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {selected.email}
                  </a>
                </div>
                {selected.phone && (
                  <div className="flex gap-2">
                    <span className="text-stone-400 shrink-0 w-36">Téléphone :</span>
                    <a href={`tel:${selected.phone}`} className="font-medium text-amber-600 hover:underline flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {selected.phone}
                    </a>
                  </div>
                )}
                <Row label="Pays" value={selected.country} />
              </Section>

              {/* Addresses */}
              {(selected.buyer_address || selected.buyer_city || selected.delivery_address) && (
                <Section icon={MapPin} title="Adresses">
                  {(selected.buyer_address || selected.buyer_city || selected.buyer_postal_code) && (
                    <div>
                      <p className="text-xs text-stone-400 mb-0.5">Facturation</p>
                      <p className="font-medium">
                        {[selected.buyer_address, selected.buyer_postal_code, selected.buyer_city, selected.country]
                          .filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                  {selected.delivery_address && (
                    <div>
                      <p className="text-xs text-stone-400 mb-0.5">Livraison</p>
                      <p className="font-medium">{selected.delivery_address}</p>
                      {selected.delivery_country && <p className="text-xs text-stone-500">{selected.delivery_country}</p>}
                    </div>
                  )}
                </Section>
              )}

              {/* Products */}
              <Section icon={Package} title="Produits demandés">
                <div className="whitespace-pre-line">{selected.products_interested}</div>
                {selected.quantity_notes && (
                  <div className="pt-2 border-t border-stone-200 mt-2">
                    <p className="text-xs text-stone-400 mb-0.5">Quantités</p>
                    <p className="font-medium">{selected.quantity_notes}</p>
                  </div>
                )}
              </Section>

              {/* Commercial terms */}
              {(selected.incoterm || selected.payment_terms || selected.currency || selected.port_loading || selected.port_destination || selected.container_type || selected.delivery_date || selected.order_frequency) && (
                <Section icon={FileText} title="Conditions commerciales">
                  {selected.incoterm && (
                    <div className="flex gap-2 items-center">
                      <span className="text-stone-400 shrink-0 w-36">Incoterm :</span>
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg text-xs">{selected.incoterm}</span>
                    </div>
                  )}
                  <Row label="Devise" value={selected.currency} />
                  <Row label="Port chargement" value={selected.port_loading} />
                  <Row label="Port destination" value={selected.port_destination} />
                  <Row label="Conditions paiement" value={selected.payment_terms} />
                  <Row label="Transport" value={selected.container_type} />
                  <Row label="Livraison souhaitée" value={selected.delivery_date
                    ? new Date(selected.delivery_date).toLocaleDateString('fr-FR')
                    : undefined} />
                  {selected.order_frequency && (
                    <div className="flex gap-2 items-center">
                      <span className="text-stone-400 shrink-0 w-36 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Fréquence :
                      </span>
                      <span className="font-medium">{selected.order_frequency}</span>
                    </div>
                  )}
                </Section>
              )}

              {/* Requirements */}
              {(selected.required_certifications?.length || selected.labeling_requirements || selected.private_label || selected.sample_request) && (
                <Section icon={Settings2} title="Exigences spécifiques">
                  {(selected.required_certifications ?? []).length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-stone-400 shrink-0 w-36">Certifications :</span>
                      <div className="flex flex-wrap gap-1">
                        {(selected.required_certifications ?? []).map(c => (
                          <span key={c} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">
                            <CheckCircle className="w-3 h-3 inline mr-0.5" />{c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Row label="Étiquetage" value={selected.labeling_requirements} />
                  <Row label="Private label" value={selected.private_label} />
                  <Row label="Échantillons" value={selected.sample_request} />
                </Section>
              )}

              {/* Notes */}
              {selected.message && (
                <Section icon={Layers} title="Notes complémentaires">
                  <p className="whitespace-pre-wrap">{selected.message}</p>
                </Section>
              )}

              {/* Flag chips */}
              <div className="flex flex-wrap gap-2">
                {selected.incoterm && (
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full font-semibold">
                    <Anchor className="w-3 h-3" /> {selected.incoterm}
                  </span>
                )}
                {selected.currency && (
                  <span className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-semibold">
                    <CreditCard className="w-3 h-3" /> {selected.currency}
                  </span>
                )}
                {selected.container_type && (
                  <span className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
                    <Container className="w-3 h-3" /> {selected.container_type}
                  </span>
                )}
                {selected.delivery_date && (
                  <span className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
                    <Calendar className="w-3 h-3" /> {new Date(selected.delivery_date).toLocaleDateString('fr-FR')}
                  </span>
                )}
                {selected.private_label && (
                  <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-full font-medium">
                    <Tag className="w-3 h-3" /> Private label
                  </span>
                )}
                {selected.sample_request && (
                  <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">
                    <Package className="w-3 h-3" /> Échantillons
                  </span>
                )}
              </div>

              {/* Reply CTA */}
              <button
                onClick={() => { setResponding(selected); }}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold py-3 rounded-xl w-full transition-colors">
                <Send className="w-4 h-4" />
                Préparer & Envoyer la réponse
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
