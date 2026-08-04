# Hotfix d'urgence — Verrouillage de l'autorité admin (`site_settings`)

Migration (appliquée manuellement, **archivée** — ne pas rejouer) : `security-audit/applied-manual-sql/20260804090250_emergency_lock_admin_settings.sql`
Test : `security-audit/tests/00_emergency_hotfix_proof.sql`

## Vulnérabilité
Tout utilisateur **authentifié** pouvait modifier `public.site_settings` (policy
`site_settings_authenticated_all`, cmd ALL) — dont la ligne `admin_emails` qui sert à calculer
`public.is_admin()` — et donc **se promouvoir administrateur** (escalade de privilèges,
sévérité critique). Confirmée par preuve contrôlée (rollback).

## Périmètre du hotfix (minimal, indépendant du futur modèle UUID)
- Durcit `public.is_admin()` : `STABLE`, `SECURITY DEFINER`, `SET search_path = ''`, objets
  entièrement qualifiés, aucun paramètre, `false` si `auth.uid()`/email JWT nuls, et
  **comparaison d'email EXACTE** (découpage par virgule + `trim`/`lower`, **sans ILIKE ni
  jokers `%`/`_`**).
- Supprime la policy permissive (+ toute policy `site_settings_*` d'essai) et réserve la table
  aux administrateurs (`SELECT/INSERT/UPDATE`, `TO authenticated`, `USING/WITH CHECK is_admin()`).
- Moindre privilège SQL : `REVOKE ALL` puis `GRANT SELECT, INSERT, UPDATE` à `authenticated`
  uniquement (pas de `DELETE/TRUNCATE/REFERENCES/TRIGGER`).
- **Ne supprime pas** `admin_emails`. **Ne dépend pas** de `app_private`.

## Prérequis
- Sauvegarde (Dashboard → Database → Backups).
- Contrôle que `admin_emails` ne contient que le(s) administrateur(s) légitime(s) — voir
  diagnostics ci-dessous. En cas d'email inattendu : le retirer (service_role) **avant** le hotfix.

## Diagnostics (lecture seule ; valeurs à masquer partiellement, ne rien committer)
```sql
-- Nombre d'emails admin (sans afficher la valeur)
SELECT array_length(string_to_array(value, ','), 1) AS nb FROM site_settings WHERE key='admin_emails';
-- Emails admin correspondant à des comptes Auth réels
SELECT count(*) FROM auth.users u WHERE lower(u.email) = ANY (
  SELECT lower(btrim(x)) FROM unnest(string_to_array(
    (SELECT value FROM site_settings WHERE key='admin_emails'), ',')) x);
-- Comptes créés récemment / anomalies catalogue
SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days';
SELECT count(*) FROM products  WHERE created_at > now() - interval '7 days';
```

## Test AVANT (doit démontrer la faille)
Preuve d'exploit (rollback) — un utilisateur authentifié quelconque s'auto-promeut :
```sql
DO $$
DECLARE upd int; a2 boolean;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated","email":"attacker@evil.test"}', true);
  SET LOCAL role authenticated;
  UPDATE public.site_settings SET value = value || ',attacker@evil.test' WHERE key='admin_emails';
  GET DIAGNOSTICS upd = ROW_COUNT;
  a2 := public.is_admin();
  RESET role;
  RAISE EXCEPTION 'BEFORE updated_admin_emails_rows=% is_admin_after=% (rolled back)', upd, a2;
END $$;
```
Avant hotfix : `updated_admin_emails_rows=1`, `is_admin_after=t`. Après hotfix : `0` / `f`.
(La preuve complète et le modèle UUID final sont sur la branche de travail
`security/admin-authority-hardening`.)

## Application
**Déjà appliqué en production** (via `execute_sql`, fichier verbatim). Le script est **archivé**
sous `security-audit/applied-manual-sql/` **pour audit uniquement — ne pas le rejouer**. Ne pas
lancer `db push` global (historique local divergent) ni `migration repair` (voir
`supabase/migrations/README.md` et `security-audit/APPLIED_MANUAL_DATABASE_CHANGES.md`).

## Test APRÈS (doit démontrer le confinement)
Exécuter `tests/00_emergency_hotfix_proof.sql` (rollback) → attendu :
`user.is_admin=f; user.upd_admin_emails=0; user.upd_setting=0; admin.is_admin=t;
admin.upd_setting=1; anon.upd=DENIED; fmt_underscore=f; fmt_percent=f; ...`
Puis rejouer `01_exploit_proof.sql` : l'UPDATE d'`admin_emails` par un utilisateur ordinaire
doit désormais affecter **0 ligne**.

## Vérification administrateur
Connecté en tant qu'admin réel : ouvrir la page admin Settings, modifier un paramètre
fonctionnel (ex. `site_name`) et **enregistrer** → doit réussir.

## Récupération sûre (en cas de perte d'accès administrateur)
⚠️ **Ne JAMAIS recréer `site_settings_authenticated_all`** ni rendre `site_settings`
modifiable par tout utilisateur authentifié. La récupération ne réintroduit **jamais** la
faille. Procédure (avec un rôle opérateur privilégié — service_role / SQL owner, qui
contourne la RLS) :
1. **Intervenir avec un rôle privilégié** (service_role) — jamais via un compte client.
2. **Vérifier / restaurer la ligne `admin_emails`** : s'assurer qu'il existe **exactement une**
   ligne `key='admin_emails'` contenant l'email de l'administrateur légitime.
3. **Vérifier la correspondance Auth** : cet email doit correspondre (exact, insensible à la
   casse) à un `auth.users.email` existant.
4. **Conserver les policies admin-only** (`site_settings_admin_select/insert/update`) — ne pas
   les supprimer.
5. **Vérifier `public.is_admin()`** : `SECURITY DEFINER`, `search_path=''`, renvoie `true` pour
   l'administrateur.
6. **Ne jamais** restaurer une policy permissive.

Un script de récupération local à **placeholders** (non versionné, sans email/UUID réel) est
fourni hors dépôt : `<scratchpad>/recovery_admin_access.sql`.

## Rollback de la migration (si nécessaire, hors perte d'accès)
Préférer la **restauration du backup** pris à l'étape 0. Le retour arrière ne doit PAS
recréer la policy vulnérable. Si l'on veut simplement revenir à l'ancienne fonction email
non durcie, la recréer — mais **conserver** les policies admin-only sur `site_settings`.

## Journal d'application en production (2026-08-04)

- **Date d'application (UTC)** : 2026-08-04. *(Le hotfix étant appliqué hors historique de
  migration, l'horodatage précis n'est pas journalisé côté `schema_migrations` ; l'application
  et la validation ont eu lieu le même jour, session du 2026-08-04 UTC.)*
- **SHA-256 du SQL appliqué** : `cc6a256cc96ebe5cef087a1a9b8751711536f62d8a58e4104d5e6121576116e1`
  (identique à l'empreinte du fichier Git — envoyé **verbatim**).
- **Méthode** : `execute_sql` (Supabase MCP), **fichier envoyé verbatim** (`BEGIN;`…`COMMIT;`
  conservés — transaction pilotée par le fichier, une seule couche transactionnelle).
- **Hors historique de migration** : appliqué **hors** `supabase_migrations.schema_migrations`
  (aucune insertion manuelle dans cette table). Divergence assumée ; réconciliation ultérieure
  par une procédure séparée — **sans** `db push` / `migration repair` / `db reset`.
- **Précondition anti-verrouillage** : **réussie** (non déclenchée) → autorité admin valide
  présente au moment de l'application.
- **Transaction** : arrivée à **`COMMIT`** sans erreur (aucune persistance partielle).

### État final vérifié (post-COMMIT, valeurs non sensibles)

- **3 policies finales** sur `public.site_settings` :
  `site_settings_admin_select` (SELECT), `site_settings_admin_insert` (INSERT),
  `site_settings_admin_update` (UPDATE) — toutes `TO authenticated`,
  `USING`/`WITH CHECK ((SELECT public.is_admin()))`.
- **Grants finaux** : `authenticated` = `SELECT, INSERT, UPDATE` (aucun DELETE/TRUNCATE/
  REFERENCES/TRIGGER) ; `anon` = **aucun** ; `PUBLIC` = aucun.
- **`public.is_admin()`** : `SECURITY DEFINER`, `search_path = ''`.
- **Ancien exploit bloqué** : un utilisateur authentifié ordinaire tentant de modifier
  `admin_emails` → `attacker_upd_rows = 0`, `attacker_is_admin = f` (rejeu en rollback).

### Validation par vraie session administrateur (navigateur, production)

- **Session Supabase réelle** validée (persistée dans le navigateur, non simulée en SQL).
- **Contrôle admin côté serveur** : RPC `public.is_admin()` → HTTP 200 / `true`.
- **Interface admin** accessible.
- **Paramètre fonctionnel** (`site_tagline`) : **lecture, modification, persistance après
  rechargement, puis restauration** de la valeur initiale — toutes validées via la RLS admin.
- **Aucune donnée de test persistante** : le paramètre de test a été restauré à sa valeur
  initiale (vide) et vérifié après rechargement complet.
- **Déconnexion** : session supprimée ; accès direct aux routes admin **refusé** (redirection
  vers la connexion) ; Navbar sans accès admin ; aucune donnée admin résiduelle.
- **Aucune erreur** console ni réseau (aucun 401/403/500, aucune erreur RLS/RPC) sur le parcours.

### Limite temporaire connue

- Le champ **« Admin Emails »** reste **visible et éditable** dans la page admin Settings de
  production (frontend `main` non encore mis à jour). Ce n'est **plus** une faille d'escalade
  (la RLS bloque tout non-admin — `attacker_upd_rows = 0`), mais un admin déjà authentifié
  pourrait encore éditer `admin_emails` via ce champ. Retrait prévu par la PR frontend
  `security/remove-legacy-admin-email-ui`, puis gel SQL par
  `security/freeze-legacy-admin-authority`.

## Limites temporaires
- L'autorité reste fondée sur l'email (durci) jusqu'au modèle UUID (`app_private`) — voir la
  branche de travail `security/admin-authority-hardening` (hors périmètre de ce hotfix).
- Les policies d'écriture admin de `products/categories/brands/suppliers` ne sont pas encore
  restreintes `TO authenticated` (elles restent bloquées pour l'anon car `is_admin()=false`) :
  resserrage prévu en phase B1, pas dans ce hotfix minimal. Les lectures publiques ne
  dépendent pas de `is_admin()` → aucune régression.
