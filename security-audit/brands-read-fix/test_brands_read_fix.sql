-- =============================================================================
-- TEST (TRANSACTION ROLLBACK) de la correction du 401 brands.
-- À exécuter dans une transaction ANNULÉE (le RAISE final rollback tout).
-- Aucune donnée n'est persistée. Emails/UUID jamais affichés.
--
-- ⚠️ Non exécuté dans la session de préparation : le test rollback en production
-- a été bloqué par le garde-fou de sécurité (SQL d'apparence mutante), et la pile
-- Supabase locale n'a pas pu démarrer (Docker Desktop arrêté). À rejouer en
-- staging OU en étape 1 juste avant l'application (avant le GRANT définitif).
--
-- Attendu :
--   anon_active_brands   >= 1     (lecture des marques ACTIVES autorisée)
--   anon_inactive_visible = 0     (marque inactive NON visible)
--   anon_insert          = blocked
--   anon_update_rows     = 0      (aucune écriture)
--   anon_isadmin         = f      (is_admin() renvoie false pour anon, sans erreur)
--   admin_update_admin_emails_rows = 0  (site_settings/gel INCHANGÉ)
--   ordinary_update_admin_emails_rows = 0 (ancien exploit TOUJOURS bloqué)
-- =============================================================================

BEGIN;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

DO $t$
DECLARE
  au uuid; ae text; claims text;
  anon_active int; anon_inactive int; anon_ins text; anon_upd int; anon_isadmin boolean;
  admin_upd_ae int; ord_upd_ae int;
BEGIN
  -- marque inactive éphémère (annulée par le rollback)
  INSERT INTO public.brands(id,name,slug,is_active)
  VALUES ('99999999-9999-9999-9999-999999999999','ZZ inactive','zz-inactive-'||substr(md5(random()::text),1,6),false);

  -- ANONYME
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  SET LOCAL ROLE anon;
  BEGIN SELECT count(*) INTO anon_active   FROM public.brands WHERE is_active=true; EXCEPTION WHEN others THEN anon_active:=-1; END;
  BEGIN SELECT count(*) INTO anon_inactive FROM public.brands WHERE id='99999999-9999-9999-9999-999999999999'; EXCEPTION WHEN others THEN anon_inactive:=-1; END;
  BEGIN INSERT INTO public.brands(name,slug) VALUES('hack','hack-x'); anon_ins:='ALLOWED'; EXCEPTION WHEN others THEN anon_ins:='blocked'; END;
  BEGIN UPDATE public.brands SET name=name WHERE is_active=true; GET DIAGNOSTICS anon_upd=ROW_COUNT; EXCEPTION WHEN others THEN anon_upd:=-1; END;
  BEGIN anon_isadmin := public.is_admin(); EXCEPTION WHEN others THEN anon_isadmin:=NULL; END;
  RESET ROLE;

  -- ADMIN (site_settings / gel inchangé)
  SELECT u.id,u.email INTO au,ae FROM public.site_settings s
    CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(COALESCE(s.value,''),',') ce
    JOIN auth.users u ON pg_catalog.lower(pg_catalog.btrim(u.email))=pg_catalog.lower(pg_catalog.btrim(ce))
    WHERE s.key='admin_emails' AND pg_catalog.btrim(ce)<>'' LIMIT 1;
  claims:=json_build_object('sub',au,'role','authenticated','email',ae)::text;
  PERFORM set_config('request.jwt.claims',claims,true); SET LOCAL ROLE authenticated;
  BEGIN UPDATE public.site_settings SET value=value WHERE key='admin_emails'; GET DIAGNOSTICS admin_upd_ae=ROW_COUNT; EXCEPTION WHEN others THEN admin_upd_ae:=-1; END;
  RESET ROLE;

  -- UTILISATEUR ORDINAIRE (ancien exploit)
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000cc","role":"authenticated","email":"u@x.test"}',true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE public.site_settings SET value=value||',x' WHERE key='admin_emails'; GET DIAGNOSTICS ord_upd_ae=ROW_COUNT; EXCEPTION WHEN others THEN ord_upd_ae:=-1; END;
  RESET ROLE;

  RAISE EXCEPTION 'BRANDSFIX anon_active_brands=% anon_inactive_visible=% anon_insert=% anon_update_rows=% anon_isadmin=% | admin_update_admin_emails_rows=% ordinary_update_admin_emails_rows=%',
    anon_active, anon_inactive, anon_ins, anon_upd, anon_isadmin, admin_upd_ae, ord_upd_ae;
END $t$;
COMMIT;
