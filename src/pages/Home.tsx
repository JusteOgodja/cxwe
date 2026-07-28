import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Award, Truck, Users, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CategoryCard from '../components/CategoryCard';
import type { Category } from '../types';
import { useTranslation } from 'react-i18next';

const FEATURE_ICONS = [Award, Globe, Truck, Users];

interface PlatformStats {
  products: number | null;
  brands: number | null;
  categories: number | null;
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState<PlatformStats>({ products: null, brands: null, categories: null });
  const { t } = useTranslation();

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setCategories(data || []);
        setLoading(false);
      });

    // Fetch platform stats in parallel
    Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('brands').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('categories').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]).then(([products, brands, cats]) => {
      setPlatformStats({
        products: products.count,
        brands: brands.count,
        categories: cats.count,
      });
    });
  }, []);

  const formatCount = (n: number | null, suffix = '+') =>
    n == null ? '…' : `${n.toLocaleString()}${suffix}`;

  const STATS = [
    { value: formatCount(platformStats.products), label: t('home.stat1.label') },
    { value: formatCount(platformStats.brands), label: t('home.stat2.label') },
    { value: formatCount(platformStats.categories), label: t('home.stat3.label') },
    { value: t('home.stat4.value'), label: t('home.stat4.label') },
  ];

  const FEATURES = [1, 2, 3, 4].map(n => ({
    title: t(`home.feat${n}.title`),
    description: t(`home.feat${n}.description`),
  }));

  return (
    <div className="min-h-screen bg-stone-50">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

        {/* Video background */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/hero.mp4"
          autoPlay
          loop
          muted
          playsInline
        />

        {/* Navy overlay */}
        <div className="absolute inset-0 bg-ma-navy/75" />

        {/* Hero content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-ma-red/20 border border-ma-red/40 rounded-full px-5 py-1.5 mb-6 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-ma-red animate-pulse" />
            <span className="text-red-200 text-xs font-semibold tracking-widest uppercase">
              {t('home.badge')}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-ma-red animate-pulse" />
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-bold text-white leading-tight mb-4 tracking-tight">
            {t('home.heading1')}
            <span className="block mt-1 text-ma-red">{t('home.heading2')}</span>
          </h1>

          <p className="text-blue-100 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto mb-10 leading-relaxed px-2">
            {t('home.sub')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/catalog"
              className="group relative overflow-hidden bg-ma-red hover:bg-[#9B1E24] text-white font-bold px-9 py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-ma-red/30"
            >
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <span className="relative">{t('home.cta1')}</span>
              <ArrowRight className="w-4 h-4 relative group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/quote"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold px-9 py-4 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/30 hover:border-white/50"
            >
              {t('home.cta2')}
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
          <ChevronDown className="w-5 h-5" />
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="bg-ma-navy py-10">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-white">{s.value}</div>
              <div className="text-blue-200 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="w-12 h-1 bg-ma-red mx-auto mb-4 rounded-full" />
          <h2 className="text-3xl font-bold text-stone-800 mb-3">{t('home.categoriesTitle')}</h2>
          <p className="text-stone-500 max-w-xl mx-auto text-sm leading-relaxed">
            {t('home.categoriesSub')}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-stone-100 animate-pulse h-52" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {categories.map((cat, i) => (
              <CategoryCard key={cat.id} category={cat} index={i} />
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            to="/catalog"
            className="inline-flex items-center gap-2 text-ma-green hover:text-[#004D28] font-semibold text-sm transition-colors"
          >
            {t('home.viewAll')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="w-12 h-1 bg-ma-green mx-auto mb-4 rounded-full" />
            <h2 className="text-3xl font-bold text-stone-800 mb-3">{t('home.whyTitle')}</h2>
            <p className="text-stone-500 text-sm max-w-md mx-auto">
              {t('home.whySub')}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div key={f.title} className="text-center group">
                  <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-red-100 transition-colors">
                    <Icon className="w-7 h-7 text-ma-red" />
                  </div>
                  <h3 className="font-semibold text-stone-800 mb-2 text-sm">{f.title}</h3>
                  <p className="text-stone-500 text-xs leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-ma-navy">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-12 h-1 bg-ma-red mx-auto mb-6 rounded-full" />
          <h2 className="text-3xl font-bold text-white mb-4">{t('home.ctaTitle')}</h2>
          <p className="text-blue-200 mb-8 text-sm leading-relaxed max-w-lg mx-auto">
            {t('home.ctaSub')}
          </p>
          <Link
            to="/quote"
            className="inline-flex items-center gap-2 bg-ma-red hover:bg-[#9B1E24] text-white font-bold px-10 py-4 rounded-xl transition-all duration-200 text-sm shadow-lg"
          >
            {t('home.ctaBtn')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
