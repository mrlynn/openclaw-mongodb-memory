"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Select, Option } from "@leafygreen-ui/select";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import { Send, Search, Tag, Clock, Sparkles, BrainCircuit } from "lucide-react";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { STORAGE_KEYS } from "@/lib/constants";
import { SimilarityScoreBar } from "@/components/recall/SimilarityScoreBar";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface MemoryResult {
  id: string;
  text: string;
  score: number;
  tags: string[];
  createdAt: string;
  layer?: string | null;
  memoryType?: string | null;
  confidence?: number | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  results?: MemoryResult[];
  resultCount?: number;
  error?: boolean;
}

interface AgentInfo {
  agentId: string;
  count: number;
  lastUpdated: string | null;
}

const EXAMPLE_QUERIES = [
  "What did we decide about the database schema?",
  "Show me everything about authentication",
  "What bugs were fixed this week?",
  "Any notes about deployment?",
];

export default function ChatPage() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentId, setAgentId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch agents on mount
  useEffect(() => {
    const init = async () => {
      try {
        const response = await fetch(`${daemonUrl}/agents`);
        if (!response.ok) return;
        const data = await response.json();
        const agentsList: AgentInfo[] = data.agents || [];
        setAgents(agentsList);

        const stored =
          typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AGENT_ID) : null;
        const resolvedAgent =
          stored && agentsList.some((a: AgentInfo) => a.agentId === stored)
            ? stored
            : agentsList[0]?.agentId || "openclaw";

        setAgentId(resolvedAgent);
        localStorage.setItem(STORAGE_KEYS.AGENT_ID, resolvedAgent);
      } catch {
        setAgentId("openclaw");
      }
    };
    init();
  }, [daemonUrl]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = useCallback(
    async (query?: string) => {
      const text = (query || input).trim();
      if (!text || loading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      try {
        // Build conversation history from existing messages for context continuity
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Call AI chat API with conversation history
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text, agentId, history }),
        });

        if (!response.ok) {
          throw new Error(`Chat API failed (${response.status})`);
        }

        const data = await response.json();

        // AI-generated answer + source memories
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.answer || "No response generated",
          timestamp: new Date(),
          results: data.memories || [],
          resultCount: data.memories?.length || 0,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `${err instanceof Error ? err.message : "Unknown error"}. Is the daemon running?`,
          timestamp: new Date(),
          error: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [input, loading, agentId, messages],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAgentChange = (val: string) => {
    setAgentId(val);
    localStorage.setItem(STORAGE_KEYS.AGENT_ID, val);
  };

  const handleResultClick = (text: string) => {
    const q = text.length > 80 ? text.slice(0, 80) : text;
    router.push(`/recall?query=${encodeURIComponent(q)}`);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className={styles.page}>
      {/* Header bar */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <BrainCircuit size={20} className={styles.headerIcon} />
          <h2 className={styles.headerTitle}>Memory Chat</h2>
        </div>
        {agents.length > 1 && (
          <div className={styles.agentSelect}>
            <Select
              aria-label="Agent"
              value={agentId}
              onChange={handleAgentChange}
              size="xsmall"
              darkMode={darkMode}
            >
              {agents.map((a) => (
                <Option key={a.agentId} value={a.agentId}>
                  {a.agentId}
                </Option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className={styles.messagesArea}>
        {/* Empty / welcome state */}
        {isEmpty && !loading && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Sparkles size={40} />
            </div>
            <h3 className={styles.emptyTitle}>Search your memories</h3>
            <p className={styles.emptyDesc}>
              Ask questions in natural language and find semantically relevant memories.
            </p>
            <div className={styles.exampleChips}>
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  className={styles.exampleChip}
                  onClick={() => handleSubmit(q)}
                  disabled={loading}
                >
                  <Search size={13} />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message thread */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.messageBubble} ${
              msg.role === "user" ? styles.userBubble : styles.assistantBubble
            } ${msg.error ? styles.errorBubble : ""}`}
          >
            {/* Avatar */}
            <div
              className={`${styles.avatar} ${
                msg.role === "user" ? styles.userAvatar : styles.assistantAvatar
              }`}
            >
              {msg.role === "user" ? <Icon glyph="Person" size={16} /> : <BrainCircuit size={16} />}
            </div>

            {/* Content column */}
            <div className={styles.messageBody}>
              <div className={styles.messageMeta}>
                <span className={styles.messageRole}>
                  {msg.role === "user" ? "You" : "Memory Search"}
                </span>
                <span className={styles.messageTime}>{formatTime(msg.timestamp)}</span>
              </div>

              {/* Text content */}
              <div
                className={`${styles.messageText} ${
                  msg.role === "user" ? styles.userText : ""
                } ${msg.error ? styles.errorText : ""}`}
              >
                {msg.content}
              </div>

              {/* Result cards */}
              {msg.results && msg.results.length > 0 && (
                <div className={styles.results}>
                  {msg.results.map((result, idx) => (
                    <div
                      key={result.id || idx}
                      className={styles.resultCard}
                      onClick={() => handleResultClick(result.text)}
                    >
                      <div className={styles.resultHeader}>
                        <span className={styles.resultIndex}>#{idx + 1}</span>
                        <SimilarityScoreBar score={result.score} />
                      </div>
                      <div className={styles.resultBody}>{result.text}</div>
                      {/* Classification badges */}
                      {(result.layer || result.memoryType || result.confidence != null) && (
                        <div className={styles.resultClassification}>
                          {result.layer && (
                            <Badge
                              variant={
                                result.layer === "semantic"
                                  ? "green"
                                  : result.layer === "archival"
                                    ? "purple"
                                    : result.layer === "episodic"
                                      ? "blue"
                                      : "lightgray"
                              }
                              className={styles.tagBadge}
                            >
                              {result.layer}
                            </Badge>
                          )}
                          {result.memoryType && (
                            <Badge variant="yellow" className={styles.tagBadge}>
                              {result.memoryType}
                            </Badge>
                          )}
                          {result.confidence != null && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                opacity: 0.7,
                                color:
                                  result.confidence >= 0.7
                                    ? "#00a35c"
                                    : result.confidence >= 0.4
                                      ? "#b45309"
                                      : "#cf4747",
                              }}
                            >
                              {Math.round(result.confidence * 100)}%
                            </span>
                          )}
                        </div>
                      )}
                      <div className={styles.resultFooter}>
                        {result.tags && result.tags.length > 0 && (
                          <div className={styles.resultTags}>
                            <Tag size={11} />
                            {result.tags.slice(0, 4).map((tag) => (
                              <Badge key={tag} variant="lightgray" className={styles.tagBadge}>
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {result.createdAt && (
                          <span className={styles.resultDate}>
                            <Clock size={11} />
                            {formatDate(result.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {msg.resultCount && msg.resultCount > 5 && (
                    <div className={styles.moreResults}>
                      +{msg.resultCount - 5} more memories match this query
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
            <div className={`${styles.avatar} ${styles.assistantAvatar}`}>
              <BrainCircuit size={16} />
            </div>
            <div className={styles.messageBody}>
              <div className={styles.typingIndicator}>
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className={styles.inputBar}>
        {/* Suggestion chips after first few messages */}
        {!isEmpty && messages.length < 4 && (
          <div className={styles.inlineExamples}>
            {EXAMPLE_QUERIES.slice(0, 3).map((q) => (
              <button
                key={q}
                className={styles.inlineChip}
                onClick={() => handleSubmit(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            type="text"
            className={styles.chatInput}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your memories..."
            disabled={loading}
            autoComplete="off"
          />
          <button
            className={`${styles.sendButton} ${input.trim() && !loading ? styles.sendActive : ""}`}
            onClick={() => handleSubmit()}
            disabled={!input.trim() || loading}
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
