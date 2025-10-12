const SEC_TICKER_URL = 'https://www.sec.gov/files/company_tickers.json';
const SEC_SUBMISSIONS_URL = 'https://data.sec.gov/submissions/CIK';

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? 'PitchGuard/1.0 (olemiss-finance-club@example.com)';

type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

type CompanyRecord = {
  cik_str: number;
  ticker: string;
  title: string;
};

type SubmissionResponse = {
  cik: string;
  entityType?: string;
  sic?: string;
  sicDescription?: string;
  tickers?: string[];
  companyName?: string;
  filings?: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
      primaryDocument: string[];
      reportDate: string[];
    };
  };
};

type FilingSummary = {
  form: string;
  filed: string;
  report?: string;
  accession_number: string;
  document_url: string;
};

let cachedTickers: Map<string, CompanyRecord> | null = null;

const respond = (res: VercelResponse, status: number, payload: unknown) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
};

const normaliseQuery = (req: VercelRequest): { ticker?: string; cik?: string } => {
  const source = req.query ?? {};
  const tickerRaw = Array.isArray(source.ticker) ? source.ticker[0] : source.ticker;
  const cikRaw = Array.isArray(source.cik) ? source.cik[0] : source.cik;
  const ticker = tickerRaw?.trim().toUpperCase();
  const cik = cikRaw?.trim();
  return { ticker, cik };
};

const loadTickerDictionary = async (): Promise<Map<string, CompanyRecord>> => {
  if (cachedTickers) {
    return cachedTickers;
  }

  const response = await fetch(SEC_TICKER_URL, {
    headers: {
      'User-Agent': SEC_USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load SEC tickers: ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, CompanyRecord>;
  const map = new Map<string, CompanyRecord>();
  Object.values(payload).forEach((entry) => {
    map.set(entry.ticker.toUpperCase(), entry);
  });

  cachedTickers = map;
  return map;
};

const resolveCik = async (ticker?: string, cik?: string): Promise<{ cik: string; company?: string }> => {
  if (cik) {
    const normalised = cik.replace(/[^0-9]/g, '').padStart(10, '0');
    return { cik: normalised };
  }

  if (!ticker) {
    throw new Error('A ticker or CIK must be provided.');
  }

  const dictionary = await loadTickerDictionary();
  const record = dictionary.get(ticker.toUpperCase());
  if (!record) {
    throw new Error(`No SEC record found for ticker ${ticker}.`);
  }

  return { cik: String(record.cik_str).padStart(10, '0'), company: record.title };
};

const buildDocumentUrl = (cik: string, accession: string, primaryDoc: string): string => {
  const cleanAccession = accession.replace(/-/g, '');
  const cikNumber = cik.replace(/^0+/, '');
  return `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${cleanAccession}/${primaryDoc}`;
};

const fetchSubmissions = async (cik: string): Promise<SubmissionResponse> => {
  const response = await fetch(`${SEC_SUBMISSIONS_URL}${cik}.json`, {
    headers: {
      'User-Agent': SEC_USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SEC submissions (status ${response.status}).`);
  }

  return (await response.json()) as SubmissionResponse;
};

const extractFilings = (submission: SubmissionResponse, take = 6): FilingSummary[] => {
  const recent = submission.filings?.recent;
  if (!recent) {
    return [];
  }

  const items: FilingSummary[] = [];
  for (let index = 0; index < Math.min(take, recent.form.length); index += 1) {
    const accession = recent.accessionNumber[index];
    const form = recent.form[index];
    const filed = recent.filingDate[index];
    const report = recent.reportDate[index];
    const primary = recent.primaryDocument[index];
    items.push({
      form,
      filed,
      report,
      accession_number: accession,
      document_url: buildDocumentUrl(submission.cik, accession, primary),
    });
  }

  return items;
};

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method && req.method !== 'GET') {
    respond(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const { ticker, cik } = normaliseQuery(req);
    const { cik: resolvedCik, company } = await resolveCik(ticker, cik);
    const submission = await fetchSubmissions(resolvedCik);
    const filings = extractFilings(submission);

    respond(res, 200, {
      company: submission.companyName ?? company ?? ticker ?? resolvedCik,
      cik: resolvedCik,
      filings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SEC lookup error';
    respond(res, 400, { error: message });
  }
}
