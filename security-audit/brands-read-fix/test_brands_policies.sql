-- =============================================================================
-- TEST (TRANSACTION ROLLBACK) de la correction des policies public.brands.
-- Applique la correction PUIS teste, le tout annulé par le RAISE final.
-- Complément SQL des tests HTTP « vrais JWT » exécutés sur la pile Supabase locale.
--
-- Attendu :
--   anon_active   >= 1     anon_inactive = 0     anon_ins/upd/del = blocked
--   ord_active    >= 1     ord_inactive  = 0     ord_ins/upd/del  = blocked   ord_isadmin=f
--   admin_active_all counts all             admin_ins/upd/del = allowed        admin_isadmin=t
--   admin_emails/gel INCHANGÉ ; ancien exploit toujours bloqué
-- =============================================================================
BEGIN;

-- (reproduit l'état prod si besoin puis) applique la correction
DROP POLICY IF EXISTS brands_admin_write ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can manage brands" ON public.brands;
DROP POLICY IF EXISTS brands_admin_select ON public.brands;
DROP POLICY IF EXISTS brands_admin_insert ON public.brands;
DROP POLICY IF EXISTS brands_admin_update ON public.brands;
DROP POLICY IF EXISTS brands_admin_delete ON public.brands;
CREATE POLICY brands_admin_select ON public.brands FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY brands_admin_insert ON public.brands FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY brands_admin_update ON public.brands FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY brands_admin_delete ON public.brands FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

DO $t$
DECLARE
  au uuid; ae text; claims text;
  a_act int; a_inact int; a_ins text; a_upd int; a_del int;
  o_act int; o_inact int; o_ins text; o_upd int; o_del int; o_isadmin boolean;
  d_all int; d_ins text; d_upd int; d_del int; d_isadmin boolean;
  adm_ae int; ord_ae int;
BEGIN
  INSERT INTO public.brands(id,name,slug,is_active) VALUES ('99999999-9999-9999-9999-999999999999','ZZ inactive','zz-'||substr(md5(random()::text),1,6),false);

  -- ANON (n'exécute pas is_admin ; ne doit plus 401 sur SELECT)
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true); SET LOCAL ROLE anon;
  BEGIN SELECT count(*) INTO a_act FROM public.brands WHERE is_active=true; EXCEPTION WHEN others THEN a_act:=-1; END;
  BEGIN SELECT count(*) INTO a_inact FROM public.brands WHERE id='99999999-9999-9999-9999-999999999999'; EXCEPTION WHEN others THEN a_inact:=-1; END;
  BEGIN INSERT INTO public.brands(name,slug) VALUES('h','h1'); a_ins:='ALLOWED'; EXCEPTION WHEN others THEN a_ins:='blocked'; END;
  BEGIN UPDATE public.brands SET name=name WHERE is_active=true; GET DIAGNOSTICS a_upd=ROW_COUNT; EXCEPTION WHEN others THEN a_upd:=-1; END;
  BEGIN DELETE FROM public.brands WHERE is_active=true; GET DIAGNOSTICS a_del=ROW_COUNT; EXCEPTION WHEN others THEN a_del:=-1; END;
  RESET ROLE;

  -- ORDINAIRE
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000cc","role":"authenticated","email":"u@x.test"}',true); SET LOCAL ROLE authenticated;
  o_isadmin:=public.is_admin();
  BEGIN SELECT count(*) INTO o_act FROM public.brands WHERE is_active=true; EXCEPTION WHEN others THEN o_act:=-1; END;
  BEGIN SELECT count(*) INTO o_inact FROM public.brands WHERE id='99999999-9999-9999-9999-999999999999'; EXCEPTION WHEN others THEN o_inact:=-1; END;
  BEGIN INSERT INTO public.brands(name,slug) VALUES('h','h2'); o_ins:='ALLOWED'; EXCEPTION WHEN others THEN o_ins:='blocked'; END;
  BEGIN UPDATE public.brands SET name=name WHERE is_active=true; GET DIAGNOSTICS o_upd=ROW_COUNT; EXCEPTION WHEN others THEN o_upd:=-1; END;
  BEGIN DELETE FROM public.brands WHERE is_active=true; GET DIAGNOSTICS o_del=ROW_COUNT; EXCEPTION WHEN others THEN o_del:=-1; END;
  RESET ROLE;

  -- ADMIN
  SELECT u.id,u.email INTO au,ae FROM public.site_settings s
    CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(COALESCE(s.value,''),',') ce
    JOIN auth.users u ON pg_catalog.lower(pg_catalog.btrim(u.email))=pg_catalog.lower(pg_catalog.btrim(ce))
    WHERE s.key='admin_emails' AND pg_catalog.btrim(ce)<>'' LIMIT 1;
  claims:=json_build_object('sub',au,'role','authenticated','email',ae)::text;
  PERFORM set_config('request.jwt.claims',claims,true); SET LOCAL ROLE authenticated;
  d_isadmin:=public.is_admin();
  BEGIN SELECT count(*) INTO d_all FROM public.brands; EXCEPTION WHEN others THEN d_all:=-1; END;
  BEGIN INSERT INTO public.brands(name,slug) VALUES('adminbrand','ab-'||substr(md5(random()::text),1,6)); d_ins:='allowed'; EXCEPTION WHEN others THEN d_ins:='BLOCKED'; END;
  BEGIN UPDATE public.brands SET name=name WHERE is_active=true; GET DIAGNOSTICS d_upd=ROW_COUNT; EXCEPTION WHEN others THEN d_upd:=-1; END;
  BEGIN DELETE FROM public.brands WHERE id='99999999-9999-9999-9999-999999999999'; GET DIAGNOSTICS d_del=ROW_COUNT; EXCEPTION WHEN others THEN d_del:=-1; END;
  BEGIN UPDATE public.site_settings SET value=value WHERE key='admin_emails'; GET DIAGNOSTICS adm_ae=ROW_COUNT; EXCEPTION WHEN others THEN adm_ae:=-1; END;
  RESET ROLE;

  -- ORDINAIRE : ancien exploit admin_emails
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000cc","role":"authenticated","email":"u@x.test"}',true); SET LOCAL ROLE authenticated;
  BEGIN UPDATE public.site_settings SET value=value||',x' WHERE key='admin_emails'; GET DIAGNOSTICS ord_ae=ROW_COUNT; EXCEPTION WHEN others THEN ord_ae:=-1; END;
  RESET ROLE;

  RAISE EXCEPTION E'ANON act=% inact=% ins=% upd=% del=% | ORD isadmin=% act=% inact=% ins=% upd=% del=% | ADMIN isadmin=% all=% ins=% upd=% del=% ae_upd=% | exploit_ord_ae=%',
    a_act,a_inact,a_ins,a_upd,a_del, o_isadmin,o_act,o_inact,o_ins,o_upd,o_del, d_isadmin,d_all,d_ins,d_upd,d_del,adm_ae, ord_ae;
END $t$;
COMMIT;
