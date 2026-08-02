# Tests — Autorité administrateur

Tous les tests s'exécutent dans une **transaction qui se termine par `RAISE EXCEPTION`**
(rollback garanti) : aucune donnée persistée, aucun compte réel modifié. Scripts :
`tests/01_exploit_proof.sql` (avant), `tests/02_fix_proof.sql` (après).

## A. Preuve de la vulnérabilité (modèle actuel) — `01_exploit_proof.sql`

| Scénario | Rôle | Action | Attendu | Obtenu | Preuve |
|---|---|---|---|---|---|
| Escalade | authenticated (email non-admin) | is_admin() initial | false | **f** | ✅ |
| Escalade | authenticated | UPDATE site_settings.admin_emails | (ne devrait PAS être permis) | **1 ligne** | 🔴 |
| Escalade | authenticated | is_admin() après | (ne devrait PAS) true | **t** | 🔴 |
| Escalade | authenticated | INSERT categories (admin only) | (ne devrait PAS) réussir | **1 ligne** | 🔴 |

→ Vulnérabilité **confirmée**.

## B. Validation du correctif (nouveau modèle) — `02_fix_proof.sql`

| Scénario | Rôle | Action | Attendu | Obtenu |
|---|---|---|---|---|
| Utilisateur ordinaire | authenticated | is_admin() | false | **user.is_admin=f** ✅ |
| Utilisateur ordinaire | authenticated | INSERT app_private.administrators (self-promote) | bloqué | **blocked** ✅ |
| Utilisateur ordinaire | authenticated | SELECT app_private.administrators | bloqué | **blocked** ✅ |
| Utilisateur ordinaire | authenticated | écriture admin-only (RLS) | bloqué | **blocked** ✅ |
| Administrateur | authenticated (bootstrappé) | is_admin() | true | **admin.is_admin=t** ✅ |
| Administrateur | authenticated | écriture admin-only | réussit | **1 ligne** ✅ |
| Anonyme | anon | appel wrapper d'autorité | refusé/false | **EXEC_DENIED(ok)** ✅ |
| Edge : `auth.uid()` nul | authenticated (sans sub) | is_admin() | false | **nulluid.is_admin=f** ✅ |

→ Un utilisateur ordinaire **ne peut pas** devenir administrateur. L'administrateur légitime
fonctionne.

## C. Cas supplémentaires à couvrir lors du déploiement réel (staging/prod)

Ces cas nécessitent des comptes réels et seront validés au déploiement (voir DEPLOYMENT) :
- JWT expiré → `auth.uid()` nul → non-admin (couvert par le cas « uid nul »).
- Utilisateur supprimé (`ON DELETE CASCADE` retire l'entrée admin automatiquement).
- Administrateur retiré de `app_private.administrators` → perd immédiatement l'accès.
- Deuxième administrateur → fonctionne (table multi-lignes).
- Tentative d'utiliser l'UUID d'un autre utilisateur → impossible : la fonction n'accepte
  aucun paramètre et lit uniquement `auth.uid()`.
- Appels RPC directs depuis le client → protégés par la RLS (les RPC métier sont
  `SECURITY INVOKER`).

## D. Non-régression frontend
`npm run typecheck` (0 nouvelle erreur — 3 erreurs pré-existantes non liées : `Products.tsx`
CheckSquare, `BrandPage.tsx` useMemo, `CategoryPage.tsx` changeBrand), `npm run lint`
(0 nouveau warning sur les fichiers modifiés), `npm run build` ✅.
Pas de script `npm test` dans le dépôt (inexistant). Supabase CLI non installé → tests SQL
exécutés via simulation rollback sur la base (limitation documentée).
