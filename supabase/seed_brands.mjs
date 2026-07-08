/**
 * Peuple la table `brands` depuis le champ `brand` du fichier source,
 * puis rattache chaque produit à sa marque (products.marque_id).
 * Matching produit <-> source par nom nettoyé (même pipeline que la base).
 * (Aucun fournisseur : choix utilisateur.)
 *
 *   node --env-file=.env.seed seed_brands.mjs --dry-run
 *   node --env-file=.env.seed seed_brands.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const ND='Non disponible';
const NAMED={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',rsquo:'’',ldquo:'“',rdquo:'”',hellip:'…',mdash:'—',ndash:'–'};
const decodeOnce=s=>s.replace(/&#(\d+)[;,]/g,(_,n)=>String.fromCodePoint(+n)).replace(/&#x([0-9a-fA-F]+)[;,]/g,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&([a-zA-Z]+);/g,(m,n)=>n in NAMED?NAMED[n]:m);
function clean(s){let p,c=s||'',i=0;do{p=c;c=decodeOnce(c);i++;}while(c!==p&&i<5);c=c.replace(/<[^>]+>/g,' ');return c.replace(/\s+/g,' ').trim();}
const norm=s=>clean(s).toLowerCase();
const cB=v=>{v=(v||'').trim();return v===ND?'':v;};
const slugify=s=>clean(s).toLowerCase().replace(/[&/]/g,' ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
// casse propre pour l'affichage : garde les tokens ALL-CAPS courts (APIA) et ceux avec chiffres
const titleBrand=s=>clean(s).split(/\s+/).map(w=>{
  if(/\d/.test(w))return w;
  if(w.length<=4 && w===w.toUpperCase())return w;   // APIA, C&C…
  return w.toLowerCase()
    .replace(/(^|[-])([a-zà-ÿ])/g,(_,sep,ch)=>sep+ch.toUpperCase())          // début + après trait d'union
    .replace(/(['’])([a-zà-ÿ])(?=[a-zà-ÿ])/g,(_,sep,ch)=>sep+ch.toUpperCase()); // après apostrophe seulement si 2+ lettres (L'Olivier oui, Carter's non)
}).join(' ');

async function main(){
  const data=JSON.parse(readFileSync(join(HERE,'PRODUITS_CIBLES.json'),'utf-8'));
  // nom -> compteur de marques
  const nameBrands=new Map();
  for(const x of data){
    const n=norm(x.product_name); const b=cB(x.brand);
    if(!n||!b)continue;
    if(!nameBrands.has(n))nameBrands.set(n,new Map());
    const m=nameBrands.get(n); m.set(b,(m.get(b)||0)+1);
  }
  // nom -> marque majoritaire
  const nameBrand=new Map();
  for(const [n,m] of nameBrands){ nameBrand.set(n,[...m.entries()].sort((a,b)=>b[1]-a[1])[0][0]); }

  // marques distinctes (dédup par slug)
  const bySlug=new Map(); // slug -> name
  for(const b of nameBrand.values()){ const s=slugify(b); if(s&&!bySlug.has(s))bySlug.set(s,titleBrand(b)); }
  console.log('Marques distinctes (par slug) :', bySlug.size);

  // charger produits base
  const PAGE=1000; let from=0; const rows=[];
  for(;;){ const {data:d}=await db.from('products').select('id,category_id,name,marque_id').order('id').range(from,from+PAGE-1); if(!d.length)break; rows.push(...d); from+=PAGE; }

  // calculer assignations
  let willAssign=0; const sample=[];
  const assign=[]; // {id,category_id,name,slug}
  for(const r of rows){
    const b=nameBrand.get(norm(r.name)); if(!b)continue;
    const s=slugify(b); if(!s)continue;
    willAssign++;
    if(sample.length<8)sample.push(`${r.name.slice(0,40)}  →  ${b}`);
    assign.push({id:r.id,category_id:r.category_id,name:r.name,slug:s});
  }
  console.log(`Produits qui recevront une marque : ${willAssign}/${rows.length}`);
  console.log('\n── Exemples ──'); sample.forEach(s=>console.log('  '+s));

  if(DRY){ console.log('\n[DRY-RUN] aucune écriture.'); return; }

  // 1) insérer les marques
  const brandRows=[...bySlug].map(([slug,name])=>({name,slug,is_active:true}));
  for(let i=0;i<brandRows.length;i+=500){
    const {error}=await db.from('brands').upsert(brandRows.slice(i,i+500),{onConflict:'slug'});
    if(error){console.error('❌ brands',error.message);process.exit(1);}
  }
  console.log(`✔ ${brandRows.length} marques upsert.`);
  // relire ids
  const brandId=new Map(); from=0;
  for(;;){ const {data:d}=await db.from('brands').select('id,slug').order('id').range(from,from+PAGE-1); if(!d.length)break; for(const b of d)brandId.set(b.slug,b.id); from+=PAGE; }

  // 2) rattacher les produits
  const payload=assign.map(a=>({id:a.id,category_id:a.category_id,name:a.name,marque_id:brandId.get(a.slug)})).filter(p=>p.marque_id);
  let done=0;
  for(let i=0;i<payload.length;i+=500){
    const {error}=await db.from('products').upsert(payload.slice(i,i+500),{onConflict:'id'});
    if(error){console.error('\n❌ products',i,error.message);process.exit(1);}
    done+=Math.min(500,payload.length-i); process.stdout.write(`\r  rattachés: ${done}/${payload.length}`);
  }
  process.stdout.write('\n'); console.log(`✅ ${done} produits rattachés à leur marque.`);
}
main();
