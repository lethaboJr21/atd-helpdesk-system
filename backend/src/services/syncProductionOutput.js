const pgPool = require("../db/pool");
const { sql, getMssqlPool } = require("../db/mssqlPool");

function calculateAttainment(planned, actual) {
  const plan = Number(planned || 0);
  const act = Number(actual || 0);

  if (plan <= 0) return 0;

  return Number(((act / plan) * 100).toFixed(2));
}

async function syncProductionOutput({ fromDate, toDate } = {}) {
  const mssqlPool = await getMssqlPool();

  const start = fromDate || new Date();
  const end = toDate || new Date();

  const result = await mssqlPool
    .request()
    .input("FromDate", sql.Date, start)
    .input("ToDate", sql.Date, end)
    .execute("dbo.GetProductionOutputForPortal");

  const rows = result.recordset || [];

  for (const row of rows) {
    const plannedQty = Number(row.PlannedQty || 0);
    const actualQty = Number(row.ActualQty || 0);
    const scrapQty = Number(row.ScrapQty || 0);

    const attainment = calculateAttainment(plannedQty, actualQty);

    const sourceKey = [
      row.ProductionDate,
      row.Shift,
      row.HourLabel,
      row.PartNumber,
      row.Station,
    ].join("|");

    await pgPool.query(
      `
      INSERT INTO production_output_snapshot (
        production_date,
        shift,
        hour_label,
        part_family,
        part_number,
        station,
        planned_qty,
        actual_qty,
        scrap_qty,
        attainment_percent,
        source_key,
        synced_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (production_date, shift, hour_label, part_number, station)
      DO UPDATE SET
        part_family = EXCLUDED.part_family,
        planned_qty = EXCLUDED.planned_qty,
        actual_qty = EXCLUDED.actual_qty,
        scrap_qty = EXCLUDED.scrap_qty,
        attainment_percent = EXCLUDED.attainment_percent,
        source_key = EXCLUDED.source_key,
        synced_at = NOW()
      `,
      [
        row.ProductionDate,
        row.Shift,
        row.HourLabel,
        row.PartFamily,
        row.PartNumber,
        row.Station,
        plannedQty,
        actualQty,
        scrapQty,
        attainment,
        sourceKey,
      ]
    );
  }

  console.log(`Synced ${rows.length} production output records from MSSQL`);

  return {
    synced: rows.length,
  };
}

module.exports = {
  syncProductionOutput,
};