// Real-JWT RLS test harness against LOCAL Supabase (127.0.0.1:54321).
// Synthetic users A, B, admin. Per role/table: SELECT, INSERT (return=minimal, as frontend),
// UPDATE & DELETE on a DEDICATED throwaway row (created via service_role) measured with
// return=representation → affected-rowcount. Also an explicit A<->B isolation probe for demandes.

const API = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const USERS = {
  A:     { email: 'usera@synthetic.test',  password: 'Passw0rd!A' },
  B:     { email: 'userb@synthetic.test',  password: 'Passw0rd!B' },
  admin: { email: 'admin@synthetic.test',  password: 'Passw0rd!X' },
};
const tables = ['suppliers','product_pricing_tiers','product_images','product_lots','media','quote_requests','collaboration_requests'];
const catalogInsert = {
  suppliers: { name: 'Hack', is_active: true },
  product_pricing_tiers: { min_quantity: 1, price: 1 },
  product_images: { url: 'x' },
  product_lots: { lot: 'L', quantity: 1 },
  media: { url: 'x' },
};
const demandeInsert = {
  quote_requests: { company_name: 'X', contact_name: 'Y', email: 'z@z.z', country: 'MA' },
  collaboration_requests: { company: 'X', email: 'z@z.z' },
};
const updField = (tbl) => (tbl === 'suppliers') ? { name: 'upd' }
  : (tbl.startsWith('quote') || tbl.startsWith('collab')) ? { status: 'touched' }
  : (tbl === 'media' || tbl === 'product_images') ? { url: 'upd' }
  : (tbl === 'product_lots') ? { lot: 'upd' } : { min_quantity: 2 };

async function adminCreate(u) {
  const r = await fetch(`${API}/auth/v1/admin/users`, { method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password, email_confirm: true }) });
  if (!r.ok && r.status !== 422) throw new Error(`create ${u.email}: ${r.status} ${await r.text()}`);
}
async function login(u) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password }) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`login ${u.email}: ${JSON.stringify(j)}`);
  return j.access_token;
}
async function rest(token, method, path, body, prefer) {
  const headers = { apikey: ANON, Authorization: `Bearer ${token || ANON}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers['Prefer'] = prefer;
  const r = await fetch(`${API}/rest/v1/${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text(); let d; try { d = JSON.parse(text); } catch { d = text; }
  return { status: r.status, data: d };
}
// create a dedicated row via service_role, return its id
async function seedRow(tbl) {
  const body = { ...(catalogInsert[tbl] || demandeInsert[tbl]) };
  const r = await rest(SERVICE, 'POST', tbl, body, 'return=representation');
  return Array.isArray(r.data) && r.data[0] ? r.data[0].id : null;
}
function affected(res) { // for representation mutations
  if (res.status >= 200 && res.status < 300) return `${res.status}(${Array.isArray(res.data) ? res.data.length : 0})`;
  return `${res.status}${res.data && res.data.code ? '/' + res.data.code : ''}`;
}
function selShort(res) {
  if (res.status >= 200 && res.status < 300) return `${res.status}(${Array.isArray(res.data) ? res.data.length : 0})`;
  return `${res.status}${res.data && res.data.code ? '/' + res.data.code : ''}`;
}
function insShort(res) { // return=minimal: 201 ok, else blocked
  return `${res.status}${res.data && res.data.code ? '/' + res.data.code : ''}`;
}

async function main() {
  for (const k of Object.keys(USERS)) await adminCreate(USERS[k]);
  const tok = {}; for (const k of Object.keys(USERS)) tok[k] = await login(USERS[k]);
  const roles = { anon: null, A: tok.A, B: tok.B, admin: tok.admin };

  const results = {};
  for (const tbl of tables) {
    results[tbl] = {};
    for (const [role, token] of Object.entries(roles)) {
      const sel = await rest(token, 'GET', `${tbl}?select=id&limit=5`);
      const ins = await rest(token, 'POST', tbl, catalogInsert[tbl] || demandeInsert[tbl], 'return=minimal');
      const updId = await seedRow(tbl);
      const upd = await rest(token, 'PATCH', `${tbl}?id=eq.${updId}`, updField(tbl), 'return=representation');
      const delId = await seedRow(tbl);
      const del = await rest(token, 'DELETE', `${tbl}?id=eq.${delId}`, undefined, 'return=representation');
      results[tbl][role] = { SELECT: selShort(sel), INSERT: insShort(ins), UPDATE: affected(upd), DELETE: affected(del) };
    }
  }

  // Explicit cross-user isolation probe for demandes (owner-less tables):
  // A creates a row (via anon-style public insert is anon; here as A), B tries to read/update/delete it.
  const iso = {};
  for (const tbl of ['quote_requests','collaboration_requests']) {
    // seed a row "owned conceptually by A" via service (no owner column exists)
    const id = await seedRow(tbl);
    const bRead = await rest(tok.B, 'GET', `${tbl}?id=eq.${id}&select=id`);
    const bUpd = await rest(tok.B, 'PATCH', `${tbl}?id=eq.${id}`, { status: 'hijack' }, 'return=representation');
    const bDel = await rest(tok.B, 'DELETE', `${tbl}?id=eq.${id}`, undefined, 'return=representation');
    iso[tbl] = { B_read: selShort(bRead), B_update: affected(bUpd), B_delete: affected(bDel) };
  }

  console.log('\n===== RLS MATRIX (SELECT/UPDATE/DELETE show status(rowsAffected); INSERT shows status) =====');
  for (const tbl of tables) {
    console.log(`\n## ${tbl}`);
    console.log('role   | SELECT     | INSERT     | UPDATE     | DELETE');
    for (const role of ['anon','A','B','admin']) {
      const r = results[tbl][role];
      console.log(`${role.padEnd(6)} | ${String(r.SELECT).padEnd(10)} | ${String(r.INSERT).padEnd(10)} | ${String(r.UPDATE).padEnd(10)} | ${r.DELETE}`);
    }
  }
  console.log('\n===== CROSS-USER ISOLATION (demandes; B acting on a foreign row) =====');
  for (const tbl of Object.keys(iso)) console.log(`${tbl}: B_read=${iso[tbl].B_read}  B_update=${iso[tbl].B_update}  B_delete=${iso[tbl].B_delete}`);
  console.log('\n===== JSON =====');
  console.log(JSON.stringify({ results, iso }));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
