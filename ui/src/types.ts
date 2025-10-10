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

export type AgentCompanyProfile = {
  company_name: string;
  industry: string;
  headquarters_location: string;
  company_size: string;
  website: string;
  description: string;
  founded_year: number;
};

export type AgentWorkflowResult = {
  companies: AgentCompanyProfile[];
  summary: AgentCompanyProfile;
  raw: {
    research: string;
    summary: string;
  };
};

export type ResearchResponse = {
  status: 'completed';
  perplexity: PerplexityResult;
  agent: AgentWorkflowResult | null;
};
