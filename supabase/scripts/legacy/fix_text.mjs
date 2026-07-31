/**
 * Corrige les anomalies textuelles du catalogue (name + description) :
 *  - entités HTML (numériques &#039; / nommées &amp; &quot; &nbsp; &eacute; …), y compris double-encodage
 *  - balises HTML (<p> </p> <br> …)
 *  - mojibake UTF-8 lu en latin1 (Ã©→é, Ã‰→É, â€™→’ …)
 *  - espaces multiples / superflus
 *
 * Usage :
 *   node --env-file=.env.seed fix_text.mjs --dry-run   (aperçu, aucune écriture)
 *   node --env-file=.env.seed fix_text.mjs             (applique les corrections)
 */
import { createClient } from '@supabase/supabase-js';
const DRY = process.argv.includes('--dry-run');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const NAMED = {
  amp:'&', quot:'"', apos:"'", lt:'<', gt:'>', nbsp:' ', laquo:'«', raquo:'»',
  hellip:'…', mdash:'—', ndash:'–', rsquo:'’', lsquo:'‘', ldquo:'“', rdquo:'”',
  eacute:'é', egrave:'è', ecirc:'ê', euml:'ë', agrave:'à', acirc:'â', aacute:'á',
  ccedil:'ç', ocirc:'ô', ograve:'ò', oacute:'ó', ucirc:'û', ugrave:'ù', uacute:'ú', uuml:'ü',
  icirc:'î', iuml:'ï', iacute:'í', ntilde:'ñ', oelig:'œ', aelig:'æ', deg:'°', euro:'€',
  Eacute:'É', Egrave:'È', Ecirc:'Ê', Agrave:'À', Acirc:'Â', Ccedil:'Ç', Ocirc:'Ô', Ucirc:'Û',
  reg:'®', copy:'©', trade:'™', middot:'·', bull:'•', times:'×',
};
function decodeOnce(s){
  return s
    .replace(/&#(\d+)[;,]/g, (_,n)=>String.fromCodePoint(+n))
    .replace(/&#x([0-9a-fA-F]+)[;,]/g, (_,h)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&([a-zA-Z]+);/g, (m,name)=> name in NAMED ? NAMED[name] : m);
}
function decodeEntities(s){
  let prev, cur = s, i = 0;
  do { prev = cur; cur = decodeOnce(cur); i++; } while (cur !== prev && i < 5);
  return cur;
}
const MOJIBAKE = [
  ['Ã©','é'],['Ã¨','è'],['Ãª','ê'],['Ã«','ë'],['Ã ','à'],['Ã¢','â'],['Ã´','ô'],
  ['Ã»','û'],['Ã¹','ù'],['Ã®','î'],['Ã¯','ï'],['Ã§','ç'],['Ã‰','É'],['Ã€','À'],
  ['Ã‡','Ç'],['Ã¼','ü'],['Ã¶','ö'],['â€™','’'],['â€œ','“'],['â€','”'],
  ['â€“','–'],['â€”','—'],['â€¦','…'],['Â°','°'],['Â»','»'],['Â«','«'],['Â ',' '],['Â',''],
];
function fixMojibake(s){ for(const [a,b] of MOJIBAKE) s = s.split(a).join(b); return s; }
function stripTags(s){
  return s
    .replace(/<\s*br\s*\/?>/gi,' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi,' ')
    .replace(/<[^>]+>/g,'');
}
function clean(s){
  if(!s) return s;
  let out = decodeEntities(s);
  out = fixMojibake(out);
  out = stripTags(out);
  out = decodeEntities(out);            // entités révélées après strip
  out = out.replace(/\s+/g,' ').trim();
  return out;
}

async function main(){
  const PAGE = 1000;
  let from = 0, scanned = 0, changed = 0;
  const updates = [];
  const samples = [];
  for(;;){
    const { data, error } = await db.from('products')
      .select('id, category_id, name, description')
      .order('id').range(from, from+PAGE-1);
    if(error){ console.error(error.message); process.exit(1); }
    if(!data.length) break;
    for(const r of data){
      scanned++;
      const n2 = clean(r.name), d2 = clean(r.description);
      if(n2 !== r.name || d2 !== (r.description||'')){
        changed++;
        if(samples.length < 6 && n2 !== r.name) samples.push([r.name, n2]);
        updates.push({ id:r.id, category_id:r.category_id, name:n2, description:d2 });
      }
    }
    from += PAGE;
    process.stdout.write(`\r  scannés: ${scanned}  à corriger: ${changed}`);
  }
  process.stdout.write('\n');
  console.log('\n── Exemples de corrections (name) ──');
  for(const [a,b] of samples){ console.log('  AVANT:', JSON.stringify(a.slice(0,90))); console.log('  APRÈS:', JSON.stringify(b.slice(0,90)),'\n'); }

  if(DRY){ console.log(`[DRY-RUN] ${changed}/${scanned} produits seraient corrigés. Aucune écriture.`); return; }

  let done = 0;
  for(let i=0;i<updates.length;i+=500){
    const batch = updates.slice(i,i+500);
    const { error } = await db.from('products').upsert(batch, { onConflict:'id' });
    if(error){ console.error('\n❌ update lot', i, error.message); process.exit(1); }
    done += batch.length;
    process.stdout.write(`\r  corrigés: ${done}/${updates.length}`);
  }
  process.stdout.write('\n');
  console.log(`✅ ${done} produits corrigés.`);
}
main();
