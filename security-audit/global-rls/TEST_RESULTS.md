# TEST_RESULTS — vrais JWT sur pile Supabase LOCALE

## Environnement (confirmé non-production)
```
target_is_production   = false
local Supabase         = true (npx supabase start ; Docker 29.5.3)
staging used           = false (local suffisant)
synthetic_users_only   = true  (utilisateur A, utilisateur B, admin — tous synthétiques @synthetic.test)
production users created= 0     (aucun ; interdiction respectée)
```
Schéma reproduit fidèlement : 7 tables + `site_settings` + `is_admin()` (identique à la prod,
SECURITY DEFINER, `search_path=''`, **EXECUTE retiré à PUBLIC/anon**, réservé `authenticated`),
grants larges anon+authenticated (RLS = seul garde-fou), et les **policies actuelles** (pré-durcissement).
Harnais et procédure : `tests/local_stack/`.

## BASELINE (avant durcissement) — exploits reproduits
`status(lignes affectées)` ; `401/403/42501` = bloqué.

| Table | anon SELECT | anon INSERT | A SELECT | A INSERT | A UPDATE | A DELETE | B iso. sur ligne étrangère |
|---|---|---|---|---|---|---|---|
| suppliers | **401/42501** 🟥 | 401 | 200 | **201** 🟥 | **1** 🟥 | **1** 🟥 | — |
| product_pricing_tiers | 200 | 401 | 200 | **201** 🟥 | **1** 🟥 | **1** 🟥 | — |
| product_images | 200 | 401 | 200 | **201** 🟥 | **1** 🟥 | **1** 🟥 | — |
| product_lots | 200(0) | 401 | 200 | **201** 🟥 | **1** 🟥 | **1** 🟥 | — |
| media | 200 | 401 | 200 | **201** 🟥 | 0 | 0 | — |
| quote_requests | 200(0) | 201 (form) | **200(all)** 🟥 | 201 | **1** 🟥 | **1** 🟥 | **B lit/màj/suppr = 1** 🟥 |
| collaboration_requests | 200(0) | 201 (form) | **200(all)** 🟥 | 201 | **1** 🟥 | **1** 🟥 | **B lit/màj/suppr = 1** 🟥 |

→ Confirme : suppliers cassé en lecture anonyme (401) ; écriture catalogue par utilisateur ordinaire ;
lecture/écriture de **toutes** les demandes par tout authentifié + **aucune isolation**.

## APRÈS durcissement (migration adaptée) — règles métier respectées
| Table | anon SELECT | anon INSERT | A/B INSERT | A/B UPDATE | A/B DELETE | admin (S/I/U/D) | B iso. |
|---|---|---|---|---|---|---|---|
| suppliers | **200 (actifs)** ✅ | 401 bloqué | **403 bloqué** | **0 bloqué** | **0 bloqué** | 200/201/1/1 ✅ | — |
| product_pricing_tiers | 200 (public) | 401 | 403 | 0 | 0 | 200/201/1/1 ✅ | — |
| product_images | 200 (public) | 401 | 403 | 0 | 0 | 200/201/1/1 ✅ | — |
| product_lots | 200(auth) | 401 | 403 | 0 | 0 | 200/201/1/1 ✅ | — |
| media | 200 (public) | 401 | 403 | 0 | 0 | 200/201/1/1 ✅ | — |
| quote_requests | 200(0) | **201 (form OK)** ✅ | 201(form) | **0** ✅ | **0** ✅ | 200(all)/201/1/1 ✅ | **B lit/màj/suppr = 0** ✅ |
| collaboration_requests | 200(0) | **201 (form OK)** ✅ | 201(form) | **0** ✅ | **0** ✅ | 200(all)/201/1/1 ✅ | **B lit/màj/suppr = 0** ✅ |

### Contrôle fin suppliers (actif vs inactif, count=exact)
```
anon   : 23 lignes, 0 inactif visible   (actifs seulement) ✅
userA  : 23 lignes, 0 inactif visible   (ordinaire = comme anon) ✅
admin  : 24 lignes, 1 inactif visible   (suppliers_admin_select) ✅
```
→ La règle métier de `admin/Suppliers.tsx` (`select('*')` incluant les inactifs) est satisfaite,
sans exposer les inactifs au public ni aux utilisateurs ordinaires.

## Synthèse
| Vérification | Résultat |
|---|---|
| anon (SELECT/INSERT/UPDATE/DELETE) | ✅ lecture publique où voulue ; aucune écriture ; formulaires devis/collab OK |
| utilisateur A — ses actions | ✅ soumet une demande (INSERT public) ; **ne lit aucune demande** ; aucune écriture catalogue |
| utilisateur A → données de B | ✅ inaccessible (0 ligne) |
| utilisateur B → données de A | ✅ inaccessible (0 ligne) |
| admin | ✅ accès complet : gère catalogue + lit/traite toutes les demandes |
| isolation inter-utilisateurs | ✅ stricte (demandes admin-only ; catalogue non modifiable) |

## Tests frontend
Validés **au niveau contrat API** : chaque opération Supabase réelle des pages a été exécutée
avec de vrais JWT (voir tableaux) —
- `QuoteRequest.tsx` / `SampleRequest.tsx` : `insert quote_requests` anonyme → **201** ✅
- `Partner.tsx` : `insert collaboration_requests` anonyme → **201** ✅
- `admin/Quotes.tsx`, `admin/Partners.tsx`, `admin/Suppliers.tsx`, `admin/Products.tsx` :
  SELECT/UPDATE/DELETE/INSERT en tant qu'admin → **autorisés** ✅ ; en tant qu'ordinaire → **bloqués** ✅
- `ProductDetail.tsx` : lecture publique `product_pricing_tiers` / `product_images` → **200** ✅

Un **run d'interface complet** (Vite) contre le miroir local n'a pas été effectué : le miroir ne
contient que les 7 tables auditées (pas `products`/`categories`), donc les pages catalogue ne se
rendraient pas. La couverture ci-dessus valide les **contrats d'accès** exacts de chaque parcours ;
aucun parcours n'est cassé par le durcissement (les INSERT publics des formulaires et les lectures
publiques restent 200/201).
