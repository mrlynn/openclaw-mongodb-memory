"use client";

import { Box, Typography, Fade } from "@mui/material";
import { HealthDashboard } from "@/components/health/HealthDashboard";
import { keyframes } from "@emotion/react";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

export default function HealthPage() {
  return (
    <Fade in timeout={400}>
      <Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            letterSpacing: "-0.02em",
            mb: 1,
            animation: `${fadeInUp} 0.4s ease-out`,
          }}
        >
          System Health & Integration
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", mb: 3 }}
        >
          Real-time monitoring of memory daemon health and OpenClaw integration status
        </Typography>

        <HealthDashboard />
      </Box>
    </Fade>
  );
}
