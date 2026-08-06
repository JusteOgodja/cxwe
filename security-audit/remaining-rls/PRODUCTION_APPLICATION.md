# PRODUCTION_APPLICATION — lot restant (MEDIUM/LOW + HIGH reclassé)

Migration `migrations/20260806120000_remaining_rls_hardening.sql` **appliquée en production**
(projet `fknxppuvpdmcfhtfrjcx`) via `execute_sql`, après la phrase d'approbation
« APPLIQUER LE DURCISSEMENT RLS RESTANT EN PRODUCTION ».

## Pré-état vérifié (read-only)
```
is_admin durci                         = oui
buyer_profiles policies attendues      = 6/6 (état pré-lot)
grants anon larges présents            = oui (anon UPDATE products = true)
anon peut exécuter get_quality_stats   = true (avant)
anon peut exécuter search_products     = true (avant)
```
Précondition transactionnelle passée ; sinon rollback intégral.

## Résultat
`COMMIT` sans erreur. Aucune donnée modifiée ; aucun modèle UUID ; aucun historique de migration touché.

## Vérifications post-déploiement (production réelle)
- **buyer_profiles** : 4 policies, toutes `TO authenticated` — `buyer_profiles_admin_read` (SELECT),
  `_insert_own` (INSERT), `_select_own` (SELECT), `_update_own` (UPDATE). Doublons supprimés ;
  `admin_read` n'est plus `TO public` (fin de l'anti-pattern anon-401).
- **RPC** : `get_quality_stats`, `search_products`, `list_source_sites` (+ get_products_with_issues,
  count_*) → `anon=false`, `authenticated=true`, `search_path=public,pg_temp`.
  `refresh_product_counts` → `anon=false`, `authenticated=false`, `search_path` fixe.
- **grants anon** : `quote_requests`/`collaboration_requests` = `INSERT` seul ; `products`/`suppliers`
  (+ categories/brands/pricing/images/media) = `SELECT` ; `buyer_profiles`/`product_lots` = aucun.
- **Smoke test** : accueil + catalogue (31 catégories, marques) se rendent, **aucune erreur console** ;
  lectures publiques intactes après révocation des grants anon.

## Non-régression
- `is_admin()` inchangée ; `site_settings` gelé (non touché) ; brands (PR #10) intact ;
  durcissement RLS global (PR #11) intact.
- Formulaires publics devis/collaboration : `INSERT` anon conservé.

## Restant / reporté
- Espace acheteur « mes demandes » (ownership quote/collaboration → colonne + backfill = modèle/donnée).
- Réconciliation de l'historique des migrations (divergence remote/local).
- Compte de test ordinaire jetable (lot brands) : suppression manuelle toujours à faire
  (voir `../global-rls/PRODUCTION_TEST_ACCOUNT_CLEANUP.md`).
