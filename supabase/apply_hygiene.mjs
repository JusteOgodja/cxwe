/**
 * Masque (is_active=false, RÉVERSIBLE) certains TYPES dans "Hygiene & Paper Products" :
 * cosmétique / soins / bucco-dentaire / déo / couches / rasage / hygiène fém. / bébé matériel / maquillage.
 * GARDE : papier, entretien maison, compléments, et le non-classé.
 * Même classification (ordre) que l'analyse -> comptes identiques.
 *   node --env-file=.env.seed apply_hygiene.mjs --dry-run
 *   node --env-file=.env.seed apply_hygiene.mjs
 */
import { createClient } from '@supabase/supabase-js';
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

// ordre identique à l'analyse (premier match gagne)
const BUCKETS = [
  ['cheveux', /shampo|apr[eè]s-?shampo|coloration|cheveux|capillaire|masque cheveux|laque|gel coiffant/i, true],
  ['bucco',   /dentifrice|brosse à dents|bain de bouche|fil dentaire|blanchiment dent|oral-?b/i, true],
  ['corps',   /cr[eè]me|s[eé]rum|lotion|gel douche|savon|gommage|hydratant|anti-?[aâ]ge|visage|corps|peau|soin|baume|huile de soin/i, true],
  ['deo',     /d[eé]odorant|parfum|eau de toilette|anti-?transpirant/i, true],
  ['maquillage', /maquillage|rouge à l[eè]vres|mascara|vernis|fond de teint|fard|eyeliner/i, true],
  ['couches', /couches?|lingettes?|change b[eé]b[eé]/i, true],
  ['feminine',/serviette hygi|tampon|proteg|coupe menstru/i, true],
  ['papier',  /papier toilette|papier hygi|essuie-?tout|mouchoirs?|sopalin|rouleau/i, false],       // GARDÉ
  ['entretien',/lessive|d[eé]tergent|nettoyant|d[eé]sinfectant|javel|adoucissant|vaisselle|multi-?surface|liquide vaisselle/i, false], // GARDÉ
  ['rasage',  /rasage|rasoir|[eé]pilation|cire|mousse à raser|lame/i, true],
  ['complement',/compl[eé]ment|vitamine|g[eé]lules?|comprim[eé]s?|s[eé]rum physio|probiotique|magn[eé]sium|collag[eè]ne/i, false], // GARDÉ
  ['bebe_mat',/biberon|sucette|t[eé]tine|jouet|poussette|tapis d.[eé]veil|table à langer/i, true],
];

async function main(){
  const { data: cat } = await db.from('categories').select('id').eq('slug','hygiene-paper-products').maybeSingle();
  if(!cat){ console.error('catégorie introuvable'); process.exit(1); }

  const PAGE=1000; let from=0; const H=[];
  for(;;){ const { data } = await db.from('products').select('id,name').eq('category_id',cat.id).eq('is_active',true).order('id').range(from,from+PAGE-1);
    if(!data||!data.length) break; H.push(...data); from+=PAGE; if(data.length<PAGE) break; }

  const ids=[]; const counts={};
  for(const p of H){
    const nm=p.name||'';
    for(const [label,rx,mask] of BUCKETS){
      if(rx.test(nm)){ if(mask){ ids.push(p.id); counts[label]=(counts[label]||0)+1; } break; }
    }
  }
  console.log(`Actifs dans la catégorie : ${H.length}`);
  console.log('À masquer par type :'); Object.entries(counts).forEach(([k,v])=>console.log(`  ${String(v).padStart(5)}  ${k}`));
  console.log(`TOTAL à masquer : ${ids.length}  |  conservés dans la catégorie : ${H.length-ids.length}`);

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
