"use client";

import { useState, useRef, useEffect } from "react";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { H2, Body } from "@leafygreen-ui/typography";
import TextInput from "@leafygreen-ui/text-input";
import Button from "@leafygreen-ui/button";
import Icon from "@leafygreen-ui/icon";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import { Spinner } from "@leafygreen-ui/loading-indicator";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  results?: Array<{
    text: string;
    score: number;
    tags: string[];
    createdAt: string;
  }>;
}

export default function ChatPage() {
  const { daemonUrl } = useDaemonConfig();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm your AI-powered memory assistant. I can search your memories and answer questions based on what you've stored. Just ask me anything!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState("openclaw");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Call AI-powered chat API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userMessage.content,
          agentId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Check for API error
      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date(),
        results: data.memories || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Make sure the memory daemon and OpenClaw Gateway are running.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <H2>💬 Memory Chat</H2>
        <Body>Ask questions about your memories in natural language</Body>
      </div>

      {/* Agent selector */}
      <div className={styles.agentSelector}>
        <TextInput
          label="Agent ID"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="openclaw"
        />
      </div>

      {/* Chat messages */}
      <div className={styles.chatContainer}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? styles.userMessage : styles.assistantMessage}
          >
            <div className={styles.messageHeader}>
              <Badge variant={message.role === "user" ? "blue" : "green"}>
                {message.role === "user" ? "You" : "Memory Assistant"}
              </Badge>
              <span className={styles.timestamp}>{formatTimestamp(message.timestamp)}</span>
            </div>
            <div className={styles.messageContent}>
              {message.content.split("\n").map((line, idx) => (
                <p key={idx}>{line || "\u00A0"}</p>
              ))}
            </div>
            {message.results && message.results.length > 0 && (
              <div className={styles.resultsGrid}>
                {message.results.slice(0, 3).map((result, idx) => (
                  <Card key={idx} className={styles.resultCard}>
                    <div className={styles.resultScore}>{(result.score * 100).toFixed(0)}%</div>
                    <div className={styles.resultText}>{result.text}</div>
                    {result.tags && result.tags.length > 0 && (
                      <div className={styles.resultTags}>
                        {result.tags.map((tag) => (
                          <Badge key={tag} variant="lightgray">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className={styles.loadingMessage}>
            <Spinner />
            <Body>Searching memories...</Body>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <TextInput
          label="Message"
          aria-label="Chat message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything... (e.g., 'What did we decide about Docker?')"
          disabled={loading}
          className={styles.input}
        />
        <Button type="submit" disabled={!input.trim() || loading}>
          <Icon glyph="ArrowRight" />
          Send
        </Button>
      </form>

      {/* Example queries */}
      <div className={styles.examples}>
        <Body className={styles.examplesTitle}>Try asking:</Body>
        <div className={styles.exampleButtons}>
          {[
            "What did we decide about MongoDB Atlas?",
            "Show me memories about Docker setup",
            "What work did we complete this week?",
            "Any blockers or issues mentioned?",
          ].map((example) => (
            <Button
              key={example}
              size="small"
              variant="default"
              onClick={() => setInput(example)}
              disabled={loading}
            >
              {example}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
