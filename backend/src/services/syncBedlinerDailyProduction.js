const pgPool = require("../db/pool");
const { getMssqlPool } = require("../db/mssqlPool");

const SOURCE_MODULE = "BEDLINER_ASSEMBLY";
const STORED_PROCEDURE =
  "dbo.SRSDashboard_BEDLINER_Assembly_Daily_Production_Summary";

function calculatePercent(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);

  if (bottom <= 0) return 0;

  return Number(((top / bottom) * 100).toFixed(2));
}

async function syncBedlinerDailyProduction() {
  const mssqlPool = await getMssqlPool();

  const result = await mssqlPool.request().execute(STORED_PROCEDURE);

  const rows = result.recordset || [];

  for (const row of rows) {
    const scheduled = Number(row.Total_Scheduled_Sequences || 0);
    const actual = Number(row.Total_Assembly_Production || 0);
    const assemblyRejects = Number(row.Total_Assembly_Rejects || 0);
    const sequencingRejects = Number(row.Total_Sequencing_Rejects || 0);
    const callOffs = Number(row.Total_Call_Offs || 0);

    const attainmentPercent = calculatePercent(actual, scheduled);
    const assemblyRejectPercent = calculatePercent(assemblyRejects, actual);
    const sequencingRejectPercent = calculatePercent(
      sequencingRejects,
      scheduled
    );

    await pgPool.query(
      `
      INSERT INTO production_daily_summary_snapshot (
        source_module,
        work_date,
        total_scheduled_sequences,
        total_assembly_production,
        total_assembly_rejects,
        total_sequencing_rejects,
        total_call_offs,
        attainment_percent,
        assembly_reject_percent,
        sequencing_reject_percent,
        stored_procedure,
        synced_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (source_module, work_date)
      DO UPDATE SET
        total_scheduled_sequences = EXCLUDED.total_scheduled_sequences,
        total_assembly_production = EXCLUDED.total_assembly_production,
        total_assembly_rejects = EXCLUDED.total_assembly_rejects,
        total_sequencing_rejects = EXCLUDED.total_sequencing_rejects,
        total_call_offs = EXCLUDED.total_call_offs,
        attainment_percent = EXCLUDED.attainment_percent,
        assembly_reject_percent = EXCLUDED.assembly_reject_percent,
        sequencing_reject_percent = EXCLUDED.sequencing_reject_percent,
        stored_procedure = EXCLUDED.stored_procedure,
        synced_at = NOW()
      `,
      [
        SOURCE_MODULE,
        row.WorkDate,
        scheduled,
        actual,
        assemblyRejects,
        sequencingRejects,
        callOffs,
        attainmentPercent,
        assemblyRejectPercent,
        sequencingRejectPercent,
        STORED_PROCEDURE,
      ]
    );
  }

  console.log(
    `✅ Synced ${rows.length} Bedliner daily production summary records`
  );

  return {
    synced: rows.length,
    rows,
  };
}

module.exports = {
  syncBedlinerDailyProduction,
};