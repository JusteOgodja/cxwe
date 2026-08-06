# Lot restant — matrices & constats (MEDIUM/LOW + 1 HIGH reclassé)

## 1. buyer_profiles — règles métier (frontend)
Usages réels : `SignUp.tsx` insère le profil (`user_id = auth.user.id`) ; `AuthContext.fetchProfile`
lit `.eq('user_id', userId)` ; `admin/Buyers|Dashboard|Analytics` lisent l'ensemble. Pas d'UPDATE/
DELETE côté frontend. Colonne de propriété : **`user_id`** présente.

| | Anon | Utilisateur propriétaire | Autre utilisateur | Admin |
|---|---|---|---|---|
| **attendu** | aucun accès | lecture + insert + maj de SA ligne (`user_id=auth.uid()`) | aucun accès | lecture globale |
| **avant** | 🟥 SELECT = 401 (policy `admin_read` **TO public** appelant `is_admin()`) ; policies dupliquées | ✅ (owner) | ✅ isolé (owner) | ✅ (mais via policy public) |
| **après** | ✅ aucun accès (policies `TO authenticated` ; grant SELECT anon retiré) | ✅ owner (+ WITH CHECK sur UPDATE) | ✅ isolé | ✅ `admin_read` **TO authenticated** |

Correctifs : suppression des doublons (`Buyers can insert/read…` vs `buyer_profiles_*`) ;
`buyer_profiles_admin_read` recréée `TO authenticated` ; policies owner resserrées `TO authenticated`
avec `WITH CHECK (user_id = auth.uid())` sur l'UPDATE (empêche la réattribution de `user_id`).
Les policies propriétaire existantes ne sont pas supprimées dans leur intention — seulement
consolidées et limitées à `authenticated`.

## 2. RPC — matrice de sécurité (production)
| RPC | Signature | DEFINER/INVOKER | search_path (après) | EXEC avant | EXEC après | Appel frontend | Contrôle is_admin | Données sensibles |
|---|---|---|---|---|---|---|---|---|
| is_admin | () | **DEFINER** | `""` (inchangé) | anon:✗ auth:✓ | idem | AdminLayout/Login/Navbar | — (c'est le contrôle) | lit site_settings |
| get_quality_stats | () | INVOKER | `public,pg_temp` | anon:✓ auth:✓ | **anon:✗** auth:✓ | admin/DataQuality, Dashboard | non (INVOKER→RLS) | agrégats produits (public) |
| get_products_with_issues | (integer) | INVOKER | `public,pg_temp` | anon:✓ | **anon:✗** auth:✓ | admin/DataQuality | non | produits (public) |
| count_brands_no_active_products | () | INVOKER | `public,pg_temp` | anon:✓ | **anon:✗** auth:✓ | (non appelée) | non | comptage (public) |
| count_categories_no_active_products | () | INVOKER | `public,pg_temp` | anon:✓ | **anon:✗** auth:✓ | (non appelée) | non | comptage (public) |
| search_products | (text,uuid,uuid,bool,int,int) | INVOKER | `public,pg_temp` | anon:✓ | **anon:✗** auth:✓ | admin/Products (le catalogue public utilise des requêtes directes) | non | produits (public) |
| list_source_sites | () | INVOKER | `public,pg_temp` | anon:✓ | **anon:✗** auth:✓ | admin/Sources | non | source_url produits |
| **refresh_product_counts** | () | INVOKER (RETURNS **trigger**) | `public,pg_temp` | anon:✓ auth:✓ | **anon:✗ auth:✗ public:✗** | (aucun — fonction trigger) | non | REFRESH MATERIALIZED VIEW (effet de bord) |

**HIGH reclassé** : `refresh_product_counts` — fonction TRIGGER à effet de bord (REFRESH
MATERIALIZED VIEW CONCURRENTLY) était exécutable par tout `authenticated` sans contrôle d'admin.
En pratique PostgREST **refuse** d'exposer les fonctions `RETURNS trigger` en RPC (`PGRST202`),
donc l'exploitation directe était déjà impossible ; par défense en profondeur, EXECUTE est retiré
à `anon`, `authenticated` et `public` (le déclencheur reste fonctionnel — les triggers n'ont pas
besoin du privilège EXECUTE). Aucune RPC administrative n'expose de données sensibles ou
inter-utilisateurs (toutes les données lues — produits/catégories — sont déjà publiques) ; les
autres écarts sont donc de **moindre privilège** (retrait d'anon).

## 3. Grants anon — whitelist
Opérations publiques réellement utilisées par le frontend :
- **SELECT** (lecture catalogue publique) : `products, categories, brands, suppliers,
  product_pricing_tiers, product_images, media`.
- **INSERT** (formulaires publics) : `quote_requests`, `collaboration_requests`.

| Table | anon avant | anon après |
|---|---|---|
| products, categories, brands, suppliers, product_pricing_tiers, product_images, media | tout le DML | **SELECT seul** |
| product_lots | tout le DML | **aucun** (lecture `authenticated` seulement) |
| buyer_profiles | tout le DML | **aucun** (privé) |
| quote_requests, collaboration_requests | tout le DML | **INSERT seul** (formulaire) |

Révoqués partout pour anon : `INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` (puis re-GRANT
`INSERT` sur les deux tables de demandes). Vérifié : aucune opération frontend anon ne dépend d'un
privilège retiré (les INSERT publics de formulaires utilisent `return=minimal`, pas de SELECT).

## 4. Constats LOW traités (sans changement métier/donnée/interface)
- **L1** — buyer_profiles : policies dupliquées supprimées.
- **L2** — `categories`/`products` : policies d'écriture admin `TO public` → `TO authenticated`.
- **L3** — `search_path` fixe (`public, pg_temp`) ajouté aux 7 RPC applicatives INVOKER.

## 5. Reporté (nécessite changement de données ou de modèle) — NON traité
- Espace acheteur « mes demandes » (ownership sur quote/collaboration) → nécessiterait une colonne
  `buyer_id uuid` + backfill → **modèle UUID / donnée**, hors périmètre.
- Réconciliation de l'historique des migrations (divergence 6 remote / 15 local) → non touchée.
