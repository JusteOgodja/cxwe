# Gel de l'autorité historique `site_settings.admin_emails`

Migration : `supabase/migrations/20260804151606_freeze_legacy_admin_authority.sql`
Test : `security-audit/tests/01_freeze_legacy_admin_authority_proof.sql`

## Objectif
Empêcher **toute** modification cliente de la ligne `admin_emails` (y compris par un
administrateur authentifié via l'interface), tout en laissant l'administrateur gérer
normalement les autres paramètres. La ligne n'est **pas** supprimée : `public.is_admin()`
la lit encore en transitoire (SECURITY DEFINER, hors RLS).

## Policies finales sur `public.site_settings`
- `site_settings_admin_select` [SELECT] `TO authenticated` `USING (SELECT public.is_admin())` — inchangée.
- `site_settings_admin_insert` [INSERT] `TO authenticated` `WITH CHECK ((SELECT public.is_admin()) AND key <> 'admin_emails')`.
- `site_settings_admin_update` [UPDATE] `TO authenticated` `USING ((SELECT public.is_admin()) AND key <> 'admin_emails')` **et** `WITH CHECK ((SELECT public.is_admin()) AND key <> 'admin_emails')`.
- **Aucune** policy DELETE ; **aucun** grant DELETE client. La policy vulnérable `site_settings_authenticated_all` reste absente.

Effets : bloque la modification de la valeur d'`admin_emails`, son renommage sortant, le
renommage d'une autre clé vers `admin_emails`, et l'insertion d'une nouvelle ligne `admin_emails`.

## Journal d'application en production (2026-08-04)
- **Date d'application (UTC)** : 2026-08-04 (session ~19:00Z). *(Appliquée hors historique de
  migration ; horodatage non journalisé côté `schema_migrations`.)*
- **SHA-256 du SQL appliqué** : `4d5db94780cca679acf4e75601270fc314da51d46e5e1946cb41a97a2c694b66`
  (identique à l'empreinte du fichier Git — envoyé **verbatim**).
- **Méthode** : `execute_sql` (Supabase MCP), fichier entier en **une seule** exécution,
  `BEGIN;`…`COMMIT;` gérés par le fichier (une seule couche transactionnelle).
- **Hors historique** : appliquée **hors** `supabase_migrations.schema_migrations` (aucune
  insertion manuelle), comme le hotfix. Réconciliation ultérieure par procédure séparée —
  **sans** `db push` / `migration repair` / `db reset`.
- **Précondition renforcée** : **passée** (1 ligne `admin_emails` ; entrée non vide ;
  correspondance `auth.users` ; `is_admin()` durcie présente ; 3 policies hotfix présentes ;
  policy vulnérable absente).
- **Transaction** : arrivée à **`COMMIT`** sans erreur.
- **Commit migration** : `e825099` (branche `security/freeze-legacy-admin-authority`, PR #5).

## Contrôles post-déploiement (valeurs non sensibles)
Tests de rôle en transaction rollback contre l'état gelé réel :

| Scénario | Résultat |
|---|---|
| utilisateur ordinaire — autre paramètre | blocked |
| utilisateur ordinaire — `admin_emails` | blocked |
| admin — autre paramètre | allowed |
| admin — valeur `admin_emails` | blocked |
| admin — renommage `admin_emails` | blocked |
| admin — renommage autre → `admin_emails` | blocked |
| admin — insertion `admin_emails` | blocked |
| admin — lecture `admin_emails` | allowed |
| `is_admin()` serveur | true |
| anonyme — accès `site_settings` | blocked |

Validation navigateur (admin réel, production) : `is_admin()` = true ; page Settings chargée ;
**aucun champ Admin Emails** ; modification réversible d'un paramètre non sensible enregistrée,
persistée après rechargement, puis restaurée ; ligne `admin_emails` **intacte** ; aucune erreur
console/réseau. Application publique (accueil, `/catalog`, `/login`) fonctionnelle sans erreur.

## Contournements
Audit lecture seule : **0 trigger** sur `site_settings` ; **0 routine cliente** écrivant la
table ; seule `public.is_admin()` la référence (lecture seule). Aucune RPC cliente ne peut
modifier `admin_emails`.

## Récupération
La ligne `admin_emails` n'étant jamais supprimée par ce gel, un rollback consiste à recréer les
policies INSERT/UPDATE **sans** la garde de clé (état hotfix), via un rôle privilégié
(service_role/owner). Ne **jamais** recréer `site_settings_authenticated_all`. Voir le script de
récupération local hors Git.

## Déploiement & merge
- `automatic_database_migration_on_merge = false` — aucun workflow n'exécute de migration ;
  Netlify = build frontend uniquement. La fusion de la PR **ne réexécute pas** la migration.
- Compatible avec le futur modèle UUID (`app_private`), non introduit ici.
