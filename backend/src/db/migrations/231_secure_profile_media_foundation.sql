BEGIN;

CREATE TABLE IF NOT EXISTS user_profile_media (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('avatar','background')),
  media_source VARCHAR(20) NOT NULL DEFAULT 'upload' CHECK (media_source IN ('upload','microsoft365','generated','system')),
  stored_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  sha256 CHAR(64) NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  visibility VARCHAR(20) NOT NULL DEFAULT 'portal' CHECK (visibility IN ('portal','private')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  removed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  removal_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profile_media_active_type
  ON user_profile_media(user_id, media_type)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_profile_media_user_history
  ON user_profile_media(user_id, media_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_profile_media_cleanup
  ON user_profile_media(is_active, removed_at)
  WHERE is_active = FALSE;

COMMIT;
