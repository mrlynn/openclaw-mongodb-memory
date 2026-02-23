"use client";

import { Chip } from "@leafygreen-ui/chip";
import IconButton from "@leafygreen-ui/icon-button";
import Icon from "@leafygreen-ui/icon";
import Button from "@leafygreen-ui/button";
import { Drawer } from "@/components/ui/Drawer";
import { useThemeMode } from "@/contexts/ThemeContext";

interface MemoryItem {
  _id: string;
  text: string;
  agentId: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface MemoryDetailDrawerProps {
  open: boolean;
  memory: MemoryItem | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const sectionLabel: React.CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.68rem",
  fontWeight: 600,
  opacity: 0.45,
  marginBottom: 8,
};

export function MemoryDetailDrawer({
  open,
  memory,
  onClose,
  onDelete,
}: MemoryDetailDrawerProps) {
  const { darkMode } = useThemeMode();

  if (!memory) return null;

  return (
    <Drawer open={open} onClose={onClose}>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontWeight: 600, fontSize: "1.1rem", margin: 0 }}>
            Memory Detail
          </h3>
          <IconButton aria-label="Close" onClick={onClose} darkMode={darkMode}>
            <Icon glyph="X" />
          </IconButton>
        </div>

        <hr
          style={{
            border: "none",
            borderTop: darkMode
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(0,0,0,0.1)",
            marginBottom: 24,
          }}
        />

        {/* Content */}
        <div style={sectionLabel}>Content</div>
        <p
          style={{
            marginBottom: 24,
            whiteSpace: "pre-wrap",
            lineHeight: 1.7,
            fontSize: "0.875rem",
          }}
        >
          {memory.text}
        </p>

        {/* Tags */}
        {memory.tags.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={sectionLabel}>Tags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {memory.tags.map((tag, i) => (
                <Chip key={i} label={tag} variant="blue" />
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        {Object.keys(memory.metadata).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={sectionLabel}>Metadata</div>
            <pre
              style={{
                padding: 12,
                borderRadius: 8,
                background: darkMode
                  ? "rgba(0,0,0,0.3)"
                  : "rgba(0,0,0,0.05)",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                overflow: "auto",
              }}
            >
              {JSON.stringify(memory.metadata, null, 2)}
            </pre>
          </div>
        )}

        {/* Timestamps */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabel}>Timestamps</div>
          <p style={{ fontSize: "0.875rem", opacity: 0.7, margin: "4px 0" }}>
            Created: {new Date(memory.createdAt).toLocaleString()}
          </p>
          <p style={{ fontSize: "0.875rem", opacity: 0.7, margin: "4px 0" }}>
            Updated: {new Date(memory.updatedAt).toLocaleString()}
          </p>
        </div>

        {/* ID */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabel}>ID</div>
          <code
            style={{
              fontFamily: "monospace",
              fontSize: "0.75rem",
              opacity: 0.5,
            }}
          >
            {memory._id}
          </code>
        </div>

        <hr
          style={{
            border: "none",
            borderTop: darkMode
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(0,0,0,0.1)",
            marginBottom: 16,
          }}
        />

        <Button
          variant="danger"
          leftGlyph={<Icon glyph="Trash" />}
          onClick={() => onDelete(memory._id)}
          darkMode={darkMode}
          style={{ width: "100%" }}
        >
          Delete this memory
        </Button>
      </div>
    </Drawer>
  );
}
