-- =============================================================================
-- Phase B (1/2) — Bascule vers l'autorité privée + confinement de site_settings.
--
-- ⚠️ NE PAS APPLIQUER avant d'avoir inséré au moins un administrateur dans
--    app_private.administrators (bootstrap, voir DEPLOYMENT). Sinon, plus personne
--    n'est admin et les écritures catalogue/settings sont verrouillées.
-- =============================================================================

-- 1) Neutralise l'ancienne autorité par email : public.is_admin() délègue
--    désormais à l'autorité privée. Plus aucune dépendance à site_settings ni à
--    l'email du JWT. search_path fixé (durcissement).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_admin();
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2) Rebascule EXPLICITE de toutes les policies admin sur app_private.is_admin().
--    (Recréées à l'identique, pointant la fonction privée.)

-- buyer_profiles (lecture admin ; les policies "own" existantes sont conservées)
DROP POLICY IF EXISTS buyer_profiles_admin_read ON public.buyer_profiles;
CREATE POLICY buyer_profiles_admin_read ON public.buyer_profiles
  FOR SELECT USING ((SELECT public.is_admin()));

-- categories
DROP POLICY IF EXISTS categories_admin_insert ON public.categories;
DROP POLICY IF EXISTS categories_admin_update ON public.categories;
DROP POLICY IF EXISTS categories_admin_delete ON public.categories;
CREATE POLICY categories_admin_insert ON public.categories FOR INSERT WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY categories_admin_update ON public.categories FOR UPDATE USING ((SELECT public.is_admin()));
CREATE POLICY categories_admin_delete ON public.categories FOR DELETE USING ((SELECT public.is_admin()));

-- products
DROP POLICY IF EXISTS products_admin_insert ON public.products;
DROP POLICY IF EXISTS products_admin_update ON public.products;
DROP POLICY IF EXISTS products_admin_delete ON public.products;
CREATE POLICY products_admin_insert ON public.products FOR INSERT WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY products_admin_update ON public.products FOR UPDATE USING ((SELECT public.is_admin()));
CREATE POLICY products_admin_delete ON public.products FOR DELETE USING ((SELECT public.is_admin()));

-- brands & suppliers
DROP POLICY IF EXISTS brands_admin_write ON public.brands;
CREATE POLICY brands_admin_write ON public.brands
  FOR ALL USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS suppliers_admin_write ON public.suppliers;
CREATE POLICY suppliers_admin_write ON public.suppliers
  FOR ALL USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- 3) CONFINEMENT de site_settings : suppression du vecteur d'écriture ouvert à
--    tout utilisateur authentifié + révocation des privilèges DML.
DROP POLICY IF EXISTS site_settings_authenticated_all ON public.site_settings;
DROP POLICY IF EXISTS site_settings_authenticated_select ON public.site_settings;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.site_settings FROM anon, authenticated, PUBLIC;

-- Lecture + écriture réservées aux admins (seule la page admin Settings l'utilise ;
-- aucune lecture publique de site_settings côté site). La protection ne dépend PAS
-- de site_settings lui-même (elle passe par app_private.administrators) -> pas de
-- dépendance circulaire.
CREATE POLICY site_settings_admin_read  ON public.site_settings
  FOR SELECT USING ((SELECT public.is_admin()));
CREATE POLICY site_settings_admin_write ON public.site_settings
  FOR ALL USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
