import { runBatch } from "../packages/queue-worker/src/index";

const id = process.env.CAMPAIGN_ID!;
runBatch(id);
