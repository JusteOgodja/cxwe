/**
 * RAPPORT (lecture seule) : produits hors-périmètre FMCG alimentaire + mal catégorisés.
 * Ne modifie RIEN. Sort des CSV dans supabase/analysis/ + un résumé console.
 *   node supabase/scope_report.mjs      (lit l'export local, pas besoin de la base)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const EXP = join(HERE, 'export');
const OUT = join(HERE, 'analysis');
mkdirSync(OUT, { recursive: true });

const P = JSON.parse(readFileSync(join(EXP, 'products.json'), 'utf-8'));
const T = JSON.parse(readFileSync(join(EXP, 'product_pricing_tiers.json'), 'utf-8'));
const CATS = JSON.parse(readFileSync(join(EXP, 'categories.json'), 'utf-8'));
const BRANDS = JSON.parse(readFileSync(join(EXP, 'brands.json'), 'utf-8'));
const catName = Object.fromEntries(CATS.map(c => [c.id, c.name]));
const brandName = Object.fromEntries(BRANDS.map(b => [b.id, b.name]));
const priceOf = {};
for (const t of T) if (priceOf[t.product_id] === undefined) priceOf[t.product_id] = Number(t.price);

// Catégories jugées NON alimentaires (périmètre à décider par l'utilisateur)
const NON_FOOD_CATS = new Set(['Hygiene & Paper Products', 'Essential Oils']);

// Règles de détection hors-périmètre (mots-clés + exclusions pour limiter les faux positifs)
const RULES = [
  // Alcool = vraie bouteille : soit le nom COMMENCE par l'alcool, soit il y a un % ou un volume.
  // Exclut les aliments parfumés ("au whisky", "sauce au vin", "crème/biscuit/bonbon ... champagne").
  { tag: 'alcool',
    re: /(^\s*(whisky|whiskey|vodka|rhum|tequila|cognac|armagnac|liqueur|champagne|prosecco|porto|scotch|bourbon|gin\b|vin\s+(rouge|blanc|ros[eé])|vins?\b|wine\b))|(\b(whisky|vodka|rhum|liqueur|champagne|vin\s+(rouge|blanc|ros[eé])|bi[eè]re|wine)\b.{0,25}\b\d+([.,]\d+)?\s?%)/i,
    excl: /\b(au|à\s?la|a\s?la|aux|à\s?l['’]|saveur|ar[oô]me|parfum|sauce|cr[eè]me|rochers?|bonbons?|biscuits?|biscuiterie|cookies?|shortbread|chewing|\bgum\b|chocolats?|g[aâ]teau|c[oô]telette|moutarde|confiture|gel[eé]e|sirop|c[aâ]pres?|pralin|nappage|inghetata|welsh|cheddar|fromag|sans\s?alcool|0[.,]0|gift box)\b/i },
  { tag: 'puericulture', re: /\b(poussette|biberon|grenouill[eè]re|t[eé]tine|si[eè]ge auto|tire-?lait|pr[eé]parateur de biberon|barri[eè]re de s[eé]curit[eé]|bavoir)\b/i },
  { tag: 'vetement_bebe', re: /\b(body b[eé]b[eé]|lot de \d+ bodies?|grenouill[eè]re|chaussettes?|pyjama|combinaison|barboteuse|gilet|robe|t-?shirt|pantalon)\b/i,
    excl: /chaussette russe|the/i },
  { tag: 'electromenager', re: /\b(lave-?vaisselle|lave-?linge|cuisini[eè]re|r[eé]frig[eé]rateur|cong[eé]lateur|micro-?onde|aspirateur|climatiseur|chauffe-?eau|cafeti[eè]re|bouilloire|friteuse|hotte|plaque de cuisson|robot p[aâ]tissier)\b/i },
  { tag: 'electronique', re: /\b(smartphone|t[eé]l[eé]phone|chargeur|c[aâ]ble usb|[eé]couteurs?|casque|batterie externe|ordinateur|clavier|souris sans fil|montre connect)\b/i },
  { tag: 'hygiene_cosmetique', re: /\b(shampoing|shampooing|dentifrice|gel douche|d[eé]odorant|apr[eè]s-?shampo|coloration|vernis|maquillage|parfum|eau de toilette|cr[eè]me visage|cr[eè]me mains|lessive|d[eé]tergent|nettoyant|d[eé]sinfectant|papier toilette|mouchoirs?|essuie-?tout|serviette hygi[eé]nique|couches?)\b/i,
    excl: /cr[eè]me dessert|cr[eè]me fra[iî]che|cr[eè]me de|cr[eè]me p[aâ]tissi/i },
  { tag: 'animalerie', re: /\b(croquettes|liti[eè]re|aquarium|nourriture pour (chat|chien)|p[aâ]t[eé]e pour)\b/i },
];

const csvCell = v => {
  const s = (v ?? '').toString().replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${s}"`;
};

// 1) Vue par catégorie
const perCat = {};
for (const p of P) {
  const c = catName[p.category_id] || '?';
  perCat[c] = (perCat[c] || 0) + 1;
}
const catRows = Object.entries(perCat).sort((a, b) => b[1] - a[1])
  .map(([c, n]) => ({ categorie: c, produits: n, statut: NON_FOOD_CATS.has(c) ? 'NON ALIMENTAIRE (à décider)' : 'alimentaire' }));
writeFileSync(join(OUT, 'category_overview.csv'),
  'categorie;produits;statut\n' + catRows.map(r => `${csvCell(r.categorie)};${r.produits};${csvCell(r.statut)}`).join('\n'));

// 2) Produits flaggés (mots-clés) — hors-périmètre à l'intérieur d'une catégorie alimentaire surtout
const flagged = [];
for (const p of P) {
  const nm = p.name || '';
  const cat = catName[p.category_id] || '?';
  for (const r of RULES) {
    if (r.re.test(nm) && !(r.excl && r.excl.test(nm))) {
      flagged.push({ id: p.id, name: nm, categorie: cat, motif: r.tag,
        dans_cat_non_food: NON_FOOD_CATS.has(cat), prix: priceOf[p.id] ?? '', marque: brandName[p.marque_id] || '' });
      break;
    }
  }
}
flagged.sort((a, b) => (a.motif + a.categorie).localeCompare(b.motif + b.categorie));
writeFileSync(join(OUT, 'flagged_products.csv'),
  'id;nom;categorie_actuelle;motif;dans_categorie_non_food;prix_mad;marque\n' +
  flagged.map(f => [f.id, f.name, f.categorie, f.motif, f.dans_cat_non_food, f.prix, f.marque].map(csvCell).join(';')).join('\n'));

// 3) Résumé console
console.log('===== VUE PAR CATÉGORIE =====');
catRows.forEach(r => console.log(`  ${String(r.produits).padStart(6)}  ${r.categorie.padEnd(28)} ${r.statut}`));
const nonFoodTotal = catRows.filter(r => NON_FOOD_CATS.has(r.categorie)).reduce((s, r) => s + r.produits, 0);
console.log(`\n  → produits dans catégories NON alimentaires : ${nonFoodTotal}`);

console.log('\n===== PRODUITS FLAGGÉS PAR MOTIF (mots-clés) =====');
const byTag = {};
flagged.forEach(f => { byTag[f.motif] = byTag[f.motif] || { total: 0, inFood: 0 }; byTag[f.motif].total++; if (!f.dans_cat_non_food) byTag[f.motif].inFood++; });
Object.entries(byTag).sort((a, b) => b[1].total - a[1].total)
  .forEach(([t, v]) => console.log(`  ${t.padEnd(20)} ${String(v.total).padStart(4)}  (dont ${v.inFood} dans une catégorie ALIMENTAIRE)`));
console.log(`\n  TOTAL flaggés : ${flagged.length}  (dont ${flagged.filter(f => !f.dans_cat_non_food).length} à l'intérieur de catégories alimentaires)`);

console.log('\n===== EXEMPLES (dans catégories alimentaires) =====');
flagged.filter(f => !f.dans_cat_non_food).slice(0, 15).forEach(f =>
  console.log(`  [${f.motif}] ${f.name.slice(0, 50)}  →  ${f.categorie}`));

console.log('\nFichiers écrits :');
console.log('  ', join(OUT, 'category_overview.csv'));
console.log('  ', join(OUT, 'flagged_products.csv'));
