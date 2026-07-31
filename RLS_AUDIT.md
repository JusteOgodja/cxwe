# PostgreSQL and Row Level Security Audit

Audit date: 2026-07-29  
Basis: checked-in SQL migrations only. The configured remote database was not inspected, and no local Supabase database could be created from the repository.

## Important interpretation

- “Enabled” means a migration contains `ENABLE ROW LEVEL SECURITY`.
- No migration contains `FORCE ROW LEVEL SECURITY`.
- PostgreSQL permissive policies are combined with logical OR. Adding a restrictive-looking admin policy does not override an existing unconditional policy.
- A policy without `TO` applies to `PUBLIC`, which includes `anon` and `authenticated` when table grants allow the operation.
- Actual grants/default privileges were not declared in these migrations and must be inspected in a built database.
- “Confirmed” below means confirmed from migration source if all migrations are applied as represented, not confirmed against the remote project.

## Table-by-table matrix

| Table | RLS enabled / forced | SELECT policy | INSERT policy | UPDATE policy | DELETE policy | Anonymous access | Authenticated access | Ownership condition | `WITH CHECK` | Identified weakness | Test status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `public.categories` | Yes / No | Public `is_active=true`; authenticated all rows | Latest policy calls `is_admin()` | Latest policy calls `is_admin()` | Latest policy calls `is_admin()` | Active rows | All rows; writes if `is_admin()` | None; platform-owned | INSERT uses `is_admin()`; UPDATE omits explicit `WITH CHECK` and therefore reuses `USING` | Admin predicate is compromised by client-writable settings (F-01). Auth users can see inactive rows by design/possibly overbroad. | Static only; API tests not run |
| `public.products` | Yes / No | Public `is_active=true`; authenticated all rows | Latest policy calls `is_admin()` | Latest policy calls `is_admin()` | Latest policy calls `is_admin()` | Active rows | All rows; writes if `is_admin()` | None; platform-owned | INSERT uses `is_admin()`; UPDATE implicit check from `USING` | Admin predicate compromised. Public visibility checks only `is_active`, not necessarily `statut`. | Static only |
| `public.quote_requests` | Yes / No | Authenticated `USING(true)` | Public `WITH CHECK(true)` | Authenticated `USING(true) WITH CHECK(true)` | Authenticated `USING(true)` | Insert any permitted columns; no read | Full read/update/delete of every row | None; no `user_id` | Unconditional | Cross-user PII exposure and tampering; public caller can choose any allowed initial status; no admin restriction | Static confirmed; cross-user runtime not run |
| `public.brands` | Yes / No | Public active rows; legacy authenticated `FOR ALL` also grants all rows | Legacy authenticated `FOR ALL true`; later admin policy also exists | Same | Same | Active rows | Full CRUD because legacy `"Authenticated users can manage brands"` remains | None; platform-owned | Unconditional legacy check | Later migration drops nonexistent policy names, so broad legacy policy survives and ORs with admin policy | Static confirmed; runtime not run |
| `public.suppliers` | Yes / No | Public active rows; legacy authenticated `FOR ALL` also grants all rows | Legacy authenticated `FOR ALL true`; later admin policy also exists | Same | Same | Active rows including all columns | Full CRUD through legacy policy | None; platform-owned | Unconditional legacy check | Broad writes; active-row SELECT exposes contact name/email/phone unless intentionally public | Static confirmed; runtime not run |
| `public.media` | Yes / No | Public `USING(true)` | Authenticated `WITH CHECK(true)` | None | None | All rows | All rows plus arbitrary insert | None; platform-owned | Unconditional | Any buyer can add URLs/media metadata; public read is not tied to active products; no admin policy for update/delete | Static only |
| `public.product_pricing_tiers` | Yes / No | Public `USING(true)` plus authenticated `FOR ALL` | Authenticated `FOR ALL true` | Same | Same | All pricing rows | Full CRUD | Parent `product_id` FK only; no visibility/role condition | Unconditional | Any buyer can manipulate pricing; public can read tiers for inactive/draft parents | Static confirmed; runtime not run |
| `public.product_lots` | Yes / No | Authenticated `USING(true)` plus authenticated `FOR ALL` | Authenticated `FOR ALL true` | Same | Same | None in policy source | Full CRUD across inventory | Parent FK only | Unconditional | Any buyer can read/change/delete all lots; quantity lacks positive check | Static confirmed; runtime not run |
| `public.collaboration_requests` | Yes / No | Authenticated `FOR ALL true` | Public insert plus authenticated `FOR ALL`, both unconditional | Authenticated `FOR ALL true` | Same | Insert any permitted columns; no read | Full CRUD of every submission | None; no `user_id` | Unconditional | Cross-user PII exposure/tampering and public workflow-field control | Static confirmed; runtime not run |
| `public.product_images` | Yes / No | Public `USING(true)` | Authenticated `FOR ALL true` | Same | Same | All image rows | Full CRUD | Parent FK only | Unconditional | Any buyer can manipulate images; public read is not tied to active parent | Static confirmed; runtime not run |
| `public.buyer_profiles` | Yes / No | Own row by `user_id=auth.uid()` plus `is_admin()` | `user_id=auth.uid()` | None | None | No intended access | Own read/insert; admin all-row read | Direct `user_id=auth.uid()` | Own user ID | Own-row rules are sound, but F-01 lets a buyer satisfy the admin read policy. No self-update/delete is available. | Static only; User A/B not run |
| `public.site_settings` | Yes / No | Authenticated role check plus duplicate coverage from `FOR ALL` | Authenticated role check | Same | Same | None in policy source | Every authenticated user can read/write/delete every setting | None; platform-owned | `auth.role()='authenticated'` | Settings include `admin_emails`, creating direct privilege escalation; no key/value allowlist or per-key authorization | Static confirmed; runtime not run |

## Policy evidence

| Area | Migration evidence |
|---|---|
| Initial categories/products/quotes | `supabase/migrations/20260525011107_create_catalog_schema.sql:31-135` |
| Brands/suppliers/media/pricing/lots | `supabase/migrations/20260525022213_update_product_schema_comprehensive.sql:31-103` |
| Collaboration requests | `supabase/migrations/20260525_create_collaboration_requests.sql:39-49` |
| Product images | `supabase/migrations/20260727000000_benchmark_improvements.sql:61-67` |
| Buyer profiles | `supabase/migrations/20260728000001_create_buyer_profiles.sql:17-31` |
| Site settings | `supabase/migrations/20260728000002_create_site_settings.sql:9-19` |
| Admin function/policy changes | `supabase/migrations/20260728000003_rls_admin_function.sql:8-45` |

## Multi-user isolation analysis

### User-owned records

Only `buyer_profiles` has a user ownership column. Its INSERT and SELECT rules compare `user_id` with `auth.uid()`, which is the correct basic pattern. There is no self-update, self-delete, or organization membership model.

`quote_requests` and `collaboration_requests` contain private user/business data but no ownership column. Their source policies treat all authenticated users as administrators. Therefore:

- User A can source-level read User B/anonymous submissions.
- User A can source-level change status/content on User B/anonymous submissions.
- User A can source-level delete User B/anonymous submissions.
- An anonymous caller can choose any status accepted by the table check on insert.

### Platform-owned records

Catalogue, pricing, supplier, media, lot, image, and settings records are platform-owned and should not use end-user ownership. They need an independent trusted administrator predicate. The current predicate is not independent because its membership list is writable by all authenticated users.

### Owner changes and protected fields

- `buyer_profiles.user_id` is protected at insert by `WITH CHECK`, and there is no update policy.
- Quote/collaboration rows have no owner field.
- Broad policies permit arbitrary changes to product/brand/supplier/pricing/lot/image fields.
- Public quote/collaboration insert policies do not prevent client-supplied workflow `status`.
- `created_at` and other audit-like values are generally client-writable where an insert policy is unconditional unless column grants or triggers exist out of band.

### Cross-user dynamic conclusion

Cross-user isolation was **not dynamically tested**. There were no local identities or local database. The source-level policy analysis predicts failure for request inboxes and multiple platform tables; it must be confirmed after migrations are corrected and a clean local schema is built.

## Administrator trust model

### Current model

1. Frontend route guard parses `VITE_ADMIN_EMAILS`.
2. Database `public.is_admin()` reads the current JWT email.
3. It searches `public.site_settings` for the `admin_emails` value.
4. All authenticated sessions can update that setting.

The browser list is public and non-authoritative. The database list is authoritative but untrusted because it is user-editable. Email matching also requires operational controls for email changes, normalization, duplicate identities, and account recovery.

### Recommended model

Use one server-controlled authority:

- Preferred: a trusted role claim in `auth.users.raw_app_meta_data` set only by a server/service role, with a minimal function that reads `auth.jwt()->'app_metadata'`.
- Alternative: a private-schema admin-membership table writable only by a tightly controlled migration/operational role. If a definer function reads it, use a fixed empty `search_path`, schema-qualified objects, minimal owner privileges, and explicit grants.

Do not let the authority depend on a table writable under the authority being decided.

## Function and RPC audit

| Function | Definition available | Security mode | Data/operation | Owner | Execute grants | Search path | Input/caller validation | RLS/bypass status | Finding/test status |
|---|---|---|---|---|---|---|---|---|---|
| `public.is_admin()` | Yes, no args, returns boolean | `SECURITY DEFINER`, SQL, stable | Reads admin email setting and JWT email | Not declared; likely migration executor | Not declared; PostgreSQL default function execute may include PUBLIC | Not set | JWT email comparison only; authority source is client-writable | Definer can read settings irrespective of caller RLS depending owner; intended for policies | F-01; static only |
| `public.search_products(...)` | No | Unknown | Product search | Unknown | Unknown | Unknown | Unknown | Unknown | F-04; must introspect and migrate |
| `public.get_quality_stats(...)` | No | Unknown | Product quality aggregate | Unknown | Unknown | Unknown | Unknown | Unknown | F-04; must introspect and migrate |
| `public.get_products_with_issues(...)` | No | Unknown | Product issue list | Unknown | Unknown | Unknown | Unknown | Unknown | F-04; must introspect and migrate |

No unsafe dynamic SQL was found in the one available function, but its unqualified `site_settings` reference and inherited `search_path` are unsafe for a definer function.

### Actual-schema queries required

Run only on local/disposable infrastructure or as approved read-only inspection:

```sql
select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result,
  r.rolname as owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname in ('public', 'storage')
order by 1, 2, 3;
```

## Views and materialized views

No `CREATE VIEW` or `CREATE MATERIALIZED VIEW` statement was found in the reviewed migration set. Actual database views are unverified. If public projections are introduced (for example, a safe supplier projection), prefer supported security-invoker behavior and explicitly review grants/underlying RLS.

## Triggers

No `CREATE TRIGGER` or trigger-function definition was found in the reviewed migrations. Consequently:

- Profile creation is browser-driven rather than trigger-driven.
- No trigger forces public request status or audit fields.
- Actual out-of-band triggers remain unverified.

## Grants and schema privileges

No explicit `GRANT` or `REVOKE` statements governing these API objects were found in the authoritative timestamped migrations. Supabase default privileges may make tables/functions available to PostgREST, but actual grants cannot be inferred safely.

Required inventory:

```sql
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_schema, table_name, grantee, privilege_type;

select grantee, routine_schema, routine_name, privilege_type
from information_schema.routine_privileges
where routine_schema in ('public', 'storage')
order by routine_schema, routine_name, grantee;
```

Review schema usage, sequences, default privileges, and function execute separately.

## Database constraint review

### Present

- Primary keys and several unique constraints.
- Foreign keys from products/child tables and buyer profiles.
- Status checks on quote/collaboration records.
- Enum-like checks for media type, temperature, product status, and Nutri-Score.
- Rating range check.

### Missing or weak

- Positive checks for pricing `min_quantity`, `price`, lot `quantity`, product minimum order/pack counts, weights, and similar business numerics.
- Length/format checks for public email, phone, URL, company, product, message, and country fields.
- A server-enforced initial status for public submissions.
- Per-key validation for `site_settings`.
- Immutability/default enforcement for audit timestamps and protected fields.
- Parent visibility predicates for public child records.

Constraints should be added only after profiling existing data. Use staged cleanup and `NOT VALID`/validation where appropriate to avoid a breaking deployment.

## Storage RLS

No Storage calls, buckets, or policies were found. This means Storage is absent from repository scope, not that an out-of-band bucket is secure.

If Storage exists in the actual project, inventory:

- `storage.buckets.public`.
- All `storage.objects` SELECT/INSERT/UPDATE/DELETE policies.
- Path ownership (`auth.uid()`-based prefix), MIME/size restrictions, overwrite behavior, and signed URL expiry.
- SVG/HTML/active content handling.
- Anon/User A/User B cross-object access.

## Migration reproducibility and drift

`supabase/ALL_MIGRATIONS.sql` duplicates early schema/policies and retains permissive policies, while it omits later buyer/settings/admin state. It should not coexist as an ambiguous runnable source without a documented purpose. Use timestamped migrations as the single authoritative history, generate schema snapshots from a clean reset, and fail CI if drift or missing RPC definitions are detected.

## RLS remediation acceptance criteria

- Ordinary User A cannot modify admin membership/settings.
- User A cannot read/update/delete User B or anonymous inbox records.
- Ordinary users cannot mutate any platform-owned table.
- Public reads expose only documented active fields and child records.
- Every UPDATE policy has intentional `USING` and `WITH CHECK` behavior.
- Every INSERT policy prevents protected-field spoofing.
- All called RPCs are migration-defined, least-privileged, and role-tested.
- Actual grants match policy intent.
- A repeatable test suite passes for anon, User A, User B, and admin on a clean local reset.
