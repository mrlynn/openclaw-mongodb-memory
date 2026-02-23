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
 * 2. Send memories + question to OpenClaw Gateway
 * 3. LLM generates conversational answer based on memories
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

    const systemPrompt = `You are an AI assistant helping the user recall and understand their stored memories.

Your job is to:
1. SYNTHESIZE the information from the memories below
2. Answer the user's question in a natural, conversational way
3. DISTILL key insights rather than just listing memories
4. Connect related information across memories when relevant
5. Be concise but informative

IMPORTANT: Do NOT just list or quote the memories. Understand them, synthesize them, and provide a thoughtful answer.

If the memories don't fully answer the question, acknowledge what you DO know and what's missing.

Available memories:
${memoryContext}`;

    // Step 3: Call OpenClaw Gateway via HTTP RPC
    try {
      const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
      const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

      const rpcPayload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "ai.complete",
        params: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
          ],
          model: "haiku", // Fast + cheap for chat
          temperature: 0.7,
        },
      };

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (gatewayToken) {
        headers["Authorization"] = `Bearer ${gatewayToken}`;
      }

      const rpcResponse = await fetch(`${gatewayUrl}/rpc`, {
        method: "POST",
        headers,
        body: JSON.stringify(rpcPayload),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (!rpcResponse.ok) {
        throw new Error(`Gateway RPC failed: ${rpcResponse.status} ${rpcResponse.statusText}`);
      }

      const rpcData = await rpcResponse.json();

      if (rpcData.error) {
        throw new Error(
          `Gateway RPC error: ${rpcData.error.message || JSON.stringify(rpcData.error)}`,
        );
      }

      const answer = rpcData.result?.content || rpcData.result?.message || "No response generated";

      return NextResponse.json({
        answer,
        memories: memories.slice(0, 3), // Include top 3 for reference
        source: "openclaw-gateway",
        model: "haiku",
      });
    } catch (llmError: any) {
      // Gateway not available - graceful fallback
      console.warn("OpenClaw Gateway error:", llmError.message);
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
 * Fallback response when OpenClaw Gateway is unavailable
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
