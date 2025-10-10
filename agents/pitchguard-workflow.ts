import { z } from "zod";
import { Agent, AgentInputItem, Runner } from "@openai/agents";

export const ReActStepSchema = z.object({
  thought: z.string(),
  action: z.string(),
  observation: z.string()
});

export const WebResearchAgentSchema = z.object({
  reasoning_trace: z.array(ReActStepSchema),
  companies: z.array(
    z.object({
      company_name: z.string(),
      industry: z.string(),
      headquarters_location: z.string(),
      company_size: z.string(),
      website: z.string(),
      description: z.string(),
      founded_year: z.number()
    })
  )
});

export const SummarizeAndDisplaySchema = z.object({
  reasoning_trace: z.array(ReActStepSchema),
  company_name: z.string(),
  industry: z.string(),
  headquarters_location: z.string(),
  company_size: z.string(),
  website: z.string(),
  description: z.string(),
  founded_year: z.number()
});

const reactInstructionSuffix = `Follow the ReAct pattern rigorously.
Respond with JSON only using the schema described.
For each entry in "reasoning_trace" you must include:
- "thought": your internal reasoning step.
- "action": one of {"ReviewPerplexityEvidence","DeriveAttributes","ValidateDetails","ComposeNarrative"}.
- "observation": the result of that action, referencing evidence with source indices when available (e.g., #1, #2).
Begin by reviewing the Perplexity synthesis, plan your approach, then derive structured company attributes.
Ensure the final structured fields are fully populated and consistent with observations.`;

export const webResearchAgent = new Agent({
  name: "Web research agent",
  instructions:
    "You are a specialised market researcher for PitchGuard. Analyse the Perplexity synthesis and sources to extract factual com"
    + "pany attributes that can power marketing collateral for finance students. "
    + reactInstructionSuffix,
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
    "You are the creative director for the Ole Miss Finance Club marketing studio. Compose a concise but vivid profile using the"
    + " structured evidence provided so far. Build on prior reasoning rather than repeating research queries. "
    + reactInstructionSuffix
    + "\nCraft the description for a student audience, emphasising differentiation and opportunities.",
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
