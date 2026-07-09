/**
 * Masque (is_active=false, RÉVERSIBLE) les prix aberrants situés dans des
 * catégories ALIMENTAIRES qui ne sont PAS des aliments premium légitimes.
 * (Non-food/alcool/électroménager/cosmétique/compléments/animalerie/erreurs)
 * Ne touche pas Hygiene & Paper Products (catégorie gardée) ni les 13 aliments premium.
 *   node --env-file=.env.seed apply_price_outliers.mjs --dry-run
 *   node --env-file=.env.seed apply_price_outliers.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const HYG = 'Hygiene & Paper Products';
const KEEP = /jam[oó]n|jabugo|b[eé]llota|couverture|fourrage callebaut|nougat|drag[eé]es?|truffe|caviar|foie gras|homard|langouste|pomegranate|grenade|parmes|parmigiano|grana|comt[eé]|pecorino|meule|pav[eé] de/i;
const BLOCK = /mass gain|gainz|gainer|whey|prot[eé]in|applied nutrition|eric favre|cr[eè]me de riz|proplan|pro-?nutrition|croquette/i;

function parse(line){
  const m = line.match(/^"([^"]*)";"([^"]*)";"([^"]*)";([^;]*);/);
  if(!m) return null;
  return { id:m[1], name:m[2], cat:m[3], prix:Number(m[4]) };
}

async function main(){
  const lines = readFileSync(join(HERE,'analysis','price_outliers.csv'),'utf-8').split(/\r?\n/).slice(1).filter(Boolean);
  const ids=[]; let kept=0;
  for(const ln of lines){
    const r=parse(ln); if(!r) continue;
    if(r.cat===HYG) continue;                              // catégorie gardée
    if(KEEP.test(r.name) && !BLOCK.test(r.name)){ kept++; continue; }  // aliment premium
    ids.push(r.id);
  }
  console.log(`À masquer : ${ids.length}  | aliments premium préservés : ${kept}`);
  if(DRY){ console.log('[DRY-RUN] aucune écriture.'); return; }
  let done=0;
  for(let i=0;i<ids.length;i+=200){
    const b=ids.slice(i,i+200);
    const { error } = await db.from('products').update({ is_active:false }).in('id',b);
    if(error){ console.error('\n❌',i,error.message); process.exit(1); }
    done+=b.length; process.stdout.write(`\r  masqués: ${done}/${ids.length}`);
  }
  process.stdout.write('\n'); console.log('✅ Terminé.');
}
main();
