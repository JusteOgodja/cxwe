/**
 * Déduplique UNIQUEMENT les doublons "même source" :
 * un nom de produit qui n'apparaît que sur UNE seule plateforme dans les données
 * source (PRODUITS_CIBLES.json) mais en plusieurs exemplaires = redondance pure.
 * Les noms présents sur PLUSIEURS plateformes (offres concurrentes) sont conservés.
 *
 *   node --env-file=.env.seed dedup_samesource.mjs --dry-run
 *   node --env-file=.env.seed dedup_samesource.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

// --- même nettoyage texte que fix_text.mjs (pour aligner noms JSON <-> base) ---
const NAMED={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',hellip:'…',mdash:'—',ndash:'–'};
const decodeOnce=s=>s.replace(/&#(\d+)[;,]/g,(_,n)=>String.fromCodePoint(+n)).replace(/&#x([0-9a-fA-F]+)[;,]/g,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&([a-zA-Z]+);/g,(m,n)=>n in NAMED?NAMED[n]:m);
function clean(s){ let p,c=s||'',i=0; do{p=c;c=decodeOnce(c);i++;}while(c!==p&&i<5); c=c.replace(/<[^>]+>/g,' '); return c.replace(/\s+/g,' ').trim(); }
const norm=s=>clean(s).toLowerCase();
const isTruncated=s=>{const t=(s||'').trim();return /\s[a-zà-ÿ]$/i.test(t)||t.length<10;};

async function main(){
  // 1) classer les noms via la source
  const data=JSON.parse(readFileSync(join(HERE,'PRODUITS_CIBLES.json'),'utf-8'));
  const plats=new Map(); // normName -> Set(platform)
  const cnt=new Map();
  for(const x of data){
    const n=norm(x.product_name); if(!n)continue;
    if(!plats.has(n))plats.set(n,new Set());
    plats.get(n).add(x.platform_name||'?');
    cnt.set(n,(cnt.get(n)||0)+1);
  }
  // noms "même source" = 1 seule plateforme ET >1 exemplaire
  const sameSource=new Set([...cnt.keys()].filter(n=>cnt.get(n)>1 && plats.get(n).size===1 && !isTruncated(n)));
  console.log('Noms "même source" (éligibles dédup) :', sameSource.size);

  // 2) charger la base
  const PAGE=1000; let from=0; const rows=[];
  for(;;){ const {data:d}=await db.from('products').select('id,name,description,image_url').order('id').range(from,from+PAGE-1); if(!d.length)break; rows.push(...d); from+=PAGE; }
  const priceSet=new Set(); from=0;
  for(;;){ const {data:d}=await db.from('product_pricing_tiers').select('product_id').order('product_id').range(from,from+PAGE-1); if(!d.length)break; for(const r of d)priceSet.add(r.product_id); from+=PAGE; }

  const groups=new Map();
  for(const r of rows){ const k=norm(r.name); if(!groups.has(k))groups.set(k,[]); groups.get(k).push(r); }
  const score=r=>(priceSet.has(r.id)?4:0)+(r.image_url&&r.image_url.trim()?2:0)+Math.min((r.description||'').length,1000)/1000;

  const toDelete=[]; let grp=0; const samples=[];
  for(const [k,arr] of groups){
    if(arr.length<2||!sameSource.has(k))continue;
    grp++;
    const sorted=[...arr].sort((a,b)=>score(b)-score(a)||(a.id<b.id?-1:1));
    if(samples.length<8)samples.push(`x${arr.length} | ${sorted[0].name.slice(0,55)}`);
    for(const d of sorted.slice(1))toDelete.push(d.id);
  }
  console.log('\n── Résumé ──');
  console.log('  groupes dédupliqués (même source) :',grp);
  console.log('  lignes à supprimer                :',toDelete.length);
  console.log('  produits restants après           :',rows.length-toDelete.length);
  console.log('\n── Exemples ──'); samples.forEach(s=>console.log('  '+s));

  if(DRY){ console.log('\n[DRY-RUN] aucune suppression.'); return; }
  let done=0;
  for(let i=0;i<toDelete.length;i+=200){
    const b=toDelete.slice(i,i+200);
    const {error}=await db.from('products').delete().in('id',b);
    if(error){ console.error('\n❌',i,error.message); process.exit(1); }
    done+=b.length; process.stdout.write(`\r  supprimés: ${done}/${toDelete.length}`);
  }
  process.stdout.write('\n'); console.log(`✅ ${done} doublons "même source" supprimés.`);
}
main();
