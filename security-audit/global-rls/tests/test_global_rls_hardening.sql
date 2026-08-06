-- =============================================================================
-- TEST (ROLLBACK) du durcissement RLS global. Applique la migration puis teste,
-- le tout annulé par le RAISE final. À exécuter sur pile locale/staging (vrais JWT
-- recommandés pour Auth/PostgREST ; ici rôles simulés en complément).
--
-- Attendu (résumé) :
--   anon        : suppliers actifs LISIBLES ; quote/collaboration/buyer_profiles NON lisibles ;
--                 aucune écriture.
--   ordinaire   : is_admin=false ; NE peut PAS lire quote_requests/collaboration_requests ;
--                 NE peut PAS écrire suppliers/pricing/images/lots/media/quote/collaboration.
--   admin       : is_admin=true ; lit/gère toutes ces tables.
--   isolation   : un acheteur ne voit pas le profil d'un autre (buyer_profiles).
-- =============================================================================
BEGIN;
\i 20260805210930_global_rls_hardening.sql  -- (ou coller le corps de la migration ici)

DO $t$
DECLARE
  au uuid; ae text; claims text; r int;
  anon_suppliers int; anon_quotes int;
  ord_quotes int; ord_pricing_upd int; ord_suppliers_ins text; ord_isadmin boolean;
  adm_quotes int; adm_suppliers_ins text; adm_isadmin boolean;
BEGIN
  -- ANON
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true); SET LOCAL ROLE anon;
  BEGIN SELECT count(*) INTO anon_suppliers FROM public.suppliers WHERE is_active=true; EXCEPTION WHEN others THEN anon_suppliers:=-1; END;
  BEGIN SELECT count(*) INTO anon_quotes FROM public.quote_requests; EXCEPTION WHEN others THEN anon_quotes:=-1; END;
  RESET ROLE;

  -- ORDINAIRE
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000cc","role":"authenticated","email":"u@x.test"}',true); SET LOCAL ROLE authenticated;
  ord_isadmin:=public.is_admin();
  BEGIN SELECT count(*) INTO ord_quotes FROM public.quote_requests; EXCEPTION WHEN others THEN ord_quotes:=-1; END;
  BEGIN UPDATE public.product_pricing_tiers SET price=price; GET DIAGNOSTICS ord_pricing_upd=ROW_COUNT; EXCEPTION WHEN others THEN ord_pricing_upd:=-1; END;
  BEGIN INSERT INTO public.suppliers(name) VALUES('hack'); ord_suppliers_ins:='ALLOWED'; EXCEPTION WHEN others THEN ord_suppliers_ins:='blocked'; END;
  RESET ROLE;

  -- ADMIN
  SELECT u.id,u.email INTO au,ae FROM public.site_settings s
    CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(COALESCE(s.value,''),',') ce
    JOIN auth.users u ON pg_catalog.lower(pg_catalog.btrim(u.email))=pg_catalog.lower(pg_catalog.btrim(ce))
    WHERE s.key='admin_emails' AND pg_catalog.btrim(ce)<>'' LIMIT 1;
  claims:=json_build_object('sub',au,'role','authenticated','email',ae)::text;
  PERFORM set_config('request.jwt.claims',claims,true); SET LOCAL ROLE authenticated;
  adm_isadmin:=public.is_admin();
  BEGIN SELECT count(*) INTO adm_quotes FROM public.quote_requests; EXCEPTION WHEN others THEN adm_quotes:=-1; END;
  BEGIN INSERT INTO public.suppliers(name) VALUES('adminsupp'); adm_suppliers_ins:='allowed'; EXCEPTION WHEN others THEN adm_suppliers_ins:='BLOCKED'; END;
  RESET ROLE;

  RAISE EXCEPTION E'ANON suppliers=% quotes=% | ORD isadmin=% quotes=% pricing_upd=% suppliers_ins=% | ADMIN isadmin=% quotes=% suppliers_ins=%',
    anon_suppliers, anon_quotes, ord_isadmin, ord_quotes, ord_pricing_upd, ord_suppliers_ins, adm_isadmin, adm_quotes, adm_suppliers_ins;
END $t$;
COMMIT;
