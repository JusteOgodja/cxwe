import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Building2, Boxes, FileCheck2,
  Quote, ArrowRight, Star, Globe, Leaf, ScrollText, Lock,
  ClipboardCheck, Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

const PROC_ICONS = [Building2, Boxes, ClipboardCheck];
const GUAR_ICONS = [FileCheck2, ScrollText, Lock];
const PARTNERS = ['Partenaire 1', 'Partenaire 2', 'Partenaire 3', 'Partenaire 4', 'Partenaire 5', 'Partenaire 6'];

interface PlatformStats {
  products: number | null;
  brands: number | null;
  categories: number | null;
}

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`max-w-6xl mx-auto px-4 ${className}`}>{children}</section>;
}

export default function Trust() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<PlatformStats>({ products: null, brands: null, categories: null });

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('brands').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('categories').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]).then(([products, brands, cats]) => {
      setStats({ products: products.count, brands: brands.count, categories: cats.count });
    });
  }, []);

  const fmt = (n: number | null) => n == null ? '…' : `${n.toLocaleString()}+`;

  const STATS = [
    { value: fmt(stats.products), label: t('trust.stat1label') },
    { value: fmt(stats.categories), label: t('trust.stat2label') },
    { value: fmt(stats.brands), label: t('trust.stat3label') },
    { value: t('trust.stat4value'), label: t('trust.stat4label') },
  ];

  const PROCESS = [1, 2, 3].map((n, i) => ({
    icon: PROC_ICONS[i],
    step: `0${n}`,
    title: t(`trust.proc${n}title`),
    text: t(`trust.proc${n}text`),
  }));

  const CERTIFS = [1, 2, 3, 4, 5, 6].map(n => ({
    name: t(`trust.cert${n}name`),
    desc: t(`trust.cert${n}desc`),
  }));

  const GARANTIES = [1, 2, 3].map((n, i) => ({
    icon: GUAR_ICONS[i],
    title: t(`trust.guar${n}title`),
    text: t(`trust.guar${n}text`),
  }));

  const TESTIMONIALS = [1, 2, 3].map(n => ({
    quote: t(`trust.test${n}quote`),
    author: t(`trust.test${n}author`),
    region: t(`trust.test${n}region`),
  }));

  return (
    <div className="min-h-screen bg-ma-cream">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-b from-ma-navy to-[#0A1833] pt-28 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-ma-gold/15 border border-ma-gold/30 rounded-full px-5 py-1.5 mb-6 backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-ma-gold" />
            <span className="text-ma-gold text-xs font-semibold tracking-widest uppercase">{t('trust.badge')}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
            {t('trust.heading')} <span className="text-ma-gold">{t('trust.headingAccent')}</span>
          </h1>
          <p className="text-stone-300 mt-5 text-base leading-relaxed max-w-2xl mx-auto">
            {t('trust.sub')}
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
            <p className="text-ma-red text-xs font-semibold uppercase tracking-widest mb-2">{t('trust.methodLabel')}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-ma-navy">{t('trust.methodTitle')}</h2>
            <p className="text-stone-500 text-sm mt-3 max-w-2xl mx-auto">{t('trust.methodSub')}</p>
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
          <p className="text-ma-red text-xs font-semibold uppercase tracking-widest mb-2">{t('trust.certsLabel')}</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ma-navy">{t('trust.certsTitle')}</h2>
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
          {t('trust.certsNote')}
        </p>
      </Section>

      {/* ── Garanties ────────────────────────────────────────────────────── */}
      <div className="bg-ma-navy py-16">
        <Section>
          <div className="text-center mb-10">
            <p className="text-ma-gold text-xs font-semibold uppercase tracking-widest mb-2">{t('trust.guaranteesLabel')}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('trust.guaranteesTitle')}</h2>
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
          <p className="text-ma-red text-xs font-semibold uppercase tracking-widest mb-2">{t('trust.partnersLabel')}</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ma-navy">{t('trust.partnersTitle')}</h2>
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
            <p className="text-ma-red text-xs font-semibold uppercase tracking-widest mb-2">{t('trust.testimonialsLabel')}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-ma-navy">{t('trust.testimonialsTitle')}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((item, i) => (
              <div key={i} className="rounded-2xl border border-ma-sand p-6 bg-ma-cream/40 flex flex-col">
                <Quote className="w-7 h-7 text-ma-gold/50 mb-3" />
                <p className="text-stone-600 text-sm leading-relaxed flex-1">"{item.quote}"</p>
                <div className="flex items-center gap-0.5 mt-4 text-ma-gold">
                  {Array.from({ length: 5 }).map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-current" />)}
                </div>
                <div className="mt-3 pt-3 border-t border-ma-sand">
                  <div className="font-semibold text-ma-navy text-sm">{item.author}</div>
                  <div className="text-stone-400 text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> {item.region}</div>
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
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">{t('trust.ctaTitle')}</h2>
            <p className="text-stone-300 text-sm mb-7 max-w-xl mx-auto">{t('trust.ctaSub')}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/catalog" className="inline-flex items-center gap-2 bg-ma-red hover:bg-[#A83928] text-white text-sm font-semibold px-7 py-3 rounded-xl transition-colors">
                {t('trust.ctaCatalog')} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/quote" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold px-7 py-3 rounded-xl transition-colors">
                {t('trust.ctaQuote')}
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
