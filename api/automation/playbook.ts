const respond = (res: VercelResponse, status: number, payload: unknown) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
};

type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

type SignalInput = {
  name: string;
  trend?: 'up' | 'down' | 'flat';
  severity?: 'low' | 'medium' | 'high';
  comment?: string;
};

type PlaybookInput = {
  objective: string;
  horizon_days?: number;
  signals?: SignalInput[];
  notes?: string;
};

type PlaybookAction = {
  title: string;
  owner: string;
  cadence: string;
  description: string;
};

type PlaybookResponse = {
  objective: string;
  horizon_days: number;
  triggers: string[];
  actions: PlaybookAction[];
  follow_ups: string[];
};

const parseBody = (payload: unknown): PlaybookInput => {
  if (!payload) {
    throw new Error('Playbook request body cannot be empty.');
  }

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as PlaybookInput;
    } catch (error) {
      throw new Error('Playbook body must be valid JSON.');
    }
  }

  return payload as PlaybookInput;
};

const normaliseObjective = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Objective cannot be empty.');
  }
  return trimmed;
};

const pickOwner = (signal: SignalInput | null, objective: string): string => {
  const lower = objective.toLowerCase();
  if (signal && /liquidity|cash/.test(signal.name.toLowerCase())) {
    return 'Treasury Lead';
  }
  if (/go-to-market|pipeline|revenue|growth/.test(lower)) {
    return 'Revenue Ops';
  }
  if (/risk|compliance|governance/.test(lower)) {
    return 'Risk Officer';
  }
  if (/margin|profit|efficiency|cost/.test(lower)) {
    return 'FP&A Partner';
  }
  return 'Strategy Team';
};

const describeSignal = (signal: SignalInput): string => {
  const severity = signal.severity ? signal.severity.toUpperCase() : 'MEDIUM';
  const trendLabel = signal.trend ? `trend ${signal.trend}` : 'trend mixed';
  const detail = signal.comment ? ` – ${signal.comment}` : '';
  return `${severity}: ${signal.name} (${trendLabel})${detail}`;
};

const buildAction = (signal: SignalInput | null, objective: string): PlaybookAction => {
  const owner = pickOwner(signal, objective);
  const signalName = signal?.name ?? objective;
  const severity = signal?.severity ?? 'medium';

  let cadence = 'Bi-weekly';
  if (severity === 'high') {
    cadence = 'Daily';
  } else if (severity === 'low') {
    cadence = 'Monthly';
  }

  let description = `Align stakeholders on ${signalName} and publish a measurable target.`;
  if (signal?.trend === 'down') {
    description = `Launch a turnaround sprint for ${signalName} with root-cause analysis and countermeasures.`;
  } else if (signal?.trend === 'up') {
    description = `Double down on ${signalName} momentum by unlocking incremental resources and testing scale plays.`;
  }

  return {
    title: `${signalName} play`,
    owner,
    cadence,
    description,
  };
};

const buildPlaybook = (input: PlaybookInput): PlaybookResponse => {
  const objective = normaliseObjective(input.objective);
  const horizon = input.horizon_days && input.horizon_days > 0 ? Math.round(input.horizon_days) : 90;
  const signals = Array.isArray(input.signals) ? input.signals : [];

  const triggers = signals.length
    ? signals.map((signal) => describeSignal(signal))
    : [`Track lead metric momentum for ${objective}.`];

  const actions: PlaybookAction[] = signals.length
    ? signals.map((signal) => buildAction(signal, objective))
    : [buildAction(null, objective)];

  const followUps: string[] = [];
  followUps.push(`Review progress on ${objective} every ${actions[0]?.cadence.toLowerCase() ?? 'bi-weekly'} with exec sponsors.`);

  if (signals.some((signal) => signal.severity === 'high')) {
    followUps.push('Escalate blockers within 24 hours via the executive chat channel.');
  }
  if (input.notes) {
    followUps.push(`Capture context: ${input.notes.trim()}`);
  }

  followUps.push('Archive dashboards and attach a quick Loom recap for the finance clubhouse.');

  return {
    objective,
    horizon_days: horizon,
    triggers,
    actions,
    follow_ups: followUps,
  };
};

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method && req.method !== 'POST') {
    respond(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const payload = parseBody(req.body);
    const playbook = buildPlaybook(payload);
    respond(res, 200, playbook satisfies PlaybookResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate automation playbook.';
    respond(res, 400, { error: message });
  }
}
