/**
 * #20 : masque (is_active=false, RÉVERSIBLE) les produits d'origine manifestement
 * ÉTRANGÈRE (imports), hors périmètre "Morocco Export". Détection par mentions
 * explicites (nationalité / appellations UE / spécialités PDO / spiritueux étrangers).
 * Exclut les simples mentions de saveur.
 *   node --env-file=.env.seed apply_origin.mjs --dry-run
 *   node --env-file=.env.seed apply_origin.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const P = JSON.parse(readFileSync(join(HERE, 'export', 'products.json'), 'utf-8'));

const FLAVOR = /french vanilla|italian style|[àa] la fran[cç]ais|saveur|ar[oô]me|go[uû]t\b|style /i;
const FOREIGN = [
  /\b(spanish|espagnol|d['’]espagne|jab[uü]go|b[eé]llota|ib[eé]ri|serrano|manchego|rioja|rosquillas)\b/i,
  /\b(italian|italien|d['’]italie|parmigiano|parmes|pecorino|gorgonzola|prosciutto|chianti|barolo|di modena)\b/i,
  /\b(fran[cç]ais|de france|comt[eé]|roquefort|camembert|bordeaux|bourgogne|canard duch[eê]ne|ruinart|aoc)\b/i,
  /\b(japanese|japon|yamazaki|chichibu|nikka|hibiki)\b/i,
  /\b(portug|ginja|obidos)\b/i,
  /\b(english tea|scotch|scottish|irish whisk)\b/i,
  /\b(german|allemand|d['’]allemagne)\b/i,
  /\b(belgian|belge|callebaut)\b/i,
  /\b(greek|gr[eè]ce|\bfeta\b)\b/i,
  /\b(aop|dop|igp|doc)\b/i,
];

async function main(){
  const active = P.filter(p => p.is_active !== false);
  const ids = [], sample = [];
  for (const p of active){
    const nm = p.name || '';
    if (FLAVOR.test(nm)) continue;
    if (FOREIGN.some(r => r.test(nm))){
      ids.push(p.id);
      if (sample.length < 15) sample.push(nm.slice(0, 55));
    }
  }
  console.log(`Produits d'origine étrangère à masquer : ${ids.length}`);
  console.log('\n── Échantillon ──'); sample.forEach(s => console.log('  ·', s));
  if (DRY){ console.log('\n[DRY-RUN] aucune écriture.'); return; }
  let done = 0;
  for (let i=0;i<ids.length;i+=200){
    const b = ids.slice(i,i+200);
    const { error } = await db.from('products').update({ is_active:false }).in('id', b);
    if(error){ console.error('\n❌',i,error.message); process.exit(1); }
    done += b.length; process.stdout.write(`\r  masqués: ${done}/${ids.length}`);
  }
  process.stdout.write('\n'); console.log('✅ Terminé.');
}
main();
