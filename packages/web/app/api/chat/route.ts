import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  query: string;
  agentId: string;
  history?: HistoryMessage[];
}

interface Memory {
  text: string;
  score: number;
  tags: string[];
  createdAt: string;
  layer: string | null;
  memoryType: string | null;
  confidence: number | null;
}

/**
 * Resolve the LLM endpoint and model from settings, falling back to env vars / defaults.
 */
async function resolveLlmConfig(daemonUrl: string, agentId: string) {
  const defaults = {
    endpoint: process.env.OLLAMA_URL || process.env.LLM_ENDPOINT || "http://localhost:11434",
    model: process.env.LLM_MODEL || "llama3.2:3b",
    apiKey: process.env.LLM_API_KEY || undefined,
  };

  try {
    const res = await fetch(`${daemonUrl}/settings/${agentId}`);
    if (res.ok) {
      const data = await res.json();
      const settings = data.settings;
      if (settings?.llmProvider) {
        return {
          endpoint: settings.llmProvider.endpoint || defaults.endpoint,
          model: settings.llmProvider.model || defaults.model,
          apiKey: settings.llmProvider.apiKey || defaults.apiKey,
        };
      }
    }
  } catch {
    // Settings unavailable — use defaults
  }

  return defaults;
}

/**
 * AI-Powered Memory Chat
 *
 * Flow:
 * 1. Search memories semantically
 * 2. Build layer-aware context with classification metadata
 * 3. Send memories + question to LLM (Ollama-compatible)
 * 4. LLM synthesizes a conversational answer
 * 5. Return answer + source memories
 */
export async function POST(request: Request) {
  try {
    const { query, agentId, history = [] }: ChatRequest = await request.json();

    if (!query || !agentId) {
      return NextResponse.json({ error: "Missing query or agentId" }, { status: 400 });
    }

    // Step 1: Search memories
    const daemonUrl =
      process.env.DAEMON_URL ||
      process.env.NEXT_PUBLIC_DAEMON_URL ||
      (process.env.MEMORY_DAEMON_PORT
        ? `http://localhost:${process.env.MEMORY_DAEMON_PORT}`
        : "http://localhost:7654");
    const recallUrl = new URL("/recall", daemonUrl);
    recallUrl.searchParams.set("agentId", agentId);
    recallUrl.searchParams.set("query", query);
    recallUrl.searchParams.set("limit", "10");

    const recallResponse = await fetch(recallUrl.toString());

    if (!recallResponse.ok) {
      throw new Error(`Memory search failed: ${recallResponse.statusText}`);
    }

    const recallData = await recallResponse.json();

    // If no memories found, return early
    if (!recallData.success || recallData.count === 0) {
      return NextResponse.json({
        answer: `I couldn't find any memories related to "${query}". Try rephrasing your question or storing some memories first.`,
        memories: [],
        source: "fallback",
      });
    }

    const memories: Memory[] = recallData.results;

    // Step 2: Build layer-aware context for LLM
    const memoryContext = formatMemoryContext(memories);

    // Build conversation history block for context continuity
    const recentHistory = history.slice(-10);
    const historyBlock =
      recentHistory.length > 0
        ? `\nConversation so far:\n${recentHistory.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")}\n`
        : "";

    // Layer summary for the LLM
    const layerSummary = buildLayerSummary(memories);

    const fullPrompt = `You are an AI assistant helping the user recall and understand their stored memories. You are in an ongoing conversation — use the conversation history to maintain context and continuity.

The memory system organizes information into layers and types:
- LAYERS: "semantic" (verified, long-term knowledge), "archival" (historical reference), "episodic" (recent events/experiences), "working" (temporary/in-progress)
- TYPES: "fact" (objective info), "decision" (choices made), "preference" (likes/dislikes), "observation" (things noticed), "opinion" (subjective views), "episode" (event narratives)
- CONFIDENCE: percentage indicating reliability (higher = more reliable/reinforced)

${layerSummary}

Your job is to:
1. SYNTHESIZE the information from the memories below, weighing higher-confidence and semantic-layer memories more heavily
2. Answer the user's question in a natural, conversational way
3. DISTILL key insights rather than just listing memories
4. Connect related information across memories when relevant
5. When memories conflict, prefer higher-confidence ones and note the disagreement
6. Be concise but informative (2-3 paragraphs max)
7. Reference prior conversation context when relevant (e.g., "As I mentioned earlier..." or "Building on what we discussed...")

IMPORTANT: Do NOT just list or quote the memories. Understand them, synthesize them, and provide a thoughtful answer.
IMPORTANT: Use the conversation history to understand follow-up questions. If the user says "tell me more" or "what about X", refer back to the prior context.
IMPORTANT: If a memory has low confidence (< 40%), treat it as uncertain and qualify your statements accordingly.

If the memories don't fully answer the question, acknowledge what you DO know and what's missing.
${historyBlock}
Available memories:
${memoryContext}

User question: ${query}

Provide a concise, conversational answer:`;

    // Step 3: Resolve LLM config and call
    const llmConfig = await resolveLlmConfig(daemonUrl, agentId);
    return await tryLlmOrFallback(query, memories, fullPrompt, llmConfig);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        answer: "Sorry, I encountered an error while processing your question. Please try again.",
        memories: [],
        source: "error",
      },
      { status: 500 },
    );
  }
}

/**
 * Format memories with classification metadata for the LLM prompt
 */
function formatMemoryContext(memories: Memory[]): string {
  return memories
    .map((m, idx) => {
      const parts: string[] = [];

      // Header with index and classification
      const meta: string[] = [];
      meta.push(`relevance: ${Math.round(m.score * 100)}%`);
      if (m.layer) meta.push(`layer: ${m.layer}`);
      if (m.memoryType) meta.push(`type: ${m.memoryType}`);
      if (m.confidence != null) meta.push(`confidence: ${Math.round(m.confidence * 100)}%`);

      parts.push(`Memory ${idx + 1} (${meta.join(", ")}):`);
      parts.push(m.text);

      if (m.tags?.length) {
        parts.push(`Tags: ${m.tags.join(", ")}`);
      }

      return parts.join("\n");
    })
    .join("\n\n");
}

/**
 * Build a brief summary of the memory layer distribution
 */
function buildLayerSummary(memories: Memory[]): string {
  const layers: Record<string, number> = {};
  const types: Record<string, number> = {};
  let totalConfidence = 0;
  let confCount = 0;

  for (const m of memories) {
    if (m.layer) layers[m.layer] = (layers[m.layer] || 0) + 1;
    if (m.memoryType) types[m.memoryType] = (types[m.memoryType] || 0) + 1;
    if (m.confidence != null) {
      totalConfidence += m.confidence;
      confCount++;
    }
  }

  const parts: string[] = [];

  if (Object.keys(layers).length > 0) {
    const layerStr = Object.entries(layers)
      .sort(([, a], [, b]) => b - a)
      .map(([l, c]) => `${c} ${l}`)
      .join(", ");
    parts.push(`Memory layers retrieved: ${layerStr}`);
  }

  if (Object.keys(types).length > 0) {
    const typeStr = Object.entries(types)
      .sort(([, a], [, b]) => b - a)
      .map(([t, c]) => `${c} ${t}${c > 1 ? "s" : ""}`)
      .join(", ");
    parts.push(`Memory types: ${typeStr}`);
  }

  if (confCount > 0) {
    parts.push(`Average confidence: ${Math.round((totalConfidence / confCount) * 100)}%`);
  }

  return parts.length > 0 ? parts.join(". ") + "." : "";
}

/**
 * Try LLM (Ollama-compatible), gracefully fall back to simple summary if unavailable
 */
async function tryLlmOrFallback(
  query: string,
  memories: Memory[],
  prompt: string,
  llmConfig: { endpoint: string; model: string; apiKey?: string },
) {
  // Build Ollama-compatible endpoint URL
  const generateUrl = llmConfig.endpoint.endsWith("/api/generate")
    ? llmConfig.endpoint
    : `${llmConfig.endpoint.replace(/\/+$/, "")}/api/generate`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (llmConfig.apiKey) {
      headers["Authorization"] = `Bearer ${llmConfig.apiKey}`;
    }

    const ollamaResponse = await fetch(generateUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: llmConfig.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 512,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!ollamaResponse.ok) {
      console.warn(`LLM returned ${ollamaResponse.status}, using fallback`);
      return createFallbackResponse(query, memories);
    }

    const ollamaData = await ollamaResponse.json();
    const answer = ollamaData.response?.trim() || "Sorry, I couldn't generate a response.";

    return NextResponse.json({
      answer,
      memories: memories.slice(0, 5),
      source: "ollama-direct",
      model: llmConfig.model,
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn(`LLM unavailable (${error.message}), using fallback`);
    return createFallbackResponse(query, memories);
  }
}

/**
 * Fallback response when LLM is unavailable
 * Returns a formatted summary of memories with classification info
 */
function createFallbackResponse(query: string, memories: Memory[]) {
  const topMemories = memories.slice(0, 5);

  let answer = `I found ${memories.length} relevant ${memories.length === 1 ? "memory" : "memories"} about "${query}":\n\n`;

  topMemories.forEach((memory, idx) => {
    const meta: string[] = [];
    if (memory.layer) meta.push(memory.layer);
    if (memory.memoryType) meta.push(memory.memoryType);
    if (memory.confidence != null) meta.push(`${Math.round(memory.confidence * 100)}% confidence`);

    answer += `${idx + 1}. ${memory.text}\n`;
    if (meta.length > 0) {
      answer += `   [${meta.join(" · ")}]\n`;
    }
    if (memory.tags && memory.tags.length > 0) {
      answer += `   Tags: ${memory.tags.join(", ")}\n`;
    }
    answer += "\n";
  });

  if (memories.length > 5) {
    answer += `...and ${memories.length - 5} more.`;
  }

  return NextResponse.json({
    answer,
    memories: topMemories,
    source: "fallback",
  });
}
