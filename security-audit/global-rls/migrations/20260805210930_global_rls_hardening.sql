-- =============================================================================
-- DURCISSEMENT RLS GLOBAL — corrige les constats CRITICAL + HIGH.
--
-- Problème transverse : quasi toutes les tables accordent à anon ET authenticated
-- tout le DML (grants larges par défaut Supabase) ; seule la RLS protège. Or
-- plusieurs tables ont des policies permissives (`ALL ... USING true / CHECK true`
-- pour authenticated) → tout utilisateur authentifié (ex. un acheteur) peut lire /
-- modifier / supprimer des lignes qui ne lui appartiennent pas. Et `suppliers`
-- reproduit le double bug de `brands` (policy FOR ALL TO public appelant is_admin()
-- -> 401 anonyme sur la lecture).
--
-- Principes : policies explicites par commande, admin via is_admin() TO authenticated,
-- lecture publique conservée là où voulue, aucune écriture ordinaire. Ce script NE
-- modifie AUCUNE donnée, AUCUNE fonction, AUCUN grant. Transactionnel + préconditions
-- (annulation intégrale si l'état réel diffère de l'état audité).
-- Application prévue via execute_sql (hors historique) APRÈS validation. NE PAS db push.
-- =============================================================================

BEGIN;

-- 0) PRÉCONDITIONS
DO $precheck$
DECLARE n_isadmin int; miss text;
BEGIN
  SELECT count(*) INTO n_isadmin FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='is_admin' AND p.prosecdef IS TRUE
     AND EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) c WHERE c LIKE 'search_path=%');
  IF n_isadmin < 1 THEN RAISE EXCEPTION 'Global RLS hardening aborted: hardened public.is_admin() not found'; END IF;

  -- vérifier que les policies permissives auditées existent BIEN (état = état audité)
  SELECT string_agg(t.tn||'/'||t.pn, ', ') INTO miss FROM (VALUES
    ('quote_requests','Authenticated users can view quote requests'),
    ('quote_requests','Authenticated users can update quote requests'),
    ('quote_requests','Authenticated users can delete quote requests'),
    ('collaboration_requests','Authenticated users can manage collaboration requests'),
    ('suppliers','Authenticated users can manage suppliers'),
    ('suppliers','suppliers_admin_write'),
    ('product_pricing_tiers','Authenticated users can manage pricing'),
    ('product_images','Authenticated users can manage product images'),
    ('product_lots','Authenticated users can manage lots'),
    ('media','Authenticated users can insert media')
  ) AS t(tn,pn)
  WHERE NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=t.tn AND p.policyname=t.pn);
  IF miss IS NOT NULL THEN
    RAISE EXCEPTION 'Global RLS hardening aborted: expected audited policies missing (state differs): %', miss;
  END IF;
END
$precheck$;

-- =====================  quote_requests (CRITICAL)  ===========================
-- Retirer l'accès en lecture/écriture de tout authentifié ; garder la soumission
-- publique (formulaire de devis) ; administration via is_admin().
DROP POLICY IF EXISTS "Authenticated users can view quote requests"   ON public.quote_requests;
DROP POLICY IF EXISTS "Authenticated users can update quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Authenticated users can delete quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS quote_requests_admin_select ON public.quote_requests;
DROP POLICY IF EXISTS quote_requests_admin_update ON public.quote_requests;
DROP POLICY IF EXISTS quote_requests_admin_delete ON public.quote_requests;
CREATE POLICY quote_requests_admin_select ON public.quote_requests FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY quote_requests_admin_update ON public.quote_requests FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY quote_requests_admin_delete ON public.quote_requests FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
-- (conservée : "Anyone can submit quote requests" INSERT public WITH CHECK true)

-- =====================  collaboration_requests (HIGH)  =======================
DROP POLICY IF EXISTS "Authenticated users can manage collaboration requests" ON public.collaboration_requests;
DROP POLICY IF EXISTS collaboration_admin_select ON public.collaboration_requests;
DROP POLICY IF EXISTS collaboration_admin_update ON public.collaboration_requests;
DROP POLICY IF EXISTS collaboration_admin_delete ON public.collaboration_requests;
CREATE POLICY collaboration_admin_select ON public.collaboration_requests FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY collaboration_admin_update ON public.collaboration_requests FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY collaboration_admin_delete ON public.collaboration_requests FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
-- (conservée : "Anyone can submit collaboration requests" INSERT public WITH CHECK true)

-- =====================  suppliers (HIGH — miroir de brands)  =================
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS suppliers_admin_write ON public.suppliers;  -- FOR ALL TO public is_admin() -> 401 anon
DROP POLICY IF EXISTS suppliers_admin_select ON public.suppliers;
DROP POLICY IF EXISTS suppliers_admin_insert ON public.suppliers;
DROP POLICY IF EXISTS suppliers_admin_update ON public.suppliers;
DROP POLICY IF EXISTS suppliers_admin_delete ON public.suppliers;
CREATE POLICY suppliers_admin_select ON public.suppliers FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY suppliers_admin_insert ON public.suppliers FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY suppliers_admin_update ON public.suppliers FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY suppliers_admin_delete ON public.suppliers FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
-- (conservée : "Anyone can view active suppliers" SELECT public is_active=true)

-- =====================  product_pricing_tiers (HIGH)  ========================
DROP POLICY IF EXISTS "Authenticated users can manage pricing" ON public.product_pricing_tiers;
DROP POLICY IF EXISTS pricing_admin_insert ON public.product_pricing_tiers;
DROP POLICY IF EXISTS pricing_admin_update ON public.product_pricing_tiers;
DROP POLICY IF EXISTS pricing_admin_delete ON public.product_pricing_tiers;
CREATE POLICY pricing_admin_insert ON public.product_pricing_tiers FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY pricing_admin_update ON public.product_pricing_tiers FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY pricing_admin_delete ON public.product_pricing_tiers FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
-- (conservée : "Anyone can view product pricing" SELECT public true)

-- =====================  product_images (HIGH)  ==============================
DROP POLICY IF EXISTS "Authenticated users can manage product images" ON public.product_images;
DROP POLICY IF EXISTS product_images_admin_insert ON public.product_images;
DROP POLICY IF EXISTS product_images_admin_update ON public.product_images;
DROP POLICY IF EXISTS product_images_admin_delete ON public.product_images;
CREATE POLICY product_images_admin_insert ON public.product_images FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY product_images_admin_update ON public.product_images FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY product_images_admin_delete ON public.product_images FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
-- (conservée : "Anyone can view product images" SELECT public true)

-- =====================  product_lots (HIGH — écriture)  =====================
DROP POLICY IF EXISTS "Authenticated users can manage lots" ON public.product_lots;
DROP POLICY IF EXISTS lots_admin_insert ON public.product_lots;
DROP POLICY IF EXISTS lots_admin_update ON public.product_lots;
DROP POLICY IF EXISTS lots_admin_delete ON public.product_lots;
CREATE POLICY lots_admin_insert ON public.product_lots FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY lots_admin_update ON public.product_lots FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY lots_admin_delete ON public.product_lots FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
-- (conservée : "Authenticated users can view lots" SELECT authenticated true — lecture interne,
--  exposition ordinaire = MEDIUM, à décider séparément ; non modifiée ici pour rester minimal.)

-- =====================  media (MEDIUM — insert ordinaire)  ===================
DROP POLICY IF EXISTS "Authenticated users can insert media" ON public.media;
DROP POLICY IF EXISTS media_admin_insert ON public.media;
DROP POLICY IF EXISTS media_admin_update ON public.media;
DROP POLICY IF EXISTS media_admin_delete ON public.media;
CREATE POLICY media_admin_insert ON public.media FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY media_admin_update ON public.media FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY media_admin_delete ON public.media FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
-- (conservée : "Anyone can view media" SELECT public true)

COMMIT;
