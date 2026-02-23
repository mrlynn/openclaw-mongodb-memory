"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Database, ArrowLeftRight, RefreshCw } from "lucide-react";
import { GlassCard } from "@/components/cards/GlassCard";
import { fetchSources, SourcesResponse } from "@/lib/api";
import styles from "./MemorySourcesPanel.module.css";

interface MemorySourcesPanelProps {
  daemonUrl: string;
  agentId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function OverlapBar({
  fileOnly,
  shared,
  mongoOnly,
}: {
  fileOnly: number;
  shared: number;
  mongoOnly: number;
}) {
  const total = fileOnly + shared + mongoOnly;
  if (total === 0) return null;

  const fileOnlyPct = (fileOnly / total) * 100;
  const sharedPct = (shared / total) * 100;
  const mongoOnlyPct = (mongoOnly / total) * 100;

  return (
    <div className={styles.overlapSection}>
      <div className={styles.overlapLabel}>
        <ArrowLeftRight size={14} />
        <span>Coverage Overlap</span>
      </div>
      <div className={styles.overlapBar}>
        {fileOnlyPct > 0 && (
          <div
            className={styles.overlapFileOnly}
            style={{ width: `${fileOnlyPct}%` }}
            title={`${fileOnly} file-only`}
          />
        )}
        {sharedPct > 0 && (
          <div
            className={styles.overlapShared}
            style={{ width: `${sharedPct}%` }}
            title={`${shared} shared`}
          />
        )}
        {mongoOnlyPct > 0 && (
          <div
            className={styles.overlapMongoOnly}
            style={{ width: `${mongoOnlyPct}%` }}
            title={`${mongoOnly} MongoDB-only`}
          />
        )}
      </div>
      <div className={styles.overlapLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDotFile} />
          File only ({fileOnly})
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDotShared} />
          Both ({shared})
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDotMongo} />
          MongoDB only ({mongoOnly})
        </span>
      </div>
    </div>
  );
}

function SourceCard({
  icon,
  title,
  available,
  stats,
}: {
  icon: React.ReactNode;
  title: string;
  available: boolean;
  stats: { label: string; value: string }[];
}) {
  return (
    <div className={`${styles.sourceCard} ${available ? "" : styles.sourceCardUnavailable}`}>
      <div className={styles.sourceHeader}>
        <div className={styles.sourceIcon}>{icon}</div>
        <div className={styles.sourceTitle}>{title}</div>
        <div
          className={`${styles.sourceBadge} ${available ? styles.badgeActive : styles.badgeInactive}`}
        >
          {available ? "Active" : "Not configured"}
        </div>
      </div>
      {available ? (
        <div className={styles.statsList}>
          {stats.map(({ label, value }) => (
            <div key={label} className={styles.statRow}>
              <span className={styles.statLabel}>{label}</span>
              <span className={styles.statValue}>{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.unavailableMsg}>
          {title === "Text File" ? (
            <>
              Set <code>MEMORY_FILE_PATH</code> in .env.local to enable
            </>
          ) : (
            <>MongoDB connection unavailable</>
          )}
        </div>
      )}
    </div>
  );
}

export function MemorySourcesPanel({ daemonUrl, agentId }: MemorySourcesPanelProps) {
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (agent: string) => {
      if (!agent) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchSources(daemonUrl, agent);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [daemonUrl],
  );

  useEffect(() => {
    if (agentId) load(agentId);
  }, [agentId, load]);

  // Tag diff — tags unique to one source
  const fileTagSet = new Set(data?.file.tags || []);
  const mongoTagSet = new Set(data?.mongo.uniqueTags || []);
  const fileOnlyTags = [...fileTagSet].filter((t) => !mongoTagSet.has(t));
  const mongoOnlyTags = [...mongoTagSet].filter((t) => !fileTagSet.has(t));
  const sharedTags = [...fileTagSet].filter((t) => mongoTagSet.has(t));

  return (
    <GlassCard>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <ArrowLeftRight size={16} style={{ opacity: 0.5 }} />
          <div className={styles.sectionLabel}>Memory Sources</div>
        </div>
        {!loading && data && (
          <button className={styles.refreshBtn} onClick={() => load(agentId)} title="Refresh">
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {loading && (
        <div className={styles.loadingWrap}>
          <div className="skeleton" style={{ width: "100%", height: 200, borderRadius: 8 }} />
        </div>
      )}

      {error && !loading && (
        <div className={styles.emptyState}>
          <div style={{ opacity: 0.5 }}>Could not load source comparison.</div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className={styles.sourcesGrid}>
            <SourceCard
              icon={<FileText size={20} />}
              title="Text File"
              available={data.file.available}
              stats={
                data.file.available
                  ? [
                      { label: "File", value: data.file.fileName || "—" },
                      { label: "Sections", value: String(data.file.sectionCount) },
                      { label: "Total size", value: formatBytes(data.file.fileSizeBytes || 0) },
                      { label: "Characters", value: data.file.totalChars.toLocaleString() },
                      {
                        label: "Last modified",
                        value: data.file.lastModified
                          ? formatRelativeTime(data.file.lastModified)
                          : "—",
                      },
                      { label: "Tags", value: String(data.file.tags.length) },
                    ]
                  : []
              }
            />

            <SourceCard
              icon={<Database size={20} />}
              title="MongoDB"
              available={data.mongo.available}
              stats={
                data.mongo.available
                  ? [
                      { label: "Documents", value: data.mongo.totalDocuments.toLocaleString() },
                      {
                        label: "With embeddings",
                        value: data.mongo.totalWithEmbeddings.toLocaleString(),
                      },
                      {
                        label: "Avg text length",
                        value: `${data.mongo.avgTextLength.toLocaleString()} chars`,
                      },
                      {
                        label: "Oldest memory",
                        value: data.mongo.oldestMemory
                          ? formatRelativeTime(data.mongo.oldestMemory)
                          : "—",
                      },
                      {
                        label: "Newest memory",
                        value: data.mongo.newestMemory
                          ? formatRelativeTime(data.mongo.newestMemory)
                          : "—",
                      },
                      { label: "Unique tags", value: String(data.mongo.uniqueTags.length) },
                    ]
                  : []
              }
            />
          </div>

          {/* Overlap visualization — only if both sources are available */}
          {data.file.available && data.mongo.available && (
            <OverlapBar
              fileOnly={data.overlap.fileOnlyCount}
              shared={data.overlap.sharedCount}
              mongoOnly={data.overlap.mongoOnlyCount}
            />
          )}

          {/* Tag comparison — only if both sources have tags */}
          {data.file.available &&
            data.mongo.available &&
            (fileOnlyTags.length > 0 || mongoOnlyTags.length > 0 || sharedTags.length > 0) && (
              <div className={styles.tagComparison}>
                <div className={styles.tagComparisonLabel}>Tag Coverage</div>
                <div className={styles.tagColumns}>
                  {fileOnlyTags.length > 0 && (
                    <div className={styles.tagColumn}>
                      <div className={styles.tagColumnHeader}>
                        <span className={styles.legendDotFile} />
                        File only
                      </div>
                      <div className={styles.tagList}>
                        {fileOnlyTags.map((t) => (
                          <span key={t} className={`${styles.tagChip} ${styles.tagChipFile}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {sharedTags.length > 0 && (
                    <div className={styles.tagColumn}>
                      <div className={styles.tagColumnHeader}>
                        <span className={styles.legendDotShared} />
                        Shared
                      </div>
                      <div className={styles.tagList}>
                        {sharedTags.map((t) => (
                          <span key={t} className={`${styles.tagChip} ${styles.tagChipShared}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {mongoOnlyTags.length > 0 && (
                    <div className={styles.tagColumn}>
                      <div className={styles.tagColumnHeader}>
                        <span className={styles.legendDotMongo} />
                        MongoDB only
                      </div>
                      <div className={styles.tagList}>
                        {mongoOnlyTags.map((t) => (
                          <span key={t} className={`${styles.tagChip} ${styles.tagChipMongo}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
        </>
      )}
    </GlassCard>
  );
}
