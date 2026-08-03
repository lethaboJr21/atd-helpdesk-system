BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS service_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  workspace_type varchar(50) NOT NULL DEFAULT 'department',
  description text,
  icon_key varchar(80),
  colour_key varchar(40),
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','inactive','archived')),
  default_group_id integer REFERENCES support_groups(id) ON DELETE SET NULL,
  manager_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  employee_visibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_workspaces_status ON service_workspaces(status);
CREATE INDEX IF NOT EXISTS idx_service_workspaces_type ON service_workspaces(workspace_type);
CREATE INDEX IF NOT EXISTS idx_service_workspaces_manager ON service_workspaces(manager_user_id);

CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES service_workspaces(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  member_role varchar(30) NOT NULL DEFAULT 'agent' CHECK (member_role IN ('manager','agent','viewer')),
  is_active boolean NOT NULL DEFAULT true,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_active ON workspace_members(workspace_id,is_active);

CREATE TABLE IF NOT EXISTS workspace_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES service_workspaces(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES workspace_categories(id) ON DELETE SET NULL,
  name varchar(150) NOT NULL,
  code varchar(80) NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,code)
);
CREATE INDEX IF NOT EXISTS idx_workspace_categories_active ON workspace_categories(workspace_id,is_active,sort_order);

CREATE TABLE IF NOT EXISTS workspace_request_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES service_workspaces(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES workspace_categories(id) ON DELETE SET NULL,
  code varchar(100) NOT NULL,
  name varchar(180) NOT NULL,
  description text,
  employee_instructions text,
  confidentiality varchar(20) NOT NULL DEFAULT 'standard' CHECK (confidentiality IN ('standard','restricted','confidential')),
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','inactive','archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  field_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  routing_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  notification_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_priority varchar(20),
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,code)
);
CREATE INDEX IF NOT EXISTS idx_workspace_templates_status ON workspace_request_templates(workspace_id,status);
CREATE INDEX IF NOT EXISTS idx_workspace_templates_category ON workspace_request_templates(category_id);

CREATE TABLE IF NOT EXISTS workspace_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES workspace_request_templates(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  snapshot jsonb NOT NULL,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id,version)
);

CREATE TABLE IF NOT EXISTS workspace_dashboard_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES service_workspaces(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id) ON DELETE CASCADE,
  dashboard_key varchar(50) NOT NULL DEFAULT 'operational',
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,user_id,dashboard_key)
);

CREATE TABLE IF NOT EXISTS employee_experience_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_scope varchar(30) NOT NULL DEFAULT 'organisation' CHECK (setting_scope IN ('organisation','department','role','group','user')),
  scope_identifier varchar(150),
  default_template varchar(60) NOT NULL DEFAULT 'hybrid_hub',
  allowed_templates jsonb NOT NULL DEFAULT '["service_hub","guided_assistant","application_launcher","hybrid_hub","minimal"]'::jsonb,
  widget_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  appearance_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  navigation_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_experience_scope ON employee_experience_settings(setting_scope,scope_identifier,is_active,priority DESC);

CREATE TABLE IF NOT EXISTS employee_landing_preferences (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  selected_template varchar(60),
  theme varchar(30),
  background_key varchar(60),
  density varchar(20),
  default_route varchar(255),
  widget_layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  favourite_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden_widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  accessibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_navigation_preferences (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sidebar_mode varchar(20) NOT NULL DEFAULT 'expanded' CHECK (sidebar_mode IN ('expanded','compact','floating')),
  sidebar_pinned boolean NOT NULL DEFAULT true,
  show_favourites boolean NOT NULL DEFAULT true,
  show_recent boolean NOT NULL DEFAULT true,
  show_frequent boolean NOT NULL DEFAULT true,
  favourites jsonb NOT NULL DEFAULT '[]'::jsonb,
  collapsed_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_recent_items (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type varchar(40) NOT NULL,
  item_identifier varchar(150) NOT NULL,
  display_label varchar(255) NOT NULL,
  route varchar(500) NOT NULL,
  open_count integer NOT NULL DEFAULT 1,
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,item_type,item_identifier)
);
CREATE INDEX IF NOT EXISTS idx_user_recent_items_user_date ON user_recent_items(user_id,last_opened_at DESC);

INSERT INTO service_workspaces(code,name,workspace_type,description,status,settings)
VALUES
 ('IT','Information Technology','department','Technology support, access, hardware, software and infrastructure services.','draft','{"starter":true}'::jsonb),
 ('HR','Human Resources','department','Employee lifecycle, policy, benefits, training and workplace support.','draft','{"starter":true}'::jsonb),
 ('FIN','Finance','department','Payments, invoices, expenses, supplier and financial service requests.','draft','{"starter":true}'::jsonb),
 ('FAC','Facilities','department','Building, maintenance, access, safety and workplace facilities requests.','draft','{"starter":true}'::jsonb)
ON CONFLICT(code) DO NOTHING;

COMMIT;

