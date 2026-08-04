import { useEffect, useState } from 'react';
import { Save, RefreshCw, CheckCircle, AlertCircle, Globe, Mail, Phone, MessageSquare, Bell, Info, Image, DollarSign, Linkedin, Instagram, Facebook, Building2, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface Setting {
  key: string;
  value: string;
  description?: string;
}

const DEFAULTS: Setting[] = [
  // Contact
  { key: 'contact_email', value: '', description: "Email affiché dans les formulaires de contact" },
  { key: 'contact_whatsapp', value: '', description: "Numéro WhatsApp au format international (+212...)" },
  { key: 'contact_phone', value: '', description: "Téléphone fixe ou mobile principal" },
  // Identité
  { key: 'site_name', value: 'Morocco Food Export', description: "Nom du site affiché dans le footer et les emails" },
  { key: 'site_tagline', value: '', description: "Slogan ou accroche principale" },
  { key: 'site_logo_url', value: '', description: "URL du logo principal (format PNG/SVG recommandé)" },
  { key: 'default_currency', value: 'EUR', description: "Devise par défaut affichée dans le catalogue" },
  { key: 'banner_text', value: '', description: "Bannière optionnelle en haut du site (laisser vide pour masquer)" },
  // Réseaux sociaux
  { key: 'social_linkedin', value: '', description: "URL profil LinkedIn de la société" },
  { key: 'social_instagram', value: '', description: "URL profil Instagram" },
  { key: 'social_facebook', value: '', description: "URL page Facebook" },
  // Alertes
  { key: 'alert_new_quote', value: 'true', description: "Recevoir un email à chaque nouveau devis" },
  { key: 'alert_new_buyer', value: 'false', description: "Recevoir un email à chaque nouvelle inscription acheteur" },
  // Légal
  { key: 'legal_company_name', value: '', description: "Raison sociale (pour les CGV et mentions légales)" },
  { key: 'legal_address', value: '', description: "Adresse du siège social" },
  { key: 'legal_siret', value: '', description: "Numéro RC / SIRET / IF" },
  // Maintenance
  { key: 'maintenance_mode', value: 'false', description: "Afficher une page de maintenance aux visiteurs" },
];

// L'autorité admin (clé historique `admin_emails`) N'EST PLUS gérée par cette page :
// l'accès est déterminé côté serveur (public.is_admin()). Cette clé est filtrée
// explicitement au chargement ET avant tout enregistrement (voir plus bas), afin
// qu'une éventuelle régression réintroduisant la ligne dans l'état React ne puisse
// jamais l'inclure dans le payload envoyé à Supabase.
const LEGACY_ADMIN_AUTHORITY_KEY = 'admin_emails';

const SECTION_ICONS: Record<string, typeof Globe> = {
  contact_email: Mail,
  contact_whatsapp: MessageSquare,
  contact_phone: Phone,
  site_name: Globe,
  site_tagline: Globe,
  site_logo_url: Image,
  default_currency: DollarSign,
  banner_text: Info,
  social_linkedin: Linkedin,
  social_instagram: Instagram,
  social_facebook: Facebook,
  alert_new_quote: Bell,
  alert_new_buyer: Bell,
  legal_company_name: Building2,
  legal_address: Building2,
  legal_siret: FileText,
  maintenance_mode: Info,
};

const SECTIONS = [
  { title: 'Coordonnées de contact', keys: ['contact_email', 'contact_whatsapp', 'contact_phone'] },
  { title: 'Identité du site', keys: ['site_name', 'site_tagline', 'site_logo_url', 'default_currency', 'banner_text'] },
  { title: 'Réseaux sociaux', keys: ['social_linkedin', 'social_instagram', 'social_facebook'] },
  { title: 'Alertes & notifications', keys: ['alert_new_quote', 'alert_new_buyer'] },
  { title: 'Informations légales', keys: ['legal_company_name', 'legal_address', 'legal_siret'] },
  { title: 'Mode maintenance', keys: ['maintenance_mode'] },
];

export default function Settings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('site_settings').select('key, value');
      const rows = (data ?? []) as Setting[];
      const map: Record<string, string> = {};
      // Start with defaults
      DEFAULTS.forEach(d => { map[d.key] = d.value; });
      // Override with DB values — FILTRAGE NIVEAU 1 : ignorer explicitement la clé
      // d'autorité historique si Supabase la renvoie (elle ne doit jamais entrer
      // dans l'état du formulaire).
      rows
        .filter(row => row.key !== LEGACY_ADMIN_AUTHORITY_KEY)
        .forEach(row => { map[row.key] = row.value; });
      setSettings(map);
      setLoading(false);
    })().catch(() => {
      setError('Impossible de charger les paramètres. Vérifiez votre connexion.');
      setLoading(false);
    });
  }, [retryCount]);

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // FILTRAGE NIVEAU 2 : ne jamais envoyer la clé d'autorité historique, même si
    // une régression l'avait réintroduite dans l'état React. La ligne admin_emails
    // est gelée côté base (RLS) ; le formulaire ne doit pas tenter de l'écrire.
    const rows = Object.entries(settings)
      .filter(([key]) => key !== LEGACY_ADMIN_AUTHORITY_KEY)
      .map(([key, value]) => ({ key, value }));
    await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const renderField = (key: string) => {
    const def = DEFAULTS.find(d => d.key === key);
    const value = settings[key] ?? def?.value ?? '';
    const Icon = SECTION_ICONS[key] || Globe;
    const isBool = value === 'true' || value === 'false';

    return (
      <div key={key} className="flex items-start gap-4 py-4 border-b border-stone-100 last:border-none">
        <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-stone-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-sm font-semibold text-stone-700" htmlFor={key}>
              {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </label>
          </div>
          {def?.description && <p className="text-xs text-stone-400 mb-2">{def.description}</p>}
          {isBool ? (
            <button
              type="button"
              onClick={() => handleChange(key, value === 'true' ? 'false' : 'true')}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value === 'true' ? 'bg-amber-500' : 'bg-stone-200'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value === 'true' ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          ) : (
            <input
              id={key}
              type={key.includes('email') ? 'email' : key.includes('phone') || key.includes('whatsapp') ? 'tel' : 'text'}
              value={value}
              onChange={e => handleChange(key, e.target.value)}
              placeholder={key === 'contact_email' ? 'contact@example.com' : key === 'contact_whatsapp' ? '+212 6 00 00 00 00' : ''}
              className="w-full max-w-md border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-800 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{t('admin.pages.settings.title')}</h1>
          <p className="text-stone-500 text-sm mt-1">{t('admin.pages.settings.subtitle')}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className={`flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all disabled:opacity-50 shadow-sm ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? t('admin.pages.settings.saved') : t('admin.pages.settings.saveBtn')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1); }}
            className="text-xs font-semibold underline hover:no-underline whitespace-nowrap">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
              <div className="h-4 bg-stone-200 rounded w-40 mb-4 animate-pulse" />
              {[0, 1].map(j => <div key={j} className="h-10 bg-stone-100 rounded-xl mb-3 animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map(section => (
            <div key={section.title} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide">{section.title}</h2>
              </div>
              <div className="px-5">
                {section.keys.map(key => renderField(key))}
              </div>
            </div>
          ))}

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
            <strong>Note :</strong> Cette page nécessite la table <code className="bg-amber-100 px-1 rounded">site_settings</code> dans Supabase (colonnes : <code className="bg-amber-100 px-1 rounded">key text PRIMARY KEY, value text</code>). L'accès administrateur est déterminé côté serveur ; cette page ne gère pas l'autorité d'administration.
          </div>
        </div>
      )}
    </div>
  );
}
