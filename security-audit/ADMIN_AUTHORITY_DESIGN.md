# Design — Autorité administrateur privée par UUID

## Ancien modèle (vulnérable)

```
Frontend (VITE_ADMIN_EMAILS)  ── UI seulement
public.is_admin()  ── lit ──▶  public.site_settings['admin_emails']  (compare à JWT email)
                                        ▲
                                        └── écriture ouverte à tout `authenticated`  ❌
```
Problème : la **racine d'autorité** (liste d'emails) est stockée dans une table modifiable
par les utilisateurs qu'elle est censée exclure.

## Nouveau modèle (UUID, schéma scellé)

```
auth.users.id (UUID)
        │
        ▼
app_private.administrators(user_id uuid PK)      ← schéma NON exposé, aucune policy,
        ▲                                           aucun grant anon/authenticated
        │ lit (en tant que propriétaire)
app_private.is_admin()   SECURITY DEFINER, search_path=''      ← scellée
        ▲
        │ délègue
public.is_admin()  SECURITY DEFINER, search_path=''   → utilisée par les policies RLS
public.current_user_is_admin()  SECURITY DEFINER      → RPC booléenne pour l'UI (anon+auth)
```

### Décisions de sécurité

1. **Autorité fondée sur `auth.uid()` (UUID)**, jamais sur l'email (immuable, non falsifiable
   côté client, non modifiable par l'utilisateur).
2. **Schéma `app_private` scellé** : `REVOKE ALL` pour `PUBLIC/anon/authenticated`, **non
   ajouté aux Exposed schemas** PostgREST → inaccessible via l'API REST.
3. **Table `administrators` sans policy et sans grant** → aucun accès direct via l'API. Seul
   le `service_role` (clé serveur) ou du SQL privilégié peut y écrire.
4. **Pont par wrapper `SECURITY DEFINER`** : les policies appellent `public.is_admin()` (qui
   s'exécute en tant que propriétaire et franchit le schéma scellé). Ainsi `authenticated`
   n'a **jamais** besoin d'accès à `app_private`.
5. **Toutes les fonctions d'autorité** : `SECURITY DEFINER` + `SET search_path = ''` + objets
   **entièrement qualifiés** (`app_private.administrators`, `auth.uid()`), `EXECUTE` restreint.
6. **Pas de dépendance circulaire** : la protection de `site_settings` passe désormais par
   `app_private.administrators` (indépendant de `site_settings`).
7. **`current_user_is_admin()`** ne renvoie qu'un **booléen** (aucun email, aucun UUID, aucune
   liste) et n'accepte aucun paramètre.

### Privilèges (récapitulatif cible)

| Objet | anon | authenticated | service_role / owner |
|---|---|---|---|
| schéma `app_private` | — | — | USAGE (owner) |
| `app_private.administrators` | — | — | accès (owner / service_role bypass RLS) |
| `app_private.is_admin()` | — | — | EXECUTE (owner) |
| `public.is_admin()` | — | EXECUTE | EXECUTE |
| `public.current_user_is_admin()` | EXECUTE | EXECUTE | EXECUTE |
| `public.site_settings` (après B) | — | **SELECT/écriture : admin only (RLS)** | bypass |

### Policies (après bascule)
Toutes les policies admin (`products`, `categories`, `brands`, `suppliers`, `buyer_profiles`,
`site_settings`) utilisent la forme `(SELECT public.is_admin())`.

### Migrations
- `20260802000001_create_private_admin_authority.sql` — modèle privé (additif, phase A).
- `20260802000002_switch_admin_policies.sql` — bascule des 9 policies + confinement
  `site_settings` + neutralisation de `public.is_admin()` (phase B, après bootstrap).
- `20260802000003_remove_legacy_admin_emails.sql` — suppression de `admin_emails` (phase B).

### Frontend
`AdminLogin`, `AdminLayout`, `Navbar` utilisent désormais la RPC
`current_user_is_admin()` (fail-closed) au lieu de `VITE_ADMIN_EMAILS`. La variable
d'environnement n'est plus une source d'autorité (elle peut être retirée ultérieurement).
