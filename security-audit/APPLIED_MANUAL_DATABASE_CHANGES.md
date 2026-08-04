# Interventions base de données appliquées MANUELLEMENT (hors historique Supabase)

Ces scripts ont été appliqués **directement en production** via l'action `execute_sql`
(fichier envoyé verbatim), **et ne sont PAS** enregistrés dans
`supabase_migrations.schema_migrations`. Ils sont archivés sous
`security-audit/applied-manual-sql/` **pour audit uniquement — ils ne doivent jamais être
rejoués** (ni via `supabase db push`, `migration up`, `migration repair`, `db reset`).

Empreintes **canoniques LF** (fins de ligne figées par `.gitattributes : *.sql text eol=lf`).
Aucune valeur sensible (email, UUID, JWT, token, configuration) ne figure ici.

> **Note d'audit — deux empreintes distinctes pour le gel.**
> - `deployed_bytes_sha256_crlf = 4d5db94780cca679acf4e75601270fc314da51d46e5e1946cb41a97a2c694b66`
>   — correspond aux **octets CRLF réellement envoyés en production**.
> - `canonical_git_sha256_lf = 3f8f39a3876a932c412d0d2e874a189936317ffc3dacc0e4d6dacf9f4b001159`
>   — correspond au **fichier canonique LF désormais archivé dans Git**.
>
> Les deux contenus SQL sont **sémantiquement équivalents** mais **ne sont PAS byte-identical** ;
> la différence provient **uniquement** de la normalisation des fins de ligne **CRLF → LF**
> (figée depuis par `.gitattributes : *.sql text eol=lf`).
>
> Pour le **hotfix**, aucune divergence : les octets déployés et le fichier canonique Git sont
> tous deux en **LF** et partagent la même empreinte
> `cc6a256cc96ebe5cef087a1a9b8751711536f62d8a58e4104d5e6121576116e1`.

---

## Hotfix d'autorité administrateur

- **Fichier** : `security-audit/applied-manual-sql/20260804090250_emergency_lock_admin_settings.sql`
- **Date d'application (UTC)** : 2026-08-04
- **SHA-256 octets déployés (CRLF)** : `cc6a256cc96ebe5cef087a1a9b8751711536f62d8a58e4104d5e6121576116e1`
- **SHA-256 canonique Git (LF)** : `cc6a256cc96ebe5cef087a1a9b8751711536f62d8a58e4104d5e6121576116e1`
  (identiques — le hotfix a été appliqué alors que la copie de travail était déjà en LF)
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
- **SHA-256 octets déployés (CRLF)** : `4d5db94780cca679acf4e75601270fc314da51d46e5e1946cb41a97a2c694b66`
  — octets réellement envoyés en production.
- **SHA-256 canonique Git (LF)** : `3f8f39a3876a932c412d0d2e874a189936317ffc3dacc0e4d6dacf9f4b001159`
  — fichier archivé dans Git.
- **Équivalence** : contenus **sémantiquement équivalents**, **PAS byte-identical** ; différence
  due **uniquement** à la normalisation CRLF → LF.
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
