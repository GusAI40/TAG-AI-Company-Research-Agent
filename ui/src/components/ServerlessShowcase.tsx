import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BenchmarkSummary,
  GlassStyle,
  HealthSummary,
  SecFiling,
  SecSnapshot,
} from '../types';

const HEALTH_ENDPOINT = '/api/health';
const SEC_ENDPOINT = '/api/sec/filings';
const BENCHMARK_ENDPOINT = '/api/insights/benchmark';

type FetchState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

const useFetch = <T,>(url: string | null): FetchState<T> => {
  const [state, setState] = useState<FetchState<T>>({ loading: Boolean(url), error: null, data: null });

  useEffect(() => {
    if (!url) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setState({ loading: true, error: null, data: null });
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as T;
        if (!cancelled) {
          setState({ loading: false, error: null, data: payload });
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unexpected fetch error';
          setState({ loading: false, error: message, data: null });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
};

type ServerlessShowcaseProps = {
  glassStyle: GlassStyle;
};

const parseSeries = (input: string): number[] | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const values = trimmed
    .split(',')
    .map((value) => Number.parseFloat(value.trim()))
    .filter((value) => !Number.isNaN(value));
  return values.length > 0 ? values : null;
};

const ServerlessShowcase = ({ glassStyle }: ServerlessShowcaseProps) => {
  const healthState = useFetch<HealthSummary>(HEALTH_ENDPOINT);

  const [tickerInput, setTickerInput] = useState('AAPL');
  const [filingsState, setFilingsState] = useState<FetchState<SecSnapshot>>({
    loading: false,
    error: null,
    data: null,
  });

  const [revenueInput, setRevenueInput] = useState('289.2, 365.8, 383.3');
  const [ebitdaInput, setEbitdaInput] = useState('81.3, 120.2, 131.7');
  const [netIncomeInput, setNetIncomeInput] = useState('57.4, 94.7, 97.0');
  const [fcfInput, setFcfInput] = useState('73.3, 111.4, 107.8');
  const [sbcInput, setSbcInput] = useState('6.5, 7.0, 7.6');
  const [sharesInput, setSharesInput] = useState('17.0, 16.3, 15.7');
  const [cashInput, setCashInput] = useState('62.6');
  const [debtInput, setDebtInput] = useState('98.9');
  const [benchmarkState, setBenchmarkState] = useState<FetchState<BenchmarkSummary>>({
    loading: false,
    error: null,
    data: null,
  });

  const onLookupFilings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ticker = tickerInput.trim().toUpperCase();
    if (!ticker) {
      setFilingsState({ loading: false, error: 'Enter a ticker to lookup SEC filings.', data: null });
      return;
    }

    setFilingsState({ loading: true, error: null, data: null });
    try {
      const response = await fetch(`${SEC_ENDPOINT}?ticker=${encodeURIComponent(ticker)}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Lookup failed with status ${response.status}`);
      }
      const payload = (await response.json()) as SecSnapshot;
      setFilingsState({ loading: false, error: null, data: payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch SEC filings.';
      setFilingsState({ loading: false, error: message, data: null });
    }
  };

  const onRunBenchmark = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const revenue = parseSeries(revenueInput);
    if (!revenue) {
      setBenchmarkState({ loading: false, error: 'Provide at least two revenue data points.', data: null });
      return;
    }

    const payload = {
      revenue,
      ebitda: parseSeries(ebitdaInput) ?? undefined,
      net_income: parseSeries(netIncomeInput) ?? undefined,
      free_cash_flow: parseSeries(fcfInput) ?? undefined,
      stock_based_comp: parseSeries(sbcInput) ?? undefined,
      shares_outstanding: parseSeries(sharesInput) ?? undefined,
      cash: Number.parseFloat(cashInput) || undefined,
      debt: Number.parseFloat(debtInput) || undefined,
    };

    setBenchmarkState({ loading: true, error: null, data: null });
    try {
      const response = await fetch(BENCHMARK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Benchmark failed with status ${response.status}`);
      }
      const result = (await response.json()) as BenchmarkSummary;
      setBenchmarkState({ loading: false, error: null, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to compute benchmark insights.';
      setBenchmarkState({ loading: false, error: message, data: null });
    }
  };

  const renderHealth = useMemo(() => {
    if (healthState.loading) {
      return <p className="equilibrium-text-muted">Checking integrations…</p>;
    }
    if (healthState.error) {
      return <p className="equilibrium-text-error">{healthState.error}</p>;
    }
    if (!healthState.data) {
      return null;
    }

    return (
      <div className="serverless-grid">
        {healthState.data.results.map((check) => (
          <div key={check.name} className="equilibrium-card serverless-card">
            <div className={`serverless-status serverless-status--${check.status}`}>
              <span className="serverless-status__dot" />
              <span>{check.status.toUpperCase()}</span>
            </div>
            <h4 className="serverless-card__title">{check.name}</h4>
            <dl className="serverless-card__details">
              <div>
                <dt>Latency</dt>
                <dd>{check.latency_ms !== null ? `${check.latency_ms} ms` : 'n/a'}</dd>
              </div>
              {check.status_code ? (
                <div>
                  <dt>Status</dt>
                  <dd>{check.status_code}</dd>
                </div>
              ) : null}
            </dl>
            {check.message ? <p className="serverless-card__message">{check.message}</p> : null}
          </div>
        ))}
      </div>
    );
  }, [healthState]);

  const renderFilings = useMemo(() => {
    if (filingsState.loading) {
      return <p className="equilibrium-text-muted">Looking up filings…</p>;
    }
    if (filingsState.error) {
      return <p className="equilibrium-text-error">{filingsState.error}</p>;
    }
    if (!filingsState.data) {
      return <p className="equilibrium-text-muted">Search for a ticker to preview the latest SEC filings.</p>;
    }

    const filings = filingsState.data.filings.slice(0, 5);
    return (
      <div className="serverless-list">
        {filings.map((filing: SecFiling) => (
          <a key={filing.accession_number} href={filing.document_url} className="serverless-link" target="_blank" rel="noreferrer">
            <div className="serverless-link__header">
              <span className="serverless-pill">{filing.form}</span>
              <span className="serverless-link__date">{filing.filed}</span>
            </div>
            <p className="serverless-link__meta">
              {filing.report ? `Report period ${filing.report}` : 'No report period disclosed'}
            </p>
          </a>
        ))}
      </div>
    );
  }, [filingsState]);

  const renderBenchmark = useMemo(() => {
    if (benchmarkState.loading) {
      return <p className="equilibrium-text-muted">Scoring your metrics…</p>;
    }
    if (benchmarkState.error) {
      return <p className="equilibrium-text-error">{benchmarkState.error}</p>;
    }
    if (!benchmarkState.data) {
      return <p className="equilibrium-text-muted">Provide revenue and optional metrics to generate a quick diligence scorecard.</p>;
    }

    return (
      <div className="serverless-benchmark">
        <div className="serverless-list">
          {benchmarkState.data.scorecard.map((item) => (
            <div key={item.label} className="equilibrium-card serverless-card">
              <div className="serverless-card__header">
                <span className="serverless-pill">{item.label}</span>
                <span className="serverless-value">{item.value}</span>
              </div>
              <p className="serverless-card__message">{item.interpretation}</p>
            </div>
          ))}
        </div>
        <div className="serverless-callouts">
          <div className="equilibrium-card serverless-card">
            <h4 className="serverless-card__title">Risk Flags</h4>
            <ul>
              {benchmarkState.data.risk_flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          </div>
          <div className="equilibrium-card serverless-card">
            <h4 className="serverless-card__title">Analyst Notes</h4>
            <ul>
              {benchmarkState.data.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }, [benchmarkState]);

  return (
    <section className="serverless-section">
      <div className={`${glassStyle.card} serverless-panel`}>
        <header className="serverless-panel__header">
          <div>
            <h3>Serverless Ops Radar</h3>
            <p>Real-time health signals from every external dependency powering PitchGuard.</p>
          </div>
          <span className="serverless-timestamp">
            {healthState.data ? new Date(healthState.data.timestamp).toLocaleTimeString() : '—'}
          </span>
        </header>
        {renderHealth}
      </div>

      <div className="serverless-layout">
        <div className={`${glassStyle.card} serverless-panel`}>
          <header className="serverless-panel__header">
            <div>
              <h3>SEC Filing Fast Pass</h3>
              <p>Pull the latest 10-Ks, 10-Qs, and 8-Ks without leaving PitchGuard.</p>
            </div>
          </header>
          <form className="serverless-form" onSubmit={onLookupFilings}>
            <label className="serverless-label" htmlFor="serverless-ticker">
              Ticker
            </label>
            <div className="serverless-input-row">
              <input
                id="serverless-ticker"
                className="serverless-input"
                value={tickerInput}
                onChange={(event) => setTickerInput(event.target.value)}
                placeholder="e.g. AAPL"
                autoComplete="off"
              />
              <button type="submit" className="serverless-button">
                Fetch filings
              </button>
            </div>
          </form>
          {renderFilings}
        </div>

        <div className={`${glassStyle.card} serverless-panel`}>
          <header className="serverless-panel__header">
            <div>
              <h3>Pitch Benchmark Studio</h3>
              <p>Drop in revenue and cash metrics to auto-build a diligence scorecard.</p>
            </div>
          </header>
          <form className="serverless-form serverless-form--grid" onSubmit={onRunBenchmark}>
            <label className="serverless-label" htmlFor="benchmark-revenue">
              Revenue (billions)
            </label>
            <input
              id="benchmark-revenue"
              className="serverless-input"
              value={revenueInput}
              onChange={(event) => setRevenueInput(event.target.value)}
            />

            <label className="serverless-label" htmlFor="benchmark-ebitda">
              EBITDA (billions)
            </label>
            <input
              id="benchmark-ebitda"
              className="serverless-input"
              value={ebitdaInput}
              onChange={(event) => setEbitdaInput(event.target.value)}
            />

            <label className="serverless-label" htmlFor="benchmark-net-income">
              Net income (billions)
            </label>
            <input
              id="benchmark-net-income"
              className="serverless-input"
              value={netIncomeInput}
              onChange={(event) => setNetIncomeInput(event.target.value)}
            />

            <label className="serverless-label" htmlFor="benchmark-fcf">
              Free cash flow (billions)
            </label>
            <input
              id="benchmark-fcf"
              className="serverless-input"
              value={fcfInput}
              onChange={(event) => setFcfInput(event.target.value)}
            />

            <label className="serverless-label" htmlFor="benchmark-sbc">
              SBC (billions)
            </label>
            <input
              id="benchmark-sbc"
              className="serverless-input"
              value={sbcInput}
              onChange={(event) => setSbcInput(event.target.value)}
            />

            <label className="serverless-label" htmlFor="benchmark-shares">
              Shares outstanding (billions)
            </label>
            <input
              id="benchmark-shares"
              className="serverless-input"
              value={sharesInput}
              onChange={(event) => setSharesInput(event.target.value)}
            />

            <label className="serverless-label" htmlFor="benchmark-cash">
              Cash (billions)
            </label>
            <input
              id="benchmark-cash"
              className="serverless-input"
              value={cashInput}
              onChange={(event) => setCashInput(event.target.value)}
            />

            <label className="serverless-label" htmlFor="benchmark-debt">
              Debt (billions)
            </label>
            <input
              id="benchmark-debt"
              className="serverless-input"
              value={debtInput}
              onChange={(event) => setDebtInput(event.target.value)}
            />

            <button type="submit" className="serverless-button serverless-button--full">
              Run benchmark
            </button>
          </form>
          {renderBenchmark}
        </div>
      </div>
    </section>
  );
};

export default ServerlessShowcase;
