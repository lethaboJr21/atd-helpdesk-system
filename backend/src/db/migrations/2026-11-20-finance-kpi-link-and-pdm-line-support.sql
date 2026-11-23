BEGIN;

ALTER TABLE finance_ticket_operations
  ADD COLUMN IF NOT EXISTS finance_kpi_id BIGINT
  REFERENCES finance_kpis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_finance_ticket_operations_kpi
  ON finance_ticket_operations(finance_kpi_id)
  WHERE finance_kpi_id IS NOT NULL;

DO $$
DECLARE
  missing_accounts TEXT;
  ambiguous_accounts TEXT;
  support_group_count INTEGER;
BEGIN
  WITH desired_accounts(display_name,email) AS (
    VALUES
      ('Ayanda Nongenzi',NULL),
      ('Priccila Resenga','priccilar@atdalliance.co.za'),
      ('Linda Cebekhulu',NULL),
      ('Siyethemba Mbuli',NULL),
      ('Kagisho Leshaba',NULL),
      ('Ryan Capitani',NULL)
  ),
  missing AS (
    SELECT desired.display_name
    FROM desired_accounts desired
    WHERE NOT EXISTS (
      SELECT 1
      FROM users account
      WHERE account.approved=TRUE
        AND account.status='active'
        AND account.archived_at IS NULL
        AND account.deactivated_at IS NULL
        AND COALESCE(account.account_type,'person')='person'
        AND (
          (desired.email IS NOT NULL AND LOWER(account.email)=LOWER(desired.email))
          OR
          (desired.email IS NULL AND LOWER(TRIM(account.name))=LOWER(desired.display_name))
        )
    )
  )
  SELECT STRING_AGG(display_name,', ' ORDER BY display_name)
  INTO missing_accounts
  FROM missing;

  IF missing_accounts IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot seed PDM Line Support; active employee accounts are missing: %', missing_accounts;
  END IF;

  WITH desired_accounts(display_name,email) AS (
    VALUES
      ('Ayanda Nongenzi',NULL),
      ('Priccila Resenga','priccilar@atdalliance.co.za'),
      ('Linda Cebekhulu',NULL),
      ('Siyethemba Mbuli',NULL),
      ('Kagisho Leshaba',NULL),
      ('Ryan Capitani',NULL)
  ),
  matching_accounts AS (
    SELECT desired.display_name,COUNT(account.id) account_count
    FROM desired_accounts desired
    JOIN users account
      ON (
        (desired.email IS NOT NULL AND LOWER(account.email)=LOWER(desired.email))
        OR
        (desired.email IS NULL AND LOWER(TRIM(account.name))=LOWER(desired.display_name))
      )
     AND account.approved=TRUE
     AND account.status='active'
     AND account.archived_at IS NULL
     AND account.deactivated_at IS NULL
     AND COALESCE(account.account_type,'person')='person'
    GROUP BY desired.display_name
  )
  SELECT STRING_AGG(display_name,', ' ORDER BY display_name)
  INTO ambiguous_accounts
  FROM matching_accounts
  WHERE account_count > 1;

  IF ambiguous_accounts IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot seed PDM Line Support; multiple active employee accounts match: %', ambiguous_accounts;
  END IF;

  SELECT COUNT(*) INTO support_group_count
  FROM support_groups
  WHERE LOWER(name)=LOWER('PDM Line Support');

  IF support_group_count > 1 THEN
    RAISE EXCEPTION 'Cannot seed PDM Line Support; multiple groups with that name exist.';
  END IF;
END $$;

INSERT INTO support_groups(
  name,description,is_active,is_default_triage,manager_user_id,escalation_user_id,updated_at
)
SELECT
  'PDM Line Support',
  'Dedicated support group for the Process Engineering line-issue catalogue.',
  TRUE,
  FALSE,
  manager.id,
  manager.id,
  NOW()
FROM users manager
WHERE LOWER(TRIM(manager.name))=LOWER('Ryan Capitani')
  AND manager.approved=TRUE
  AND manager.status='active'
  AND manager.archived_at IS NULL
  AND manager.deactivated_at IS NULL
  AND COALESCE(manager.account_type,'person')='person'
  AND NOT EXISTS (
    SELECT 1 FROM support_groups existing
    WHERE LOWER(existing.name)=LOWER('PDM Line Support')
  );

UPDATE support_groups
SET description='Dedicated support group for the Process Engineering line-issue catalogue.',
    is_active=TRUE,
    is_default_triage=FALSE,
    manager_user_id=(
      SELECT id FROM users
      WHERE LOWER(TRIM(name))=LOWER('Ryan Capitani')
        AND approved=TRUE AND status='active'
        AND archived_at IS NULL AND deactivated_at IS NULL
        AND COALESCE(account_type,'person')='person'
      LIMIT 1
    ),
    escalation_user_id=(
      SELECT id FROM users
      WHERE LOWER(TRIM(name))=LOWER('Ryan Capitani')
        AND approved=TRUE AND status='active'
        AND archived_at IS NULL AND deactivated_at IS NULL
        AND COALESCE(account_type,'person')='person'
      LIMIT 1
    ),
    updated_at=NOW()
WHERE LOWER(name)=LOWER('PDM Line Support');

WITH desired_accounts(display_name,email) AS (
  VALUES
    ('Ayanda Nongenzi',NULL),
    ('Priccila Resenga','priccilar@atdalliance.co.za'),
    ('Linda Cebekhulu',NULL),
    ('Siyethemba Mbuli',NULL),
    ('Kagisho Leshaba',NULL),
    ('Ryan Capitani',NULL)
)
INSERT INTO support_group_members(group_id,user_id)
SELECT group_row.id,account.id
FROM support_groups group_row
CROSS JOIN desired_accounts desired
JOIN users account
  ON (
    (desired.email IS NOT NULL AND LOWER(account.email)=LOWER(desired.email))
    OR
    (desired.email IS NULL AND LOWER(TRIM(account.name))=LOWER(desired.display_name))
  )
WHERE LOWER(group_row.name)=LOWER('PDM Line Support')
  AND account.approved=TRUE
  AND account.status='active'
  AND account.archived_at IS NULL
  AND account.deactivated_at IS NULL
  AND COALESCE(account.account_type,'person')='person'
ON CONFLICT(group_id,user_id) DO NOTHING;

UPDATE workspace_catalogue_items item
SET default_group_id=group_row.id,
    updated_at=NOW()
FROM service_workspaces workspace
CROSS JOIN support_groups group_row
WHERE item.workspace_id=workspace.id
  AND UPPER(workspace.code)='PDM'
  AND item.catalogue_type='incident'
  AND LOWER(group_row.name)=LOWER('PDM Line Support')
  AND item.is_active=TRUE
  AND item.archived_at IS NULL;

UPDATE pdm_catalogue_items
SET default_group_id=(
      SELECT id FROM support_groups
      WHERE LOWER(name)=LOWER('PDM Line Support')
      LIMIT 1
    ),
    updated_at=NOW()
WHERE is_active=TRUE;

COMMIT;
