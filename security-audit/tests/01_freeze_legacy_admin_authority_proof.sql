-- =============================================================================
-- PREUVE (ROLLBACK) — Gel de l'autorité historique site_settings.admin_emails.
-- À exécuter dans une transaction annulée (BEGIN ... ROLLBACK / RAISE) : applique
-- les policies de gel puis teste les scénarios. Aucune valeur sensible affichée.
--
-- Attendu :
--   user_upd=0            (utilisateur ordinaire : aucune modification)
--   admin_isadmin=t       (is_admin() fonctionne : lit admin_emails en DEFINER)
--   admin_read_ae=1       (admin lit encore la ligne admin_emails)
--   admin_other_upd=1     (admin modifie les AUTRES paramètres)
--   admin_ae_value_upd=0  (admin NE peut PAS modifier la valeur d'admin_emails)
--   admin_rename=0        (admin NE peut PAS renommer la ligne admin_emails)
--   admin_rename_to=-1    (admin NE peut PAS renommer une autre clé -> admin_emails)
--   admin_insert_ae=-1    (admin NE peut PAS insérer une nouvelle ligne admin_emails)
--   anon_read=-1          (anonyme : aucun accès à site_settings ; public inchangé)
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS site_settings_admin_insert ON public.site_settings;
DROP POLICY IF EXISTS site_settings_admin_update ON public.site_settings;
CREATE POLICY site_settings_admin_insert ON public.site_settings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) AND key <> 'admin_emails');
CREATE POLICY site_settings_admin_update ON public.site_settings
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) AND key <> 'admin_emails')
  WITH CHECK ((SELECT public.is_admin()) AND key <> 'admin_emails');

DO $t$
DECLARE
  admin_uid uuid; admin_email text; claims text;
  r_user_upd int; r_admin_other int; r_admin_ae_val int;
  r_admin_rename int; r_admin_rename_to int; r_admin_insert_ae int;
  admin_is_admin boolean; admin_read_ae int; anon_read int;
BEGIN
  SELECT u.id, u.email INTO admin_uid, admin_email
  FROM public.site_settings s
  CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(COALESCE(s.value,''),',') ce
  JOIN auth.users u ON pg_catalog.lower(pg_catalog.btrim(u.email))=pg_catalog.lower(pg_catalog.btrim(ce))
  WHERE s.key='admin_emails' AND pg_catalog.btrim(ce)<>'' LIMIT 1;

  -- Utilisateur ordinaire
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000cc","role":"authenticated","email":"user@ordinary.test"}',true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE public.site_settings SET value=value WHERE key='site_name'; GET DIAGNOSTICS r_user_upd=ROW_COUNT; EXCEPTION WHEN others THEN r_user_upd:=-1; END;
  RESET ROLE;

  -- Administrateur (claims construits à partir d'un admin réel ; jamais affichés)
  claims := json_build_object('sub',admin_uid,'role','authenticated','email',admin_email)::text;
  PERFORM set_config('request.jwt.claims',claims,true);
  SET LOCAL ROLE authenticated;
  admin_is_admin := public.is_admin();
  SELECT count(*) INTO admin_read_ae FROM public.site_settings WHERE key='admin_emails';
  BEGIN UPDATE public.site_settings SET value=value WHERE key='site_name'; GET DIAGNOSTICS r_admin_other=ROW_COUNT; EXCEPTION WHEN others THEN r_admin_other:=-1; END;
  BEGIN UPDATE public.site_settings SET value=value WHERE key='admin_emails'; GET DIAGNOSTICS r_admin_ae_val=ROW_COUNT; EXCEPTION WHEN others THEN r_admin_ae_val:=-1; END;
  BEGIN UPDATE public.site_settings SET key='admin_emails_x' WHERE key='admin_emails'; GET DIAGNOSTICS r_admin_rename=ROW_COUNT; EXCEPTION WHEN others THEN r_admin_rename:=-1; END;
  BEGIN UPDATE public.site_settings SET key='admin_emails' WHERE key='site_name'; GET DIAGNOSTICS r_admin_rename_to=ROW_COUNT; EXCEPTION WHEN others THEN r_admin_rename_to:=-1; END;
  BEGIN INSERT INTO public.site_settings(key,value) VALUES('admin_emails','x'); GET DIAGNOSTICS r_admin_insert_ae=ROW_COUNT; EXCEPTION WHEN others THEN r_admin_insert_ae:=-1; END;
  RESET ROLE;

  -- Anonyme
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  SET LOCAL ROLE anon;
  BEGIN SELECT count(*) INTO anon_read FROM public.site_settings; EXCEPTION WHEN others THEN anon_read:=-1; END;
  RESET ROLE;

  RAISE EXCEPTION 'FREEZE_TEST user_upd=% | admin_isadmin=% admin_read_ae=% admin_other_upd=% admin_ae_value_upd=% admin_rename=% admin_rename_to=% admin_insert_ae=% | anon_read=%',
    r_user_upd, admin_is_admin, admin_read_ae, r_admin_other, r_admin_ae_val, r_admin_rename, r_admin_rename_to, r_admin_insert_ae, anon_read;
END
$t$;

COMMIT;
