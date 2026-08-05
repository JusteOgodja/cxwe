# Correction 401 `brands` (par policies) + mesures de performance (production)

## A. Diagnostic du 401 `brands`

Requête frontend : `GET /rest/v1/brands?select=*&is_active=eq.true` (rôle **anon**).
Réponse : **HTTP 401**, corps : `{"code":"42501","message":"permission denied for function is_admin"}`.

État réel (lecture seule) de `public.brands` :
- **RLS activée** : oui. **Colonnes** : `id, name, slug, description, logo_url, is_active, created_at` (aucune sensible).
- **Grants client** : `anon` a **déjà** `SELECT` (le grant SELECT n'est **pas** la cause).
- **Policies (avant)** :
  | policy | cmd | rôles | using | with check |
  |---|---|---|---|---|
  | `Anyone can view active brands` | SELECT | PUBLIC | `is_active = true` | — |
  | `Authenticated users can manage brands` | ALL | authenticated | `true` | `true` |
  | `brands_admin_write` | ALL | PUBLIC | `is_admin()` | `is_admin()` |

**Deux problèmes de policies :**
1. `brands_admin_write` est `FOR ALL` **TO PUBLIC** et appelle `is_admin()` → évaluée au **SELECT anonyme** ;
   `anon` n'a pas l'EXECUTE sur `is_admin()` (révoqué par le hotfix) → `42501` → **401**.
2. `Authenticated users can manage brands` (`ALL`, `true`) autorise **tout utilisateur authentifié**
   (ex. un acheteur) à **écrire** dans `brands` — sur-permissif.

### Privilèges PostgreSQL réels (lecture seule, `has_table_privilege`/`has_function_privilege`)
```
anon           : SELECT=t INSERT=t UPDATE=t DELETE=t
authenticated  : SELECT=t INSERT=t UPDATE=t DELETE=t
EXECUTE is_admin : authenticated=t  anon=f
```
- `authenticated` possède **déjà** INSERT/UPDATE/DELETE → la faille d'écriture ordinaire est
  **confirmée au niveau privilège** (seule la policy permissive la « débloquait »). → **la migration
  de policies SUFFIT** ; `admin_brand_writes_require_additional_table_grants = false`.
- `anon` possède aussi les grants DML **mais aucune policy ne l'autorisera** après correction (RLS
  bloque). On **n'ajoute aucun** privilège d'écriture à anon (et on ne re-grante pas is_admin à anon).
- La migration **ne modifie aucun grant** ; elle ne touche que les policies de `brands`.
- Précondition : vérifie **exactement** les 3 policies attendues (`Anyone can view active brands`,
  `Authenticated users can manage brands`, `brands_admin_write`) — annulation intégrale si l'état diffère.

## Journal d'application en production (2026-08-05)
- **Appliquée** via `execute_sql` (fichier verbatim, hors `supabase_migrations`), transaction arrivée
  à **`COMMIT`** ; **précondition passée** (l'ensemble exact des 3 policies attendues correspondait).
- **Policies finales** (5) : `Anyone can view active brands` (SELECT PUBLIC, conservée) +
  `brands_admin_select/insert/update/delete` (authenticated, `is_admin()`). Supprimées :
  `brands_admin_write`, `Authenticated users can manage brands`.
- **Contrôles post-déploiement (anon réel, prod)** : `GET brands?is_active=eq.true` = **200** (was
  401) ; count marques actives = **200 / 506** ; **INSERT anon = 401 (bloqué)** ; accueil = 4 requêtes,
  **0 requête échouée**, stat marques fonctionnel.
- **Non-régression** : `anon_execute_is_admin=false` (inchangé) ; gel `admin_emails` actif ;
  `site_settings_authenticated_all` absente ; categories/products inchangés ; ancien exploit toujours
  bloqué.

## B. Correction (par policies — pas de grant is_admin à anon)

Fichier : `20260805191820_fix_brands_policies.sql` (transactionnel + préconditions).

- **Conservée** : `Anyone can view active brands` (SELECT PUBLIC `is_active=true`).
- **Supprimées** : `brands_admin_write` (FOR ALL PUBLIC) et `Authenticated users can manage brands`.
- **Créées** (TO `authenticated`, gardées par `public.is_admin()`) :
  - `brands_admin_select` : `USING (is_admin())`
  - `brands_admin_insert` : `WITH CHECK (is_admin())`
  - `brands_admin_update` : `USING (is_admin())` + `WITH CHECK (is_admin())`
  - `brands_admin_delete` : `USING (is_admin())`

Effets : anon SELECT n'évalue plus `is_admin()` (plus de 401) et lit uniquement les marques
**actives** ; utilisateur ordinaire ne peut **plus écrire** ; admin conserve lecture complète +
écritures. **`anon` n'obtient AUCUN EXECUTE sur `is_admin`.** `EXECUTE is_admin` reste réservé à
`authenticated`. Aucune donnée, fonction, grant (dont is_admin) ou autre table modifiés.

## C. Tests

- SQL rollback : `test_brands_policies.sql` (rôles simulés) — applique la correction puis vérifie
  anon/ordinaire/admin + non-régression `admin_emails`/gel.
- **Tests « vrais JWT » sur la pile Supabase locale** (GoTrue + PostgREST) : voir la section
  « Résultats locaux » ci-dessous (renseignée après exécution). Objectif : reproduire l'état prod
  (3 policies), appliquer la migration, tester anon/ordinaire/admin via HTTP réels.

## D. Mesures Lighthouse — production (cumul des 3 lots perf déjà déployés)

Lighthouse 13.4.1, Chrome headless, 1 passe/mode (indicatif) :

| Métrique | Mobile | Desktop | Réf. avant (lot A) |
|---|--:|--:|---|
| **Performance** | **70** | **85** | 46 / 79 |
| LCP | 4,3 s | 1,5 s | 5,65 s / 1,94 s |
| **TBT** | **160 ms** | **0 ms** | 716 ms |
| CLS | 0,002 | 0,002 | stable |
| FCP | 3,7 s | 1,5 s | — |
| Speed Index | 6,9 s | 2,4 s | — |
| Unused JS | 42 Ko | 49 Ko | — |

Complément fiable (navigateur) : JS initial **147 Ko gzip** (was 330), 1 chunk sur l'accueil, CLS 0.
**Fiabilité** : Lighthouse = 1 passe (bon indicatif) ; poids/chunks + CLS = déterministes/fiables.

## E. Analyse des chunks

- **Entry** : 516 Ko brut / **156 Ko gzip** (React + router + i18next + supabase + accueil), seul chunk sur l'accueil.
- **docx** : chunk dédié `generateProforma-*.js` (357 Ko), chargé **uniquement à l'export**.
- Admin : Products 48, DataQuality 29, Quotes 28, Brands/Suppliers 18, Dashboard 16, … (1/page).
- Catalogue : ProductDetail 20, Catalog 16, CategoryPage 12, BrandPage 12.
- **Dépendances dupliquées** : **aucune** (react-dom/i18next/supabase uniquement dans l'entry).
- 1ʳᵉ nav admin/catalogue : entry en cache + chunk de la route + petits chunks d'icônes.
- 63 chunks dont 34 minuscules (icônes lucide, cache/HTTP2).

## F. Recommandation `manualChunks`

**À tester plus tard (bénéfice cache/requêtes, pas de réduction de l'initial).** Un vendor-chunk
n'améliore que le cache long terme ; regrouper les icônes lucide réduirait le nombre de requêtes en
navigation. Aucun problème évident ne justifie d'y toucher maintenant → **non modifié** dans ce lot.

## Résultats locaux (vrais JWT)

⚠️ **Non exécutés cette session** : Docker Desktop était arrêté puis son daemon est resté non
réactif (`docker ps`/`docker info` en timeout après plusieurs minutes) → la pile Supabase locale
n'a pas pu démarrer ; et le test rollback en **production** est bloqué par le garde-fou de sécurité
(SQL d'apparence mutante). **À rejouer** en staging ou en étape 1, juste avant l'application.

**Sûreté démontrée par la sémantique RLS** (indépendamment de l'exécution) :
- Après suppression de `brands_admin_write` (FOR ALL PUBLIC `is_admin()`), le SELECT **anonyme**
  n'évalue plus que `Anyone can view active brands` (PUBLIC, `is_active=true`) → marques **actives**
  visibles, `is_admin()` jamais appelée → **plus de 401** ; marques inactives invisibles.
- Écritures : seules `brands_admin_*` (TO `authenticated`, `is_admin()`) s'appliquent → anon
  **bloqué** (non authentifié), ordinaire **bloqué** (`is_admin()`=false), admin **autorisé**.
- Suppression de `Authenticated users can manage brands` → un utilisateur authentifié ordinaire ne
  peut **plus** écrire dans `brands`.
- `EXECUTE is_admin` **inchangé** (réservé à `authenticated`) ; **aucun** grant à anon.
- `site_settings` / gel `admin_emails` / `is_admin()` / products / categories : **non touchés** par
  la migration (elle ne modifie que les policies de `brands`) → ancien exploit toujours bloqué.
