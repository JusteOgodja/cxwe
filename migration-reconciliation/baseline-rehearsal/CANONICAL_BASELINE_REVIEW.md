# CANONICAL_BASELINE_REVIEW — revue statique de la baseline candidate

Fichier : `migration-reconciliation/baseline-rehearsal/candidate/00_canonical_baseline.sql`
**NON destiné à `supabase/migrations/`.** Contexte Supabase (rôles, `auth`, `auth.uid()/jwt()/role()`)
fourni séparément (harness local en répétition ; CLI Supabase en staging).

## Origine & portée
- **Structure applicative** : dérivée des 15 migrations locales (état consolidé final).
- **Sécurité** : état **final vérifié en production** cette session (is_admin durci, policies
  `site_settings` gelées admin-only, aucune `authenticated_all`, pas de DELETE client).
- **Exclut** : versions vulnérables, `is_admin()` ILIKE, étapes intermédiaires hotfix/gel, données
  métier, adresses admin, scripts archivés.
- **Limite de fidélité** : la **parité colonne-par-colonne vs production** n'est pas certifiable ici
  (pas de `pg_dump`/CLI ; `execute_sql` interdit). Les colonnes de `products`, `categories`,
  `quote_requests`, `site_settings`, `buyer_profiles` sont fidèles aux migrations ; celles de
  `brands/suppliers/media/product_pricing_tiers/product_lots/product_images/collaboration_requests`
  sont **représentatives** et à confirmer par `supabase db pull` en staging.

## Revue statique (avant exécution)

| Objet / point | Type | Dépendances | Risque | Correction |
|---|---|---|---|---|
| `products.category_id → categories(id)` | FK | categories créée avant products | OK (ordre respecté) | — |
| `buyer_profiles.user_id → auth.users(id)` | FK | schéma `auth` requis | OK via harness/CLI | garder `auth.users` géré (ne pas recréer) |
| `is_admin()` | fonction SECURITY DEFINER | `site_settings` + `auth.jwt()/uid()` | ⚠️ SECURITY DEFINER | **`SET search_path=''`** présent + objets qualifiés ✅ |
| policies référençant `is_admin()` | policies | fonction créée **avant** les policies | OK (ordre respecté) | — |
| `EXECUTE is_admin()` | grant | — | ⚠️ ne pas donner à PUBLIC/anon | `REVOKE … FROM PUBLIC, anon, authenticated; GRANT … TO authenticated` ✅ |
| Grants DML catalogue | grant | rôles anon/authenticated | ⚠️ **initialement SELECT seul → admin bloqué** | **corrigé** : `GRANT SELECT,INSERT,UPDATE,DELETE … TO authenticated` (RLS = garde) |
| Objets créés plusieurs fois | — | — | Aucun (une seule création par objet) | — |
| Index dupliqués | — | — | Aucun | — |
| Propriétaires codés en dur | — | — | Aucun (pas d'`ALTER … OWNER`) | — |
| Données / valeurs sensibles | — | — | Aucune (seed séparé, admin_emails fictif) | — |
| `CREATE POLICY IF NOT EXISTS` | syntaxe | — | **Éliminé** (contrairement à la migration historique #6) | régénéré proprement |
| Noms de fichiers non standard | CLI | — | **Éliminé** (baseline unique) | — |

**Résidus signalés (hors périmètre sécurité de ce lot)** : `media`, `product_pricing_tiers`,
`product_lots`, `product_images`, `collaboration_requests` conservent des policies
« Authenticated users can manage » (non admin-only) — **état réel** hérité des migrations, à
resserrer éventuellement dans une phase ultérieure (non traité ici).

**Conclusion** : baseline **buildable** et **sans défaut bloquant** après correction des grants
DML. Sécurité conforme à l'état final. Parité colonnes à finaliser en staging via `db pull`.
