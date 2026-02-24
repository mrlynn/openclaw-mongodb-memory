/**
 * LLM-Enhanced Contradiction Explainer
 *
 * Uses an LLM to generate human-readable explanations of why two memories contradict.
 * Called after heuristic contradiction detection to enrich the explanation.
 *
 * Now uses the shared llmClient instead of inline fetch.
 */

import { Db } from "mongodb";
import { COLLECTION_MEMORIES } from "../constants.js";
import { Memory } from "../types/index.js";
import { callLlm, LlmCallConfig } from "./llmClient.js";
import { DEFAULT_LLM_ENDPOINT, DEFAULT_LLM_MODEL } from "../types/settings.js";

interface LLMExplanationResponse {
  explanation: string;
  severity: "high" | "medium" | "low";
  resolutionSuggestion?: string;
}

/**
 * Generate LLM-based explanation for a contradiction
 */
export async function explainContradiction(
  memoryA: Memory,
  memoryB: Memory,
  contradictionType: string,
  llmConfig?: Partial<LlmCallConfig>,
): Promise<LLMExplanationResponse> {
  const config: LlmCallConfig = {
    endpoint: llmConfig?.endpoint || process.env.LLM_ENDPOINT || DEFAULT_LLM_ENDPOINT,
    model: llmConfig?.model || process.env.LLM_MODEL || DEFAULT_LLM_MODEL,
    apiKey: llmConfig?.apiKey,
    temperature: llmConfig?.temperature ?? 0.3,
    maxTokens: llmConfig?.maxTokens ?? 200,
    timeoutMs: llmConfig?.timeoutMs ?? 15000,
  };

  const prompt = buildExplanationPrompt(memoryA, memoryB, contradictionType);

  try {
    const { text } = await callLlm(prompt, config);
    return parseExplanation(text);
  } catch (error) {
    console.warn("[ContradictionExplainer] LLM call failed, using fallback:", error);
    return generateFallbackExplanation(memoryA, memoryB, contradictionType);
  }
}

function buildExplanationPrompt(
  memoryA: Memory,
  memoryB: Memory,
  contradictionType: string,
): string {
  return `Analyze why these two memories contradict each other and explain the conflict clearly.

Memory A (${formatDate(memoryA.createdAt)}):
"${memoryA.text}"
Type: ${memoryA.memoryType || "unknown"}
Tags: ${memoryA.tags.join(", ")}

Memory B (${formatDate(memoryB.createdAt)}):
"${memoryB.text}"
Type: ${memoryB.memoryType || "unknown"}
Tags: ${memoryB.tags.join(", ")}

Detected contradiction type: ${contradictionType}

Provide:
1. A clear explanation of the contradiction in 1-2 sentences
2. Severity level (high/medium/low)
3. A suggestion for how to resolve this conflict

Format your response as:
EXPLANATION: [your explanation]
SEVERITY: [high/medium/low]
RESOLUTION: [suggestion]`;
}

function parseExplanation(response: string): LLMExplanationResponse {
  const explanationMatch = response.match(/EXPLANATION:\s*(.+?)(?=\nSEVERITY:|\n|$)/is);
  const severityMatch = response.match(/SEVERITY:\s*(high|medium|low)/i);
  const resolutionMatch = response.match(/RESOLUTION:\s*(.+?)$/is);

  const explanation = explanationMatch?.[1]?.trim() || response.trim();
  const severityRaw = severityMatch?.[1]?.toLowerCase();
  const severity =
    severityRaw === "high" || severityRaw === "medium" || severityRaw === "low"
      ? severityRaw
      : "medium";
  const resolutionSuggestion = resolutionMatch?.[1]?.trim();

  return { explanation, severity, resolutionSuggestion };
}

function generateFallbackExplanation(
  memoryA: Memory,
  memoryB: Memory,
  contradictionType: string,
): LLMExplanationResponse {
  const typeExplanations: Record<string, string> = {
    direct: "These memories make directly opposing claims about the same topic.",
    "context-dependent": "These memories may contradict depending on the context or situation.",
    temporal:
      "These memories reflect different states at different times, creating a temporal conflict.",
    preference: "These memories express conflicting preferences or opinions.",
  };

  const baseExplanation =
    typeExplanations[contradictionType] || "These memories appear to conflict.";

  return {
    explanation: `${baseExplanation} Memory A: "${memoryA.text.slice(0, 50)}..." vs Memory B: "${memoryB.text.slice(0, 50)}..."`,
    severity: "medium",
    resolutionSuggestion:
      "Review both memories and decide which reflects the current truth, or mark one as historical context.",
  };
}

/**
 * Enhance existing contradictions with LLM explanations
 */
export async function enhanceContradictionExplanations(
  db: Db,
  agentId: string,
  limit = 10,
  llmConfig?: Partial<LlmCallConfig>,
): Promise<number> {
  const collection = db.collection<Memory>(COLLECTION_MEMORIES);

  const memoriesWithContradictions = await collection
    .find({
      agentId,
      contradictions: { $exists: true, $ne: [] },
    })
    .limit(limit)
    .toArray();

  let enhanced = 0;

  for (const memory of memoriesWithContradictions) {
    if (!memory.contradictions || memory.contradictions.length === 0) continue;

    const updatedContradictions = [];

    for (const contradiction of memory.contradictions) {
      if (contradiction.explanation && contradiction.explanation.length > 100) {
        updatedContradictions.push(contradiction);
        continue;
      }

      const otherMemory = await collection.findOne({ _id: contradiction.memoryId as any });
      if (!otherMemory) {
        updatedContradictions.push(contradiction);
        continue;
      }

      const llmResult = await explainContradiction(
        memory,
        otherMemory,
        contradiction.type || "direct",
        llmConfig,
      );

      updatedContradictions.push({
        ...contradiction,
        explanation: llmResult.explanation,
        severity: llmResult.severity,
        resolutionSuggestion: llmResult.resolutionSuggestion,
      });

      enhanced++;
    }

    await collection.updateOne(
      { _id: memory._id },
      { $set: { contradictions: updatedContradictions } },
    );
  }

  return enhanced;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}
