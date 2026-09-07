BEGIN;

ALTER TABLE employee_landing_preferences
  ADD COLUMN IF NOT EXISTS appearance_style varchar(20) NOT NULL DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS appearance_accent varchar(30) NOT NULL DEFAULT 'atd-blue',
  ADD COLUMN IF NOT EXISTS monitor_view varchar(10) NOT NULL DEFAULT 'list';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_landing_preferences_appearance_style_check'
      AND conrelid = 'public.employee_landing_preferences'::regclass
  ) THEN
    ALTER TABLE employee_landing_preferences
      ADD CONSTRAINT employee_landing_preferences_appearance_style_check
      CHECK (appearance_style IN ('solid','two-color','gradient'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_landing_preferences_appearance_accent_check'
      AND conrelid = 'public.employee_landing_preferences'::regclass
  ) THEN
    ALTER TABLE employee_landing_preferences
      ADD CONSTRAINT employee_landing_preferences_appearance_accent_check
      CHECK (appearance_accent IN ('atd-blue','slate','cyan','teal','sky','violet','rose','amber','green'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_landing_preferences_monitor_view_check'
      AND conrelid = 'public.employee_landing_preferences'::regclass
  ) THEN
    ALTER TABLE employee_landing_preferences
      ADD CONSTRAINT employee_landing_preferences_monitor_view_check
      CHECK (monitor_view IN ('list','kanban'));
  END IF;
END $$;

COMMIT;
