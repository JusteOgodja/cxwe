# ACCESS_MATRIX — tables `public` (audit lecture seule)

**Constat transverse** : les grants de table sont larges par défaut (Supabase) — `anon` **et**
`authenticated` ont `SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` sur **toutes** les
tables **sauf `site_settings`** (anon: aucun ; authenticated: SELECT/INSERT/UPDATE). La RLS est
donc l'**unique** garde-fou. RLS activée sur les 12 tables. Storage : **aucun bucket / aucune
policy** (images = URLs externes).

Légende accès effectif (grants + RLS) : ✅ autorisé · ⛔ bloqué · 🟥 permissif (problème).

| Table | anon SELECT | anon write | auth. ordinaire SELECT | auth. ordinaire write | admin | policies clés | routes |
|---|---|---|---|---|---|---|---|
| products | ✅ actifs | ⛔ (is_admin) | ✅ tous | ⛔ (is_admin) | ✅ | admin_insert/update/delete (is_admin, cmd) + public read active | catalog/home, admin/products |
| categories | ✅ actifs | ⛔ | ✅ tous | ⛔ | ✅ | idem products | home/catalog, admin |
| brands | ✅ actifs | ⛔ | ✅ actifs | ⛔ | ✅ | **corrigé** (admin cmd + public read) | catalog, admin/brands |
| suppliers | 🟥 **401** | ⛔ | ✅ actifs | 🟥 **ALL true** | ✅ | `Auth can manage` (ALL true) + `suppliers_admin_write` (ALL public is_admin) | catalog(brands view), admin/suppliers |
| product_pricing_tiers | ✅ (public) | ⛔ | ✅ | 🟥 **ALL true** | ✅ | `Auth can manage pricing` (ALL true) | fiche produit, admin |
| product_images | ✅ (public) | ⛔ | ✅ | 🟥 **ALL true** | ✅ | `Auth can manage product images` (ALL true) | fiche produit, admin |
| product_lots | ⛔ (auth-only read) | ⛔ | ✅ (true) | 🟥 **ALL true** | ✅ | `Auth can manage lots` (ALL true) + `Auth can view lots` (true) | admin |
| media | ✅ (public) | 🟥 insert | ✅ | 🟥 **INSERT true** | ✅ | `Auth can insert media` (WITH CHECK true) | admin |
| quote_requests | ⛔ (0 rows) | ✅ INSERT public | 🟥 **✅ tous** | 🟥 **✅ update/delete** | ✅ | `Auth can view/update/delete` (true) + public INSERT | /quote (insert), admin/quotes |
| collaboration_requests | ⛔ (0 rows) | ✅ INSERT public | 🟥 **✅ tous** | 🟥 **✅ ALL** | ✅ | `Auth can manage` (ALL true) + public INSERT | /partner (insert), admin/partners |
| buyer_profiles | 🟥 **401** | ⛔ | ✅ **propres** | ✅ **propres** (own) | ✅ read all | own insert/select/update + admin_read (role public is_admin) | /signup, admin/buyers |
| site_settings | ⛔ (no grant) | ⛔ | ⛔ (is_admin) | ⛔ | ✅ (gel admin_emails) | **gelé admin-only** | admin/settings |

Points saillants :
- **quote_requests / collaboration_requests** : lisibles **et** modifiables/supprimables par **tout
  utilisateur authentifié** (PII inter-utilisateurs). ➜ CRITICAL / HIGH.
- **suppliers / product_pricing_tiers / product_images / product_lots** : `ALL USING true` pour
  authenticated ➜ écriture/suppression par un utilisateur ordinaire. `suppliers` a en plus la policy
  `FOR ALL TO public is_admin()` ➜ **401 anonyme** (lecture publique cassée). ➜ HIGH.
- **media** : insert par tout authentifié. ➜ MEDIUM.
- **buyer_profiles** : policy `admin_read` en rôle **public** appelant `is_admin()` ➜ **401 anon**
  (latent, anon n'interroge pas cette table sur le public) ; policies dupliquées. ➜ MEDIUM/LOW.
  Isolation OK par ailleurs (own via `user_id = auth.uid()`).
- **products / categories / brands / site_settings** : conformes (admin par commande + lecture
  publique des actifs / gel). ➜ EXPECTED.
