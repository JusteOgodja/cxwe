-- Export de SAUVEGARDE local (lecture seule) — À EXÉCUTER AVANT la désactivation.
-- Produit un CSV NON versionné avec toutes les colonnes products des 131 HIGH
-- + comptage des dépendances (images / tarifs / lots). La règle regex est admise ICI
-- car il s'agit d'un SELECT en lecture (aucune mutation). La mutation, elle, n'utilise
-- QUE des IDs figés (deactivate_out_of_scope_baby_child_FROZEN.sql).
--
-- psql (ou Studio « Download CSV ») :
\copy (
  SELECT
    p.*,                                   -- toutes les colonnes products (dont category_id, is_active, statut)
    (SELECT count(*) FROM public.product_images   i WHERE i.product_id = p.id) AS n_images,
    (SELECT count(*) FROM public.product_pricing_tiers t WHERE t.product_id = p.id) AS n_pricing_tiers,
    (SELECT count(*) FROM public.product_lots     l WHERE l.product_id = p.id) AS n_lots
  FROM public.products p
  LEFT JOIN public.brands b ON b.id = p.marque_id
  WHERE lower(coalesce(p.name,'')||' '||coalesce(p.description,'')||' '||coalesce(p.description_marketing,'')) !~ '(big )?baby ?pop'
    AND (
      lower(coalesce(b.name,'')) ~ '\y(nuk|mam ?baby|n[uû]by|suavinex|farlin|miniland|babybio|organix|dodie|avent|chicco|tommee|b[ée]b[ée] ?confort|bambino|b[ée]b[ée]dor|notre ?b[ée]b[ée])\y'
      OR lower(coalesce(p.name,'')) ~ '(couche[- ]?culotte|couches? b[ée]b[ée]|\ydiapers?\y|lingettes? b[ée]b[ée]|lait infantile|lait de croissance|lait 1er ?[aâ]ge|infant formula|c[ée]r[ée]ales? infantiles?|petit pot|biberon|feeding bottle|t[ée]tine|pacifier|st[ée]rilisateur|poussette|si[èe]ge[- ]?auto|pu[ée]riculture|grignoteur|nibber|tasse d.?apprentissage|d[èe]s [0-9] ?mois|[0-9]m\+|sucette.{0,30}(0-6|6-18|6-36|[0-9] ?mois|[0-9]\s?er ?[aâ]ge|anatomique|orthodon|physio))'
    )
) TO '.local-audit/product-cleanup/deactivation_backup_full.csv' WITH CSV HEADER;

-- Export dédié des IDs actifs modifiés (pour la restauration ciblée des 114) :
\copy (
  SELECT p.id FROM public.products p LEFT JOIN public.brands b ON b.id=p.marque_id
  WHERE p.is_active = true
    AND lower(coalesce(p.name,'')||' '||coalesce(p.description,'')||' '||coalesce(p.description_marketing,'')) !~ '(big )?baby ?pop'
    AND ( lower(coalesce(b.name,'')) ~ '\y(nuk|mam ?baby|n[uû]by|suavinex|farlin|miniland|babybio|organix|dodie|avent|chicco|tommee|b[ée]b[ée] ?confort|bambino|b[ée]b[ée]dor|notre ?b[ée]b[ée])\y'
       OR lower(coalesce(p.name,'')) ~ '(couche[- ]?culotte|couches? b[ée]b[ée]|\ydiapers?\y|lingettes? b[ée]b[ée]|lait infantile|lait de croissance|lait 1er ?[aâ]ge|infant formula|c[ée]r[ée]ales? infantiles?|petit pot|biberon|feeding bottle|t[ée]tine|pacifier|st[ée]rilisateur|poussette|si[èe]ge[- ]?auto|pu[ée]riculture|grignoteur|nibber|tasse d.?apprentissage|d[èe]s [0-9] ?mois|[0-9]m\+|sucette.{0,30}(0-6|6-18|6-36|[0-9] ?mois|[0-9]\s?er ?[aâ]ge|anatomique|orthodon|physio))') )
) TO '.local-audit/product-cleanup/deactivated_active_ids.csv' WITH CSV HEADER;
