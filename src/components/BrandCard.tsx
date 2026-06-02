import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Brand } from '../types';

interface Props {
  brand: Brand;
  productCount?: number;
}

export default function BrandCard({ brand, productCount }: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [slide, setSlide] = useState(0);
  const [animated, setAnimated] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const fetchedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const startTimer = (count: number) => {
    stop();
    if (count < 2) return;
    timerRef.current = setInterval(() => {
      setAnimated(true);
      setSlide(s => s + 1);
    }, 1800);
  };

  const handleMouseEnter = async () => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      setLoadingImages(true);
      const { data } = await supabase
        .from('products')
        .select('image_url')
        .eq('marque_id', brand.id)
        .eq('is_active', true)
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .limit(7);
      const imgs = (data || []).map((p: { image_url: string }) => p.image_url).filter(Boolean) as string[];
      setImages(imgs);
      setLoadingImages(false);
      startTimer(imgs.length);
    } else {
      startTimer(images.length);
    }
  };

  const handleMouseLeave = () => {
    stop();
    setAnimated(false);
    setSlide(0);
  };

  const handleTransitionEnd = () => {
    if (images.length > 1 && slide >= images.length) {
      setAnimated(false);
      setSlide(0);
    }
  };

  useEffect(() => () => stop(), []);

  const strip = images.length > 1 ? [...images, images[0]] : images;
  const N = Math.max(strip.length, 1);
  const translatePct = (slide * 100) / N;
  const activeIdx = images.length > 0 ? slide % images.length : 0;

  const initials = brand.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      to={`/brand/${brand.slug}`}
      className="group relative overflow-hidden rounded-2xl bg-white shadow-card hover:shadow-card-hover transition-all duration-500 hover:-translate-y-1.5 border border-ma-sand/60 flex flex-col"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Image area ─────────────────────────────────────────────────────── */}
      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#0F2044] to-[#1A3570] shrink-0">

        {/* Shimmer while loading */}
        {loadingImages && (
          <div className="absolute inset-0 z-20 overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/12 to-transparent" />
          </div>
        )}

        {strip.length > 0 ? (
          <>
            {/* Sliding strip */}
            <div
              className="absolute inset-0 flex h-full"
              style={{
                width: `${N * 100}%`,
                transform: `translateX(-${translatePct}%)`,
                transition: animated ? 'transform 650ms cubic-bezier(0.4,0,0.2,1)' : 'none',
              }}
              onTransitionEnd={handleTransitionEnd}
            >
              {strip.map((src, i) => (
                <div key={i} className="relative h-full shrink-0" style={{ width: `${100 / N}%` }}>
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ))}
            </div>
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none z-10" />
          </>
        ) : (
          /* ── No-image placeholder ─────────────────────────────────────── */
          <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
            {/* Dot-grid texture */}
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
            {/* Diagonal shine on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/5 via-transparent to-white/5" />

            {brand.logo_url ? (
              <div className="relative z-10">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10 group-hover:bg-white/15 transition-all duration-400 shadow-xl">
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    className="h-16 w-auto max-w-[140px] object-contain drop-shadow-lg"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              </div>
            ) : (
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center group-hover:bg-white/15 transition-colors duration-300">
                  <span className="text-2xl font-bold text-white/80 tracking-tight">{initials}</span>
                </div>
                <p className="text-white/50 text-xs text-center mt-3 font-medium tracking-wide">{brand.name}</p>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10" />
          </div>
        )}

        {/* ── Logo pill — bottom-left when images are shown ──────────────── */}
        {brand.logo_url && strip.length > 0 && (
          <div className="absolute bottom-3 left-3 z-20">
            <div className="bg-white/90 backdrop-blur-md rounded-xl px-2.5 py-1.5 shadow-lg border border-white/60">
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="h-5 w-auto object-contain max-w-[80px]"
                onError={e => { (e.target as HTMLImageElement).closest('div')?.remove(); }}
              />
            </div>
          </div>
        )}

        {/* ── Product count badge — top-right ───────────────────────────── */}
        {productCount !== undefined && (
          <div className="absolute top-3 right-3 z-20">
            <span className="text-[10px] font-bold text-white bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
              {productCount} produit{productCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* ── Dot indicators — bottom-right ─────────────────────────────── */}
        {images.length > 1 && (
          <div className="absolute bottom-3.5 right-3 flex gap-1 z-20">
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
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-stone-800 text-sm leading-snug group-hover:text-ma-navy transition-colors mb-1">
          {brand.name}
        </h3>
        {brand.description ? (
          <p className="text-stone-400 text-xs leading-relaxed line-clamp-2 flex-1">
            {brand.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
          <span className="text-xs font-semibold text-ma-green flex items-center gap-1">
            Voir les produits
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform duration-200" />
          </span>
          {productCount !== undefined && productCount > 0 && (
            <span className="text-[10px] text-stone-300 font-medium tabular-nums">
              {productCount} réf.
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
