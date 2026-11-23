const cron = require("node-cron");
const { runBedlinerSync } = require("./productionSyncRunner");

function startProductionSyncScheduler() {
  cron.schedule("*/10 * * * *", async () => {
    await runBedlinerSync({ trigger: "scheduled" });
  });
}

module.exports = {
  startProductionSyncScheduler,
};
