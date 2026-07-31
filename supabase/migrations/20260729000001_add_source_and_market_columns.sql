/*
  # Ajout colonnes traçabilité scraping, marché local et enrichissement produit

  ## Colonnes ajoutées

  ### Traçabilité scraping
  - source_site       : identifiant du site source (ex: "marjane_ma", "jumia_ma")
  - source_url        : URL exacte de la fiche produit scrapée
  - source_phase      : phase/campagne de scraping (ex: "05_Scraper_Modulaire")

  ### Marché marocain (données de référence)
  - prix_marche_mad   : prix public constaté sur le marché marocain (MAD)
  - disponibilite     : statut de disponibilité constaté lors du scraping

  ### Données produit manquantes
  - poids_brut_kg     : poids brut en kg (colonne manquante dans les migrations précédentes)
  - tva_pct           : taux de TVA applicable (7%, 10%, 20%…)
  - description_marketing : accroche commerciale courte (≤160 caractères)
  - fmcg_segment      : segment FMCG (Alimentaire, Hygiène, Beauté, Animalerie, Terroir…)
  - conditionnement   : description du conditionnement (ex: "Bouteille en verre 1L")
  - contenance        : contenance texte (ex: "500ml", "1kg") distinct du poids
  - image_urls_extra  : URLs des images supplémentaires du produit

  ### Données export B2B
  - prix_depart_usine : prix départ usine en EUR (distinct de prix_indicatif qui est le prix catalogue)
  - delai_fabrication : délai de fabrication / lead time (ex: "2 semaines")
  - emballage_export  : description de l'emballage export (ex: "Carton 24 unités, palettes euro")
*/

DO $$
BEGIN

  -- ─── TRAÇABILITÉ SCRAPING ────────────────────────────────────────────────────

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'source_site'
  ) THEN
    ALTER TABLE products ADD COLUMN source_site text;
    COMMENT ON COLUMN products.source_site IS 'Identifiant du site source du scraping (ex: marjane_ma, jumia_ma)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'source_url'
  ) THEN
    ALTER TABLE products ADD COLUMN source_url text;
    COMMENT ON COLUMN products.source_url IS 'URL exacte de la fiche produit sur le site source';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'source_phase'
  ) THEN
    ALTER TABLE products ADD COLUMN source_phase text;
    COMMENT ON COLUMN products.source_phase IS 'Phase/campagne de scraping (ex: 05_Scraper_Modulaire)';
  END IF;

  -- ─── MARCHÉ MAROCAIN ─────────────────────────────────────────────────────────

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'prix_marche_mad'
  ) THEN
    ALTER TABLE products ADD COLUMN prix_marche_mad numeric(10,2);
    COMMENT ON COLUMN products.prix_marche_mad IS 'Prix public constaté sur le marché marocain en MAD (donnée de référence scraping)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'disponibilite'
  ) THEN
    ALTER TABLE products ADD COLUMN disponibilite text;
    COMMENT ON COLUMN products.disponibilite IS 'Statut de disponibilité constaté lors du scraping (ex: En stock, Rupture)';
  END IF;

  -- ─── DONNÉES PRODUIT MANQUANTES ───────────────────────────────────────────────

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'poids_brut_kg'
  ) THEN
    ALTER TABLE products ADD COLUMN poids_brut_kg numeric(10,3);
    COMMENT ON COLUMN products.poids_brut_kg IS 'Poids brut en kilogrammes (unité de vente)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'tva_pct'
  ) THEN
    ALTER TABLE products ADD COLUMN tva_pct numeric(5,2);
    COMMENT ON COLUMN products.tva_pct IS 'Taux de TVA applicable au Maroc (7, 10 ou 20)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'description_marketing'
  ) THEN
    ALTER TABLE products ADD COLUMN description_marketing text;
    COMMENT ON COLUMN products.description_marketing IS 'Accroche commerciale courte (≤160 caractères) pour les listings et aperçus';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'fmcg_segment'
  ) THEN
    ALTER TABLE products ADD COLUMN fmcg_segment text;
    COMMENT ON COLUMN products.fmcg_segment IS 'Segment FMCG (Alimentaire, Hygiène, Beauté, Animalerie, Terroir, Parapharmacie…)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'conditionnement'
  ) THEN
    ALTER TABLE products ADD COLUMN conditionnement text;
    COMMENT ON COLUMN products.conditionnement IS 'Description du conditionnement unitaire (ex: Bouteille en verre 1L, Sachet kraft 500g)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'contenance'
  ) THEN
    ALTER TABLE products ADD COLUMN contenance text;
    COMMENT ON COLUMN products.contenance IS 'Contenance ou volume texte (ex: 500ml, 1kg, 6x250ml) distinct du poids brut';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'image_urls_extra'
  ) THEN
    ALTER TABLE products ADD COLUMN image_urls_extra text[];
    COMMENT ON COLUMN products.image_urls_extra IS 'URLs directes des images supplémentaires du produit (au-delà de image_url)';
  END IF;

  -- ─── DONNÉES EXPORT B2B ──────────────────────────────────────────────────────

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'prix_depart_usine'
  ) THEN
    ALTER TABLE products ADD COLUMN prix_depart_usine numeric(10,2);
    COMMENT ON COLUMN products.prix_depart_usine IS 'Prix départ usine en EUR (EXW) pour les acheteurs internationaux';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'delai_fabrication'
  ) THEN
    ALTER TABLE products ADD COLUMN delai_fabrication text;
    COMMENT ON COLUMN products.delai_fabrication IS 'Délai de fabrication / lead time (ex: 2 semaines, 30 jours ouvrés)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'emballage_export'
  ) THEN
    ALTER TABLE products ADD COLUMN emballage_export text;
    COMMENT ON COLUMN products.emballage_export IS 'Description de l''emballage export groupé (ex: Carton 24 unités, palettes 80x120cm)';
  END IF;

END $$;

-- ─── INDEX ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS products_source_site_idx   ON products(source_site);
CREATE INDEX IF NOT EXISTS products_fmcg_segment_idx  ON products(fmcg_segment);
CREATE INDEX IF NOT EXISTS products_prix_marche_idx   ON products(prix_marche_mad);
