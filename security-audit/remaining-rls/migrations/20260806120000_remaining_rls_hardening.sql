-- =============================================================================
-- LOT RESTANT — MEDIUM + LOW (+ 1 HIGH reclassé)
--
-- Complète le durcissement RLS global (déjà appliqué). Corrige :
--   M2  buyer_profiles : policy admin_read TO public appelant is_admin() (anti-pattern
--       anon-401) + policies dupliquées ; resserrage des policies propriétaire.
--   M3  privilèges EXECUTE des RPC : retrait d'anon sur les RPC admin/recherche
--       (moindre privilège ; conservation de authenticated).
--   HIGH refresh_product_counts : fonction TRIGGER (REFRESH MATERIALIZED VIEW, effet de
--       bord coûteux) exécutable en RPC direct par tout authenticated sans contrôle
--       d'administration → EXECUTE retiré à anon + authenticated + public (seul le
--       contexte trigger l'exécute ; les triggers n'ont pas besoin du privilège EXECUTE).
--   L3  search_path fixe sur les RPC applicatives (INVOKER).
--   M4  grants DML larges d'anon : whitelist des seules opérations publiques réelles
--       (SELECT lecture publique + INSERT formulaires devis/collaboration).
--   L2  policies admin categories/products TO public -> authenticated (cosmétique/propre).
--
-- AUCUN changement de données. AUCUN élargissement d'accès. AUCUN modèle UUID admin.
-- Transactionnel + préconditions (annulation intégrale si l'état réel diffère).
-- Application prévue via execute_sql (hors historique) APRÈS validation. NE PAS db push.
-- =============================================================================

BEGIN;

-- 0) PRÉCONDITIONS -----------------------------------------------------------
DO $precheck$
DECLARE n int; miss text;
BEGIN
  -- is_admin durci
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname='is_admin' AND p.prosecdef
     AND EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) c WHERE c LIKE 'search_path=%');
  IF n < 1 THEN RAISE EXCEPTION 'aborted: hardened is_admin() not found'; END IF;

  -- buyer_profiles : état audité attendu (6 policies nommées)
  SELECT string_agg(v.pn, ', ') INTO miss FROM (VALUES
    ('Buyers can insert their own profile'),('buyer_profiles_insert_own'),
    ('Buyers can read their own profile'),('buyer_profiles_select_own'),
    ('buyer_profiles_admin_read'),('Buyers can update their own profile')
  ) AS v(pn)
  WHERE NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
                    AND p.tablename='buyer_profiles' AND p.policyname=v.pn);
  IF miss IS NOT NULL THEN RAISE EXCEPTION 'aborted: buyer_profiles policy state differs (missing: %)', miss; END IF;

  -- anon possède encore les grants larges (état pré-M4)
  IF NOT has_table_privilege('anon','public.products','UPDATE') THEN
    RAISE EXCEPTION 'aborted: expected wide anon grants not present (state differs)';
  END IF;
END
$precheck$;

-- =====================  M2 + L1 : buyer_profiles  ===========================
-- Règles métier (frontend) : anon aucun accès ; propriétaire lit/insère/màj SA ligne
-- (user_id = auth.uid()) ; autre utilisateur aucun accès ; admin lit tout.
DROP POLICY IF EXISTS "Buyers can insert their own profile" ON public.buyer_profiles;  -- doublon
DROP POLICY IF EXISTS "buyer_profiles_insert_own"          ON public.buyer_profiles;
DROP POLICY IF EXISTS "Buyers can read their own profile"  ON public.buyer_profiles;    -- doublon
DROP POLICY IF EXISTS "buyer_profiles_select_own"          ON public.buyer_profiles;
DROP POLICY IF EXISTS "buyer_profiles_admin_read"          ON public.buyer_profiles;    -- TO public is_admin() -> anon 401
DROP POLICY IF EXISTS "Buyers can update their own profile" ON public.buyer_profiles;
-- recréation resserrée (TO authenticated ; WITH CHECK sur UPDATE pour empêcher de
-- réattribuer user_id à autrui)
CREATE POLICY buyer_profiles_insert_own ON public.buyer_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY buyer_profiles_select_own ON public.buyer_profiles
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY buyer_profiles_update_own ON public.buyer_profiles
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY buyer_profiles_admin_read ON public.buyer_profiles
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

-- =====================  M3 + HIGH + L3 : RPC  ===============================
-- Recherche/qualité/admin : retirer anon (moindre privilège), garder authenticated.
REVOKE EXECUTE ON FUNCTION public.get_quality_stats()                        FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_products_with_issues(integer)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.count_brands_no_active_products()          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.count_categories_no_active_products()      FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.search_products(text,uuid,uuid,boolean,integer,integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_source_sites()                        FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_quality_stats()                        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_products_with_issues(integer)          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.count_brands_no_active_products()          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.count_categories_no_active_products()      TO authenticated;
GRANT  EXECUTE ON FUNCTION public.search_products(text,uuid,uuid,boolean,integer,integer) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.list_source_sites()                        TO authenticated;

-- HIGH : refresh_product_counts est une fonction TRIGGER à effet de bord ; aucun appel
-- RPC frontend. Retirer EXECUTE à tous les rôles clients (le trigger reste fonctionnel).
REVOKE EXECUTE ON FUNCTION public.refresh_product_counts() FROM anon, authenticated, public;

-- L3 : search_path fixe (INVOKER) — résolution de schéma déterministe, non-comportemental.
ALTER FUNCTION public.get_quality_stats()                        SET search_path = public, pg_temp;
ALTER FUNCTION public.get_products_with_issues(integer)          SET search_path = public, pg_temp;
ALTER FUNCTION public.count_brands_no_active_products()          SET search_path = public, pg_temp;
ALTER FUNCTION public.count_categories_no_active_products()      SET search_path = public, pg_temp;
ALTER FUNCTION public.search_products(text,uuid,uuid,boolean,integer,integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.list_source_sites()                        SET search_path = public, pg_temp;
ALTER FUNCTION public.refresh_product_counts()                   SET search_path = public, pg_temp;

-- =====================  M4 : grants anon (whitelist)  =======================
-- Retirer tout DML/DDL-léger d'anon sur toutes les tables applicatives, puis ne
-- re-accorder QUE les opérations publiques réellement utilisées par le frontend.
DO $g$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brands','buyer_profiles','categories','collaboration_requests','media',
    'product_images','product_lots','product_pricing_tiers','products','quote_requests','suppliers']
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon', t);
  END LOOP;
END $g$;
-- SELECT public : conservé sur les tables à lecture publique ; retiré ailleurs.
REVOKE SELECT ON public.buyer_profiles         FROM anon;  -- privé
REVOKE SELECT ON public.product_lots           FROM anon;  -- lecture authenticated seulement
REVOKE SELECT ON public.quote_requests         FROM anon;  -- admin-only (INSERT via policy public conservé)
REVOKE SELECT ON public.collaboration_requests FROM anon;  -- admin-only
-- INSERT public des formulaires (réellement utilisés) : re-accordés explicitement.
GRANT INSERT ON public.quote_requests         TO anon;
GRANT INSERT ON public.collaboration_requests TO anon;
-- (conservés implicitement : SELECT sur products, categories, brands, suppliers,
--  product_pricing_tiers, product_images, media — lecture publique du catalogue.)

-- =====================  L2 : categories/products admin -> authenticated  =====
-- Policies d'écriture admin en rôle public -> authenticated (anon ne peut de toute
-- façon plus écrire après M4 ; évite l'évaluation is_admin() sur tentative anon).
DROP POLICY IF EXISTS categories_admin_insert ON public.categories;
DROP POLICY IF EXISTS categories_admin_update ON public.categories;
DROP POLICY IF EXISTS categories_admin_delete ON public.categories;
CREATE POLICY categories_admin_insert ON public.categories FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY categories_admin_update ON public.categories FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY categories_admin_delete ON public.categories FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS products_admin_insert ON public.products;
DROP POLICY IF EXISTS products_admin_update ON public.products;
DROP POLICY IF EXISTS products_admin_delete ON public.products;
CREATE POLICY products_admin_insert ON public.products FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY products_admin_update ON public.products FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY products_admin_delete ON public.products FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

COMMIT;
