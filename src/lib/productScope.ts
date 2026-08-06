/**
 * Validation centralisée du périmètre catalogue (prévention à l'import).
 *
 * Objectif : empêcher l'entrée de produits hors périmètre (puériculture /
 * bébé / accessoires enfant) et refuser les catégories non autorisées, sur
 * TOUS les chemins de création/mise à jour de produits (imports CSV/JSON,
 * scraping, upserts). Ne classe JAMAIS automatiquement un cas ambigu.
 *
 * Signaux (dérivés d'un audit réel du catalogue) :
 *  - marque de puériculture pure (NUK, Nûby, MAM Baby, Suavinex, Farlin,
 *    Miniland, Babybio, Organix, Dodie, Avent, Chicco, Tommee Tippee,
 *    Bébé Confort, Bambino, Bébédor, Notre Bébé) → REJECT_OUT_OF_SCOPE ;
 *  - nom contenant un accessoire/aliment bébé explicite (couche, tétine,
 *    biberon, sucette + tranche d'âge, stérilisateur, grignoteur, tasse
 *    d'apprentissage, lait infantile/croissance, « dès X mois », « 12M+ »)
 *    → REJECT_OUT_OF_SCOPE ;
 *  - indicateur faible uniquement en description (nourrisson/biberon/tétine
 *    sans marque ni nom bébé, ex. contre-indication) → REVIEW_REQUIRED ;
 *  - catégorie non autorisée → REJECT_OUT_OF_SCOPE ;
 *  - catégorie « Hygiene & Paper Products » utilisée pour un article bébé/
 *    enfant → REJECT_OUT_OF_SCOPE (jamais fourre-tout non alimentaire).
 *
 * Les indicateurs FAIBLES (kids, junior, family, mini, cartoon, school, fun)
 * ne suffisent JAMAIS seuls et n'excluent pas un aliment ordinaire.
 */

export type ScopeDecision =
  | 'ACCEPT'
  | 'RECLASSIFY'
  | 'REJECT_OUT_OF_SCOPE'
  | 'REVIEW_REQUIRED';

export interface ProductScopeInput {
  name?: string | null;
  description?: string | null;
  brand?: string | null;
  category?: string | null; // nom de catégorie visé
}

export interface ScopeResult {
  decision: ScopeDecision;
  reason: string;
  matched: string[];
}

/** 32 catégories métier autorisées (source de vérité du périmètre). */
export const ALLOWED_CATEGORIES = [
  'Olive Oil', 'Argan Oil', 'Vegetable Oil', 'Olives', 'Canned Sardines',
  'Tomato Sauce/Concentrate', 'Fruit Juices', 'Tea/Infusions', 'Pasta and Couscous',
  'Noodles', 'Wheat Flour/Semolina', 'Dry Yeast', 'Biscuits', 'Confectionery',
  'Popcorn / Cotton Candy', 'Licorice / Jellys', 'Chocolate', 'Chips/Salted Snacks',
  'Dairy (UHT Milk)', 'Cheese', 'Soft Drinks', 'Margarine', 'Frozen Red Fruits',
  'Fresh Fruits', 'Aromatic Herbs', 'Essential Oils', 'Organic Saffron',
  'Carob Powder', 'Dates', 'Frozen Fish', 'Frozen Ready Meals',
  'Hygiene & Paper Products',
];

const HYGIENE_CATEGORY = 'Hygiene & Paper Products';

// Normalise : minuscules + suppression des accents.
function norm(s?: string | null): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Marques exclusivement puériculture / alimentation infantile.
const BABY_BRANDS = /\b(nuk|mam ?baby|nuby|suavinex|farlin|miniland|babybio|organix|dodie|avent|chicco|tommee|bebe ?confort|bambino|bebedor|notre ?bebe)\b/;

// Accessoires / aliments bébé explicites (dans le NOM de préférence).
const BABY_HARD = new RegExp(
  [
    'couche[- ]?culotte', 'couches? (bebe|pour bebe)', '\\bdiapers?\\b', '\\bnappies?\\b',
    'lingettes? bebe', 'baby ?wipe',
    'lait infantile', 'lait de croissance', 'lait 1er ?age', 'lait 2 ?age', 'infant formula', 'formula milk',
    'cereales? infantiles?', 'petit pot', '(puree|compote) bebe',
    'biberon', 'feeding bottle', 'tetine', 'pacifier', 'sterilisateur',
    'poussette', '\\bstroller\\b', 'siege[- ]?auto', 'car ?seat',
    'puericulture', 'grignoteur', 'nibber', "tasse d.?apprentissage",
    'des [0-9] ?mois', '[0-9]m\\+',
    'sucette.{0,30}(0-6|6-18|6-36|[0-9] ?mois|[0-9]\\s?er ?age|anatomique|orthodon|physio)',
  ].join('|'),
);

// Indicateur faible en description seulement (contre-indications, mentions).
const BABY_WEAK = /\b(nourrissons?|newborns?)\b|biberon|tetine/;

// Bonbons en forme d'accessoire bébé — NE PAS exclure (aliment).
const CANDY_EXCEPTION = /\bbig baby pop\b|baby ?pop/;

export function classifyProductScope(input: ProductScopeInput): ScopeResult {
  const name = norm(input.name);
  const brand = norm(input.brand);
  const hay = `${name} ${norm(input.description)}`;
  const matched: string[] = [];

  // 0) Exception aliment (bonbon "baby pop") — reste ACCEPT côté périmètre.
  const isCandy = CANDY_EXCEPTION.test(hay);

  // 1) Catégorie non autorisée.
  if (input.category && !ALLOWED_CATEGORIES.includes(input.category)) {
    return { decision: 'REJECT_OUT_OF_SCOPE', reason: `category_not_allowed:${input.category}`, matched: [input.category] };
  }

  // 2) Bébé/enfant haute confiance (marque pure OU accessoire/aliment dans le nom).
  if (!isCandy) {
    const brandHit = BABY_BRANDS.test(brand);
    const nameHit = BABY_HARD.test(name);
    if (brandHit) matched.push(`baby_brand:${(brand.match(BABY_BRANDS) || [''])[0]}`);
    if (nameHit) matched.push(`baby_name:${(name.match(BABY_HARD) || [''])[0]}`);
    if (brandHit || nameHit) {
      return { decision: 'REJECT_OUT_OF_SCOPE', reason: 'baby_child_high_confidence', matched };
    }
  }

  // 3) « Hygiene & Paper Products » ne doit pas servir à classer un article bébé/enfant
  //    (couches, lingettes bébé, biberons, jouets…) — même sans marque connue.
  if (input.category === HYGIENE_CATEGORY && BABY_HARD.test(hay)) {
    return { decision: 'REJECT_OUT_OF_SCOPE', reason: 'hygiene_used_for_baby_item', matched: ['hygiene_baby'] };
  }

  // 4) Indicateur faible en description uniquement → revue humaine (jamais auto).
  if (!isCandy && BABY_WEAK.test(hay) && !BABY_HARD.test(name) && !BABY_BRANDS.test(brand)) {
    return { decision: 'REVIEW_REQUIRED', reason: 'weak_baby_signal_description_only', matched: [(hay.match(BABY_WEAK) || [''])[0]] };
  }

  // 5) Rien de bloquant → accepté (la reclassification éventuelle est décidée ailleurs).
  return { decision: 'ACCEPT', reason: 'in_scope', matched: [] };
}

/** Rapport dry-run pour un lot d'import (à journaliser avant tout upsert). */
export function dryRunScope(rows: ProductScopeInput[]) {
  const summary = { ACCEPT: 0, RECLASSIFY: 0, REJECT_OUT_OF_SCOPE: 0, REVIEW_REQUIRED: 0 } as Record<ScopeDecision, number>;
  const rejected: { input: ProductScopeInput; result: ScopeResult }[] = [];
  const review: { input: ProductScopeInput; result: ScopeResult }[] = [];
  for (const r of rows) {
    const res = classifyProductScope(r);
    summary[res.decision]++;
    if (res.decision === 'REJECT_OUT_OF_SCOPE') rejected.push({ input: r, result: res });
    if (res.decision === 'REVIEW_REQUIRED') review.push({ input: r, result: res });
  }
  return { summary, rejected, review };
}
