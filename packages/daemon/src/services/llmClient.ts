/**
 * Shared LLM Client
 *
 * Unified interface for calling an LLM (Ollama-compatible endpoint).
 * All reflection stages and services use this instead of inline fetch calls.
 *
 * Features:
 * - Timeout + abort signal
 * - JSON response parsing with validation
 * - Graceful fallback support
 * - Structured error reporting
 */

import { ResolvedPipelineSettings } from "../types/settings.js";
import { DEFAULT_LLM_ENDPOINT, DEFAULT_LLM_MODEL } from "../types/settings.js";

export interface LlmCallConfig {
  endpoint: string;
  model: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export interface LlmCallResult {
  text: string;
  durationMs: number;
}

/**
 * Extract LlmCallConfig from resolved pipeline settings.
 */
export function getLlmConfig(settings?: ResolvedPipelineSettings): LlmCallConfig {
  if (!settings) {
    return {
      endpoint: DEFAULT_LLM_ENDPOINT,
      model: DEFAULT_LLM_MODEL,
      temperature: 0.3,
      maxTokens: 512,
      timeoutMs: 15000,
    };
  }
  return { ...settings.llmProvider };
}

/**
 * Call the LLM and return raw text response.
 */
export async function callLlm(prompt: string, config: LlmCallConfig): Promise<LlmCallResult> {
  const startTime = Date.now();

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
      },
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new LlmError(`LLM returned ${response.status}: ${response.statusText}`, config);
  }

  const data = (await response.json()) as { response?: string };
  const text = data.response?.trim();

  if (!text) {
    throw new LlmError("Empty LLM response", config);
  }

  return {
    text,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Call the LLM and parse the response as JSON.
 * Extracts JSON from the response text (handles markdown code fences).
 */
export async function callLlmJson<T>(
  prompt: string,
  config: LlmCallConfig,
): Promise<{ data: T; durationMs: number }> {
  const result = await callLlm(prompt, config);

  // Try to extract JSON from the response (handle ```json ... ``` wrapping)
  let jsonText = result.text;
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  }

  try {
    const data = JSON.parse(jsonText) as T;
    return { data, durationMs: result.durationMs };
  } catch {
    throw new LlmError(`Failed to parse LLM response as JSON: ${jsonText.slice(0, 200)}`, config);
  }
}

/**
 * Call the LLM with a fallback function if the LLM is unavailable or fails.
 */
export async function callLlmWithFallback<T>(
  prompt: string,
  config: LlmCallConfig,
  fallbackFn: () => T | Promise<T>,
  options?: { parseJson?: boolean },
): Promise<{ result: T; usedLlm: boolean; durationMs: number }> {
  try {
    if (options?.parseJson) {
      const { data, durationMs } = await callLlmJson<T>(prompt, config);
      return { result: data, usedLlm: true, durationMs };
    } else {
      const { text, durationMs } = await callLlm(prompt, config);
      return { result: text as unknown as T, usedLlm: true, durationMs };
    }
  } catch (error) {
    console.warn(
      `[LLM] Call failed, using fallback:`,
      error instanceof Error ? error.message : String(error),
    );
    const result = await fallbackFn();
    return { result, usedLlm: false, durationMs: 0 };
  }
}

/**
 * Structured LLM error.
 */
export class LlmError extends Error {
  constructor(
    message: string,
    public config: Pick<LlmCallConfig, "endpoint" | "model">,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
