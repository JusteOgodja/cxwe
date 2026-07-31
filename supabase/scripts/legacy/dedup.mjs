/**
 * Déduplique les produits de même nom (doublons multi-plateformes).
 * Garde le MEILLEUR exemplaire par groupe : score = prix(4) + image(2) + longueur description.
 * Supprime les autres (les prix liés partent en cascade — ON DELETE CASCADE).
 *
 * SÉCURITÉ : protège les noms tronqués au scraping (ex: "Huile Essentielle d",
 * "Farine d") qui recouvrent en réalité des produits différents -> jamais supprimés.
 *
 *   node --env-file=.env.seed dedup.mjs --dry-run
 *   node --env-file=.env.seed dedup.mjs
 */
import { createClient } from '@supabase/supabase-js';
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const norm = s => (s||'').trim().toLowerCase().replace(/\s+/g,' ');
// nom jugé tronqué : se termine par une lettre isolée (souvent coupé à l'apostrophe)
const isTruncated = s => { const t=(s||'').trim(); return /\s[a-zà-ÿ]$/i.test(t) || t.length < 10; };

async function fetchAll(table, cols){
  const PAGE=1000; let from=0; const out=[];
  for(;;){ const {data,error}=await db.from(table).select(cols).order('id').range(from,from+PAGE-1);
    if(error){ console.error(table, error.message); process.exit(1);} if(!data.length)break; out.push(...data); from+=PAGE; }
  return out;
}

async function main(){
  const rows = await fetchAll('products','id,name,description,image_url');
  console.log('Produits :', rows.length);
  const priceSet = new Set();
  { const PAGE=1000; let from=0;
    for(;;){ const {data}=await db.from('product_pricing_tiers').select('product_id').order('product_id').range(from,from+PAGE-1);
      if(!data.length)break; for(const r of data)priceSet.add(r.product_id); from+=PAGE; } }

  const groups = new Map();
  for(const r of rows){ const k=norm(r.name); if(!groups.has(k))groups.set(k,[]); groups.get(k).push(r); }

  const score = r => (priceSet.has(r.id)?4:0) + (r.image_url&&r.image_url.trim()?2:0) + Math.min((r.description||'').length,1000)/1000;
  const toDelete = [];
  let dupGroups=0, protectedGroups=0, protectedRows=0;
  const samples=[];
  for(const [k,arr] of groups){
    if(arr.length<2) continue;
    if(isTruncated(arr[0].name)){ protectedGroups++; protectedRows+=arr.length; continue; }
    dupGroups++;
    const sorted=[...arr].sort((a,b)=> score(b)-score(a) || (a.id<b.id?-1:1));
    const keep=sorted[0]; const drop=sorted.slice(1);
    if(samples.length<6) samples.push({name:keep.name, keepScore:score(keep).toFixed(1), n:arr.length});
    for(const d of drop) toDelete.push(d.id);
  }

  console.log('\n── Résumé ──');
  console.log('  groupes de doublons traités :', dupGroups);
  console.log('  lignes à supprimer          :', toDelete.length);
  console.log('  groupes PROTÉGÉS (tronqués) :', protectedGroups, `(${protectedRows} lignes conservées)`);
  console.log('\n── Exemples (nom ×N — garde le meilleur) ──');
  for(const s of samples) console.log(`  x${s.n} score gardé ${s.keepScore} | ${s.name.slice(0,60)}`);

  if(DRY){ console.log('\n[DRY-RUN] aucune suppression.'); return; }
  let done=0;
  for(let i=0;i<toDelete.length;i+=200){
    const b=toDelete.slice(i,i+200);
    const { error } = await db.from('products').delete().in('id',b);
    if(error){ console.error('\n❌',i,error.message); process.exit(1); }
    done+=b.length; process.stdout.write(`\r  supprimés: ${done}/${toDelete.length}`);
  }
  process.stdout.write('\n'); console.log(`✅ ${done} doublons supprimés.`);
}
main();
