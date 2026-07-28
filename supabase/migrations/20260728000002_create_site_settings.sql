-- Site settings: key/value store for admin-configurable platform parameters

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admin) can read and write settings
CREATE POLICY "site_settings_authenticated_select"
  ON site_settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "site_settings_authenticated_all"
  ON site_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Seed default settings (upsert-safe)
INSERT INTO site_settings (key, value) VALUES
  ('contact_email',      ''),
  ('contact_whatsapp',   ''),
  ('contact_phone',      ''),
  ('site_name',          'Morocco Food Export'),
  ('site_tagline',       ''),
  ('site_logo_url',      ''),
  ('default_currency',   'EUR'),
  ('banner_text',        ''),
  ('social_linkedin',    ''),
  ('social_instagram',   ''),
  ('social_facebook',    ''),
  ('alert_new_quote',    'true'),
  ('alert_new_buyer',    'false'),
  ('legal_company_name', ''),
  ('legal_address',      ''),
  ('legal_siret',        ''),
  ('maintenance_mode',   'false')
ON CONFLICT (key) DO NOTHING;
