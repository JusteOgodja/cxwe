# Security Test Plan

Audit date: 2026-07-29  
Safety rule: run active database tests only against a local Supabase instance or an explicitly approved disposable project. The repository currently points to a remote project; that project was not tested.

## 1. Test status summary

| Area | Status | Result |
|---|---|---|
| Repository/architecture review | Completed | React/Vite browser client; Supabase Auth/PostgREST; RLS is authorization boundary |
| Static secret scan | Completed with tooling limitation | Ignored local service-role credential found; none in bundle or Git history |
| Git history secret review | Completed with custom redacted searches | No exact service-role token or generic JWT-like value found |
| Lockfile/supply-chain metadata | Completed | Registry URLs and integrity present; no Git dependencies |
| Clean install | Partially completed | `npm ci` hit Windows `EPERM` on locked `esbuild`; `npm install` restored dependencies without manifest/lock changes |
| Dependency advisory audit | Partial | Offline npm audit: 0; live audit/outdated failed TLS; manual Vite advisory review completed |
| Type check | Completed, failed | 3 unused-declaration errors |
| ESLint | Completed, failed | 25 errors and 11 warnings |
| Unit/integration tests | Not available | No test script/framework |
| Production build | Completed, passed | Vite build succeeded; large-chunk warning |
| Production bundle inspection | Completed | No source maps or `service_role` marker |
| Isolated localhost UI smoke test | Completed | Public UI rendered; route guards redirected correctly; no submission/auth performed |
| Local Supabase schema reset | Not completed | No `supabase/config.toml`, CLI, daemon-backed stack, or PostgreSQL |
| Anon/User A/User B/admin API matrix | Not completed | No safe local/disposable database or identities |
| Actual RPC/grant introspection | Not completed | Remote project out of scope; definitions absent locally |
| Storage tests | Not applicable from source | No Storage use/policies found |
| ZAP baseline | Not completed | ZAP unavailable; no representative staging origin |
| Private staging headers/auth | Not completed | No deployment |

## 2. Commands and checks completed

The following categories were actually executed. Exact console output should be retained in the audit work log if formal evidence retention is required.

```powershell
# Discovery and source review
rg --files
rg ... src supabase
git status --short
git log ...
git ls-files
git check-ignore -v ...

# Dependencies and quality
npm.cmd install
npm.cmd ls --depth=0
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd audit --offline --json
npm.cmd audit --json       # failed trusted TLS verification
npm.cmd outdated           # failed trusted TLS verification/cache lookup

# Build review
Get-ChildItem dist -Recurse
rg ... dist
```

Other completed checks:

- Inspected package-lock package sources, integrity metadata, and install scripts.
- Checked for Gitleaks, TruffleHog, Supabase CLI, PostgreSQL, Playwright, and ZAP; none was available.
- Checked Docker availability; the daemon was not running.
- Reviewed primary Vite advisories relevant to installed version 5.4.8.
- Served a temporary sanitized copy of the production build on `127.0.0.1:4174`. The copy's Supabase URL was mechanically replaced with `http://127.0.0.1:54321` before browsing.
- Observed `/admin` redirect to `/admin/login` and a protected product route redirect to `/login`.
- Inspected the public partner form without submitting it; fields lacked maximum lengths.
- Closed the browser session, stopped the temporary server, and removed all temporary assets.

## 3. Actual dynamic results

| Test | Expected | Actual |
|---|---|---|
| Anonymous direct `/admin` navigation | Redirect to admin login | Passed in isolated UI |
| Anonymous direct protected product navigation | Redirect to buyer login | Passed in isolated UI |
| Home render without backend | UI shell renders; backend values fail closed/placeholder | Rendered; no browser error/warning logs observed |
| Dangerous schemes in currently rendered home anchors | None | None observed |
| Public form HTML bounds | Documented max lengths/patterns | Required/type constraints present for some fields; no `maxlength` observed |
| Remote request prohibition | No remote Supabase access | Sanitized build targeted loopback; no data submission/authentication occurred |

These are UI-routing/markup results only. They do not establish API authorization.

## 4. Tests not completed and why

### Cross-user authorization

Not completed. The repository lacks a local Supabase configuration and required local binaries/services. The only configured Supabase URL is remote, and authorization to test a disposable remote project was not provided.

**Conclusion:** cross-user isolation was not actually tested and did not pass. Static migration analysis predicts failures in `quote_requests`, `collaboration_requests`, and platform administration.

### RPC behavior

Not completed. The frontend calls three functions not defined in migrations. Their signatures/permissions are unavailable locally.

### Auth dashboard behavior

Not completed. Dashboard settings are external state and the remote project was not inspected.

### Deployment/HTTP scanning

Not completed. There is no private staging deployment, and Vite/custom localhost headers are not representative of Netlify production delivery.

### Storage

No source use was found. If buckets exist out of band, they require a separate actual-project inventory and test.

## 5. Required test identities and data

Use only fake data:

- **Anon:** no access token; public anon key only.
- **User A:** ordinary confirmed buyer, e.g. `security-a@example.invalid`.
- **User B:** separate ordinary confirmed buyer, e.g. `security-b@example.invalid`.
- **Admin:** explicitly provisioned through the new trusted admin mechanism, e.g. `security-admin@example.invalid`.

Seed:

- One buyer profile per authenticated identity.
- One record owned by each user for every future user-owned table.
- One anonymous quote and collaboration request.
- One User A and one User B submission if ownership is added.
- Active, inactive, and draft products with child price/image rows.
- One supplier with public fields and separate private contact values.
- One harmless `=1+1` CSV test value.
- HTTPS and rejected-scheme URL samples.

Never reuse real email addresses, production tokens, service-role keys, or personal/customer data.

## 6. Safe local setup prerequisites

The repository first needs:

1. Supabase CLI installed through an approved project-local workflow.
2. Docker Desktop/compatible daemon running.
3. `supabase/config.toml` generated and reviewed.
4. Timestamped migrations as the only authoritative schema source.
5. Missing RPC definitions added to migrations.
6. A test-only seed file with fake data.
7. Environment guards that reject the known remote project reference.

Recommended workflow after those prerequisites:

```powershell
# Confirm this is a local project before any reset.
supabase status

# Local only. Never add --linked and never use db reset against the remote URL.
supabase start
supabase db reset

# Start frontend with test-only local values.
$env:VITE_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:VITE_SUPABASE_ANON_KEY = '<LOCAL_ANON_KEY>'
npm.cmd run dev
```

Safety gates for an automated suite:

- Parse `VITE_SUPABASE_URL` and require hostname `127.0.0.1` or `localhost` by default.
- Allow a disposable remote reference only through an explicit test allowlist and CI secret.
- Refuse the known repository remote project reference.
- Refuse to run when `NODE_ENV=production`.
- Never log access/refresh/service-role tokens.
- Create test rows with a run ID and remove only those exact rows; prefer transaction rollback where supported.
- Do not issue destructive schema commands to linked projects.

## 7. Authorization test matrix

Legend:

- **Allow** means the operation is intentionally permitted.
- **Deny** means PostgREST should return an authorization error or zero rows affected/returned according to API semantics.
- Verify both response and postcondition.

### 7.1 Public/platform tables

| Resource | Anon | User A | Admin | Expected invariant |
|---|---|---|---|---|
| Active categories/products/brands | SELECT allow | SELECT allow | SELECT allow | Only documented active/public rows |
| Inactive/draft catalog rows | SELECT deny | Deny unless product design explicitly allows buyers | Allow | Direct UUID/filter does not bypass status |
| Categories/products/brands/suppliers | INSERT/UPDATE/DELETE deny | Deny | Allow | No normal user platform mutation |
| Pricing/images for active product | SELECT allow if intended | Allow | Allow | Only public parent children |
| Pricing/images for draft/inactive product | SELECT deny | Deny unless intended | Allow | Child policies enforce parent visibility |
| Lots | All deny | All deny | Intended CRUD allow | Inventory is not buyer-readable |
| Media | Only documented public read | No arbitrary insert | Admin CRUD as designed | URLs validated and parent visibility enforced |
| Site settings | Deny | Deny | Allow only approved keys/actions | Admin source cannot be changed by User A |

For every resource test:

- Unfiltered list.
- Filter by exact User B/admin-created UUID.
- `.single()`/`.maybeSingle()` equivalent.
- Insert with client-supplied UUID/timestamps/protected status.
- Update by UUID and by broad filter.
- Delete by UUID and broad filter.
- Upsert with existing/new keys.

### 7.2 Buyer profiles

| Test | Identity | Expected |
|---|---|---|
| Insert profile with own `user_id` | User A | Allow once |
| Insert profile with User B `user_id` | User A | Deny |
| Read own profile | User A | Allow |
| Read User B profile by UUID/user ID | User A | Deny/zero rows |
| Read all profiles | User A | Only own row |
| Change `user_id` to User B | User A | Deny (and no update policy unless designed) |
| Delete User B profile | User A | Deny |
| Read all profiles | Admin | Allow if business-approved |
| Read any profile | Anon | Deny |

### 7.3 Quote and collaboration requests

If these remain anonymous administrative inboxes:

| Test | Identity | Expected |
|---|---|---|
| Insert valid fake request | Anon/User A | Allow |
| Insert noninitial `status` | Anon/User A | Deny or force initial value |
| Read inserted request | Anon/User A | Deny unless a secure receipt mechanism exists |
| Enumerate all requests | User A | Deny |
| Read/update/delete by User B/anonymous UUID | User A | Deny |
| Manage inbox | Admin | Allow |
| Oversized/invalid fields | Any submitter | Reject without resource-intensive behavior |

If user-owned access is introduced, repeat with `user_id`:

- User A can CRUD only User A records.
- User A cannot insert/modify `user_id` as User B.
- Admin policy remains separate.
- Anonymous rows cannot be claimed by arbitrary users.

### 7.4 Administrator escalation

| Test | Identity | Expected |
|---|---|---|
| Read/write/delete admin membership source | User A | Deny |
| Change JWT user metadata supplied during signup to claim admin | User A | No authority change |
| Modify buyer profile `role` to admin-like value | User A | No authority change |
| Call `is_admin()` | User A | False |
| Call `is_admin()` | Admin | True |
| Use browser-visible `VITE_ADMIN_EMAILS` value | User A not provisioned in DB | No database authority |
| Change email case/spacing/identity | All | Documented deterministic behavior |

### 7.5 Protected fields

Attempt direct changes to:

- `user_id`, future `owner_id`, and organization/tenant IDs.
- `role`, admin membership, and settings authorization keys.
- Request `status`, approval/responded fields.
- Product price, currency, minimum quantity, stock/lot values.
- `created_at`, updated/created-by fields.
- Active/draft/published flags.

Every result must verify both returned rows and a fresh read by an authorized identity.

## 8. RPC test plan

For `search_products`, `get_quality_stats`, `get_products_with_issues`, and `is_admin()`:

1. Capture exact signature, owner, definition, `prosecdef`, `proconfig`, grants, and volatility.
2. Test call as anon, User A, User B, and admin.
3. Test empty, null, overlong, wildcard, Unicode, boundary numeric, and extra identifier inputs.
4. For identifier inputs, pass User B/draft/inactive row IDs as User A.
5. Verify result columns do not expose private supplier/contact/admin/audit data.
6. Verify functions cannot write unless explicitly designed to.
7. Verify definer functions have an empty/fixed `search_path`, qualified objects, caller checks, and minimum owner privileges.
8. Revoke PUBLIC execution unless intentionally public.

Expected:

- Public search returns only active/public products.
- Quality/admin functions deny anon/User A or return only explicitly safe aggregates.
- `is_admin()` cannot be influenced through user-editable data.

## 9. Frontend security tests to automate

### Unit tests

- CSV encoder neutralizes optional whitespace plus `=`, `+`, `-`, `@`; escapes quotes/newlines/Unicode.
- URL helper permits expected HTTPS URLs and rejects `javascript:`, `data:`, `file:`, `vbscript:`, credentials, malformed input, and unexpected schemes.
- Public error mapper removes SQL/table/constraint/token/PII detail.
- Import validators reject excessive files/rows and unsafe field types.

### Browser tests

- Anonymous direct admin/buyer routes redirect.
- Authenticated buyer direct admin route redirects and API calls still fail.
- Admin route loads only for a database-authorized admin.
- Logout clears sensitive React state and cached queries; back navigation does not reveal prior private data.
- Session refresh and multiple tabs converge correctly.
- Signup behavior works with email confirmation both enabled and disabled.
- Recovery links accept only allowlisted redirects and expire correctly.
- Harmless stored strings resembling HTML render as text.
- Rejected URL schemes are not clickable.
- No tokens, PII, or raw backend errors appear in production console.

## 10. Manual Supabase Dashboard checklist

Record screenshots/settings without exposing values:

### Auth

- [ ] Site URL is the intended private staging/production origin.
- [ ] Additional redirect URLs are exact allowlisted origins/paths; no broad wildcard.
- [ ] Email confirmation setting is documented and tested.
- [ ] Password minimum and complexity policy meet risk requirements.
- [ ] Leaked/common-password protection is enabled where supported.
- [ ] Signup, login, recovery, and OTP rate limits are reviewed.
- [ ] CAPTCHA/Turnstile is enabled for public auth/forms where appropriate.
- [ ] MFA policy is decided for administrators.
- [ ] Access/refresh token lifetimes and refresh reuse protection are reviewed.
- [ ] SMTP sender/domain and email templates do not contain unsafe redirect construction.
- [ ] OAuth providers/callbacks are disabled unless configured and tested.
- [ ] Anonymous auth is disabled unless explicitly required.
- [ ] Account deletion/disable and incident session revocation procedures exist.
- [ ] Auth audit logs and alerts are retained/reviewed.

### Database/API

- [ ] Exposed schemas are minimal.
- [ ] Actual table, sequence, schema, and function grants match `RLS_AUDIT.md`.
- [ ] Every exposed table has RLS enabled.
- [ ] Actual policy definitions match reviewed migrations.
- [ ] No out-of-band functions/views/triggers exist without source migrations.
- [ ] Function owners are minimally privileged and PUBLIC execute is reviewed.
- [ ] PostgREST row limits and statement timeouts are appropriate.

### Storage

- [ ] Inventory all buckets and public flags.
- [ ] Test object path ownership for User A/User B.
- [ ] Restrict MIME types, size, active content, overwrite, and signed URL lifetime.

### Secrets/operations

- [ ] Rotate the exposed-in-workspace service-role key.
- [ ] Review API key inventory and remove unused legacy keys.
- [ ] Enable appropriate project audit/log retention and alerts.
- [ ] Document backup/restore and service-role access owners.

## 11. Private staging checks

- Run all API authorization cases against private staging test data.
- Confirm the build contains only the anon key/project URL, no service-role or internal secrets.
- Assert security headers on HTML and static assets.
- Verify CSP first in report-only mode, then enforcement.
- Verify HTTPS redirect, HSTS after readiness, TLS configuration, and canonical host.
- Verify CORS behavior at Supabase/API origin; reject unapproved browser origins where configurable.
- Confirm no `.env`, source maps, backups, raw datasets, migration files, or configuration files are served.
- Confirm SPA fallback does not turn missing sensitive-looking paths into cacheable HTML with misleading MIME types.
- Run OWASP ZAP baseline/passive scan only against the authorized staging URL.
- Review browser Network/Console for response overfetching, PII, errors, caching, and tokens.
- Test logout/back navigation and cache behavior on a shared-browser scenario.

## 12. Acceptance criteria before production consideration

- All High findings fixed and verified in a clean local reset.
- Every RLS matrix cross-user/protected-field case passes.
- Missing RPCs are migration-defined and role-tested.
- Service-role key rotated and operational scripts guarded.
- Lint, typecheck, unit, integration, browser, and build commands pass.
- Live dependency audit rerun successfully with findings triaged for reachability.
- Private staging header/auth/browser checks pass.
- Residual public data exposure is documented and approved by the data owner.
