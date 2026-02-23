/**
 * MongoDB LeafyGreen design tokens
 * Centralized color constants and spacing for the dashboard.
 */

// MongoDB brand colors
export const mongodb = {
  // Primary greens
  green: {
    dark3: "#023430",
    dark2: "#00684A",
    dark1: "#00A35C",
    base: "#00ED64",
    light1: "#71F6BA",
    light2: "#C0FAE6",
    light3: "#E3FCF7",
  },
  // Dark UI backgrounds (Atlas-style)
  black: "#001E2B",
  white: "#FFFFFF",
  // Grays
  gray: {
    dark4: "#112733",
    dark3: "#1C2D38",
    dark2: "#3D4F58",
    dark1: "#5C6C75",
    base: "#889397",
    light1: "#B8C4C2",
    light2: "#C1C7C6",
    light3: "#E8EDEB",
  },
  // Status colors
  blue: {
    dark2: "#1A567E",
    base: "#016BF8",
    light2: "#C3E7FE",
    light3: "#E1F7FF",
  },
  yellow: {
    dark2: "#944F01",
    base: "#FFC010",
    light2: "#FFEC9E",
    light3: "#FEF7DB",
  },
  red: {
    dark2: "#970606",
    base: "#DB3030",
    light2: "#F9D3D3",
    light3: "#FFEAE5",
  },
} as const;

// Semantic color tokens
export const colors = {
  // Dark mode
  dark: {
    bg: mongodb.black, // #001E2B
    surface: mongodb.gray.dark4, // #112733
    surfaceHover: mongodb.gray.dark3, // #1C2D38
    border: mongodb.gray.dark3,
    borderSubtle: "rgba(255, 255, 255, 0.06)",
    text: {
      primary: mongodb.gray.light2, // #C1C7C6
      secondary: mongodb.gray.base, // #889397
      disabled: mongodb.gray.dark1, // #5C6C75
    },
    accent: mongodb.green.base, // #00ED64
    accentSubtle: "rgba(0, 237, 100, 0.12)",
  },
  // Light mode
  light: {
    bg: mongodb.white,
    surface: "#F9FBFA",
    surfaceHover: mongodb.gray.light3,
    border: mongodb.gray.light3,
    borderSubtle: "rgba(0, 0, 0, 0.06)",
    text: {
      primary: mongodb.black,
      secondary: mongodb.gray.dark1,
      disabled: mongodb.gray.base,
    },
    accent: mongodb.green.dark2, // #00684A
    accentSubtle: "rgba(0, 104, 74, 0.08)",
  },
  // Status (shared)
  success: mongodb.green.dark1, // #00A35C
  error: mongodb.red.base, // #DB3030
  warning: mongodb.yellow.base, // #FFC010
  info: mongodb.blue.base, // #016BF8
} as const;

// Spacing scale (matches LeafyGreen tokens)
export const spacing = [0, 4, 8, 16, 24, 32, 48, 64] as const;
