-- =============================================================================
-- CORRECTION DES POLICIES public.brands
--   (a) supprime le 401 anonyme sur la lecture des marques ;
--   (b) supprime l'écriture par tout utilisateur authentifié ordinaire.
--
-- Contexte (prouvé en lecture seule) — 3 policies avant :
--   1. "Anyone can view active brands"      SELECT PUBLIC        USING (is_active=true)   [À CONSERVER]
--   2. "Authenticated users can manage brands" ALL {authenticated} USING true / CHECK true [DANGEREUSE → DROP]
--   3. "brands_admin_write"                 ALL PUBLIC           USING/CHECK is_admin()   [→ DROP]
--
--   • (3) étant FOR ALL et TO PUBLIC, elle est évaluée au SELECT anonyme → appel de
--     is_admin() alors que `anon` n'a pas l'EXECUTE (hotfix) → 42501 → HTTP 401.
--   • (2) autorise n'importe quel utilisateur authentifié (ex. un acheteur) à écrire
--     dans brands (sur-permissif).
--
-- CORRECTION : conserver la lecture publique des marques ACTIVES, supprimer (2) et (3),
-- et créer des policies ADMIN EXPLICITES par commande, réservées au rôle `authenticated`
-- et gardées par public.is_admin().
--
-- Ce script NE modifie AUCUNE donnée, AUCUNE fonction, AUCUN grant (en particulier
-- AUCUN EXECUTE de is_admin pour anon), et AUCUNE autre table. Transactionnel + préconditions.
-- Application prévue via `execute_sql` (hors historique), puis archivage. NE PAS `db push`.
-- =============================================================================

BEGIN;

-- 0) PRÉCONDITIONS (anti-verrouillage + structure + état EXACT des policies).
--    La transaction s'annule INTÉGRALEMENT (BEGIN/COMMIT) si l'état diffère.
DO $precheck$
DECLARE
  n_isadmin int; n_valid int; brands_rls boolean;
  current_names text[];
  expected_names text[] := ARRAY[
    'Anyone can view active brands',
    'Authenticated users can manage brands',
    'brands_admin_write'
  ];  -- (ordre alphabétique = ordre de array_agg ci-dessous)
BEGIN
  -- (a) fonction d'autorité durcie présente
  SELECT count(*) INTO n_isadmin FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='is_admin' AND p.prosecdef IS TRUE
     AND EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c WHERE c LIKE 'search_path=%');
  IF n_isadmin < 1 THEN RAISE EXCEPTION 'Brands policy fix aborted: hardened public.is_admin() not found'; END IF;

  -- (b) RLS activée sur brands
  SELECT relrowsecurity INTO brands_rls FROM pg_class WHERE oid='public.brands'::regclass;
  IF NOT brands_rls THEN RAISE EXCEPTION 'Brands policy fix aborted: RLS not enabled on public.brands'; END IF;

  -- (c) ÉTAT EXACT : exactement les 3 policies attendues, ni plus ni moins.
  SELECT array_agg(policyname ORDER BY policyname) INTO current_names
   FROM pg_policies WHERE schemaname='public' AND tablename='brands';
  IF current_names IS DISTINCT FROM expected_names THEN
    RAISE EXCEPTION 'Brands policy fix aborted: brands policy set differs from the expected 3 (got %)', current_names;
  END IF;

  -- (d) une autorité administrateur valide existe (ne pas rendre brands ingérable)
  SELECT count(*) INTO n_valid FROM public.site_settings s
   CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(COALESCE(s.value,''),',') ce
   JOIN auth.users u ON pg_catalog.lower(pg_catalog.btrim(u.email))=pg_catalog.lower(pg_catalog.btrim(ce))
   WHERE s.key='admin_emails' AND pg_catalog.btrim(ce) <> '';
  IF n_valid < 1 THEN RAISE EXCEPTION 'Brands policy fix aborted: no valid administrator authority'; END IF;
END
$precheck$;

-- 1) Supprimer les policies dangereuses / ambiguës.
DROP POLICY IF EXISTS brands_admin_write ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can manage brands" ON public.brands;

-- 2) Policies admin EXPLICITES, par commande, TO authenticated, gardées par is_admin().
DROP POLICY IF EXISTS brands_admin_select ON public.brands;
DROP POLICY IF EXISTS brands_admin_insert ON public.brands;
DROP POLICY IF EXISTS brands_admin_update ON public.brands;
DROP POLICY IF EXISTS brands_admin_delete ON public.brands;
CREATE POLICY brands_admin_select ON public.brands
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY brands_admin_insert ON public.brands
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY brands_admin_update ON public.brands
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY brands_admin_delete ON public.brands
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- 3) "Anyone can view active brands" (SELECT PUBLIC USING is_active=true) est CONSERVÉE.
--    -> anon lit les marques actives sans évaluer is_admin() (plus de 401),
--       les marques inactives restent invisibles pour anon et pour l'utilisateur ordinaire.

COMMIT;
