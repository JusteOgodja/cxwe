# Deployment — Bascule vers l'autorité admin privée

⚠️ **Aucune migration ne doit être appliquée en production sans validation explicite.**
Ordre impératif pour ne jamais se retrouver sans administrateur.

## 0. Sauvegarde préalable
- Snapshot/backup de la base (Supabase Dashboard → Database → Backups) **avant** toute étape.
- Noter l'état actuel : `admin_emails` présent dans `site_settings`, `public.is_admin()` email-based.

## Phase A — Créer le modèle privé (non destructif)
Appliquer **uniquement** :
```
supabase/migrations/20260802000001_create_private_admin_authority.sql
```
Effet : crée `app_private` (scellé), `app_private.administrators`, `app_private.is_admin()`,
`public.current_user_is_admin()`. **L'ancienne autorité par email reste active** — le site
continue de fonctionner normalement. On peut s'arrêter ici sans risque.

## Bootstrap — Insérer le premier administrateur (manuel, NON versionné)
1. Récupérer l'UUID Supabase du **véritable administrateur** (Dashboard → Authentication →
   Users, ou `SELECT id FROM auth.users WHERE email = '<admin>'`). **Ne pas** le committer,
   ni l'afficher dans un rapport, ni le déduire de `admin_emails` (table compromise).
2. Exécuter localement (SQL editor), en remplaçant le placeholder :
```sql
INSERT INTO app_private.administrators (user_id)
VALUES ('REPLACE_WITH_CONFIRMED_ADMIN_UUID')
ON CONFLICT (user_id) DO NOTHING;
```
3. **Vérifier** qu'au moins un admin existe **et** que c'est le bon :
```sql
SELECT count(*) AS nb_admins FROM app_private.administrators;   -- doit être >= 1
```
Si `nb_admins = 0`, **NE PAS** passer en Phase B (risque de verrouillage total).

## Phase B — Basculer les policies + confiner site_settings
Seulement **après** bootstrap validé. Appliquer, dans l'ordre :
```
supabase/migrations/20260802000002_switch_admin_policies.sql
supabase/migrations/20260802000003_remove_legacy_admin_emails.sql
```
Effet : les 9 policies passent sur `public.is_admin()` (nouvelle autorité) ; `site_settings`
n'est plus écrivable par un simple `authenticated` ; `public.is_admin()` ne lit plus l'email ;
la ligne `admin_emails` est supprimée.

## Déploiement frontend (coordonné)
Déployer le frontend (branche/PR sécurité) **en même temps ou après** la Phase B. Les écrans
admin utilisent désormais la RPC `current_user_is_admin()`. Si le frontend est déployé **avant**
la Phase A, l'admin verra simplement le menu admin masqué (fail-closed) — les données restent
protégées.

## Vérifications après déploiement
```sql
-- 1) L'exploit ne fonctionne plus (doit afficher updated=0 / bloqué) : rejouer
--    tests/01_exploit_proof.sql -> l'UPDATE doit échouer (permission denied / RLS).
-- 2) Le bon admin est reconnu :
SELECT public.is_admin();          -- connecté en tant qu'admin -> true
-- 3) Un acheteur ordinaire -> public.is_admin() = false, écritures catalogue refusées.
-- 4) site_settings : plus de policy 'authenticated_all'
SELECT policyname, cmd FROM pg_policies WHERE tablename='site_settings';
-- 5) Fonctions SECURITY DEFINER durcies :
SELECT proname, proconfig FROM pg_proc WHERE proname IN ('is_admin','current_user_is_admin');
```
Contrôles fonctionnels : connexion admin OK, catalogue public OK, formulaire devis OK, un
acheteur ne voit pas l'admin, aucune 401/403 nouvelle sur les requêtes publiques.

## Rollback
- **Après Phase A seule** : `DROP SCHEMA app_private CASCADE; DROP FUNCTION public.current_user_is_admin();`
  (l'ancienne autorité n'a pas été touchée → site inchangé).
- **Après Phase B** : restaurer le backup pré-déploiement, **ou** rejouer une migration inverse
  recréant les anciennes policies `site_settings_authenticated_*` et l'ancienne
  `public.is_admin()` email-based + réinsérer `admin_emails`. ⚠️ Ce rollback **réintroduit la
  vulnérabilité** — à n'utiliser qu'en urgence, temporairement.

## Actions manuelles nécessaires (récap)
1. Backup base.
2. Appliquer migration A.
3. Insérer l'UUID admin réel (bootstrap, non versionné) + vérifier `nb_admins >= 1`.
4. Appliquer migrations B (0002 puis 0003).
5. Déployer le frontend sécurité.
6. Rejouer les vérifications + l'exploit (doit échouer).
7. (Optionnel) Retirer `VITE_ADMIN_EMAILS` des variables Netlify (plus utilisée).
8. Rotation des secrets Supabase recommandée (clé service_role / mot de passe DB exposés
   lors de sessions précédentes).
