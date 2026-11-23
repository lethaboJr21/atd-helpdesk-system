const pool = require("../db/pool");
const fs = require("fs");
const path = require("path");

const SHARED_TABLES = [
  "tickets",
  "ticket_history",
  "ticket_comments",
  "ticket_attachments",
  "email_ticket_intake",
];

const CRITICAL_RLS_TABLES = [
  "tickets",
  "ticket_history",
  "ticket_comments",
  "email_ticket_intake",
];

const FINANCE_MIGRATED_COLUMNS = [
  "evidence_state",
  "review_state",
  "kpi_objective",
  "kpi_period",
  "baseline_assigned_at",
  "original_due_at",
  "effective_due_at",
  "closed_at",
  "closed_by",
];

const FINANCE_ONLY_DROPPED_COLUMNS = [
  "evidence_state",
  "review_state",
  "kpi_objective",
  "kpi_period",
  "baseline_assigned_at",
  "closed_by",
];

const SHARED_RETAINED_COLUMNS = [
  "original_due_at",
  "effective_due_at",
  "closed_at",
];

const EXPECTED_ROLES = [
  "finance_reader",
  "finance_writer",
  "it_reader",
  "it_writer",
  "pdm_reader",
  "pdm_writer",
  "shared_reader",
  "helpdesk_admin",
];

function buildResult(checks) {
  const passed = checks.every((c) => c.passed);
  return { passed, checks };
}

function check(name, passed, detail) {
  return { name, passed, detail };
}

async function getRowCounts(queryFn) {
  const tables = [
    "tickets",
    "ticket_history",
    "ticket_comments",
    "email_ticket_intake",
    "finance_ticket_operations",
  ];
  const counts = {};
  for (const t of tables) {
    try {
      const res = await queryFn(`SELECT count(*)::bigint AS n FROM ${t}`);
      counts[t] = parseInt(res.rows[0].n, 10);
    } catch (e) {
      counts[t] = -1;
    }
  }
  return counts;
}

async function preValidatePhase1(queryFn) {
  const checks = [];

  const counts = await getRowCounts(queryFn);
  for (const [table, count] of Object.entries(counts)) {
    checks.push(
      check(
        `row_count_${table}`,
        count >= 0,
        count >= 0 ? `${count} rows` : `table ${table} inaccessible`
      )
    );
  }

  try {
    const res = await queryFn(`
      SELECT count(*)::bigint AS n
      FROM tickets t
      LEFT JOIN service_workspaces sw
        ON UPPER(t.workspace) = UPPER(sw.code) AND sw.status = 'active'
      WHERE sw.id IS NULL AND t.workspace IS NOT NULL AND t.workspace <> ''
    `);
    const orphanCount = parseInt(res.rows[0].n, 10);
    checks.push(
      check(
        "orphaned_workspace_values",
        true,
        `${orphanCount} tickets with workspace values not in active service_workspaces.code (expected — Phase 1 will reconcile)`
      )
    );
  } catch (e) {
    checks.push(check("orphaned_workspace_values", false, e.message));
  }

  try {
    const res = await queryFn(`
      SELECT 1 FROM pg_constraint
      WHERE conname = 'tickets_workspace_valid_code'
    `);
    const exists = res.rows.length > 0;
    checks.push(
      check(
        "constraint_tickets_workspace_valid_code_absent",
        !exists,
        exists
          ? "CHECK constraint already exists (unexpected for pre-Phase 1)"
          : "CHECK constraint does not exist yet (expected)"
      )
    );
  } catch (e) {
    checks.push(check("constraint_state", false, e.message));
  }

  return buildResult(checks);
}

async function postValidatePhase1(queryFn, preCounts) {
  const checks = [];

  const counts = await getRowCounts(queryFn);
  for (const [table, count] of Object.entries(counts)) {
    if (preCounts && preCounts[table] !== undefined) {
      const unchanged = count === preCounts[table];
      checks.push(
        check(
          `row_count_unchanged_${table}`,
          unchanged,
          unchanged
            ? `${count} rows (unchanged)`
            : `CHANGED: pre=${preCounts[table]}, post=${count}`
        )
      );
    } else {
      checks.push(check(`row_count_${table}`, count >= 0, `${count} rows`));
    }
  }

  try {
    const res = await queryFn(`
      SELECT 1 FROM pg_constraint
      WHERE conname = 'tickets_workspace_valid_code'
    `);
    checks.push(
      check(
        "check_constraint_active",
        res.rows.length > 0,
        res.rows.length > 0
          ? "tickets_workspace_valid_code constraint active"
          : "CHECK constraint missing"
      )
    );
  } catch (e) {
    checks.push(check("check_constraint_active", false, e.message));
  }

  try {
    const res = await queryFn(`
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_normalise_ticket_workspace'
    `);
    checks.push(
      check(
        "normalisation_trigger_present",
        res.rows.length > 0,
        res.rows.length > 0
          ? "trg_normalise_ticket_workspace trigger present"
          : "trigger missing"
      )
    );
  } catch (e) {
    checks.push(check("normalisation_trigger_present", false, e.message));
  }

  try {
    const res = await queryFn(`
      SELECT count(*)::bigint AS n
      FROM tickets t
      LEFT JOIN service_workspaces sw
        ON t.workspace = sw.code AND sw.status = 'active'
      WHERE sw.id IS NULL
    `);
    const orphanCount = parseInt(res.rows[0].n, 10);
    checks.push(
      check(
        "zero_orphaned_workspace_values",
        orphanCount === 0,
        orphanCount === 0
          ? "All tickets.workspace values are canonical"
          : `${orphanCount} tickets with non-canonical workspace values`
      )
    );
  } catch (e) {
    checks.push(check("zero_orphaned_workspace_values", false, e.message));
  }

  try {
    const res = await queryFn(`
      SELECT count(*)::bigint AS n
      FROM tickets
      WHERE workspace IS NULL
    `);
    const nullCount = parseInt(res.rows[0].n, 10);
    checks.push(
      check(
        "workspace_not_null",
        nullCount === 0,
        nullCount === 0
          ? "No NULL workspace values"
          : `${nullCount} tickets with NULL workspace`
      )
    );
  } catch (e) {
    checks.push(check("workspace_not_null", false, e.message));
  }

  return buildResult(checks);
}

async function preValidatePhase2(queryFn) {
  const checks = [];

  const counts = await getRowCounts(queryFn);
  for (const [table, count] of Object.entries(counts)) {
    checks.push(
      check(`row_count_${table}`, count >= 0, `${count} rows`)
    );
  }

  for (const col of FINANCE_MIGRATED_COLUMNS) {
    try {
      const res = await queryFn(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'finance_ticket_operations' AND column_name = '${col}'
      `);
      const exists = res.rows.length > 0;
      checks.push(
        check(
          `fto_column_${col}_absent`,
          !exists,
          exists
            ? `Column ${col} already exists on fto (unexpected for pre-Phase 2)`
            : `Column ${col} does not exist on fto yet (expected)`
        )
      );
    } catch (e) {
      checks.push(check(`fto_column_${col}_absent`, false, e.message));
    }
  }

  try {
    const res = await queryFn(`
      SELECT count(*)::bigint AS n
      FROM tickets
      WHERE workspace = 'FIN'
    `);
    const finCount = parseInt(res.rows[0].n, 10);
    checks.push(
      check(
        "finance_ticket_count",
        true,
        `${finCount} Finance tickets (workspace='FIN')`
      )
    );
  } catch (e) {
    checks.push(check("finance_ticket_count", false, e.message));
  }

  return buildResult(checks);
}

async function postValidatePhase2(queryFn, preCounts) {
  const checks = [];

  const counts = await getRowCounts(queryFn);
  for (const [table, count] of Object.entries(counts)) {
    if (table === "finance_ticket_operations") {
      if (preCounts && preCounts[table] !== undefined) {
        const grew = count >= preCounts[table];
        checks.push(
          check(
            `row_count_fto_grew_or_same`,
            grew,
            grew
              ? `${count} rows (pre=${preCounts[table]}, grew or same — expected for Phase 2)`
              : `SHRUNK: pre=${preCounts[table]}, post=${count} (unexpected)`
          )
        );
      } else {
        checks.push(check(`row_count_${table}`, count >= 0, `${count} rows`));
      }
      continue;
    }
    if (preCounts && preCounts[table] !== undefined) {
      const unchanged = count === preCounts[table];
      checks.push(
        check(
          `row_count_unchanged_${table}`,
          unchanged,
          unchanged
            ? `${count} rows (unchanged)`
            : `CHANGED: pre=${preCounts[table]}, post=${count}`
        )
      );
    } else {
      checks.push(check(`row_count_${table}`, count >= 0, `${count} rows`));
    }
  }

  for (const col of FINANCE_MIGRATED_COLUMNS) {
    try {
      const res = await queryFn(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'finance_ticket_operations' AND column_name = '${col}'
      `);
      const exists = res.rows.length > 0;
      checks.push(
        check(
          `fto_column_${col}_exists`,
          exists,
          exists
            ? `Column ${col} exists on fto`
            : `Column ${col} MISSING from fto`
        )
      );
    } catch (e) {
      checks.push(check(`fto_column_${col}_exists`, false, e.message));
    }
  }

  try {
    const res = await queryFn(`
      SELECT count(*)::bigint AS n
      FROM tickets t
      INNER JOIN finance_ticket_operations fto ON fto.ticket_id = t.id
      WHERE t.workspace = 'FIN'
        AND (
          COALESCE(fto.evidence_state, '') <> COALESCE(t.evidence_state, '')
          OR COALESCE(fto.review_state, '') <> COALESCE(t.review_state, '')
          OR COALESCE(fto.kpi_objective, '') <> COALESCE(t.kpi_objective, '')
          OR COALESCE(fto.kpi_period, '') <> COALESCE(t.kpi_period, '')
          OR COALESCE(fto.baseline_assigned_at::text, '') <> COALESCE(t.baseline_assigned_at::text, '')
          OR COALESCE(fto.original_due_at::text, '') <> COALESCE(t.original_due_at::text, '')
          OR COALESCE(fto.effective_due_at::text, '') <> COALESCE(t.effective_due_at::text, '')
          OR COALESCE(fto.closed_at::text, '') <> COALESCE(t.closed_at::text, '')
          OR COALESCE(fto.closed_by::text, '') <> COALESCE(t.closed_by::text, '')
        )
    `);
    const mismatchCount = parseInt(res.rows[0].n, 10);
    checks.push(
      check(
        "data_parity_100pct",
        mismatchCount === 0,
        mismatchCount === 0
          ? "100% data parity between tickets and fto for Finance tickets"
          : `${mismatchCount} Finance tickets with data parity mismatches`
      )
    );
  } catch (e) {
    checks.push(check("data_parity_100pct", false, e.message));
  }

  return buildResult(checks);
}

async function preValidatePhase3(queryFn) {
  const checks = [];

  const counts = await getRowCounts(queryFn);
  for (const [table, count] of Object.entries(counts)) {
    checks.push(check(`row_count_${table}`, count >= 0, `${count} rows`));
  }

  for (const table of SHARED_TABLES) {
    try {
      const res = await queryFn(`
        SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname = '${table}'
      `);
      if (res.rows.length > 0) {
        const rls = res.rows[0].relrowsecurity;
        checks.push(
          check(
            `rls_disabled_${table}`,
            !rls,
            rls
              ? `RLS already enabled on ${table} (unexpected for pre-Phase 3)`
              : `RLS not enabled on ${table} (expected)`
          )
        );
      } else {
        checks.push(check(`rls_disabled_${table}`, false, `Table ${table} not found`));
      }
    } catch (e) {
      checks.push(check(`rls_disabled_${table}`, false, e.message));
    }
  }

  for (const role of EXPECTED_ROLES) {
    try {
      const res = await queryFn(`
        SELECT 1 FROM pg_roles WHERE rolname = '${role}'
      `);
      const exists = res.rows.length > 0;
      checks.push(
        check(
          `role_${role}_absent`,
          !exists,
          exists
            ? `Role ${role} already exists (unexpected for pre-Phase 3)`
            : `Role ${role} does not exist yet (expected)`
        )
      );
    } catch (e) {
      checks.push(check(`role_${role}_absent`, false, e.message));
    }
  }

  return buildResult(checks);
}

async function postValidatePhase3(queryFn, preCounts) {
  const checks = [];

  const counts = await getRowCounts(queryFn);
  for (const [table, count] of Object.entries(counts)) {
    if (preCounts && preCounts[table] !== undefined) {
      const unchanged = count === preCounts[table];
      checks.push(
        check(
          `row_count_unchanged_${table}`,
          unchanged,
          unchanged
            ? `${count} rows (unchanged)`
            : `CHANGED: pre=${preCounts[table]}, post=${count}`
        )
      );
    } else {
      checks.push(check(`row_count_${table}`, count >= 0, `${count} rows`));
    }
  }

  for (const table of SHARED_TABLES) {
    try {
      const res = await queryFn(`
        SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname = '${table}'
      `);
      if (res.rows.length > 0) {
        const rls = res.rows[0].relrowsecurity;
        checks.push(
          check(
            `rls_enabled_${table}`,
            rls,
            rls ? `RLS enabled on ${table}` : `RLS NOT enabled on ${table}`
          )
        );
      } else {
        checks.push(check(`rls_enabled_${table}`, false, `Table ${table} not found`));
      }
    } catch (e) {
      checks.push(check(`rls_enabled_${table}`, false, e.message));
    }
  }

  for (const table of CRITICAL_RLS_TABLES) {
    try {
      const res = await queryFn(`
        SELECT relforcerowsecurity
        FROM pg_class
        WHERE relname = '${table}'
      `);
      if (res.rows.length > 0) {
        const force = res.rows[0].relforcerowsecurity;
        checks.push(
          check(
            `rls_forced_${table}`,
            force,
            force ? `FORCE RLS on ${table}` : `FORCE RLS NOT set on ${table}`
          )
        );
      } else {
        checks.push(check(`rls_forced_${table}`, false, `Table ${table} not found`));
      }
    } catch (e) {
      checks.push(check(`rls_forced_${table}`, false, e.message));
    }
  }

  for (const role of EXPECTED_ROLES) {
    try {
      const res = await queryFn(`
        SELECT 1 FROM pg_roles WHERE rolname = '${role}'
      `);
      const exists = res.rows.length > 0;
      checks.push(
        check(
          `role_${role}_exists`,
          exists,
          exists ? `Role ${role} exists` : `Role ${role} MISSING`
        )
      );
    } catch (e) {
      checks.push(check(`role_${role}_exists`, false, e.message));
    }
  }

  return buildResult(checks);
}

async function preValidatePhase4(queryFn) {
  const checks = [];

  const counts = await getRowCounts(queryFn);
  for (const [table, count] of Object.entries(counts)) {
    checks.push(check(`row_count_${table}`, count >= 0, `${count} rows`));
  }

  const inlinePatterns = await countInlineWorkspaceFilters();
  checks.push(
    check(
      "inline_filters_present",
      inlinePatterns.total > 0,
      `${inlinePatterns.total} inline workspace filter patterns found across ${inlinePatterns.files} files (expected — Phase 4 will refactor)`
    )
  );

  return buildResult(checks);
}

async function postValidatePhase4(queryFn, preCounts) {
  const checks = [];

  const counts = await getRowCounts(queryFn);
  for (const [table, count] of Object.entries(counts)) {
    if (preCounts && preCounts[table] !== undefined) {
      const unchanged = count === preCounts[table];
      checks.push(
        check(
          `row_count_unchanged_${table}`,
          unchanged,
          unchanged
            ? `${count} rows (unchanged)`
            : `CHANGED: pre=${preCounts[table]}, post=${count}`
        )
      );
    } else {
      checks.push(check(`row_count_${table}`, count >= 0, `${count} rows`));
    }
  }

  const inlinePatterns = await countInlineWorkspaceFilters();
  checks.push(
    check(
      "zero_inline_filters",
      inlinePatterns.total === 0,
      inlinePatterns.total === 0
        ? "No inline workspace filter patterns in production query paths"
        : `${inlinePatterns.total} inline workspace filter patterns still present in ${inlinePatterns.files} files`
    )
  );

  return buildResult(checks);
}

async function preValidatePhase5(queryFn) {
  const checks = [];

  const counts = await getRowCounts(queryFn);
  for (const [table, count] of Object.entries(counts)) {
    checks.push(check(`row_count_${table}`, count >= 0, `${count} rows`));
  }

  for (const col of FINANCE_MIGRATED_COLUMNS) {
    try {
      const res = await queryFn(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tickets' AND column_name = '${col}'
      `);
      const exists = res.rows.length > 0;
      checks.push(
        check(
          `deprecated_column_${col}_present`,
          exists,
          exists
            ? `Deprecated column ${col} still present on tickets (expected)`
            : `Deprecated column ${col} already dropped (unexpected for pre-Phase 5)`
        )
      );
    } catch (e) {
      checks.push(check(`deprecated_column_${col}_present`, false, e.message));
    }
  }

  const dualReadEnabled = process.env.DUAL_READ_ENABLED === "true";
  checks.push(
    check(
      "dual_read_status",
      true,
      dualReadEnabled
        ? "DUAL_READ_ENABLED=true (dual-read still active)"
        : "DUAL_READ_ENABLED=false (code refactored to read from fto directly)"
    )
  );

  return buildResult(checks);
}

async function postValidatePhase5(queryFn, preCounts) {
  const checks = [];

  const counts = await getRowCounts(queryFn);
  for (const [table, count] of Object.entries(counts)) {
    if (preCounts && preCounts[table] !== undefined) {
      const unchanged = count === preCounts[table];
      checks.push(
        check(
          `row_count_unchanged_${table}`,
          unchanged,
          unchanged
            ? `${count} rows (unchanged)`
            : `CHANGED: pre=${preCounts[table]}, post=${count}`
        )
      );
    } else {
      checks.push(check(`row_count_${table}`, count >= 0, `${count} rows`));
    }
  }

  for (const col of FINANCE_ONLY_DROPPED_COLUMNS) {
    try {
      const res = await queryFn(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tickets' AND column_name = '${col}'
      `);
      const exists = res.rows.length > 0;
      checks.push(
        check(
          `finance_only_column_${col}_dropped`,
          !exists,
          !exists
            ? `Finance-only column ${col} dropped from tickets`
            : `Finance-only column ${col} STILL present on tickets`
        )
      );
    } catch (e) {
      checks.push(check(`finance_only_column_${col}_dropped`, false, e.message));
    }
  }

  for (const col of SHARED_RETAINED_COLUMNS) {
    try {
      const res = await queryFn(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tickets' AND column_name = '${col}'
      `);
      const exists = res.rows.length > 0;
      checks.push(
        check(
          `shared_column_${col}_retained`,
          exists,
          exists
            ? `Shared column ${col} retained on tickets (expected)`
            : `Shared column ${col} MISSING from tickets (unexpected)`
        )
      );
    } catch (e) {
      checks.push(check(`shared_column_${col}_retained`, false, e.message));
    }
  }

  const dualReadEnabled = process.env.DUAL_READ_ENABLED === "true";
  checks.push(
    check(
      "dual_read_disabled",
      !dualReadEnabled,
      !dualReadEnabled
        ? "DUAL_READ_ENABLED=false (dual-read removed)"
        : "DUAL_READ_ENABLED still true (should be false after Phase 5)"
    )
  );

  const rlsEnabled = process.env.RLS_ENABLED === "true";
  checks.push(
    check(
      "rls_enabled",
      rlsEnabled,
      rlsEnabled
        ? "RLS_ENABLED=true (production-safe)"
        : "RLS_ENABLED is not true (should be true after Phase 5)"
    )
  );

  return buildResult(checks);
}

async function countInlineWorkspaceFilters() {
  const patterns = [
    /LIKE\s+'%finance%'/i,
    /<>\s*'finance'/i,
    /!=\s*'finance'/i,
    /COALESCE\(.*workspace.*\)\s*<>\s*'finance'/i,
    /IN\s*\(\s*'process engineering \(pdm\)'/i,
  ];

  const searchDirs = [
    path.join(__dirname, "..", "routes"),
    path.join(__dirname, "..", "services"),
  ];

  let total = 0;
  let files = 0;

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
    for (const file of entries) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, "utf8");
      let fileMatches = 0;
      for (const pattern of patterns) {
        const matches = content.match(new RegExp(pattern.source, "gi"));
        if (matches) fileMatches += matches.length;
      }
      if (fileMatches > 0) {
        total += fileMatches;
        files++;
      }
    }
  }

  return { total, files };
}

const phaseValidators = {
  1: { pre: preValidatePhase1, post: postValidatePhase1 },
  2: { pre: preValidatePhase2, post: postValidatePhase2 },
  3: { pre: preValidatePhase3, post: postValidatePhase3 },
  4: { pre: preValidatePhase4, post: postValidatePhase4 },
  5: { pre: preValidatePhase5, post: postValidatePhase5 },
};

async function preValidate(phase, client) {
  const queryFn = client
    ? (sql, params) => client.query(sql, params)
    : (sql, params) => pool.query(sql, params);

  const validator = phaseValidators[phase];
  if (!validator) {
    return {
      passed: false,
      checks: [
        check(
          "phase_recognised",
          false,
          `Unknown phase ${phase}. Valid phases: 1-5.`
        ),
      ],
    };
  }

  try {
    const result = await validator.pre(queryFn);
    if (result.checks.some((c) => c.name.startsWith("row_count_"))) {
      result.preRowCounts = await getRowCounts(queryFn);
    }
    return result;
  } catch (e) {
    return {
      passed: false,
      checks: [check("pre_validation_executed", false, e.message)],
    };
  }
}

async function postValidate(phase, client, preRowCounts) {
  const queryFn = client
    ? (sql, params) => client.query(sql, params)
    : (sql, params) => pool.query(sql, params);

  const validator = phaseValidators[phase];
  if (!validator) {
    return {
      passed: false,
      checks: [
        check(
          "phase_recognised",
          false,
          `Unknown phase ${phase}. Valid phases: 1-5.`
        ),
      ],
    };
  }

  try {
    return await validator.post(queryFn, preRowCounts);
  } catch (e) {
    return {
      passed: false,
      checks: [check("post_validation_executed", false, e.message)],
    };
  }
}

module.exports = {
  preValidate,
  postValidate,
  getRowCounts,
  SHARED_TABLES,
  CRITICAL_RLS_TABLES,
  FINANCE_MIGRATED_COLUMNS,
  EXPECTED_ROLES,
};