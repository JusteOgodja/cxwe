# Security Findings

Audit date: 2026-07-29  
Application: Morocco Food Export (`cxwe`)  
Assessment basis: repository source, migration ordering, production build, local isolated UI checks, and Git history. The configured remote Supabase project was not queried or modified.

## Classification notes

- **Confirmed (source):** the vulnerable behavior follows directly from the checked-in code or SQL if the timestamped migrations are applied as written.
- **Likely:** a credible attack path exists, but runtime configuration or browser/database behavior still needs confirmation.
- **Security weakness/configuration issue:** defense is missing or ambiguous, without evidence that the weakness is currently exploitable.
- **Manual verification:** the repository does not contain enough information to determine the deployed state.

No finding proves that the configured remote database currently matches the migrations. Runtime RLS and cross-user isolation were not tested because no local Supabase configuration or disposable project was available.

## Summary

| ID | Severity | Title | Classification | Confidence |
|---|---|---|---|---|
| F-01 | High | Any authenticated user can make themselves an administrator | Confirmed vulnerability (source) | High |
| F-02 | High | Authenticated users can read and modify every quote and collaboration request | Confirmed vulnerability (source) | High |
| F-03 | High | Legacy permissive policies leave business tables writable by every authenticated user | Confirmed vulnerability (source) | High |
| F-04 | Medium | Frontend RPC authorization cannot be audited because definitions are absent | Configuration/release-control issue | High |
| F-05 | Medium | User-controlled data is exported to CSV without formula neutralization | Likely vulnerability | High |
| F-06 | Medium | User-controlled and imported URL schemes are rendered as clickable links | Likely vulnerability | Medium |
| F-07 | Medium | Service-role maintenance scripts default to live mutation and lack target safeguards | Security weakness | High |
| F-08 | Medium | A live service-role credential is stored in an ignored repository-local file | Secret-management weakness | High |
| F-09 | Medium | Production deployment configuration lacks baseline browser security headers | Configuration issue | High |
| F-10 | Medium | Public policies may expose supplier contacts and unpublished child data | Likely data-exposure weakness | Medium |
| F-11 | Low | Public submissions and business values lack server-side bounds | Security/integrity weakness | High |
| F-12 | Low | Raw Supabase errors can be shown to users or logged | Information-disclosure weakness | High |
| F-13 | Low | Installed Vite version has development-server advisories | Development-only dependency risk | High |
| F-14 | Low | Security regression coverage is absent and quality gates currently fail | Assurance weakness | High |
| F-15 | Informational | Auth dashboard controls and several account lifecycle flows are unverified | Manual verification | High |

---

## F-01 — Any authenticated user can make themselves an administrator

1. **Severity:** High
2. **Confidence:** High
3. **Classification:** Confirmed vulnerability in the migration source; actual database state not dynamically verified.
4. **Affected component:** `site_settings` RLS, `is_admin()`, all RLS policies that trust `is_admin()`, and frontend settings administration.
5. **File and line:** `supabase/migrations/20260728000002_create_site_settings.sql:12-19`; `supabase/migrations/20260728000003_rls_admin_function.sql:8-17`; `src/pages/admin/Settings.tsx:82-104`.
6. **Technical explanation:** `site_settings_authenticated_all` permits every `authenticated` session to insert, update, upsert, or delete every settings row. The `SECURITY DEFINER` function `is_admin()` determines authority from the `admin_emails` setting. Therefore the data being used as the authorization root is directly writable by the population it is intended to restrict. The browser-side `VITE_ADMIN_EMAILS` check is only a route guard and does not repair the database authorization flaw. The function also lacks an explicit safe `search_path`, schema-qualified references, and explicit execute grants/revokes.
7. **Realistic attack scenario:** A self-registered buyer uses browser developer tools and the public anonymous key plus their valid access token to upsert `site_settings.key = 'admin_emails'` with their own email. Subsequent calls to `is_admin()` return true, allowing the buyer to modify categories/products and read all buyer profiles through policies that trust the function.
8. **Preconditions:** The attacker needs any authenticated account; self-sign-up appears available. The relevant migrations must have been applied.
9. **Impact:** Unauthorized administrative data access and business-data modification; access to buyer profile PII; integrity loss across product/catalog records. This does not itself grant Supabase `service_role` or access to `auth.users`.
10. **Evidence:** The setting table has a permissive `FOR ALL` policy for `authenticated`, and `is_admin()` reads the same table. PostgreSQL permissive policies are OR-combined.
11. **Safe reproduction steps:** On a local or explicitly disposable Supabase project only: create User A; authenticate; upsert the `admin_emails` setting to User A's email; call `is_admin()` or attempt an admin-only category insert. The secure expected result is denial at the settings write. Do not perform this against the configured remote project.
12. **Recommended remediation:** Make the authorization source unmodifiable by ordinary sessions. Prefer trusted `app_metadata` set only through a server/service-role path, or a non-exposed/private admin-membership table writable only by a tightly controlled operational role. Restrict `site_settings` writes to an administrator authority that does not depend on `site_settings` itself.
13. **Suggested SQL change:** In a reviewed migration, drop `site_settings_authenticated_all` and `site_settings_authenticated_select`; create narrowly scoped read/write policies. Recreate `public.is_admin()` as `SECURITY DEFINER SET search_path = ''`, schema-qualify every referenced object, and explicitly `REVOKE ALL ... FROM PUBLIC, anon` then grant only the minimum required execution privilege. Avoid circular authorization.
14. **Possible regression risks:** Existing administrators may lose settings access if admin membership is not migrated first. RLS policies across categories, products, suppliers, brands, and buyer profiles depend on `is_admin()`.
15. **Verification test:** User A cannot read or change privileged settings and `is_admin()` is false; a provisioned administrator can perform intended operations; User A cannot write any admin table even with direct PostgREST requests.
16. **CWE:** CWE-269 (Improper Privilege Management), CWE-863 (Incorrect Authorization).
17. **OWASP:** A01:2021 Broken Access Control.

## F-02 — Authenticated users can read and modify every quote and collaboration request

1. **Severity:** High
2. **Confidence:** High
3. **Classification:** Confirmed vulnerability in the migration source; runtime state not verified.
4. **Affected component:** `quote_requests`, `collaboration_requests`.
5. **File and line:** `supabase/migrations/20260525011107_create_catalog_schema.sql:117-135`; `supabase/migrations/20260525_create_collaboration_requests.sql:41-49`.
6. **Technical explanation:** Public insert is intentionally allowed, but all authenticated users receive unconditional SELECT, UPDATE, and DELETE access. The rows contain company names, contact names, email addresses, phone numbers, business requirements, and messages. Neither table has a submitter `user_id`; there is no ownership predicate to distinguish a buyer from an administrator.
7. **Realistic attack scenario:** A normal buyer signs in and sends direct PostgREST requests to enumerate all quote and partnership submissions, change their statuses or content, and delete them.
8. **Preconditions:** Any authenticated session and applied source policies.
9. **Impact:** Cross-user PII and commercial-data disclosure, workflow tampering, and deletion of leads.
10. **Evidence:** `USING (true)` and `WITH CHECK (true)` are used for authenticated policies. The frontend's admin routes do not constrain direct API access.
11. **Safe reproduction steps:** On local/disposable Supabase, insert separate fake rows as anonymous/User B; authenticate as User A; attempt SELECT by User B's UUID, UPDATE its status, and DELETE it. Secure behavior should deny or return zero affected rows; the source policies predict success.
12. **Recommended remediation:** Decide whether these are anonymous inbox records or user-owned records. If anonymous, permit only a constrained INSERT from `anon`/`authenticated`, and allow SELECT/UPDATE/DELETE only to trusted admins. If buyers need access, add an immutable `user_id DEFAULT auth.uid()` for authenticated submissions and ownership policies while retaining a separate admin policy.
13. **Suggested SQL change:** Drop the unconditional authenticated policies. Add explicit `TO anon, authenticated` INSERT policies with validated fields; add `TO authenticated USING (public.is_admin())` admin SELECT/UPDATE/DELETE policies. Consider column privileges or a trusted RPC/Edge Function so anonymous clients cannot set workflow fields such as `status`.
14. **Possible regression risks:** Buyers or operational staff who currently rely on broad access will be denied. Anonymous rows have no owner and need an explicit support workflow.
15. **Verification test:** An anonymous user can submit valid fake data but cannot read it back. User A cannot read/update/delete User B's row. An administrator can manage the inbox.
16. **CWE:** CWE-862 (Missing Authorization), CWE-639 (Authorization Bypass Through User-Controlled Key).
17. **OWASP:** A01:2021 Broken Access Control.

## F-03 — Legacy permissive policies leave business tables writable by every authenticated user

1. **Severity:** High
2. **Confidence:** High
3. **Classification:** Confirmed vulnerability in the migration source when migrations are applied in order.
4. **Affected component:** `brands`, `suppliers`, `product_pricing_tiers`, `product_lots`, `product_images`, and `media`.
5. **File and line:** `supabase/migrations/20260525022213_update_product_schema_comprehensive.sql:33-34,53-54,67-68,84-85,102-103`; `supabase/migrations/20260727000000_benchmark_improvements.sql:66-67`; `supabase/migrations/20260728000003_rls_admin_function.sql:41-45`.
6. **Technical explanation:** Earlier migrations create broad policies such as `"Authenticated users can manage brands"` using `FOR ALL ... USING (true) WITH CHECK (true)`. The later admin migration attempts to drop three differently named brand policies that never existed, then adds `brands_admin_write`. It does not drop the original `FOR ALL` policy. It does not drop or replace the broad suppliers, pricing, lot, image, or media policies. Permissive policies are OR-combined, so adding an admin policy cannot narrow an existing `true` policy.
7. **Realistic attack scenario:** A normal buyer directly inserts a fake supplier, changes a brand, manipulates pricing, deletes product images, or alters inventory lots without passing through the hidden admin UI.
8. **Preconditions:** Any authenticated session and the migration state represented by the repository.
9. **Impact:** Catalog, pricing, supplier, image, and inventory integrity loss; possible business fraud and stored malicious-link injection.
10. **Evidence:** Exact policy names do not match the later `DROP POLICY` statements. Broad `FOR ALL` policies remain active.
11. **Safe reproduction steps:** On local/disposable Supabase, authenticate as a normal buyer and attempt a harmless insert then rollback/cleanup in each affected table. Secure expected result is permission denial; source policies predict success. Do not test the remote project.
12. **Recommended remediation:** Inventory the actual policy names from `pg_policies`, drop every legacy broad authenticated policy by exact name, and recreate explicit per-operation admin policies. Restrict public child-table SELECT to children of public/active parent products where that is the intended model.
13. **Suggested SQL change:** A migration should explicitly drop `"Authenticated users can manage brands"`, `"Authenticated users can manage suppliers"`, `"Authenticated users can manage pricing"`, `"Authenticated users can manage lots"`, and `"Authenticated users can manage product images"`, plus review the media insert policy. Add role-qualified admin-only policies with both `USING` and `WITH CHECK`.
14. **Possible regression risks:** Operational imports performed with ordinary authenticated sessions will stop working; they should use a controlled service process. Product detail pages may need adjusted public SELECT policies.
15. **Verification test:** User A receives authorization failures or zero affected rows for all writes; an administrator succeeds; public reads return only intentionally public records.
16. **CWE:** CWE-863 (Incorrect Authorization).
17. **OWASP:** A01:2021 Broken Access Control.

## F-04 — Frontend RPC authorization cannot be audited because definitions are absent

1. **Severity:** Medium
2. **Confidence:** High
3. **Classification:** Configuration/release-control issue requiring actual-schema verification.
4. **Affected component:** `search_products`, `get_quality_stats`, `get_products_with_issues`.
5. **File and line:** Calls at `src/pages/admin/Products.tsx:200`, `src/pages/admin/DataQuality.tsx:467-468`, and `src/pages/admin/Dashboard.tsx:75`; no matching definitions in checked-in migrations.
6. **Technical explanation:** The repository does not define these exposed PostgreSQL functions. Their owners, arguments, grants, `SECURITY INVOKER/DEFINER` mode, `search_path`, input validation, and RLS behavior are therefore unknown. The database cannot be reproducibly rebuilt from the repository.
7. **Realistic attack scenario:** If an undeclared function is granted to `anon` or `authenticated` and runs as a definer, a caller could enumerate draft products, aggregate private data, or bypass intended RLS.
8. **Preconditions:** A vulnerable out-of-band RPC definition must exist in the actual project.
9. **Impact:** Unknown; potentially unauthorized reads or writes and migration drift.
10. **Evidence:** Frontend `.rpc()` calls were found, but SQL searches found only the `is_admin()` definition.
11. **Safe reproduction steps:** On a local clone or read-only schema export from an approved disposable project, query `pg_proc`, `pg_namespace`, `pg_roles`, and `information_schema.routine_privileges`; exercise each function as `anon`, User A, User B, and admin using fake data.
12. **Recommended remediation:** Export reviewed definitions into timestamped migrations and explicitly specify security mode, safe `search_path`, schema-qualified references, and grants.
13. **Suggested SQL change:** Add `CREATE OR REPLACE FUNCTION ... SECURITY INVOKER` where possible; revoke default PUBLIC execution and grant only intended roles. If definer rights are essential, validate caller/ownership inside the function.
14. **Possible regression risks:** Restricting grants may break dashboard calls; function signatures must match generated PostgREST RPC endpoints.
15. **Verification test:** A clean local reset creates all three functions; role-matrix tests demonstrate only intended data visibility and mutation.
16. **CWE:** CWE-284 (Improper Access Control), CWE-250 (Execution with Unnecessary Privileges).
17. **OWASP:** A01:2021 Broken Access Control, A05:2021 Security Misconfiguration.

## F-05 — User-controlled data is exported to CSV without formula neutralization

1. **Severity:** Medium
2. **Confidence:** High
3. **Classification:** Likely vulnerability.
4. **Affected component:** Admin buyer and quote CSV exports.
5. **File and line:** `src/pages/admin/Buyers.tsx:72-87`; `src/pages/admin/Quotes.tsx:96-107`.
6. **Technical explanation:** Fields supplied through public/signup forms are written into CSV cells. Quote export escapes quotes but neither export neutralizes leading spreadsheet formula characters (`=`, `+`, `-`, `@`). Buyer export also fails to double embedded quotes.
7. **Realistic attack scenario:** An attacker submits a company or message value beginning with a spreadsheet formula. An administrator exports and opens the CSV in a spreadsheet application, which may evaluate the cell and make external requests or present a malicious hyperlink.
8. **Preconditions:** Attacker-controlled data reaches the table; an administrator exports and opens it in formula-capable software.
9. **Impact:** Admin workstation data disclosure or social engineering; impact depends on spreadsheet protections.
10. **Evidence:** CSV construction directly interpolates database values without a formula-safe encoder.
11. **Safe reproduction steps:** In an isolated test database, store the harmless string `=1+1` in a user-controlled field, export the CSV, and inspect the raw file as text. The expected secure value begins with a neutralizing apostrophe or otherwise cannot be treated as a formula. Do not execute external-command payloads.
12. **Recommended remediation:** Centralize CSV encoding: convert to string, prefix values beginning with optional whitespace plus `=`, `+`, `-`, or `@` with `'`, double internal quotes, and quote every cell.
13. **Suggested code change:** Add a shared `csvCell(value)` utility and use it for both exports and any script-generated CSV (`scope_report.mjs`, `price_outliers.mjs`).
14. **Possible regression risks:** The leading apostrophe may be visible in some consumers; confirm requirements with target spreadsheet applications.
15. **Verification test:** Unit-test embedded quotes, CR/LF, Unicode, and all formula prefixes; inspect exported files in text and a spreadsheet.
16. **CWE:** CWE-1236 (Improper Neutralization of Formula Elements in a CSV File).
17. **OWASP:** A03:2021 Injection.

## F-06 — User-controlled and imported URL schemes are rendered as clickable links

1. **Severity:** Medium
2. **Confidence:** Medium
3. **Classification:** Likely vulnerability; browser behavior and actual stored data were not dynamically tested.
4. **Affected component:** Partner website, product technical sheets, supplier/brand logos, and product source/image URLs.
5. **File and line:** `src/pages/admin/Partners.tsx:274`; `src/pages/ProductDetail.tsx:358`; `src/pages/admin/Suppliers.tsx:493`; `src/pages/admin/Brands.tsx:298,324,494`; `src/pages/admin/Products.tsx:657,760`.
6. **Technical explanation:** Database values are assigned directly to `href`. `target="_blank"` links generally include `rel`, which protects against opener attacks, but there is no scheme allowlist. The public partner form accepts a URL and its database insert policy is unconditional. Imported data can also populate URL fields. React escaping protects markup context but does not make every navigation scheme safe.
7. **Realistic attack scenario:** An anonymous submitter stores a non-HTTP URL in `website`; an administrator later clicks it in the partner console. A compromised import could similarly plant links in product/supplier records.
8. **Preconditions:** A dangerous or unwanted scheme passes browser input/database validation and a user clicks it.
9. **Impact:** Script/navigation abuse, credential phishing, or opening local/external handlers depending on browser policy.
10. **Evidence:** Direct `href={databaseValue}` assignments and no reusable URL validator or database URL constraint.
11. **Safe reproduction steps:** In a local browser/database only, store harmless samples such as `javascript:void(0)` and `data:text/plain,test`, inspect the rendered `href`, and confirm clicks are blocked after remediation. Do not use exfiltration payloads.
12. **Recommended remediation:** Parse URLs and allow only `https:` (and `http:` only if explicitly required). Reject credentials and unexpected hosts where business rules allow. Apply validation both before database write and at rendering time.
13. **Suggested code/SQL change:** Add `safeExternalUrl()` returning `undefined` unless the parsed scheme is allowed; render nonconforming values as text. Add database checks or a trusted ingestion validation layer for URL columns.
14. **Possible regression risks:** Existing relative URLs or HTTP-only supplier sites may stop linking and require data cleanup.
15. **Verification test:** HTTPS links work; `javascript:`, `data:`, `file:`, malformed URLs, and credential-bearing URLs render as non-clickable text.
16. **CWE:** CWE-939 (Improper Authorization in Handler for Custom URL Scheme), CWE-79 where a browser executes script-bearing schemes.
17. **OWASP:** A03:2021 Injection.

## F-07 — Service-role maintenance scripts default to live mutation and lack target safeguards

1. **Severity:** Medium
2. **Confidence:** High
3. **Classification:** Security and operational safety weakness.
4. **Affected component:** Elevated Supabase scripts, especially destructive deduplication/deletion utilities.
5. **File and line:** `supabase/dedup.mjs:13-14,63`; `supabase/dedup_samesource.mjs:15-16,68`; `supabase/delete_masked.mjs:14-15,40,48`; representative mutating scripts at `supabase/apply_*.mjs`.
6. **Technical explanation:** Scripts use `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. Many set dry-run only when `--dry-run` is supplied, so the default invocation mutates data. Destructive scripts do not enforce an allowed project reference, typed confirmation, transaction/rollback strategy, or durable audit record. `delete_masked.mjs` writes a fixed-name backup and still writes it during dry-run.
7. **Realistic attack scenario:** A developer runs a command from the wrong environment or omits `--dry-run`, causing remote records to be changed or deleted with RLS bypassed.
8. **Preconditions:** Access to the service-role credential and ability to execute scripts.
9. **Impact:** Broad remote data corruption or deletion and sensitive local exports.
10. **Evidence:** Direct `.delete()` calls and opt-in dry-run logic.
11. **Safe reproduction steps:** Do not point at a remote project. With a mocked/local client, run without flags and observe that the code follows the mutation path. Tests should replace the client and assert no mutation unless `--apply` plus confirmation is present.
12. **Recommended remediation:** Make dry-run the default. Require an explicit `--apply`, expected project reference/environment allowlist, typed confirmation for destructive operations, unique timestamped backups, row-count ceilings, and structured audit logs. Prefer database transactions/functions for atomic changes.
13. **Suggested code change:** A shared guard should compare the URL's project reference to an explicit allowlist and abort unless all safety flags match. Separate read-only reporting from mutation scripts.
14. **Possible regression risks:** Automation/CI jobs need updated flags and secret injection; large legitimate batches may need approved limits.
15. **Verification test:** Every script is non-mutating by default; wrong targets and excessive row counts abort; approved local/disposable execution records before/after counts.
16. **CWE:** CWE-250 (Execution with Unnecessary Privileges), CWE-78 is not established but shell safety should remain covered.
17. **OWASP:** A05:2021 Security Misconfiguration.

## F-08 — A live service-role credential is stored in an ignored repository-local file

1. **Severity:** Medium
2. **Confidence:** High
3. **Classification:** Secret-management weakness; not a committed frontend leak.
4. **Affected component:** Local administrative environment configuration.
5. **File and line:** `supabase/.env.seed:2` (ignored/untracked); `.gitignore:23-25`.
6. **Technical explanation:** The file contains a JWT whose role claim identifies it as `service_role`, associated with the same remote project URL used by the app. It is correctly ignored, was not found in tracked history, and was not present in the production bundle. Keeping a full-bypass credential inside the working copy nevertheless increases accidental disclosure and misuse risk.
7. **Realistic attack scenario:** The workspace is copied, backed up, attached to a ticket, accessed by malware, or a script prints its environment; the credential then permits RLS-bypassing database access.
8. **Preconditions:** Local filesystem or process-environment access.
9. **Impact:** Full API-level database access available to `service_role`, subject to project configuration.
10. **Evidence:** Redacted type preview `eyJhbG...REDACTED`; `git check-ignore` maps the file to `.env.*`; `git ls-files` and history searches did not find the file/token. No full secret is included in this report.
11. **Safe reproduction steps:** Decode only the JWT header/payload locally without printing the signature/token and confirm `role=service_role`; verify `git check-ignore -v supabase/.env.seed`; search the built output for a service-role marker.
12. **Recommended remediation:** Rotate the key because it has been stored in a developer workspace, remove the plaintext file after migration, and inject secrets at execution time from an OS/key-vault/CI secret store with least-access permissions.
13. **Suggested configuration change:** Retain only `.env.example` placeholders; document a secure secret retrieval workflow. Never prefix the key with `VITE_`.
14. **Possible regression risks:** Scripts will fail until their execution environment is updated to retrieve the rotated secret.
15. **Verification test:** Old key is rejected; new key is absent from repository, build, logs, and shell history; scripts receive it only at runtime.
16. **CWE:** CWE-522 (Insufficiently Protected Credentials), CWE-798 (Use of Hard-coded Credentials) as a secret-location concern.
17. **OWASP:** A02:2021 Cryptographic Failures.

## F-09 — Production deployment configuration lacks baseline browser security headers

1. **Severity:** Medium
2. **Confidence:** High
3. **Classification:** Configuration issue.
4. **Affected component:** Netlify/static production delivery.
5. **File and line:** `netlify.toml:17-31`.
6. **Technical explanation:** The config sets caching but no Content Security Policy, `X-Content-Type-Options`, frame protection (`frame-ancestors`), `Referrer-Policy`, or `Permissions-Policy`. HSTS and HTTPS enforcement are not verifiable before deployment. These are defense-in-depth controls, especially important because the app handles admin sessions and renders imported external URLs/images.
7. **Realistic attack scenario:** A separate injection or hosting/content-type issue has greater impact without CSP and nosniff; the application can be framed for UI redress; outbound navigation may disclose more referrer data than intended.
8. **Preconditions:** Deployment uses this configuration and an enabling attack condition exists.
9. **Impact:** Reduced resistance to XSS, clickjacking, MIME confusion, and privacy leakage.
10. **Evidence:** Only `Cache-Control` header entries are defined.
11. **Safe reproduction steps:** Deploy to a private HTTPS staging site, use `curl -I`/browser devtools, and verify headers. Vite/local server headers are not representative.
12. **Recommended remediation:** Add a tested CSP tailored to Supabase, images, fonts, and Netlify image delivery; add `nosniff`, `frame-ancestors 'none'` (or documented origins), strict referrer policy, minimal permissions policy, and HSTS only on HTTPS after domain readiness.
13. **Suggested config change:** Add `[[headers]] for = "/*"` with the reviewed values. Start CSP in report-only mode if necessary, then enforce.
14. **Possible regression risks:** An overly strict CSP can block Supabase API/Auth connections, external images, styles, or document downloads.
15. **Verification test:** Private staging functional test plus automated header assertions; CSP console contains no unexplained violations.
16. **CWE:** CWE-693 (Protection Mechanism Failure), CWE-1021 (Improper Restriction of Rendered UI Layers).
17. **OWASP:** A05:2021 Security Misconfiguration.

## F-10 — Public policies may expose supplier contacts and unpublished child data

1. **Severity:** Medium
2. **Confidence:** Medium
3. **Classification:** Likely data-exposure weakness; business intent requires confirmation.
4. **Affected component:** `suppliers`, `product_pricing_tiers`, `product_images`, `media`.
5. **File and line:** `supabase/migrations/20260525022213_update_product_schema_comprehensive.sql:36-54,67,84`; `supabase/migrations/20260727000000_benchmark_improvements.sql:66`.
6. **Technical explanation:** Public supplier SELECT is row-based (`is_active = true`) and therefore exposes every selected column, including contact name, email, and phone. Pricing, media, and product image policies use unconditional public SELECT and are not tied to an active parent product. UUIDs reduce casual guessing but are not authorization.
7. **Realistic attack scenario:** An unauthenticated caller queries active supplier rows directly through PostgREST to collect contact details, or enumerates pricing/images associated with draft or inactive products through known/leaked IDs.
8. **Preconditions:** Public grants/default Supabase API exposure permit the table operations, and the actual schema matches source.
9. **Impact:** Supplier PII/business-contact disclosure and early disclosure of unpublished catalog information.
10. **Evidence:** Public `USING (true)` or active-row policies apply to full table rows; no security-invoker public projection/view exists.
11. **Safe reproduction steps:** On local/disposable Supabase, query the tables with only the anon key and inspect returned columns/parent status using fake records.
12. **Recommended remediation:** Confirm the public data contract. Expose only approved supplier fields through a dedicated projection/API; keep contacts private. Scope child-table SELECT with `EXISTS` against an active/public parent or expose a reviewed view/RPC with security-invoker behavior.
13. **Suggested SQL change:** Remove direct public supplier-table access if contacts are private; create an allowlisted public view/API and explicit grants. Replace unconditional child SELECT predicates with parent visibility checks.
14. **Possible regression risks:** Existing catalogue joins may depend on direct supplier fields; view changes may require generated TypeScript updates.
15. **Verification test:** Anon responses contain only documented fields and no children of inactive/draft products.
16. **CWE:** CWE-200 (Exposure of Sensitive Information), CWE-862 (Missing Authorization).
17. **OWASP:** A01:2021 Broken Access Control.

## F-11 — Public submissions and business values lack server-side bounds

1. **Severity:** Low
2. **Confidence:** High
3. **Classification:** Security/integrity weakness.
4. **Affected component:** Public quote/partner forms and database numeric/text columns.
5. **File and line:** `supabase/migrations/20260525011107_create_catalog_schema.sql:103-119`; `supabase/migrations/20260525_create_collaboration_requests.sql:6-43`; `supabase/migrations/20260525022213_update_product_schema_comprehensive.sql:72-103`; public form inputs observed without `maxlength` during isolated UI review.
6. **Technical explanation:** Anonymous inserts use `WITH CHECK (true)`. Free-text fields have no database length limits; client fields have no maximum lengths; pricing minimums/prices and lot quantities lack positive-value checks. Public callers can choose any allowed `status` rather than being forced to the initial state. Rate limiting/CAPTCHA cannot be verified from the repository.
7. **Realistic attack scenario:** A caller directly submits oversized/spam records, sets a misleading initial workflow status, or an authenticated non-admin inserts negative/zero business values under the broad policies.
8. **Preconditions:** API reachability and relevant table policy.
9. **Impact:** Data quality problems, workflow confusion, storage/operational abuse; no denial-of-service testing was performed.
10. **Evidence:** Unbounded `text`, missing numeric `CHECK`s, and unconditional insert checks.
11. **Safe reproduction steps:** On local/disposable Supabase, submit boundary values just outside documented limits and verify rejection. Do not perform load or resource-exhaustion tests.
12. **Recommended remediation:** Define business maximums and database checks; force initial status server-side; add platform rate limits/CAPTCHA for public forms; validate again in a trusted layer.
13. **Suggested SQL change:** Add checks such as positive quantities/prices, allowed currency/URL formats where stable, bounded lengths, and an insert policy/trigger that enforces initial status. Use staged `NOT VALID` checks plus cleanup for existing data.
14. **Possible regression risks:** Existing imported records may violate new constraints; bulk imports may need validation reports.
15. **Verification test:** Boundary tests pass/fail as specified; public users cannot choose status; normal forms remain functional.
16. **CWE:** CWE-20 (Improper Input Validation).
17. **OWASP:** A04:2021 Insecure Design.

## F-12 — Raw Supabase errors can be shown to users or logged

1. **Severity:** Low
2. **Confidence:** High
3. **Classification:** Information-disclosure weakness.
4. **Affected component:** Quote/sample/signup error handling.
5. **File and line:** `src/pages/QuoteRequest.tsx:265-307`; `src/pages/SampleRequest.tsx:67`; `src/pages/SignUp.tsx:83-100`.
6. **Technical explanation:** Error messages from Supabase are assigned to UI error state in several flows, and quote fallback errors are logged. Database/auth messages may reveal schema, constraint, or account-state detail and can include submitted context.
7. **Realistic attack scenario:** A caller deliberately violates constraints to learn backend details, or sensitive submission data remains in shared browser developer logs.
8. **Preconditions:** A backend error with revealing content.
9. **Impact:** Minor information disclosure and privacy leakage that can aid further attacks.
10. **Evidence:** Direct use of error `.message` and console error logging.
11. **Safe reproduction steps:** In local/disposable testing, induce a benign constraint error and observe the UI/console. Do not probe the remote project.
12. **Recommended remediation:** Show stable generic user messages and map known errors to safe codes; send sanitized diagnostics to controlled monitoring only.
13. **Suggested code change:** Centralize `toPublicError(error)` and ensure production logs exclude payloads, tokens, and raw Supabase objects.
14. **Possible regression risks:** Reduced debugging detail; preserve correlation IDs and development-only diagnostics.
15. **Verification test:** Constraint/auth failures show generic text and no secrets/PII in production console output.
16. **CWE:** CWE-209 (Generation of Error Message Containing Sensitive Information).
17. **OWASP:** A05:2021 Security Misconfiguration.

## F-13 — Installed Vite version has development-server advisories

1. **Severity:** Low
2. **Confidence:** High
3. **Classification:** Development-only dependency risk under current configuration.
4. **Affected component:** `vite@5.4.8`.
5. **File and line:** `package-lock.json`; `package.json:40`.
6. **Technical explanation:** Vite 5.4.8 falls within ranges affected by dev-server file-read/bypass advisories. The repository's `dev` script does not use `--host`, `vite.config.ts` does not enable an exposed host, and no public-directory symlinks were found. These conditions materially reduce reachability, and Vite is not shipped as production runtime code.
7. **Realistic attack scenario:** A developer explicitly exposes the Vite dev server to an untrusted network; a remote attacker crafts advisory-specific requests to read files allowed by the affected behavior.
8. **Preconditions:** Development server exposed beyond loopback and advisory-specific path/symlink conditions.
9. **Impact:** Developer-machine file disclosure, not a demonstrated production application vulnerability.
10. **Evidence:** Installed version 5.4.8; relevant primary advisories are [GHSA-356w-63v5-8wf4](https://github.com/advisories/GHSA-356w-63v5-8wf4), [GHSA-g4jq-h2w9-997c](https://github.com/advisories/GHSA-g4jq-h2w9-997c), and [GHSA-93m4-6634-74q7](https://github.com/advisories/GHSA-93m4-6634-74q7).
11. **Safe reproduction steps:** Do not expose the server. Verify version and configuration statically; after upgrade, run the normal build and localhost-only smoke tests.
12. **Recommended remediation:** Upgrade Vite to at least the patched 5.4.x level covering all three advisories (5.4.21 or newer compatible release) and keep development servers bound to loopback.
13. **Suggested package change:** Update the Vite constraint and lockfile through a reviewed non-forced dependency upgrade; test plugin compatibility.
14. **Possible regression risks:** Build behavior or plugin compatibility changes; newer major Vite versions may require Node/config changes.
15. **Verification test:** `npm ls vite` reports a patched version; build and local routing tests pass; dev server remains loopback-only.
16. **CWE:** CWE-200 (Exposure of Sensitive Information).
17. **OWASP:** A06:2021 Vulnerable and Outdated Components.

## F-14 — Security regression coverage is absent and quality gates currently fail

1. **Severity:** Low
2. **Confidence:** High
3. **Classification:** Assurance weakness.
4. **Affected component:** Test/tooling pipeline.
5. **File and line:** `package.json:6-11`; current source reported by TypeScript/ESLint.
6. **Technical explanation:** No test script or browser/integration framework is configured. There are no automated RLS role-matrix tests. Type checking failed on three unused declarations, and linting failed with 25 errors and 11 warnings, so those gates cannot currently function as deployment criteria.
7. **Realistic attack scenario:** A future policy rename, permissive migration, unsafe export, or route/auth regression reaches deployment without detection.
8. **Preconditions:** Subsequent changes or release without manual review.
9. **Impact:** Increased probability and duration of security regressions.
10. **Evidence:** No test framework/configuration found; `npm run typecheck` and `npm run lint` were nonzero.
11. **Safe reproduction steps:** Run the documented commands locally; no security payload is needed.
12. **Recommended remediation:** Restore clean lint/type gates, add local Supabase integration tests covering anon/User A/User B/admin, and add frontend unit tests for URL/CSV/error utilities.
13. **Suggested code/config change:** Add a `security-tests/` suite using fake local identities and CI commands that cannot point at approved production references.
14. **Possible regression risks:** Tests need deterministic seed data and careful environment guards; CI duration increases.
15. **Verification test:** Clean install, lint, typecheck, unit tests, RLS integration tests, and build all pass in CI.
16. **CWE:** CWE-693 (Protection Mechanism Failure), as an assurance gap rather than a direct vulnerability.
17. **OWASP:** A04:2021 Insecure Design.

## F-15 — Auth dashboard controls and several account lifecycle flows are unverified

1. **Severity:** Informational
2. **Confidence:** High
3. **Classification:** Manual verification.
4. **Affected component:** Supabase Auth configuration and account lifecycle.
5. **File and line:** `src/contexts/AuthContext.tsx:39-57`; `src/pages/SignUp.tsx:83-100`; repository contains no `supabase/config.toml`.
6. **Technical explanation:** Sign-up/sign-in/sign-out and auth-state listeners exist, but no password recovery, OAuth callback, account deletion, or MFA UI was found. Dashboard-only controls—site URL, allowed redirects, email confirmation, password requirements, CAPTCHA/rate limits, SMTP, token lifetime, MFA, and OAuth settings—cannot be determined from source. If email confirmation is enabled and sign-up returns no session, the immediate buyer-profile insert may fail RLS.
7. **Realistic attack scenario:** Misconfigured redirects or weak anti-automation settings facilitate account abuse; lifecycle omissions leave users without a secure recovery/deletion path.
8. **Preconditions:** Insecure dashboard settings or relevant feature usage.
9. **Impact:** Configuration-dependent authentication abuse or broken onboarding.
10. **Evidence:** Repository and route review; no local Supabase auth config.
11. **Safe reproduction steps:** Review the dashboard manually and test fake accounts on local/disposable infrastructure.
12. **Recommended remediation:** Complete the dashboard checklist in `SECURITY_TEST_PLAN.md`, explicitly design confirmation/recovery/deletion/MFA behavior, and make profile creation robust to confirmation mode.
13. **Suggested change:** Prefer a trusted, idempotent profile-creation trigger or create the profile after a valid session is established, depending on intended onboarding.
14. **Possible regression risks:** Email-confirmation and redirect changes can break current onboarding and existing links.
15. **Verification test:** Test signup in both confirmation modes, recovery links, expiry, logout, refresh, multiple tabs, and redirect allowlists.
16. **CWE:** CWE-308 (Use of Single-factor Authentication) only if MFA is required by risk; otherwise configuration-specific.
17. **OWASP:** A07:2021 Identification and Authentication Failures.
