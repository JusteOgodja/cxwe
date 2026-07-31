-- Ajoute la colonne de traçabilité de l'origine du prix marché.
-- Renseignée par scripts/apply_market_prices.py sous la forme
-- 'marche_scrape:<enseigne>' (ex: 'marche_scrape:Marjane') quand prix_marche_mad
-- provient de l'enrichissement issu du scraping retail.

ALTER TABLE products ADD COLUMN IF NOT EXISTS prix_marche_source text;

COMMENT ON COLUMN products.prix_marche_source IS
  'Origine de prix_marche_mad. Ex: marche_scrape:<enseigne> pour un prix issu du scraping marché.';
