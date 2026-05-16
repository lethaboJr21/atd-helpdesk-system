const pool = require('./pool')
require('dotenv').config()

const schema = `
-- Users / agents
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role        VARCHAR(50)  NOT NULL DEFAULT 'agent',  -- admin | agent | viewer
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id          SERIAL PRIMARY KEY,
  ticket_ref  VARCHAR(20)  NOT NULL UNIQUE,  -- e.g. INC-24081
  title       TEXT         NOT NULL,
  requester   VARCHAR(150) NOT NULL,
  category    VARCHAR(80)  NOT NULL,
  service     VARCHAR(80)  NOT NULL,
  priority    VARCHAR(20)  NOT NULL DEFAULT 'Medium',  -- Critical|High|Medium|Low
  status      VARCHAR(40)  NOT NULL DEFAULT 'Open',
  owner       VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
  site        VARCHAR(80)  NOT NULL DEFAULT 'HQ',
  sla_pct     SMALLINT     NOT NULL DEFAULT 100,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);

-- Ticket activity log
CREATE TABLE IF NOT EXISTS ticket_events (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  actor       VARCHAR(120),
  event_type  VARCHAR(50),   -- comment | status_change | assignment | escalation
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset/service health snapshots
CREATE TABLE IF NOT EXISTS asset_health (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  icon        VARCHAR(50)  NOT NULL DEFAULT 'Server',
  status      VARCHAR(40)  NOT NULL DEFAULT 'Healthy',
  score       SMALLINT     NOT NULL DEFAULT 100,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_created  ON tickets(created_at DESC);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query(schema)
    console.log('✅  Migration complete')
  } catch (err) {
    console.error('❌  Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
