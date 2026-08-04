-- =============================================================================
-- GEL DE L'AUTORITÉ HISTORIQUE — ligne site_settings.admin_emails.
--
-- Objectif : empêcher TOUTE modification cliente de la ligne `admin_emails`,
-- y compris par un administrateur authentifié via l'interface, tout en laissant
-- l'administrateur gérer normalement TOUS les autres paramètres.
--
-- Ce gel :
--   - NE supprime PAS la ligne admin_emails (is_admin() en a encore besoin en
--     transitoire ; la fonction la lit en SECURITY DEFINER, hors RLS) ;
--   - interdit INSERT / UPDATE / DELETE de cette clé depuis les rôles clients ;
--   - autorise l'administrateur à insérer / modifier les AUTRES clés ;
--   - conserve le fonctionnement du site public (anon : aucun grant, aucun accès) ;
--   - reste compatible avec le futur modèle UUID (app_private), qu'il n'introduit pas.
--
-- Forward-only. Idempotent (DROP ... IF EXISTS, CREATE). La récupération de
-- l'autorité reste possible UNIQUEMENT via un rôle opérateur privilégié
-- (service_role / owner, qui contourne la RLS) + le script de récupération hors Git.
-- =============================================================================

BEGIN;

-- 0) PRÉCONDITION ANTI-VERROUILLAGE — interrompt la migration AVANT tout DROP/CREATE
--    si l'état d'autorité n'est pas sûr (ne jamais geler dans un état incohérent).
--    Vérifie : (a) exactement UNE ligne admin_emails ; (b) au moins une entrée non
--    vide ; (c) au moins une entrée correspondant à un compte auth.users ;
--    (d) fonction d'autorité durcie présente (SECURITY DEFINER + search_path figé) ;
--    (e) les 3 policies admin du hotfix présentes ; (f) policy vulnérable absente.
--    Aucune valeur sensible n'est journalisée : exception générique uniquement.
DO $precheck$
DECLARE
  n_rows    integer;
  n_valid   integer;
  n_isadmin integer;
  n_hotfix  integer;
  n_vuln    integer;
BEGIN
  -- (a) exactement une ligne admin_emails
  SELECT count(*) INTO n_rows
  FROM public.site_settings
  WHERE key = 'admin_emails';
  IF n_rows <> 1 THEN
    RAISE EXCEPTION 'Freeze aborted: administrator authority precondition not met';
  END IF;

  -- (b)+(c) au moins une entrée non vide correspondant à un compte auth.users
  SELECT count(*) INTO n_valid
  FROM public.site_settings AS s
  CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(COALESCE(s.value, ''), ',') AS configured_email
  JOIN auth.users AS u
    ON pg_catalog.lower(pg_catalog.btrim(u.email))
     = pg_catalog.lower(pg_catalog.btrim(configured_email))
  WHERE s.key = 'admin_emails'
    AND pg_catalog.btrim(configured_email) <> '';
  IF n_valid < 1 THEN
    RAISE EXCEPTION 'Freeze aborted: administrator authority precondition not met';
  END IF;

  -- (d) fonction d'autorité durcie présente (SECURITY DEFINER + search_path figé)
  SELECT count(*) INTO n_isadmin
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'is_admin'
    AND p.prosecdef IS TRUE
    AND EXISTS (
      SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS c
      WHERE c LIKE 'search_path=%'
    );
  IF n_isadmin < 1 THEN
    RAISE EXCEPTION 'Freeze aborted: administrator authority precondition not met';
  END IF;

  -- (e) les 3 policies admin du hotfix sont présentes
  SELECT count(*) INTO n_hotfix
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'site_settings'
    AND policyname IN (
      'site_settings_admin_select',
      'site_settings_admin_insert',
      'site_settings_admin_update'
    );
  IF n_hotfix <> 3 THEN
    RAISE EXCEPTION 'Freeze aborted: administrator authority precondition not met';
  END IF;

  -- (f) la policy vulnérable historique est absente
  SELECT count(*) INTO n_vuln
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'site_settings'
    AND policyname = 'site_settings_authenticated_all';
  IF n_vuln <> 0 THEN
    RAISE EXCEPTION 'Freeze aborted: administrator authority precondition not met';
  END IF;
END
$precheck$;

-- 1) Remplacer les policies INSERT et UPDATE par des versions gardées par clé.
--    (La policy SELECT admin reste inchangée : l'administrateur lit tous les
--     paramètres, y compris admin_emails, utile au fonctionnement transitoire.)
DROP POLICY IF EXISTS site_settings_admin_insert ON public.site_settings;
DROP POLICY IF EXISTS site_settings_admin_update ON public.site_settings;

-- INSERT : administrateur uniquement, et JAMAIS la clé gelée.
--   -> bloque la création d'une nouvelle ligne admin_emails.
CREATE POLICY site_settings_admin_insert ON public.site_settings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) AND key <> 'admin_emails');

-- UPDATE : administrateur uniquement ; la ligne EXISTANTE ne doit pas être
-- admin_emails (USING) ET la NOUVELLE ligne ne doit pas devenir admin_emails
-- (WITH CHECK). Cela bloque simultanément :
--   - la modification de la valeur d'admin_emails (USING exclut la ligne) ;
--   - le renommage de la ligne admin_emails vers une autre clé (USING) ;
--   - le renommage d'une autre clé vers admin_emails (WITH CHECK).
CREATE POLICY site_settings_admin_update ON public.site_settings
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) AND key <> 'admin_emails')
  WITH CHECK ((SELECT public.is_admin()) AND key <> 'admin_emails');

-- 2) DELETE : inchangé — aucune policy DELETE et aucun grant DELETE côté client
--    (hérité du hotfix). Aucun rôle client ne peut supprimer de ligne.
--    Rien à faire ici ; documenté pour explicitation.

-- 3) SELECT : inchangé (site_settings_admin_select, USING is_admin()).
--    is_admin() lit admin_emails en SECURITY DEFINER (hors RLS) -> non affecté.

COMMIT;
