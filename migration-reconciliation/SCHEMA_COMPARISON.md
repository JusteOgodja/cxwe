# SCHEMA_COMPARISON — schéma réel de production vs migrations locales

**Lecture seule.** Sources : outil MCP `list_tables` (tables/RLS), `list_migrations` (historique),
et preuves de schéma **déjà capturées cette session** pour `site_settings` (policies, grants,
`is_admin()`, triggers). **Aucun `execute_sql` n'a été utilisé dans cette étape.** La vérification
fine colonne‑par‑colonne / policy‑par‑policy des objets non‑`site_settings` nécessite un inventaire
SQL en lecture seule qui est **délibérément reporté au staging** (voir STAGING_REHEARSAL_PLAN).
Aucune donnée métier ni personnelle n'a été lue.

## 4. État réel de production (objets concernés par les migrations locales)

### Tables (via `list_tables`, schéma `public`) — RLS activée partout
| Table | RLS | Lignes | Migration locale d'origine |
|---|---|---|---|
| categories | ✅ | 0 | #1 |
| products | ✅ | 13 433 | #1 (+ colonnes #2/#6/#10/#11) |
| quote_requests | ✅ | 0 | #1 (+ colonnes #4) |
| brands | ✅ | 0 | #2 |
| suppliers | ✅ | 0 | #2 (+ colonnes #6) |
| media | ✅ | 0 | #2 |
| product_pricing_tiers | ✅ | 10 500 | #2 |
| product_lots | ✅ | 0 | #2 |
| collaboration_requests | ✅ | 0 | #3 |
| buyer_profiles | ✅ | 0 | #7 |
| site_settings | ✅ | 18 | #8 |
| product_images | ✅ | 0 | #6 |

→ **Les 12 tables des migrations locales existent en production.** (Colonnes/contraintes/types :
non ré‑inventoriés en SQL ici — reportés au staging.)

### `site_settings` — état réel détaillé (capturé cette session, non sensible)
- **Policies réelles** : `site_settings_admin_select` [SELECT], `site_settings_admin_insert`
  [INSERT, `WITH CHECK is_admin() AND key<>'admin_emails'`], `site_settings_admin_update` [UPDATE,
  `USING`+`WITH CHECK is_admin() AND key<>'admin_emails'`]. **Aucune policy DELETE.**
- **Policy `site_settings_authenticated_all` (vulnérable, migration #8) : ABSENTE.**
- **Grants** : `authenticated` = SELECT,INSERT,UPDATE ; `anon` = aucun.
- **`public.is_admin()`** : `STABLE SECURITY DEFINER SET search_path=''`, comparaison d'email
  exacte (version **durcie** du hotfix, **≠** la version ILIKE de la migration #9).
- **Triggers sur `site_settings`** : 0. **Fonctions écrivant `site_settings`** : 0 (seule
  `is_admin()` la référence, en lecture).

## 5. Correspondance migration par migration

Règle appliquée : « appliquée » n'est **jamais** conclu du seul fait qu'un objet homonyme existe ;
la présence d'objet est une **preuve partielle** annotée d'un niveau de confiance.

| # | Fichier local | Preuve observée | Version distante probable | Catégorie | Confiance |
|---|---|---|---|---|---|
| 1 | create_catalog_schema | tables categories/products/quote_requests **existent** ; défs non vérifiées ; **aucune ligne d'historique** | — | **UNKNOWN** (appliqué‑non‑enregistré) | Moyenne |
| 2 | update_product_schema_comprehensive | tables brands/suppliers/media/pricing_tiers/lots **existent** ; colonnes non vérifiées | (partiellement `enrich_products_columns`?) | **UNKNOWN** | Moyenne |
| 3 | create_collaboration_requests | table **existe** ; défs non vérifiées ; nom de fichier non standard | — | **UNKNOWN** | Moyenne |
| 4 | update_quote_requests_comprehensive | table quote_requests existe ; colonnes non vérifiées | — | **UNKNOWN** | Faible‑moy |
| 5 | add_hs_code_index | index non vérifié (pas d'inventaire idx sans SQL) | — | **UNKNOWN** | Faible |
| 6 | benchmark_improvements | table product_images **existe** ; nom = version distante | `20260727223938` | **SEMANTIC_MATCH_DIFFERENT_TIMESTAMP** | Moy‑élevée |
| 7 | create_buyer_profiles | table **existe** ; **aucune ligne d'historique** | — | **UNKNOWN** (appliqué‑non‑enregistré) | Moyenne |
| 8 | create_site_settings | table **existe** ; **policies d'origine (authenticated_all/select) REMPLACÉES** par hotfix+gel (vérifié) | — | **SUPERSEDED** (policies) | Élevée |
| 9 | rls_admin_function | `is_admin()` **existe mais corps REMPLACÉ** par le hotfix (durci) ; policies admin sur autres tables : présumées présentes (non vérifiées) | — | **SUPERSEDED** (corps is_admin) | Moy‑élevée |
| 10 | add_source_and_market_columns | nom = version distante ; colonnes non vérifiées | `20260729093955` | **SEMANTIC_MATCH_DIFFERENT_TIMESTAMP** | Moy‑élevée |
| 11 | add_prix_marche_source | colonne non vérifiée sans SQL | — | **UNKNOWN** | Faible‑moy |
| 12 | search_products_return_full_columns | nom = version distante ; **remplacé localement par #13** | `20260731223810` | **SEMANTIC_MATCH_DIFFERENT_TIMESTAMP** (puis remplacé par #13) | Moyenne |
| 13 | search_products_add_price_fields | nom = version distante ; fonction active | `20260731232809` | **SEMANTIC_MATCH_DIFFERENT_TIMESTAMP** | Moy‑élevée |
| 14 | list_source_sites | nom = version distante ; **remplacé localement par #15** | `20260801000011` | **SEMANTIC_MATCH_DIFFERENT_TIMESTAMP** (puis remplacé par #15) | Moyenne |
| 15 | deactivate_requested_source_sites | recrée list_source_sites + updates data ; non vérifié | — | **UNKNOWN** | Faible‑moy |

**Décompte** : EXACT_MATCH **0** · SEMANTIC_MATCH_DIFFERENT_TIMESTAMP **5** · PARTIAL_MATCH **0** ·
SUPERSEDED **2** · NOT_APPLIED **0** · UNKNOWN **8**. (Total 15.)

> Réserve : plusieurs « UNKNOWN » sont en réalité très probablement **appliqués** (leurs tables
> existent), mais la catégorie reste UNKNOWN faute de vérification des **définitions** (colonnes,
> contraintes, policies) — impossible ici sans SQL. Le staging lèvera l'ambiguïté.

**Version distante sans local** : `enrich_products_columns` (`20260716145227`) → à rapprocher, en
staging, des colonnes produits créées par #2/#6.

## 6. Scripts appliqués manuellement (hors `supabase/migrations`)

| Script (archivé) | Actif dans le schéma réel | Dans `schema_migrations` | Emplacement |
|---|---|---|---|
| `emergency_lock_admin_settings` (`20260804090250`) | ✅ Oui (policies admin + is_admin durci + `authenticated_all` supprimée) | ❌ Non | `security-audit/applied-manual-sql/` |
| `freeze_legacy_admin_authority` (`20260804151606`) | ✅ Oui (gardes `key<>'admin_emails'` sur INSERT/UPDATE) | ❌ Non | `security-audit/applied-manual-sql/` |

**Conclusions** : les deux scripts sont **actifs en production**, **absents de l'historique**, et
**archivés hors du dossier de migrations actives**. Ils **ne doivent PAS** être réintroduits dans
`supabase/migrations/` ni ajoutés à l'historique local actif **sans décision explicite** — leur
contenu (policies gelées, is_admin durci) doit être **inclus dans la baseline** choisie (voir
RECONCILIATION_OPTIONS), pas rejoué comme migration.
