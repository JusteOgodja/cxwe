import { useEffect, useState } from 'react';
import { Globe, ExternalLink, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SourceSite {
  site: string;
  nb_produits: number;
}

export default function Sources() {
  const [sites, setSites] = useState<SourceSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('list_source_sites');
      setSites((data || []) as SourceSite[]);
      setLoading(false);
    })();
  }, []);

  const filtered = sites.filter(s => s.site.toLowerCase().includes(q.toLowerCase()));
  const totalProduits = sites.reduce((sum, s) => sum + Number(s.nb_produits), 0);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Globe className="w-6 h-6 text-amber-500" />
        <h1 className="text-2xl font-bold text-stone-800">Sources</h1>
      </div>
      <p className="text-stone-500 text-sm mb-6">
        Sites web d'où proviennent les données produits ({sites.length} sites · {totalProduits.toLocaleString('fr-FR')} produits sourcés).
      </p>

      <div className="relative mb-4 max-w-xs">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Rechercher un site…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Chargement…</p>
      ) : (
        <div className="bg-white rounded-xl border border-stone-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Site source</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Produits</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Lien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(s => (
                <tr key={s.site} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-2.5 text-sm text-stone-700 font-medium">{s.site}</td>
                  <td className="px-4 py-2.5 text-sm text-stone-500 text-right">{Number(s.nb_produits).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a
                      href={`https://${s.site}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 hover:underline text-sm"
                    >
                      Visiter <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-stone-400 text-sm">Aucun site trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
