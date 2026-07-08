/**
 * Normalise la casse des noms de produits ENTIÈREMENT en majuscules.
 * Préserve : les unités/tailles/codes contenant un chiffre (250ML, 33CL, 2X170G),
 * les apostrophes et traits d'union (L'OREAL -> L'Oreal, COCA-COLA -> Coca-Cola).
 * N'affecte QUE les noms tout en majuscules ; les noms déjà en casse mixte sont ignorés.
 *
 *   node --env-file=.env.seed fix_case.mjs --dry-run
 *   node --env-file=.env.seed fix_case.mjs
 */
import { createClient } from '@supabase/supabase-js';
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

// petits mots gardés en minuscule (sauf en 1re position)
const SMALL = new Set(['de','du','des','le','la','les','et','à','au','aux','en','un','une','the','of','and','for','sur','par','pour','ou','d','l']);

function capWord(w){
  if(/\d/.test(w)) return w;                      // 250ML, 33CL, 2X170G, 6M -> inchangé
  // capitaliser après début, apostrophe et trait d'union
  return w.toLowerCase().replace(/(^|['’-])([a-zà-ÿ])/g, (_,sep,ch)=>sep+ch.toUpperCase());
}
function titleCase(name){
  const words = name.split(/(\s+)/); // garde les espaces
  let first = true;
  return words.map(tok=>{
    if(/^\s+$/.test(tok)) return tok;
    const lower = tok.toLowerCase();
    let out;
    if(!first && SMALL.has(lower.replace(/['’]/g,'')) && !/\d/.test(tok)) out = lower;
    else out = capWord(tok);
    first = false;
    return out;
  }).join('');
}
const isAllCaps = s => s.length>=8 && s===s.toUpperCase() && /[A-ZÀ-Þ]/.test(s);

async function main(){
  const PAGE=1000; let from=0, changed=0; const updates=[]; const samples=[];
  for(;;){
    const { data, error } = await db.from('products').select('id,category_id,name').order('id').range(from,from+PAGE-1);
    if(error){ console.error(error.message); process.exit(1); }
    if(!data.length) break;
    for(const r of data){
      if(!isAllCaps(r.name)) continue;
      const nn = titleCase(r.name);
      if(nn !== r.name){ changed++; if(samples.length<8)samples.push([r.name,nn]); updates.push({id:r.id,category_id:r.category_id,name:nn}); }
    }
    from+=PAGE;
  }
  console.log('── Exemples ──');
  for(const [a,b] of samples){ console.log('AVANT:',a); console.log('APRÈS:',b,'\n'); }
  console.log(`${changed} noms à normaliser.`);
  if(DRY){ console.log('[DRY-RUN] aucune écriture.'); return; }
  let done=0;
  for(let i=0;i<updates.length;i+=500){
    const b=updates.slice(i,i+500);
    const { error } = await db.from('products').upsert(b,{onConflict:'id'});
    if(error){ console.error('\n❌',i,error.message); process.exit(1); }
    done+=b.length; process.stdout.write(`\r  corrigés: ${done}/${updates.length}`);
  }
  process.stdout.write('\n'); console.log(`✅ ${done} noms normalisés.`);
}
main();
