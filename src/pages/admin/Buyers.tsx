import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Download, Mail, Phone, Building2, Globe, Briefcase, ChevronDown, ChevronUp, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Buyer {
  id: string;
  user_id: string;
  full_name: string;
  company_name: string;
  country: string;
  phone: string | null;
  sector: string | null;
  role: string | null;
  message: string | null;
  created_at: string;
  email?: string;
}

type SortKey = 'created_at' | 'full_name' | 'company_name' | 'country';

export default function Buyers() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data } = await supabase
        .from('buyer_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setBuyers(data ?? []);
      setLoading(false);
    } catch {
      setError('Impossible de charger les acheteurs. Vérifiez votre connexion.');
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const filtered = buyers
    .filter(b => {
      const q = search.toLowerCase();
      return (
        b.full_name.toLowerCase().includes(q) ||
        b.company_name.toLowerCase().includes(q) ||
        b.country.toLowerCase().includes(q) ||
        (b.sector ?? '').toLowerCase().includes(q) ||
        (b.role ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const av = (a[sortKey] ?? '').toString();
      const bv = (b[sortKey] ?? '').toString();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(s => !s);
    else { setSortKey(key); setSortAsc(true); }
  };

  const exportCSV = () => {
    const headers = ['Nom', 'Société', 'Pays', 'Téléphone', 'Secteur', 'Rôle', 'Message', 'Date'];
    const rows = filtered.map(b => [
      b.full_name,
      b.company_name,
      b.country,
      b.phone ?? '',
      b.sector ?? '',
      b.role ?? '',
      (b.message ?? '').replace(/\n/g, ' '),
      new Date(b.created_at).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `acheteurs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" />
            Acheteurs inscrits
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">{buyers.length} profil{buyers.length !== 1 ? 's' : ''} enregistré{buyers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" /> Exporter CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: buyers.length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Ce mois', value: buyers.filter(b => new Date(b.created_at) > new Date(Date.now() - 30 * 864e5)).length, color: 'bg-green-50 text-green-700 border-green-200' },
          { label: 'Pays', value: new Set(buyers.map(b => b.country)).size, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Secteurs', value: new Set(buyers.map(b => b.sector).filter(Boolean)).size, color: 'bg-purple-50 text-purple-700 border-purple-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.color}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => { setError(null); load(); }}
            className="text-xs font-semibold underline hover:no-underline whitespace-nowrap">Réessayer</button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, société, pays, secteur…"
          className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-stone-400">Aucun acheteur trouvé</div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  {[
                    { label: 'Nom & Société', key: 'full_name' as SortKey },
                    { label: 'Pays', key: 'country' as SortKey },
                    { label: 'Secteur / Rôle', key: null },
                    { label: 'Contact', key: null },
                    { label: 'Inscription', key: 'created_at' as SortKey },
                    { label: '', key: null },
                  ].map(col => (
                    <th
                      key={col.label}
                      onClick={() => col.key && toggleSort(col.key)}
                      className={`text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide ${col.key ? 'cursor-pointer hover:text-stone-700' : ''}`}
                    >
                      {col.label}
                      {col.key && <SortIcon k={col.key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map(b => (
                  <>
                    <tr
                      key={b.id}
                      className="hover:bg-stone-50 cursor-pointer transition-colors"
                      onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-stone-800">{b.full_name}</div>
                        <div className="text-stone-500 text-xs flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" /> {b.company_name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-stone-600">
                          <Globe className="w-3.5 h-3.5 text-stone-400" /> {b.country}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {b.sector && <div className="text-stone-700">{b.sector}</div>}
                        {b.role && (
                          <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                            <Briefcase className="w-3 h-3" /> {b.role}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        {b.email && (
                          <a href={`mailto:${b.email}`} onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-amber-600 hover:underline text-xs">
                            <Mail className="w-3 h-3" /> {b.email}
                          </a>
                        )}
                        {b.phone && (
                          <div className="flex items-center gap-1.5 text-stone-600 text-xs">
                            <Phone className="w-3 h-3" /> {b.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                        {new Date(b.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/quotes?q=${encodeURIComponent(b.company_name)}`}
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-stone-400 hover:text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <ExternalLink className="w-3 h-3" /> Devis
                        </Link>
                      </td>
                    </tr>
                    {expanded === b.id && b.message && (
                      <tr key={`${b.id}-msg`} className="bg-amber-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <Mail className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <div className="text-xs font-semibold text-amber-700 mb-1">Message</div>
                              <p className="text-sm text-stone-700">{b.message}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
