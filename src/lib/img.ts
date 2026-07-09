/**
 * Optimise les images produit (hotlinkées depuis des sites tiers).
 * En production (Netlify), on route via le Netlify Image CDN qui :
 *   - redimensionne à la taille réellement affichée (au lieu de charger du 1920px)
 *   - sert du WebP/AVIF selon le navigateur
 *   - met en cache en edge (chargements suivants instantanés)
 * En dev local, le CDN n'existe pas → on renvoie l'URL brute.
 */
export function productImage(url?: string | null, width = 400): string {
  if (!url) return '';
  if (import.meta.env.PROD && /^https?:\/\//.test(url)) {
    return `/.netlify/images?url=${encodeURIComponent(url)}&w=${width}&fit=cover&q=70`;
  }
  return url;
}
