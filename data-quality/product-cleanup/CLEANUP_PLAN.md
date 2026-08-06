# CLEANUP_PLAN

Aucune donnée de production n'est modifiée avant approbation. Aucune suppression physique.

## Ordre d'exécution (APRÈS approbation uniquement)
1. **Export local avant modification** (traçabilité + réversibilité) — non versionné :
   ```sql
   \copy (
     SELECT p.id, p.name, p.is_active, c.name AS category, b.name AS brand
     FROM public.products p LEFT JOIN public.categories c ON c.id=p.category_id
     LEFT JOIN public.brands b ON b.id=p.marque_id
     WHERE p.is_active = true AND /* règle HIGH — voir proposed-sql */
   ) TO '.local-audit/product-cleanup/deactivated_backup.csv' CSV HEADER;
   ```
2. **Désactivation réversible** des 131 (114 actifs) via `proposed-sql/deactivate_out_of_scope_baby_child.sql`
   (transaction : temp table cible → précondition `expected_active=114` → UPDATE → contrôle 0 restant →
   REFRESH matviews → COMMIT ; rollback intégral si le compte diffère). Appliqué **via execute_sql**,
   jamais par la CLI Supabase.
3. **Vérifs interface** (accueil, catalogue, chaque catégorie affectée, recherche, filtres, fiche produit,
   images, tarifs, compteurs, admin, export) puis contrôles :
   ```text
   active_baby_child_products_remaining = 0
   high_confidence_misclassified_remaining = 0   (n/a — aucune reclassif auto ce lot)
   manual_review_products_unchanged = true
   orphan_product_images = 0
   orphan_pricing_tiers = 0
   orphan_product_lots = 0
   ```
4. **Documenter les résultats** (compte réel basculé, avant/après par catégorie).

## Set figé (IDs immuables) — le SQL de prod ne recalcule aucune règle
- `proposed-sql/deactivate_out_of_scope_baby_child_FROZEN.sql` : **114 IDs actifs explicites**
  (id, category_id) figés depuis l'audit. Précondition **par ligne** : `id = audité AND is_active=true
  AND category_id = audité`. Dérive (supprimé / déjà inactif / catégorie changée) → **ROLLBACK** avec
  la liste des écarts. `expected_rows_to_update = actual_rows_updated = 114`. Les **17 déjà inactifs**
  ne sont pas référencés → aucune modification. Aucune regex/texte en production.
- Sauvegarde : `proposed-sql/backup_before_deactivation.sql` (export local des 131 + comptes
  images/tarifs/lots + IDs actifs). Restauration : `proposed-sql/restore_reactivate_114.sql`
  (réactive uniquement les 114 depuis le CSV des IDs, idempotent, ne touche aucune dépendance).

## Visibilité des produits inactifs — vérifiée (aucune correction de code nécessaire)
Tous les chemins publics filtrent `is_active = true` : Home, Catalog, CategoryPage, BrandPage,
BrandCard, HowItWorks (comptes inclus). `ProductDetail` filtre `is_active=true` **et redirige vers
/catalog** si introuvable. `search_products` : `p_active` défaut `true`. Matview
`category_product_counts` : `WHERE is_active=true` (compteurs excluent les inactifs après REFRESH).
Admin : voit tout (restauration possible). Champ `statut` : informatif admin ; la visibilité publique
est gouvernée par `is_active`. Tests garde-fou : `tests/e2e/public.spec.ts` (redirection fiche non
visible) + invariants documentés.

## Prévention intégrée (pas seulement documentée)
`src/pages/admin/Products.tsx` (import JSON) appelle `classifyProductScope` par ligne :
`REJECT_OUT_OF_SCOPE` et `REVIEW_REQUIRED` sont **exclus de l'insertion** (`validImportRows` = ACCEPT
structurellement valides) ; un **rapport dry-run** (acceptés / rejetés / à revoir + raisons + n° de
ligne) s'affiche dans la modale d'import. Test d'intégration : `tests/e2e/product-scope.spec.ts`
(« import gate : only ACCEPT rows would be written »).

## Réversibilité
- `is_active=false` uniquement ; images/tarifs/lots conservés.
- Réactivation = `UPDATE ... SET is_active=true WHERE id IN (<ids du backup CSV>)` — pas « à l'aveugle »
  par la règle (certains ids étaient déjà inactifs avant).
- Toute suppression physique éventuelle = **lot séparé**, après export complet + validation explicite.

## MANUAL_REVIEW (non corrigé automatiquement)
- 21 bébé « signal faible » + ~56 misclassification (soda↔jus, pâtes↔farine, olives↔huile).
- Fichier `.local-audit/product-cleanup/manual_review_required.csv` à traiter manuellement (admin
  Produits : actions groupées Désactiver / Reclassifier déjà disponibles).

## Prévention (cause racine — fusionnable indépendamment)
- Validateur central `src/lib/productScope.ts` (`classifyProductScope` → ACCEPT / RECLASSIFY /
  REJECT_OUT_OF_SCOPE / REVIEW_REQUIRED) + `dryRunScope()` pour un rapport avant import.
- À brancher sur **tous** les chemins d'entrée produit (imports JSON de `admin/Products.tsx`,
  scripts d'import, upserts Supabase) : refuser les REJECT, ne jamais insérer les REVIEW, journaliser
  la raison. Voir « Intégration » ci-dessous.
- Tests : `tests/e2e/product-scope.spec.ts` (rejets bébé, faux positifs conservés, ambigus → REVIEW,
  catégorie non autorisée, Hygiene non fourre-tout).

## Chemins d'import — validation branchée
| Chemin | Fichier | Fonction | Validation appelée | Comportement |
|---|---|---|---|---|
| Import JSON admin | `src/pages/admin/Products.tsx` | `validImportRows` / `importDryRun` / `handleImportConfirm` | `classifyProductScope` par ligne | **BRANCHÉ** : REJECT & REVIEW exclus de l'insert ; ACCEPT seuls insérés ; rapport dry-run affiché |
| Upsert admin (édition manuelle) | `src/pages/admin/Products.tsx` | `handleSubmit` | — | catégorie contrainte par le sélecteur (32 autorisées) ; ajout futur possible de `classifyProductScope` sur name/description |
| Scripts d'ingestion / scraping | `scripts/` (hors app, non versionné) | divers | à importer depuis `src/lib/productScope.ts` OU règle SQL équivalente | à brancher lors de la prochaine campagne d'import (règle SQL disponible dans `proposed-sql`) |
| Chemin purement SQL | `proposed-sql/*` | clause `WHERE` regex | règle identique au validateur | pour un import direct en base, filtrer via la même règle |

Comportements : `REJECT_OUT_OF_SCOPE` → aucune écriture ; `REVIEW_REQUIRED` → aucune écriture auto,
listé dans le dry-run ; `ACCEPT` → import normal ; `RECLASSIFY` → seulement si catégorie proposée
autorisée + confiance élevée (non déclenché automatiquement dans l'UI actuelle).
