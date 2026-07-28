-- Buyer profiles: stores information submitted at signup
-- Buyers fill this in to get catalog access; no self-service management UI

CREATE TABLE IF NOT EXISTS buyer_profiles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name   TEXT NOT NULL,
  company_name TEXT NOT NULL,
  country     TEXT NOT NULL,
  phone       TEXT,
  sector      TEXT,
  role        TEXT,
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE buyer_profiles ENABLE ROW LEVEL SECURITY;

-- Buyers can insert and read their own profile
CREATE POLICY "buyer_profiles_insert_own"
  ON buyer_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "buyer_profiles_select_own"
  ON buyer_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Authenticated users (admin) can view all profiles
CREATE POLICY "buyer_profiles_admin_select"
  ON buyer_profiles FOR SELECT
  USING (auth.role() = 'authenticated');
