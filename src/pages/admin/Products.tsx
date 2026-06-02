import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Save, Search, Minus, Upload, Download, FileJson, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Product, Category, Brand, Supplier } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOTERMS = ['EXW', 'FOB', 'FCA', 'CIF', 'CFR', 'DDP', 'DAP'];
const CERTIFICATIONS_LIST = ['Halal', 'Bio', 'ISO 22000', 'HACCP', 'IFS', 'BRC', 'GlobalGAP', 'Fairtrade', 'Kosher'];
const REGIMES_LIST = ['Halal', 'Bio', 'Vegan', 'Végétarien', 'Sans gluten', 'Sans lactose', 'Casher'];
const ALLERGENES_LIST = [
  'Gluten', 'Crustacés', 'Œufs', 'Poisson', 'Arachides', 'Soja',
  'Lait', 'Fruits à coque', 'Céleri', 'Moutarde', 'Graines de sésame', 'Anhydride sulfureux',
];
const TEMPERATURES = ['Ambiante', 'Réfrigéré', 'Frais', 'Surgelé'] as const;
const STATUTS = ['actif', 'inactif', 'brouillon', 'archivé'] as const;
const DEVISES = ['EUR', 'USD', 'GBP', 'MAD', 'AED'];

const STATUT_COLORS: Record<string, string> = {
  actif: 'bg-emerald-100 text-emerald-700',
  inactif: 'bg-stone-100 text-stone-500',
  brouillon: 'bg-blue-100 text-blue-700',
  'archivé': 'bg-red-100 text-red-600',
};

// ─── Import / Export helpers ──────────────────────────────────────────────────

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const IMPORT_TEMPLATE: Record<string, unknown>[] = [
  {
    _note: "Supprimer ce champ avant l'import. category_slug doit correspondre au slug d'une catégorie existante (ex: olive-oil, argan-oil, canned-sardines…).",
    name: "Huile d'olive extra vierge 1L",
    description: "Huile d'olive premium issue des olives du Maroc, première pression à froid.",
    details: ["Contenu net : 1L", "Acidité < 0,5%", "Première pression à froid"],
    image_url: "",
    ean: "",
    hs_code: "150910",
    category_slug: "olive-oil",
    temperature: "Ambiante",
    commande_min: 100,
    colisage: 12,
    duree_conservation: 730,
    devise: "EUR",
    pays_origine: "Morocco",
    pays_export_autorises: ["France", "Espagne", "Allemagne"],
    incoterms_dispo: ["FOB", "CIF"],
    certifications: ["Halal", "Bio"],
    regimes: ["Halal", "Vegan"],
    allergenes: [],
    ingredients_texte: "100% huile d'olive extra vierge",
    nutrition_texte: "",
    statut: "actif",
    is_active: true,
    is_new: false,
    is_promo: false,
    est_sponsored: false,
    sort_order: 0,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'infos' | 'logistique' | 'commerce' | 'composition' | 'tarifs';

interface DimState {
  length: string; width: string; height: string; weight_net: string; weight_brut: string;
}
const EMPTY_DIM: DimState = { length: '', width: '', height: '', weight_net: '', weight_brut: '' };

interface PriceTierRow { min_quantity: string; price: string; currency: string; }

const EMPTY_FORM = {
  category_id: '', marque_id: '', fournisseur_id: '',
  name: '', description: '', details_text: '', image_url: '',
  ean: '', hs_code: '',
  sort_order: '0',
  statut: 'actif' as typeof STATUTS[number],
  is_active: true, is_new: false, is_promo: false, est_sponsored: false,
  temperature: 'Ambiante' as typeof TEMPERATURES[number],
  commande_min: '1', colisage: '1',
  cartons_per_layer: '', layers_per_palette: '',
  duree_conservation: '365',
  devise: 'EUR', pays_origine: 'Morocco', pays_export_text: '',
  incoterms_dispo: [] as string[],
  certifications: [] as string[],
  regimes: [] as string[],
  allergenes: [] as string[],
  ingredients_texte: '', nutrition_texte: '',
};

type FormState = typeof EMPTY_FORM;

// ─── Sub-components ───────────────────────────────────────────────────────────

function DimForm({ label, value, onChange }: {
  label: string; value: DimState; onChange: (v: DimState) => void;
}) {
  const upd = (k: keyof DimState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[
          { k: 'length' as const, label: 'L (cm)' },
          { k: 'width' as const, label: 'l (cm)' },
          { k: 'height' as const, label: 'H (cm)' },
        ].map(({ k, label: lbl }) => (
          <div key={k}>
            <label className="text-xs text-stone-400 block mb-0.5">{lbl}</label>
            <input type="number" value={value[k]} onChange={upd(k)} min={0}
              className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-stone-400 block mb-0.5">Poids net (kg)</label>
          <input type="number" value={value.weight_net} onChange={upd('weight_net')} min={0} step="0.01"
            className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-0.5">Poids brut (kg)</label>
          <input type="number" value={value.weight_brut} onChange={upd('weight_brut')} min={0} step="0.01"
            className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400" />
        </div>
      </div>
    </div>
  );
}

function CheckGroup({ title, options, selected, onChange }: {
  title: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 mb-2">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const on = selected.includes(opt);
          return (
            <button type="button" key={opt}
              onClick={() => onChange(on ? selected.filter(s => s !== opt) : [...selected, opt])}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${on ? 'bg-amber-500 text-white border-amber-500' : 'border-stone-200 text-stone-600 hover:border-amber-300'}`}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('infos');
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [dimUnite, setDimUnite] = useState<DimState>({ ...EMPTY_DIM });
  const [dimCarton, setDimCarton] = useState<DimState>({ ...EMPTY_DIM });
  const [dimPalette, setDimPalette] = useState<DimState>({ ...EMPTY_DIM });
  const [pricingTiers, setPricingTiers] = useState<PriceTierRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const [prodRes, catRes, brandRes, supRes] = await Promise.all([
      supabase.from('products')
        .select('*, category:categories(name,slug), brand:brands(name,slug), supplier:suppliers(name,slug)')
        .order('sort_order'),
      supabase.from('categories').select('id, name').order('sort_order'),
      supabase.from('brands').select('id, name, slug').order('name'),
      supabase.from('suppliers').select('id, name, slug').order('name'),
    ]);
    setProducts((prodRes.data || []) as Product[]);
    setCategories((catRes.data || []) as Category[]);
    setBrands((brandRes.data || []) as Brand[]);
    setSuppliers((supRes.data || []) as Supplier[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fromDim = (d: any): DimState => d ? {
    length: String(d.length ?? ''), width: String(d.width ?? ''), height: String(d.height ?? ''),
    weight_net: String(d.weight_net ?? ''), weight_brut: String(d.weight_brut ?? ''),
  } : { ...EMPTY_DIM };

  const toDim = (d: DimState) => {
    if (!d.length && !d.width && !d.height) return null;
    return {
      length: Number(d.length) || 0,
      width: Number(d.width) || 0,
      height: Number(d.height) || 0,
      weight_net: d.weight_net ? Number(d.weight_net) : null,
      weight_brut: d.weight_brut ? Number(d.weight_brut) : null,
    };
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id || '' });
    setDimUnite({ ...EMPTY_DIM }); setDimCarton({ ...EMPTY_DIM }); setDimPalette({ ...EMPTY_DIM });
    setPricingTiers([]); setEditing(null); setActiveTab('infos'); setModal('add');
  };

  const openEdit = async (p: Product) => {
    setForm({
      category_id: p.category_id || '',
      marque_id: p.marque_id || '',
      fournisseur_id: p.fournisseur_id || '',
      name: p.name || '',
      description: p.description || '',
      details_text: (p.details || []).join('\n'),
      image_url: p.image_url || '',
      ean: p.ean || '',
      hs_code: p.hs_code || '',
      sort_order: String(p.sort_order ?? 0),
      statut: p.statut || 'actif',
      is_active: p.is_active ?? true,
      is_new: p.is_new ?? false,
      is_promo: p.is_promo ?? false,
      est_sponsored: p.est_sponsored ?? false,
      temperature: p.temperature || 'Ambiante',
      commande_min: String(p.commande_min ?? 1),
      colisage: String(p.colisage ?? 1),
      cartons_per_layer: String(p.palettisation?.cartons_per_layer ?? ''),
      layers_per_palette: String(p.palettisation?.layers_per_palette ?? ''),
      duree_conservation: String(p.duree_conservation ?? 365),
      devise: p.devise || 'EUR',
      pays_origine: p.pays_origine || 'Morocco',
      pays_export_text: (p.pays_export_autorises || []).join(', '),
      incoterms_dispo: p.incoterms_dispo || [],
      certifications: p.certifications || [],
      regimes: p.regimes || [],
      allergenes: p.allergenes || [],
      ingredients_texte: p.ingredients_texte || '',
      nutrition_texte: p.nutrition_texte || '',
    });
    setDimUnite(fromDim(p.dimensions_unite));
    setDimCarton(fromDim(p.dimensions_carton));
    setDimPalette(fromDim(p.dimensions_palette));

    const { data: tiers } = await supabase
      .from('product_pricing_tiers').select('*').eq('product_id', p.id).order('min_quantity');
    setPricingTiers((tiers || []).map(t => ({
      min_quantity: String(t.min_quantity), price: String(t.price), currency: t.currency || 'EUR',
    })));

    setEditing(p); setActiveTab('infos'); setModal('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const details = form.details_text.split('\n').map(s => s.trim()).filter(Boolean);
    const pays_export_autorises = form.pays_export_text.split(',').map(s => s.trim()).filter(Boolean);
    const palettisation = (form.cartons_per_layer || form.layers_per_palette) ? {
      cartons_per_layer: Number(form.cartons_per_layer) || 0,
      layers_per_palette: Number(form.layers_per_palette) || 0,
    } : null;

    const payload: Record<string, unknown> = {
      category_id: form.category_id,
      marque_id: form.marque_id || null,
      fournisseur_id: form.fournisseur_id || null,
      name: form.name,
      description: form.description,
      details,
      image_url: form.image_url,
      ean: form.ean || null,
      hs_code: form.hs_code || null,
      sort_order: Number(form.sort_order) || 0,
      statut: form.statut,
      is_active: form.is_active,
      is_new: form.is_new,
      is_promo: form.is_promo,
      est_sponsored: form.est_sponsored,
      temperature: form.temperature,
      commande_min: Number(form.commande_min) || 1,
      colisage: Number(form.colisage) || 1,
      palettisation,
      dimensions_unite: toDim(dimUnite),
      dimensions_carton: toDim(dimCarton),
      dimensions_palette: toDim(dimPalette),
      devise: form.devise,
      pays_origine: form.pays_origine,
      pays_export_autorises,
      incoterms_dispo: form.incoterms_dispo,
      certifications: form.certifications,
      regimes: form.regimes,
      allergenes: form.allergenes,
      duree_conservation: Number(form.duree_conservation) || 365,
      ingredients_texte: form.ingredients_texte || null,
      nutrition_texte: form.nutrition_texte || null,
    };

    let productId: string | undefined;
    if (modal === 'edit' && editing) {
      await supabase.from('products').update(payload).eq('id', editing.id);
      productId = editing.id;
    } else {
      const { data } = await supabase.from('products').insert([payload]).select('id').single();
      productId = data?.id;
    }

    if (productId) {
      await supabase.from('product_pricing_tiers').delete().eq('product_id', productId);
      const valid = pricingTiers.filter(t => t.min_quantity && t.price);
      if (valid.length > 0) {
        await supabase.from('product_pricing_tiers').insert(
          valid.map(t => ({
            product_id: productId,
            min_quantity: Number(t.min_quantity),
            price: Number(t.price),
            currency: t.currency,
          }))
        );
      }
    }

    setSaving(false);
    setModal(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    setDeleting(id);
    await supabase.from('products').delete().eq('id', id);
    setDeleting(null);
    load();
  };

  const handleExportTemplate = () => downloadJSON(IMPORT_TEMPLATE, 'template_produits.json');

  const handleExport = () => {
    const data = filtered.map(p => ({
      name: p.name,
      description: p.description,
      details: p.details,
      image_url: p.image_url,
      ean: p.ean ?? '',
      hs_code: p.hs_code ?? '',
      category_slug: p.category?.slug ?? '',
      temperature: p.temperature,
      commande_min: p.commande_min,
      colisage: p.colisage,
      duree_conservation: p.duree_conservation,
      devise: p.devise,
      pays_origine: p.pays_origine,
      pays_export_autorises: p.pays_export_autorises ?? [],
      incoterms_dispo: p.incoterms_dispo ?? [],
      certifications: p.certifications ?? [],
      regimes: p.regimes ?? [],
      allergenes: p.allergenes ?? [],
      ingredients_texte: p.ingredients_texte ?? '',
      nutrition_texte: p.nutrition_texte ?? '',
      statut: p.statut,
      is_active: p.is_active,
      is_new: p.is_new,
      is_promo: p.is_promo,
      est_sponsored: p.est_sponsored,
      sort_order: p.sort_order,
    }));
    downloadJSON(data, `produits_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error('Le fichier doit contenir un tableau JSON [ ... ]');

        const catSlugs = new Set(categories.map(c => c.slug));
        const errors: string[] = [];

        parsed.forEach((row, i) => {
          const label = `Produit ${i + 1}${row.name ? ` ("${row.name}")` : ''}`;
          if (!row.name) errors.push(`${label} : champ "name" manquant`);
          if (!row.category_slug) errors.push(`${label} : champ "category_slug" manquant`);
          else if (!catSlugs.has(row.category_slug)) errors.push(`${label} : slug de catégorie "${row.category_slug}" introuvable`);
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

  const closeImportModal = () => {
    setImportModal(false);
    setImportRows([]);
    setImportErrors([]);
  };

  const validImportRows = importRows.filter(row => {
    const catSlugs = new Set(categories.map(c => c.slug));
    return row.name && row.category_slug && catSlugs.has(row.category_slug as string);
  });

  const handleImportConfirm = async () => {
    setImporting(true);
    const catMap = new Map(categories.map(c => [c.slug, c.id]));

    const toInsert = validImportRows.map(row => ({
      name: row.name as string,
      description: (row.description as string) || '',
      details: Array.isArray(row.details) ? row.details : [],
      image_url: (row.image_url as string) || '',
      ean: (row.ean as string) || null,
      hs_code: (row.hs_code as string) || null,
      category_id: catMap.get(row.category_slug as string)!,
      temperature: (['Ambiante', 'Réfrigéré', 'Frais', 'Surgelé'].includes(row.temperature as string) ? row.temperature : 'Ambiante') as string,
      commande_min: Number(row.commande_min) || 1,
      colisage: Number(row.colisage) || 1,
      duree_conservation: Number(row.duree_conservation) || 365,
      devise: (row.devise as string) || 'EUR',
      pays_origine: (row.pays_origine as string) || 'Morocco',
      pays_export_autorises: Array.isArray(row.pays_export_autorises) ? row.pays_export_autorises : [],
      incoterms_dispo: Array.isArray(row.incoterms_dispo) ? row.incoterms_dispo : [],
      certifications: Array.isArray(row.certifications) ? row.certifications : [],
      regimes: Array.isArray(row.regimes) ? row.regimes : [],
      allergenes: Array.isArray(row.allergenes) ? row.allergenes : [],
      ingredients_texte: (row.ingredients_texte as string) || null,
      nutrition_texte: (row.nutrition_texte as string) || null,
      statut: (['actif', 'inactif', 'brouillon', 'archivé'].includes(row.statut as string) ? row.statut : 'actif') as string,
      is_active: row.is_active !== false,
      is_new: !!row.is_new,
      is_promo: !!row.is_promo,
      est_sponsored: !!row.est_sponsored,
      sort_order: Number(row.sort_order) || 0,
    }));

    await supabase.from('products').insert(toInsert);
    setImporting(false);
    closeImportModal();
    load();
  };

  const setF = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const setCheck = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.checked }));

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || p.category_id === filterCat;
    return matchSearch && matchCat;
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'infos', label: 'Informations' },
    { id: 'logistique', label: 'Logistique' },
    { id: 'commerce', label: 'Commerce' },
    { id: 'composition', label: 'Composition' },
    { id: 'tarifs', label: 'Tarifs' },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Produits</h1>
          <p className="text-stone-500 text-sm mt-1">{products.length} produit{products.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExportTemplate} title="Télécharger le modèle JSON vide"
            className="flex items-center gap-1.5 border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors">
            <FileJson className="w-4 h-4" /> Modèle
          </button>
          <button onClick={handleExport} title={`Exporter ${filtered.length} produit(s) affiché(s) en JSON`}
            className="flex items-center gap-1.5 border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Exporter ({filtered.length})
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors">
            <Upload className="w-4 h-4" /> Importer JSON
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Ajouter un produit
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 bg-white" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white min-w-36">
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) =>
            <div key={i} className="h-16 bg-white rounded-xl animate-pulse border border-stone-100" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">Aucun produit trouvé</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Produit</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide hidden md:table-cell">Catégorie</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide hidden lg:table-cell">Marque</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide hidden sm:table-cell">Flags</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-stone-800">{p.name}</div>
                      {p.description && <div className="text-stone-400 text-xs truncate max-w-xs">{p.description}</div>}
                    </td>
                    <td className="px-5 py-3 text-stone-500 hidden md:table-cell">
                      {p.category?.name || '—'}
                    </td>
                    <td className="px-5 py-3 text-stone-500 hidden lg:table-cell">
                      {p.brand?.name || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUT_COLORS[p.statut] || 'bg-stone-100 text-stone-500'}`}>
                        {p.statut || 'actif'}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {p.is_new && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">New</span>}
                        {p.is_promo && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Promo</span>}
                        {p.est_sponsored && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Sponsorisé</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(p)}
                          className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
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

      {/* ─── Modale Import JSON ──────────────────────────────────────────────── */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
              <div>
                <h2 className="font-bold text-stone-800">
                  Import JSON — {importRows.length} produit{importRows.length !== 1 ? 's' : ''} détecté{importRows.length !== 1 ? 's' : ''}
                </h2>
                {importErrors.length > 0 && (
                  <p className="text-xs text-red-500 mt-0.5">
                    {importErrors.length} erreur{importErrors.length > 1 ? 's' : ''} — les produits invalides seront ignorés
                  </p>
                )}
              </div>
              <button onClick={closeImportModal} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-xs font-semibold text-red-600">Erreurs détectées</p>
                  </div>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {importErrors.map((err, i) => (
                      <li key={i} className="text-xs text-red-500">• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 mb-2">
                    Aperçu — {validImportRows.length} valide{validImportRows.length !== 1 ? 's' : ''} sur {importRows.length}
                    {importRows.length > 5 && ` (5 premiers affichés)`}
                  </p>
                  <div className="rounded-xl overflow-hidden border border-stone-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-100">
                          <th className="text-left px-4 py-2.5 text-stone-400 font-semibold">Nom</th>
                          <th className="text-left px-4 py-2.5 text-stone-400 font-semibold hidden sm:table-cell">Catégorie</th>
                          <th className="text-left px-4 py-2.5 text-stone-400 font-semibold hidden sm:table-cell">Code SH</th>
                          <th className="text-left px-4 py-2.5 text-stone-400 font-semibold">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {importRows.slice(0, 5).map((row, i) => {
                          const catSlugs = new Set(categories.map(c => c.slug));
                          const isValid = row.name && row.category_slug && catSlugs.has(row.category_slug as string);
                          return (
                            <tr key={i} className={isValid ? '' : 'bg-red-50/50'}>
                              <td className="px-4 py-2.5 font-medium text-stone-700 truncate max-w-[140px]">
                                {(row.name as string) || <span className="text-red-400 italic">manquant</span>}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-stone-500 hidden sm:table-cell">
                                {(row.category_slug as string) || '—'}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-stone-400 hidden sm:table-cell">
                                {(row.hs_code as string) || '—'}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUT_COLORS[(row.statut as string)] || 'bg-stone-100 text-stone-500'}`}>
                                  {(row.statut as string) || 'actif'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
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
              <button
                onClick={handleImportConfirm}
                disabled={importing || validImportRows.length === 0}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                {importing
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Upload className="w-4 h-4" />}
                Importer {validImportRows.length} produit{validImportRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal ─────────────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
              <h2 className="font-bold text-stone-800">
                {modal === 'add' ? 'Nouveau produit' : `Modifier — ${editing?.name}`}
              </h2>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-100 shrink-0 px-6 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 px-3 py-3 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-amber-500 text-amber-600' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form body */}
            <form id="product-form" onSubmit={handleSave} className="overflow-y-auto flex-1">
              <div className="p-6 space-y-5">

                {/* ── Informations ───────────────────────────────────────── */}
                {activeTab === 'infos' && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Catégorie *</label>
                        <select required value={form.category_id} onChange={setF('category_id')}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white">
                          <option value="">Sélectionner</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Statut</label>
                        <select value={form.statut} onChange={setF('statut')}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white">
                          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Marque</label>
                        <select value={form.marque_id} onChange={setF('marque_id')}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white">
                          <option value="">— Aucune —</option>
                          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Fournisseur</label>
                        <select value={form.fournisseur_id} onChange={setF('fournisseur_id')}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white">
                          <option value="">— Aucun —</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">Nom du produit *</label>
                      <input required type="text" value={form.name} onChange={setF('name')}
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">Description courte</label>
                      <textarea rows={2} value={form.description} onChange={setF('description')}
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none" />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">
                        Détails produit <span className="text-stone-400 font-normal">(un point par ligne)</span>
                      </label>
                      <textarea rows={4} value={form.details_text} onChange={setF('details_text')}
                        placeholder="Carton 50×125g&#10;Container 20 pieds = 3 250 cartons&#10;Avec huile végétale"
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none font-mono" />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">URL de l'image principale</label>
                      <input type="url" value={form.image_url} onChange={setF('image_url')} placeholder="https://..."
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Code EAN-13</label>
                        <input type="text" value={form.ean} onChange={setF('ean')} maxLength={13}
                          placeholder="ex : 6111234567890"
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 font-mono tracking-widest" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          Code SH / HS Code
                          <span className="ml-1.5 text-stone-400 font-normal">(6 chiffres)</span>
                        </label>
                        <input
                          type="text"
                          value={form.hs_code}
                          onChange={setF('hs_code')}
                          maxLength={10}
                          placeholder="ex : 150910 ou 1509.10"
                          pattern="^\d{4}\.?\d{2}$|^\d{6}$"
                          title="6 chiffres — format 150910 ou 1509.10"
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 font-mono tracking-widest"
                        />
                        <p className="text-[10px] text-stone-400 mt-1 leading-snug">
                          Nomenclature douanière internationale (OMD) — détermine les droits de douane applicables à l'export.
                        </p>
                      </div>
                    </div>

                    <div className="pt-1">
                      <p className="text-xs font-medium text-stone-600 mb-2">Indicateurs marketing</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { f: 'is_active', l: 'Actif' },
                          { f: 'is_new', l: 'Nouveau' },
                          { f: 'is_promo', l: 'En promo' },
                          { f: 'est_sponsored', l: 'Sponsorisé' },
                        ].map(({ f, l }) => (
                          <label key={f} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox"
                              checked={form[f as keyof FormState] as boolean}
                              onChange={setCheck(f as keyof FormState)}
                              className="w-4 h-4 rounded border-stone-300 text-amber-500" />
                            <span className="text-sm text-stone-700">{l}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── Logistique ─────────────────────────────────────────── */}
                {activeTab === 'logistique' && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Température de stockage</label>
                        <select value={form.temperature} onChange={setF('temperature')}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white">
                          {TEMPERATURES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Durée de conservation (jours)</label>
                        <input type="number" value={form.duree_conservation} onChange={setF('duree_conservation')} min={1}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Commande minimum (MOQ)</label>
                        <input type="number" value={form.commande_min} onChange={setF('commande_min')} min={1}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Colisage (unités / carton)</label>
                        <input type="number" value={form.colisage} onChange={setF('colisage')} min={1}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-2">Palettisation</label>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-stone-400 block mb-0.5">Cartons / couche</label>
                          <input type="number" value={form.cartons_per_layer} onChange={setF('cartons_per_layer')} min={0}
                            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                        </div>
                        <div>
                          <label className="text-xs text-stone-400 block mb-0.5">Couches / palette</label>
                          <input type="number" value={form.layers_per_palette} onChange={setF('layers_per_palette')} min={0}
                            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                        </div>
                      </div>
                    </div>

                    <hr className="border-stone-100" />
                    <DimForm label="Dimensions unité" value={dimUnite} onChange={setDimUnite} />
                    <hr className="border-stone-100" />
                    <DimForm label="Dimensions carton" value={dimCarton} onChange={setDimCarton} />
                    <hr className="border-stone-100" />
                    <DimForm label="Dimensions palette" value={dimPalette} onChange={setDimPalette} />
                  </>
                )}

                {/* ── Commerce ───────────────────────────────────────────── */}
                {activeTab === 'commerce' && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Pays d'origine</label>
                        <input type="text" value={form.pays_origine} onChange={setF('pays_origine')}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Devise</label>
                        <select value={form.devise} onChange={setF('devise')}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white">
                          {DEVISES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">
                        Pays d'export autorisés <span className="text-stone-400 font-normal">(séparés par des virgules)</span>
                      </label>
                      <textarea rows={2} value={form.pays_export_text} onChange={setF('pays_export_text')}
                        placeholder="France, Espagne, Allemagne, Canada, Maroc..."
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none" />
                    </div>

                    <CheckGroup title="Incoterms disponibles" options={INCOTERMS}
                      selected={form.incoterms_dispo}
                      onChange={v => setForm(f => ({ ...f, incoterms_dispo: v }))} />

                    <CheckGroup title="Certifications" options={CERTIFICATIONS_LIST}
                      selected={form.certifications}
                      onChange={v => setForm(f => ({ ...f, certifications: v }))} />

                    <CheckGroup title="Régimes alimentaires" options={REGIMES_LIST}
                      selected={form.regimes}
                      onChange={v => setForm(f => ({ ...f, regimes: v }))} />
                  </>
                )}

                {/* ── Composition ────────────────────────────────────────── */}
                {activeTab === 'composition' && (
                  <>
                    <CheckGroup title="Allergènes présents" options={ALLERGENES_LIST}
                      selected={form.allergenes}
                      onChange={v => setForm(f => ({ ...f, allergenes: v }))} />

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">Liste des ingrédients</label>
                      <textarea rows={4} value={form.ingredients_texte} onChange={setF('ingredients_texte')}
                        placeholder="Eau, sucre, farine de blé, huile de tournesol, sel..."
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none" />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">Informations nutritionnelles</label>
                      <textarea rows={6} value={form.nutrition_texte} onChange={setF('nutrition_texte')}
                        placeholder="Valeurs pour 100g :&#10;Énergie : 350 kcal&#10;Protéines : 5 g&#10;Glucides : 60 g  dont sucres : 20 g&#10;Lipides : 8 g"
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none font-mono" />
                    </div>
                  </>
                )}

                {/* ── Tarifs ─────────────────────────────────────────────── */}
                {activeTab === 'tarifs' && (
                  <>
                    <p className="text-xs text-stone-500">
                      Définissez des prix dégressifs en fonction de la quantité commandée.
                    </p>

                    {pricingTiers.length > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 text-xs text-stone-400 px-1">
                          <span>Qté minimum</span><span>Prix unitaire</span><span>Devise</span><span />
                        </div>
                        {pricingTiers.map((tier, i) => (
                          <div key={i} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
                            <input type="number" value={tier.min_quantity} min={1} placeholder="ex: 100"
                              onChange={e => {
                                const t = [...pricingTiers];
                                t[i] = { ...t[i], min_quantity: e.target.value };
                                setPricingTiers(t);
                              }}
                              className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                            <input type="number" value={tier.price} min={0} step="0.01" placeholder="ex: 1.50"
                              onChange={e => {
                                const t = [...pricingTiers];
                                t[i] = { ...t[i], price: e.target.value };
                                setPricingTiers(t);
                              }}
                              className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                            <select value={tier.currency}
                              onChange={e => {
                                const t = [...pricingTiers];
                                t[i] = { ...t[i], currency: e.target.value };
                                setPricingTiers(t);
                              }}
                              className="border border-stone-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-amber-400 bg-white">
                              {['EUR', 'USD', 'MAD', 'GBP'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button type="button" onClick={() => setPricingTiers(t => t.filter((_, j) => j !== i))}
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                              <Minus className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button type="button"
                      onClick={() => setPricingTiers(t => [...t, { min_quantity: '', price: '', currency: form.devise || 'EUR' }])}
                      className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium border border-amber-200 hover:border-amber-400 px-3 py-2 rounded-lg transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter un palier de prix
                    </button>
                  </>
                )}

              </div>
            </form>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-stone-100 shrink-0 bg-stone-50 rounded-b-2xl">
              <button type="button" onClick={() => setModal(null)}
                className="flex-1 border border-stone-200 text-stone-600 text-sm py-2.5 rounded-xl hover:bg-white transition-colors">
                Annuler
              </button>
              <button type="submit" form="product-form" disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save className="w-4 h-4" />}
                {modal === 'add' ? 'Créer le produit' : 'Enregistrer les modifications'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
