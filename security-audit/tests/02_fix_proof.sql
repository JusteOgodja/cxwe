-- =============================================================================
-- PREUVE DU CORRECTIF (nouveau modèle d'autorité privée par UUID)
--
-- Construit le nouveau modèle (schéma scellé app_private + administrators +
-- app_private.is_admin() + wrapper public), bootstrappe un admin de test, puis
-- vérifie les scénarios anon / utilisateur ordinaire / admin / edge. RAISE
-- EXCEPTION final => ROLLBACK GARANTI (rien persisté, tables de prod intactes :
-- une table cible isolée `public._sec_test_target` est utilisée, jamais les
-- policies de production).
--
-- Résultat attendu (et observé le 2026-08-02) :
--   user.is_admin=f; user.self_promote=blocked; user.read_admins=blocked;
--   user.admin_write=blocked; admin.is_admin=t; admin.admin_write_rows=1;
--   anon.call=EXEC_DENIED(ok); nulluid.is_admin=f;
-- => Un utilisateur ordinaire NE PEUT PAS devenir admin.
-- =============================================================================
DO $$
DECLARE admin_uid uuid; user_uid uuid; r text := ''; b boolean; n int;
BEGIN
  admin_uid := (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1);
  user_uid  := (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1);

  CREATE SCHEMA app_private;
  REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
  CREATE TABLE app_private.administrators(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now());
  ALTER TABLE app_private.administrators ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON app_private.administrators FROM PUBLIC, anon, authenticated;
  CREATE FUNCTION app_private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
    SELECT EXISTS(SELECT 1 FROM app_private.administrators a WHERE a.user_id=(SELECT auth.uid())) $f$;
  REVOKE ALL ON FUNCTION app_private.is_admin() FROM PUBLIC, anon, authenticated;
  CREATE FUNCTION public._t_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $g$
    SELECT app_private.is_admin() $g$;
  REVOKE ALL ON FUNCTION public._t_is_admin() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public._t_is_admin() TO authenticated;

  CREATE TABLE public._sec_test_target(id serial primary key, note text);
  ALTER TABLE public._sec_test_target ENABLE ROW LEVEL SECURITY;
  GRANT SELECT, INSERT ON public._sec_test_target TO authenticated;
  GRANT USAGE, SELECT ON SEQUENCE public._sec_test_target_id_seq TO authenticated;
  CREATE POLICY t_admin_ins ON public._sec_test_target FOR INSERT WITH CHECK ((SELECT public._t_is_admin()));
  INSERT INTO app_private.administrators(user_id) VALUES (admin_uid);

  -- utilisateur ordinaire
  PERFORM set_config('request.jwt.claims', json_build_object('sub',user_uid,'role','authenticated','email','buyer@test')::text, true);
  SET LOCAL ROLE authenticated;
  b := public._t_is_admin(); r := r||format('user.is_admin=%s; ',b);
  BEGIN INSERT INTO app_private.administrators(user_id) VALUES (user_uid); r:=r||'user.self_promote=ALLOWED!!; '; EXCEPTION WHEN OTHERS THEN r:=r||'user.self_promote=blocked; '; END;
  BEGIN PERFORM 1 FROM app_private.administrators; r:=r||'user.read_admins=ALLOWED!!; '; EXCEPTION WHEN OTHERS THEN r:=r||'user.read_admins=blocked; '; END;
  BEGIN INSERT INTO public._sec_test_target(note) VALUES ('x'); r:=r||'user.admin_write=ALLOWED!!; '; EXCEPTION WHEN OTHERS THEN r:=r||'user.admin_write=blocked; '; END;
  RESET ROLE;

  -- admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub',admin_uid,'role','authenticated','email','admin@test')::text, true);
  SET LOCAL ROLE authenticated;
  b := public._t_is_admin(); r := r||format('admin.is_admin=%s; ',b);
  BEGIN INSERT INTO public._sec_test_target(note) VALUES ('ok'); GET DIAGNOSTICS n=ROW_COUNT; r:=r||format('admin.admin_write_rows=%s; ',n); EXCEPTION WHEN OTHERS THEN r:=r||'admin.admin_write=ERROR; '; END;
  RESET ROLE;

  -- anon (wrapper non exécutable par anon)
  PERFORM set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  SET LOCAL ROLE anon;
  BEGIN b := public._t_is_admin(); r:=r||format('anon.is_admin=%s; ',b); EXCEPTION WHEN OTHERS THEN r:=r||'anon.call=EXEC_DENIED(ok); '; END;
  RESET ROLE;

  -- edge : uid null
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  b := public._t_is_admin(); r:=r||format('nulluid.is_admin=%s; ',b);
  RESET ROLE;

  RAISE EXCEPTION 'RLS_PROOF => %', r;
END $$;
