/**
 * Stage 1: Extract
 *
 * Pulls candidate facts from session transcript.
 *
 * Two modes:
 *   - Heuristic (default): Simple pattern matching for known fact patterns.
 *   - LLM-enhanced: Sends transcript to an LLM with a structured extraction prompt.
 *
 * Mode is determined by `context.resolvedSettings.stages.extract.useLlm`.
 */

import { PipelineStage, PipelineContext, CandidateMemory } from "../types.js";
import { callLlmJson, getLlmConfig } from "../../services/llmClient.js";

/** Shape returned by the LLM extraction prompt. */
interface LlmExtractedAtom {
  text: string;
  memoryType: "fact" | "preference" | "decision" | "observation" | "opinion";
  tags: string[];
  confidence: number;
}

/**
 * Extract stage — pulls candidate memory atoms from session transcript
 */
export class ExtractStage implements PipelineStage {
  name = "extract";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { sessionTranscript } = context;

    if (!sessionTranscript || sessionTranscript.trim().length === 0) {
      console.log(`[Extract] No session transcript provided, skipping extraction`);
      context.extractedAtoms = [];
      context.stats.extract_processed = 0;
      return context;
    }

    const useLlm = context.resolvedSettings?.stages?.extract?.useLlm ?? false;

    if (useLlm) {
      try {
        const candidates = await this.extractCandidatesLlm(context, sessionTranscript);
        context.extractedAtoms = candidates;
        context.stats.extract_processed = 1;
        context.stats.extract_created = candidates.length;
        context.stats.extract_llm_used = 1;
        console.log(`[Extract] LLM extracted ${candidates.length} candidate memories`);
        return context;
      } catch (error) {
        console.warn(`[Extract] LLM extraction failed, falling back to heuristics:`, error);
        // Fall through to heuristic path
      }
    }

    const candidates = this.extractCandidatesHeuristic(sessionTranscript);

    context.extractedAtoms = candidates;
    context.stats.extract_processed = 1;
    context.stats.extract_created = candidates.length;
    context.stats.extract_llm_used = 0;

    console.log(`[Extract] Heuristic extracted ${candidates.length} candidate memories`);

    return context;
  }

  /**
   * LLM-enhanced extraction — sends the transcript to an LLM with a structured prompt.
   */
  private async extractCandidatesLlm(
    context: PipelineContext,
    transcript: string,
  ): Promise<CandidateMemory[]> {
    const config = getLlmConfig(context.resolvedSettings);

    // Truncate very long transcripts to stay within LLM context
    const maxLen = 8000;
    const truncated =
      transcript.length > maxLen
        ? transcript.slice(0, maxLen) + "\n[...transcript truncated...]"
        : transcript;

    const prompt = `You are a memory extraction system. Analyze the following session transcript and extract discrete facts, preferences, decisions, observations, and opinions that are worth remembering long-term.

For each extracted memory, provide:
- text: A clear, self-contained statement (rewrite if needed for clarity)
- memoryType: One of "fact", "preference", "decision", "observation", "opinion"
- tags: 1-4 short descriptive tags
- confidence: 0.0-1.0 (how confident the statement is clearly stated)

Return ONLY a JSON array. No explanation, no markdown.

Example output:
[{"text": "User prefers TypeScript over JavaScript", "memoryType": "preference", "tags": ["typescript", "preference", "language"], "confidence": 0.85}]

Session transcript:
${truncated}

Extract up to 20 memories. Return [] if nothing worth remembering.`;

    const { data } = await callLlmJson<LlmExtractedAtom[]>(prompt, config);

    // Validate and normalize
    if (!Array.isArray(data)) {
      throw new Error("LLM did not return an array");
    }

    return data
      .filter((a) => a.text && typeof a.text === "string" && a.text.length > 5)
      .slice(0, 20)
      .map((a) => ({
        text: a.text,
        tags: [...(Array.isArray(a.tags) ? a.tags : []), "llm-extracted"],
        memoryType: a.memoryType || "fact",
        confidence: typeof a.confidence === "number" ? Math.max(0, Math.min(1, a.confidence)) : 0.7,
        sourceText: a.text,
      }));
  }

  /**
   * Heuristic-based extraction (simple pattern matching)
   *
   * Looks for common fact patterns:
   * - "I prefer X"
   * - "My favorite is X"
   * - "I decided to X"
   * - "Key insight: X"
   * - "Remember that X"
   */
  private extractCandidatesHeuristic(transcript: string): CandidateMemory[] {
    const candidates: CandidateMemory[] = [];

    // Split into sentences
    const sentences = transcript
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();

      // Pattern 1: Preferences
      if (
        lower.includes("i prefer") ||
        lower.includes("my favorite") ||
        lower.includes("i like") ||
        lower.includes("i love")
      ) {
        candidates.push({
          text: sentence,
          tags: ["preference", "auto-extracted"],
          memoryType: "preference",
          confidence: 0.75,
          sourceText: sentence,
        });
      }

      // Pattern 2: Decisions
      else if (
        lower.includes("i decided") ||
        lower.includes("we decided") ||
        lower.includes("let's go with") ||
        lower.includes("we'll use")
      ) {
        candidates.push({
          text: sentence,
          tags: ["decision", "auto-extracted"],
          memoryType: "decision",
          confidence: 0.85,
          sourceText: sentence,
        });
      }

      // Pattern 3: Explicit remember requests
      else if (
        lower.includes("remember that") ||
        lower.includes("note that") ||
        lower.includes("important:") ||
        lower.includes("key insight:")
      ) {
        candidates.push({
          text: sentence,
          tags: ["noted", "auto-extracted"],
          memoryType: "fact",
          confidence: 0.8,
          sourceText: sentence,
        });
      }

      // Pattern 4: Facts about entities (simple heuristic)
      else if (lower.match(/\b(is|are|was|were)\b.*\b(a|an|the)\b/)) {
        candidates.push({
          text: sentence,
          tags: ["fact", "auto-extracted"],
          memoryType: "fact",
          confidence: 0.6,
          sourceText: sentence,
        });
      }
    }

    // Limit to top 20 candidates to avoid overwhelming storage
    return candidates.slice(0, 20);
  }
}
