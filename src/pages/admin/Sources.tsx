import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Globe, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface SourceSite {
  site: string;
  nb_produits: number;
  nb_actifs: number;
  nb_inactifs: number;
  is_active: boolean;
}

interface SourceProduct {
  id: string;
  name: string;
  image_url: string | null;
  prix_marche_mad: number | null;
  is_active: boolean;
  statut: string | null;
  source_url: string | null;
  created_at: string | null;
}

const PRODUCT_PAGE_SIZE = 25;

export default function Sources() {
  const { t } = useTranslation();
  const [sites, setSites] = useState<SourceSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selectedSite, setSelectedSite] = useState<SourceSite | null>(null);
  const [products, setProducts] = useState<SourceProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productPage, setProductPage] = useState(0);
  const [productTotal, setProductTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('list_source_sites');
      setSites((data || []) as SourceSite[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedSite) return;

    (async () => {
      setProductsLoading(true);
      const from = productPage * PRODUCT_PAGE_SIZE;
      const to = from + PRODUCT_PAGE_SIZE - 1;
      const site = selectedSite.site;
      const wwwSite = `www.${site}`;
      const sourceFilter = [
        `source_site.eq.${site}`,
        `source_site.eq.${wwwSite}`,
        `source_url.ilike.http://${site}%`,
        `source_url.ilike.https://${site}%`,
        `source_url.ilike.http://${wwwSite}%`,
        `source_url.ilike.https://${wwwSite}%`,
      ].join(',');

      const { data, count } = await supabase
        .from('products')
        .select('id, name, image_url, prix_marche_mad, is_active, statut, source_url, created_at', { count: 'exact' })
        .or(sourceFilter)
        .order('is_active', { ascending: false })
        .order('name', { ascending: true })
        .range(from, to);

      setProducts((data || []) as SourceProduct[]);
      setProductTotal(count || 0);
      setProductsLoading(false);
    })();
  }, [selectedSite, productPage]);

  const filtered = sites.filter(s => s.site.toLowerCase().includes(q.toLowerCase()));
  const totalProduits = sites.reduce((sum, s) => sum + Number(s.nb_produits), 0);
  const totalActifs = sites.reduce((sum, s) => sum + Number(s.nb_actifs || 0), 0);
  const totalInactifs = sites.reduce((sum, s) => sum + Number(s.nb_inactifs || 0), 0);
  const productTotalPages = Math.ceil(productTotal / PRODUCT_PAGE_SIZE);
  const productFrom = productTotal === 0 ? 0 : productPage * PRODUCT_PAGE_SIZE + 1;
  const productTo = Math.min((productPage + 1) * PRODUCT_PAGE_SIZE, productTotal);

  const selectSite = (site: SourceSite) => {
    setSelectedSite(site);
    setProductPage(0);
  };

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-1">
        <Globe className="w-6 h-6 text-amber-500" />
        <h1 className="text-2xl font-bold text-stone-800">{t('admin.pages.sources.title')}</h1>
      </div>
      <p className="text-stone-500 text-sm mb-6">
        {t('admin.pages.sources.subtitle', {
          sites: sites.length.toLocaleString('fr-FR'),
          products: totalProduits.toLocaleString('fr-FR'),
          active: totalActifs.toLocaleString('fr-FR'),
          inactive: totalInactifs.toLocaleString('fr-FR'),
        })}
      </p>

      <div className="relative mb-4 max-w-xs">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('admin.pages.sources.search')}
          className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">{t('admin.common.loading')}</p>
      ) : (
        <div className="bg-white rounded-xl border border-stone-100 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.pages.sources.colSite')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.common.status')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.pages.sources.colProducts')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.pages.sources.colActive')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.pages.sources.colInactive')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.pages.sources.colLink')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(s => (
                <tr key={s.site} className={`hover:bg-stone-50 transition-colors ${selectedSite?.site === s.site ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-2.5 text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => selectSite(s)}
                      className="text-left text-stone-700 hover:text-amber-700 hover:underline"
                    >
                      {s.site}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                      {s.is_active ? t('admin.common.active') : t('admin.common.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-stone-500 text-right">{Number(s.nb_produits).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-sm text-emerald-700 text-right">{Number(s.nb_actifs || 0).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-sm text-stone-500 text-right">{Number(s.nb_inactifs || 0).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a
                      href={s.site.startsWith('http') ? s.site : `https://${s.site}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 hover:underline text-sm"
                    >
                      {t('admin.pages.sources.visit')} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-stone-400 text-sm">{t('admin.pages.sources.noSites')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedSite && (
        <div className="mt-6 bg-white rounded-xl border border-stone-100 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50">
            <div>
              <h2 className="text-base font-semibold text-stone-800">{t('admin.pages.sources.productsOf', { site: selectedSite.site })}</h2>
              <p className="text-xs text-stone-500">
                {t('admin.pages.sources.productStats', {
                  products: productTotal.toLocaleString('fr-FR'),
                  active: selectedSite.nb_actifs.toLocaleString('fr-FR'),
                  inactive: selectedSite.nb_inactifs.toLocaleString('fr-FR'),
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSite(null)}
              className="text-sm text-stone-500 hover:text-stone-800 px-3 py-1.5 rounded-lg hover:bg-white transition-colors"
            >
              {t('admin.common.close')}
            </button>
          </div>

          {productsLoading ? (
            <p className="px-4 py-8 text-center text-stone-400 text-sm">{t('admin.pages.sources.loadingProducts')}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-white border-b border-stone-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.pages.sources.colProduct')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.common.status')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.pages.sources.marketPrice')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.pages.sources.createdAt')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('admin.pages.sources.colSource')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-stone-100" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-stone-100" />
                            )}
                            <span className="text-sm font-medium text-stone-700 line-clamp-2">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${p.is_active ? 'bg-emerald-400' : 'bg-stone-300'}`} />
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                              {p.statut || (p.is_active ? 'actif' : 'inactif')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-stone-600 text-right">
                          {p.prix_marche_mad != null ? `${Number(p.prix_marche_mad).toLocaleString('fr-FR')} MAD` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-stone-500">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {p.source_url ? (
                            <a
                              href={p.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 hover:underline text-sm"
                            >
                              {t('admin.pages.sources.view')} <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-stone-300 text-sm">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {products.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400 text-sm">{t('admin.pages.sources.noProducts')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {productTotalPages > 1 && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-stone-100">
                  <p className="text-sm text-stone-500">
                    {productFrom.toLocaleString('fr-FR')}-{productTo.toLocaleString('fr-FR')} sur {productTotal.toLocaleString('fr-FR')}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProductPage(p => Math.max(0, p - 1))}
                      disabled={productPage === 0}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-white"
                    >
                      <ChevronLeft className="w-4 h-4" /> {t('admin.common.previous')}
                    </button>
                    <span className="text-sm text-stone-500">
                      {t('admin.common.pageOf', { page: productPage + 1, total: productTotalPages })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setProductPage(p => Math.min(productTotalPages - 1, p + 1))}
                      disabled={productPage >= productTotalPages - 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-white"
                    >
                      {t('admin.common.next')} <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
