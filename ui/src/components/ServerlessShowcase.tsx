import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AnomalySummary,
  BenchmarkSummary,
  GlassStyle,
  HealthSummary,
  PlaybookSummary,
  SecFiling,
  SecSnapshot,
} from '../types';
import StreamingChatPanel from './StreamingChatPanel';

const HEALTH_ENDPOINT = '/api/health';
const SEC_ENDPOINT = '/api/sec/filings';
const BENCHMARK_ENDPOINT = '/api/insights/benchmark';
const ANOMALY_ENDPOINT = '/api/insights/anomaly';
const PLAYBOOK_ENDPOINT = '/api/automation/playbook';

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

  const [anomalySeriesInput, setAnomalySeriesInput] = useState(
    'Revenue: 120, 135, 128, 190, 210\nEBITDA: 40, 42, 39, 65, 60'
  );
  const [sensitivityInput, setSensitivityInput] = useState('2.5');
  const [anomalyState, setAnomalyState] = useState<FetchState<AnomalySummary>>({
    loading: false,
    error: null,
    data: null,
  });

  const [objectiveInput, setObjectiveInput] = useState('Stabilize enterprise pipeline velocity');
  const [horizonInput, setHorizonInput] = useState('45');
  const [signalsInput, setSignalsInput] = useState(
    'Pipeline conversion: down: high: Enterprise win rate slipped three quarters\nSBC spend: up: medium: Offset via targeted hiring freeze'
  );
  const [notesInput, setNotesInput] = useState('Prep summary for the Ole Miss Finance Club weekly debrief.');
  const [playbookState, setPlaybookState] = useState<FetchState<PlaybookSummary>>({
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

  const parseAnomalySeriesInput = (): { label: string; values: number[]; timestamps?: string[] }[] | null => {
    const lines = anomalySeriesInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return null;
    }

    const parsed = lines.map((line) => {
      const [labelPart, rest] = line.split(':');
      if (!rest) {
        throw new Error('Each line must follow the pattern "Label: value, value".');
      }

      const [valuesPart, timestampsPart] = rest.split('|');
      const values = parseSeries(valuesPart ?? '');
      if (!values) {
        throw new Error(`Unable to parse numeric values for ${labelPart.trim()}.`);
      }

      const timestamps = timestampsPart
        ? timestampsPart
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : undefined;

      return {
        label: labelPart.trim(),
        values,
        timestamps,
      };
    });

    return parsed;
  };

  const parseSignalsInput = (): {
    name: string;
    trend?: 'up' | 'down' | 'flat';
    severity?: 'low' | 'medium' | 'high';
    comment?: string;
  }[] => {
    const lines = signalsInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      const segments = line.split(':').map((segment) => segment.trim());
      const [name, trend, severity, comment] = segments;
      if (!name) {
        throw new Error('Each signal requires a descriptive name.');
      }

      const normalisedTrend = trend && ['up', 'down', 'flat'].includes(trend.toLowerCase())
        ? (trend.toLowerCase() as 'up' | 'down' | 'flat')
        : undefined;
      const normalisedSeverity = severity && ['low', 'medium', 'high'].includes(severity.toLowerCase())
        ? (severity.toLowerCase() as 'low' | 'medium' | 'high')
        : undefined;

      return {
        name,
        trend: normalisedTrend,
        severity: normalisedSeverity,
        comment,
      };
    });
  };

  const onDetectAnomalies = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const series = parseAnomalySeriesInput();
      if (!series || series.length === 0) {
        throw new Error('Provide at least one labelled metric series.');
      }

      const sensitivity = Number.parseFloat(sensitivityInput) || 2.5;
      setAnomalyState({ loading: true, error: null, data: null });

      const response = await fetch(ANOMALY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series, sensitivity }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Anomaly detection failed with status ${response.status}`);
      }

      const payload = (await response.json()) as AnomalySummary;
      setAnomalyState({ loading: false, error: null, data: payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to analyse anomalies.';
      setAnomalyState({ loading: false, error: message, data: null });
    }
  };

  const onGeneratePlaybook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const objective = objectiveInput.trim();
      if (!objective) {
        throw new Error('Provide an objective for the automation playbook.');
      }

      const signals = parseSignalsInput();
      const horizon = Number.parseInt(horizonInput, 10);

      setPlaybookState({ loading: true, error: null, data: null });

      const response = await fetch(PLAYBOOK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective,
          horizon_days: Number.isNaN(horizon) ? undefined : horizon,
          signals,
          notes: notesInput.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Playbook generation failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PlaybookSummary;
      setPlaybookState({ loading: false, error: null, data: payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to build automation playbook.';
      setPlaybookState({ loading: false, error: message, data: null });
    }
  };

  const renderAnomaly = useMemo(() => {
    if (anomalyState.loading) {
      return <p className="equilibrium-text-muted">Scanning for anomalies…</p>;
    }
    if (anomalyState.error) {
      return <p className="equilibrium-text-error">{anomalyState.error}</p>;
    }
    if (!anomalyState.data) {
      return (
        <p className="equilibrium-text-muted">
          Provide labelled metric series to surface outliers before your pitch review.
        </p>
      );
    }

    return (
      <div className="serverless-anomalies">
        {anomalyState.data.insights.map((insight) => (
          <div key={insight.label} className="equilibrium-card serverless-card">
            <div className="serverless-card__header">
              <span className="serverless-pill">{insight.label}</span>
              <span className="serverless-value">μ {insight.mean}</span>
            </div>
            <p className="serverless-card__message">σ {insight.std_dev}</p>
            {insight.anomalies.length === 0 ? (
              <p className="equilibrium-text-muted">No anomalies detected at the current sensitivity.</p>
            ) : (
              <ul className="serverless-list--simple">
                {insight.anomalies.map((point) => (
                  <li key={`${insight.label}-${point.index}`}>
                    <strong>{point.value}</strong> at index {point.index}
                    {point.timestamp ? ` (${point.timestamp})` : ''} — z {point.z_score}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }, [anomalyState]);

  const renderPlaybook = useMemo(() => {
    if (playbookState.loading) {
      return <p className="equilibrium-text-muted">Composing automation steps…</p>;
    }
    if (playbookState.error) {
      return <p className="equilibrium-text-error">{playbookState.error}</p>;
    }
    if (!playbookState.data) {
      return (
        <p className="equilibrium-text-muted">
          Add signals to generate a ready-to-run LangGraph-inspired automation playbook.
        </p>
      );
    }

    return (
      <div className="serverless-playbook">
        <div className="equilibrium-card serverless-card">
          <h4 className="serverless-card__title">Objective</h4>
          <p className="serverless-card__message">
            {playbookState.data.objective} · {playbookState.data.horizon_days}-day horizon
          </p>
          <h5 className="serverless-card__subtitle">Triggers</h5>
          <ul>
            {playbookState.data.triggers.map((trigger) => (
              <li key={trigger}>{trigger}</li>
            ))}
          </ul>
        </div>
        <div className="equilibrium-card serverless-card">
          <h4 className="serverless-card__title">Action Tracks</h4>
          <ul className="serverless-list--simple">
            {playbookState.data.actions.map((action) => (
              <li key={action.title}>
                <strong>{action.title}</strong> — {action.owner} · {action.cadence}
                <br />
                <span className="equilibrium-text-muted">{action.description}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="equilibrium-card serverless-card">
          <h4 className="serverless-card__title">Follow-ups</h4>
          <ul>
            {playbookState.data.follow_ups.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }, [playbookState]);

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

      <StreamingChatPanel glassStyle={glassStyle} />

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

      <div className="serverless-layout">
        <div className={`${glassStyle.card} serverless-panel`}>
          <header className="serverless-panel__header">
            <div>
              <h3>Anomaly Radar</h3>
              <p>Drop in labelled KPI series to surface outliers before they torpedo the pitch.</p>
            </div>
          </header>
          <form className="serverless-form" onSubmit={onDetectAnomalies}>
            <label className="serverless-label" htmlFor="anomaly-series">
              Metrics
            </label>
            <textarea
              id="anomaly-series"
              className="serverless-input serverless-input--multiline"
              value={anomalySeriesInput}
              onChange={(event) => setAnomalySeriesInput(event.target.value)}
              rows={4}
              placeholder={'Revenue: 120, 135, 128\nEBITDA: 40, 42, 39'}
            />
            <label className="serverless-label" htmlFor="anomaly-sensitivity">
              Sensitivity (z-score threshold)
            </label>
            <input
              id="anomaly-sensitivity"
              className="serverless-input"
              value={sensitivityInput}
              onChange={(event) => setSensitivityInput(event.target.value)}
            />
            <button type="submit" className="serverless-button serverless-button--full">
              Detect anomalies
            </button>
          </form>
          {renderAnomaly}
        </div>

        <div className={`${glassStyle.card} serverless-panel`}>
          <header className="serverless-panel__header">
            <div>
              <h3>Automation Playbook Lab</h3>
              <p>Generate LangGraph-ready triggers and actions for your finance clubhouse.</p>
            </div>
          </header>
          <form className="serverless-form serverless-form--grid" onSubmit={onGeneratePlaybook}>
            <label className="serverless-label" htmlFor="playbook-objective">
              Objective
            </label>
            <input
              id="playbook-objective"
              className="serverless-input"
              value={objectiveInput}
              onChange={(event) => setObjectiveInput(event.target.value)}
            />

            <label className="serverless-label" htmlFor="playbook-horizon">
              Horizon (days)
            </label>
            <input
              id="playbook-horizon"
              className="serverless-input"
              value={horizonInput}
              onChange={(event) => setHorizonInput(event.target.value)}
            />

            <label className="serverless-label" htmlFor="playbook-signals">
              Signals (one per line)
            </label>
            <textarea
              id="playbook-signals"
              className="serverless-input serverless-input--multiline"
              value={signalsInput}
              onChange={(event) => setSignalsInput(event.target.value)}
              rows={4}
              placeholder={'Pipeline conversion: down: high: Enterprise win rate slipped'}
            />

            <label className="serverless-label" htmlFor="playbook-notes">
              Notes
            </label>
            <textarea
              id="playbook-notes"
              className="serverless-input serverless-input--multiline"
              value={notesInput}
              onChange={(event) => setNotesInput(event.target.value)}
              rows={3}
            />

            <button type="submit" className="serverless-button serverless-button--full">
              Build playbook
            </button>
          </form>
          {renderPlaybook}
        </div>
      </div>
    </section>
  );
};

export default ServerlessShowcase;
