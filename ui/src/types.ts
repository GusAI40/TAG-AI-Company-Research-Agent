export type GlassStyle = {
  base: string;
  card: string;
  input: string;
};

export type PerplexitySource = {
  title: string;
  url?: string;
  snippet: string;
  score?: number | null;
  published_at?: string | null;
};

export type PerplexityResult = {
  query: string;
  answer: string;
  results: PerplexitySource[];
  usage?: Record<string, unknown> | null;
};

export type DeepResearchResult = {
  summary: string;
  insights: string[];
  sources: PerplexitySource[];
  raw: string;
};

export type ReActStep = {
  thought: string;
  action: string;
  observation: string;
};

export type Metric = {
  label: string;
  value: string;
  source: string;
  period?: string;
  trend?: string;
  note?: string;
};

export type MetricSection = {
  title: string;
  metrics: Metric[];
};

export type AgentProfile = {
  company_name: string;
  ticker?: string;
  industry: string;
  headquarters_location: string;
  latest_filing: string;
  fiscal_period: string;
  summary_hook: string;
};

export type AgentQuickStat = {
  label: string;
  value: string;
  source: string;
  note?: string;
};

export type AgentTakeaway = {
  title: string;
  detail: string;
  source: string;
};

export type AgentDiligenceQuestion = {
  question: string;
  why_it_matters: string;
  source: string;
};

export type AgentWatchItem = {
  title: string;
  detail: string;
  source: string;
};

export type AgentSummary = {
  hero_headline: string;
  hero_subheadline: string;
  quick_stats: AgentQuickStat[];
  key_takeaways: AgentTakeaway[];
  scoreboard: MetricSection[];
  diligence_questions: AgentDiligenceQuestion[];
  next_actions: string[];
};

export type AgentWorkflowResult = {
  research_trace: ReActStep[];
  summary_trace: ReActStep[];
  profile: AgentProfile;
  metric_sections: MetricSection[];
  watch_items: AgentWatchItem[];
  diligence_questions: AgentDiligenceQuestion[];
  summary: AgentSummary;
  raw: {
    research: string;
    summary: string;
  };
};

export type ResearchResponse = {
  status: 'completed';
  perplexity: PerplexityResult;
  deep_research: DeepResearchResult | null;
  deep_research_error: string | null;
  agent: AgentWorkflowResult | null;
  agent_error: string | null;
};

export type HealthCheck = {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  latency_ms: number | null;
  status_code?: number;
  message?: string;
};

export type HealthSummary = {
  timestamp: string;
  results: HealthCheck[];
};

export type SecFiling = {
  form: string;
  filed: string;
  report?: string;
  accession_number: string;
  document_url: string;
};

export type SecSnapshot = {
  company: string;
  cik: string;
  filings: SecFiling[];
  error?: string;
};

export type BenchmarkInsight = {
  label: string;
  value: string;
  interpretation: string;
};

export type BenchmarkSummary = {
  scorecard: BenchmarkInsight[];
  risk_flags: string[];
  notes: string[];
  error?: string;
};
