BEGIN;

ALTER TABLE support_group_members
  ADD COLUMN IF NOT EXISTS is_default_assignment BOOLEAN NOT NULL DEFAULT FALSE;

-- Keep only one existing governed default per user.
WITH ranked_existing AS (
  SELECT ctid,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY group_id,ctid) AS row_number
  FROM support_group_members
  WHERE is_default_assignment=TRUE
)
UPDATE support_group_members target
SET is_default_assignment=FALSE
FROM ranked_existing ranked
WHERE target.ctid=ranked.ctid AND ranked.row_number>1;

-- Single active membership is unambiguous and becomes the governed default.
WITH one_membership AS (
  SELECT gm.user_id,MIN(gm.group_id) AS group_id
  FROM support_group_members gm
  JOIN support_groups g ON g.id=gm.group_id
  WHERE COALESCE(g.is_active,TRUE)=TRUE
  GROUP BY gm.user_id
  HAVING COUNT(DISTINCT gm.group_id)=1
)
UPDATE support_group_members gm
SET is_default_assignment=TRUE
FROM one_membership one
WHERE gm.user_id=one.user_id
  AND gm.group_id=one.group_id
  AND NOT EXISTS (
    SELECT 1 FROM support_group_members current
    WHERE current.user_id=gm.user_id AND current.is_default_assignment=TRUE
  );

-- For multi-group agents, use the group with the strongest historical direct-ticket assignment evidence.
WITH historical_counts AS (
  SELECT t.assigned_to_user_id AS user_id,
         t.assigned_group_id AS group_id,
         COUNT(*)::bigint AS assignment_count,
         MAX(t.created_at) AS latest_assignment
  FROM tickets t
  JOIN support_group_members gm
    ON gm.user_id=t.assigned_to_user_id
   AND gm.group_id=t.assigned_group_id
  JOIN support_groups g ON g.id=gm.group_id
  WHERE t.assigned_to_user_id IS NOT NULL
    AND t.assigned_group_id IS NOT NULL
    AND COALESCE(g.is_active,TRUE)=TRUE
  GROUP BY t.assigned_to_user_id,t.assigned_group_id
), ranked_history AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY assignment_count DESC,latest_assignment DESC,group_id
         ) AS row_number,
         LEAD(assignment_count) OVER (
           PARTITION BY user_id
           ORDER BY assignment_count DESC,latest_assignment DESC,group_id
         ) AS next_count
  FROM historical_counts
), evidence_default AS (
  SELECT user_id,group_id
  FROM ranked_history
  WHERE row_number=1
    AND (next_count IS NULL OR assignment_count>next_count)
)
UPDATE support_group_members gm
SET is_default_assignment=TRUE
FROM evidence_default evidence
WHERE gm.user_id=evidence.user_id
  AND gm.group_id=evidence.group_id
  AND NOT EXISTS (
    SELECT 1 FROM support_group_members current
    WHERE current.user_id=gm.user_id AND current.is_default_assignment=TRUE
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_group_members_one_default_per_user
  ON support_group_members(user_id)
  WHERE is_default_assignment=TRUE;

COMMIT;
