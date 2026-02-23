import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ChatRequest {
  query: string;
  agentId: string;
}

interface Memory {
  text: string;
  score: number;
  tags: string[];
  createdAt: string;
}

/**
 * AI-Powered Memory Chat
 *
 * Flow:
 * 1. Search memories semantically
 * 2. Send memories + question to Ollama (local LLM)
 * 3. LLM synthesizes and generates conversational answer
 * 4. Return answer + source memories
 */
export async function POST(request: Request) {
  try {
    const { query, agentId }: ChatRequest = await request.json();

    if (!query || !agentId) {
      return NextResponse.json({ error: "Missing query or agentId" }, { status: 400 });
    }

    // Step 1: Search memories
    const daemonUrl = process.env.DAEMON_URL || "http://localhost:7751";
    const recallUrl = new URL("/recall", daemonUrl);
    recallUrl.searchParams.set("agentId", agentId);
    recallUrl.searchParams.set("query", query);
    recallUrl.searchParams.set("limit", "5");

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

    // Step 2: Build context for LLM with emphasis on synthesis
    const memoryContext = memories
      .map(
        (m, idx) =>
          `Memory ${idx + 1} (relevance: ${Math.round(m.score * 100)}%):\n${m.text}${m.tags?.length ? `\nTags: ${m.tags.join(", ")}` : ""}`,
      )
      .join("\n\n");

    const fullPrompt = `You are an AI assistant helping the user recall and understand their stored memories.

Your job is to:
1. SYNTHESIZE the information from the memories below
2. Answer the user's question in a natural, conversational way
3. DISTILL key insights rather than just listing memories
4. Connect related information across memories when relevant
5. Be concise but informative (2-3 paragraphs max)

IMPORTANT: Do NOT just list or quote the memories. Understand them, synthesize them, and provide a thoughtful answer.

If the memories don't fully answer the question, acknowledge what you DO know and what's missing.

Available memories:
${memoryContext}

User question: ${query}

Provide a concise, conversational answer:`;

    // Step 3: Call Ollama API directly
    try {
      const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

      const ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2:3b",
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 512, // Limit response length
          },
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (!ollamaResponse.ok) {
        throw new Error(`Ollama API failed: ${ollamaResponse.status} ${ollamaResponse.statusText}`);
      }

      const ollamaData = await ollamaResponse.json();
      const answer = ollamaData.response?.trim() || "Sorry, I couldn't generate a response.";

      return NextResponse.json({
        answer,
        memories: memories.slice(0, 3), // Include top 3 for reference
        source: "ollama-direct",
        model: "llama3.2:3b",
      });
    } catch (llmError: any) {
      // Ollama not available - graceful fallback
      console.warn("Ollama API error:", llmError.message);
      return createFallbackResponse(query, memories);
    }
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
 * Fallback response when LLM is unavailable
 * Returns a simple formatted summary of memories
 */
function createFallbackResponse(query: string, memories: Memory[]) {
  const topMemories = memories.slice(0, 3);

  let answer = `I found ${memories.length} relevant ${memories.length === 1 ? "memory" : "memories"} about "${query}":\n\n`;

  topMemories.forEach((memory, idx) => {
    answer += `${idx + 1}. ${memory.text}\n`;
    if (memory.tags && memory.tags.length > 0) {
      answer += `   (Tags: ${memory.tags.join(", ")})\n`;
    }
    answer += "\n";
  });

  if (memories.length > 3) {
    answer += `...and ${memories.length - 3} more.`;
  }

  return NextResponse.json({
    answer,
    memories: topMemories,
    source: "fallback",
  });
}
