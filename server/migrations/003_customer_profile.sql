CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_addresses (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Дом',
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  street TEXT NOT NULL,
  house TEXT NOT NULL,
  apartment TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_addresses_user_idx ON user_addresses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default_idx
  ON user_addresses(user_id) WHERE is_default;
