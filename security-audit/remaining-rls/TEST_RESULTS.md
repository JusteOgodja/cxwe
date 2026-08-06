# TEST_RESULTS — lot restant (vrais JWT, pile Supabase LOCALE)

```
target_is_production = false
local Supabase       = true (Docker 29.5.3 ; storage/realtime/studio désactivés)
staging used         = false
synthetic_users_only = true (utilisateur A, B, admin @synthetic.test)
production users      = 0
rebuilds             = 2 (baseline pré-lot ; puis fixture + migration)
```
Schéma reproduit : `site_settings` + `is_admin()` (EXECUTE retiré à PUBLIC), buyer_profiles,
categories, products, brands, quote/collaboration, suppliers/pricing/images/lots/media, et les 7
RPC applicatives (EXECUTE pré-M3 = anon+authenticated). Harnais : `tests/local_stack/`.

## buyer_profiles (avant → après)
| Contrôle | Avant | Après |
|---|---|---|
| anon SELECT | 🟥 401 (admin_read TO public+is_admin) | ✅ bloqué (aucun grant/policy anon) |
| anon INSERT | bloqué | ✅ bloqué |
| A insert SA ligne | 201 | ✅ 201 |
| A insert `user_id=B` (forge) | 403 | ✅ 403 (WITH CHECK) |
| A lit SA ligne | ✅ | ✅ |
| A lit la ligne de B | 0 | ✅ 0 |
| A `select *` | seulement les siennes | ✅ seulement les siennes |
| B lit la ligne de A | 0 | ✅ 0 |
| admin `select *` | toutes | ✅ toutes |

## RPC EXECUTE (avant → après)
| RPC | anon avant | anon après | auth après | admin après |
|---|---|---|---|---|
| get_quality_stats | 200 | **401** | 200 | 200 |
| get_products_with_issues | 200 | **401** | 200 | 200 |
| count_brands_no_active_products | 200 | **401** | 200 | 200 |
| count_categories_no_active_products | 200 | **401** | 200 | 200 |
| search_products | 200 | **401** | 200 | 200 |
| list_source_sites | 200 | **401** | 200 | 200 |
| refresh_product_counts | 404/PGRST202 (trigger, non exposé) | 404 ; EXECUTE retiré à anon **et** authenticated | — | — |

Vérif base : les 6 RPC ont `search_path=public,pg_temp`, `anon=false`, `authenticated=true` ;
`refresh_product_counts` `anon=false, authenticated=false` ; `is_admin` inchangée.

## Grants anon (avant → après)
| Opération | Avant | Après |
|---|---|---|
| INSERT quote_requests / collaboration_requests | 201 | ✅ 201 (conservé) |
| INSERT/UPDATE/DELETE products/categories | bloqué (RLS) | ✅ bloqué (grant retiré) |
| SELECT products / categories | 200 | ✅ 200 (public conservé) |
| SELECT buyer_profiles | 🟥 401 | ✅ bloqué (grant retiré) |
| SELECT quote_requests | 200(0) | ✅ bloqué (grant retiré) |

## Régressions (inchangées ✅)
- brands lecture active anonyme = 200 ; `is_admin` anon = bloqué ; ordinaire `is_admin()=false` ;
  admin `is_admin()=true` ; écriture catégorie : ordinaire bloqué / admin 201.

## Parcours vérifiés
anon (lecture publique + INSERT formulaires) ✅ · isolation A/B buyer_profiles ✅ · RPC par rôle ✅ ·
refus écritures anon catalogue ✅ · administration catalogue ✅ · ancien exploit admin_emails
(is_admin durci, non touché) ✅ · brands ✅ · site_settings (gel, non touché) ✅.

## Précondition prouvée
Lors d'une exécution où le schéma de test était incomplet, la migration a **abort/ROLLBACK**
(`relation public.media does not exist`) sans rien laisser d'appliqué → confirme le garde-fou
« annulation intégrale si l'état diffère ».
