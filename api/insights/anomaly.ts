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

type SeriesInput = {
  label: string;
  values: number[];
  timestamps?: Array<string | number>;
};

type AnomalyInput = {
  series: SeriesInput[];
  sensitivity?: number;
};

type AnomalyPoint = {
  index: number;
  value: number;
  z_score: number;
  timestamp: string | null;
};

type AnomalyInsight = {
  label: string;
  mean: number;
  std_dev: number;
  anomalies: AnomalyPoint[];
};

type AnomalyResponse = {
  sensitivity: number;
  insights: AnomalyInsight[];
};

const ensureArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error('Series values must be an array of numbers.');
  }
  return value;
};

const parseBody = (payload: unknown): AnomalyInput => {
  if (!payload) {
    throw new Error('Anomaly request body cannot be empty.');
  }

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as AnomalyInput;
    } catch (error) {
      throw new Error('Anomaly body must be valid JSON.');
    }
  }

  return payload as AnomalyInput;
};

const toNumbers = (values: unknown[]): number[] => {
  const mapped = values.map((value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return parsed;
      }
    }
    throw new Error('Each series value must be a finite number.');
  });
  return mapped;
};

const computeStats = (values: number[]) => {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0 };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
};

const detectAnomalies = (series: SeriesInput, sensitivity: number): AnomalyInsight => {
  ensureArray(series.values);
  const values = toNumbers(series.values);
  const { mean, stdDev } = computeStats(values);

  const anomalies: AnomalyPoint[] = [];
  if (stdDev === 0) {
    return { label: series.label, mean, std_dev: stdDev, anomalies };
  }

  values.forEach((value, index) => {
    const z = (value - mean) / stdDev;
    if (Math.abs(z) >= sensitivity) {
      const timestampValue = Array.isArray(series.timestamps)
        ? series.timestamps[index] ?? null
        : null;
      const timestamp = timestampValue === null || timestampValue === undefined ? null : String(timestampValue);
      anomalies.push({ index, value, z_score: Number(z.toFixed(3)), timestamp });
    }
  });

  return { label: series.label, mean: Number(mean.toFixed(3)), std_dev: Number(stdDev.toFixed(3)), anomalies };
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
    const body = parseBody(req.body);
    if (!Array.isArray(body.series) || body.series.length === 0) {
      throw new Error('Provide at least one data series to evaluate.');
    }

    const sensitivity = body.sensitivity && Number.isFinite(body.sensitivity) ? Number(body.sensitivity) : 2.5;
    if (sensitivity <= 0) {
      throw new Error('Sensitivity must be greater than zero.');
    }

    const insights = body.series.map((series) => {
      if (!series || typeof series.label !== 'string' || !series.label.trim()) {
        throw new Error('Each series must include a label.');
      }
      return detectAnomalies(series, sensitivity);
    });

    respond(res, 200, { sensitivity, insights } satisfies AnomalyResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to compute anomalies.';
    respond(res, 400, { error: message });
  }
}
