import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, AlertCircle, CheckCircle, Image, Hash, Tag, Building2,
  RefreshCw, X, Save, ChevronRight, ExternalLink, FileText,
  Ship, Globe, Package, Weight, Award, Wheat,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOTERMS   = ['EXW', 'FOB', 'FCA', 'CIF', 'CFR', 'DDP', 'DAP'];
const CERTS_LIST  = ['Halal', 'Bio', 'ISO 22000', 'HACCP', 'IFS', 'BRC', 'GlobalGAP', 'Fairtrade', 'Kosher'];
const ALLERG_LIST = [
  'Gluten', 'Crustacés', 'Œufs', 'Poisson', 'Arachides', 'Soja',
  'Lait', 'Fruits à coque', 'Céleri', 'Moutarde', 'Graines de sésame', 'Anhydride sulfureux',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type IssueKey =
  | 'image' | 'ean' | 'description' | 'marque' | 'categorie'
  | 'hs_code' | 'pays_origine' | 'incoterms' | 'moq' | 'colisage'
  | 'description_courte' | 'certifications' | 'allergenes'
  | 'poids' | 'pays_export';

type Severity = 'base' | 'critique' | 'important' | 'souhaitable';
type FilterKey = 'all' | IssueKey;

interface IssueDef {
  label: string;
  chip: string;
  chipDark: string;
  icon: typeof Image;
  severity: Severity;
  statKey: string;
}

interface ProblemProduct {
  id: string;
  name: string;
  image_url: string | null;
  ean: string | null;
  description: string | null;
  marque_id: string | null;
  category_id: string | null;
  hs_code: string | null;
  pays_origine: string | null;
  incoterms_dispo: string[] | null;
  commande_min: number | null;
  colisage: number | null;
  certifications: string[] | null;
  allergenes: string[] | null;
  poids_brut_kg: number | null;
  pays_export_autorises: string[] | null;
  issues: IssueKey[];
  issue_count: number;
}

interface QualityStats {
  total: number; active: number;
  no_image: number; no_ean: number; no_description: number; no_brand: number; no_category: number;
  no_hs_code: number; no_pays_origine: number; no_incoterms: number; no_moq: number; no_colisage: number;
  short_description: number; no_certifications: number; no_allergenes: number;
  no_poids: number; no_pays_export: number;
  brands_no_products: number; categories_no_products: number;
  products_with_issues: number;
}

interface SelectOpt { id: string; name: string; }

// ─── Issue definitions ────────────────────────────────────────────────────────

const ISSUES: Record<IssueKey, IssueDef> = {
  // Base
  image:             { label: 'Image manquante',        chip: 'bg-orange-100 text-orange-700',  chipDark: 'bg-orange-500',  icon: Image,       severity: 'base',        statKey: 'no_image' },
  ean:               { label: 'EAN manquant',            chip: 'bg-red-100 text-red-700',        chipDark: 'bg-red-500',     icon: Hash,        severity: 'base',        statKey: 'no_ean' },
  description:       { label: 'Description absente',    chip: 'bg-blue-100 text-blue-700',      chipDark: 'bg-blue-500',    icon: FileText,    severity: 'base',        statKey: 'no_description' },
  marque:            { label: 'Marque non liée',         chip: 'bg-purple-100 text-purple-700',  chipDark: 'bg-purple-500',  icon: Building2,   severity: 'base',        statKey: 'no_brand' },
  categorie:         { label: 'Catégorie manquante',     chip: 'bg-amber-100 text-amber-700',    chipDark: 'bg-amber-500',   icon: Tag,         severity: 'base',        statKey: 'no_category' },
  // Critique export
  hs_code:           { label: 'Code HS manquant',        chip: 'bg-red-100 text-red-800',        chipDark: 'bg-red-600',     icon: Hash,        severity: 'critique',    statKey: 'no_hs_code' },
  pays_origine:      { label: "Pays d'origine absent",   chip: 'bg-red-100 text-red-800',        chipDark: 'bg-red-600',     icon: Globe,       severity: 'critique',    statKey: 'no_pays_origine' },
  incoterms:         { label: 'Incoterms non renseignés',chip: 'bg-red-100 text-red-800',        chipDark: 'bg-red-600',     icon: Ship,        severity: 'critique',    statKey: 'no_incoterms' },
  moq:               { label: 'MOQ non défini',          chip: 'bg-red-100 text-red-800',        chipDark: 'bg-red-600',     icon: Package,     severity: 'critique',    statKey: 'no_moq' },
  colisage:          { label: 'Colisage non défini',     chip: 'bg-red-100 text-red-800',        chipDark: 'bg-red-600',     icon: Package,     severity: 'critique',    statKey: 'no_colisage' },
  // Important
  description_courte:{ label: 'Description trop courte', chip: 'bg-sky-100 text-sky-700',        chipDark: 'bg-sky-500',     icon: FileText,    severity: 'important',   statKey: 'short_description' },
  certifications:    { label: 'Certifications absentes', chip: 'bg-emerald-100 text-emerald-700',chipDark: 'bg-emerald-500', icon: Award,       severity: 'important',   statKey: 'no_certifications' },
  allergenes:        { label: 'Allergènes non renseignés',chip: 'bg-yellow-100 text-yellow-700', chipDark: 'bg-yellow-500',  icon: Wheat,       severity: 'important',   statKey: 'no_allergenes' },
  // Souhaitable
  poids:             { label: 'Poids non renseigné',     chip: 'bg-stone-100 text-stone-600',    chipDark: 'bg-stone-400',   icon: Weight,      severity: 'souhaitable', statKey: 'no_poids' },
  pays_export:       { label: "Pays d'export absents",   chip: 'bg-stone-100 text-stone-600',    chipDark: 'bg-stone-400',   icon: Globe,       severity: 'souhaitable', statKey: 'no_pays_export' },
};

const SEVERITY_META: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
  base:        { label: 'Données de base',     color: 'text-stone-600',   bg: 'bg-stone-50',    border: 'border-stone-200' },
  critique:    { label: 'Critique — Export',   color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200' },
  important:   { label: 'Important — Confiance', color: 'text-amber-700', bg: 'bg-amber-50',    border: 'border-amber-200' },
  souhaitable: { label: 'Souhaitable — Enrichissement', color: 'text-stone-500', bg: 'bg-stone-50', border: 'border-stone-200' },
};

const SEVERITY_ORDER: Severity[] = ['critique', 'base', 'important', 'souhaitable'];

function detectIssues(p: Omit<ProblemProduct, 'issues' | 'issue_count'>): IssueKey[] {
  const issues: IssueKey[] = [];
  if (!p.image_url)                                                      issues.push('image');
  if (!p.ean)                                                            issues.push('ean');
  if (!p.description)                                                    issues.push('description');
  else if (p.description.length < 80)                                    issues.push('description_courte');
  if (!p.marque_id)                                                      issues.push('marque');
  if (!p.category_id)                                                    issues.push('categorie');
  if (!p.hs_code)                                                        issues.push('hs_code');
  if (!p.pays_origine)                                                   issues.push('pays_origine');
  if (!p.incoterms_dispo || p.incoterms_dispo.length === 0)             issues.push('incoterms');
  if (!p.commande_min || p.commande_min <= 0)                           issues.push('moq');
  if (!p.colisage || p.colisage <= 0)                                   issues.push('colisage');
  if (!p.certifications || p.certifications.length === 0)               issues.push('certifications');
  if (!p.allergenes || p.allergenes.length === 0)                       issues.push('allergenes');
  if (!p.poids_brut_kg || p.poids_brut_kg <= 0)                        issues.push('poids');
  if (!p.pays_export_autorises || p.pays_export_autorises.length === 0) issues.push('pays_export');
  return issues;
}

// ─── Quick-fix drawer ─────────────────────────────────────────────────────────

function QuickFixDrawer({
  product, brands, categories, onClose, onSaved,
}: {
  product: ProblemProduct;
  brands: SelectOpt[];
  categories: SelectOpt[];
  onClose: () => void;
  onSaved: (updated: ProblemProduct) => void;
}) {
  const { t } = useTranslation();
  const [vals, setVals] = useState({
    image_url:   product.image_url || '',
    ean:         product.ean || '',
    description: product.description || '',
    marque_id:   product.marque_id || '',
    category_id: product.category_id || '',
    hs_code:     product.hs_code || '',
    pays_origine: product.pays_origine || '',
    incoterms_dispo: product.incoterms_dispo || [] as string[],
    commande_min: String(product.commande_min || ''),
    colisage:    String(product.colisage || ''),
    certifications: product.certifications || [] as string[],
    allergenes:  product.allergenes || [] as string[],
    poids_brut_kg: String(product.poids_brut_kg || ''),
    pays_export: (product.pays_export_autorises || []).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const issues = product.issues;
  const set = (k: keyof typeof vals) => (v: string | string[]) => {
    setVals(prev => ({ ...prev, [k]: v }));
    setSaved(false);
  };
  const toggleArr = (k: 'incoterms_dispo' | 'certifications' | 'allergenes', v: string) => {
    const arr = vals[k] as string[];
    set(k)(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const handleSave = async () => {
    setSaving(true);
    const patch: Record<string, unknown> = {};
    if (issues.includes('image'))             patch.image_url   = vals.image_url || null;
    if (issues.includes('ean'))               patch.ean         = vals.ean || null;
    if (issues.includes('description') || issues.includes('description_courte'))
                                              patch.description = vals.description || null;
    if (issues.includes('marque'))            patch.marque_id   = vals.marque_id || null;
    if (issues.includes('categorie'))         patch.category_id = vals.category_id || null;
    if (issues.includes('hs_code'))           patch.hs_code     = vals.hs_code || null;
    if (issues.includes('pays_origine'))      patch.pays_origine = vals.pays_origine || null;
    if (issues.includes('incoterms'))         patch.incoterms_dispo = vals.incoterms_dispo.length ? vals.incoterms_dispo : null;
    if (issues.includes('moq'))               patch.commande_min = vals.commande_min ? parseInt(vals.commande_min) : null;
    if (issues.includes('colisage'))          patch.colisage    = vals.colisage ? parseInt(vals.colisage) : null;
    if (issues.includes('certifications'))    patch.certifications = vals.certifications.length ? vals.certifications : null;
    if (issues.includes('allergenes'))        patch.allergenes  = vals.allergenes.length ? vals.allergenes : null;
    if (issues.includes('poids'))             patch.poids_brut_kg = vals.poids_brut_kg ? parseFloat(vals.poids_brut_kg) : null;
    if (issues.includes('pays_export'))       patch.pays_export_autorises = vals.pays_export ? vals.pays_export.split(',').map(s => s.trim()).filter(Boolean) : null;

    await supabase.from('products').update(patch).eq('id', product.id);
    setSaving(false);
    setSaved(true);

    const updated: ProblemProduct = {
      ...product,
      image_url:   vals.image_url || null,
      ean:         vals.ean || null,
      description: vals.description || null,
      marque_id:   vals.marque_id || null,
      category_id: vals.category_id || null,
      hs_code:     vals.hs_code || null,
      pays_origine: vals.pays_origine || null,
      incoterms_dispo: vals.incoterms_dispo.length ? vals.incoterms_dispo : null,
      commande_min: vals.commande_min ? parseInt(vals.commande_min) : null,
      colisage:    vals.colisage ? parseInt(vals.colisage) : null,
      certifications: vals.certifications.length ? vals.certifications : null,
      allergenes:  vals.allergenes.length ? vals.allergenes : null,
      poids_brut_kg: vals.poids_brut_kg ? parseFloat(vals.poids_brut_kg) : null,
      pays_export_autorises: vals.pays_export ? vals.pays_export.split(',').map(s => s.trim()).filter(Boolean) : null,
    };
    updated.issues = detectIssues(updated);
    updated.issue_count = updated.issues.length;
    onSaved(updated);
    if (updated.issues.length === 0) setTimeout(onClose, 500);
  };

  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition';
  const lbl = 'block text-xs font-semibold text-stone-600 mb-1';

  const CheckGroup = ({ title, options, selected, field }: {
    title: string; options: string[];
    selected: string[]; field: 'incoterms_dispo' | 'certifications' | 'allergenes';
  }) => (
    <div>
      <p className={lbl}>{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const on = selected.includes(opt);
          return (
            <button key={opt} type="button"
              onClick={() => toggleArr(field, opt)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${on ? 'bg-amber-500 text-white border-amber-500' : 'border-stone-200 text-stone-600 hover:border-amber-300'}`}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  const bySeverity = SEVERITY_ORDER.map(sev => ({
    sev,
    keys: issues.filter(k => ISSUES[k].severity === sev),
  })).filter(g => g.keys.length > 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-stone-100">
          <div className="min-w-0">
            <div className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-0.5">{t('admin.pages.dataQuality.quickFix')}</div>
            <h2 className="font-bold text-stone-800 text-sm leading-snug truncate">{product.name}</h2>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {issues.map(k => (
                <span key={k} className={`text-xs px-1.5 py-0.5 rounded font-medium ${ISSUES[k].chip}`}>
                  {t(`admin.pages.dataQuality.issues.${k}`)}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link to={`/product/${product.id}`} target="_blank"
              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
              <ExternalLink className="w-4 h-4" />
            </Link>
            <button onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fields grouped by severity */}
        <div className="flex-1 overflow-y-auto">
          {bySeverity.map(({ sev, keys }) => {
            const meta = SEVERITY_META[sev];
            return (
              <div key={sev} className={`border-b ${meta.border}`}>
                <div className={`px-5 py-2 ${meta.bg}`}>
                  <span className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>{t(`admin.pages.dataQuality.severity.${sev}`)}</span>
                </div>
                <div className="px-5 py-4 space-y-4">

                  {keys.includes('image') && (
                    <div>
                      <label className={lbl}><Image className="inline w-3.5 h-3.5 mr-1 text-orange-500" />{t('admin.pages.dataQuality.imageUrl')}</label>
                      <input type="url" value={vals.image_url} onChange={e => set('image_url')(e.target.value)} placeholder="https://..." className={inp} />
                      {vals.image_url && (
                        <img src={vals.image_url} alt="preview" className="mt-2 w-20 h-20 object-cover rounded-xl border border-stone-100"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                    </div>
                  )}

                  {keys.includes('ean') && (
                    <div>
                      <label className={lbl}><Hash className="inline w-3.5 h-3.5 mr-1 text-red-500" />Code EAN / GTIN</label>
                      <input type="text" value={vals.ean} onChange={e => set('ean')(e.target.value)} placeholder="ex: 3760123456789" maxLength={14} className={inp} />
                    </div>
                  )}

                  {(keys.includes('description') || keys.includes('description_courte')) && (
                    <div>
                      <label className={lbl}>
                        <FileText className="inline w-3.5 h-3.5 mr-1 text-blue-500" />
                        {t('admin.common.description')}
                        {keys.includes('description_courte') && <span className="ml-1 text-amber-600 normal-case font-normal">{t('admin.pages.dataQuality.minimumChars')}</span>}
                      </label>
                      <textarea value={vals.description} onChange={e => set('description')(e.target.value)}
                        placeholder={t('admin.pages.dataQuality.descriptionPlaceholder')} rows={4} className={`${inp} resize-none`} />
                      <div className={`text-right text-xs mt-1 ${vals.description.length < 80 ? 'text-amber-500 font-semibold' : 'text-stone-400'}`}>
                        {vals.description.length} / 80 min
                      </div>
                    </div>
                  )}

                  {keys.includes('marque') && (
                    <div>
                      <label className={lbl}><Building2 className="inline w-3.5 h-3.5 mr-1 text-purple-500" />{t('admin.pages.products.colBrand')}</label>
                      <select value={vals.marque_id} onChange={e => set('marque_id')(e.target.value)} className={inp}>
                        <option value="">— {t('admin.pages.products.select')} —</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}

                  {keys.includes('categorie') && (
                    <div>
                      <label className={lbl}><Tag className="inline w-3.5 h-3.5 mr-1 text-amber-500" />{t('admin.pages.products.colCategory')}</label>
                      <select value={vals.category_id} onChange={e => set('category_id')(e.target.value)} className={inp}>
                        <option value="">— {t('admin.pages.products.select')} —</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  {keys.includes('hs_code') && (
                    <div>
                      <label className={lbl}><Hash className="inline w-3.5 h-3.5 mr-1 text-red-700" />Code HS (douanier)</label>
                      <input type="text" value={vals.hs_code} onChange={e => set('hs_code')(e.target.value)} placeholder="ex: 150910" maxLength={10} className={inp} />
                      <p className="text-xs text-stone-400 mt-1">{t('admin.pages.dataQuality.hsCodeHelp')}</p>
                    </div>
                  )}

                  {keys.includes('pays_origine') && (
                    <div>
                      <label className={lbl}><Globe className="inline w-3.5 h-3.5 mr-1 text-red-700" />{t('admin.pages.products.countryOfOrigin')}</label>
                      <input type="text" value={vals.pays_origine} onChange={e => set('pays_origine')(e.target.value)} placeholder="ex: Morocco" className={inp} />
                    </div>
                  )}

                  {keys.includes('incoterms') && (
                    <CheckGroup title={t('admin.pages.products.availableIncoterms')} options={INCOTERMS} selected={vals.incoterms_dispo} field="incoterms_dispo" />
                  )}

                  {keys.includes('moq') && (
                    <div>
                      <label className={lbl}><Package className="inline w-3.5 h-3.5 mr-1 text-red-700" />{t('admin.pages.dataQuality.moq')}</label>
                      <input type="number" value={vals.commande_min} onChange={e => set('commande_min')(e.target.value)} placeholder="ex: 100" min={1} className={inp} />
                    </div>
                  )}

                  {keys.includes('colisage') && (
                    <div>
                      <label className={lbl}><Package className="inline w-3.5 h-3.5 mr-1 text-red-700" />{t('admin.pages.products.packagingUnits')}</label>
                      <input type="number" value={vals.colisage} onChange={e => set('colisage')(e.target.value)} placeholder="ex: 12" min={1} className={inp} />
                    </div>
                  )}

                  {keys.includes('certifications') && (
                    <CheckGroup title={t('admin.pages.products.colCertifications')} options={CERTS_LIST} selected={vals.certifications} field="certifications" />
                  )}

                  {keys.includes('allergenes') && (
                    <CheckGroup title={t('admin.pages.dataQuality.allergensEu')} options={ALLERG_LIST} selected={vals.allergenes} field="allergenes" />
                  )}

                  {keys.includes('poids') && (
                    <div>
                      <label className={lbl}><Weight className="inline w-3.5 h-3.5 mr-1 text-stone-500" />{t('admin.pages.products.grossWeight')}</label>
                      <input type="number" value={vals.poids_brut_kg} onChange={e => set('poids_brut_kg')(e.target.value)} placeholder="ex: 0.5" min={0} step="0.001" className={inp} />
                    </div>
                  )}

                  {keys.includes('pays_export') && (
                    <div>
                      <label className={lbl}><Globe className="inline w-3.5 h-3.5 mr-1 text-stone-500" />{t('admin.pages.products.exportCountries')}</label>
                      <input type="text" value={vals.pays_export} onChange={e => set('pays_export')(e.target.value)}
                        placeholder="France, Espagne, Allemagne, ..." className={inp} />
                      <p className="text-xs text-stone-400 mt-1">{t('admin.pages.dataQuality.separateCountries')}</p>
                    </div>
                  )}

                </div>
              </div>
            );
          })}

          {saved && product.issues.length > 0 && detectIssues({ ...product,
            image_url: vals.image_url || null, ean: vals.ean || null,
            description: vals.description || null, marque_id: vals.marque_id || null,
            category_id: vals.category_id || null, hs_code: vals.hs_code || null,
            pays_origine: vals.pays_origine || null,
            incoterms_dispo: vals.incoterms_dispo.length ? vals.incoterms_dispo : null,
            commande_min: vals.commande_min ? parseInt(vals.commande_min) : null,
            colisage: vals.colisage ? parseInt(vals.colisage) : null,
            certifications: vals.certifications.length ? vals.certifications : null,
            allergenes: vals.allergenes.length ? vals.allergenes : null,
            poids_brut_kg: vals.poids_brut_kg ? parseFloat(vals.poids_brut_kg) : null,
            pays_export_autorises: vals.pays_export ? vals.pays_export.split(',').map(s => s.trim()).filter(Boolean) : null,
          }).length === 0 && (
            <div className="m-5 flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-medium">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {t('admin.pages.dataQuality.productComplete')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-stone-200 text-stone-600 text-sm font-medium py-2.5 rounded-xl hover:bg-stone-50 transition-colors">
            {t('admin.common.close')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? t('admin.common.saving') : t('admin.common.save')}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Score helpers ────────────────────────────────────────────────────────────

const SCORE_WEIGHTS: Partial<Record<IssueKey, number>> = {
  image: 1, ean: 1, description: 1, marque: 1, categorie: 1,
  hs_code: 2, pays_origine: 2, incoterms: 2, moq: 2, colisage: 2,
  description_courte: 1, certifications: 1, allergenes: 1,
};
// souhaitables not counted in score

const MAX_WEIGHT = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0); // per product

// ─── Main component ───────────────────────────────────────────────────────────

export default function DataQuality() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [problems, setProblems] = useState<ProblemProduct[]>([]);
  const [brands, setBrands] = useState<SelectOpt[]>([]);
  const [categories, setCategories] = useState<SelectOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ProblemProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    try {
    setRefreshing(true);

    const [statsRes, prodsRes, brandsRes, catsRes] = await Promise.all([
      supabase.rpc('get_quality_stats').maybeSingle(),
      supabase.rpc('get_products_with_issues', { p_limit: 2000 }),
      supabase.from('brands').select('id, name').eq('is_active', true).order('name'),
      supabase.from('categories').select('id, name').order('sort_order'),
    ]);

    if (statsRes.data) setStats(statsRes.data as QualityStats);
    setBrands((brandsRes.data || []) as SelectOpt[]);
    setCategories((catsRes.data || []) as SelectOpt[]);

    const rows = (prodsRes.data || []) as any[];
    setProblems(rows.map(p => ({ ...p, issues: detectIssues(p) })));

    setLoading(false);
    setRefreshing(false);
    } catch {
      setError(t('admin.pages.dataQuality.loadError'));
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (updated: ProblemProduct) => {
    setProblems(prev =>
      updated.issues.length === 0
        ? prev.filter(p => p.id !== updated.id)
        : prev.map(p => p.id === updated.id ? updated : p)
    );
    if (selected?.id === updated.id) setSelected(updated.issues.length > 0 ? updated : null);
  };

  // Weighted score (critiques count double)
  const score = stats && stats.active > 0
    ? (() => {
        const totalWeightedIssues = Object.entries(SCORE_WEIGHTS).reduce((acc, [k, w]) => {
          const key = k as IssueKey;
          const count = stats[ISSUES[key].statKey as keyof QualityStats] as number || 0;
          return acc + count * w;
        }, 0);
        const maxPossible = stats.active * MAX_WEIGHT;
        return Math.max(0, Math.round(100 - (totalWeightedIssues / maxPossible) * 100));
      })()
    : 0;

  const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-500' : 'text-red-600';
  const scoreBar   = score >= 80 ? 'bg-emerald-500'   : score >= 60 ? 'bg-amber-400'   : 'bg-red-500';

  const filtered = activeFilter === 'all'
    ? problems
    : problems.filter(p => p.issues.includes(activeFilter as IssueKey));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const countFor = (k: FilterKey) =>
    k === 'all'
      ? problems.length
      : stats
        ? (stats[ISSUES[k as IssueKey].statKey as keyof QualityStats] as number) ?? 0
        : 0;

  const Skel = () => <span className="inline-block w-10 h-5 bg-stone-200 rounded animate-pulse align-middle" />;

  // Group KPI cards by severity for the grid
  const kpiGroups = SEVERITY_ORDER.map(sev => ({
    sev,
    meta: SEVERITY_META[sev],
    items: Object.entries(ISSUES)
      .filter(([, d]) => d.severity === sev)
      .map(([k, d]) => ({ key: k as IssueKey, def: d, count: (stats?.[d.statKey as keyof QualityStats] as number) || 0 })),
  }));

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{t('admin.pages.dataQuality.title')}</h1>
          <p className="text-stone-500 text-sm mt-1">
            {stats
              ? t('admin.pages.dataQuality.subtitle', { count: problems.length, total: stats.active.toLocaleString('fr-FR') })
              : t('admin.common.loading')}
          </p>
        </div>
        <button onClick={load} disabled={refreshing}
          className="flex items-center gap-2 text-sm text-stone-600 border border-stone-200 rounded-xl px-4 py-2 hover:bg-stone-50 transition-colors disabled:opacity-50 shrink-0">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t('admin.pages.dataQuality.refresh')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => { setError(null); load(); }}
            className="text-xs font-semibold underline hover:no-underline whitespace-nowrap">{t('admin.common.retry')}</button>
        </div>
      )}

      {/* Score */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 flex items-center gap-5">
        <div className="text-center shrink-0">
          <div className={`text-5xl font-black leading-none ${loading ? 'text-stone-200' : scoreColor}`}>
            {loading ? '—' : score}
          </div>
          <div className="text-xs text-stone-400 font-medium mt-1">{t('admin.pages.dataQuality.score')}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-3 bg-stone-100 rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all duration-700 ${scoreBar}`}
              style={{ width: loading ? '0%' : `${score}%` }} />
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            {t('admin.pages.dataQuality.scoreHelp')}
            Souhaitables exclus du calcul.
          </p>
        </div>
      </div>

      {/* KPI grid by severity */}
      <div className="space-y-3">
        {kpiGroups.map(({ sev, meta, items }) => (
          <div key={sev} className={`rounded-2xl border ${meta.border} overflow-hidden`}>
            <div className={`px-4 py-2.5 ${meta.bg} flex items-center gap-2`}>
              <span className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>{t(`admin.pages.dataQuality.severity.${sev}`)}</span>
              <span className={`text-xs ${meta.color} opacity-60`}>
                · {t('admin.pages.dataQuality.criteriaWithIssues', { count: items.filter(i => i.count > 0).length })}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y divide-stone-100 bg-white">
              {items.map(({ key, count }) => {
                const isOk = count === 0;
                return (
                  <button key={key}
                    onClick={() => setActiveFilter(activeFilter === key ? 'all' : key)}
                    className={`text-left p-4 transition-colors ${
                      activeFilter === key ? 'bg-amber-50 ring-inset ring-2 ring-amber-400' : 'hover:bg-stone-50'
                    }`}>
                    <div className={`text-xl font-bold ${isOk ? 'text-emerald-600' : sev === 'critique' ? 'text-red-600' : sev === 'important' ? 'text-amber-600' : 'text-stone-500'}`}>
                      {loading ? <Skel /> : count.toLocaleString('fr-FR')}
                    </div>
                    <div className="text-xs font-medium text-stone-600 mt-0.5 leading-tight">{t(`admin.pages.dataQuality.issues.${key}`)}</div>
                    {!loading && (
                      <div className="flex items-center gap-1 mt-1.5 text-xs">
                        {isOk
                          ? <><CheckCircle className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600">Complet</span></>
                          : <><AlertTriangle className="w-3 h-3 text-amber-400" /><span className="text-stone-400">Filtrer</span></>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Product list */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">

        {/* Filter tabs */}
        <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-1 overflow-x-auto">
          <button onClick={() => { setActiveFilter('all'); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'all' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-100'
            }`}>
            {t('admin.pages.dataQuality.filterAll')}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-500'}`}>
              {stats ? stats.products_with_issues.toLocaleString('fr-FR') : problems.length}
            </span>
          </button>

          {/* Divider + severity groups */}
          {SEVERITY_ORDER.map(sev => {
            const keys = Object.entries(ISSUES).filter(([, d]) => d.severity === sev).map(([k]) => k as IssueKey);
            const meta = SEVERITY_META[sev];
            return (
              <div key={sev} className="flex items-center gap-1">
                <div className="w-px h-5 bg-stone-200 mx-1 shrink-0" />
                {keys.map(k => {
                  const c = countFor(k);
                  if (c === 0) return null;
                  return (
                    <button key={k} onClick={() => { setActiveFilter(activeFilter === k ? 'all' : k); setPage(1); }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        activeFilter === k ? `${sev === 'critique' ? 'bg-red-600' : sev === 'important' ? 'bg-amber-500' : 'bg-stone-500'} text-white` : `${meta.color} hover:bg-stone-100`
                      }`}>
                      {t(`admin.pages.dataQuality.issues.${k}`)}
                      <span className={`text-xs px-1 py-0.5 rounded-full font-bold ${activeFilter === k ? 'bg-white/25 text-white' : 'bg-stone-200 text-stone-500'}`}>{c}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-stone-700 font-semibold">{t('admin.pages.dataQuality.noIssues')}</p>
            <p className="text-stone-400 text-sm mt-1">{t('admin.pages.dataQuality.noIssuesDesc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {paginated.map(p => {
              const hasCritique = p.issues.some(k => ISSUES[k].severity === 'critique');
              const hasImportant = !hasCritique && p.issues.some(k => ISSUES[k].severity === 'important');
              return (
                <button key={p.id} onClick={() => setSelected(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 transition-colors text-left group">
                  {/* Severity stripe */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${hasCritique ? 'bg-red-400' : hasImportant ? 'bg-amber-400' : 'bg-stone-200'}`} />

                  {/* Thumbnail */}
                  <div className="w-9 h-9 rounded-lg bg-stone-100 shrink-0 overflow-hidden flex items-center justify-center">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : <Image className="w-4 h-4 text-stone-400" />}
                  </div>

                  {/* Name + chips */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-800 text-sm truncate">{p.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.issues.slice(0, 5).map(k => (
                        <span key={k} className={`text-xs px-1.5 py-0.5 rounded font-medium ${ISSUES[k].chip}`}>
                          {t(`admin.pages.dataQuality.issues.${k}`)}
                        </span>
                      ))}
                      {p.issues.length > 5 && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-stone-100 text-stone-500">
                          +{p.issues.length - 5}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Count + arrow */}
                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      hasCritique ? 'bg-red-100 text-red-700' : hasImportant ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'
                    }`}>
                      {p.issues.length}
                    </span>
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-amber-500 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-stone-100 flex items-center justify-between gap-4">
            <span className="text-xs text-stone-400">
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length} produit{filtered.length !== 1 ? 's' : ''} — cliquez pour corriger
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  ←
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (n as number) - (arr[idx - 1] as number) > 1) acc.push('…');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === '…'
                      ? <span key={`ellipsis-${i}`} className="px-1 text-xs text-stone-400">…</span>
                      : <button
                          key={n}
                          onClick={() => setPage(n as number)}
                          className={`min-w-[28px] py-1 text-xs font-semibold rounded-lg border transition-colors ${
                            page === n
                              ? 'bg-stone-800 text-white border-stone-800'
                              : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}>
                          {n}
                        </button>
                  )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Orphan entities */}
      {stats && (stats.brands_no_products > 0 || stats.categories_no_products > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.brands_no_products > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-stone-400" />
                <span className="text-sm font-semibold text-stone-700">{t('admin.pages.dataQuality.brandsWithoutProducts')}</span>
              </div>
              <div className="text-3xl font-bold text-amber-600">{stats.brands_no_products}</div>
              <Link to="/admin/brands" className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium mt-2">
                {t('admin.pages.dataQuality.manageBrands')} <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
          {stats.categories_no_products > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Tag className="w-4 h-4 text-stone-400" />
                <span className="text-sm font-semibold text-stone-700">{t('admin.pages.dataQuality.categoriesWithoutProducts')}</span>
              </div>
              <div className="text-3xl font-bold text-amber-600">{stats.categories_no_products}</div>
              <Link to="/admin/categories" className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium mt-2">
                {t('admin.pages.dataQuality.manageCategories')} <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <QuickFixDrawer
          product={selected}
          brands={brands}
          categories={categories}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
