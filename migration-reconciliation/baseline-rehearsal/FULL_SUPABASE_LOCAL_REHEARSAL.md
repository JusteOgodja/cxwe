# FULL_SUPABASE_LOCAL_REHEARSAL — répétition sur la pile Supabase locale complète

Répétition exécutée avec la **vraie pile Supabase locale** (CLI temporaire via `npx`, Docker),
**hors dépôt principal**, **aucun lien distant**, **données 100 % synthétiques**. Complète la
répétition PostgreSQL précédente (harnais simulé).

## Version CLI & isolement
- CLI : **`supabase 2.111.0`** (via `npx --yes supabase@latest`, non ajoutée à package.json).
- `linked_project = none` · `production_project_ref_present = false` ·
  `production_database_url_present = false` · `synthetic_data_only = true`.

## Services démarrés (URLs locales)
| Service | Rôle | État |
|---|---|---|
| `db` | PostgreSQL 17 (127.0.0.1:54322) | healthy |
| `rest` | PostgREST (127.0.0.1:54321/rest/v1) | up (REST 200) |
| `auth` | GoTrue / Auth | healthy |
| `kong` | API gateway (127.0.0.1:54321) | healthy |
| `inbucket` | Mail de test (54324) | healthy |
| `studio` / `storage` / `realtime` / `edge_runtime` / `analytics` | — | **désactivés** (health-check trop lent → tear-down ; non requis pour la répétition RLS/Auth/PostgREST) |

> Premier `supabase start` a échoué sur `LegacyHealthCheckTimeoutError` (storage/pg_meta/studio
> unhealthy dans le délai). Après désactivation de ces services : démarrage stable.

## Reconstruction `db reset --local`
- **2 exécutions consécutives réussies** (exit 0). Chaque reset : `Applying migration
  20260101000000_canonical_baseline.sql` + `Seeding data from supabase/seed.sql` sans erreur.
- `migration list` local **cohérent** : `20260101000000` local=remote, **aucun rejeu accidentel**.
- Objets : 12 tables · 33 policies · `is_admin` présente · seed (2 produits, admin_emails=1).

## Authentification réelle (JWT GoTrue)
Utilisateurs **synthétiques** créés via l'API Auth admin (`/auth/v1/admin/users`, HTTP 200) ;
connexion réelle via `/auth/v1/token` → **vrais JWT** (pas de `set_config`).

| Contrôle (PostgREST + vrais JWT) | Résultat |
|---|---|
| `is_admin()` admin / ordinaire | **true / false** |
| Anon — lecture produits | 200, 2 lignes |
| Anon — lecture `site_settings` | **42501 permission denied** (bloqué) |
| Ordinaire — update site_name / produit | **0 / 0** ligne (bloqué) |
| Admin — update produit / paramètre ordinaire | **1 / 1** ligne (autorisé) |
| Admin — update `admin_emails` | **0** ligne (gel) |
| Admin — insert `admin_emails` | **HTTP 403** (gel) |
| Filtre `?is_active=eq.true` | 200 |

## PostgREST / RPC
| RPC | HTTP | Classement |
|---|---|---|
| `is_admin` | 200 (true/false) | **présente & testée** |
| `search_products` | **404** | **MISSING_FROM_BASELINE (bloquant)** |
| `list_source_sites` | **404** | **MISSING_FROM_BASELINE (bloquant)** |
| `get_quality_stats` (appelée par l'admin) | 404 attendu | **MISSING** — et **absente aussi des 15 migrations locales** → RPC de production non suivie localement (divergence supplémentaire) |

> Les RPC ne sont **pas inventées** : leurs définitions doivent être récupérées depuis les sources
> autorisées (migrations #13 `search_products`, #15 `list_source_sites` ; `get_quality_stats` =
> source à localiser) avant intégration à la baseline. En attendant : **UNKNOWN/MISSING**.

## Frontend local (Vite → pile locale)
- `.env.local` **temporaire non versionné** (`VITE_SUPABASE_URL=http://127.0.0.1:54321`, anon local ;
  aucun secret committé). Dev server sur `:5199`.
- **Public** : accueil et catalogue se chargent, requêtes REST `OPTIONS 200`. ✅
- **Login admin (compte synthétique)** : `signInWithPassword` = **200**, `is_admin` = **200/true**
  (vérifié depuis le navigateur) → l'auth et l'autorité fonctionnent. L'espace admin s'est rendu
  (requêtes dashboard émises), **mais la session admin ne se stabilise pas** dans l'UI : l'espace
  admin appelle des **RPC absentes de la baseline** (`get_quality_stats`, `search_products`,
  `list_source_sites` → 404), ce qui casse le flux. → **frontend admin partiellement bloqué par
  l'incomplétude RPC de la baseline** (constat majeur).

## Différences restantes / limites
- **RPC manquantes** dans la baseline (`search_products`, `list_source_sites`, `get_quality_stats`)
  → **bloquant** pour l'espace admin ; à intégrer avant adoption.
- **Colonnes/contraintes/index** applicatifs : parité vs production non prouvée (pas de dump prod ;
  `execute_sql` interdit) → `UNKNOWN_PRODUCTION_DEFINITION`.
- Services storage/studio/realtime non testés (désactivés pour stabilité).

## Parité structurelle (Section 10) — classement final
| Domaine | Classement | Détail |
|---|---|---|
| Tables (12) | **VERIFIED_IDENTICAL** | local 12 = production 12 |
| RLS activée | **VERIFIED_IDENTICAL** | activée partout des deux côtés |
| `is_admin()` (def durcie) | **VERIFIED_EQUIVALENT** | comportement prouvé (true/false via vrais JWT) ; def = état final |
| Policies `site_settings` (gel) | **VERIFIED_EQUIVALENT** | comportement prouvé (update/insert admin_emails bloqués) |
| Policies catalogue (admin write, public read) | **VERIFIED_EQUIVALENT** | admin write=OK, ordinaire/anon bloqués |
| Grants | **VERIFIED_EQUIVALENT** | anon lecture, authenticated DML+RLS |
| RPC `search_products`, `list_source_sites`, `get_quality_stats` | **MISSING_FROM_BASELINE** | 404 en local ; bloquant |
| Colonnes / defaults / contraintes / index applicatifs | **UNKNOWN_PRODUCTION_DEFINITION** | non comparés sans dump prod |
| Triggers | **VERIFIED_EQUIVALENT** | 0 sur site_settings des deux côtés |
| Schémas `auth`/`storage`/`realtime`/`supabase_migrations`/extensions | **MANAGED_BY_SUPABASE** | fournis par la pile, non recréés |
| (aucun objet applicatif en trop) | **EXTRA_IN_BASELINE** = néant | — |

**Conclusion.** Le modèle de **sécurité** est prouvé sur la pile Supabase réelle. La baseline
**n'est pas encore prête pour le staging/production** : il manque les **RPC** et la **parité
structurelle** (colonnes/index) reste à certifier via `supabase db pull` en staging.
