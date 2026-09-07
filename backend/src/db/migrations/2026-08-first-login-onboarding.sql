BEGIN;

ALTER TABLE employee_landing_preferences
  ADD COLUMN IF NOT EXISTS onboarding_status varchar(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS selected_action_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_version integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_landing_preferences_onboarding_status_check'
      AND conrelid = 'public.employee_landing_preferences'::regclass
  ) THEN
    ALTER TABLE employee_landing_preferences
      ADD CONSTRAINT employee_landing_preferences_onboarding_status_check
      CHECK (onboarding_status IN ('pending','in_progress','completed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_landing_preferences_onboarding_version_check'
      AND conrelid = 'public.employee_landing_preferences'::regclass
  ) THEN
    ALTER TABLE employee_landing_preferences
      ADD CONSTRAINT employee_landing_preferences_onboarding_version_check
      CHECK (onboarding_version > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employee_landing_onboarding_status
  ON employee_landing_preferences(onboarding_status, onboarding_version);

INSERT INTO employee_experience_settings (
  setting_scope, scope_identifier, default_template, allowed_templates,
  widget_policy, appearance_policy, navigation_policy, is_active, priority
)
SELECT
  'organisation', NULL, 'employee',
  '["employee","employeeFocused","quickSupport","equipment","knowledgeFirst","minimal"]'::jsonb,
  '{"allowed":["supportActions","requestModules","pinnedActions","quickLinks","myWork","recentTickets","assignedAssets"],"required":["requestModules"]}'::jsonb,
  '{"allowedThemes":["light","dark","system"],"defaultTheme":"system"}'::jsonb,
  '{"allowedActions":["incident","service","asset","change","project","knowledge","my_tickets","my_assets","syspro_issue","qmuzik_issue","laptop_issue","printer_issue","syspro_catalog","qmuzik_catalog"],"requiredActions":[],"defaultActions":["incident","service","asset","knowledge","my_tickets","my_assets"],"maxActions":8,"onboardingRequired":true,"onboardingVersion":1}'::jsonb,
  TRUE, 100
WHERE NOT EXISTS (
  SELECT 1 FROM employee_experience_settings
  WHERE setting_scope = 'organisation' AND scope_identifier IS NULL AND is_active = TRUE
);

INSERT INTO system_settings(setting_key, setting_value, description)
VALUES ('onboarding.enforcement_mode', '"preview"'::jsonb,
        'First-login onboarding mode: disabled, preview or enforced.')
ON CONFLICT(setting_key) DO NOTHING;

COMMIT;
