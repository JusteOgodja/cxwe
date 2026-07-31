/**
 * Exporte toutes les tables de la base vers des fichiers JSON.
 *   node --env-file=.env.seed export_db.mjs
 * Sortie : supabase/export/<table>.json  (+ un manifest récapitulatif)
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'export');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const TABLES = [
  'categories', 'brands', 'suppliers', 'products',
  'product_pricing_tiers', 'product_lots', 'media',
  'quote_requests', 'collaboration_requests',
];

async function dump(table){
  const PAGE=1000; let from=0; const rows=[];
  for(;;){
    const { data, error } = await db.from(table).select('*').order('id').range(from, from+PAGE-1);
    if(error){ return { table, error: error.message }; }
    if(!data.length) break;
    rows.push(...data); from+=PAGE;
    if(data.length<PAGE) break;
  }
  writeFileSync(join(OUT, `${table}.json`), JSON.stringify(rows));
  return { table, rows: rows.length };
}

async function main(){
  mkdirSync(OUT, { recursive: true });
  const manifest = [];
  for(const t of TABLES){
    const r = await dump(t);
    manifest.push(r);
    console.log(r.error ? `  ⚠ ${t}: ${r.error}` : `  ✔ ${t}: ${r.rows} lignes`);
  }
  writeFileSync(join(OUT, '_manifest.json'), JSON.stringify({ exported_at_utc: null, tables: manifest }, null, 2));
  console.log('\nExport terminé →', OUT);
}
main();
