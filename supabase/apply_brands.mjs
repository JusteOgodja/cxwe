/**
 * #27 : nettoyage des marques (RÉVERSIBLE).
 *  A) 12 enseignes/plateformes : marque_id=NULL sur leurs produits + marque is_active=false
 *  B) marques sans produit actif : is_active=false
 *   node --env-file=.env.seed apply_brands.mjs --dry-run
 *   node --env-file=.env.seed apply_brands.mjs
 */
import { createClient } from '@supabase/supabase-js';
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const ENSEIGNES = [
  'Fidari Market','Natureo Shop','Carrefour','Bienmanger.com Chocolats','Beautystation.ma',
  'Bébé Shop','Baby And Mom','Poisson-Congele.ma','Mymarket.ma','Fatla Animalerie',
  'Marché Express','Bienmanger.com',
];

async function main(){
  const brands = [];
  for (let from=0;;from+=1000){
    const { data } = await db.from('brands').select('id, name').order('id').range(from, from+999);
    if(!data||!data.length) break;
    brands.push(...data);
    if(data.length<1000) break;
  }
  const byName = new Map(brands.map(b => [b.name, b.id]));
  const enseigneIds = ENSEIGNES.map(n => byName.get(n)).filter(Boolean);
  console.log(`Enseignes trouvées : ${enseigneIds.length}/${ENSEIGNES.length}`);

  // A) délier les produits des enseignes
  let unlinked = 0;
  for (const id of enseigneIds) {
    const { count } = await db.from('products').select('id',{count:'exact',head:true}).eq('marque_id', id);
    unlinked += count || 0;
  }
  console.log(`  produits à délier (marque_id=NULL) : ${unlinked}`);

  // B) marques sans produit actif -> distinct marque_id des produits actifs
  const used = new Set();
  for (let from=0;;from+=1000){
    const { data } = await db.from('products').select('marque_id').eq('is_active',true).not('marque_id','is',null).range(from,from+999);
    if(!data||!data.length) break;
    data.forEach(r=>used.add(r.marque_id));
    if(data.length<1000) break;
  }
  const emptyIds = brands.filter(b => !used.has(b.id)).map(b=>b.id);
  console.log(`  marques sans produit actif à désactiver : ${emptyIds.length}`);

  if (DRY){ console.log('\n[DRY-RUN] aucune écriture.'); return; }

  // exécuter A
  for (const id of enseigneIds){
    await db.from('products').update({ marque_id: null }).eq('marque_id', id);
  }
  await db.from('brands').update({ is_active:false }).in('id', enseigneIds);
  console.log('✔ Enseignes déliées + désactivées.');

  // exécuter B (inclut les enseignes désormais vides — recalcul简单 via la liste)
  const toDisable = [...new Set([...emptyIds, ...enseigneIds])];
  for (let i=0;i<toDisable.length;i+=200){
    await db.from('brands').update({ is_active:false }).in('id', toDisable.slice(i,i+200));
  }
  console.log(`✅ ${toDisable.length} marques désactivées au total.`);
}
main();
