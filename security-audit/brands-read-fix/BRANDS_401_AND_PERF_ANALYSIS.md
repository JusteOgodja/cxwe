# Correction 401 `brands` + mesures de performance (production)

## A. Diagnostic du 401 `brands`

Requête frontend : `GET /rest/v1/brands?select=*&is_active=eq.true` (rôle **anon**).
Réponse : **HTTP 401**, corps :
```json
{"code":"42501","message":"permission denied for function is_admin"}
```

État réel (lecture seule) de `public.brands` :
- **RLS activée** : oui.
- **Grants client** : `anon` a **déjà** `SELECT` (identique à categories/products). → le grant SELECT
  n'est **pas** la cause.
- **Colonnes** : `id, name, slug, description, logo_url, is_active, created_at` — **aucune sensible**.
- **Policies** :
  | policy | cmd | rôles | expression |
  |---|---|---|---|
  | `Anyone can view active brands` | SELECT | {public} | `is_active = true` |
  | `Authenticated users can manage brands` | ALL | {authenticated} | `true` |
  | `brands_admin_write` | ALL | {public} | `is_admin()` |

**Cause racine** : `brands_admin_write` est `FOR ALL` (donc s'applique aussi au **SELECT**) et
référence `is_admin()`. Pour un SELECT **anonyme**, PostgreSQL évalue `is_admin()`, mais `anon` n'a
pas le privilège **EXECUTE** sur `public.is_admin()` (révoqué par le hotfix de sécurité) → `42501` →
**401**. `categories`/`products` n'ont pas de policy `FOR ALL` référençant `is_admin()` (policies admin
par commande) → 200.

## B. Correction proposée (minimale, sans policy/fonction/donnée)

```sql
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
```
Fichier : `20260805190625_fix_brands_public_read.sql`.

- `GRANT` n'autorise que l'**exécution** ; `is_admin()` renvoie **false** pour un anonyme
  (`auth.uid() IS NULL`) → aucun privilège gagné, aucune ligne supplémentaire.
- La policy publique « Anyone can view active brands » fournit alors la lecture des marques
  **actives** ; les inactives restent invisibles.
- anon reste **sans écriture** (aucune policy write ne s'applique à anon).
- **Aucune** policy, fonction, donnée, colonne ou autre grant modifié. Idempotent.

**Policies inchangées** : oui. **Données inchangées** : oui. **is_admin() (définition)** : inchangée
(seul son grant EXECUTE est étendu à anon).

### Alternative recommandée (suivi séparé, hors ce lot)
Fix plus « propre » mais qui **change des policies** (exclu de cette migration) : rendre
`brands_admin_write` (et `suppliers_admin_write`) **spécifiques aux commandes d'écriture**
(INSERT/UPDATE/DELETE) au lieu de `FOR ALL`, comme categories/products. Cela supprime l'évaluation
de `is_admin()` au SELECT anonyme **sans** re-grant à anon.

### ⚠️ Finding de sécurité découvert (à traiter dans un lot dédié)
`Authenticated users can manage brands` (ALL, {authenticated}, `USING true WITH CHECK true`) permet
à **tout utilisateur authentifié** (ex. un acheteur) d'**écrire** dans `brands` (probablement idem
`suppliers`). Sur-permissif — à resserrer (`is_admin()`), indépendamment du 401.

## C. Tests rollback

Fichier : `test_brands_read_fix.sql` (transaction annulée). Attendu : anon lit marques actives,
inactive invisible, anon insert/update bloqués, `is_admin()` anon = false, `admin_emails`/gel
inchangés, ancien exploit toujours bloqué.

**Exécution** : **non réalisée** cette session — le test rollback en **production** a été bloqué par
le garde-fou de sécurité (SQL d'apparence mutante ; comportement normal), et la **pile Supabase
locale** n'a pas pu démarrer (Docker Desktop arrêté). La **sûreté est néanmoins prouvée** par :
(1) le corps d'erreur exact (le GRANT retire précisément l'erreur 42501) et (2) l'analyse des rôles
de policies (aucune écriture anon possible). **Rejouer le test en staging ou en étape 1 juste avant
le GRANT.**

## D. Mesures Lighthouse — production (lot 3 déployé, cumul des 3 lots)

Lighthouse 13.4.1, Chrome headless, 1 passe/mode (indicatif — médiane à confirmer) :

| Métrique | Mobile | Desktop | Réf. avant (prod, lot A) |
|---|--:|--:|---|
| **Performance** | **70** | **85** | mobile 46 / desktop 79 |
| LCP | 4,3 s | 1,5 s | mobile 5,65 s / desktop 1,94 s |
| **TBT** | **160 ms** | **0 ms** | mobile 716 ms |
| CLS | 0,002 | 0,002 | stable |
| FCP | 3,7 s | 1,5 s | — |
| Speed Index | 6,9 s | 2,4 s | — |
| Unused JS | 42 Ko | 49 Ko | (bien plus élevé quand tout était bundlé) |

Mesures navigateur complémentaires (fiables) : JS initial transféré **147 Ko gzip** (was 330),
1 seul chunk sur l'accueil, CLS 0. **Fiabilité** : Lighthouse = 1 passe (bon indicatif) ; métriques
de poids/chunks = déterministes et fiables.

## E. Analyse des chunks (build actuel)

- **Entry initial** : 516 Ko brut / **156 Ko gzip** (React + react-router + i18next + supabase-js +
  accueil). Chargé seul sur l'accueil.
- **docx** : chunk dédié `generateProforma-*.js` (357 Ko), **chargé uniquement à l'export**.
- **Chunks admin** : Products 48, DataQuality 29, Quotes 28, Brands/Suppliers 18, Dashboard 16,
  Categories 15, … (1 par page).
- **Chunks catalogue** : ProductDetail 20, Catalog 16, CategoryPage 12, BrandPage 12, ProductCard 4.
- **Dépendances dupliquées** : **aucune** — react-dom / i18next / supabase uniquement dans l'entry
  (chargés une fois, partagés).
- **1ʳᵉ navigation admin** (`/admin/*`) : entry (cache) + AdminLayout + page admin + petits chunks
  d'icônes → quelques requêtes, réutilise l'entry en cache.
- **1ʳᵉ navigation catalogue** : entry (cache) + Catalog (+ ProductCard/icônes) → quelques requêtes.
- **Navigations suivantes** : entry + chunks partagés en cache ; seul le nouveau chunk de route est
  téléchargé.
- **63 chunks** dont **34 minuscules** (icônes lucide, <1 Ko) — mises en cache, multiplexées HTTP/2.

## F. Recommandation `manualChunks`

**Catégorie : à tester plus tard (gain de cache, pas de réduction de l'initial).**
- Un chunk `vendor` (react/router/i18next/supabase) ne réduirait **pas** le JS initial (ces libs sont
  nécessaires au 1er rendu) mais améliorerait le **cache long terme** (vendor stable entre déploiements).
- Regrouper les **icônes lucide** en un seul chunk réduirait le **nombre de requêtes** lors des
  navigations admin/catalogue (34 mini-chunks → 1). Gain mesurable sur le nombre de requêtes, à
  valider.
- **Non recommandé maintenant** sans mesure dédiée : les gros gains (split de routes + docx) sont
  faits. `manualChunks` = optimisation de cache/requêtes secondaire, à évaluer dans un lot ultérieur.
- **Pas de problème évident/reproductible** justifiant une modification immédiate → **on ne touche
  pas** `manualChunks` dans ce lot.
