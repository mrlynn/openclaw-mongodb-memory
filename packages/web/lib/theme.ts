import { createTheme, Theme } from "@mui/material/styles";

export function getTheme(mode: "dark" | "light"): Theme {
  return createTheme({
    palette: {
      mode,
      ...(mode === "dark"
        ? {
            primary: { main: "#8b9cf7" },
            secondary: { main: "#c4a7e7" },
            background: {
              default: "#0f1117",
              paper: "rgba(22, 24, 35, 0.85)",
            },
            text: {
              primary: "rgba(230, 233, 240, 0.92)",
              secondary: "rgba(180, 188, 208, 0.7)",
              disabled: "rgba(140, 150, 175, 0.45)",
            },
            divider: "rgba(139, 156, 247, 0.08)",
            success: { main: "#7ec8a4" },
            error: { main: "#e87878" },
            warning: { main: "#d4a76a" },
          }
        : {
            primary: { main: "#5b6abf" },
            secondary: { main: "#8b6caf" },
            background: {
              default: "#f8f9fc",
              paper: "#ffffff",
            },
            text: {
              primary: "rgba(30, 33, 45, 0.9)",
              secondary: "rgba(80, 88, 112, 0.75)",
              disabled: "rgba(120, 128, 150, 0.5)",
            },
            divider: "rgba(91, 106, 191, 0.1)",
            success: { main: "#5a9e7c" },
            error: { main: "#c45858" },
            warning: { main: "#b88a4a" },
          }),
    },
    shape: {
      borderRadius: 14,
    },
    typography: {
      fontFamily:
        '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h3: {
        fontWeight: 600,
        letterSpacing: "-0.03em",
      },
      h4: {
        fontWeight: 600,
        letterSpacing: "-0.02em",
      },
      h5: {
        fontWeight: 500,
      },
      h6: {
        fontWeight: 500,
      },
      body1: {
        letterSpacing: "-0.01em",
        lineHeight: 1.6,
      },
      body2: {
        letterSpacing: "-0.005em",
        lineHeight: 1.55,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: "thin",
            scrollbarColor:
              mode === "dark"
                ? "rgba(139,156,247,0.15) transparent"
                : undefined,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root:
            mode === "dark"
              ? {
                  backdropFilter: "blur(24px) saturate(1.2)",
                  background:
                    "linear-gradient(135deg, rgba(22, 24, 35, 0.75) 0%, rgba(28, 30, 45, 0.65) 100%)",
                  border: "1px solid rgba(139, 156, 247, 0.06)",
                  borderRadius: 18,
                  transition:
                    "border-color 0.4s ease, box-shadow 0.4s ease, transform 0.3s ease",
                  "&:hover": {
                    borderColor: "rgba(139, 156, 247, 0.12)",
                    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.2)",
                    transform: "translateY(-1px)",
                  },
                }
              : {
                  borderRadius: 18,
                  border: "1px solid rgba(0, 0, 0, 0.04)",
                  boxShadow:
                    "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)",
                  transition:
                    "box-shadow 0.4s ease, transform 0.3s ease",
                  "&:hover": {
                    boxShadow:
                      "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
                    transform: "translateY(-1px)",
                  },
                },
        },
      },
      MuiButton: {
        styleOverrides: {
          containedPrimary:
            mode === "dark"
              ? {
                  background:
                    "linear-gradient(135deg, rgba(139,156,247,0.9) 0%, rgba(196,167,231,0.8) 100%)",
                  color: "#0f1117",
                  fontWeight: 600,
                  textTransform: "none" as const,
                  boxShadow:
                    "0 2px 12px rgba(139, 156, 247, 0.15)",
                  letterSpacing: "-0.01em",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, rgba(159,172,255,0.95) 0%, rgba(210,185,240,0.9) 100%)",
                    boxShadow:
                      "0 4px 20px rgba(139, 156, 247, 0.25)",
                  },
                }
              : {
                  textTransform: "none" as const,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  boxShadow: "0 1px 4px rgba(91,106,191,0.15)",
                  "&:hover": {
                    boxShadow: "0 2px 8px rgba(91,106,191,0.2)",
                  },
                },
          outlined:
            mode === "dark"
              ? {
                  borderColor: "rgba(139, 156, 247, 0.2)",
                  color: "#8b9cf7",
                  textTransform: "none" as const,
                  letterSpacing: "-0.01em",
                  "&:hover": {
                    borderColor: "rgba(139, 156, 247, 0.35)",
                    background: "rgba(139, 156, 247, 0.06)",
                  },
                }
              : {
                  textTransform: "none" as const,
                  letterSpacing: "-0.01em",
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
                      borderColor: "rgba(180, 188, 208, 0.12)",
                    },
                    "&:hover fieldset": {
                      borderColor: "rgba(139, 156, 247, 0.25)",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "rgba(139, 156, 247, 0.5)",
                      borderWidth: 1,
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
                  background:
                    "linear-gradient(180deg, rgba(13, 15, 23, 0.97) 0%, rgba(17, 19, 30, 0.97) 100%)",
                  backdropFilter: "blur(24px) saturate(1.2)",
                  borderRight:
                    "1px solid rgba(139, 156, 247, 0.06)",
                }
              : {},
        },
      },
      MuiChip: {
        styleOverrides: {
          root:
            mode === "dark"
              ? {
                  borderColor: "rgba(139, 156, 247, 0.2)",
                  fontWeight: 500,
                }
              : {
                  fontWeight: 500,
                },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root:
            mode === "dark"
              ? {
                  borderColor: "rgba(180, 188, 208, 0.06)",
                }
              : {},
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper:
            mode === "dark"
              ? {
                  background:
                    "linear-gradient(135deg, rgba(22, 24, 35, 0.95) 0%, rgba(28, 30, 45, 0.95) 100%)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid rgba(139, 156, 247, 0.08)",
                }
              : {},
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 14,
          },
        },
      },
    },
  });
}
