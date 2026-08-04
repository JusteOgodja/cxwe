-- =============================================================================
-- HOTFIX D'URGENCE — Verrouillage de l'autorité admin (site_settings).
--
-- Ferme immédiatement l'escalade de privilèges : tout utilisateur authentifié
-- pouvait modifier site_settings.admin_emails (la donnée servant à calculer
-- is_admin()) et se promouvoir administrateur.
--
-- Ce hotfix est MINIMAL et INDÉPENDANT du futur modèle UUID (app_private) :
--   - durcit public.is_admin() (comparaison d'email EXACTE, search_path='') ;
--   - supprime la policy permissive et réserve site_settings aux admins ;
--   - applique le moindre privilège sur la table ;
--   - ne supprime PAS la ligne admin_emails ;
--   - ne touche PAS aux fonctionnalités publiques (aucune lecture publique de
--     site_settings ; seule la page admin Settings l'utilise).
--
-- Forward-only. Idempotent (DROP ... IF EXISTS, CREATE OR REPLACE).
-- PRÉREQUIS opérateur : vérifier AVANT que admin_emails ne contient que le(s)
-- administrateur(s) légitime(s) (voir security-audit/EMERGENCY_HOTFIX.md).
-- =============================================================================

-- 1) Fonction d'autorité durcie. Comparaison d'email EXACTE (pas d'ILIKE / pas
--    de jokers), après découpage de la liste et normalisation (trim + lower).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND (auth.jwt() ->> 'email') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.site_settings AS s
      CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(
        COALESCE(s.value, ''), ','
      ) AS configured_email
      WHERE s.key = 'admin_emails'
        AND pg_catalog.lower(pg_catalog.btrim(configured_email))
            = pg_catalog.lower(pg_catalog.btrim(auth.jwt() ->> 'email'))
    );
$$;

-- Droits d'exécution : moindre privilège.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2) RLS active (site_settings) + suppression de TOUTES les policies connues
--    (permissives ou admin-only créées lors d'essais).
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_settings_authenticated_all    ON public.site_settings;
DROP POLICY IF EXISTS site_settings_authenticated_select ON public.site_settings;
DROP POLICY IF EXISTS site_settings_admin_read           ON public.site_settings;
DROP POLICY IF EXISTS site_settings_admin_write          ON public.site_settings;
DROP POLICY IF EXISTS site_settings_admin_select         ON public.site_settings;
DROP POLICY IF EXISTS site_settings_admin_insert         ON public.site_settings;
DROP POLICY IF EXISTS site_settings_admin_update         ON public.site_settings;

-- 3) Moindre privilège SQL : aucun DELETE/TRUNCATE/REFERENCES/TRIGGER côté client.
--    On conserve SELECT/INSERT/UPDATE (upsert de la page admin Settings).
REVOKE ALL ON TABLE public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.site_settings TO authenticated;

-- 4) Policies ADMIN-ONLY explicites, restreintes au rôle authenticated.
--    Anonyme : aucun grant, aucune policy applicable -> aucun accès.
CREATE POLICY site_settings_admin_select ON public.site_settings
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY site_settings_admin_insert ON public.site_settings
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY site_settings_admin_update ON public.site_settings
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
