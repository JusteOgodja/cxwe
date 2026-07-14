/**
 * Supprime DÉFINITIVEMENT les produits masqués (is_active=false).
 * ⚠️ IRRÉVERSIBLE. Fait d'abord une sauvegarde JSON (produits + paliers de prix)
 * dans supabase/deleted_backup_<date>.json avant toute suppression.
 * La suppression des produits fait tomber leurs prix en cascade (ON DELETE CASCADE).
 *   node --env-file=.env.seed delete_masked.mjs --dry-run   (sauvegarde + compte, aucune suppression)
 *   node --env-file=.env.seed delete_masked.mjs             (sauvegarde PUIS suppression)
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

async function fetchAll(table, cols, filter){
  const PAGE=1000; let from=0; const out=[];
  for(;;){
    let q = db.from(table).select(cols).order('id').range(from, from+PAGE-1);
    if(filter) q = filter(q);
    const { data, error } = await q;
    if(error){ console.error(table, error.message); process.exit(1); }
    if(!data.length) break;
    out.push(...data); from+=PAGE; if(data.length<PAGE) break;
  }
  return out;
}

async function main(){
  const masked = await fetchAll('products','*',(q)=>q.eq('is_active',false));
  const ids = masked.map(p=>p.id);
  console.log(`Produits masqués à supprimer : ${ids.length}`);

  // sauvegarde (produits + leurs paliers de prix)
  const idSet = new Set(ids);
  const allTiers = await fetchAll('product_pricing_tiers','*');
  const tiers = allTiers.filter(t=>idSet.has(t.product_id));
  const backupPath = join(HERE, `deleted_backup_2026-07-12.json`);
  writeFileSync(backupPath, JSON.stringify({ note:'Produits supprimés (is_active=false) + paliers de prix', products: masked, pricing_tiers: tiers }));
  console.log(`✔ Sauvegarde écrite : ${backupPath}  (${masked.length} produits, ${tiers.length} prix)`);

  if(DRY){ console.log('\n[DRY-RUN] aucune suppression.'); return; }

  let done=0;
  for(let i=0;i<ids.length;i+=200){
    const b=ids.slice(i,i+200);
    const { error } = await db.from('products').delete().in('id', b);
    if(error){ console.error('\n❌',i,error.message); process.exit(1); }
    done+=b.length; process.stdout.write(`\r  supprimés: ${done}/${ids.length}`);
  }
  process.stdout.write('\n');
  console.log(`✅ ${done} produits supprimés définitivement.`);
}
main();
