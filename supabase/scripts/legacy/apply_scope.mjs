/**
 * Masque (is_active=false, RÉVERSIBLE) :
 *   - la catégorie "Essential Oils" + ses produits
 *   - les 305 produits hors-périmètre détectés dans des catégories alimentaires
 *     (biberons, alcool, électroménager… ) SAUF les aliments pour bébé (garde-fou)
 * Ne supprime rien.
 *   node --env-file=.env.seed apply_scope.mjs --dry-run
 *   node --env-file=.env.seed apply_scope.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

// garde-fou : ne PAS masquer un vrai aliment pour bébé attrapé par "biberon" etc.
const FOOD_SAFE = /biscuit|c[eé]r[eé]al|compote|pur[eé]e|petits?\s?pots?|lait\s?(infantile|2|3)|yaourt|go[uû]ter|farine/i;

function readFlaggedInFood() {
  const lines = readFileSync(join(HERE, 'analysis', 'flagged_products.csv'), 'utf-8').split(/\r?\n/).slice(1).filter(Boolean);
  const ids = [];
  let skipped = 0;
  for (const ln of lines) {
    // CSV ; avec champs "..." — parse simple
    const m = ln.match(/^"([^"]*)";"([^"]*)";"([^"]*)";"([^"]*)";([^;]*);/);
    if (!m) continue;
    const [, id, name, , motif] = m;
    const inNonFood = /true/.test(ln.split(';')[4] || '');
    if (inNonFood) continue;                       // Niveau 1, géré par catégorie
    if ((motif === 'puericulture' || motif === 'vetement_bebe') && FOOD_SAFE.test(name)) { skipped++; continue; }
    ids.push(id);
  }
  return { ids, skipped };
}

async function main() {
  // Essential Oils
  const { data: cat } = await db.from('categories').select('id,name').eq('slug', 'essential-oils').maybeSingle();
  let essCount = 0;
  if (cat) {
    const { count } = await db.from('products').select('id', { count:'exact', head:true }).eq('category_id', cat.id).eq('is_active', true);
    essCount = count || 0;
  }

  const { ids, skipped } = readFlaggedInFood();

  console.log('── Plan (is_active=false) ──');
  console.log(`  Essential Oils : catégorie + ${essCount} produits`);
  console.log(`  Hors-périmètre en catégories food : ${ids.length} produits  (aliments bébé préservés : ${skipped})`);

  if (DRY) { console.log('\n[DRY-RUN] aucune écriture.'); return; }

  if (cat) {
    await db.from('products').update({ is_active:false }).eq('category_id', cat.id);
    await db.from('categories').update({ is_active:false }).eq('id', cat.id);
    console.log('✔ Essential Oils masqué.');
  }
  let done = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const b = ids.slice(i, i+200);
    const { error } = await db.from('products').update({ is_active:false }).in('id', b);
    if (error) { console.error('\n❌', i, error.message); process.exit(1); }
    done += b.length; process.stdout.write(`\r  masqués: ${done}/${ids.length}`);
  }
  process.stdout.write('\n');
  console.log('✅ Terminé.');
}
main();
