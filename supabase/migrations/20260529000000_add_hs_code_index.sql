-- Index pour accélérer les recherches et filtrages par code SH
CREATE INDEX IF NOT EXISTS products_hs_code_idx ON products(hs_code);
