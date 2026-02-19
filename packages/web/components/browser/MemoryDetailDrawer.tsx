"use client";

import {
  Drawer,
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  Divider,
} from "@mui/material";
import { Close, Delete } from "@mui/icons-material";

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

export function MemoryDetailDrawer({
  open,
  memory,
  onClose,
  onDelete,
}: MemoryDetailDrawerProps) {
  if (!memory) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        "& .MuiDrawer-paper": {
          width: { xs: "100%", sm: 480 },
        },
      }}
    >
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            Memory Detail
          </Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Text */}
        <Typography
          variant="subtitle2"
          sx={{
            color: "text.disabled",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontSize: "0.68rem",
            fontWeight: 500,
            mb: 1,
          }}
        >
          Content
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 3, whiteSpace: "pre-wrap", lineHeight: 1.7 }}
        >
          {memory.text}
        </Typography>

        {/* Tags */}
        {memory.tags.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{
                color: "text.disabled",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "0.7rem",
                fontWeight: 600,
                mb: 1,
              }}
            >
              Tags
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {memory.tags.map((tag, i) => (
                <Chip key={i} label={tag} size="small" variant="outlined" color="primary" />
              ))}
            </Box>
          </Box>
        )}

        {/* Metadata */}
        {Object.keys(memory.metadata).length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{
                color: "text.disabled",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "0.7rem",
                fontWeight: 600,
                mb: 1,
              }}
            >
              Metadata
            </Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: "rgba(0,0,0,0.1)",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(memory.metadata, null, 2)}
            </Box>
          </Box>
        )}

        {/* Timestamps */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: "text.disabled",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontSize: "0.7rem",
              fontWeight: 600,
              mb: 1,
            }}
          >
            Timestamps
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Created: {new Date(memory.createdAt).toLocaleString()}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Updated: {new Date(memory.updatedAt).toLocaleString()}
          </Typography>
        </Box>

        {/* ID */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: "text.disabled",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontSize: "0.7rem",
              fontWeight: 600,
              mb: 0.5,
            }}
          >
            ID
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontFamily: "monospace", color: "text.disabled" }}
          >
            {memory._id}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Button
          variant="outlined"
          color="error"
          startIcon={<Delete />}
          onClick={() => onDelete(memory._id)}
          fullWidth
        >
          Delete this memory
        </Button>
      </Box>
    </Drawer>
  );
}
