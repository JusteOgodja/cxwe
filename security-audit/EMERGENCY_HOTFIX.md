# Hotfix d'urgence — Verrouillage de l'autorité admin (`site_settings`)

Migration : `supabase/migrations/20260804090250_emergency_lock_admin_settings.sql`
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
Appliquer **uniquement** `20260804090250_emergency_lock_admin_settings.sql` (SQL editor ou
`supabase db push` ciblé). Ne pas lancer `db push` global (historique local divergent) ni
`migration repair`.

## Test APRÈS (doit démontrer le confinement)
Exécuter `tests/00_emergency_hotfix_proof.sql` (rollback) → attendu :
`user.is_admin=f; user.upd_admin_emails=0; user.upd_setting=0; admin.is_admin=t;
admin.upd_setting=1; anon.upd=DENIED; fmt_underscore=f; fmt_percent=f; ...`
Puis rejouer `01_exploit_proof.sql` : l'UPDATE d'`admin_emails` par un utilisateur ordinaire
doit désormais affecter **0 ligne**.

## Vérification administrateur
Connecté en tant qu'admin réel : ouvrir la page admin Settings, modifier un paramètre
fonctionnel (ex. `site_name`) et **enregistrer** → doit réussir.

## Rollback
Recréer l'ancienne policy (⚠️ **réintroduit la faille**, urgence seulement) :
```sql
CREATE POLICY site_settings_authenticated_all ON public.site_settings
  FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');
```
(et éventuellement restaurer l'ancienne `public.is_admin()` ILIKE). Préférer la restauration
du backup.

## Limites temporaires
- L'autorité reste fondée sur l'email (durci) jusqu'au modèle UUID (`app_private`) — voir la
  branche de travail `security/admin-authority-hardening` (hors périmètre de ce hotfix).
- Les policies d'écriture admin de `products/categories/brands/suppliers` ne sont pas encore
  restreintes `TO authenticated` (elles restent bloquées pour l'anon car `is_admin()=false`) :
  resserrage prévu en phase B1, pas dans ce hotfix minimal. Les lectures publiques ne
  dépendent pas de `is_admin()` → aucune régression.
