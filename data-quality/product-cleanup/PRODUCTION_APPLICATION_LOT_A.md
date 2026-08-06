# PRODUCTION_APPLICATION — Lot A (désactivation bébé/enfant hors périmètre)

Appliqué en production (`fknxppuvpdmcfhtfrjcx`) via `execute_sql`, après la phrase
« APPLIQUER LA DÉSACTIVATION DES 114 PRODUITS HORS PÉRIMÈTRE EN PRODUCTION ».
Set **figé** (IDs explicites), aucune règle textuelle dans la mutation, réversible.

## Vérification pré-mutation (read-only)
```
audited_total = 131 ; already_inactive = 17 ; expected_active_to_update = 114
unique_ids = 114 ; exist = 114 ; actual_matching_active = 114 ; drifted_products = 0
```

## Sauvegarde
Export local non versionné avant modification (114 actifs + 17 inactifs + dépendances) :
`.local-audit/product-cleanup/deactivation_backup_snapshot.csv`. Dépendances constatées :
`n_images=0`, `n_lots=0`, `n_tiers≈1` par produit.

## Mutation
Transaction unique : `_audited` (114 id, category_id) → précondition (114 + zéro dérive) →
`UPDATE products SET is_active=false` (par ligne : id + is_active=true + category_id audité) →
`GET DIAGNOSTICS = 114` → REFRESH matviews → COMMIT. **`actual_rows_updated = 114`.**
`statut` non modifié ; aucune suppression ; tables enfants non touchées ; 17 déjà inactifs ignorés.

## Vérification post-mutation
```
total_products = 12 433 (inchangé — aucune suppression)
active_products = 4 464 (= 4 578 − 114)
active_baby_child_products_remaining = 0
orphan_product_images = 0 ; orphan_pricing_tiers = 0 ; orphan_product_lots = 0
```
Interface production : catalogue (31 catégories) se rend, aucune erreur console.

## Réversibilité
`proposed-sql/restore_reactivate_114.sql` (réactive les 114 depuis l'export d'IDs, idempotent,
ne touche aucune dépendance). Répétition A–E validée sur PostgreSQL local (voir
WRITE_PATHS_AND_REHEARSAL.md).

## Hors périmètre de ce lot (Lot B ultérieur)
Reclassification des catégories : 12 confirmés + 5 probables + 10 non résolus + ~33 légitimes.
Le Lot A ne résout PAS la mauvaise classification. Aucune suppression physique effectuée.
