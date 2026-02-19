import { createTheme, Theme } from "@mui/material/styles";

export function getTheme(mode: "dark" | "light"): Theme {
  return createTheme({
    palette: {
      mode,
      ...(mode === "dark"
        ? {
            primary: { main: "#00e5ff" },
            secondary: { main: "#d500f9" },
            background: {
              default: "#0a0e1a",
              paper: "rgba(15, 20, 40, 0.8)",
            },
            text: {
              primary: "rgba(255, 255, 255, 0.87)",
              secondary: "rgba(255, 255, 255, 0.6)",
              disabled: "rgba(255, 255, 255, 0.38)",
            },
            divider: "rgba(0, 229, 255, 0.12)",
            success: { main: "#00ff88" },
            error: { main: "#ff4466" },
            warning: { main: "#ffab00" },
          }
        : {
            primary: { main: "#0097a7" },
            secondary: { main: "#9c27b0" },
            background: {
              default: "#f5f7fa",
              paper: "#ffffff",
            },
          }),
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h3: {
        fontWeight: 700,
        letterSpacing: "-0.02em",
      },
      h4: {
        fontWeight: 700,
        letterSpacing: "-0.01em",
      },
      h5: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 600,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: "thin",
            scrollbarColor:
              mode === "dark"
                ? "rgba(0,229,255,0.3) transparent"
                : undefined,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root:
            mode === "dark"
              ? {
                  backdropFilter: "blur(20px)",
                  background: "rgba(15, 20, 40, 0.7)",
                  border: "1px solid rgba(0, 229, 255, 0.08)",
                  borderRadius: 16,
                  transition:
                    "border-color 0.3s ease, box-shadow 0.3s ease",
                  "&:hover": {
                    borderColor: "rgba(0, 229, 255, 0.2)",
                    boxShadow: "0 8px 32px rgba(0, 229, 255, 0.08)",
                  },
                }
              : {
                  borderRadius: 16,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                },
        },
      },
      MuiButton: {
        styleOverrides: {
          containedPrimary:
            mode === "dark"
              ? {
                  background:
                    "linear-gradient(135deg, #00e5ff 0%, #d500f9 100%)",
                  color: "#0a0e1a",
                  fontWeight: 700,
                  textTransform: "none" as const,
                  boxShadow: "0 4px 20px rgba(0, 229, 255, 0.25)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #18ffff 0%, #e040fb 100%)",
                    boxShadow: "0 6px 28px rgba(0, 229, 255, 0.4)",
                  },
                }
              : {
                  textTransform: "none" as const,
                  fontWeight: 600,
                },
          outlined:
            mode === "dark"
              ? {
                  borderColor: "rgba(0, 229, 255, 0.3)",
                  color: "#00e5ff",
                  textTransform: "none" as const,
                  "&:hover": {
                    borderColor: "#00e5ff",
                    background: "rgba(0, 229, 255, 0.08)",
                  },
                }
              : {
                  textTransform: "none" as const,
                },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root:
            mode === "dark"
              ? {
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": {
                      borderColor: "rgba(255, 255, 255, 0.15)",
                    },
                    "&:hover fieldset": {
                      borderColor: "rgba(0, 229, 255, 0.4)",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#00e5ff",
                    },
                  },
                }
              : {},
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper:
            mode === "dark"
              ? {
                  background: "rgba(8, 12, 24, 0.95)",
                  backdropFilter: "blur(20px)",
                  borderRight: "1px solid rgba(0, 229, 255, 0.08)",
                }
              : {},
        },
      },
      MuiChip: {
        styleOverrides: {
          root:
            mode === "dark"
              ? {
                  borderColor: "rgba(0, 229, 255, 0.3)",
                }
              : {},
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root:
            mode === "dark"
              ? {
                  borderColor: "rgba(255, 255, 255, 0.06)",
                }
              : {},
        },
      },
    },
  });
}
