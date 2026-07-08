/**
 * Convertit en MAD les prix qui étaient à l'origine en EUR/USD.
 * Au seeding, les montants EUR/USD ont été étiquetés MAD sans conversion.
 * Ici on retrouve la devise d'origine (via PRODUITS_CIBLES.json, clé nom+prix)
 * et on multiplie par le taux, en gardant currency = 'MAD'.
 *
 * Taux (modifiables ci-dessous) :
 *   1 EUR = 10.8 MAD   |   1 USD = 10.0 MAD
 *
 *   node --env-file=.env.seed fix_prices.mjs --dry-run
 *   node --env-file=.env.seed fix_prices.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const RATE = { EUR: 10.8, USD: 10.0 };

const ND='Non disponible';
const NAMED={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',rsquo:'’',ldquo:'“',rdquo:'”',hellip:'…',mdash:'—',ndash:'–'};
const decodeOnce=s=>s.replace(/&#(\d+)[;,]/g,(_,n)=>String.fromCodePoint(+n)).replace(/&#x([0-9a-fA-F]+)[;,]/g,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&([a-zA-Z]+);/g,(m,n)=>n in NAMED?NAMED[n]:m);
function clean(s){let p,c=s||'',i=0;do{p=c;c=decodeOnce(c);i++;}while(c!==p&&i<5);c=c.replace(/<[^>]+>/g,' ');return c.replace(/\s+/g,' ').trim();}
const norm=s=>clean(s).toLowerCase();
const cB=v=>{v=(v||'').trim();return v===ND?'':v;};
const pf=v=>{const n=parseFloat(cB(v));return Number.isFinite(n)?n:null;};

async function main(){
  const data=JSON.parse(readFileSync(join(HERE,'PRODUITS_CIBLES.json'),'utf-8'));
  // clé (nom|prix) -> devise d'origine  (uniquement EUR/USD utiles)
  const cur=new Map();
  for(const x of data){
    const p=pf(x.price); if(p===null)continue;
    const c=cB(x.currency); if(c!=='EUR'&&c!=='USD')continue;
    cur.set(`${norm(x.product_name)}|${p.toFixed(2)}`, c);
  }
  console.log('Entrées EUR/USD dans la source :', cur.size);

  // charger les paliers de prix + nom produit
  const PAGE=1000; let from=0; const tiers=[];
  for(;;){
    const {data:d,error}=await db.from('product_pricing_tiers')
      .select('id,product_id,min_quantity,price,currency,product:products(name)')
      .order('id').range(from,from+PAGE-1);
    if(error){console.error(error.message);process.exit(1);}
    if(!d.length)break; tiers.push(...d); from+=PAGE;
  }

  const updates=[]; const sample=[]; const byCur={EUR:0,USD:0};
  for(const t of tiers){
    const name=t.product?.name; if(!name)continue;
    const key=`${norm(name)}|${Number(t.price).toFixed(2)}`;
    const c=cur.get(key); if(!c)continue;
    const np=Math.round(Number(t.price)*RATE[c]*100)/100;
    byCur[c]++;
    if(sample.length<8)sample.push(`${name.slice(0,38)} : ${t.price} ${c} → ${np} MAD`);
    updates.push({id:t.id,product_id:t.product_id,min_quantity:t.min_quantity,price:np,currency:'MAD'});
  }
  console.log(`Prix à convertir : ${updates.length}  (EUR ${byCur.EUR} · USD ${byCur.USD})`);
  console.log(`Taux : 1 EUR = ${RATE.EUR} MAD · 1 USD = ${RATE.USD} MAD`);
  console.log('\n── Exemples ──'); sample.forEach(s=>console.log('  '+s));

  if(DRY){ console.log('\n[DRY-RUN] aucune écriture.'); return; }
  let done=0;
  for(let i=0;i<updates.length;i+=500){
    const b=updates.slice(i,i+500);
    const {error}=await db.from('product_pricing_tiers').upsert(b,{onConflict:'id'});
    if(error){console.error('\n❌',i,error.message);process.exit(1);}
    done+=b.length; process.stdout.write(`\r  convertis: ${done}/${updates.length}`);
  }
  process.stdout.write('\n'); console.log(`✅ ${done} prix convertis en MAD.`);
}
main();
