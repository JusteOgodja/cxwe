import { Link } from 'react-router-dom';
import {
  ShieldCheck, Building2, Boxes, FileCheck2,
  Quote, ArrowRight, Star, Globe, Leaf, ScrollText, Lock,
  ClipboardCheck, Sparkles,
} from 'lucide-react';

/* ── Chiffres clés (vérifiables — issus du catalogue & du travail qualité) ─── */
const STATS = [
  { value: '16 800+', label: 'Références vérifiées' },
  { value: '30', label: 'Catégories alimentaires' },
  { value: '1 800+', label: 'Marques référencées' },
  { value: '100 %', label: 'Fiches contrôlées' },
];

/* ── Processus de vérification (réel) ─────────────────────────────────────── */
const PROCESS = [
  { icon: Building2, step: '01', title: 'Vérification de l’entreprise', text: 'Identité, activité et légitimité du fournisseur contrôlées avant référencement.' },
  { icon: Boxes, step: '02', title: 'Contrôle du produit', text: 'Catégorisation, cohérence prix, origine et conformité au périmètre alimentaire marocain.' },
  { icon: ClipboardCheck, step: '03', title: 'Validation & publication', text: 'Seules les fiches conformes et contrôlées sont publiées.' },
];

/* ── Certifications & normes de référence ─────────────────────────────────── */
const CERTIFS = [
  { name: 'Halal', desc: 'Conformité alimentaire' },
  { name: 'Bio / AB', desc: 'Agriculture biologique' },
  { name: 'ONSSA', desc: 'Sécurité sanitaire (Maroc)' },
  { name: 'ISO 22000', desc: 'Management sécurité des aliments' },
  { name: 'HACCP', desc: 'Maîtrise des dangers' },
  { name: 'IFS / BRC', desc: 'Standards distribution' },
];

/* ── Garanties ────────────────────────────────────────────────────────────── */
const GARANTIES = [
  { icon: FileCheck2, title: 'Qualité produit', text: 'Références sourcées auprès de fournisseurs marocains, conditionnement et étiquetage adaptés aux marchés cibles.' },
  { icon: ScrollText, title: 'Fiabilité de l’information', text: 'Prix, catégories et descriptions vérifiés.' },
  { icon: Lock, title: 'Sécurité & confidentialité', text: 'Vos demandes de devis et données de contact sont traitées de manière confidentielle.' },
];

/* ── Partenaires (À PERSONNALISER avec de vrais partenaires) ──────────────── */
const PARTNERS = ['Partenaire 1', 'Partenaire 2', 'Partenaire 3', 'Partenaire 4', 'Partenaire 5', 'Partenaire 6'];

/* ── Témoignages (À REMPLACER par de vraies références) ───────────────────── */
const TESTIMONIALS = [
  { quote: 'Un catalogue clair et des informations fiables, exactement ce qu’on attend d’un partenaire à l’export.', author: 'Acheteur — Distribution', region: 'Europe' },
  { quote: 'Réactivité sur les devis et transparence sur l’origine des produits. Une vraie différence.', author: 'Importateur agroalimentaire', region: 'Afrique de l’Ouest' },
  { quote: 'La rigueur sur la qualité des données inspire confiance dès la première commande.', author: 'Centrale d’achat', region: 'Golfe' },
];

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`max-w-6xl mx-auto px-4 ${className}`}>{children}</section>;
}

export default function Trust() {
  return (
    <div className="min-h-screen bg-ma-cream">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-b from-ma-navy to-[#0A1833] pt-28 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-ma-gold/15 border border-ma-gold/30 rounded-full px-5 py-1.5 mb-6 backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-ma-gold" />
            <span className="text-ma-gold text-xs font-semibold tracking-widest uppercase">Confiance & Transparence</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
            La confiance, notre première <span className="text-ma-gold">exportation</span>
          </h1>
          <p className="text-stone-300 mt-5 text-base leading-relaxed max-w-2xl mx-auto">
            Nous bâtissons une plateforme B2B où chaque information publiée est vérifiée, chaque produit contrôlé,
            et chaque engagement tenu. Voici comment nous garantissons la fiabilité de notre catalogue.
          </p>
        </div>
      </div>

      {/* ── Chiffres clés ────────────────────────────────────────────────── */}
      <Section className="-mt-12 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow-card p-6 text-center">
              <div className="text-3xl font-bold text-ma-navy">{s.value}</div>
              <div className="text-stone-500 text-xs mt-1.5 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Processus de vérification ────────────────────────────────────── */}
      <div className="bg-white border-y border-ma-sand py-16">
        <Section>
          <div className="text-center mb-12">
            <p className="text-ma-red text-xs font-semibold uppercase tracking-widest mb-2">Notre méthode</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-ma-navy">Comment nous vérifions produits & entreprises</h2>
            <p className="text-stone-500 text-sm mt-3 max-w-2xl mx-auto">
              Un processus rigoureux, appliqué à l’ensemble du catalogue, du sourcing à la publication.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-5">
            {PROCESS.map(p => (
              <div key={p.step} className="relative rounded-2xl border border-ma-sand p-6 bg-ma-cream/40 w-full sm:w-[300px]">
                <span className="absolute top-4 right-5 text-3xl font-bold text-ma-sand">{p.step}</span>
                <div className="w-11 h-11 rounded-xl bg-ma-navy flex items-center justify-center mb-4">
                  <p.icon className="w-5 h-5 text-ma-gold" />
                </div>
                <h3 className="font-semibold text-ma-navy mb-1.5">{p.title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Certifications ───────────────────────────────────────────────── */}
      <Section className="py-16">
        <div className="text-center mb-10">
          <p className="text-ma-red text-xs font-semibold uppercase tracking-widest mb-2">Normes & certifications</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ma-navy">Les standards que nous privilégions</h2>
          <p className="text-stone-500 text-sm mt-3 max-w-2xl mx-auto">
  
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {CERTIFS.map(c => (
            <div key={c.name} className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-ma-green/10 flex items-center justify-center shrink-0">
                <Leaf className="w-5 h-5 text-ma-green" />
              </div>
              <div>
                <div className="font-semibold text-ma-navy">{c.name}</div>
                <div className="text-stone-400 text-xs">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-stone-400 text-xs mt-6 max-w-2xl mx-auto">
          Les certifications affichées sur une fiche produit correspondent aux informations communiquées par le fournisseur.
        </p>
      </Section>

      {/* ── Garanties ────────────────────────────────────────────────────── */}
      <div className="bg-ma-navy py-16">
        <Section>
          <div className="text-center mb-10">
            <p className="text-ma-gold text-xs font-semibold uppercase tracking-widest mb-2">Nos garanties</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Qualité & fiabilité, sans compromis</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {GARANTIES.map(g => (
              <div key={g.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="w-11 h-11 rounded-xl bg-ma-gold/15 flex items-center justify-center mb-4">
                  <g.icon className="w-5 h-5 text-ma-gold" />
                </div>
                <h3 className="font-semibold text-white mb-1.5">{g.title}</h3>
                <p className="text-stone-400 text-sm leading-relaxed">{g.text}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Partenaires ──────────────────────────────────────────────────── */}
      <Section className="py-16">
        <div className="text-center mb-10">
          <p className="text-ma-red text-xs font-semibold uppercase tracking-widest mb-2">Ils nous font confiance</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ma-navy">Partenaires & références</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {PARTNERS.map(p => (
            <div key={p} className="h-20 rounded-xl bg-white shadow-card flex items-center justify-center text-stone-300 text-sm font-semibold">
              {p}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Témoignages ──────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-ma-sand py-16">
        <Section>
          <div className="text-center mb-10">
            <p className="text-ma-red text-xs font-semibold uppercase tracking-widest mb-2">Témoignages</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-ma-navy">La parole à nos acheteurs</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-2xl border border-ma-sand p-6 bg-ma-cream/40 flex flex-col">
                <Quote className="w-7 h-7 text-ma-gold/50 mb-3" />
                <p className="text-stone-600 text-sm leading-relaxed flex-1">“{t.quote}”</p>
                <div className="flex items-center gap-0.5 mt-4 text-ma-gold">
                  {Array.from({ length: 5 }).map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-current" />)}
                </div>
                <div className="mt-3 pt-3 border-t border-ma-sand">
                  <div className="font-semibold text-ma-navy text-sm">{t.author}</div>
                  <div className="text-stone-400 text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> {t.region}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <Section className="py-16">
        <div className="relative overflow-hidden bg-gradient-to-br from-ma-navy to-[#0A1833] rounded-3xl p-10 sm:p-14 text-center">
          <div className="absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative">
            <Sparkles className="w-8 h-8 text-ma-gold mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Prêt à travailler avec un partenaire de confiance ?</h2>
            <p className="text-stone-300 text-sm mb-7 max-w-xl mx-auto">
              Parcourez notre catalogue vérifié ou demandez un devis personnalisé — réponse sous 24 h.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/catalog" className="inline-flex items-center gap-2 bg-ma-red hover:bg-[#A83928] text-white text-sm font-semibold px-7 py-3 rounded-xl transition-colors">
                Voir le catalogue <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/quote" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold px-7 py-3 rounded-xl transition-colors">
                Demander un devis
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
