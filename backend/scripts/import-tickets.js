const fs = require("fs");
const csv = require("csv-parser");
const pool = require("../src/db/pool");
const results = [];

fs.createReadStream("scripts/data/freshservice_tickets.csv")
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", async () => {
    console.log(`Importing ${results.length} tickets...`);

    for (const row of results) {
      try {
        const query = `
          INSERT INTO tickets (title, description, status, external_id)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (external_id) DO NOTHING
        `;

        await pool.query(query, [
          row.Subject,
          row.Description,
          mapStatus(row.Status),
          row.ID,
        ]);
      } catch (err) {
        console.error("Error inserting ticket:", err);
      }
    }

    console.log("✅ Import complete");
  });

function mapStatus(status) {
  if (!status) return "open";

  if (status.toLowerCase().includes("resolved")) return "resolved";
  if (status.toLowerCase().includes("pending")) return "pending";

  return "open";
}