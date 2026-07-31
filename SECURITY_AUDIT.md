# Application Security Audit

Audit date: 2026-07-29  
Repository: `cxwe`  
Overall assessment: **Not ready for deployment**

## 1. Executive summary

The application is a React/Vite single-page application that connects directly from the browser to Supabase Auth and PostgREST. PostgreSQL Row Level Security (RLS) is therefore the primary authorization boundary; protected React routes and hidden admin controls are usability features, not security controls.

Three high-confidence source-level authorization flaws are deployment blockers:

1. Every authenticated user can write `site_settings`, including the email list used by the `SECURITY DEFINER` function `is_admin()`. A normal buyer can therefore make themselves an administrator.
2. Every authenticated user can read, update, and delete every quote and collaboration request, exposing PII and commercial data.
3. Legacy permissive policies leave brands, suppliers, prices, lots, and product images writable by any authenticated user. Later admin policies do not narrow them because PostgreSQL permissive policies are OR-combined.

The configured `.env` targets a remote Supabase project. No remote requests or mutations were made. The repository has no `supabase/config.toml`, no running local Supabase stack, and no disposable test identities. As a result, cross-user isolation was **not dynamically tested**. The RLS conclusions above are confirmed from the migration source if it represents the applied schema, but actual database drift remains possible in either direction.

A production build succeeded and contained no service-role marker or source maps. A service-role credential was found only in an ignored, untracked local file used by maintenance scripts; it was not found in Git history or the frontend bundle. The live npm advisory service was unavailable because TLS verification failed, so the dependency audit is partially constrained. Manual primary-source review confirmed Vite 5.4.8 development-server advisories, but current scripts keep the dev server on loopback and the affected tooling is not shipped as production runtime code.

No broad fixes were applied. The five audit deliverables are reports and plans only.

## 2. Scope

Reviewed:

- React/TypeScript source, routes, auth context, forms, and admin UI.
- Supabase client initialization and all identifiable frontend table/RPC operations.
- SQL migrations, RLS policies, function definitions, and schema constraints.
- Local `.env` variants, `.gitignore`, build output, tracked Git history, scripts, and documentation.
- JavaScript/SQL import, export, diagnostic, deduplication, and maintenance scripts.
- npm dependency metadata, lockfile integrity, install/build/type/lint checks.
- Netlify deployment configuration and production bundle.
- Isolated localhost UI routing and form inspection using a copied build whose Supabase URL was replaced with loopback.

Explicitly out of scope/not exercised:

- The configured remote Supabase project.
- Public websites, third-party infrastructure, or production systems.
- Destructive SQL, active scanning, brute force, load/denial-of-service testing.
- A disposable Supabase project, because none was explicitly approved/provided.
- Supabase Dashboard settings and actual remote database policy/grant state.

## 3. Limitations

- No `supabase/config.toml`, Supabase CLI, PostgreSQL client/server, local migrations, or local test users were available.
- Docker CLI was present but the Docker daemon was not running; this did not provide a safe local Supabase substitute.
- No Playwright project, unit-test framework, OWASP ZAP, Gitleaks, or TruffleHog was installed. Secret review used redacted repository/Git searches.
- Live `npm audit` and `npm outdated` could not establish a trusted TLS connection. Offline audit data may be stale or incomplete.
- RPC definitions called by the UI are missing from migrations, so function owners/grants/security mode could not be examined.
- No deployment exists, so HTTPS, HSTS, CDN behavior, CORS, cache behavior, and actual response headers require private staging verification.
- The worktree contained user changes and large untracked data/script sets. They were inspected where relevant but not modified.

## 4. Architecture summary

| Area | Detected design | Security significance |
|---|---|---|
| Browser application | React 18.3.1, TypeScript 5.6.3, Vite 5.4.8 | All `VITE_` values and client code are public. |
| Routing | React Router 6.30.3; public, buyer-protected, and admin routes | Route guards do not constrain direct PostgREST calls. |
| Backend API | Browser directly uses `@supabase/supabase-js` 2.57.4 | Public project URL/anon key are expected; RLS must enforce every operation. |
| Authentication | Email/password sign-up/sign-in/sign-out; session load and auth-state listeners | Dashboard controls and lifecycle flows are not fully represented in code. |
| Buyer authorization | `buyer_profiles.user_id = auth.uid()` for own insert/select | This is the only clear user-row ownership policy. |
| Admin authorization | Frontend `VITE_ADMIN_EMAILS`; database `is_admin()` checks JWT email against `site_settings.admin_emails` | Two separate allowlists can drift; database authority is circularly client-writable. |
| Public catalogue | Public active categories/products/brands/suppliers plus unconditional child-table reads | Public contract is broad and can expose contact/unpublished data. |
| Public submissions | Anonymous quote and collaboration inserts | No owner identity; inbox management must be admin-only. |
| Database logic | Timestamped migrations; one `SECURITY DEFINER` function | Three frontend RPC definitions are absent; no views/triggers found. |
| Storage/Edge Functions | No use found | No buckets/policies/functions to assess in repository. |
| Admin scripts | Node `.mjs` scripts use service role for imports/maintenance/exports | They bypass RLS and several default to live changes. |
| Deployment | Netlify build/cache/SPA routing | Security headers are not configured. |

### Entry points and trust boundaries

```text
Untrusted browser input
   ├─ React forms and route parameters
   ├─ Supabase Auth
   └─ PostgREST/RPC using anon key + optional user JWT
                   │
                   ▼
          PostgreSQL grants + RLS
          (actual authorization boundary)

Developer/imported CSV/JSON/SQL
                   │
                   ▼
      service-role maintenance scripts
          (RLS bypass; privileged path)
```

Sensitive operations include catalogue/pricing/supplier mutation, quote/partner inbox access, buyer profile access, settings/admin membership changes, data exports, and service-role maintenance.

### Database ownership model

- `buyer_profiles` has `user_id` and own-row insert/select policies.
- `quote_requests` and `collaboration_requests` have no owner column and should be treated as private administrative inboxes unless the product design changes.
- Catalogue tables are platform-owned, not user-owned; writes should be administrator/service-only.
- `site_settings` is platform-owned configuration and must not be writable by normal buyers.

## 5. Threat model

### Assets

- Buyer profile PII: names, organizations, countries, phones, sectors, messages.
- Quote and collaboration PII/commercial data: contacts, emails, phones, requirements, markets, messages.
- Product, pricing, supplier, lots, draft status, and quality data.
- Admin membership and platform settings.
- Supabase sessions and the service-role credential.
- Local exports/backups and imported datasets.

### Actors and major threats

| Actor/threat | Entry point and required access | Possible impact | Existing protection | Still needs verification |
|---|---|---|---|---|
| Unauthenticated visitor | Anon key; public PostgREST/forms | Catalogue enumeration, spam, oversized/malformed submissions | RLS enabled; public rows/inserts intended | Rate limits, CAPTCHA, column grants, bounds, public data contract |
| Normal authenticated buyer | Valid account/JWT | Direct API calls beyond UI | `buyer_profiles` own-row policies | High findings show other tables are over-permissive |
| Malicious buyer | Devtools/crafted PostgREST requests | Self-admin, PII reads, record tampering/deletion | Frontend admin route allowlist only | Must be denied by corrected RLS and cross-user tests |
| Cross-user attacker | Changes UUID/filter/body fields | Reads or changes another user's data | `auth.uid()` on buyer profile insert/select | No dynamic User A/User B test was possible |
| Public anon key discoverer | Reads bundle/config | Uses documented Supabase REST interface | Anon key is not a secret; RLS should limit it | Actual grants/RLS/runtime schema |
| XSS/link attacker | Public form/imported URLs/data | Session actions, phishing, admin workstation impact | React JSX escaping; no unsafe HTML sinks found | URL scheme validation and CSP |
| Developer secret leak | Local files/scripts/backups | Service-role RLS bypass | `.env.*` ignored; no bundle/history hit | Rotation and external secret injection |
| Malicious import data | CSV/JSON/SQL generation/admin imports | Bad links, formulas, integrity loss, resource use | Some field allowlisting and SQL quote escaping | File/row limits, schema validation, URL/formula safety |
| Compromised dependency | npm install/build/dev server | Build/dev compromise or shipped code issue | Lockfile with registry URLs/integrities | Live advisory scan and scheduled updates |

### Key authorization assumptions

- `auth.uid()` is trustworthy only when supplied by Supabase Auth inside PostgreSQL policy/function evaluation.
- Email/profile/organization/status values supplied by the client are not authority.
- UUID unpredictability is not authorization.
- `VITE_ADMIN_EMAILS` cannot enforce authorization.
- `service_role` bypasses RLS and must never enter browser code.

## 6. Overall risk rating

**High / Not ready for deployment.**

The rating is driven by authenticated privilege escalation and broad cross-user/administrative access in RLS source. Exploitation requires only a normal account, which appears self-service. The application has not yet been publicly deployed, reducing current exposure and making predeployment remediation practical.

## 7. Findings ordered by severity

| ID | Severity | Finding | Deployment impact |
|---|---|---|---|
| F-01 | High | Authenticated users can edit the admin authority source and self-promote | Blocker |
| F-02 | High | Authenticated users can read/update/delete all quote and collaboration records | Blocker |
| F-03 | High | Legacy permissive policies leave platform data broadly writable | Blocker |
| F-04 | Medium | Called RPC definitions and permissions are absent from source | Blocker until inventoried |
| F-05 | Medium | CSV exports permit formula injection | Fix before admin exports are used |
| F-06 | Medium | Dynamic external URL schemes are not allowlisted | Fix before processing untrusted submissions/imports |
| F-07 | Medium | Elevated scripts default to live mutation without strong target guards | Fix before operational use |
| F-08 | Medium | Service-role key stored in ignored local workspace file | Rotate/move before deployment |
| F-09 | Medium | Baseline production security headers missing | Configure/test in private staging |
| F-10 | Medium | Public supplier/child-table exposure may exceed intended contract | Confirm and narrow |
| F-11 | Low | Missing server-side limits/positive constraints | Integrity/abuse hardening |
| F-12 | Low | Raw backend error detail exposed | Information-disclosure hardening |
| F-13 | Low | Vite dev-server advisories | Upgrade dev tooling |
| F-14 | Low | No security tests; lint/type gates fail | Assurance gap |
| F-15 | Info | Auth dashboard/lifecycle not verifiable | Manual checklist |

Complete evidence, safe reproductions, CWE/OWASP mappings, regression risks, and verification steps are in `SECURITY_FINDINGS.md`.

## 8. RLS coverage matrix

All discovered public-schema tables enable RLS in migrations, but none uses `FORCE ROW LEVEL SECURITY`. This table is a concise view; `RLS_AUDIT.md` contains the detailed per-operation matrix.

| Table | Intended access | Source-level result | Status |
|---|---|---|---|
| `categories` | Public active read; admin write | Writes use `is_admin()`, but F-01 compromises admin authority | Unsafe |
| `products` | Public active read; admin write | Same as categories | Unsafe |
| `quote_requests` | Public submit; admin inbox | Every authenticated user has full row access | Unsafe |
| `collaboration_requests` | Public submit; admin inbox | Every authenticated user has `FOR ALL` | Unsafe |
| `brands` | Public active read; admin write | Legacy authenticated `FOR ALL` remains | Unsafe |
| `suppliers` | Public approved data; admin write | Legacy authenticated `FOR ALL`; active rows include contact columns | Unsafe/contract unclear |
| `media` | Public assets; admin write | Public all-row SELECT; any authenticated insert | Unsafe/overbroad |
| `product_pricing_tiers` | Public price for public products; admin write | Public all-row SELECT; authenticated `FOR ALL` | Unsafe |
| `product_lots` | Private/admin inventory | Every authenticated user has `FOR ALL` | Unsafe |
| `product_images` | Public images for public products; admin write | Public all-row SELECT; authenticated `FOR ALL` | Unsafe |
| `buyer_profiles` | Own profile; admin read | Own insert/select is correct; admin read inherits F-01 | Partially sound, transitively unsafe |
| `site_settings` | Admin configuration | Every authenticated user has `FOR ALL` | Unsafe |

Migration source also contains `supabase/ALL_MIGRATIONS.sql`, which retains older broad policies and is not synchronized with the latest buyer/settings/admin migrations. Treating both it and timestamped migrations as runnable sources creates schema drift risk.

## 9. Supabase operation matrix

The matrix groups repeated queries; representative source locations are shown.

| Operation | Source | Resource | Expected role/ownership | Database control found | Status |
|---|---|---|---|---|---|
| Auth session load/listener | `src/App.tsx:62-67`, `src/contexts/AuthContext.tsx:47-57` | Supabase Auth | Current session | Supabase client | Appropriate; dashboard settings unverified |
| Sign up + profile insert | `src/pages/SignUp.tsx:83-100` | Auth, `buyer_profiles` | User inserts `user_id = auth.uid()` | Own-row `WITH CHECK` | Policy sound; confirmation-mode flow may fail |
| Own profile read | `src/contexts/AuthContext.tsx:39-43` | `buyer_profiles` | Own row | `user_id = auth.uid()` | Sound in source |
| Public catalogue reads | Home/Catalog/Category/Brand/ProductDetail | categories/products/brands/suppliers | Anon active data | Active-row policies | Generally intended; supplier/data projection needs review |
| Public child reads | `src/pages/ProductDetail.tsx:111-119` | pricing/images | Public only for public parent | Unconditional public SELECT | Overbroad |
| Anonymous quote insert | `src/pages/QuoteRequest.tsx:265,303`, `SampleRequest.tsx:67` | `quote_requests` | Submit only, forced initial state | `WITH CHECK (true)` | Overbroad fields/limits |
| Anonymous partner insert | `src/pages/Partner.tsx:148` | `collaboration_requests` | Submit only, forced initial state | `WITH CHECK (true)` | Overbroad fields/limits |
| Admin quote/partner read/update/delete | Admin Quotes/Partners | request tables | Admin only | All authenticated | Broken |
| Admin category/product CRUD | Admin Categories/Products/DataQuality | categories/products | Admin only | `is_admin()` | Broken transitively through F-01 |
| Admin brand/supplier CRUD | Admin Brands/Suppliers | brands/suppliers | Admin only | Legacy authenticated `FOR ALL` | Broken |
| Admin pricing replace | `src/pages/admin/Products.tsx:288,352-355` | pricing tiers | Admin only | Authenticated `FOR ALL` | Broken |
| Admin buyer read/export | Buyers/Dashboard/Analytics | `buyer_profiles` | Admin only | `is_admin()` read | Broken transitively through F-01 |
| Settings read/upsert | `src/pages/admin/Settings.tsx:82-104` | `site_settings` | Admin only | All authenticated | Broken and enables self-admin |
| Search/quality RPC | Admin Products/DataQuality/Dashboard | 3 RPCs | Admin or public subset | Definitions absent | Unverifiable |
| Storage operations | None found | Storage | N/A | No policies/config found | Not used in source |
| Auth admin methods | None found | `auth.admin` | Trusted server only | Not present | Appropriate |

No second hidden browser Supabase client or frontend service-role use was found.

## 10. Auth review

Positive observations:

- The frontend client uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Session initialization and `onAuthStateChange` listeners are present.
- Sign-out clears profile state through the auth context.
- Direct anonymous navigation to `/admin` redirected to `/admin/login`; protected product detail redirected to `/login` in the isolated local UI check.

Security concerns:

- Browser `VITE_ADMIN_EMAILS` and database `site_settings.admin_emails` are separate, drift-prone authorities.
- Frontend route protection is not database authorization.
- The database admin authority is client-writable (F-01).
- There is no password recovery, account deletion, OAuth callback, or MFA UI in the repository.
- Signup immediately inserts `buyer_profiles`; if email confirmation returns no session, RLS may reject that insert.
- Raw auth/database errors may be shown.

Manual Dashboard checks are listed in `SECURITY_TEST_PLAN.md`: site/redirect URLs, confirmation, password requirements, breached-password protection if available, rate limits, CAPTCHA, MFA, token lifetime, SMTP, provider settings, and audit logs.

## 11. Storage review

No `.storage` client calls, Storage bucket definitions, `storage.objects` policies, upload UI, Edge Functions, or bucket configuration were found. Storage is therefore **not used in the reviewed source**, not “verified secure.” If it is enabled out of band, inventory private/public buckets and object policies before deployment.

## 12. Dependency review

Environment:

- Node 22.17.0, npm 10.9.2.
- Lockfile v3; 356 package entries inspected.
- All lockfile packages resolve to the npm registry and include integrity values.
- No Git dependencies or arbitrary CDN runtime scripts were found.
- Install scripts were limited to expected native/build packages (`esbuild`, optional `fsevents`).

Results:

- `npm install` completed and restored dependencies after `npm ci` encountered a Windows `EPERM` on a locked `esbuild` binary. `package.json` and `package-lock.json` were unchanged.
- `npm ls --depth=0` succeeded.
- `npm audit --offline --json` reported zero known vulnerabilities, but local cache completeness is unknown.
- Live `npm audit --json` and `npm outdated` failed TLS certificate verification. Strict TLS was not disabled.
- Vite 5.4.8 is within development-server advisory ranges ([GHSA-356w-63v5-8wf4](https://github.com/advisories/GHSA-356w-63v5-8wf4), [GHSA-g4jq-h2w9-997c](https://github.com/advisories/GHSA-g4jq-h2w9-997c), [GHSA-93m4-6634-74q7](https://github.com/advisories/GHSA-93m4-6634-74q7)). Current scripts/config do not expose Vite with `--host`, no public symlink was found, and Vite is not production runtime code. Upgrade to a compatible patched release (at least 5.4.21 within that line, or a supported newer release).
- Supabase JS 2.57.4 is old relative to current releases and should be upgraded through compatibility testing, but no specific reachable vulnerability was confirmed in this audit.

Conclusion: no confirmed exploitable production dependency vulnerability was established. Live advisory verification must be rerun from a trusted network.

## 13. Secret review

| Secret/config type | Location | Committed/history | Browser bundle | Result |
|---|---|---|---|---|
| Supabase anon JWT | Root `.env` | Ignored; not found in history | Present as expected | Public client credential, not a secret; relies on RLS |
| Supabase service-role JWT | `supabase/.env.seed:2` | Ignored/untracked; exact and generic JWT history searches negative | Not found | Privileged local secret; rotate and move to secret store |
| Admin email allowlist | `VITE_ADMIN_EMAILS` | Browser-visible by design | Visible | Must not be an authorization boundary |
| `.env.example` | Root | Tracked | Placeholders | Appropriate |

No database password, private key/certificate, credential-bearing URL, frontend service-role key, or committed JWT was confirmed. Generic `sk-...` searches produced product-text false positives. Gitleaks/TruffleHog were unavailable, so this is a strong manual/custom scan rather than scanner attestation.

No full secret values are reproduced in any deliverable.

## 14. Import and diagnostic script review

Positive observations:

- Service-role credentials are loaded from environment variables rather than hard-coded in script source.
- Several scripts offer `--dry-run`.
- Reviewed SQL generators escape single quotes; no `eval` or `new Function` use was found.
- Many input mappings use explicit fields rather than spreading arbitrary objects into writes.

Risks:

- Elevated scripts bypass RLS and generally make dry-run opt-in instead of the default.
- `dedup.mjs`, `dedup_samesource.mjs`, and `delete_masked.mjs` perform deletes without typed target confirmation, project allowlisting, row ceilings, or transaction rollback.
- `delete_masked.mjs` uses a fixed backup name and writes during dry-run.
- `export_db.mjs` exports tables including quote/collaboration PII to unencrypted ignored JSON on local disk.
- Generated CSV reports do not neutralize formula cells.
- Browser JSON imports use `FileReader`/`JSON.parse` without explicit file-size limits; large files can freeze the admin UI.
- The repository contains a very large generated SQL/data surface; review should be automated and the authoritative migration/import boundary documented.

## 15. Dynamic-test results

### Completed

- Built the actual production application successfully.
- Inspected `dist`: one approximately 1.18 MB JavaScript asset, no `.map` files, and no `service_role` marker.
- Created a temporary copy of `dist`, replaced the remote Supabase URL with loopback, served it on `127.0.0.1`, and inspected it with the in-app browser.
- Verified:
  - Home route rendered without browser console errors.
  - Anonymous `/admin` navigation redirected to `/admin/login`.
  - Anonymous protected product-detail navigation redirected to `/login`.
  - Public partner form rendered; inspected inputs had no length caps.
  - Rendered home links contained no dangerous scheme at that moment.
- No form was submitted, no credentials were entered, and the temporary copy/server were removed.

### Not completed

- No Supabase API authorization matrix, User A/User B isolation, protected-field, RPC, Storage, or logout/session-cache test.
- No ZAP scan.
- No actual Netlify/staging header test.
- No remote database/schema introspection.

**Cross-user data isolation was not dynamically tested and did not “pass.”** Static migration review instead predicts multiple authorization failures.

## 16. Deployment-security checklist

Before private staging:

- [ ] Fix F-01 through F-03 in reviewed migrations.
- [ ] Rebuild a clean local database and inventory `pg_policies`, grants, functions, views, triggers, and exposed schemas.
- [ ] Commit definitions for all called RPCs and restrict execute privileges.
- [ ] Rotate/remove the repository-local service-role key.
- [ ] Make maintenance scripts dry-run by default with target/confirmation guards.
- [ ] Resolve lint/typecheck failures and add RLS integration tests.
- [ ] Define public supplier/catalog data contract and field projections.
- [ ] Add server-side validation/bounds and force public submission initial status.
- [ ] Add CSV and URL sanitization.

On private HTTPS staging:

- [ ] Verify `Content-Security-Policy`, `X-Content-Type-Options`, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`.
- [ ] Verify HTTPS redirect and HSTS only after HTTPS/domain readiness.
- [ ] Confirm SPA fallback does not expose configuration/source files.
- [ ] Confirm HTML is not cached as user-specific content; assets remain immutable.
- [ ] Confirm no source maps, debug endpoints, service-role strings, or unexpected environment variables.
- [ ] Exercise signup/confirmation/recovery/logout/refresh/multiple tabs/back navigation.
- [ ] Verify Dashboard redirect allowlists, password/rate/CAPTCHA/MFA/SMTP/token settings.
- [ ] Run safe baseline scanning only against the private staging origin.
- [ ] Verify external image and URL allowlists.

## 17. Residual risks

Even after source fixes:

- Actual Supabase grants/default privileges may differ from migrations.
- A `SECURITY DEFINER` function remains a sensitive component and requires owner/grant/search-path review.
- Public form abuse requires platform rate controls in addition to validation.
- Admin/browser compromise or XSS can act with the current user's session; CSP reduces but does not eliminate this risk.
- Service-role scripts remain high impact and require operational access control, secret governance, backups, and auditability.
- External product/import data quality and link safety require continuous validation.
- Dependencies and platform behavior change over time; repeat audits and patch management are necessary.

## 18. Recommended next steps

1. Define the authoritative admin model and private/public data contract.
2. Implement one reviewed migration that removes the circular `site_settings` authority and drops every legacy permissive policy by exact name.
3. Add the missing RPC definitions/grants and a reproducible local Supabase configuration.
4. Run the complete anon/User A/User B/admin API matrix in `SECURITY_TEST_PLAN.md`.
5. Only after that passes, address medium findings and deploy to private staging for header/auth/browser verification.

The single most important next action is to replace the client-writable admin authority and repair the RLS policy set before any deployment or real-user onboarding.
