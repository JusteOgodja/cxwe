# Interventions base de données appliquées MANUELLEMENT (hors historique Supabase)

Ces scripts ont été appliqués **directement en production** via l'action `execute_sql`
(fichier envoyé verbatim), **et ne sont PAS** enregistrés dans
`supabase_migrations.schema_migrations`. Ils sont archivés sous
`security-audit/applied-manual-sql/` **pour audit uniquement — ils ne doivent jamais être
rejoués** (ni via `supabase db push`, `migration up`, `migration repair`, `db reset`).

Empreintes **canoniques LF** (fins de ligne figées par `.gitattributes : *.sql text eol=lf`).
Aucune valeur sensible (email, UUID, JWT, token, configuration) ne figure ici.

> Note d'audit : une empreinte `4d5db947…` a pu être citée précédemment pour le gel ; il
> s'agissait d'une mesure sur une copie de travail **CRLF**. L'empreinte canonique **LF** du
> contenu (identique en SQL) est `3f8f39a3…`. Le contenu SQL n'a jamais changé.

---

## Hotfix d'autorité administrateur

- **Fichier** : `security-audit/applied-manual-sql/20260804090250_emergency_lock_admin_settings.sql`
- **Date d'application (UTC)** : 2026-08-04
- **SHA-256 (LF canonique)** : `cc6a256cc96ebe5cef087a1a9b8751711536f62d8a58e4104d5e6121576116e1`
- **Méthode** : `execute_sql`
- **Transaction** : fichier avec `BEGIN;`…`COMMIT;` (une seule couche transactionnelle)
- **Précondition** : réussie (autorité admin valide requise avant tout changement)
- **Résultat** : escalade de privilèges fermée — utilisateur authentifié ordinaire ne peut plus
  écrire `site_settings` ni s'auto-promouvoir (exploit bloqué)
- **Historique Supabase** : **non enregistré** (`schema_migrations`)
- **PR d'archivage** : #5 (`security/freeze-legacy-admin-authority`)
- **État de production** : validé (hotfix actif, session admin réelle confirmée)

## Gel de l'autorité historique

- **Fichier** : `security-audit/applied-manual-sql/20260804151606_freeze_legacy_admin_authority.sql`
- **Date d'application (UTC)** : 2026-08-04
- **SHA-256 (LF canonique)** : `3f8f39a3876a932c412d0d2e874a189936317ffc3dacc0e4d6dacf9f4b001159`
- **Méthode** : `execute_sql`
- **Transaction** : validée (`BEGIN;`…`COMMIT;`, précondition renforcée passée)
- **Policies finales** (`public.site_settings`) :
  - `site_settings_admin_select` [SELECT] — inchangée (admin lit tout)
  - `site_settings_admin_insert` [INSERT] — `WITH CHECK (is_admin() AND key <> 'admin_emails')`
  - `site_settings_admin_update` [UPDATE] — `USING` **et** `WITH CHECK (is_admin() AND key <> 'admin_emails')`
  - aucune policy DELETE ; aucune `site_settings_authenticated_all`
- **Tests post-déploiement** (rollback) : utilisateur ordinaire bloqué partout ; admin modifie les
  autres paramètres ; admin bloqué sur valeur/renommage×2/insertion `admin_emails` ; lecture admin
  OK ; `is_admin()` = true ; anonyme sans accès
- **Historique Supabase** : **non enregistré** (`schema_migrations`)
- **PR correspondante** : #5 (`security/freeze-legacy-admin-authority`)
- **État de production** : validé (gel actif, admin fonctionnel, application publique OK)
