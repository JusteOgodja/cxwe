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

## Intégration prévention (chemins d'import identifiés)
- `src/pages/admin/Products.tsx` → `handleFileChange`/import JSON : appeler `dryRunScope(rows)` avant
  `insert`, afficher le rapport dry-run, n'insérer que les `ACCEPT`.
- Scripts d'ingestion (`scripts/`, hors app) : importer le même validateur (logique dupliquée en SQL
  dans `proposed-sql` pour les chemins purement SQL).
- Aucun produit `REJECT_OUT_OF_SCOPE` ni `REVIEW_REQUIRED` ne doit être inséré automatiquement.
