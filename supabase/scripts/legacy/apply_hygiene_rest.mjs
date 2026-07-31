/**
 * Dans "Hygiene & Paper Products", ne GARDE que papier + entretien maison + compléments.
 * Masque tout le reste (cosmétique/soins/bébé/… non attrapé par mots-clés).
 * RÉVERSIBLE (is_active=false).
 *   node --env-file=.env.seed apply_hygiene_rest.mjs --dry-run
 *   node --env-file=.env.seed apply_hygiene_rest.mjs
 */
import { createClient } from '@supabase/supabase-js';
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const KEEP = [
  /papier toilette|papier hygi|essuie-?tout|mouchoirs?|sopalin|rouleau|serviettes? en papier|papier m[eé]nager/i,
  /lessive|liquide vaisselle|d[eé]tergent|javel|adoucissant|assouplissant|d[eé]tachant|cirage|d[eé]boucheur|insecticide|anti-?calcaire|nettoyant (sol|sols|surface|salle de bain|cuisine|wc|vitre|m[eé]nager|multi|four)|d[eé]sinfectant (sol|surface|m[eé]nager)|produit m[eé]nager|nettoyant sol|lave-?sol/i,
  /compl[eé]ment|vitamine|g[eé]lules?|comprim[eé]s?|probiotique|magn[eé]sium|collag[eè]ne|zinc|om[eé]ga/i,
];

async function main(){
  const { data: cat } = await db.from('categories').select('id').eq('slug','hygiene-paper-products').maybeSingle();
  const PAGE=1000; let from=0; const H=[];
  for(;;){ const { data } = await db.from('products').select('id,name').eq('category_id',cat.id).eq('is_active',true).order('id').range(from,from+PAGE-1);
    if(!data||!data.length) break; H.push(...data); from+=PAGE; if(data.length<PAGE) break; }

  const kept=[], ids=[];
  for(const p of H){ if(KEEP.some(r=>r.test(p.name||''))) kept.push(p); else ids.push(p.id); }

  console.log(`Actifs dans la catégorie : ${H.length}`);
  console.log(`  GARDÉS (papier/entretien/complément) : ${kept.length}`);
  console.log(`  À MASQUER (le reste) : ${ids.length}`);
  console.log('\n── Échantillon GARDÉ ──');
  kept.slice(0,20).forEach(p=>console.log('  ·', (p.name||'').slice(0,60)));

  if(DRY){ console.log('\n[DRY-RUN] aucune écriture.'); return; }
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
