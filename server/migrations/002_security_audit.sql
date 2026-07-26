CREATE TABLE IF NOT EXISTS moderator_audit_log (
  id BIGSERIAL PRIMARY KEY,
  moderator_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moderator_audit_created_idx
  ON moderator_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS moderator_audit_moderator_idx
  ON moderator_audit_log(moderator_id);
