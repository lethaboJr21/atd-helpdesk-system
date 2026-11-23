BEGIN;

CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'archived')),
  visibility VARCHAR(20) NOT NULL DEFAULT 'members'
    CHECK (visibility = 'members'),
  start_date DATE,
  due_date DATE,
  created_by_user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  member_role VARCHAR(24) NOT NULL
    CHECK (member_role IN ('owner', 'project_manager', 'contributor', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  added_by_user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  task_type VARCHAR(20) NOT NULL DEFAULT 'task'
    CHECK (task_type IN ('task', 'deliverable')),
  owner_user_id BIGINT NOT NULL REFERENCES users(id),
  due_date DATE NOT NULL,
  priority VARCHAR(12) NOT NULL DEFAULT 'Medium'
    CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'blocked', 'done')),
  progress_percent SMALLINT NOT NULL DEFAULT 0
    CHECK (progress_percent BETWEEN 0 AND 100),
  created_by_user_id BIGINT NOT NULL REFERENCES users(id),
  updated_by_user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS project_announcements (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  audience VARCHAR(20) NOT NULL DEFAULT 'members'
    CHECK (audience = 'members'),
  author_user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_activity_events (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  entity_type VARCHAR(24) NOT NULL,
  entity_id BIGINT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_active
  ON project_members (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_status_due
  ON project_tasks (project_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_owner_due
  ON project_tasks (owner_user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_project_announcements_project_created
  ON project_announcements (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activity_project_created
  ON project_activity_events (project_id, created_at DESC);

COMMIT;
