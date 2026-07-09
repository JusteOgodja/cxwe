/**
 * RAPPORT (lecture seule) : prix aberrants par catégorie, croisés avec la source.
 * Ne modifie rien. Sort supabase/analysis/price_outliers.csv + résumé.
 *   node supabase/price_outliers.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const EXP = join(HERE, 'export');
const OUT = join(HERE, 'analysis'); mkdirSync(OUT, { recursive: true });

const P = JSON.parse(readFileSync(join(EXP, 'products.json'), 'utf-8'));
const T = JSON.parse(readFileSync(join(EXP, 'product_pricing_tiers.json'), 'utf-8'));
const CATS = Object.fromEntries(JSON.parse(readFileSync(join(EXP, 'categories.json'), 'utf-8')).map(c => [c.id, c.name]));
const SRC = JSON.parse(readFileSync(join(HERE, 'PRODUITS_CIBLES.json'), 'utf-8'));

const ND = 'Non disponible';
const cB = v => { v = (v || '').trim(); return v === ND ? '' : v; };
const norm = s => (s || '').toLowerCase().replace(/&#\d+[;,]/g, "'").replace(/\s+/g, ' ').trim();
// source: nom -> {prix, devise}
const srcMap = new Map();
for (const x of SRC) {
  const p = parseFloat(cB(x.price)); if (!Number.isFinite(p)) continue;
  const n = norm(x.product_name); if (!n) continue;
  if (!srcMap.has(n)) srcMap.set(n, { price: p, cur: cB(x.currency) || '?' });
}

const price = {}; for (const t of T) if (price[t.product_id] === undefined) price[t.product_id] = Number(t.price);
const active = P.filter(p => p.is_active !== false && price[p.id] !== undefined);

// médiane par catégorie
const byCat = {};
for (const p of active) (byCat[p.category_id] ||= []).push(price[p.id]);
const median = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const med = Object.fromEntries(Object.entries(byCat).map(([c, a]) => [c, median(a)]));

// outlier = prix > 12× médiane catégorie ET > 150 MAD, OU prix absolu > 2500
const rows = [];
for (const p of active) {
  const v = price[p.id]; const m = med[p.category_id] || 1;
  const ratio = v / m;
  if ((ratio > 12 && v > 150) || v > 2500) {
    const src = srcMap.get(norm(p.name));
    rows.push({
      id: p.id, name: p.name, cat: CATS[p.category_id] || '?', prix: v,
      med_cat: m, ratio: ratio.toFixed(1),
      src_price: src ? src.price : '', src_cur: src ? src.cur : 'introuvable',
      diagnostic: !src ? 'source introuvable'
        : src.cur === 'EUR' ? `origine ${src.price} EUR (×10.8=${(src.price*10.8).toFixed(0)})`
        : `origine ${src.price} ${src.cur}`,
    });
  }
}
rows.sort((a, b) => b.prix - a.prix);

const cell = v => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
writeFileSync(join(OUT, 'price_outliers.csv'),
  'id;nom;categorie;prix_mad;mediane_cat;ratio;prix_source;devise_source;diagnostic\n' +
  rows.map(r => [r.id, r.name, r.cat, r.prix, r.med_cat, r.ratio, r.src_price, r.src_cur, r.diagnostic].map(cell).join(';')).join('\n'));

console.log(`Prix aberrants détectés : ${rows.length}\n`);
console.log('TOP 25 (prix décroissant) :');
console.log('  PRIX_MAD  MÉD_CAT  RATIO  CATÉGORIE            DIAGNOSTIC — PRODUIT');
rows.slice(0, 25).forEach(r =>
  console.log(`  ${String(r.prix).padStart(7)}  ${String(r.med_cat).padStart(6)}  ${String(r.ratio).padStart(5)}  ${r.cat.slice(0,18).padEnd(18)}  ${r.diagnostic} | ${r.name.slice(0,40)}`));
console.log('\nFichier :', join(OUT, 'price_outliers.csv'));
