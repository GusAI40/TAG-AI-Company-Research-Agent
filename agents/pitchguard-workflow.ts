import { z } from "zod";
import { Agent, AgentInputItem, Runner } from "@openai/agents";

export const WebResearchAgentSchema = z.object({
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
  company_name: z.string(),
  industry: z.string(),
  headquarters_location: z.string(),
  company_size: z.string(),
  website: z.string(),
  description: z.string(),
  founded_year: z.number()
});

export const webResearchAgent = new Agent({
  name: "Web research agent",
  instructions:
    "You are a helpful assistant. Use web search to find information about the following company I can use in marketing asset based on the underlying topic.",
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
  instructions: `Put the research together in a nice display using the output format described.
`,
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

  const summarizeAndDisplayResultTemp = await runner.run(summarizeAndDisplay, [...conversationHistory]);

  if (!summarizeAndDisplayResultTemp.finalOutput) {
    throw new Error("Agent result is undefined");
  }

  const summarizeAndDisplayResult = {
    output_text: JSON.stringify(summarizeAndDisplayResultTemp.finalOutput),
    output_parsed: summarizeAndDisplayResultTemp.finalOutput
  };

  return {
    webResearchAgentResult,
    summarizeAndDisplayResult
  };
};
