import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Save, ToggleLeft, ToggleRight, Upload, Download, FileJson, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Category } from '../../types';

const EMPTY: Omit<Category, 'id' | 'created_at'> = {
  name: '', slug: '', description: '', image_url: '',
  sort_order: 0, is_active: true,
};

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── Import / Export ──────────────────────────────────────────────────────────

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const CAT_TEMPLATE = [
  {
    _note: "Supprimer ce champ avant l'import. Le slug est auto-généré depuis le nom si absent.",
    name: "Huiles d'olive",
    slug: "olive-oil",
    description: "Sélection d'huiles d'olive premium du Maroc",
    image_url: "",
    sort_order: 1,
    is_active: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Categories() {
  type CategoryWithCount = Category & { products: { count: number }[] };
  const [items, setItems] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('categories').select('*, products(count)').order('sort_order');
    setItems((data || []) as CategoryWithCount[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ ...EMPTY }); setEditing(null); setModal('add'); };

  const openEdit = (cat: Category) => {
    setForm({ name: cat.name, slug: cat.slug, description: cat.description, image_url: cat.image_url, sort_order: cat.sort_order, is_active: cat.is_active });
    setEditing(cat);
    setModal('edit');
  };

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'name' && modal === 'add') updated.slug = slugify(e.target.value);
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (modal === 'edit' && editing) {
      await supabase.from('categories').update(form).eq('id', editing.id);
    } else {
      await supabase.from('categories').insert([form]);
    }
    setSaving(false);
    setModal(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette catégorie et tous ses produits ?')) return;
    setDeleting(id);
    await supabase.from('categories').delete().eq('id', id);
    setDeleting(null);
    load();
  };

  const toggleActive = async (cat: Category) => {
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
    load();
  };

  // ─── Import / Export handlers ──────────────────────────────────────────────

  const handleExportTemplate = () => downloadJSON(CAT_TEMPLATE, 'template_categories.json');

  const handleExport = () => {
    const data = items.map(c => ({
      name: c.name, slug: c.slug, description: c.description,
      image_url: c.image_url, sort_order: c.sort_order, is_active: c.is_active,
    }));
    downloadJSON(data, `categories_${new Date().toISOString().slice(0, 10)}.json`);
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
      slug: (row.slug as string) || slugify(row.name as string),
      description: (row.description as string) || '',
      image_url: (row.image_url as string) || '',
      sort_order: Number(row.sort_order) || 0,
      is_active: row.is_active !== false,
    }));
    await supabase.from('categories').insert(toInsert);
    setImporting(false);
    closeImportModal();
    load();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Catégories</h1>
          <p className="text-stone-500 text-sm mt-1">{items.length} catégorie{items.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExportTemplate} title="Télécharger le modèle JSON"
            className="flex items-center gap-1.5 border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors">
            <FileJson className="w-4 h-4" /> Modèle
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Exporter ({items.length})
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors">
            <Upload className="w-4 h-4" /> Importer JSON
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-xl animate-pulse border border-stone-100" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-x-auto">
          <table className="min-w-max w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Image</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide min-w-[160px]">Catégorie</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide min-w-[200px]">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Produits</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Ordre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Créé le</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {items.map(cat => (
                <tr key={cat.id} className="hover:bg-stone-50 transition-colors">
                  {/* Image */}
                  <td className="px-4 py-2">
                    {cat.image_url
                      ? <a href={cat.image_url} target="_blank" rel="noopener noreferrer">
                          <img src={cat.image_url} alt={cat.name} className="w-10 h-10 object-cover rounded-lg border border-stone-100 hover:opacity-80 transition-opacity" />
                        </a>
                      : <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-300 text-xs">—</div>}
                  </td>
                  {/* Nom */}
                  <td className="px-4 py-2 font-medium text-stone-800 text-sm">{cat.name}</td>
                  {/* Slug */}
                  <td className="px-4 py-2 text-stone-400 font-mono text-xs">{cat.slug}</td>
                  {/* Description */}
                  <td className="px-4 py-2 text-stone-500 text-xs">
                    <span className="truncate block max-w-[200px]" title={cat.description}>{cat.description || '—'}</span>
                  </td>
                  {/* Nb produits */}
                  <td className="px-4 py-2 text-center">
                    <span className="text-xs font-semibold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                      {cat.products?.[0]?.count ?? 0}
                    </span>
                  </td>
                  {/* Ordre */}
                  <td className="px-4 py-2 text-stone-400 text-xs text-center">{cat.sort_order}</td>
                  {/* Créé le */}
                  <td className="px-4 py-2 text-stone-400 text-xs whitespace-nowrap">
                    {cat.created_at ? new Date(cat.created_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  {/* Statut */}
                  <td className="px-4 py-2">
                    <button onClick={() => toggleActive(cat)} className="transition-colors">
                      {cat.is_active
                        ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                        : <ToggleLeft className="w-5 h-5 text-stone-300" />}
                    </button>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(cat)}
                        className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} disabled={deleting === cat.id}
                        className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Modale Import JSON ───────────────────────────────────────────────── */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
              <div>
                <h2 className="font-bold text-stone-800">
                  Import JSON — {importRows.length} catégorie{importRows.length !== 1 ? 's' : ''} détectée{importRows.length !== 1 ? 's' : ''}
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
                          <th className="text-left px-4 py-2.5 text-stone-400 font-semibold">Ordre</th>
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
                            <td className="px-4 py-2.5 text-stone-400">{String(row.sort_order ?? 0)}</td>
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
                Importer {validImportRows.length} catégorie{validImportRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modale édition ──────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <h2 className="font-bold text-stone-800">{modal === 'add' ? 'Ajouter une catégorie' : 'Modifier la catégorie'}</h2>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">Nom *</label>
                  <input required type="text" value={form.name} onChange={set('name')}
                    className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">Slug *</label>
                  <input required type="text" value={form.slug} onChange={set('slug')}
                    className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Description</label>
                <textarea rows={2} value={form.description} onChange={set('description')}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">URL de l'image</label>
                <input type="url" value={form.image_url} onChange={set('image_url')}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">Ordre d'affichage</label>
                  <input type="number" value={form.sort_order} onChange={set('sort_order')}
                    className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active}
                      onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="w-4 h-4 text-amber-500 rounded" />
                    <span className="text-sm text-stone-700">Active</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-stone-200 text-stone-600 text-sm py-2.5 rounded-xl hover:bg-stone-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
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
