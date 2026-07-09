/**
 * #18-19 : remplace les valeurs uniformes (temperature=Ambiante, duree_conservation=365)
 * par des ESTIMATIONS par catégorie (température factuelle + durée typique).
 * Ajoute une mention visible dans `details`. Ne touche que les catégories ALIMENTAIRES.
 *   node --env-file=.env.seed apply_conservation.mjs --dry-run
 *   node --env-file=.env.seed apply_conservation.mjs
 */
import { createClient } from '@supabase/supabase-js';
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const NOTE = 'Conservation & température indicatives selon la catégorie';

// slug -> { temp, duree(jours) }.  Catégories non listées (hygiene, essential-oils) = non touchées.
const MAP = {
  'frozen-fish': ['Surgelé', 365], 'frozen-ready-meals': ['Surgelé', 365], 'frozen-red-fruits': ['Surgelé', 365],
  'fresh-fruits': ['Frais', 10],
  'cheese': ['Réfrigéré', 90], 'margarine': ['Réfrigéré', 180],
  'canned-sardines': ['Ambiante', 1460],
  'pasta-and-couscous': ['Ambiante', 1095],
  'olive-oil': ['Ambiante', 730], 'argan-oil': ['Ambiante', 730], 'vegetable-oil': ['Ambiante', 730],
  'olives': ['Ambiante', 730], 'tomato-sauce-concentrate': ['Ambiante', 730],
  'tea-infusions': ['Ambiante', 730], 'aromatic-herbs': ['Ambiante', 730],
  'organic-saffron': ['Ambiante', 730], 'dry-yeast': ['Ambiante', 730], 'carob-powder': ['Ambiante', 730],
  'wheat-flour-semolina': ['Ambiante', 365], 'noodles': ['Ambiante', 365],
  'chocolate': ['Ambiante', 365], 'confectionery': ['Ambiante', 365],
  'licorice-jellys': ['Ambiante', 365], 'dates': ['Ambiante', 365],
  'biscuits': ['Ambiante', 270],
  'soft-drinks': ['Ambiante', 270], 'fruit-juices': ['Ambiante', 270], 'popcorn-cotton-candy': ['Ambiante', 270],
  'chips-salted-snacks': ['Ambiante', 180], 'dairy-uht-milk': ['Ambiante', 180],
};

async function main(){
  const { data: cats } = await db.from('categories').select('id, slug');
  const catMap = Object.fromEntries(cats.map(c => [c.id, c.slug]));

  const PAGE=1000; let from=0; const updates=[]; const perCat={};
  for(;;){
    const { data, error } = await db.from('products').select('id, category_id, name, details, temperature, duree_conservation').order('id').range(from, from+PAGE-1);
    if(error){ console.error(error.message); process.exit(1); }
    if(!data.length) break;
    for(const p of data){
      const slug = catMap[p.category_id];
      const m = MAP[slug]; if(!m) continue;
      const [temp, duree] = m;
      const details = Array.isArray(p.details) ? p.details : [];
      const newDetails = details.includes(NOTE) ? details : [...details, NOTE];
      if(p.temperature===temp && p.duree_conservation===duree && details.includes(NOTE)) continue; // déjà à jour
      updates.push({ id:p.id, category_id:p.category_id, name:p.name, temperature:temp, duree_conservation:duree, details:newDetails });
      perCat[slug] = (perCat[slug]||0)+1;
    }
    from+=PAGE;
  }
  console.log('À mettre à jour :', updates.length, 'produits');
  console.log('Répartition par catégorie :');
  Object.entries(perCat).sort((a,b)=>b[1]-a[1]).forEach(([s,n])=>console.log(`  ${String(n).padStart(5)}  ${s}  → ${MAP[s][0]}, ${MAP[s][1]}j`));

  if(DRY){ console.log('\n[DRY-RUN] aucune écriture.'); return; }
  let done=0;
  for(let i=0;i<updates.length;i+=500){
    const b=updates.slice(i,i+500);
    const { error } = await db.from('products').upsert(b,{onConflict:'id'});
    if(error){ console.error('\n❌',i,error.message); process.exit(1); }
    done+=b.length; process.stdout.write(`\r  maj: ${done}/${updates.length}`);
  }
  process.stdout.write('\n'); console.log('✅ Terminé.');
}
main();
