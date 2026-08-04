# REMOTE_HISTORY — `supabase_migrations.schema_migrations` (production)

Récupéré en **lecture seule** via l'outil MCP `list_migrations` (aucune modification ; aucun
`execute_sql`). Aucune ligne n'a été modifiée.

| Ordre | Version (timestamp) | Nom | Contrepartie locale probable (par nom) |
|---|---|---|---|
| 1 | `20260716145227` | `enrich_products_columns` | **AUCUNE** (aucun fichier local de ce nom) — voir note |
| 2 | `20260727223938` | `benchmark_improvements` | `20260727000000_benchmark_improvements` |
| 3 | `20260729093955` | `add_source_and_market_columns` | `20260729000001_add_source_and_market_columns` |
| 4 | `20260731223810` | `search_products_return_full_columns` | `20260731000002_search_products_return_full_columns` |
| 5 | `20260731232809` | `search_products_add_price_fields` | `20260801000001_search_products_add_price_fields` |
| 6 | `20260801000011` | `list_source_sites` | `20260801000002_list_source_sites` |

**Total versions distantes : 6.** (Total fichiers locaux : 15.)

## Observations

- **Aucune version distante ne partage un timestamp identique avec un fichier local** → il n'existe
  **aucun EXACT_MATCH** par version.
- Les 5 dernières versions distantes correspondent par **nom** à 5 fichiers locaux, mais sous des
  **timestamps différents** (ex. distant `20260727223938` vs local `20260727000000`). Divergence
  confirmée.
- `enrich_products_columns` (`20260716145227`, la plus ancienne) **n'a aucun fichier local**. Cette
  version distante a probablement enregistré une partie du travail de schéma produits qui, côté
  local, est réparti dans `20260525022213_update_product_schema_comprehensive` et/ou
  `20260727000000_benchmark_improvements`. Non prouvable sans inspection SQL (différée au staging).
- **9 migrations locales fondatrices** (création des tables `categories`, `products`,
  `quote_requests`, `brands`, `suppliers`, `media`, `product_pricing_tiers`, `product_lots`,
  `collaboration_requests`, `buyer_profiles`, `site_settings`, la fonction `is_admin`, l'index
  hs_code, `prix_marche_source`) **n'ont AUCUNE ligne dans l'historique distant**, alors que les
  objets correspondants **existent en production** (voir SCHEMA_COMPARISON). → l'historique distant
  est **incomplet** par rapport au schéma réel : ce sont des changements **appliqués mais non
  enregistrés** dans `schema_migrations`.
- Les deux scripts de sécurité (`20260804090250`, `20260804151606`) sont **absents** de
  `schema_migrations` (appliqués manuellement via `execute_sql`).
