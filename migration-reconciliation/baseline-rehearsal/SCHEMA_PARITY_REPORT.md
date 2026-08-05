# SCHEMA_PARITY_REPORT — base locale reconstruite vs production

**Méthode.** Comparaison entre la base locale (baseline candidate) et l'état de production **connu**
par : `list_tables` (jeu de tables + RLS) et les captures de schéma **vérifiées cette session**
(`site_settings` policies/grants, `is_admin()` def, triggers). La comparaison **colonne‑par‑colonne**
complète des tables applicatives n'a pas pu être faite ici (pas de `pg_dump`/CLI ; `execute_sql`
interdit) → elle est classée **UNKNOWN** et **reportée au staging** (`supabase db pull` + diff).

## Classification par objet
| Objet | Parité | Preuve |
|---|---|---|
| Jeu de tables `public` (12) | **IDENTICAL** | local 12 = production 12 (mêmes noms via `list_tables`) |
| RLS activée sur les 12 tables | **IDENTICAL** | `rls_enabled=true` partout (prod) ; `ENABLE ROW LEVEL SECURITY` (local) |
| `public.is_admin()` (def, SECURITY DEFINER, `search_path=''`, comparaison exacte) | **IDENTICAL** | def locale = def prod capturée cette session |
| `site_settings` policies (admin_select/insert/update, gardes `key<>'admin_emails'`, pas de DELETE) | **IDENTICAL** | policies locales = policies prod vérifiées |
| `site_settings` grants (authenticated SELECT/INSERT/UPDATE ; anon aucun) | **IDENTICAL** | grants locaux = grants prod vérifiés |
| Absence de `site_settings_authenticated_all` | **IDENTICAL** | absente des deux côtés |
| Policies admin catalogue (categories/products/brands/suppliers/buyer_profiles) | **EQUIVALENT** | mêmes intentions (is_admin en écriture) ; formulation `(SELECT is_admin())` vs `is_admin()` — équivalente |
| Colonnes / types / defaults / contraintes des tables applicatives | **UNKNOWN** | non comparés sans dump (repoussé au staging) |
| Index applicatifs | **UNKNOWN** | non inventoriés en prod sans SQL |
| Triggers `site_settings` | **IDENTICAL** | 0 des deux côtés |
| Fonctions RPC `search_products`, `list_source_sites` | **MISSING_LOCALLY (volontaire)** | non incluses dans la baseline de répétition (non critiques sécurité) ; à intégrer via `db pull` |
| Schémas `auth`/`storage`/`realtime`/`extensions`/`supabase_migrations` | **MANAGED_BY_SUPABASE** | non recréés (harness minimal en local) |
| Rôles, propriétaires internes, versions d'extensions | **MANAGED_BY_SUPABASE** | différences non applicatives, ignorées |

## Différences applicatives réelles à lever en staging
1. **Colonnes/contraintes/index** des tables applicatives : produire le diff via `supabase db pull`
   (staging) contre la baseline.
2. **RPC `search_products` / `list_source_sites`** : à inclure dans la baseline canonique finale
   (versions finales des migrations #13 et #15).
3. Éventuels **résidus de policies** non‑admin sur media/pricing/lots/images/collaboration
   (hérités) — décider s'ils font partie de l'état cible.

**Bilan.** **Aucune différence détectée sur les éléments de sécurité explicitement modélisés et
testés ; parité avec la production non encore prouvée.** Parité **structurelle applicative** = à
certifier en staging (UNKNOWN ici, par limite d'outillage). Cette première étape est une **baseline
SQL validée sur PostgreSQL 16 avec harnais Supabase simulé — la validation sur la pile Supabase
complète reste requise** (voir FULL_SUPABASE_LOCAL_REHEARSAL).
