-- =============================================================================
-- PROPOSÉ — NON APPLIQUÉ. Désactivation RÉVERSIBLE des 114 produits bébé/puériculture
-- HORS PÉRIMÈTRE ACTIFS, à partir d'une LISTE IMMUABLE d'identifiants issus de l'audit.
-- AUCUN recalcul par regex/texte en production. Aucune suppression physique.
--
-- Audit figé : 131 HIGH confirmés = 17 déjà inactifs (NON touchés) + 114 actifs (ci-dessous).
-- Précondition PAR LIGNE : id présent AND is_active=true AND category_id = category_id audité.
-- Si une ligne a dérivé (supprimée / déjà inactive / catégorie changée) → ROLLBACK intégral
-- avec la liste des écarts. Résultat attendu : expected_rows_to_update = actual = 114.
--
-- À exécuter via execute_sql (jamais CLI). AVANT : export de sauvegarde local (voir
-- backup_before_deactivation.sql / CLEANUP_PLAN.md). Réactivation : restore_reactivate_114.sql.
-- =============================================================================
BEGIN;

CREATE TEMP TABLE _audited (id uuid PRIMARY KEY, category_id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO _audited (id, category_id) VALUES
  ('742e0fef-14a9-49a8-b840-608c2cfe8ca0','2009d2d0-082c-439e-9b82-278e341fbcb0'),
  ('9715d8f2-78af-4a5b-9854-baf1167d2fc5','2009d2d0-082c-439e-9b82-278e341fbcb0'),
  ('bb638f3e-edb4-45d1-bdad-7a116b0691d7','2009d2d0-082c-439e-9b82-278e341fbcb0'),
  ('c667ac6a-b427-43d5-b6ca-1425751f111d','2009d2d0-082c-439e-9b82-278e341fbcb0'),
  ('f1cc49d8-ad73-49c3-8008-f8506816e845','2009d2d0-082c-439e-9b82-278e341fbcb0'),
  ('f4e547d0-8425-4962-ba70-04485b052001','2009d2d0-082c-439e-9b82-278e341fbcb0'),
  ('30e364cc-d9d9-4fa3-918c-cc9d5fd9f869','740d7ee2-1bb1-443d-92dc-42403cd95dbd'),
  ('619b3a93-44e6-4257-b53d-beed2492f352','740d7ee2-1bb1-443d-92dc-42403cd95dbd'),
  ('82704bd6-e224-4c46-903b-fbcfddedb887','740d7ee2-1bb1-443d-92dc-42403cd95dbd'),
  ('9d46e8ad-fab6-4eae-8c8c-0f39dd30a34a','740d7ee2-1bb1-443d-92dc-42403cd95dbd'),
  ('b8e5d059-e54d-44de-8fdb-e7503ef74bb4','740d7ee2-1bb1-443d-92dc-42403cd95dbd'),
  ('da2546f5-bef9-4738-a918-9a3326ee65b3','740d7ee2-1bb1-443d-92dc-42403cd95dbd'),
  ('dc34255f-adf8-419a-adac-10d648bfd3b0','740d7ee2-1bb1-443d-92dc-42403cd95dbd'),
  ('08ea6453-5717-4d4b-87d6-fec7f73d5a2a','7abec211-4084-41ba-b1b2-b014ff728e03'),
  ('4f0da58e-621e-4a5f-b81f-311598c8cf6b','7abec211-4084-41ba-b1b2-b014ff728e03'),
  ('50676fdd-f08d-402f-b86e-53c5979e810d','7abec211-4084-41ba-b1b2-b014ff728e03'),
  ('53dedcee-17a7-4e42-82d7-9856f7ec4773','7abec211-4084-41ba-b1b2-b014ff728e03'),
  ('8794ae3a-3d75-4658-91e4-f6f7ada32baf','7abec211-4084-41ba-b1b2-b014ff728e03'),
  ('bf2446fa-43c4-4652-8ea7-7680625cd2aa','7abec211-4084-41ba-b1b2-b014ff728e03'),
  ('e206580c-cada-4eef-8a86-d0d6b9054b25','7abec211-4084-41ba-b1b2-b014ff728e03'),
  ('f7e23444-dbc6-4bcc-a53e-433f7a39d78b','7abec211-4084-41ba-b1b2-b014ff728e03'),
  ('fb6e2d7a-9459-4f2f-86ff-ca4ae0392856','7abec211-4084-41ba-b1b2-b014ff728e03'),
  ('586ffb6a-f8f9-49ce-9a22-77c1f7a93440','a5c0276b-a4c8-4490-8131-1b37fa222c46'),
  ('7ad34a6c-e039-4c5f-a605-35b36e970af9','a5c0276b-a4c8-4490-8131-1b37fa222c46'),
  ('1278a6f6-27f7-4f2f-80fa-6559b70024ce','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('15accd4c-31c4-4be3-8095-5d96300a822f','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('1c28f4d8-ea10-4c78-88df-9da329334b83','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('3857451d-1dc4-4494-ba78-6f06093d2546','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('3b194b66-4dc1-4467-acd9-8ec006533648','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('4c723076-b430-439d-8bb2-96b0639707a3','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('71d655b3-f745-4640-87ef-a392966d312c','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('75ea563a-7ee1-47cd-9c0b-982d1041283d','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('81e698e6-5af4-4995-b8c1-f794d7e41211','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('8ddcf33b-7004-4e2b-ba99-9d2531b45a6d','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('909ef043-12d3-46ac-9ccb-db6317bbbe2c','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('9ebf05c9-487c-4e79-a295-7999857e3f66','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('a6e92bbd-d891-4aec-8297-e7f60e4018fa','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('a7f1908c-d894-47b1-8b6f-8a977395eb54','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('ba2b9b51-44f0-46ea-8f8d-cb3f52762691','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('c20951e1-ddf5-4580-a1f6-2a766d2f0927','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('c9cde576-99c7-4c3d-8846-f31832f21937','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('d795c29e-e2b9-46ec-b8f7-b5d2dcf4c104','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('d93fa445-be17-4610-ba63-86165d896cc9','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('e072f6ae-16a5-4dd5-a683-726b76f614e4','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('e9589d4a-3a73-4553-adfa-f395fe789f32','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('f37edda9-3772-4460-af4e-cbbd152893fa','c044a546-1216-42cb-9b6f-b9b8c51364d6'),
  ('0d835908-de34-4f26-8b52-b0bc814642c5','cf1162f0-e4f8-4489-ae48-b0dabda2276d'),
  ('40fdbb5b-ac2d-4409-a4f5-9255da0a5839','cf1162f0-e4f8-4489-ae48-b0dabda2276d'),
  ('4e98b82a-20d8-438d-9305-2742ea2fdea2','cf1162f0-e4f8-4489-ae48-b0dabda2276d'),
  ('6df7f117-b362-4d78-9e55-377e94487584','cf1162f0-e4f8-4489-ae48-b0dabda2276d'),
  ('0545db7a-a461-4b2d-ad80-c4fc8fd5e1b4','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('064b8672-ef55-4efc-8d90-0805367227c6','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('11e792ba-061a-45eb-ac97-e7f25465335a','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('22904f51-a291-4566-b362-d691e5e39476','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('261d38e4-fd50-4cf6-80c4-94a584fba772','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('35c5fbab-aba0-49eb-b90d-813ce14913f8','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('3854e1dc-a827-43a6-a7c7-c5d43b0d3168','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('404856c2-14a9-4b73-b523-a4af5e37134b','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('43c92e67-748a-4693-9429-be82dbc54ae7','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('4d7e740a-27e3-4c7b-958b-34a85120351b','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('509c1099-af3a-405e-ac07-525d5ab2b9d7','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('50dbf995-3e32-4a79-b785-b1970e5f6f74','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('59f8620a-1600-4190-8786-d5afe4cc3710','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('5f8b02f7-e38a-4a84-a6f7-352c7d8f7e90','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('60f2434e-c0bd-4de3-9a3b-1ac06655b962','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('62574361-89d8-41ab-ab6c-3d1ae5817a72','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('66fa8838-6245-434d-a560-f45f0dd88568','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('6b20846a-62ed-411c-a195-0189dd5b3739','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('6c007425-b0e3-40a1-b13f-007151431b3d','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('70f59714-b6ea-4c2c-83e3-aaa096058d41','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('72f964de-4d4f-442d-88fb-e7895c6e552c','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('7756c2d8-7897-44c3-acc9-3e16a629c459','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('7beda0a7-e460-46b6-af5e-c96ca01ed16a','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('82b142df-003f-4bd1-b088-eb876193885d','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('87f12989-5f3a-4a1d-b4f7-b9aa435f50f1','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('8eeea409-e345-4819-a388-d96e75a47ae1','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('9f151241-0a22-4c00-976b-ebea661a1d98','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('9f6442b7-d9b7-488f-a0bf-ea7066f9e77a','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('a048bd4e-6edf-4af9-9063-ab28e056a84c','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('a138d5c9-492c-4808-aa2b-5b6ca6b0efdc','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('a1434c0b-5177-4f6a-a624-287105a4b2d0','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('a852b34a-487f-4341-9b57-331864fc4d93','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('aabe5e0a-6c9e-4d39-9c17-1c11b533445f','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('b323febc-e47f-46ac-b20b-e2c84e18e4e2','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('b504de62-6988-4605-9d49-c76556717bba','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('b7ed9fc6-e0d9-4f56-b815-26c7f87d789c','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('bd2d254a-ce3c-43f5-a877-3285acaa1306','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('be8244ed-9123-4a6b-a8ed-0e92f7f4edde','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('bf64ebb5-ca10-4abe-ba49-6da41a55be0b','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('c72ae56c-bc8f-42a6-907b-d65d882c7283','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('c9bb552c-8aa8-4cb1-8547-56fe2595733c','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('d3e9130c-1f91-49cf-aea1-fef8eb35de92','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('d54cec5a-aac3-4481-9596-962ba677b2a0','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('db312306-c796-4002-922b-b5d36d83ea9c','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('ddcf4746-6e69-475a-a36b-4268ac5e8789','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('e1157906-0a18-4886-b2eb-39f032c5ce00','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('e9d20353-f90e-42c1-8cb5-aa06a32484d0','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('eabd9443-014e-47b5-8d99-ec8795b6bd79','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('ec01a4f1-5ca7-4e71-a730-e2828cadcae4','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('f12a7b3a-d63d-4bfa-898e-e68a70d0deb2','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('f66d54bc-4443-401f-9663-03916be8f084','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('fa3fcbce-9ccb-4d0c-95b3-3ecd214cba81','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('fedca1bb-0a68-40dc-aa27-92ca29712531','d32c82e6-545b-4e6f-843c-bca4807c8be1'),
  ('7c13e7d7-d6f7-4228-afce-218b7d86c70f','da37e54e-3594-4ed9-b75e-2ac1767ae09b'),
  ('c3dd4859-477c-4994-825f-0531ffcd9c08','da37e54e-3594-4ed9-b75e-2ac1767ae09b'),
  ('07efdf12-1764-4cf4-bb22-0045f005a797','f8ed755d-679c-430c-9407-eef5027f656c'),
  ('23e47a13-2fb4-4488-82a2-2a41cf9e1de7','f8ed755d-679c-430c-9407-eef5027f656c'),
  ('454cce07-821e-40ba-b805-fc15f196b4ee','f8ed755d-679c-430c-9407-eef5027f656c'),
  ('71e385c0-60c1-4755-9235-6eb8199c46ae','f8ed755d-679c-430c-9407-eef5027f656c'),
  ('91aaa4d8-fff6-4335-b457-e6d15f2526b1','f8ed755d-679c-430c-9407-eef5027f656c'),
  ('92fb4799-4cf8-4108-852e-902fa3f1f172','f8ed755d-679c-430c-9407-eef5027f656c'),
  ('a365f378-59e8-401b-af5f-bffcceef8ee9','f8ed755d-679c-430c-9407-eef5027f656c'),
  ('d50f87ac-f341-4495-a514-a979d106d880','f8ed755d-679c-430c-9407-eef5027f656c'),
  ('e319b2fa-8b7c-425d-b75e-7c10ac5178aa','f8ed755d-679c-430c-9407-eef5027f656c');

-- Précondition : exactement 114 lignes auditées, toutes encore actives et dans la catégorie auditée.
DO $chk$
DECLARE n_audit int; drift text;
BEGIN
  SELECT count(*) INTO n_audit FROM _audited;
  IF n_audit <> 114 THEN RAISE EXCEPTION 'Aborted: audited set = %, expected 114', n_audit; END IF;
  SELECT string_agg(a.id::text || ':' ||
      CASE WHEN p.id IS NULL THEN 'missing_or_active_or_category_changed' ELSE '?' END, ', ')
  INTO drift
  FROM _audited a
  LEFT JOIN public.products p ON p.id = a.id AND p.is_active = true AND p.category_id = a.category_id
  WHERE p.id IS NULL;
  IF drift IS NOT NULL THEN
    RAISE EXCEPTION 'Aborted: rows drifted since audit (id:reason): %', drift;
  END IF;
END $chk$;

-- Mise à jour : uniquement id ∈ audité, is_active=true, category_id = category_id audité.
DO $upd$
DECLARE cnt int; expected int := 114;
BEGIN
  UPDATE public.products p SET is_active = false
  FROM _audited a
  WHERE p.id = a.id AND p.is_active = true AND p.category_id = a.category_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'expected_rows_to_update=% actual_rows_updated=%', expected, cnt;
  IF cnt <> expected THEN RAISE EXCEPTION 'Aborted: actual_rows_updated=% <> expected=%', cnt, expected; END IF;
END $upd$;

-- Rafraîchir les compteurs (matviews).
REFRESH MATERIALIZED VIEW CONCURRENTLY public.category_product_counts;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_product_counts;

COMMIT;
-- Les 17 produits déjà inactifs ne sont pas référencés ici → aucune modification.
-- Réactivation : data-quality/product-cleanup/proposed-sql/restore_reactivate_114.sql
