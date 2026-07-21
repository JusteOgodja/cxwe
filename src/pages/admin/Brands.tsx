import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Save, Search, ToggleLeft, ToggleRight, ExternalLink, Upload, Download, FileJson, AlertCircle, CheckSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Brand } from '../../types';

const toSlug = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/--+/g, '-');

const EMPTY = {
  name: '', slug: '', description: '', logo_url: '', is_active: true,
};

// ─── Import / Export ──────────────────────────────────────────────────────────

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const BRAND_TEMPLATE = [
  {
    _note: "Supprimer ce champ avant l'import. Le slug est auto-généré depuis le nom si absent.",
    name: "Ouargane",
    slug: "ouargane",
    description: "Marque premium d'huile d'argan du Maroc",
    logo_url: "",
    is_active: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Brands() {
  type BrandWithCount = Brand & { products: { count: number }[] };
  const [brands, setBrands] = useState<BrandWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [slugLocked, setSlugLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('brands').select('*, products(count)').order('name');
    setBrands((data || []) as BrandWithCount[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => { setSelectedIds(new Set()); }, [search]);

  const openAdd = () => { setForm({ ...EMPTY }); setSlugLocked(false); setEditing(null); setModal('add'); };

  const openEdit = (b: Brand) => {
    setForm({ name: b.name, slug: b.slug, description: b.description || '', logo_url: b.logo_url || '', is_active: b.is_active });
    setSlugLocked(true);
    setEditing(b);
    setModal('edit');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm(f => ({ ...f, name, slug: slugLocked ? f.slug : toSlug(name) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (modal === 'edit' && editing) {
      await supabase.from('brands').update({ ...form }).eq('id', editing.id);
    } else {
      await supabase.from('brands').insert([{ ...form }]);
    }
    setSaving(false);
    setModal(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette marque ? Les produits associés perdront leur référence marque.')) return;
    setDeleting(id);
    await supabase.from('brands').delete().eq('id', id);
    setDeleting(null);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    load();
  };

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!confirm(`Supprimer ${count} marque${count > 1 ? 's' : ''} ? Les produits associés perdront leur référence marque.`)) return;
    setBulkDeleting(true);
    await supabase.from('brands').delete().in('id', [...selectedIds]);
    setSelectedIds(new Set());
    setBulkDeleting(false);
    load();
  };

  const toggleActive = async (b: Brand) => {
    await supabase.from('brands').update({ is_active: !b.is_active }).eq('id', b.id);
    load();
  };

  // ─── Import / Export handlers ──────────────────────────────────────────────

  const handleExportTemplate = () => downloadJSON(BRAND_TEMPLATE, 'template_marques.json');

  const handleExport = () => {
    const data = brands.map(b => ({
      name: b.name, slug: b.slug,
      description: b.description || '', logo_url: b.logo_url || '', is_active: b.is_active,
    }));
    downloadJSON(data, `marques_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error('Le fichier doit contenir un tableau JSON [ ... ]');
        const errors: string[] = [];
        parsed.forEach((row, i) => {
          if (!row.name) errors.push(`Ligne ${i + 1} : champ "name" manquant`);
        });
        setImportRows(parsed);
        setImportErrors(errors);
        setImportModal(true);
      } catch (err) {
        alert('Fichier JSON invalide : ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const closeImportModal = () => { setImportModal(false); setImportRows([]); setImportErrors([]); };

  const validImportRows = importRows.filter(r => r.name);

  const handleImportConfirm = async () => {
    setImporting(true);
    const toInsert = validImportRows.map(row => ({
      name: row.name as string,
      slug: (row.slug as string) || toSlug(row.name as string),
      description: (row.description as string) || '',
      logo_url: (row.logo_url as string) || '',
      is_active: row.is_active !== false,
    }));
    await supabase.from('brands').insert(toInsert);
    setImporting(false);
    closeImportModal();
    load();
  };

  const filtered = brands.filter(b =>
    !search || b.name.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every(b => selectedIds.has(b.id));
  const someSelected = filtered.some(b => selectedIds.has(b.id)) && !allSelected;

  const toggleSelectAll = () =>
    setSelectedIds(
      allSelected ? new Set() : new Set(filtered.map(b => b.id))
    );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Marques</h1>
          <p className="text-stone-500 text-sm mt-1">{brands.length} marque{brands.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExportTemplate} title="Télécharger le modèle JSON"
            className="flex items-center gap-1.5 border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors">
            <FileJson className="w-4 h-4" /> Modèle
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Exporter ({brands.length})
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors">
            <Upload className="w-4 h-4" /> Importer JSON
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Ajouter une marque
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Search + bulk action bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 bg-white" />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <CheckSquare className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm font-medium text-red-700">
              {selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ml-1"
            >
              {bulkDeleting
                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />}
              Supprimer la sélection
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-stone-400 hover:text-stone-600 ml-1"
              title="Désélectionner tout"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) =>
            <div key={i} className="h-16 bg-white rounded-xl animate-pulse border border-stone-100" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">Aucune marque trouvée</div>
          ) : (
            <table className="min-w-max w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-stone-300 text-amber-500 cursor-pointer" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Logo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide min-w-[160px]">Marque</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Slug</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide min-w-[200px]">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Produits</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">URL Logo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Créé le</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map(b => (
                  <tr key={b.id} className={`transition-colors ${selectedIds.has(b.id) ? 'bg-amber-50/60' : 'hover:bg-stone-50'}`}>
                    {/* Checkbox */}
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleSelect(b.id)}
                        className="w-4 h-4 rounded border-stone-300 text-amber-500 cursor-pointer" />
                    </td>
                    {/* Logo */}
                    <td className="px-4 py-2">
                      {b.logo_url
                        ? <a href={b.logo_url} target="_blank" rel="noopener noreferrer">
                            <img src={b.logo_url} alt={b.name}
                              className="w-10 h-10 rounded-lg object-contain bg-stone-100 hover:opacity-80 transition-opacity border border-stone-100"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </a>
                        : <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-400">
                            {b.name.charAt(0).toUpperCase()}
                          </div>}
                    </td>
                    {/* Nom */}
                    <td className="px-4 py-2 font-medium text-stone-800 text-sm whitespace-nowrap">{b.name}</td>
                    {/* Slug */}
                    <td className="px-4 py-2 text-stone-400 font-mono text-xs">{b.slug}</td>
                    {/* Description */}
                    <td className="px-4 py-2 text-stone-500 text-xs">
                      <span className="truncate block max-w-[200px]" title={b.description}>{b.description || '—'}</span>
                    </td>
                    {/* Nb produits */}
                    <td className="px-4 py-2 text-center">
                      <span className="text-xs font-semibold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                        {(b as BrandWithCount).products?.[0]?.count ?? 0}
                      </span>
                    </td>
                    {/* URL Logo */}
                    <td className="px-4 py-2 text-xs">
                      {b.logo_url
                        ? <a href={b.logo_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 hover:underline truncate block max-w-[120px]"
                            title={b.logo_url}>Voir ↗</a>
                        : <span className="text-stone-300">—</span>}
                    </td>
                    {/* Créé le */}
                    <td className="px-4 py-2 text-stone-400 text-xs whitespace-nowrap">
                      {b.created_at ? new Date(b.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    {/* Statut */}
                    <td className="px-4 py-2">
                      <button onClick={() => toggleActive(b)}>
                        {b.is_active
                          ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                          : <ToggleLeft className="w-5 h-5 text-stone-300" />}
                      </button>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(b)}
                          className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id}
                          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Modale Import JSON ───────────────────────────────────────────────── */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
              <div>
                <h2 className="font-bold text-stone-800">
                  Import JSON — {importRows.length} marque{importRows.length !== 1 ? 's' : ''} détectée{importRows.length !== 1 ? 's' : ''}
                </h2>
                {importErrors.length > 0 && (
                  <p className="text-xs text-red-500 mt-0.5">{importErrors.length} erreur{importErrors.length > 1 ? 's' : ''} — entrées invalides ignorées</p>
                )}
              </div>
              <button onClick={closeImportModal} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-xs font-semibold text-red-600">Erreurs détectées</p>
                  </div>
                  <ul className="space-y-1">
                    {importErrors.map((err, i) => <li key={i} className="text-xs text-red-500">• {err}</li>)}
                  </ul>
                </div>
              )}
              {importRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 mb-2">
                    Aperçu — {validImportRows.length} valide{validImportRows.length !== 1 ? 's' : ''} sur {importRows.length}
                  </p>
                  <div className="rounded-xl overflow-hidden border border-stone-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-100">
                          <th className="text-left px-4 py-2.5 text-stone-400 font-semibold">Nom</th>
                          <th className="text-left px-4 py-2.5 text-stone-400 font-semibold">Slug</th>
                          <th className="text-left px-4 py-2.5 text-stone-400 font-semibold">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {importRows.slice(0, 8).map((row, i) => (
                          <tr key={i} className={row.name ? '' : 'bg-red-50/50'}>
                            <td className="px-4 py-2.5 font-medium text-stone-700">
                              {(row.name as string) || <span className="text-red-400 italic">manquant</span>}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-stone-400">
                              {(row.slug as string) || <span className="text-stone-300 italic">auto</span>}
                            </td>
                            <td className="px-4 py-2.5 text-stone-400 truncate max-w-[120px]">
                              {(row.description as string) || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-stone-100 shrink-0 bg-stone-50 rounded-b-2xl">
              <button onClick={closeImportModal}
                className="flex-1 border border-stone-200 text-stone-600 text-sm py-2.5 rounded-xl hover:bg-white transition-colors">
                Annuler
              </button>
              <button onClick={handleImportConfirm} disabled={importing || validImportRows.length === 0}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                {importing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                Importer {validImportRows.length} marque{validImportRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modale édition ──────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-stone-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-bold text-stone-800">
                {modal === 'add' ? 'Nouvelle marque' : `Modifier — ${editing?.name}`}
              </h2>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Nom de la marque *</label>
                <input required type="text" value={form.name} onChange={handleNameChange}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Slug <span className="text-stone-400 font-normal">(identifiant URL unique)</span>
                </label>
                <div className="flex gap-2">
                  <input required type="text" value={form.slug}
                    onChange={e => { setSlugLocked(true); setForm(f => ({ ...f, slug: e.target.value })); }}
                    className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 font-mono" />
                  {slugLocked && (
                    <button type="button" onClick={() => { setSlugLocked(false); setForm(f => ({ ...f, slug: toSlug(f.name) })); }}
                      title="Regénérer depuis le nom"
                      className="px-3 py-2.5 border border-stone-200 rounded-xl text-xs text-stone-500 hover:bg-stone-50 transition-colors">↺</button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Description</label>
                <textarea rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">URL du logo</label>
                <input type="url" value={form.logo_url}
                  onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                {form.logo_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={form.logo_url} alt="Logo preview"
                      className="w-10 h-10 rounded-lg object-contain bg-stone-100 border border-stone-200"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <a href={form.logo_url} target="_blank" rel="noreferrer"
                      className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Voir
                    </a>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded border-stone-300 text-amber-500" />
                <span className="text-sm text-stone-700">Marque active</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-stone-200 text-stone-600 text-sm py-2.5 rounded-xl hover:bg-stone-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  {modal === 'add' ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
