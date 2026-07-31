# Security Remediation Plan

Audit date: 2026-07-29  
Status: proposal only; no RLS, role, auth, or service-role changes were applied.

## Remediation principles

1. Establish intended access before changing policies.
2. Use one trusted administrator authority that ordinary users cannot edit.
3. Drop permissive policies by their exact actual names before adding replacements.
4. Keep timestamped migrations as the single source of truth.
5. Verify on a clean local Supabase reset with anon/User A/User B/admin identities.
6. Never use the configured remote project for development tests or destructive resets.

## Phase 0 — Decisions required

| Decision | Why it is required | Recommended default |
|---|---|---|
| Authoritative admin model | Current browser and DB email lists differ; DB list is client-writable | Trusted `app_metadata` assigned only by a server/service role, or a private membership table |
| Quote/collaboration ownership | Tables have no owner but contain private data | Treat as private admin inboxes; public submit only, no submitter read |
| Buyer access to inactive catalogue | Authenticated policies currently reveal all rows | Deny unless explicitly required |
| Public supplier fields | Active supplier SELECT exposes contact data | Public projection with business-approved fields; private contacts stay private |
| Public pricing/media/image rules | Child tables are public independent of parent status | Public only when parent product is public/active |
| Operational import identity | Some workflows may rely on broad authenticated policies | Service process with controlled service role; never ordinary buyer JWT |

Document these decisions before merging the first remediation migration.

## Immediate blockers before deployment

### P0-01 — Replace the circular administrator authority

- **Findings:** F-01.
- **Affected files:** `supabase/migrations/20260728000002_create_site_settings.sql`, `supabase/migrations/20260728000003_rls_admin_function.sql`, new timestamped remediation migration, `src/pages/admin/AdminLayout.tsx`, `src/pages/admin/AdminLogin.tsx`, `src/pages/admin/Settings.tsx`.
- **Proposed change:**
  - Do not rewrite historical migrations if they may already be applied; add one forward migration.
  - Migrate approved admin membership to trusted `app_metadata` or a private-schema table.
  - Drop both broad site-settings policies.
  - Recreate settings policies using an independent admin predicate.
  - Recreate `public.is_admin()` with `SECURITY DEFINER SET search_path = ''`, fully qualified object/function references, and minimum execute grants.
  - Remove `admin_emails` from user-editable settings.
  - Make frontend admin UI use database authorization as the source of truth. A browser allowlist may remain only as display optimization, preferably remove it to prevent drift.
- **Dependencies:** Approved admin list; a trusted provisioning/revocation process; local Supabase environment.
- **Regression risk:** High. A mistake can lock out administrators or break every admin policy. Migrate/provision the new authority before dropping the old path and retain a tested rollback migration.
- **Verification:**
  - User A cannot read/write/delete admin membership or privileged settings.
  - Signup metadata/profile role cannot change authority.
  - `is_admin()` false for User A, true for provisioned admin.
  - Admin catalogue/settings/profile operations pass; User A direct API writes fail.
  - Inspect function owner, definition, `proconfig`, and execute grants.

Suggested shape, to adapt after the admin-model decision:

```sql
-- Illustrative only; review actual policy names and role model first.
drop policy if exists "site_settings_authenticated_select" on public.site_settings;
drop policy if exists "site_settings_authenticated_all" on public.site_settings;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    false
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
```

The exact claim format and casting behavior must be validated. A private membership table may be preferable for auditability and revocation.

### P0-02 — Make request inboxes admin-only

- **Findings:** F-02 and part of F-11.
- **Affected files:** `supabase/migrations/20260525011107_create_catalog_schema.sql`, `supabase/migrations/20260525_create_collaboration_requests.sql`, new remediation migration, optionally `src/pages/QuoteRequest.tsx`, `src/pages/SampleRequest.tsx`, `src/pages/Partner.tsx`.
- **Proposed change:**
  - Drop unconditional authenticated SELECT/UPDATE/DELETE/ALL policies.
  - Retain a tightly constrained public INSERT path.
  - Create explicit admin SELECT/UPDATE/DELETE policies using the repaired independent admin authority.
  - Force initial status and protect audit/workflow fields. Prefer column privileges, a trusted RPC/Edge Function, or a trigger plus strict insert policy if direct table inserts cannot safely limit columns.
  - Add owner fields only if submitters genuinely need authenticated access; otherwise avoid inventing an ownership model for anonymous inbox data.
- **Dependencies:** P0-01; product decision on receipts/submitter access; existing-data review.
- **Regression risk:** Medium-high. Current operational staff using normal authenticated sessions will lose inbox access. Public forms can break if payload columns/constraints change.
- **Verification:** Anonymous valid submit succeeds; anon/User A cannot read it; User A cannot list/update/delete any inbox row; admin can manage; noninitial status is rejected/overridden.

### P0-03 — Remove every legacy broad authenticated policy

- **Findings:** F-03 and F-10.
- **Affected files:** `supabase/migrations/20260525022213_update_product_schema_comprehensive.sql`, `supabase/migrations/20260727000000_benchmark_improvements.sql`, `supabase/migrations/20260728000003_rls_admin_function.sql`, new remediation migration.
- **Proposed change:**
  - Query `pg_policies` in the local rebuilt schema and drop exact legacy names:
    - `"Authenticated users can manage brands"`
    - `"Authenticated users can manage suppliers"`
    - `"Authenticated users can manage pricing"`
    - `"Authenticated users can manage lots"`
    - `"Authenticated users can manage product images"`
    - review `"Authenticated users can insert media"`
  - Add explicit admin policies for INSERT/UPDATE/DELETE with `TO authenticated` and intentional `USING`/`WITH CHECK`.
  - Decide whether authenticated buyers may see inactive rows; narrow SELECT if not.
  - Tie public pricing/image/media reads to a public parent product.
- **Dependencies:** P0-01; public catalogue contract; import workflow.
- **Regression risk:** High for any hidden workflow that used buyer sessions to edit data. Service-role maintenance remains unaffected by RLS.
- **Verification:** Full operation matrix for each table; User A writes all fail; admin writes succeed; inactive parent child records are absent from anon results.

### P0-04 — Restore schema reproducibility and audit RPCs

- **Findings:** F-04.
- **Affected files:** new migrations for `search_products`, `get_quality_stats`, `get_products_with_issues`; `supabase/ALL_MIGRATIONS.sql`; new `supabase/config.toml` and test seed after approval.
- **Proposed change:**
  - Export/reconstruct each actual RPC definition into a reviewed timestamped migration.
  - Prefer `SECURITY INVOKER`; use definer rights only when necessary.
  - Fix search paths, qualify objects, validate inputs/caller, and explicitly revoke/grant execute.
  - Document or remove `ALL_MIGRATIONS.sql` as a runnable alternative. Prefer generated, non-authoritative schema snapshots if a combined file is needed.
  - Add drift detection from clean local reset.
- **Dependencies:** Approved read-only schema export or original definitions; local Supabase CLI/daemon.
- **Regression risk:** Medium-high. Function signatures must remain compatible with PostgREST/frontend calls.
- **Verification:** Clean reset creates all RPCs; catalog/admin pages work; role/grant matrix and direct RPC abuse cases pass.

## High-priority fixes

### P1-01 — Build automated RLS integration tests

- **Findings:** F-14 and verification for F-01 through F-04.
- **Affected files:** new `security-tests/` directory, `package.json`, local Supabase seed/config, CI workflow if/when present.
- **Proposed change:** Implement the matrix in `SECURITY_TEST_PLAN.md` with fake anon/User A/User B/admin identities. Add hard environment guards that reject the known remote project and non-loopback URLs by default.
- **Dependencies:** P0 schema work; test framework choice; local Supabase.
- **Regression risk:** Low to application behavior; medium operational risk if environment guards are weak.
- **Verification:** Tests fail against the current vulnerable policy set, pass after remediation, and refuse remote/production targets.

### P1-02 — Rotate and externalize the service-role credential

- **Findings:** F-08.
- **Affected files:** remove `supabase/.env.seed` after secure migration; retain safe `.env.example` documentation; update script runbooks.
- **Proposed change:** Rotate the credential in Supabase, place the replacement in an OS/CI/key-vault secret store, and inject it only into approved script processes. Restrict who can retrieve it and log use without logging the value.
- **Dependencies:** Access to project key management; owners of operational scripts.
- **Regression risk:** Scripts fail until their execution environment is updated.
- **Verification:** Old key rejected; repository/history/build/logs contain no replacement; approved scripts work with runtime injection.

### P1-03 — Make elevated scripts safe by default

- **Findings:** F-07.
- **Affected files:** `supabase/dedup.mjs`, `supabase/dedup_samesource.mjs`, `supabase/delete_masked.mjs`, all mutating `supabase/apply_*.mjs`, `supabase/seed.mjs`, `supabase/export_db.mjs`, and a new shared guard module.
- **Proposed change:**
  - Default to dry-run; require `--apply`.
  - Require exact allowed project reference/environment.
  - Require typed confirmation for delete/bulk update.
  - Add maximum affected-row thresholds and before/after counts.
  - Use unique timestamp/run-ID backup paths with restrictive permissions.
  - Separate PII exports and define encryption/retention/deletion.
  - Prefer transactional database functions for multi-step atomic changes.
- **Dependencies:** Operational requirements; secret manager; local/disposable test project.
- **Regression risk:** Medium. Automation command lines and runbooks change.
- **Verification:** Mock/local tests prove no mutation without all gates; wrong target and excessive counts abort; audit record contains no secrets/PII.

### P1-04 — Fix CSV export injection

- **Findings:** F-05.
- **Affected files:** `src/pages/admin/Buyers.tsx`, `src/pages/admin/Quotes.tsx`, new shared CSV utility/tests, `supabase/scope_report.mjs`, `supabase/price_outliers.mjs`.
- **Proposed change:** Create one encoder that stringifies, neutralizes leading formula characters (including after whitespace), doubles quotes, and wraps fields. Use it for every CSV export.
- **Dependencies:** Decide acceptable neutralization convention for Excel/LibreOffice.
- **Regression risk:** Low; a leading apostrophe may be visible in some tools.
- **Verification:** Unit tests for formulas, quotes, newlines, commas, Unicode; safe spreadsheet inspection with `=1+1`.

### P1-05 — Validate external URLs at ingestion and rendering

- **Findings:** F-06.
- **Affected files:** `src/pages/admin/Partners.tsx`, `src/pages/ProductDetail.tsx`, `src/pages/admin/Suppliers.tsx`, `src/pages/admin/Brands.tsx`, `src/pages/admin/Products.tsx`, import validators/migrations for URL fields.
- **Proposed change:** Add a shared parser that permits only approved schemes (prefer HTTPS), rejects credentials/malformed input, and returns non-clickable text for rejected data. Add trusted ingestion/database validation and clean existing values.
- **Dependencies:** Business decision about HTTP/relative URLs and approved hosts.
- **Regression risk:** Medium; legacy links may stop working.
- **Verification:** HTTPS links work; `javascript:`, `data:`, `file:`, custom schemes, credentials, whitespace/control-character tricks, and malformed URLs do not become clickable.

## Medium-priority fixes

### P2-01 — Define and enforce the public data projection

- **Findings:** F-10.
- **Affected files:** supplier/product/child-table migrations and catalogue queries/types.
- **Proposed change:** Create an allowlisted public projection/API for suppliers and other catalogue data. Exclude contact/private/audit fields. Scope price/image/media records to active/public parents using RLS predicates or reviewed security-invoker views.
- **Dependencies:** Data owner approval; frontend query updates.
- **Regression risk:** Medium-high due to generated types/joins and catalogue fields.
- **Verification:** Anon column/row snapshot tests; direct table/view queries cannot obtain private fields or draft children.

### P2-02 — Add server-side validation and abuse controls

- **Findings:** F-11.
- **Affected files:** new SQL constraint migration; quote/partner/signup forms; Supabase Dashboard.
- **Proposed change:**
  - Add documented length/format/range checks after profiling existing data.
  - Add positive numeric constraints.
  - Force initial workflow status and protect audit fields.
  - Add request/auth rate limits and CAPTCHA where appropriate.
  - Add file/row limits and schema validation for admin imports.
- **Dependencies:** Business limits; existing-data cleanup; Dashboard access.
- **Regression risk:** Medium-high if historical data is invalid. Use staged constraints.
- **Verification:** Boundary tests; normal forms/imports pass; excessive/invalid values fail cheaply; no load testing required.

### P2-03 — Sanitize production error handling

- **Findings:** F-12.
- **Affected files:** `src/pages/QuoteRequest.tsx`, `src/pages/SampleRequest.tsx`, `src/pages/SignUp.tsx`, shared error utility/monitoring integration.
- **Proposed change:** Map backend failures to stable public messages; retain sanitized error codes/correlation IDs in approved telemetry only. Remove raw payload/response logs in production.
- **Dependencies:** Monitoring/error-reporting decision.
- **Regression risk:** Low; developer diagnostics become less direct.
- **Verification:** Induced local auth/constraint failures expose no schema, SQL, token, stack, or PII in UI/console.

### P2-04 — Add and test production security headers

- **Findings:** F-09.
- **Affected files:** `netlify.toml`, optional CSP reporting endpoint/config.
- **Proposed change:**
  - Add `Content-Security-Policy` tailored to Supabase, images, styles/fonts, document generation, and Netlify.
  - Add `X-Content-Type-Options: nosniff`.
  - Add `frame-ancestors` in CSP.
  - Add strict `Referrer-Policy`.
  - Add a minimal `Permissions-Policy`.
  - Configure HTTPS redirect and HSTS only on ready HTTPS staging/production domains.
- **Dependencies:** Private staging deployment and inventory of required external origins.
- **Regression risk:** Medium; CSP can break API, images, inline styles, or downloads.
- **Verification:** Automated header assertions, full staging browser test, then CSP report-only-to-enforce rollout.

### P2-05 — Complete Auth design and Dashboard review

- **Findings:** F-15.
- **Affected files:** Auth routes/context/signup flow, optional recovery/deletion/MFA UI, Supabase Dashboard settings.
- **Proposed change:** Document confirmation mode, profile provisioning, recovery, deletion, redirect handling, session policy, and admin MFA. Make profile creation idempotent and compatible with confirmation.
- **Dependencies:** Product/legal requirements and SMTP/domain configuration.
- **Regression risk:** Medium-high for onboarding and links.
- **Verification:** Fake-account tests for signup in both modes, duplicate profile, recovery/expiry, logout/revocation, refresh, multiple tabs, allowlisted redirects, and MFA if enabled.

## Hardening improvements

### P3-01 — Upgrade development and client dependencies

- **Findings:** F-13 and dependency review.
- **Affected files:** `package.json`, `package-lock.json`.
- **Proposed change:** Upgrade Vite to at least 5.4.21 or a compatible supported release; test a current Supabase JS release in a separate change. Do not use forced audit fixes.
- **Dependencies:** Trusted registry connectivity and compatibility testing.
- **Regression risk:** Low-medium within Vite 5.4.x; higher for major versions/Supabase jumps.
- **Verification:** Live audit/outdated succeeds; lint/type/tests/build/browser smoke pass; dev server remains loopback-only.

### P3-02 — Restore clean quality gates

- **Findings:** F-14.
- **Affected files:** current TypeScript/ESLint failures, `package.json`, CI workflow when added.
- **Proposed change:** Fix three unused declarations and 25 lint errors/11 warnings without weakening rules; exclude or intentionally govern temporary `.remember` content; require gates in CI.
- **Dependencies:** Coordinate with the user's current uncommitted work.
- **Regression risk:** Low, but do not overwrite ongoing user edits.
- **Verification:** Fresh install, typecheck, lint, tests, and build all exit zero.

### P3-03 — Strengthen migration governance

- **Affected files:** `supabase/ALL_MIGRATIONS.sql`, timestamped migrations, contribution/runbook docs.
- **Proposed change:** Declare one migration source of truth; generate snapshots rather than hand-maintained combined SQL; add clean-reset/drift/policy-name checks; require security review for `USING(true)`, `WITH CHECK(true)`, `SECURITY DEFINER`, GRANT, or RLS changes.
- **Dependencies:** Local Supabase tooling/CI.
- **Regression risk:** Low to runtime; workflow changes for contributors.
- **Verification:** Clean database from zero matches expected schema and policy inventory.

### P3-04 — Improve local export/import governance

- **Affected files:** `supabase/export_db.mjs`, browser import screens, data directories/runbooks.
- **Proposed change:** Minimize PII exports, encrypt/restrict/expire them, add file/row/field schemas and size caps, use safe temporary paths, and log only aggregate counts.
- **Dependencies:** Data retention policy and operating system controls.
- **Regression risk:** Medium for existing data workflows.
- **Verification:** Oversized/malformed files reject safely; exported PII is access-controlled and automatically removed per policy.

## Post-deployment verification

Perform on private staging first:

1. Rerun the complete API role matrix with fake data.
2. Compare actual `pg_policies`, grants, functions, owners, views, triggers, and buckets to reviewed source.
3. Inspect the production bundle for secrets/source maps/unexpected endpoints.
4. Assert headers, HTTPS, HSTS readiness, caching, CSP, framing, and referrer behavior.
5. Test auth confirmation/recovery/logout/revocation/multiple tabs.
6. Run an authorized passive ZAP baseline.
7. Verify logs contain no tokens, raw errors, PII payloads, or service-role material.
8. Confirm alerting for auth anomalies, schema/policy changes, and elevated script execution.
9. Establish recurring dependency/secret/migration security checks.

## Proposed implementation order

1. Make Phase 0 decisions.
2. Add a local Supabase configuration and capture a clean baseline.
3. Implement P0-01, then P0-02/P0-03, then P0-04.
4. Add P1-01 tests and require them before merging.
5. Rotate secrets and harden scripts (P1-02/P1-03).
6. Fix CSV/URL handling.
7. Address public projections, validation, errors, headers, and Auth.
8. Restore gates and upgrade dependencies.
9. Deploy only to private staging and complete post-deployment verification.

Do not deploy or onboard real users between steps 2 and 4; the authorization boundary is not trustworthy until the corrected policy set passes cross-user tests.
