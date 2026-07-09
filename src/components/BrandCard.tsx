import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { productImage } from '../lib/img';
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
  const hasImages = strip.length > 0;

  const initials = brand.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      to={`/brand/${brand.slug}`}
      className="group overflow-hidden rounded-2xl bg-white shadow-card hover:shadow-card-hover transition-all duration-500 hover:-translate-y-1.5 border border-stone-100 flex flex-col h-72"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Image — 80% ─────────────────────────────────────────────────────── */}
      <div className="flex-[4] min-h-0 relative overflow-hidden bg-stone-50">

        {/* Shimmer while loading */}
        {loadingImages && (
          <div className="absolute inset-0 z-20 overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-black/5 to-transparent" />
          </div>
        )}

        {hasImages ? (
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
                    src={productImage(src, 400)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none z-10" />
          </>
        ) : (
          /* ── No-image placeholder: clean white ──────────────────────────── */
          <div className="w-full h-full flex items-center justify-center relative bg-white">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
                backgroundSize: '18px 18px',
              }}
            />
            {brand.logo_url ? (
              <div className="relative z-10 p-6">
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  className="h-20 w-auto max-w-[160px] object-contain group-hover:scale-105 transition-transform duration-300"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center">
                  <span className="text-2xl font-bold text-stone-400 tracking-tight">{initials}</span>
                </div>
                <p className="text-stone-400 text-xs font-medium tracking-wide">{brand.name}</p>
              </div>
            )}
          </div>
        )}

        {/* Logo pill bottom-left — only when product images are shown */}
        {brand.logo_url && hasImages && (
          <div className="absolute bottom-2.5 left-2.5 z-20">
            <div className="bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-md border border-white/60">
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="h-4 w-auto max-w-[72px] object-contain"
                onError={e => { (e.target as HTMLImageElement).closest('div')?.remove(); }}
              />
            </div>
          </div>
        )}

        {/* Product count badge */}
        {productCount !== undefined && (
          <div className="absolute top-2.5 right-2.5 z-20">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              hasImages
                ? 'text-white bg-black/35 backdrop-blur-sm'
                : 'text-stone-500 bg-white shadow-sm border border-stone-100'
            }`}>
              {productCount} produit{productCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Dot indicators bottom-right */}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-2.5 flex gap-1 z-20">
            {images.map((_, i) => (
              <span
                key={i}
                className={`block rounded-full transition-all duration-300 ${
                  i === activeIdx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Content — 20% ───────────────────────────────────────────────────── */}
      <div className="flex-[1] min-h-0 flex items-center justify-between px-3.5 border-t border-stone-100 bg-white">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-stone-800 text-sm truncate group-hover:text-ma-navy transition-colors">
            {brand.name}
          </h3>
          {brand.description && (
            <p className="text-stone-400 text-[11px] truncate mt-0.5 leading-tight">{brand.description}</p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-ma-green ml-3 shrink-0 group-hover:translate-x-0.5 transition-transform duration-200" />
      </div>
    </Link>
  );
}
