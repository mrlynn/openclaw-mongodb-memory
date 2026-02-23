#!/usr/bin/env tsx
/**
 * Seed database with realistic demo data.
 *
 * Creates ~100 memories for demo-agent and ~25 for assistant-agent,
 * spread over the last 14 days with realistic developer workflow content.
 *
 * Usage:
 *   pnpm --filter @openclaw-memory/daemon db:seed
 *   pnpm --filter @openclaw-memory/daemon db:seed -- --clear   # clear first
 */

import dotenv from "dotenv";
import path from "path";
import { MongoClient } from "mongodb";
import { VoyageEmbedder } from "../embedding";
import { DB_NAME, COLLECTION_MEMORIES, EMBEDDING_DIMENSIONS } from "../constants";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

// Force mock embeddings for seeding
process.env.VOYAGE_MOCK = "true";

const AGENTS = ["demo-agent", "assistant-agent"];

// ─────────────────────────────────────────────────────────────────────
// Realistic demo memories: a developer building a real-time dashboard
// project over 14 days (Feb 9 – Feb 23, 2026)
// ─────────────────────────────────────────────────────────────────────

interface SeedMemory {
  text: string;
  tags: string[];
  agent: number;
  day: string; // "YYYY-MM-DD"
  hour: number; // 0-23
  minute: number;
}

const SEED_MEMORIES: SeedMemory[] = [
  // ── Feb 9 (Mon) — Project kickoff ──────────────────────────────
  {
    text: "Started new project: real-time analytics dashboard for e-commerce metrics. Stack decision: Next.js 15 + MongoDB Atlas + WebSockets. Client wants sub-second latency on order metrics.",
    tags: ["project-setup", "architecture"],
    agent: 0,
    day: "2026-02-09",
    hour: 9,
    minute: 15,
  },
  {
    text: "Set up the monorepo with pnpm workspaces. Three packages: api (Express), web (Next.js), shared (types and utilities). Using TypeScript strict mode across all packages.",
    tags: ["project-setup", "monorepo"],
    agent: 0,
    day: "2026-02-09",
    hour: 9,
    minute: 48,
  },
  {
    text: "Created MongoDB Atlas cluster (M10) in us-east-1. Database name: analytics_prod. Collections planned: events, metrics_hourly, metrics_daily, dashboards, users.",
    tags: ["database", "infrastructure"],
    agent: 0,
    day: "2026-02-09",
    hour: 10,
    minute: 30,
  },
  {
    text: "Defined the event schema with Zod: { eventType: string, merchantId: string, amount: number, currency: string, metadata: Record<string, unknown>, timestamp: Date }. Index on { merchantId: 1, timestamp: -1 }.",
    tags: ["schema", "database", "zod"],
    agent: 0,
    day: "2026-02-09",
    hour: 11,
    minute: 22,
  },
  {
    text: "Scaffolded Express API with health check, middleware stack (cors, helmet, compression, rate-limit). Using express-async-errors for clean error propagation.",
    tags: ["api", "middleware"],
    agent: 0,
    day: "2026-02-09",
    hour: 14,
    minute: 5,
  },
  {
    text: "Client wants real-time updates. Evaluated options: WebSockets (ws), Socket.io, Server-Sent Events. Going with Socket.io for reconnection handling and room-based subscriptions per merchant.",
    tags: ["architecture", "real-time", "decision"],
    agent: 0,
    day: "2026-02-09",
    hour: 15,
    minute: 40,
  },
  {
    text: "Set up GitHub repo, branch protection on main (require PR + 1 review), CI with GitHub Actions. Runs typecheck, lint, test, build on every push.",
    tags: ["ci", "git", "tooling"],
    agent: 0,
    day: "2026-02-09",
    hour: 16,
    minute: 55,
  },

  // ── Feb 10 (Tue) — API development ─────────────────────────────
  {
    text: "Built the POST /events endpoint. Accepts batch events (up to 1000 per request), validates with Zod, inserts to MongoDB with ordered: false for speed. Returns { accepted: number, rejected: number }.",
    tags: ["api", "events", "endpoint"],
    agent: 0,
    day: "2026-02-10",
    hour: 9,
    minute: 10,
  },
  {
    text: "Implemented hourly aggregation pipeline using MongoDB change streams. Listens on the events collection and updates metrics_hourly in real-time using $inc operations. This avoids scheduled cron jobs entirely.",
    tags: ["aggregation", "change-streams", "database"],
    agent: 0,
    day: "2026-02-10",
    hour: 10,
    minute: 45,
  },
  {
    text: "Hit an issue: change stream resume tokens expire after 24 hours on M10 clusters. Solved by storing the last resume token in a separate collection and restarting from there on reconnect.",
    tags: ["bug", "change-streams", "fix"],
    agent: 0,
    day: "2026-02-10",
    hour: 12,
    minute: 30,
  },
  {
    text: "Created GET /metrics endpoint with flexible time-range queries. Supports granularity=hourly|daily, merchantId filter, and date range. Returns pre-aggregated data so the frontend never scans raw events.",
    tags: ["api", "metrics", "endpoint"],
    agent: 0,
    day: "2026-02-10",
    hour: 14,
    minute: 15,
  },
  {
    text: "Added request logging middleware using pino. Structured JSON logs with requestId, method, url, statusCode, duration, userId. Logs to stdout for Docker compatibility.",
    tags: ["logging", "observability", "middleware"],
    agent: 0,
    day: "2026-02-10",
    hour: 15,
    minute: 20,
  },
  {
    text: "Wrote integration tests for /events and /metrics endpoints using supertest + vitest. Test database uses a unique DB name per test run to allow parallel execution. 14 tests, all passing.",
    tags: ["testing", "api", "vitest"],
    agent: 0,
    day: "2026-02-10",
    hour: 16,
    minute: 40,
  },

  // ── Feb 11 (Wed) — Auth & dashboard layout ─────────────────────
  {
    text: "Implemented JWT auth with refresh token rotation. Access tokens expire in 15 min, refresh in 7 days. Tokens stored in httpOnly cookies. Refresh endpoint auto-rotates both tokens.",
    tags: ["auth", "jwt", "security"],
    agent: 0,
    day: "2026-02-11",
    hour: 9,
    minute: 5,
  },
  {
    text: "Created the dashboard shell layout in Next.js. Collapsible sidebar (260px → 64px), header with user avatar + notification bell, main content area with CSS grid. Using CSS modules, no Tailwind.",
    tags: ["frontend", "layout", "css"],
    agent: 0,
    day: "2026-02-11",
    hour: 10,
    minute: 30,
  },
  {
    text: "Built the MetricCard component. Shows current value, sparkline trend (last 24h), percentage change badge. Color-coded: green for up, red for down. Used CSS custom properties for theming.",
    tags: ["frontend", "component", "design"],
    agent: 0,
    day: "2026-02-11",
    hour: 11,
    minute: 50,
  },
  {
    text: "The client asked for dark mode support. Implementing with data-theme attribute on body + CSS custom properties. Theme preference saved to localStorage, respects OS prefers-color-scheme.",
    tags: ["frontend", "dark-mode", "theming"],
    agent: 0,
    day: "2026-02-11",
    hour: 13,
    minute: 45,
  },
  {
    text: "Debated charting libraries. Recharts is popular but heavy (200KB+). Going with lightweight custom SVG charts using D3 scales only (d3-scale + d3-shape, ~30KB). Better control over animations.",
    tags: ["frontend", "charting", "decision"],
    agent: 0,
    day: "2026-02-11",
    hour: 15,
    minute: 10,
  },
  {
    text: "CORS issue when connecting frontend (port 3000) to API (port 4000). Fixed by configuring express cors() with explicit origin array instead of wildcard. Also needed credentials: true for cookies.",
    tags: ["bug", "cors", "fix"],
    agent: 0,
    day: "2026-02-11",
    hour: 16,
    minute: 35,
  },

  // ── Feb 12 (Thu) — Charts & real-time ──────────────────────────
  {
    text: "Built the TimeSeriesChart component. Renders revenue over time with configurable granularity (hour/day/week). Features: hover tooltip with exact values, animated path drawing on mount, responsive resize via ResizeObserver.",
    tags: ["frontend", "charting", "component"],
    agent: 0,
    day: "2026-02-12",
    hour: 9,
    minute: 20,
  },
  {
    text: "Integrated Socket.io on the frontend. Dashboard subscribes to merchant-specific rooms. Incoming events trigger optimistic metric updates with smooth CSS transitions. Reconnection works automatically.",
    tags: ["real-time", "socket.io", "frontend"],
    agent: 0,
    day: "2026-02-12",
    hour: 10,
    minute: 55,
  },
  {
    text: "Performance issue: re-rendering the entire dashboard on every WebSocket message. Fixed by using React.memo on metric cards and moving socket state to a dedicated context with selective subscriptions.",
    tags: ["performance", "react", "optimization"],
    agent: 0,
    day: "2026-02-12",
    hour: 12,
    minute: 10,
  },
  {
    text: "Created a DonutChart component for category breakdown (revenue by product type). Animated arc transitions, click-to-filter interaction, center label shows total. Accessible with aria-labels on each segment.",
    tags: ["frontend", "charting", "accessibility"],
    agent: 0,
    day: "2026-02-12",
    hour: 14,
    minute: 30,
  },
  {
    text: "The merchant filter dropdown was slow with 500+ merchants. Replaced plain select with a virtualized combobox using react-window. Now renders smoothly even with 5000 items.",
    tags: ["frontend", "performance", "ux"],
    agent: 0,
    day: "2026-02-12",
    hour: 15,
    minute: 45,
  },
  {
    text: "Added rate limiting to the events API: 1000 requests/minute per merchant using express-rate-limit with Redis store. Returns 429 with Retry-After header. Tested with k6 load testing.",
    tags: ["api", "rate-limiting", "security"],
    agent: 0,
    day: "2026-02-12",
    hour: 16,
    minute: 50,
  },

  // ── Feb 13 (Fri) — Filtering, export, polish ──────────────────
  {
    text: "Built advanced filter panel: date range picker, merchant multi-select, event type checkboxes, amount range slider. Filters stored in URL query params for shareable links.",
    tags: ["frontend", "filters", "ux"],
    agent: 0,
    day: "2026-02-13",
    hour: 9,
    minute: 30,
  },
  {
    text: "Implemented CSV export for metric data. Streams data using ReadableStream API to handle large exports without memory issues. Frontend shows progress bar during download.",
    tags: ["feature", "export", "streaming"],
    agent: 0,
    day: "2026-02-13",
    hour: 11,
    minute: 15,
  },
  {
    text: "Client demo went well. Feedback: (1) want comparison mode to overlay two time periods, (2) need alerts when metrics drop below threshold, (3) mobile support is a must. Scheduled for next week.",
    tags: ["feedback", "client", "planning"],
    agent: 0,
    day: "2026-02-13",
    hour: 14,
    minute: 0,
  },
  {
    text: "Fixed timezone bug: dates were rendering in UTC on the frontend but queries used server local time. Standardized everything to UTC with explicit timezone conversion in the aggregation pipeline.",
    tags: ["bug", "timezone", "fix"],
    agent: 0,
    day: "2026-02-13",
    hour: 15,
    minute: 20,
  },
  {
    text: "Added error boundaries to all dashboard sections. Each widget fails independently with a retry button. Global error boundary catches unhandled promise rejections and shows a recovery UI.",
    tags: ["frontend", "error-handling", "resilience"],
    agent: 0,
    day: "2026-02-13",
    hour: 16,
    minute: 30,
  },

  // ── Feb 14 (Sat) — Light work day ─────────────────────────────
  {
    text: "Spent Saturday morning refactoring the aggregation pipeline. Moved from $group + $sort to $setWindowFields for running totals. Cleaner code and MongoDB handles the sort internally.",
    tags: ["refactoring", "database", "aggregation"],
    agent: 0,
    day: "2026-02-14",
    hour: 10,
    minute: 0,
  },
  {
    text: "Wrote documentation for the API endpoints using TypeDoc + custom markdown templates. Auto-generates from Zod schemas. Published to /docs route using Docusaurus.",
    tags: ["documentation", "api"],
    agent: 0,
    day: "2026-02-14",
    hour: 11,
    minute: 30,
  },
  {
    text: "Set up MongoDB Atlas alerts: CPU > 80%, connections > 200, oplog lag > 5s. Notifications go to Slack #ops channel via webhook.",
    tags: ["monitoring", "alerts", "infrastructure"],
    agent: 0,
    day: "2026-02-14",
    hour: 12,
    minute: 45,
  },
  {
    text: "Quick fix: the sparkline chart was clipping negative values. The SVG viewBox wasn't accounting for values below zero. Added padding to the y-axis calculation.",
    tags: ["bug", "charting", "fix"],
    agent: 0,
    day: "2026-02-14",
    hour: 13,
    minute: 20,
  },
  {
    text: "Reviewed the security checklist before deployment: HTTPS only, CSP headers, no sensitive data in logs, input sanitization, parameterized queries. All passing.",
    tags: ["security", "checklist", "deployment"],
    agent: 0,
    day: "2026-02-14",
    hour: 14,
    minute: 10,
  },

  // ── Feb 16 (Mon) — Comparison mode ─────────────────────────────
  {
    text: "Started building comparison mode. The idea: user selects two date ranges and sees metrics side-by-side with percentage deltas. Both time series rendered on the same chart with different opacities.",
    tags: ["feature", "comparison", "frontend"],
    agent: 0,
    day: "2026-02-16",
    hour: 9,
    minute: 15,
  },
  {
    text: "Created a DateRangePicker component with preset options (Today, Yesterday, Last 7 days, Last 30 days, Custom). Uses native date inputs with a popover calendar for custom ranges.",
    tags: ["component", "frontend", "ux"],
    agent: 0,
    day: "2026-02-16",
    hour: 10,
    minute: 30,
  },
  {
    text: "The comparison query was slow — two separate aggregation pipelines. Optimized with $facet to run both pipelines in a single MongoDB round-trip. Response time dropped from 800ms to 200ms.",
    tags: ["performance", "database", "optimization"],
    agent: 0,
    day: "2026-02-16",
    hour: 12,
    minute: 0,
  },
  {
    text: "Added visual diff highlights: green background on metrics that improved, red on metrics that declined. Threshold configurable (default: 5% change counts as significant).",
    tags: ["frontend", "comparison", "design"],
    agent: 0,
    day: "2026-02-16",
    hour: 14,
    minute: 20,
  },
  {
    text: "Wrote tests for comparison mode: same periods should show 0% diff, missing data in one period should show N/A, edge case with DST transitions. 8 new tests, all passing.",
    tags: ["testing", "comparison"],
    agent: 0,
    day: "2026-02-16",
    hour: 15,
    minute: 40,
  },
  {
    text: "Deployed comparison mode to staging. Client previewed it and loved it. One request: add ability to share comparison views via URL. Added serialization of both date ranges to query params.",
    tags: ["deployment", "feedback", "feature"],
    agent: 0,
    day: "2026-02-16",
    hour: 16,
    minute: 50,
  },

  // ── Feb 17 (Tue) — Alerts system ───────────────────────────────
  {
    text: "Designed the alerts system. Three types: threshold (metric crosses value), anomaly (deviation from rolling average), trend (sustained increase/decrease over N periods). Stored in alerts collection.",
    tags: ["feature", "alerts", "design"],
    agent: 0,
    day: "2026-02-17",
    hour: 9,
    minute: 10,
  },
  {
    text: "Built the alert evaluation engine. Runs every minute via a setInterval in the API process. Checks all active alert rules against latest metrics. Uses MongoDB aggregation for threshold checks.",
    tags: ["backend", "alerts", "engine"],
    agent: 0,
    day: "2026-02-17",
    hour: 10,
    minute: 45,
  },
  {
    text: "Created the AlertRuleForm component. Supports all three alert types with dynamic form fields. Condition builder for thresholds: metric > value, metric < value, metric changes by X%.",
    tags: ["frontend", "alerts", "forms"],
    agent: 0,
    day: "2026-02-17",
    hour: 12,
    minute: 15,
  },
  {
    text: "Alert notifications go through a pluggable channel system: email (SendGrid), Slack (webhook), in-app (stored in notifications collection + pushed via Socket.io). Each rule can have multiple channels.",
    tags: ["alerts", "notifications", "architecture"],
    agent: 0,
    day: "2026-02-17",
    hour: 14,
    minute: 30,
  },
  {
    text: "Edge case: alert flapping when a metric hovers around the threshold. Implemented hysteresis — alert only triggers after the condition is true for 3 consecutive evaluations.",
    tags: ["alerts", "edge-case", "fix"],
    agent: 0,
    day: "2026-02-17",
    hour: 15,
    minute: 55,
  },
  {
    text: "Added alert history view. Shows all triggered alerts with timeline, severity, acknowledged status. Filterable by rule, severity, and time range. Uses virtual scrolling for large histories.",
    tags: ["frontend", "alerts", "ux"],
    agent: 0,
    day: "2026-02-17",
    hour: 16,
    minute: 40,
  },

  // ── Feb 18 (Wed) — Mobile & responsive ─────────────────────────
  {
    text: "Started mobile responsive redesign. Sidebar collapses to bottom tab bar on screens < 768px. Charts resize via ResizeObserver. Metric cards stack vertically in a single column.",
    tags: ["frontend", "responsive", "mobile"],
    agent: 0,
    day: "2026-02-18",
    hour: 9,
    minute: 20,
  },
  {
    text: "Touch interactions for charts: pinch-to-zoom on time series, swipe to pan, long-press for tooltip. Used pointer events API for unified mouse/touch handling.",
    tags: ["frontend", "mobile", "interaction"],
    agent: 0,
    day: "2026-02-18",
    hour: 11,
    minute: 0,
  },
  {
    text: "The filter panel doesn't fit on mobile. Created a slide-up sheet component with drag-to-dismiss. Filters are summarized in a compact chip row when the sheet is closed.",
    tags: ["frontend", "mobile", "component"],
    agent: 0,
    day: "2026-02-18",
    hour: 12,
    minute: 30,
  },
  {
    text: "Tested on iPhone 15, Pixel 8, and iPad Air. Found a Safari bug: backdrop-filter on the header causes scroll jank on iOS. Workaround: use -webkit-backdrop-filter with will-change: transform.",
    tags: ["testing", "mobile", "safari-bug"],
    agent: 0,
    day: "2026-02-18",
    hour: 14,
    minute: 15,
  },
  {
    text: "Performance audit with Lighthouse: Score 94 on desktop, 78 on mobile. Main issues: chart rendering blocks main thread, large JS bundle. Will address with code splitting and requestIdleCallback.",
    tags: ["performance", "lighthouse", "audit"],
    agent: 0,
    day: "2026-02-18",
    hour: 15,
    minute: 50,
  },

  // ── Feb 19 (Thu) — Performance optimization ────────────────────
  {
    text: "Code splitting: moved chart components to dynamic imports with next/dynamic. Initial bundle dropped from 420KB to 280KB. Charts load on-demand with skeleton placeholders.",
    tags: ["performance", "code-splitting", "frontend"],
    agent: 0,
    day: "2026-02-19",
    hour: 9,
    minute: 25,
  },
  {
    text: "Implemented virtual scrolling for the events table (10K+ rows). Using @tanstack/virtual — renders only visible rows. Scroll performance is now butter-smooth even with 50K events.",
    tags: ["performance", "frontend", "virtual-scroll"],
    agent: 0,
    day: "2026-02-19",
    hour: 10,
    minute: 50,
  },
  {
    text: "Database query optimization: added compound index { merchantId: 1, timestamp: -1, eventType: 1 } for the metrics query. Explain plan went from COLLSCAN to covered IXSCAN. 10x faster.",
    tags: ["performance", "database", "indexing"],
    agent: 0,
    day: "2026-02-19",
    hour: 12,
    minute: 20,
  },
  {
    text: "Added Redis caching for the /metrics endpoint. Cache key: merchantId + granularity + dateRange hash. TTL: 30s for hourly, 5m for daily. Cache hit ratio in staging: 72%.",
    tags: ["performance", "caching", "redis"],
    agent: 0,
    day: "2026-02-19",
    hour: 14,
    minute: 0,
  },
  {
    text: "Switched chart rendering to use OffscreenCanvas for the heatmap visualization. Moves rendering off the main thread. FPS improved from 28 to 58 on the dense heatmap view.",
    tags: ["performance", "canvas", "optimization"],
    agent: 0,
    day: "2026-02-19",
    hour: 15,
    minute: 30,
  },
  {
    text: "End-to-end latency test: event ingestion → change stream → metric update → WebSocket push → UI render. Average: 340ms, P99: 820ms. Client target was sub-1s. We're good.",
    tags: ["performance", "latency", "testing"],
    agent: 0,
    day: "2026-02-19",
    hour: 16,
    minute: 45,
  },

  // ── Feb 20 (Fri) — Testing & bug fixes ─────────────────────────
  {
    text: "Found a race condition in the change stream handler. Two events arriving simultaneously could cause duplicate metric increments. Fixed with findOneAndUpdate using upsert + $inc atomicity.",
    tags: ["bug", "race-condition", "fix"],
    agent: 0,
    day: "2026-02-20",
    hour: 9,
    minute: 30,
  },
  {
    text: "Wrote E2E tests with Playwright: login flow, dashboard load, filter interaction, real-time update, export CSV, alert creation. 12 tests covering critical paths.",
    tags: ["testing", "e2e", "playwright"],
    agent: 0,
    day: "2026-02-20",
    hour: 11,
    minute: 0,
  },
  {
    text: "Memory leak in the Socket.io handler: event listeners weren't being cleaned up on component unmount. Added proper cleanup in useEffect return function. Heap usage stabilized.",
    tags: ["bug", "memory-leak", "fix"],
    agent: 0,
    day: "2026-02-20",
    hour: 12,
    minute: 45,
  },
  {
    text: "The CSV export was failing for date ranges over 30 days (timeout). Switched to chunked processing with cursor-based pagination. Now handles any date range with constant memory usage.",
    tags: ["bug", "export", "fix"],
    agent: 0,
    day: "2026-02-20",
    hour: 14,
    minute: 20,
  },
  {
    text: "Added error tracking with Sentry. Configured source maps upload in the build step. Custom tags: merchantId, userId, dashboardId. Breadcrumbs capture navigation and API calls.",
    tags: ["observability", "error-tracking", "sentry"],
    agent: 0,
    day: "2026-02-20",
    hour: 15,
    minute: 35,
  },
  {
    text: "Overall test coverage: 81% lines, 74% branches, 86% functions. Added coverage threshold enforcement in vitest config. PR CI fails if coverage drops below these numbers.",
    tags: ["testing", "coverage", "quality"],
    agent: 0,
    day: "2026-02-20",
    hour: 16,
    minute: 50,
  },

  // ── Feb 21 (Sat) — Light polish ────────────────────────────────
  {
    text: "Added keyboard shortcuts: Ctrl+K for search, Ctrl+F for filters, Escape to close modals, arrow keys to navigate between metric cards. Shortcut help modal on '?' key.",
    tags: ["ux", "accessibility", "keyboard"],
    agent: 0,
    day: "2026-02-21",
    hour: 10,
    minute: 15,
  },
  {
    text: "Improved loading states across the dashboard. Each section has its own skeleton that matches the final layout dimensions. No layout shift on data load (CLS score: 0.02).",
    tags: ["ux", "loading", "performance"],
    agent: 0,
    day: "2026-02-21",
    hour: 11,
    minute: 30,
  },
  {
    text: "Created a guided onboarding flow for new users: 5-step tooltip tour highlighting key features. Tracks completion in user preferences. Only shows once per account.",
    tags: ["ux", "onboarding", "feature"],
    agent: 0,
    day: "2026-02-21",
    hour: 13,
    minute: 0,
  },
  {
    text: "Refactored the theme system to support custom brand colors per merchant. Merchants can set primary, secondary, and accent colors in their profile. Dashboard adapts dynamically.",
    tags: ["frontend", "theming", "customization"],
    agent: 0,
    day: "2026-02-21",
    hour: 14,
    minute: 20,
  },
  {
    text: "Fixed an accessibility issue: chart tooltips weren't reachable via keyboard. Added focusable data points with aria-labels that describe the value. Screen reader tested with VoiceOver.",
    tags: ["accessibility", "charting", "fix"],
    agent: 0,
    day: "2026-02-21",
    hour: 15,
    minute: 45,
  },

  // ── Feb 22 (Sun) — Deployment prep ─────────────────────────────
  {
    text: "Created Docker Compose stack for production: API (3 replicas), MongoDB with replica set, Redis for caching, Nginx as reverse proxy with SSL termination. All configs in docker/ directory.",
    tags: ["deployment", "docker", "infrastructure"],
    agent: 0,
    day: "2026-02-22",
    hour: 10,
    minute: 0,
  },
  {
    text: "Set up blue-green deployment with health check verification. New version deploys to green, runs smoke tests, then Nginx switches traffic. Rollback in under 30 seconds if health checks fail.",
    tags: ["deployment", "strategy", "devops"],
    agent: 0,
    day: "2026-02-22",
    hour: 11,
    minute: 30,
  },
  {
    text: "Database migration script for production: creates indexes, sets up change stream resume token collection, configures TTL indexes for session cleanup. Idempotent — safe to run multiple times.",
    tags: ["database", "migration", "deployment"],
    agent: 0,
    day: "2026-02-22",
    hour: 13,
    minute: 0,
  },
  {
    text: "Final QA pass on staging. Found one issue: the comparison chart tooltip shows raw UTC dates instead of merchant timezone. Quick fix: pass timezone from merchant profile to the chart component.",
    tags: ["qa", "bug", "timezone"],
    agent: 0,
    day: "2026-02-22",
    hour: 14,
    minute: 30,
  },
  {
    text: "Wrote the deployment runbook: pre-deploy checks, deployment steps, verification steps, rollback procedure. Shared with the ops team in Notion.",
    tags: ["documentation", "deployment", "ops"],
    agent: 0,
    day: "2026-02-22",
    hour: 15,
    minute: 45,
  },
  {
    text: "Load tested the production-like staging environment with k6. Simulated 500 concurrent users, 10K events/minute ingestion. P99 latency: 450ms, zero errors. Ready for launch.",
    tags: ["testing", "load-test", "deployment"],
    agent: 0,
    day: "2026-02-22",
    hour: 16,
    minute: 30,
  },

  // ── Feb 23 (Mon — today) — Launch day ──────────────────────────
  {
    text: "Production deployment started at 6 AM EST. MongoDB Atlas cluster scaled to M30 for launch day traffic. Redis cluster configured with 2 replicas. All health checks green.",
    tags: ["deployment", "launch", "production"],
    agent: 0,
    day: "2026-02-23",
    hour: 6,
    minute: 0,
  },
  {
    text: "First production traffic arriving. Monitoring dashboards show nominal latency (P50: 80ms, P95: 200ms). No errors in Sentry. Change streams processing events correctly.",
    tags: ["launch", "monitoring", "production"],
    agent: 0,
    day: "2026-02-23",
    hour: 8,
    minute: 30,
  },
  {
    text: "Client onboarded their first 3 merchants. Each merchant has distinct branding applied via the custom theme system. Socket.io rooms are correctly isolated per merchant.",
    tags: ["launch", "onboarding", "client"],
    agent: 0,
    day: "2026-02-23",
    hour: 10,
    minute: 15,
  },
  {
    text: "Small issue in production: the CSV export button was hidden behind the filter panel on 13-inch laptops. CSS z-index fix deployed via hotfix branch. Took 8 minutes from report to fix in production.",
    tags: ["bug", "hotfix", "production"],
    agent: 0,
    day: "2026-02-23",
    hour: 11,
    minute: 45,
  },
  {
    text: "Lunch celebration with the team. Dashboard processing 50K events/hour across all merchants. Real-time updates working perfectly. Client sent a thank you email — they love the comparison mode.",
    tags: ["milestone", "celebration", "feedback"],
    agent: 0,
    day: "2026-02-23",
    hour: 12,
    minute: 30,
  },
  {
    text: "Post-launch retrospective notes: (1) should have automated the SSL cert rotation, (2) change stream resume token strategy saved us during a brief network blip, (3) next sprint: custom dashboard builder with drag-and-drop widgets.",
    tags: ["retrospective", "planning", "learning"],
    agent: 0,
    day: "2026-02-23",
    hour: 14,
    minute: 0,
  },
  {
    text: "Created backlog items for v1.1: custom dashboard builder, PDF report generation, Slack bot for metric queries, multi-tenancy improvements, and webhook integrations for third-party tools.",
    tags: ["planning", "backlog", "roadmap"],
    agent: 0,
    day: "2026-02-23",
    hour: 15,
    minute: 30,
  },
  {
    text: "Updated the project README with architecture diagram, API docs link, deployment guide, and contribution guidelines. Added badges for build status, coverage, and npm version.",
    tags: ["documentation", "readme", "project"],
    agent: 0,
    day: "2026-02-23",
    hour: 16,
    minute: 15,
  },

  // ── assistant-agent: meeting notes & decisions (scattered) ─────
  {
    text: "Sprint planning: prioritize real-time dashboard features. Key stories: WebSocket integration, chart components, mobile responsive. Estimate: 2 weeks for MVP.",
    tags: ["meeting", "planning", "sprint"],
    agent: 1,
    day: "2026-02-09",
    hour: 10,
    minute: 0,
  },
  {
    text: "Architecture decision: use MongoDB change streams instead of polling for real-time metric updates. Change streams provide at-most-once delivery and are natively supported in Atlas.",
    tags: ["decision", "architecture", "real-time"],
    agent: 1,
    day: "2026-02-09",
    hour: 14,
    minute: 30,
  },
  {
    text: "Security review approved the JWT implementation. Recommended adding refresh token rotation and storing tokens in httpOnly cookies instead of localStorage.",
    tags: ["security", "review", "auth"],
    agent: 1,
    day: "2026-02-11",
    hour: 11,
    minute: 0,
  },
  {
    text: "Design review for the dashboard UI. Approved glass-morphism card style with subtle borders. Dark mode as default. Charts should use the MongoDB green palette (#00ED64) for primary data series.",
    tags: ["design", "review", "ui"],
    agent: 1,
    day: "2026-02-12",
    hour: 10,
    minute: 0,
  },
  {
    text: "Client demo feedback: very positive on real-time updates and chart quality. Requested comparison mode, alerts system, and mobile support. All added to sprint backlog.",
    tags: ["meeting", "client", "feedback"],
    agent: 1,
    day: "2026-02-13",
    hour: 14,
    minute: 30,
  },
  {
    text: "Mid-sprint standup: comparison mode done, alerts in progress, mobile responsive starting tomorrow. On track for Friday demo. No blockers.",
    tags: ["meeting", "standup", "status"],
    agent: 1,
    day: "2026-02-18",
    hour: 9,
    minute: 0,
  },
  {
    text: "Performance review meeting: discussed latency targets (sub-1s for real-time, sub-200ms for cached queries). Current numbers meet all targets. Approved for production deployment.",
    tags: ["meeting", "performance", "approval"],
    agent: 1,
    day: "2026-02-19",
    hour: 16,
    minute: 0,
  },
  {
    text: "Deployment planning: agreed on blue-green strategy with automated smoke tests. Rollback window: 30 seconds. Launch scheduled for Monday Feb 23 at 6 AM EST.",
    tags: ["meeting", "deployment", "planning"],
    agent: 1,
    day: "2026-02-20",
    hour: 14,
    minute: 0,
  },
  {
    text: "Go/no-go meeting for production launch. All checklist items green: tests passing, staging verified, load tests done, monitoring configured, runbook written. Approved for launch.",
    tags: ["meeting", "launch", "approval"],
    agent: 1,
    day: "2026-02-22",
    hour: 16,
    minute: 0,
  },
  {
    text: "Post-launch retrospective: successful deployment with zero downtime. Three learnings: automate SSL rotation, document the change stream resume strategy, and invest in custom dashboard builder for v1.1.",
    tags: ["meeting", "retrospective", "learning"],
    agent: 1,
    day: "2026-02-23",
    hour: 14,
    minute: 30,
  },
];

async function main() {
  const MONGO_URI = process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error("  MONGODB_URI not set. Run: pnpm setup");
    process.exit(1);
  }

  const clearFirst = process.argv.includes("--clear");

  console.log("\n  OpenClaw Memory — Seed Demo Data\n");
  console.log(`  Database:  ${DB_NAME}`);
  console.log(`  Agents:    ${AGENTS.join(", ")}`);
  console.log(`  Memories:  ${SEED_MEMORIES.length}`);
  console.log(`  Date range: Feb 9 – Feb 23, 2026 (14 days)`);
  if (clearFirst) console.log("  Mode:      clear + seed");
  console.log();

  const embedder = new VoyageEmbedder("mock-key");
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_MEMORIES);

    if (clearFirst) {
      for (const agentId of AGENTS) {
        const result = await collection.deleteMany({ agentId });
        console.log(`  Cleared ${result.deletedCount} memories for "${agentId}"`);
      }
    }

    let inserted = 0;
    for (const mem of SEED_MEMORIES) {
      const agentId = AGENTS[mem.agent];

      // Create a precise timestamp from the day + hour + minute
      const createdAt = new Date(
        `${mem.day}T${String(mem.hour).padStart(2, "0")}:${String(mem.minute).padStart(2, "0")}:00.000Z`,
      );
      const embedding = await embedder.embedOne(mem.text, "document");

      await collection.insertOne({
        agentId,
        text: mem.text,
        tags: mem.tags,
        embedding,
        metadata: {},
        createdAt,
        updatedAt: createdAt,
        timestamp: createdAt.getTime(),
      });
      inserted++;
      process.stdout.write(`\r  Inserting... ${inserted}/${SEED_MEMORIES.length}`);
    }

    console.log(`\n\n  Seeded ${inserted} memories across ${AGENTS.length} agents.`);

    // Print per-agent counts
    for (const agentId of AGENTS) {
      const count = await collection.countDocuments({ agentId });
      console.log(`    ${agentId}: ${count} memories`);
    }

    // Print per-day breakdown for demo-agent
    console.log("\n  Per-day breakdown (demo-agent):");
    const dailyCounts = await collection
      .aggregate([
        { $match: { agentId: "demo-agent" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    for (const day of dailyCounts) {
      const bar = "█".repeat(day.count);
      console.log(`    ${day._id}  ${bar} ${day.count}`);
    }

    console.log("\n  Done.\n");
  } catch (err) {
    console.error("\n  Seed failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
