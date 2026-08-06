import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * RLS / security regression tests — API level, LOCAL Supabase ONLY.
 * Requires a local stack whose public schema has the hardened policies applied
 * (see security-audit/*/tests/local_stack fixtures). Self-skips when env is absent
 * so it never runs against production.
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY (local demo keys).
 * Creates synthetic users A/B/admin and deletes them on teardown (local only).
 */
const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAIL = process.env.SYNTH_ADMIN_EMAIL || 'admin@synthetic.test';

const configured = !!(URL && ANON && SERVICE);
test.skip(!configured, 'Local Supabase not configured (SUPABASE_URL/ANON/SERVICE); skipping RLS regression.');
// Guard rail: refuse to run against anything that is not localhost.
if (configured && !/127\.0\.0\.1|localhost/.test(URL!)) {
  throw new Error('security-regression must target a LOCAL Supabase only. Refusing non-local URL.');
}

const users = {
  A: { email: 'usera@synthetic.test', password: 'Passw0rd!A', token: '', uid: '' },
  B: { email: 'userb@synthetic.test', password: 'Passw0rd!B', token: '', uid: '' },
  admin: { email: ADMIN_EMAIL, password: 'Passw0rd!X', token: '', uid: '' },
};

test.beforeAll(async () => {
  const api = await pwRequest.newContext({ baseURL: URL });
  for (const k of Object.keys(users) as (keyof typeof users)[]) {
    const u = users[k];
    await api.post('/auth/v1/admin/users', {
      headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE!}`, 'Content-Type': 'application/json' },
      data: { email: u.email, password: u.password, email_confirm: true },
    }).catch(() => {});
    const r = await api.post('/auth/v1/token?grant_type=password', {
      headers: { apikey: ANON!, 'Content-Type': 'application/json' },
      data: { email: u.email, password: u.password },
    });
    const j = await r.json();
    u.token = j.access_token; u.uid = j.user?.id;
  }
  await api.dispose();
});

function ctx(token?: string) {
  return pwRequest.newContext({
    baseURL: URL,
    extraHTTPHeaders: { apikey: ANON!, Authorization: `Bearer ${token || ANON!}` },
  });
}

test('anon cannot execute admin/search RPCs', async () => {
  const api = await ctx();
  for (const fn of ['get_quality_stats', 'get_products_with_issues', 'search_products', 'list_source_sites']) {
    const r = await api.post(`/rest/v1/rpc/${fn}`, { headers: { 'Content-Type': 'application/json' }, data: {} });
    expect(r.status(), `anon exec ${fn}`).toBeGreaterThanOrEqual(401);
    expect(r.status()).toBeLessThan(404);
  }
  await api.dispose();
});

test('ordinary user is not admin and cannot read requests', async () => {
  const api = await ctx(users.A.token);
  const isAdmin = await api.post('/rest/v1/rpc/is_admin', { headers: { 'Content-Type': 'application/json' }, data: {} });
  expect(await isAdmin.json()).toBe(false);
  for (const t of ['quote_requests', 'collaboration_requests']) {
    const r = await api.get(`/rest/v1/${t}?select=id&limit=5`);
    // blocked (no grant) or empty (admin-only policy)
    if (r.ok()) expect((await r.json()).length, `${t} visible to ordinary`).toBe(0);
    else expect(r.status()).toBeGreaterThanOrEqual(401);
  }
  await api.dispose();
});

test('ordinary user cannot write catalog', async () => {
  const api = await ctx(users.A.token);
  const r = await api.post('/rest/v1/products', { headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, data: { name: 'hack' } });
  expect(r.status(), 'ordinary INSERT products must be blocked').toBeGreaterThanOrEqual(401);
  await api.dispose();
});

test('buyer_profiles are isolated between users', async () => {
  const svc = await pwRequest.newContext({ baseURL: URL, extraHTTPHeaders: { apikey: ANON!, Authorization: `Bearer ${SERVICE!}` } });
  await svc.post('/rest/v1/buyer_profiles', { headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, data: { user_id: users.A.uid, full_name: 'Alice' } });
  await svc.dispose();
  const b = await ctx(users.B.token);
  const r = await b.get(`/rest/v1/buyer_profiles?select=id&user_id=eq.${users.A.uid}`);
  if (r.ok()) expect((await r.json()).length, 'B must not read A profile').toBe(0);
  else expect(r.status()).toBeGreaterThanOrEqual(401);
  await b.dispose();
});

test('admin_emails row is frozen (not modifiable by admin)', async () => {
  const api = await ctx(users.admin.token);
  const r = await api.patch(`/rest/v1/site_settings?key=eq.admin_emails`, { headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, data: { value: 'attacker@evil.test' } });
  // Either blocked, or 0 rows affected (frozen).
  if (r.ok()) expect((await r.json()).length, 'admin_emails must be frozen').toBe(0);
  else expect(r.status()).toBeGreaterThanOrEqual(401);
  await api.dispose();
});

test.afterAll(async () => {
  const api = await pwRequest.newContext({ baseURL: URL });
  // best-effort cleanup of synthetic users (local only)
  for (const k of Object.keys(users) as (keyof typeof users)[]) {
    const uid = users[k].uid;
    if (uid) await api.delete(`/auth/v1/admin/users/${uid}`, { headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE!}` } }).catch(() => {});
  }
  await api.dispose();
});
