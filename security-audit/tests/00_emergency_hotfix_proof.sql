-- =============================================================================
-- PREUVE DU HOTFIX — migration 20260804090250_emergency_lock_admin_settings.sql
--
-- Table isolée public._hf_settings + fonction _hf_is_admin() reproduisant
-- EXACTEMENT la logique du hotfix (comparaison d'email exacte via
-- regexp_split_to_table, trim+lower, aucun joker). RAISE EXCEPTION => ROLLBACK
-- GARANTI. Aucun email/UUID réel commité (emails de test uniquement).
--
-- Résultat attendu (et observé) :
--  user.is_admin=f; user.upd_admin_emails=0; user.upd_setting=0;
--  admin.is_admin=t; admin.upd_setting=1; anon.upd=DENIED;
--  fmt_space=t; fmt_case=t; fmt_underscore=f; fmt_percent=f; fmt_exact_underscore=t;
--  fmt_empty=f; fmt_null_email=f; fmt_null_uid=f
-- =============================================================================
DO $$
DECLARE r text := ''; b boolean; n int;
BEGIN
  CREATE TABLE public._hf_settings(key text PRIMARY KEY, value text NOT NULL DEFAULT '');
  INSERT INTO public._hf_settings(key,value) VALUES ('admin_emails','admin@test'), ('site_name','X');
  ALTER TABLE public._hf_settings ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public._hf_settings FROM PUBLIC, anon, authenticated;
  GRANT SELECT, INSERT, UPDATE ON public._hf_settings TO authenticated;
  CREATE FUNCTION public._hf_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
    SELECT (SELECT auth.uid()) IS NOT NULL
       AND (auth.jwt() ->> 'email') IS NOT NULL
       AND EXISTS (SELECT 1 FROM public._hf_settings s
                   CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(COALESCE(s.value,''), ',') AS ce
                   WHERE s.key='admin_emails'
                     AND pg_catalog.lower(pg_catalog.btrim(ce)) = pg_catalog.lower(pg_catalog.btrim(auth.jwt() ->> 'email'))) $f$;
  REVOKE ALL ON FUNCTION public._hf_is_admin() FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public._hf_is_admin() TO authenticated;
  CREATE POLICY p_sel ON public._hf_settings FOR SELECT TO authenticated USING ((SELECT public._hf_is_admin()));
  CREATE POLICY p_ins ON public._hf_settings FOR INSERT TO authenticated WITH CHECK ((SELECT public._hf_is_admin()));
  CREATE POLICY p_upd ON public._hf_settings FOR UPDATE TO authenticated USING ((SELECT public._hf_is_admin())) WITH CHECK ((SELECT public._hf_is_admin()));

  -- ===== RLS : utilisateur ordinaire =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000bb','role','authenticated','email','buyer@test')::text, true);
  SET LOCAL ROLE authenticated;
  b := public._hf_is_admin(); r := r||format('user.is_admin=%s; ',b);
  UPDATE public._hf_settings SET value=value||',buyer@test' WHERE key='admin_emails'; GET DIAGNOSTICS n=ROW_COUNT; r:=r||format('user.upd_admin_emails=%s; ',n);
  UPDATE public._hf_settings SET value='hacked' WHERE key='site_name'; GET DIAGNOSTICS n=ROW_COUNT; r:=r||format('user.upd_setting=%s; ',n);
  RESET ROLE;
  -- ===== RLS : admin =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','email','admin@test')::text, true);
  SET LOCAL ROLE authenticated;
  b := public._hf_is_admin(); r := r||format('admin.is_admin=%s; ',b);
  UPDATE public._hf_settings SET value='New' WHERE key='site_name'; GET DIAGNOSTICS n=ROW_COUNT; r:=r||format('admin.upd_setting=%s; ',n);
  RESET ROLE;
  -- ===== RLS : anon =====
  PERFORM set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  SET LOCAL ROLE anon;
  BEGIN UPDATE public._hf_settings SET value='x' WHERE key='site_name'; GET DIAGNOSTICS n=ROW_COUNT; r:=r||format('anon.upd=%s; ',n); EXCEPTION WHEN OTHERS THEN r:=r||'anon.upd=DENIED; '; END;
  RESET ROLE;

  -- ===== Cas de format (comparaison exacte) =====
  -- espaces
  UPDATE public._hf_settings SET value=' admin@test ' WHERE key='admin_emails';
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','email','admin@test')::text, true);
  SET LOCAL ROLE authenticated; r:=r||format('fmt_space=%s; ',public._hf_is_admin()); RESET ROLE;
  -- casse
  UPDATE public._hf_settings SET value='admin@test' WHERE key='admin_emails';
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','email','ADMIN@TEST')::text, true);
  SET LOCAL ROLE authenticated; r:=r||format('fmt_case=%s; ',public._hf_is_admin()); RESET ROLE;
  -- underscore (joker SQL) NE doit PAS matcher
  UPDATE public._hf_settings SET value='a_b@test' WHERE key='admin_emails';
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','email','axb@test')::text, true);
  SET LOCAL ROLE authenticated; r:=r||format('fmt_underscore=%s; ',public._hf_is_admin()); RESET ROLE;
  -- percent (joker SQL) NE doit PAS matcher
  UPDATE public._hf_settings SET value='a%b@test' WHERE key='admin_emails';
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','email','aZZb@test')::text, true);
  SET LOCAL ROLE authenticated; r:=r||format('fmt_percent=%s; ',public._hf_is_admin()); RESET ROLE;
  -- underscore EXACT doit matcher
  UPDATE public._hf_settings SET value='a_b@test' WHERE key='admin_emails';
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','email','a_b@test')::text, true);
  SET LOCAL ROLE authenticated; r:=r||format('fmt_exact_underscore=%s; ',public._hf_is_admin()); RESET ROLE;
  -- vide
  UPDATE public._hf_settings SET value='' WHERE key='admin_emails';
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','email','x@test')::text, true);
  SET LOCAL ROLE authenticated; r:=r||format('fmt_empty=%s; ',public._hf_is_admin()); RESET ROLE;
  -- email JWT nul
  UPDATE public._hf_settings SET value='admin@test' WHERE key='admin_emails';
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated')::text, true);
  SET LOCAL ROLE authenticated; r:=r||format('fmt_null_email=%s; ',public._hf_is_admin()); RESET ROLE;
  -- uid nul
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','email','admin@test')::text, true);
  SET LOCAL ROLE authenticated; r:=r||format('fmt_null_uid=%s; ',public._hf_is_admin()); RESET ROLE;

  RAISE EXCEPTION 'HOTFIX_PROOF => %', r;
END $$;
