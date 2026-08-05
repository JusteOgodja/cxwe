# REMEDIATION_PLAN

## Migration proposée (CRITICAL + HIGH + M1)
`migrations/20260805210930_global_rls_hardening.sql` — transactionnelle, à préconditions exactes
(annulation intégrale si l'état réel diffère de l'état audité), **aucune donnée / fonction / grant
modifiés**. Application prévue **via `execute_sql`** (hors historique), **après validation**.

Principe par table : supprimer les policies permissives (`ALL/true`, `FOR ALL TO public is_admin()`),
**conserver la lecture publique voulue**, ajouter des policies **admin par commande**
(`TO authenticated`, `is_admin()`).

| Table | Supprimé | Ajouté | Lecture conservée |
|---|---|---|---|
| quote_requests (C1) | Auth view/update/delete (true) | admin select/update/delete (is_admin) | INSERT public (formulaire) |
| collaboration_requests (H1) | Auth manage (ALL true) | admin select/update/delete | INSERT public (formulaire) |
| suppliers (H2) | Auth manage (ALL true) + suppliers_admin_write (ALL public) | admin select/insert/update/delete | `Anyone can view active suppliers` |
| product_pricing_tiers (H3) | Auth manage pricing (ALL true) | admin insert/update/delete | `Anyone can view product pricing` |
| product_images (H4) | Auth manage images (ALL true) | admin insert/update/delete | `Anyone can view product images` |
| product_lots (H5) | Auth manage lots (ALL true) | admin insert/update/delete | `Auth can view lots` (inchangée) |
| media (M1) | Auth insert media (true) | admin insert/update/delete | `Anyone can view media` |

**Effets attendus** : `suppliers` redevient lisible en anonyme (plus de 401) ; aucune écriture par un
utilisateur ordinaire sur ces tables ; `quote_requests`/`collaboration_requests` deviennent
**admin-only** en lecture (fin de la fuite PII) ; administration inchangée (is_admin).

## À traiter séparément (MEDIUM / LOW — non inclus dans cette migration)
- **M2** — `buyer_profiles` : recréer `buyer_profiles_admin_read` en rôle `authenticated` (au lieu de
  `public`) ; supprimer les policies dupliquées (`Buyers can…` vs `buyer_profiles_*`). Petit lot
  dédié (nécessite de vérifier l'usage exact côté /signup et admin/buyers).
- **M3** — `REVOKE EXECUTE ON FUNCTION get_quality_stats(), get_products_with_issues(int),
  count_brands_no_active_products(), count_categories_no_active_products(), refresh_product_counts()
  FROM anon;` (moindre privilège ; garder `authenticated`). Migration de grants séparée.
- **M4** — envisager `REVOKE INSERT/UPDATE/DELETE/TRUNCATE ON <tables> FROM anon` (défense en
  profondeur ; la RLS bloque déjà). À évaluer table par table (garder INSERT public sur
  quote/collaboration).
- **L1/L2/L3** — nettoyage cosmétique (policies dupliquées, rôle des policies admin
  categories/products, `search_path` figé sur search RPC).

## Ordre d'application recommandé (après validation)
1. Exécuter le test rollback (`tests/`) sur **pile locale/staging** (Docker requis).
2. Appliquer `20260805210930_global_rls_hardening.sql` via `execute_sql` (précondition = garde-fou).
3. Contrôles post-déploiement : anon suppliers=200 ; ordinaire ne lit pas quotes/collaboration et
   n'écrit pas ; admin gère ; ancien exploit admin_emails toujours bloqué ; catalogue OK.
4. Traiter M2/M3 dans des lots suivants.

## Contraintes respectées
Policies explicites par commande · moindre privilège · admin via `is_admin()` · **aucun EXECUTE
is_admin pour anon** · aucun service_role frontend · aucune donnée modifiée · préconditions exactes ·
transaction complète avec rollback automatique si l'état diffère.
