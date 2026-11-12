BEGIN;

ALTER TABLE support_group_members
  ADD COLUMN IF NOT EXISTS is_default_assignment BOOLEAN;

UPDATE support_group_members
SET is_default_assignment = FALSE
WHERE is_default_assignment IS NULL;

ALTER TABLE support_group_members
  ALTER COLUMN is_default_assignment SET DEFAULT FALSE;

ALTER TABLE support_group_members
  ALTER COLUMN is_default_assignment SET NOT NULL;

WITH duplicate_defaults AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY group_id,ctid
    ) AS row_number
  FROM support_group_members
  WHERE is_default_assignment = TRUE
)
UPDATE support_group_members target
SET is_default_assignment = FALSE
FROM duplicate_defaults duplicate
WHERE target.ctid = duplicate.ctid
  AND duplicate.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_group_members_one_default_per_user
  ON support_group_members(user_id)
  WHERE is_default_assignment = TRUE;

CREATE INDEX IF NOT EXISTS idx_support_group_members_default_lookup
  ON support_group_members(user_id,group_id,is_default_assignment);

COMMIT;
