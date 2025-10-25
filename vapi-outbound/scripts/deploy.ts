import { upsertSchema } from "./lib/db";
import { syncAssistants } from "./lib/assistants";
import { syncCampaigns } from "./lib/campaigns";
import { syncNumbers } from "./lib/numbers";

(async () => {
  await upsertSchema();
  await syncNumbers();
  await syncAssistants();
  await syncCampaigns();
  console.log("Deploy complete.");
})();
