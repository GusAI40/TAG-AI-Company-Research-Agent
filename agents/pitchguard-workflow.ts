import { z } from "../lib/zod.js";
import { Agent, AgentInputItem, Runner } from "../lib/openai-agents.js";

export const ReActStepSchema = z.object({
  thought: z.string(),
  action: z.string(),
  observation: z.string()
});

const MetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  source: z.string(),
  period: z.string().optional(),
  trend: z.string().optional(),
  note: z.string().optional()
});

const MetricSectionSchema = z.object({
  title: z.string(),
  metrics: z.array(MetricSchema).min(1)
});

const DiligenceQuestionSchema = z.object({
  question: z.string(),
  why_it_matters: z.string(),
  source: z.string()
});

const WatchItemSchema = z.object({
  title: z.string(),
  detail: z.string(),
  source: z.string()
});

export const WebResearchAgentSchema = z.object({
  reasoning_trace: z.array(ReActStepSchema),
  profile: z.object({
    company_name: z.string(),
    ticker: z.string().optional(),
    industry: z.string(),
    headquarters_location: z.string(),
    latest_filing: z.string(),
    fiscal_period: z.string(),
    summary_hook: z.string()
  }),
  metric_sections: z.array(MetricSectionSchema).min(3),
  diligence_questions: z.array(DiligenceQuestionSchema).min(3),
  watch_items: z.array(WatchItemSchema).min(2)
});

export const SummarizeAndDisplaySchema = z.object({
  reasoning_trace: z.array(ReActStepSchema),
  hero_headline: z.string(),
  hero_subheadline: z.string(),
  quick_stats: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        source: z.string(),
        note: z.string().optional()
      })
    )
    .min(3),
  key_takeaways: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        source: z.string()
      })
    )
    .min(3),
  scoreboard: z.array(MetricSectionSchema).min(3),
  diligence_questions: z.array(DiligenceQuestionSchema).min(3),
  next_actions: z.array(z.string()).min(1).max(3)
});

const reactInstructionSuffix = `Follow the ReAct pattern rigorously.
Respond with JSON only using the schema described. Do not wrap the JSON in markdown or code fences.
For each entry in "reasoning_trace" you must include:
- "thought": your internal reasoning step.
- "action": one of {"ReviewPerplexityEvidence","DeriveAttributes","ValidateDetails","ComposeNarrative"}.
- "observation": the result of that action, referencing evidence with source indices when available (e.g., #1, #2).
Begin by reviewing the Perplexity synthesis, plan your approach, then derive structured company attributes.
Every metric, quick stat, takeaway, watch item, and diligence question must include a "source" value that lists the supporting source indices (e.g., "#1, #3").
If a value cannot be verified from the provided evidence, return "Unknown" and state why in the relevant note.
Ensure the final structured fields are fully populated and consistent with observations.`;

export const webResearchAgent = new Agent({
  name: "Web research agent",
  instructions:
    [
      "You are the finance diligence analyst for PitchGuard. Mine the Perplexity synthesis and sources for the most recent SEC 10-K/10-Q figures and capital structure facts. Prioritise revenue, year-over-year growth, operating leverage, net income quality, cash versus debt, share issuance, and any footnote landmines.",
      "Populate metric_sections for Growth, Profitability, and Balance Sheet & Liquidity (optionally Valuation) with decisive numbers expressed in billions/millions/percent. Keep each section to four metrics or fewer and note the fiscal period when available.",
      "Keep summary_hook under 20 words and write watch_items + diligence_questions so that finance students can benchmark a live pitch immediately. When data is not confirmed, use 'Unknown (explain why)' rather than guessing.",
      reactInstructionSuffix,
    ].join(' '),
  model: "gpt-5-mini",
  outputType: WebResearchAgentSchema,
  modelSettings: {
    reasoning: {
      effort: "low"
    },
    store: true
  }
});

export const summarizeAndDisplay = new Agent({
  name: "Summarize and display",
  instructions:
    [
      "You are the Ole Miss Finance Club pitch captain. Convert the structured research into a crisp diligence briefing that fits on one slide.",
      "Lead with a headline that makes the member presenting the hero. Summaries must spotlight growth, profitability, and balance sheet posture with no fluff.",
      "Limit quick_stats to six items, keep each note under 18 words, and ensure all key_takeaways are finance-grade insights (e.g., guidance shifts, margin swing factors, liquidity runway).",
      "Reuse the research metrics so scoreboard sections stay factual and keep the section titles aligned with Growth, Profitability, Balance Sheet & Liquidity. Diligence questions should make it easy to challenge a stock pitch. Do not invent values—if the research did not confirm something, say 'Unknown'.",
      reactInstructionSuffix,
    ].join(' '),
  model: "gpt-5",
  outputType: SummarizeAndDisplaySchema,
  modelSettings: {
    reasoning: {
      effort: "minimal"
    },
    store: true
  }
});

export type WorkflowInput = { input_as_text: string };

export type ReActStep = z.infer<typeof ReActStepSchema>;

export type WorkflowOutput = {
  webResearchAgentResult: {
    output_text: string;
    output_parsed: z.infer<typeof WebResearchAgentSchema>;
  };
  summarizeAndDisplayResult: {
    output_text: string;
    output_parsed: z.infer<typeof SummarizeAndDisplaySchema>;
  };
};

// Main code entrypoint
export const runWorkflow = async (workflow: WorkflowInput): Promise<WorkflowOutput> => {
  const conversationHistory: AgentInputItem[] = [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: workflow.input_as_text
        }
      ]
    }
  ];

  const runner = new Runner({
    traceMetadata: {
      __trace_source__: "agent-builder",
      workflow_id: "wf_68e862c7d50c8190b090bb147d03d7cb05e22a10879c1d00"
    }
  });

  const webResearchAgentResultTemp = await runner.run(webResearchAgent, [...conversationHistory]);
  conversationHistory.push(...webResearchAgentResultTemp.newItems.map((item) => item.rawItem));

  if (!webResearchAgentResultTemp.finalOutput) {
    throw new Error("Agent result is undefined");
  }

  const webResearchAgentResult = {
    output_text: JSON.stringify(webResearchAgentResultTemp.finalOutput),
    output_parsed: webResearchAgentResultTemp.finalOutput
  };

  if (!webResearchAgentResult.output_parsed.reasoning_trace || webResearchAgentResult.output_parsed.reasoning_trace.length === 0) {
    throw new Error("Web research agent did not provide a ReAct reasoning trace.");
  }

  const summarizeAndDisplayResultTemp = await runner.run(summarizeAndDisplay, [...conversationHistory]);

  if (!summarizeAndDisplayResultTemp.finalOutput) {
    throw new Error("Agent result is undefined");
  }

  const summarizeAndDisplayResult = {
    output_text: JSON.stringify(summarizeAndDisplayResultTemp.finalOutput),
    output_parsed: summarizeAndDisplayResultTemp.finalOutput
  };

  if (!summarizeAndDisplayResult.output_parsed.reasoning_trace || summarizeAndDisplayResult.output_parsed.reasoning_trace.length === 0) {
    throw new Error("Summarize agent did not provide a ReAct reasoning trace.");
  }

  return {
    webResearchAgentResult,
    summarizeAndDisplayResult
  };
};
