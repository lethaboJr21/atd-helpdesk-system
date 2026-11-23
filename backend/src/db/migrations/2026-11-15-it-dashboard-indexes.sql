-- IT Dashboard supporting indexes for SLA at-risk computation and agent workload aggregation

CREATE INDEX IF NOT EXISTS idx_tickets_status_priority_created ON tickets (status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_status ON tickets (assigned_to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_due_status ON tickets (due_at, status);
CREATE INDEX IF NOT EXISTS idx_tickets_workspace_status ON tickets (workspace, status);
CREATE INDEX IF NOT EXISTS idx_tickets_category_status ON tickets (category, status);