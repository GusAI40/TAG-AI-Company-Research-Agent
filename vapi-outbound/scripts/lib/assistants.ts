import fs from "fs";
import path from "path";
import yaml from "js-yaml";

async function upsertVapiAssistant(payload: any) {
  // Placeholder for API call
  return { id: payload.name };
}

async function saveAssistantRef(name: string, id: string) {
  // Placeholder for DB persistence
  console.log(`saved mapping ${name} -> ${id}`);
}

export async function syncAssistants() {
  const dir = "configs/assistants";
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const conf: any = yaml.load(fs.readFileSync(path.join(dir, f), "utf8"));
    const payload = {
      name: conf.id,
      model: conf.model,
      voice: conf.voice,
      locale: conf.locale,
      systemPrompt: conf.prompt.system,
      tools: conf.tools.map((t: string) => ({ name: t }))
    };
    const res = await upsertVapiAssistant(payload);
    await saveAssistantRef(conf.id, res.id);
  }
}
