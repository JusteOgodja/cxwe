/**
 * Seed du catalogue Morocco Food Export depuis PRODUITS_CIBLES.json
 * ---------------------------------------------------------------
 * Prérequis :
 *   1. Les tables existent (ALL_MIGRATIONS.sql déjà exécuté dans Supabase).
 *   2. Variables d'environnement (dans supabase/.env.seed, NON commité) :
 *        SUPABASE_URL=https://xxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJhbGci....(clé service_role complète)
 *
 * Lancement :
 *   cd supabase
 *   node --env-file=.env.seed seed.mjs
 *
 * Choix appliqués : TOUS les produits · devise étiquetée MAD · prix inclus.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ND = 'Non disponible';

const DRY = process.argv.includes('--dry-run');
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY && (!URL || !KEY)) {
  console.error('❌ Manque SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.');
  console.error('   Crée supabase/.env.seed avec ces 2 variables puis :');
  console.error('   node --env-file=.env.seed seed.mjs');
  console.error('   (ou teste sans base :  node seed.mjs --dry-run )');
  process.exit(1);
}
const db = DRY ? null : createClient(URL, KEY, { auth: { persistSession: false } });

const clean = v => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s === ND ? '' : s;
};
const slugify = raw =>
  clean(raw).toLowerCase()
    .replace(/^\s*\d+\.\s*/, '')
    .replace(/[&/]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const catName = raw => clean(raw).replace(/^\s*\d+\.\s*/, '').trim();
const catSort = raw => { const m = clean(raw).match(/^\s*(\d+)\./); return m ? +m[1] : 999; };
const toNum = v => { const n = parseFloat(clean(v)); return Number.isFinite(n) ? n : null; };

async function chunked(rows, size, fn, label) {
  let done = 0;
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const { error } = await fn(batch);
    if (error) { console.error(`❌ ${label} lot ${i}-${i + batch.length}:`, error.message); process.exit(1); }
    done += batch.length;
    process.stdout.write(`\r   ${label}: ${done}/${rows.length}`);
  }
  process.stdout.write('\n');
}

async function main() {
  const data = JSON.parse(readFileSync(join(HERE, 'PRODUITS_CIBLES.json'), 'utf-8'));
  console.log(`Lu : ${data.length} produits.${DRY ? '  [MODE DRY-RUN — aucune écriture]' : ''}`);

  // 1) CATÉGORIES
  const catMap = new Map(); // slug -> {name, sort}
  for (const x of data) {
    const slug = slugify(x.target_category);
    if (slug && !catMap.has(slug)) catMap.set(slug, { name: catName(x.target_category), sort: catSort(x.target_category) });
  }
  const catRows = [...catMap].map(([slug, v]) => ({ slug, name: v.name, sort_order: v.sort, is_active: true }));

  let slugToId;
  if (DRY) {
    // ids factices pour valider le mapping sans base
    slugToId = new Map(catRows.map((c, i) => [c.slug, `dry-${i}`]));
    console.log(`✔ Catégories (dry) : ${catRows.length}`);
  } else {
    const { error: cErr } = await db.from('categories').upsert(catRows, { onConflict: 'slug' });
    if (cErr) { console.error('❌ categories:', cErr.message); process.exit(1); }
    console.log(`✔ Catégories upsert : ${catRows.length}`);
    const { data: cats } = await db.from('categories').select('id, slug');
    slugToId = new Map(cats.map(c => [c.slug, c.id]));
  }

  // 2) PRODUITS
  const prodRows = [];
  for (const x of data) {
    const slug = slugify(x.target_category);
    const name = clean(x.product_name);
    const category_id = slugToId.get(slug);
    if (!name || !category_id) continue;
    prodRows.push({
      category_id,
      name,
      description: clean(x.full_description) || clean(x.short_description),
      image_url: clean(x.main_image_url),
      devise: 'MAD',
      pays_origine: clean(x.origin_country) || 'Morocco',
      statut: 'actif',
      is_active: true,
      // prix mémorisé à part pour la table product_pricing_tiers
      __price: toNum(x.price),
      __minq: (toNum(x.minimum_order_quantity) >= 1 ? Math.floor(toNum(x.minimum_order_quantity)) : 1),
    });
  }

  if (DRY) {
    const withPrice = prodRows.filter(p => p.__price !== null && p.__price > 0);
    const skipped = data.length - prodRows.length;
    console.log(`✔ Produits mappés : ${prodRows.length}  (ignorés : ${skipped})`);
    console.log(`✔ Prix valides    : ${withPrice.length}`);
    const sample = prodRows[0];
    const { __price, __minq, ...clean1 } = sample;
    console.log('\n── Exemple de produit qui serait inséré ──');
    console.log(JSON.stringify(clean1, null, 2));
    console.log(`  → prix associé : ${__price} MAD (min ${__minq})`);
    // contrôles d'intégrité
    const missingCat = prodRows.filter(p => !p.category_id).length;
    const missingName = prodRows.filter(p => !p.name).length;
    console.log('\n── Contrôles d’intégrité ──');
    console.log(`  produits sans category_id : ${missingCat}`);
    console.log(`  produits sans name        : ${missingName}`);
    console.log(`  descriptions vides        : ${prodRows.filter(p => !p.description).length}`);
    console.log(`  images vides              : ${prodRows.filter(p => !p.image_url).length}`);
    console.log('\n✅ Dry-run OK — la transformation est cohérente. Prêt pour le vrai chargement.');
    return;
  }

  // insert produits par lots AVEC retour des ids, puis prix
  const size = 500;
  let inserted = 0;
  for (let i = 0; i < prodRows.length; i += size) {
    const batch = prodRows.slice(i, i + size);
    const payload = batch.map(({ __price, __minq, ...p }) => p);
    const { data: got, error } = await db.from('products').insert(payload).select('id');
    if (error) { console.error(`\n❌ products lot ${i}:`, error.message); process.exit(1); }
    // prix
    const tiers = [];
    got.forEach((row, j) => {
      const p = batch[j].__price;
      if (p !== null && p > 0) tiers.push({ product_id: row.id, min_quantity: batch[j].__minq, price: p, currency: 'MAD' });
    });
    if (tiers.length) {
      const { error: pErr } = await db.from('product_pricing_tiers').insert(tiers);
      if (pErr) { console.error(`\n❌ prix lot ${i}:`, pErr.message); process.exit(1); }
    }
    inserted += batch.length;
    process.stdout.write(`\r   produits+prix : ${inserted}/${prodRows.length}`);
  }
  process.stdout.write('\n');
  console.log(`✔ Terminé : ${inserted} produits insérés.`);
}

main();
