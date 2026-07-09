import { Link } from 'react-router-dom';
import { Package, CheckCircle, ArrowRight, Thermometer, Leaf } from 'lucide-react';
import type { Product } from '../types';
import { productImage } from '../lib/img';

interface Props {
  product: Product;
  onQuote?: (product: Product) => void;
}

const TEMP_STYLES: Record<string, string> = {
  'Ambiante':  'bg-stone-100 text-stone-600',
  'Réfrigéré': 'bg-sky-100 text-sky-700',
  'Frais':     'bg-cyan-100 text-cyan-700',
  'Surgelé':   'bg-indigo-100 text-indigo-700',
};

export default function ProductCard({ product, onQuote }: Props) {
  return (
    <div className="group bg-white rounded-2xl border border-ma-sand/70 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 flex flex-col overflow-hidden">

      {/* Supplier strip */}
      {product.supplier?.name && (
        <div className="px-3.5 pt-2.5 pb-0">
          <span className="text-[10px] font-bold text-ma-navy/50 uppercase tracking-widest">
            {product.supplier.name}
          </span>
        </div>
      )}

      {/* Image */}
      <Link to={`/product/${product.id}`} className="relative mt-2 mx-3 h-40 bg-ma-sand/40 overflow-hidden rounded-xl block shrink-0">
        {product.image_url ? (
          <img
            src={productImage(product.image_url, 400)}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Package className="w-9 h-9 text-ma-sand" />
          </div>
        )}

        {/* Status badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.is_new && (
            <span className="text-[10px] font-bold bg-ma-green text-white px-2 py-0.5 rounded-full shadow-sm tracking-wide">
              NOUVEAU
            </span>
          )}
          {product.is_promo && (
            <span className="text-[10px] font-bold bg-ma-red text-white px-2 py-0.5 rounded-full shadow-sm tracking-wide">
              PROMO
            </span>
          )}
        </div>

        {/* Temperature */}
        {product.temperature && product.temperature !== 'Ambiante' && (
          <span className={`absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${TEMP_STYLES[product.temperature] || TEMP_STYLES['Ambiante']}`}>
            <Thermometer className="w-2.5 h-2.5" />
            {product.temperature}
          </span>
        )}
      </Link>

      {/* Body */}
      <div className="px-3.5 pt-3 pb-3.5 flex flex-col flex-1">

        {/* Brand */}
        {product.brand?.name && (
          <p className="text-[10px] font-semibold text-ma-navy/60 uppercase tracking-wide mb-0.5 truncate">
            {product.brand.name}
          </p>
        )}

        {/* Name */}
        <Link to={`/product/${product.id}`} className="hover:text-ma-red transition-colors">
          <h3 className="font-semibold text-stone-800 text-sm leading-snug line-clamp-2">{product.name}</h3>
        </Link>

        {/* Régimes */}
        {product.regimes && product.regimes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {product.regimes.slice(0, 2).map(r => (
              <span key={r} className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-50 text-ma-green border border-emerald-100 px-1.5 py-0.5 rounded-full font-medium">
                <Leaf className="w-2.5 h-2.5" />
                {r}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {product.description && (
          <p className="text-stone-400 text-xs mt-1.5 leading-relaxed line-clamp-2">{product.description}</p>
        )}

        {/* Details checklist */}
        {product.details && product.details.length > 0 && (
          <ul className="mt-2.5 space-y-1 flex-1">
            {product.details.slice(0, 3).map((d, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-stone-500">
                <CheckCircle className="w-3 h-3 text-ma-green mt-0.5 shrink-0" />
                <span className="line-clamp-1">{d}</span>
              </li>
            ))}
            {product.details.length > 3 && (
              <li className="text-xs text-stone-300 pl-4">+{product.details.length - 3} autres</li>
            )}
          </ul>
        )}

        {/* MOQ + origin */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-ma-sand/60 text-[10px] text-stone-300 font-medium">
          {product.commande_min > 1 && <span>MOQ : {product.commande_min}</span>}
          {product.pays_origine && <span className="ml-auto">{product.pays_origine}</span>}
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <Link
            to={`/product/${product.id}`}
            className="flex-1 flex items-center justify-center gap-1 bg-ma-cream hover:bg-ma-sand text-stone-600 text-xs font-medium py-2 rounded-lg transition-colors border border-ma-sand/80"
          >
            Détails <ArrowRight className="w-3 h-3" />
          </Link>
          {onQuote && (
            <button
              onClick={() => onQuote(product)}
              className="flex-1 bg-ma-red hover:bg-[#A83928] text-white text-xs font-semibold py-2 rounded-lg transition-colors shadow-sm"
            >
              Devis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
