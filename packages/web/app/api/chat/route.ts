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

    // Step 2: Build context for LLM
    const memoryContext = memories.map((m, idx) => `[Memory ${idx + 1}] ${m.text}`).join("\n\n");

    const systemPrompt = `You are a helpful memory assistant. Answer the user's question based ONLY on the provided memories. Be conversational and natural. If the memories don't contain enough information to answer fully, say so and mention what you do know.

Memories:
${memoryContext}`;

    // Step 3: Call OpenClaw Gateway via CLI
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      // Build the full prompt with context
      const fullPrompt = `${systemPrompt}\n\nUser question: ${query}\n\nProvide a concise, conversational answer based on the memories above.`;

      // Call openclaw agent command
      const { stdout, stderr } = await execAsync(
        `openclaw agent --local --message ${JSON.stringify(fullPrompt)} --json --timeout 30`,
        {
          timeout: 30000,
          maxBuffer: 1024 * 1024, // 1MB buffer
        },
      );

      if (stderr && !stderr.includes("Config warnings")) {
        console.warn("OpenClaw agent stderr:", stderr);
      }

      // Parse JSON response
      let result;
      try {
        result = JSON.parse(stdout);
      } catch (parseError) {
        // If not JSON, use stdout directly
        result = { content: stdout.trim() };
      }

      const answer = result.content || result.message || stdout.trim();

      return NextResponse.json({
        answer,
        memories: memories.slice(0, 3), // Include top 3 for reference
        source: "openclaw-cli",
      });
    } catch (llmError: any) {
      // OpenClaw CLI not available - graceful fallback
      console.warn("OpenClaw agent error:", llmError.message);
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
