const pool = require("../db/pool");
const config = require("../config");

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

function buildDualReadSelect(columns, ticketAlias = "t", ftoAlias = "fto") {
  return columns
    .map(
      (col) =>
        `COALESCE(${ftoAlias}.${col}, ${ticketAlias}.${col}) AS ${col}`
    )
    .join(", ");
}

function buildDirectReadSelect(columns, ftoAlias = "fto") {
  return columns.map((col) => `${ftoAlias}.${col}`).join(", ");
}

function buildSelect(columns, ticketAlias = "t", ftoAlias = "fto") {
  if (config.dualReadEnabled) {
    return buildDualReadSelect(columns, ticketAlias, ftoAlias);
  }
  return buildDirectReadSelect(columns, ftoAlias);
}

async function readFinanceColumn(ticketId, columnName) {
  if (config.dualReadEnabled) {
    const res = await pool.query(
      `SELECT COALESCE(fto.${columnName}, t.${columnName}) AS ${columnName}
       FROM tickets t
       LEFT JOIN finance_ticket_operations fto ON fto.ticket_id = t.id
       WHERE t.id = $1`,
      [ticketId]
    );
    return res.rows.length > 0 ? res.rows[0][columnName] : null;
  }

  const res = await pool.query(
    `SELECT ${columnName} FROM finance_ticket_operations WHERE ticket_id = $1`,
    [ticketId]
  );
  return res.rows.length > 0 ? res.rows[0][columnName] : null;
}

async function readFinanceColumns(ticketId, columns) {
  if (config.dualReadEnabled) {
    const selectFragment = buildDualReadSelect(columns);
    const res = await pool.query(
      `SELECT ${selectFragment}
       FROM tickets t
       LEFT JOIN finance_ticket_operations fto ON fto.ticket_id = t.id
       WHERE t.id = $1`,
      [ticketId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  const selectFragment = buildDirectReadSelect(columns);
  const res = await pool.query(
    `SELECT ${selectFragment} FROM finance_ticket_operations WHERE ticket_id = $1`,
    [ticketId]
  );
  return res.rows.length > 0 ? res.rows[0] : null;
}

module.exports = {
  FINANCE_MIGRATED_COLUMNS,
  buildDualReadSelect,
  buildDirectReadSelect,
  buildSelect,
  readFinanceColumn,
  readFinanceColumns,
};