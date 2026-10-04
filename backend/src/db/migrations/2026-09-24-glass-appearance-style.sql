BEGIN;

ALTER TABLE employee_landing_preferences
  DROP CONSTRAINT IF EXISTS employee_landing_preferences_appearance_style_check;
ALTER TABLE employee_landing_preferences
  ADD CONSTRAINT employee_landing_preferences_appearance_style_check
  CHECK (appearance_style IN ('solid','two-color','gradient','glass'));

COMMIT;
