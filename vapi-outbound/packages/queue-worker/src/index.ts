import PLimit from "p-limit";

// Placeholder DB and API helpers
async function eligibleLeads(_campaignId: string) {
  return [] as { id: string; phone: string }[];
}
async function markQueued(_id: string) {}
async function markError(_id: string, _err: string) {}
async function createCall(_opts: any) {}
async function resolveAssistantId(_campaignId: string) {
  return "assistant-123";
}

const limit = PLimit(Number(process.env.MAX_CONCURRENCY || 25));

export async function runBatch(campaignId: string) {
  const leads = await eligibleLeads(campaignId);
  await Promise.all(
    leads.map((lead) =>
      limit(async () => {
        try {
          await markQueued(lead.id);
          const meta = { lead_id: lead.id, campaign_id: campaignId };
          await createCall({
            assistantId: await resolveAssistantId(campaignId),
            customer: { number: lead.phone },
            metadata: meta,
          });
        } catch (e: any) {
          await markError(lead.id, String(e));
        }
      })
    )
  );
}
