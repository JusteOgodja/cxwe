import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { productImage } from '../lib/img';
import type { Category } from '../types';

const CATEGORY_COLORS = [
  'from-[#0F2044] to-[#1A3570]',
  'from-[#8B2E1A] to-[#C44B38]',
  'from-[#0D4A29] to-[#1E6B40]',
  'from-[#5C3418] to-[#9B5A2A]',
  'from-[#1A3068] to-[#2850A0]',
  'from-[#3A2010] to-[#6B3820]',
  'from-[#122B15] to-[#234D28]',
  'from-[#2C1810] to-[#5C3018]',
];

interface Props {
  category: Category;
  index: number;
  /** Images produits de la catégorie, récupérées en lot par la page parente (0 requête ici). */
  images?: string[];
}

export default function CategoryCard({ category, index, images = [] }: Props) {
  const { t } = useTranslation();
  const gradient = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

  const [slide, setSlide] = useState(0);
  const [animated, setAnimated] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Démarre le défilement automatique dès l'affichage (sans survol). Les images sont
  // fournies en prop par la page parente -> plus aucune requête Supabase par carte.
  useEffect(() => {
    let startTimeout: ReturnType<typeof setTimeout>;
    if (images.length >= 2) {
      // léger décalage par carte pour éviter un défilement parfaitement synchrone
      startTimeout = setTimeout(() => {
        timerRef.current = setInterval(() => {
          setAnimated(true);
          setSlide(s => s + 1);
        }, 2800);
      }, (index % 6) * 250);
    }
    return () => {
      clearTimeout(startTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [images.length, index]);

  const handleTransitionEnd = () => {
    if (images.length > 1 && slide >= images.length) {
      setAnimated(false);
      setSlide(0);
    }
  };

  const strip = images.length > 1 ? [...images, images[0]] : images;
  const N = Math.max(strip.length, 1);
  const translatePct = (slide * 100) / N;
  const activeIdx = images.length > 0 ? slide % images.length : 0;

  return (
    <Link
      to={`/catalog/${category.slug}`}
      className="group relative overflow-hidden rounded-2xl bg-white shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-ma-sand/60"
    >
      {/* Image area */}
      <div className={`relative h-44 bg-gradient-to-br ${gradient} overflow-hidden`}>

        {strip.length > 0 ? (
          <div
            className="absolute inset-0 flex h-full"
            style={{
              width: `${N * 100}%`,
              transform: `translateX(-${translatePct}%)`,
              transition: animated ? 'transform 550ms cubic-bezier(0.4,0,0.2,1)' : 'none',
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {strip.map((src, i) => (
              <div key={i} className="relative h-full shrink-0" style={{ width: `${100 / N}%` }}>
                <img
                  src={productImage(src, 500)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
              </div>
            ))}
          </div>
        ) : (
          category.image_url && (
            <img
              src={category.image_url}
              alt={category.name}
              className="w-full h-full object-cover mix-blend-overlay opacity-60 group-hover:scale-105 transition-transform duration-500"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1 z-10">
            {images.map((_, i) => (
              <span
                key={i}
                className={`block rounded-full transition-all duration-300 ${
                  i === activeIdx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        )}

        {/* Maroc badge */}
        <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
          <span className="text-[10px] font-semibold text-white/80 uppercase tracking-widest bg-black/25 backdrop-blur-sm px-2 py-0.5 rounded-full">
            {t('categoryCard.morocco')}
          </span>
        </div>

        {/* Slide counter */}
        {images.length > 1 && (
          <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <span className="text-[10px] font-bold text-white bg-black/35 backdrop-blur-sm px-2 py-0.5 rounded-full">
              {activeIdx + 1} / {images.length}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-stone-800 text-sm leading-snug group-hover:text-ma-navy transition-colors">
          {category.name}
        </h3>
        {category.description && (
          <p className="text-stone-400 text-xs mt-1 line-clamp-2 leading-relaxed">
            {category.description}
          </p>
        )}
        <div className="flex items-center gap-1 mt-3 text-ma-green text-xs font-semibold">
          <span>{t('categoryCard.viewProducts')}</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
