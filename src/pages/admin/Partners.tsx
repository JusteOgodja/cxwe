import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Trash2, Eye, X, Mail, Phone, MapPin,
  Package, Globe, Award, Handshake, Factory, CheckCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type PartnerStatus = 'new' | 'contacted' | 'en_discussion' | 'partenaire' | 'refusé';

interface CollabRequest {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  country: string;
  city?: string;
  website?: string;
  product_name: string;
  product_category?: string;
  product_description?: string;
  annual_capacity?: string;
  certifications?: string[];
  packaging_types?: string;
  already_exporting?: boolean;
  current_markets?: string;
  target_markets?: string;
  message?: string;
  status: PartnerStatus;
  created_at: string;
}

const STATUS_OPTIONS: PartnerStatus[] = ['new', 'contacted', 'en_discussion', 'partenaire', 'refusé'];

const STATUS_COLORS: Record<PartnerStatus, string> = {
  new:           'bg-red-100 text-red-700 border-red-200',
  contacted:     'bg-amber-100 text-amber-700 border-amber-200',
  en_discussion: 'bg-blue-100 text-blue-700 border-blue-200',
  partenaire:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  'refusé':      'bg-stone-100 text-stone-500 border-stone-200',
};

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      <div className="bg-stone-50 rounded-xl p-3.5 space-y-1.5 text-sm text-stone-700">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | boolean | null }) {
  const { t } = useTranslation();
  if (!value && value !== false) return null;
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 shrink-0 w-32">{label} :</span>
      <span className="font-medium">{value === true ? t('admin.common.yes') : value === false ? t('admin.common.no') : value}</span>
    </div>
  );
}

export default function Partners() {
  const { t } = useTranslation();
  const statusLabel = (status: PartnerStatus) => t(`admin.pages.partners.status.${status}`);
  const [requests, setRequests] = useState<CollabRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<CollabRequest | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('collaboration_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = requests.filter(r => {
    const matchSearch = !search || [r.company_name, r.contact_name, r.email, r.product_name, r.country]
      .some(f => f?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (id: string, status: PartnerStatus) => {
    setUpdating(id);
    await supabase.from('collaboration_requests').update({ status }).eq('id', id);
    setUpdating(null);
    load();
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.pages.partners.confirmDelete'))) return;
    setDeleting(id);
    await supabase.from('collaboration_requests').delete().eq('id', id);
    setDeleting(null);
    if (selected?.id === id) setSelected(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{t('admin.pages.partners.title')}</h1>
          <p className="text-stone-500 text-sm mt-1">{t('admin.pages.partners.count', { count: requests.length })}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="text" placeholder={t('admin.pages.partners.searchDetailed')}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 bg-white" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white">
          <option value="">{t('admin.pages.quotes.filterStatus')}</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {STATUS_OPTIONS.map(s => {
          const count = requests.filter(r => r.status === s).length;
          return (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              className={`rounded-xl border px-2 py-2.5 text-xs font-medium text-center transition-all ${
                filterStatus === s ? STATUS_COLORS[s] : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
              }`}>
              <div className="text-lg font-bold mb-0.5">{count}</div>
              {statusLabel(s)}
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
          {t('admin.pages.partners.noResults')}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 divide-y divide-stone-50">
          {filtered.map(r => (
            <div key={r.id} className="flex items-start gap-4 p-4 hover:bg-stone-50 transition-colors">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Handshake className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-stone-800 text-sm">{r.company_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[r.status]}`}>
                    {statusLabel(r.status)}
                  </span>
                  {r.already_exporting && (
                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                      {t('admin.pages.partners.alreadyExporter')}
                    </span>
                  )}
                </div>
                <p className="text-stone-700 text-xs mt-0.5 font-medium">{r.product_name}
                  {r.product_category && <span className="text-stone-400 font-normal"> · {r.product_category}</span>}
                </p>
                <p className="text-stone-400 text-xs mt-0.5">{r.contact_name} · {r.email} · {r.city || r.country}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-stone-400 text-xs hidden sm:block whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
                <button onClick={() => setSelected(r)}
                  className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                  className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail modal ─────────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between p-5 border-b border-stone-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="font-bold text-stone-800">{selected.company_name}</h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  {t('admin.pages.partners.receivedOn', { date: new Date(selected.created_at).toLocaleString() })}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-stone-400 hover:text-stone-600 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">

              {/* Status */}
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">{t('admin.pages.partners.applicationStatus')}</p>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)}
                      disabled={updating === selected.id}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                        selected.status === s ? STATUS_COLORS[s] : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                      }`}>
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Producer identity */}
              <Section icon={Factory} title={t('admin.pages.partners.producer')}>
                <Row label={t('admin.common.company')} value={selected.company_name} />
                <Row label={t('admin.pages.partners.contact')} value={selected.contact_name} />
                <div className="flex gap-2">
                  <span className="text-stone-400 shrink-0 w-32">E-mail :</span>
                  <a href={`mailto:${selected.email}`} className="font-medium text-amber-600 hover:underline flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {selected.email}
                  </a>
                </div>
                {selected.phone && (
                  <div className="flex gap-2">
                    <span className="text-stone-400 shrink-0 w-32">{t('admin.common.phone')} :</span>
                    <a href={`tel:${selected.phone}`} className="font-medium text-amber-600 hover:underline flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {selected.phone}
                    </a>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <span className="text-stone-400 shrink-0 w-32 flex items-center gap-1"><MapPin className="w-3 h-3" /> {t('admin.pages.partners.location')} :</span>
                  <span className="font-medium">{[selected.city, selected.country].filter(Boolean).join(', ')}</span>
                </div>
                {selected.website && (
                  <div className="flex gap-2">
                    <span className="text-stone-400 shrink-0 w-32">{t('admin.pages.partners.website')} :</span>
                    <a href={selected.website} target="_blank" rel="noopener noreferrer" className="font-medium text-amber-600 hover:underline truncate">
                      {selected.website}
                    </a>
                  </div>
                )}
              </Section>

              {/* Product */}
              <Section icon={Package} title={t('admin.pages.partners.proposedProduct')}>
                <Row label={t('admin.pages.partners.product')} value={selected.product_name} />
                <Row label={t('admin.pages.partners.category')} value={selected.product_category} />
                <Row label={t('admin.pages.partners.capacity')} value={selected.annual_capacity} />
                <Row label={t('admin.pages.partners.packaging')} value={selected.packaging_types} />
                {selected.product_description && (
                  <div>
                    <p className="text-stone-400 text-xs mb-0.5">{t('admin.common.description')}</p>
                    <p className="font-medium">{selected.product_description}</p>
                  </div>
                )}
                {(selected.certifications ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(selected.certifications ?? []).map(c => (
                      <span key={c} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3" /> {c}
                      </span>
                    ))}
                  </div>
                )}
              </Section>

              {/* Export profile */}
              <Section icon={Globe} title={t('admin.pages.partners.exportProfile')}>
                <Row label={t('admin.pages.partners.alreadyExporter')} value={selected.already_exporting} />
                {selected.current_markets && <Row label={t('admin.pages.partners.currentMarkets')} value={selected.current_markets} />}
                {selected.target_markets && <Row label={t('admin.pages.partners.targetMarkets')} value={selected.target_markets} />}
              </Section>

              {selected.message && (
                <Section icon={Award} title="Message">
                  <p className="whitespace-pre-wrap">{selected.message}</p>
                </Section>
              )}

              {/* Reply */}
              <a href={`mailto:${selected.email}?subject=${encodeURIComponent(t('admin.pages.partners.emailSubject', { company: selected.company_name }))}&body=${encodeURIComponent(t('admin.pages.partners.emailBody', { contact: selected.contact_name, product: selected.product_name }))}`}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold py-3 rounded-xl w-full transition-colors">
                <Mail className="w-4 h-4" />
                {t('admin.pages.partners.replyProducer')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
