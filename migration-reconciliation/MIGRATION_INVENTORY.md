# MIGRATION_INVENTORY — migrations locales `supabase/migrations/`

Audit **lecture seule**. Empreintes SHA-256 **canoniques LF**. Aucune modification de la base.
Ordre lexicographique des fichiers (= ordre d'application par la CLI Supabase).

| # | Timestamp / fichier | SHA-256 (LF, court) | Objets créés / modifiés | Tables | Fonctions | Policies | Index | Grants | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `20260525011107_create_catalog_schema` | `d8d1754…` | tables + RLS + policies + idx | categories, products, quote_requests | — | 13 (view/insert/update/delete par table) | products_category_id_idx | — | aucune (fondation) |
| 2 | `20260525022213_update_product_schema_comprehensive` | `4d80572…` | tables + colonnes products + idx | brands, suppliers, media, product_pricing_tiers, product_lots | — | 10 | 8 (marque/fournisseur/ean/statut/is_new/is_promo/pricing/lots) | — | products, media (FK) |
| 3 | `20260525_create_collaboration_requests` | `fc043eb…` | table + policies + idx | collaboration_requests | — | 2 | collab_status_idx, collab_created_idx | — | aucune ⚠️ nom sans timestamp 14 chiffres |
| 4 | `20260525_update_quote_requests_comprehensive` | `9177b2c…` | colonnes quote_requests + idx | quote_requests (ALTER) | — | — | quote_requests_status_idx, _created_at_idx | — | quote_requests (#1) ⚠️ nom sans timestamp |
| 5 | `20260529000000_add_hs_code_index` | `259bf78…` | index | products (idx) | — | — | products_hs_code_idx | — | products.hs_code (#2) |
| 6 | `20260727000000_benchmark_improvements` | `5219523…` | colonnes + table + idx + policies | product_images ; products/suppliers (ALTER) | — | 2 (⚠️ `CREATE POLICY IF NOT EXISTS`) | product_images_*, products_certifications_idx (GIN), _pays_origine_idx, _dluo_idx, _commande_min_idx | — | products, suppliers |
| 7 | `20260728000001_create_buyer_profiles` | `1ac63a7…` | table + policies | buyer_profiles | — | 3 (insert_own, select_own, admin_select) | — | — | auth.users |
| 8 | `20260728000002_create_site_settings` | `2d4cd12…` | table + policies | site_settings | — | 2 (authenticated_select, **authenticated_all** ⚠️ vulnérable) | — | — | — |
| 9 | `20260728000003_rls_admin_function` | `1222d01…` | fonction + policies | — | **is_admin()** (version ILIKE d'origine) | drop anciennes + admin policies (categories/products/brands/suppliers/buyer_profiles) | — | — | site_settings (#8), tables #1/#2/#7 |
| 10 | `20260729000001_add_source_and_market_columns` | `1eecb35…` | colonnes products + idx | products (ALTER) | — | — | products_source_site_idx, _fmcg_segment_idx, _prix_marche_idx | — | products (#2) |
| 11 | `20260731000001_add_prix_marche_source` | `e157afe…` | colonne | products (ALTER, IF NOT EXISTS) | — | — | — | — | products (#2) |
| 12 | `20260731000002_search_products_return_full_columns` | `b60941b…` | fonction (DROP+CREATE) | — | **search_products(...)** v1 | — | — | EXECUTE → anon, authenticated | products + colonnes #2/#10 |
| 13 | `20260801000001_search_products_add_price_fields` | `52efc33…` | fonction (DROP+CREATE) | — | **search_products(...)** v2 (remplace #12) | — | — | EXECUTE → anon, authenticated | #12 |
| 14 | `20260801000002_list_source_sites` | `63d1059…` | fonction | — | **list_source_sites()** v1 | — | — | EXECUTE → anon, authenticated | products.source_site (#10) |
| 15 | `20260803000000_deactivate_requested_source_sites` | `82c5487…` | fonction (DROP+CREATE) + updates data | — | **list_source_sites()** v2 (remplace #14) | — | — | EXECUTE → anon, authenticated | #14 |

**SHA-256 LF complets**
```
d8d1754228ed915941ddf4ef8454582908b52118642d80e81d7abdc631b45574  20260525011107_create_catalog_schema.sql
4d805721bbda2c58b2a145d9b4774103be8a6dd047cbd5bc1b83f4fa43b0d189  20260525022213_update_product_schema_comprehensive.sql
fc043eb9a5e3ce1c852b9ba9b438b3b5accd3124913f7153f831b0e73a211665  20260525_create_collaboration_requests.sql
9177b2ca525aec66ef2e7e2ec11e7e51186baa984b595e4b1e89a301ebc07f10  20260525_update_quote_requests_comprehensive.sql
259bf78f49955604a9c568d7b287164041753686febd893e8c8e70624f72a50f  20260529000000_add_hs_code_index.sql
5219523e46e0499b9bf2abd05878c0487a12e3d32ca79103206dddc526610f13  20260727000000_benchmark_improvements.sql
1ac63a75f06f3a697396bb31cb8b9bce60a992d464bb94bb12f9c6204bb96ee8  20260728000001_create_buyer_profiles.sql
2d4cd126c31507223b999da6ffc15ee40ec5076aac71588a60f3679608ecdd6a  20260728000002_create_site_settings.sql
1222d0138098db3fdd6dcf94a75a12b4c84fa2995a1419bc10134d39f172d4a3  20260728000003_rls_admin_function.sql
1eecb35c0eba238a379380e29c1ce41de64ff57d297506fc33e9cc728f758515  20260729000001_add_source_and_market_columns.sql
e157afe833b69c36ab9d01c1f744ed76ae36ac1f1924a995d14e8a37c4ff0294  20260731000001_add_prix_marche_source.sql
b60941b20361de21d2fb2478013c2d6b95c8a82c0bfb38c1fcdf2c10d89ce3ca  20260731000002_search_products_return_full_columns.sql
52efc33673ea6c14b85f5b53aa2dc6518019f1ed001d4b9ac1794611c2e1636f  20260801000001_search_products_add_price_fields.sql
63d1059c42e762e26e239999264382fc6e2b1966c3067513e9d10fd9de3e6ec9  20260801000002_list_source_sites.sql
82c54877f6c5bfbd500b019997eba999c6ec0123598ea2711ebea02d33990bd3  20260803000000_deactivate_requested_source_sites.sql
```

**Note** : les deux scripts de sécurité (`20260804090250`, `20260804151606`) NE figurent plus
ici — ils sont archivés hors `supabase/migrations/` (voir SCHEMA_COMPARISON § scripts manuels).
