// Next.js API route for Vapi webhooks
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  // TODO: insert raw event, upsert call, update disposition
  res.status(200).json({ ok: true });
}
