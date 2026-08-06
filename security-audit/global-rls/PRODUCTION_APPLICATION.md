# PRODUCTION_APPLICATION — durcissement RLS global

Migration `migrations/20260805210930_global_rls_hardening.sql` **appliquée en production**
(projet `fknxppuvpdmcfhtfrjcx`) via `execute_sql` (hors `supabase_migrations.schema_migrations`,
comme le fix brands), après la phrase d'approbation exacte
« APPLIQUER LE DURCISSEMENT RLS GLOBAL EN PRODUCTION ».

## Pré-état vérifié (read-only) avant application
```
is_admin_hardened   = 1     (SECURITY DEFINER + search_path figé)
anon_exec_is_admin  = false
policies (7 tables) = 17     (état audité attendu)
```
La précondition transactionnelle (vérifiant is_admin durci + présence exacte des 10 policies
permissives auditées) est passée ; sinon la transaction se serait annulée intégralement.

## Résultat
`COMMIT` sans erreur. Aucune donnée métier modifiée ; aucune fonction ; aucun grant.

## Vérifications post-déploiement (read-only, production réelle)
- **Policies finales** : INSERT public conservé sur `quote_requests`/`collaboration_requests` ;
  SELECT/UPDATE/DELETE de ces tables = `authenticated` admin-only ; `suppliers` = lecture publique
  des actifs + `suppliers_admin_select` + admin insert/update/delete ; catalogue = lecture publique
  + admin write ; `product_lots` = view authenticated conservée + admin write. Plus aucune policy
  `ALL/true` ni `suppliers_admin_write`.
- **anon (simulation rôle, lecture seule)** : `suppliers` ne lève **plus** `42501` (401 corrigé) ;
  `product_pricing_tiers` = 10 031 lignes lues en anon (lecture publique intacte).
  (`suppliers`/`product_images`/`media` sont actuellement vides = 0 ligne — normal.)
- **utilisateur authentifié ordinaire (simulation, email non-admin)** :
  `is_admin() = false` ; `quote_requests` visibles = **0** ; `collaboration_requests` visibles = **0**
  → fuite PII CRITIQUE fermée ; écriture catalogue impossible (policies admin-only).

## Non-régression
- `is_admin()` inchangée (EXECUTE toujours réservé à `authenticated`, anon=false).
- `site_settings` gelé / ancien exploit `admin_emails` non touché.
- Formulaires publics devis/échantillon/collaboration : INSERT public conservé (parcours intact).

## Restant (lots séparés, non inclus)
MEDIUM : M2 `buyer_profiles` (policy admin_read rôle `public` → `authenticated`) ; M3 `REVOKE EXECUTE`
des RPC qualité/admin à `anon` ; M4 `REVOKE` DML anon inutiles. LOW : L1/L2/L3 (cosmétique).
Compte de test ordinaire jetable (lot brands) : suppression manuelle toujours à faire (voir
`PRODUCTION_TEST_ACCOUNT_CLEANUP.md`).
