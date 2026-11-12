BEGIN;
CREATE TABLE IF NOT EXISTS user_authentication_policies(
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 allow_microsoft_sso BOOLEAN NOT NULL DEFAULT FALSE,
 allow_local_password BOOLEAN NOT NULL DEFAULT FALSE,
 preferred_method VARCHAR(30) NOT NULL DEFAULT 'microsoft',
 policy_reason TEXT NOT NULL,
 updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(preferred_method IN('microsoft','local_password')),
 CHECK(allow_microsoft_sso OR allow_local_password)
);
INSERT INTO user_authentication_policies(user_id,allow_microsoft_sso,allow_local_password,preferred_method,policy_reason,updated_at)
SELECT id,TRUE,TRUE,'microsoft','Governed dual-authentication exception for the authorised account.',NOW()
FROM users
WHERE LOWER(COALESCE(email,'')) IN('jeffreym@atdalliance.co.za','jeffrey.motepe@atdalliance.co.za')
   OR LOWER(COALESCE(username,'')) IN('jeffreym','jeffrey.motepe')
ON CONFLICT(user_id) DO UPDATE SET allow_microsoft_sso=TRUE,allow_local_password=TRUE,preferred_method='microsoft',policy_reason=EXCLUDED.policy_reason,updated_at=NOW();
CREATE INDEX IF NOT EXISTS ix_user_authentication_policies_methods ON user_authentication_policies(allow_microsoft_sso,allow_local_password);
COMMIT;
