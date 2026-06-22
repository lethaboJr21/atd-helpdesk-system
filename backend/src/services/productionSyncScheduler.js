const cron = require("node-cron");
const { syncBedlinerDailyProduction } = require("./syncBedlinerDailyProduction");

function startProductionSyncScheduler() {
  cron.schedule("*/10 * * * *", async () => {
    try {
      console.log("Running scheduled Bedliner production sync...");
      await syncBedlinerDailyProduction();
    } catch (err) {
      console.error("Scheduled Bedliner production sync failed:", err.message);
    }
  });
}

module.exports = {
  startProductionSyncScheduler,
};