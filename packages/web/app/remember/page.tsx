"use client";

import { Box, Typography, Fade } from "@mui/material";
import { SaveAlt } from "@mui/icons-material";
import { RememberForm } from "@/components/remember/RememberForm";
import { keyframes } from "@emotion/react";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

export default function RememberPage() {
  return (
    <Fade in timeout={400}>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <SaveAlt sx={{ color: "primary.main", fontSize: 24, opacity: 0.8 }} />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 600,
              letterSpacing: "-0.02em",
              animation: `${fadeInUp} 0.4s ease-out`,
            }}
          >
            Remember
          </Typography>
        </Box>
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", mb: 3, maxWidth: 600 }}
        >
          Store a new memory. It will be embedded and indexed for semantic
          search.
        </Typography>
        <Box sx={{ maxWidth: 640 }}>
          <RememberForm />
        </Box>
      </Box>
    </Fade>
  );
}
