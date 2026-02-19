"use client";

import { Box, Typography, Fade } from "@mui/material";
import { Settings } from "@mui/icons-material";
import { DaemonUrlConfig } from "@/components/settings/DaemonUrlConfig";
import { DangerZone } from "@/components/settings/DangerZone";
import { keyframes } from "@emotion/react";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

export default function SettingsPage() {
  return (
    <Fade in timeout={400}>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Settings sx={{ color: "primary.main", fontSize: 28 }} />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              animation: `${fadeInUp} 0.5s ease-out`,
            }}
          >
            Settings
          </Typography>
        </Box>
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", mb: 4, maxWidth: 600 }}
        >
          Configure the daemon connection and manage system settings.
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 720 }}>
          <Box sx={{ animation: `${fadeInUp} 0.5s ease-out 0.1s both` }}>
            <DaemonUrlConfig />
          </Box>

          <Box sx={{ animation: `${fadeInUp} 0.5s ease-out 0.2s both` }}>
            <DangerZone />
          </Box>
        </Box>
      </Box>
    </Fade>
  );
}
