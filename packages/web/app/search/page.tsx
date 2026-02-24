"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import TextInput from "@leafygreen-ui/text-input";
import Button from "@leafygreen-ui/button";
import { Select, Option } from "@leafygreen-ui/select";
import Banner from "@leafygreen-ui/banner";
import Icon from "@leafygreen-ui/icon";
import { Search } from "lucide-react";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { recallMemory, forgetMemory } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { RecallResultCard } from "@/components/recall/RecallResultCard";
import styles from "./page.module.css";

interface RecallResult {
  id: string;
  text: string;
  score: number;
  tags: string[];
  createdAt: string;
}

function SearchContent() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();
  const searchParams = useSearchParams();
  const didAutoSearch = useRef(false);

  const [agentId, setAgentId] = useState("demo-agent");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.AGENT_ID);
    if (stored) setAgentId(stored);
  }, []);
  const [query, setQuery] = useState(() => searchParams.get("query") || "");
  const [limit, setLimit] = useState("10");
  const [results, setResults] = useState<RecallResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(
    async (searchQuery?: string) => {
      const q = searchQuery ?? query;
      if (!q.trim()) return;
      setSearching(true);
      setError(null);
      try {
        const data = await recallMemory(daemonUrl, agentId, q, {
          limit: parseInt(limit, 10),
        });
        setResults(data);
        setHasSearched(true);
      } catch (err) {
        setError(String(err));
      } finally {
        setSearching(false);
      }
    },
    [daemonUrl, agentId, query, limit],
  );

  // Auto-search when arriving with a ?query= parameter
  useEffect(() => {
    const paramQuery = searchParams.get("query");
    if (paramQuery && !didAutoSearch.current) {
      didAutoSearch.current = true;
      setQuery(paramQuery);
      handleSearch(paramQuery);
    }
  }, [searchParams, handleSearch]);

  const handleDelete = async (id: string) => {
    try {
      await forgetMemory(daemonUrl, id);
      setResults((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(`Delete failed: ${String(err)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Search size={24} className={styles.headerIcon} />
        <h2 className={styles.title}>Search</h2>
      </div>
      <p className={styles.description}>
        Search memories using semantic similarity. Results are ranked by how
        closely they match your query.
      </p>

      {/* Search Form */}
      <div className={styles.searchForm}>
        <div className={styles.formGrid}>
          <TextInput
            label="Agent ID"
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value);
              if (typeof window !== "undefined") {
                localStorage.setItem(STORAGE_KEYS.AGENT_ID, e.target.value);
              }
            }}
            darkMode={darkMode}
          />
          <TextInput
            label="Search query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What are you looking for?"
            darkMode={darkMode}
          />
          <Select
            label="Limit"
            value={limit}
            onChange={(val) => setLimit(val)}
            darkMode={darkMode}
          >
            <Option value="5">5</Option>
            <Option value="10">10</Option>
            <Option value="25">25</Option>
            <Option value="50">50</Option>
          </Select>
        </div>

        <Button
          variant="primary"
          onClick={() => handleSearch()}
          disabled={!query.trim() || searching}
          darkMode={darkMode}
          leftGlyph={<Icon glyph="MagnifyingGlass" />}
          className={styles.searchBtn}
        >
          {searching ? "Searching..." : "Search Memories"}
        </Button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <Banner variant="danger" darkMode={darkMode}>
            {error}
          </Banner>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div>
          <div className={styles.resultsLabel}>
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </div>

          {results.length === 0 ? (
            <p className={styles.noResults}>No memories matched your query.</p>
          ) : (
            <div className={styles.resultsList}>
              {results.map((result, i) => (
                <div
                  key={result.id}
                  className={styles.resultItem}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <RecallResultCard {...result} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
