/**
 * Corrige les image_url malformées : fragments JSON-LD scrapés
 * (ex: "{'@type':'ImageObject','url':'https://.../img.jpg'}") -> URL propre.
 * Si aucune URL exploitable -> chaîne vide (placeholder côté app).
 *
 *   node --env-file=.env.seed fix_images.mjs --dry-run
 *   node --env-file=.env.seed fix_images.mjs
 */
import { createClient } from '@supabase/supabase-js';
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;
function extract(raw){
  const u = (raw||'').trim();
  if(/^https?:\/\//.test(u) && u[0]!=='{') return u;          // déjà propre
  // 1) valeur d'une clé image explicite (url / contentUrl)
  const m = u.match(/['"](?:content)?url['"]\s*:\s*['"](https?:\/\/[^'"]+)['"]/i);
  if(m && !m[1].includes('#')) return m[1];
  // 2) sinon, une URL qui pointe vers un vrai fichier image
  const all = [...u.matchAll(/https?:\/\/[^'"\s\\}\]]+/g)].map(x=>x[0]);
  const img = all.find(x=>IMG_EXT.test(x));
  if(img) return img;
  // 3) rien d'exploitable (ancre de page, @id…) -> vide
  return '';
}

async function main(){
  const PAGE=1000; let from=0, changed=0, emptied=0; const updates=[]; const samples=[];
  for(;;){
    const { data, error } = await db.from('products')
      .select('id,category_id,name,image_url').order('id').range(from,from+PAGE-1);
    if(error){ console.error(error.message); process.exit(1); }
    if(!data.length) break;
    for(const r of data){
      const cur=(r.image_url||'').trim();
      if(/^https?:\/\//.test(cur) && cur[0]!=='{') continue;   // ok
      if(!cur) continue;                                       // déjà vide
      const nu = extract(cur);
      if(nu !== cur){
        changed++; if(nu==='') emptied++;
        if(samples.length<5) samples.push([cur, nu]);
        updates.push({ id:r.id, category_id:r.category_id, name:r.name, image_url:nu });
      }
    }
    from+=PAGE;
  }
  console.log('\n── Exemples ──');
  for(const [a,b] of samples){ console.log('AVANT:',JSON.stringify(a.slice(0,80))); console.log('APRÈS:',JSON.stringify(b.slice(0,80)),'\n'); }
  console.log(`${changed} image_url à corriger (dont ${emptied} vidées faute d'URL).`);
  if(DRY){ console.log('[DRY-RUN] aucune écriture.'); return; }
  let done=0;
  for(let i=0;i<updates.length;i+=500){
    const b=updates.slice(i,i+500);
    const { error } = await db.from('products').upsert(b,{onConflict:'id'});
    if(error){ console.error('\n❌',i,error.message); process.exit(1); }
    done+=b.length; process.stdout.write(`\r  corrigés: ${done}/${updates.length}`);
  }
  process.stdout.write('\n'); console.log(`✅ ${done} image_url corrigées.`);
}
main();
