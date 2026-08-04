# LOCAL_REBUILD_RESULTS — reconstruction locale (base vide)

> **Statut de validation** : **Baseline SQL validée sur PostgreSQL 16 avec harnais Supabase simulé.
> Validation sur la pile Supabase complète encore requise** (voir FULL_SUPABASE_LOCAL_REHEARSAL).

## Environnement
- **Docker** `postgres:16-alpine` (conteneur jetable `rehearsal-db`), base `rehearsal` **vide**.
- **Aucun lien à la production.** Aucune donnée de production. `supabase` CLI absent → contexte
  Supabase simulé par un **harness local** (`harness.sql` : rôles `anon`/`authenticated`/
  `service_role`, schéma `auth`, `auth.users`, `auth.uid()/jwt()/role()`).
- Séquence appliquée : `harness.sql` → `candidate/00_canonical_baseline.sql` → `seed.sql`
  (synthétique), chaque étape en `psql -v ON_ERROR_STOP=1`.

## Résultats
| Build | Base | Résultat |
|---|---|---|
| #1 | rehearsal (neuve) | ✅ SUCCÈS (harness + baseline + seed, 0 erreur) |
| #2 | `DROP DATABASE … FORCE` puis `CREATE DATABASE` (vide) | ✅ SUCCÈS (reconstruction from scratch) |
| #3 | idem, **baseline corrigée** (grants DML) | ✅ SUCCÈS |

**Reconstructions réussies consécutives : ≥ 2** (exigence remplie ; 3 au total dont la version
corrigée).

## Inventaire obtenu (base locale reconstruite)
- **Tables (public) : 12** — identique au nombre en production (`list_tables`).
- **Policies (public) : 33.**
- **Fonctions (public) : 1** (`is_admin`).

## Seed synthétique appliqué
- 2 utilisateurs `auth.users` fictifs (admin/ordinaire, emails `*@rehearsal.test`).
- `site_settings` : `admin_emails = admin@rehearsal.test` (fictif) + paramètres non sensibles.
- 2 catégories, 1 marque, 2 produits fictifs.
- **Aucune donnée de production copiée.**

## Anomalie détectée puis corrigée
- **1er passage** : `admin_update_product = BLOCKED` → la baseline n'accordait que `SELECT` à
  `authenticated` sur les tables catalogue (grants DML manquants ; Supabase les accorde par défaut,
  la RLS servant de garde). **Correction** : `GRANT SELECT,INSERT,UPDATE,DELETE … TO authenticated`.
  Après correction : `admin_update_product = 1` (voir SECURITY_REGRESSION_RESULTS).

**Conclusion** : la baseline candidate se reconstruit **de zéro, sans erreur, de façon reproductible**.
