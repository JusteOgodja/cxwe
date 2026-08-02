# Findings — Escalade de privilèges administrateur (Supabase)

- **Date** : 2026-08-02 · **Branche** : `security/admin-authority-hardening`
- **Projet** : Supabase `fknxppuvpdmcfhtfrjcx` · **Sévérité** : 🔴 **CRITIQUE**
- **Statut** : **CONFIRMÉE** (preuve contrôlée, transaction rollback, aucune donnée modifiée)

## Résumé

L'autorité administrateur repose sur une liste d'emails (`site_settings.admin_emails`)
comparée à l'email du JWT par `public.is_admin()`. Or **la table `site_settings` est
modifiable par n'importe quel utilisateur authentifié**. Un acheteur inscrit peut donc
s'ajouter à `admin_emails` et obtenir tous les droits administrateur.

## Les 4 conditions d'exploitabilité — toutes réunies

### 1. Table exposée
`public.site_settings` : schéma `public` (exposé par PostgREST/Data API), RLS activée.
Migration : `supabase/migrations/20260728000002_create_site_settings.sql`.

### 2. Privilèges SQL
Grants sur `public.site_settings` (via `information_schema.role_table_grants`) :
`anon` et `authenticated` possèdent **SELECT, INSERT, UPDATE, DELETE** (grants Supabase par
défaut ; la RLS est censée être la barrière).

### 3. Policies RLS (via `pg_policies`)
| policy | cmd | using / with_check |
|---|---|---|
| `site_settings_authenticated_all` | **ALL** | `auth.role() = 'authenticated'` (USING **et** CHECK) |
| `site_settings_authenticated_select` | SELECT | `auth.role() = 'authenticated'` |

→ La policy **ALL** autorise **tout** utilisateur authentifié à INSERT/UPDATE/DELETE
**n'importe quelle** ligne, y compris `admin_emails`. `authenticated` a le privilège SQL
UPDATE **ET** une policy qui l'autorise → **escalade réellement possible** (pas seulement
théorique).

### 4. Fonction d'autorisation
`public.is_admin()` : `SECURITY DEFINER`, **`search_path` non fixé** (`proconfig = null`),
lit `site_settings.admin_emails` et le compare à `auth.jwt() ->> 'email'`.
Migration : `20260728000003_rls_admin_function.sql`.
Faille secondaire : SECURITY DEFINER sans `search_path` fixe (« search_path mutable »).

## Chemin d'exploitation (reproduit)

Voir `tests/01_exploit_proof.sql` (transaction rollback). Résultat observé :

```
is_admin_before = f          -- l'attaquant n'est pas admin
updated_admin_emails_rows = 1 -- il modifie admin_emails (RLS l'autorise)
is_admin_after = t           -- is_admin() renvoie désormais true pour lui
admin_insert_rows = 1        -- il réussit une écriture réservée aux admins
```
Vérification post-test : `admin_emails` non pollué, 0 ligne de test persistée (rollback OK).

## Impact

Un utilisateur authentifié quelconque peut :
- modifier `site_settings` (contenu du site, mode maintenance…) ;
- s'auto-promouvoir admin puis **créer/modifier/supprimer** produits, catégories, marques,
  fournisseurs ;
- **lire tous les profils acheteurs** (`buyer_profiles_admin_read` utilise `is_admin()`).

## Tables / fonctions concernées

- **Racine du problème** : `public.site_settings` (policy ALL + grants).
- **Fonction** : `public.is_admin()` (email-based, search_path mutable).
- **Policies dépendantes de l'autorité** (9) : `buyer_profiles` (SELECT), `categories`
  (INSERT/UPDATE/DELETE), `products` (INSERT/UPDATE/DELETE), `brands` (ALL), `suppliers` (ALL).

## Storage

**Aucun bucket Supabase Storage** (`storage.buckets` vide) → pas de policy `storage.objects`
dépendant de l'autorité admin. Les images produits sont des URLs externes (Netlify Image CDN).
Rien à corriger côté Storage.

## Frontend

`VITE_ADMIN_EMAILS` (dans `AdminLogin.tsx`, `AdminLayout.tsx`, `Navbar.tsx`) ne servait qu'à
l'affichage de l'Uq admin — **jamais une protection**. La vraie barrière est la RLS.

## Limites de l'analyse

- Preuve réalisée par **simulation rôle + claims JWT dans une transaction rollback sur la
  base de production** (aucun environnement local/staging disponible ; Supabase CLI non
  installé). Aucune donnée persistée, aucun compte réel touché.
- Emails/UUID non divulgués (conformément à la consigne).
