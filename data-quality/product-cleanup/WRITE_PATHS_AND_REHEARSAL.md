# WRITE_PATHS_AND_REHEARSAL

## 1. Chemins d'écriture `products` — statut
| Chemin | Fichier/fonction | Actif | Peut écrire products | Validateur intégré | Statut | Action |
|---|---|---:|---:|---:|---|---|
| Import JSON admin | `admin/Products.tsx` · `validImportRows`/`handleImportConfirm` | oui | oui (création en masse) | **oui** (`classifyProductScope` par ligne + dry-run) | **ACTIVE_PROTECTED** | — |
| Création/édition manuelle | `admin/Products.tsx` · `handleSubmit` | oui | oui (1 produit) | **oui** (garde + confirm override sur REJECT) | **ACTIVE_PROTECTED** | — |
| Actions groupées (activer/désactiver) | `admin/Products.tsx` · `bulkSetActive` | oui | oui (is_active) | n/a (pas de création) | ACTIVE (non concerné) | — |
| Correctifs data-quality | `admin/DataQuality.tsx` · update patch | oui | oui (champs existants) | non (édition champs, pas de création ; catégorie via sélecteur) | ACTIVE (humain, non-création) | documenté |
| Enrichissement batch (prix/source) | `supabase/scripts/apply_market_prices.py`, `populate_source_fields.py`, … | manuel | oui (UPDATE champs existants) | non (UPDATE non-catégorie ; ne crée pas) | **MANUAL_SQL_ONLY** | dry-run recommandé ; ne peut introduire un produit hors périmètre |
| Scripts d'ingestion legacy | `supabase/scripts/legacy/*.mjs` (apply_*, build_seed, dedup) | non | oui | non | **OBSOLETE** (dossier `legacy/`) | ne pas rejouer |
| Audit catégories | `scripts/audit_product_categories.py` | oui | **non** (lecture seule) | n/a | read-only | — |
| SQL direct / execute_sql | `data-quality/product-cleanup/proposed-sql/*` | manuel | oui | règle SQL équivalente au validateur | **MANUAL_SQL_ONLY** | procédure réservée : exécuter l'audit/validateur AVANT tout INSERT |
| Edge functions / API | `supabase/functions/` | — | — | — | inexistant (aucune) | — |
| Scraper | (externe, hors dépôt) | externe | via export → import JSON (protégé) ou SQL manuel (documenté) | indirect | externe | sa sortie passe par un chemin protégé/documenté |

**Aucun chemin `ACTIVE_UNPROTECTED` restant** : les 2 chemins applicatifs actifs qui créent des produits
(import JSON, création manuelle) appellent `classifyProductScope`. Les scripts batch/SQL sont manuels
(opérateur) et documentés comme devant exécuter le validateur/audit avant écriture ; un SQL manuel direct
ne peut pas être protégé automatiquement.

## 2. Répétition transactionnelle (PostgreSQL 16.4 local, données synthétiques)
Fixture : 114 produits actifs = **set audité exact** (id, category_id du SQL figé) + 17 déjà inactifs
+ `product_images`/`product_pricing_tiers`/`product_lots` (3 produits) + matviews
`category_product_counts`/`brand_product_counts` (index unique) + 1 produit muté pour la dérive.
Aucune donnée de production copiée.

| Scénario | Attendu | Résultat |
|---|---|---|
| **A — succès** | 114 mises à jour, tous `is_active=false`, dépendances conservées, compteurs rafraîchis | ✅ `expected=114 actual=114`, COMMIT ; 0 actif ; images/tarifs/lots = 3/3/3 ; matview rafraîchie |
| **B — nombre incorrect** (expected 113) | exception + rollback intégral, 0 modifié | ✅ `ERROR: Aborted: actual=114 <> expected=113` ; **114 toujours actifs** |
| **C — dérive** (category_id modifié) | produit divergent identifié, exception, 0 persistant | ✅ `ERROR: rows drifted … <id>:…` ; **114 toujours actifs** |
| **D — 2e exécution** | aucune nouvelle modif, contrôlé, aucun partiel | ✅ 1er run 114 ; 2e run `ERROR: rows drifted` (114 déjà inactifs) ; **0 actif, aucun partiel** |
| **E — restauration** | 114 réactivés, pas de duplication, dépendances inchangées, compteurs restaurés | ✅ `reactivated=114`, COMMIT ; **114 actifs**, images/tarifs/lots = 3/3/3, compteurs = 114 |

Conclusion : la transaction figée est **sûre et idempotente** — elle applique exactement les 114 ou
n'applique rien (rollback intégral), ne touche aucune table enfant, et est réversible.
