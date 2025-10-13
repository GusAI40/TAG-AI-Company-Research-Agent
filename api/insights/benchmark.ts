type BenchmarkInput = {
  revenue: number[];
  ebitda?: number[];
  net_income?: number[];
  free_cash_flow?: number[];
  stock_based_comp?: number[];
  cash?: number;
  debt?: number;
  shares_outstanding?: number[];
};

type MetricInsight = {
  label: string;
  value: string;
  interpretation: string;
};

type BenchmarkResponse = {
  scorecard: MetricInsight[];
  risk_flags: string[];
  notes: string[];
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

const respond = (res: VercelResponse, status: number, payload: unknown) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
};

const parseBody = (payload: unknown): BenchmarkInput => {
  if (!payload) {
    throw new Error('Benchmark request body cannot be empty.');
  }

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as BenchmarkInput;
    } catch (error) {
      throw new Error('Benchmark body must be valid JSON.');
    }
  }

  return payload as BenchmarkInput;
};

const latest = (series?: number[]): number | null => {
  if (!series || !Array.isArray(series) || series.length === 0) {
    return null;
  }
  return series[series.length - 1] ?? null;
};

const previous = (series?: number[]): number | null => {
  if (!series || series.length < 2) {
    return null;
  }
  return series[series.length - 2] ?? null;
};

const formatPercent = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${(value * 100).toFixed(1)}%`;
};

const formatNumber = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return 'n/a';
  }
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  return value.toFixed(2);
};

const computeGrowth = (series?: number[]): number | null => {
  const curr = latest(series);
  const prev = previous(series);
  if (curr === null || prev === null || prev === 0) {
    return null;
  }
  return curr / prev - 1;
};

const computeCagr = (series?: number[]): number | null => {
  if (!series || series.length < 2) {
    return null;
  }
  const first = series[0];
  const last = series[series.length - 1];
  if (first === 0 || !Number.isFinite(first) || !Number.isFinite(last)) {
    return null;
  }
  const years = series.length - 1;
  return Math.pow(last / first, 1 / years) - 1;
};

const toMargin = (numerator: number | null, denominator: number | null): number | null => {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
};

const computeInsights = (input: BenchmarkInput): BenchmarkResponse => {
  if (!Array.isArray(input.revenue) || input.revenue.length === 0) {
    throw new Error('Revenue history is required for benchmarking.');
  }

  const scorecard: MetricInsight[] = [];
  const riskFlags: string[] = [];
  const notes: string[] = [];

  const revGrowth = computeGrowth(input.revenue);
  scorecard.push({
    label: 'Revenue YoY',
    value: formatPercent(revGrowth),
    interpretation:
      revGrowth === null
        ? 'Insufficient history to measure growth.'
        : revGrowth > 0.15
        ? 'High-growth trajectory; validate sustainability.'
        : revGrowth > 0.05
        ? 'Healthy growth aligned with steady performers.'
        : revGrowth >= 0
        ? 'Flat growth—pressure to find catalysts.'
        : 'Revenue contraction—stress test pitch assumptions.',
  });

  const revCagr = computeCagr(input.revenue);
  scorecard.push({
    label: 'Revenue CAGR',
    value: formatPercent(revCagr),
    interpretation:
      revCagr === null
        ? 'Need at least three periods for CAGR.'
        : revCagr > 0.2
        ? 'Elite compounding; highlight TAM and execution.'
        : revCagr > 0.1
        ? 'Solid compounding profile.'
        : revCagr >= 0
        ? 'Low compounding; scrutinize strategic positioning.'
        : 'Negative trend—interrogate management guidance.',
  });

  const latestRevenue = latest(input.revenue);
  const ebitdaMargin = toMargin(latest(input.ebitda), latestRevenue);
  scorecard.push({
    label: 'EBITDA Margin',
    value: formatPercent(ebitdaMargin),
    interpretation:
      ebitdaMargin === null
        ? 'Missing EBITDA data.'
        : ebitdaMargin > 0.25
        ? 'Premium margin structure—defensible moat?'
        : ebitdaMargin > 0.1
        ? 'Acceptable margin; benchmark vs. peers.'
        : ebitdaMargin >= 0
        ? 'Low margin—scrutinize operating leverage.'
        : 'Negative margin—path to profitability is critical.',
  });

  const niMargin = toMargin(latest(input.net_income), latestRevenue);
  scorecard.push({
    label: 'Net Income Margin',
    value: formatPercent(niMargin),
    interpretation:
      niMargin === null
        ? 'Net income history not provided.'
        : niMargin > 0.15
        ? 'Clean earnings power; validate quality.'
        : niMargin > 0.05
        ? 'Reasonable profitability.'
        : niMargin >= 0
        ? 'Near break-even—understand catalysts.'
        : 'Loss-making—pressure test turnaround story.',
  });

  const fcfMargin = toMargin(latest(input.free_cash_flow), latestRevenue);
  scorecard.push({
    label: 'Free Cash Flow Margin',
    value: formatPercent(fcfMargin),
    interpretation:
      fcfMargin === null
        ? 'Cash flow data unavailable.'
        : fcfMargin > 0.15
        ? 'Cash generative—funds reinvestment or buybacks.'
        : fcfMargin > 0.05
        ? 'Moderate cash conversion.'
        : fcfMargin >= 0
        ? 'Low cash conversion—assess working capital.'
        : 'Negative FCF—evaluate burn runway.',
  });

  const sbcRatio = toMargin(latest(input.stock_based_comp), latestRevenue);
  if (sbcRatio !== null) {
    scorecard.push({
      label: 'SBC as % of Revenue',
      value: formatPercent(sbcRatio),
      interpretation:
        sbcRatio > 0.15
          ? 'Heavy dilution pressure—question alignment.'
          : sbcRatio > 0.08
          ? 'Elevated; benchmark vs. peers.'
          : 'Manageable equity comp profile.',
    });
    if (sbcRatio > 0.15) {
      riskFlags.push('Stock-based compensation exceeds 15% of revenue.');
    }
  } else {
    notes.push('Stock-based compensation history not supplied.');
  }

  if (input.cash !== undefined || input.debt !== undefined) {
    const cash = input.cash ?? 0;
    const debt = input.debt ?? 0;
    const netDebt = debt - cash;
    const revenueForComparisons = latestRevenue ?? 0;
    scorecard.push({
      label: 'Net Debt',
      value: formatNumber(netDebt),
      interpretation:
        netDebt <= 0
          ? 'Net cash position—balance sheet strength.'
          : netDebt < revenueForComparisons * 0.5
          ? 'Moderate leverage—monitor covenants.'
          : 'High leverage—stress test liquidity scenarios.',
    });
    if (netDebt > revenueForComparisons && revenueForComparisons > 0) {
      riskFlags.push('Net debt exceeds most recent revenue.');
    }
  }

  const shareDrift = computeGrowth(input.shares_outstanding);
  if (shareDrift !== null) {
    scorecard.push({
      label: 'Share Count YoY',
      value: formatPercent(shareDrift),
      interpretation:
        shareDrift > 0.05
          ? 'Meaningful dilution—evaluate capital allocation.'
          : shareDrift > 0
          ? 'Slight dilution trend.'
          : shareDrift < 0
          ? 'Share shrink—investor-friendly.'
          : 'Share count stable.',
    });
    if (shareDrift > 0.05) {
      riskFlags.push('Share count increased more than 5% year over year.');
    }
  }

  if (riskFlags.length === 0) {
    riskFlags.push('No critical risk flags triggered. Maintain monitoring cadence.');
  }

  if (notes.length === 0) {
    notes.push('Provide additional context (segments, cohorts, or guidance) for richer benchmarking.');
  }

  return {
    scorecard,
    risk_flags: riskFlags,
    notes,
  };
};

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    respond(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = parseBody(req.body);
    const response = computeInsights(body);
    respond(res, 200, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Benchmark processing error';
    respond(res, 400, { error: message });
  }
}
