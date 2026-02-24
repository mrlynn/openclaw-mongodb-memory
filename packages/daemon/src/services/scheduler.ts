/**
 * Background Job Scheduler
 * 
 * Runs scheduled tasks like temporal decay, reflection pipeline (Phase 2), etc.
 * Uses simple setTimeout/setInterval instead of cron for zero dependencies.
 */

import { Db } from "mongodb";
import { runDecayPass } from "./decayService.js";

interface SchedulerConfig {
  decayEnabled: boolean;
  decayIntervalHours: number; // Default: 24 (daily)
  decayTimeOfDay?: string;    // Optional: "02:00" (HH:MM)
}

const DEFAULT_CONFIG: SchedulerConfig = {
  decayEnabled: true,
  decayIntervalHours: 24,
  decayTimeOfDay: "02:00",
};

let decayIntervalId: NodeJS.Timeout | null = null;

/**
 * Start the background scheduler
 */
export function startScheduler(db: Db, config: Partial<SchedulerConfig> = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.decayEnabled) {
    console.log("  Background scheduler: decay disabled");
    return;
  }

  console.log(`  Background scheduler: decay every ${finalConfig.decayIntervalHours}h`);
  if (finalConfig.decayTimeOfDay) {
    console.log(`    Preferred time: ${finalConfig.decayTimeOfDay}`);
  }

  // Schedule decay job
  scheduleDecay(db, finalConfig);
}

/**
 * Stop the background scheduler
 */
export function stopScheduler(): void {
  if (decayIntervalId) {
    clearInterval(decayIntervalId);
    decayIntervalId = null;
    console.log("  Background scheduler stopped");
  }
}

/**
 * Schedule the decay job
 */
function scheduleDecay(db: Db, config: SchedulerConfig): void {
  const intervalMs = config.decayIntervalHours * 60 * 60 * 1000;

  // Calculate initial delay to align with preferred time of day
  let initialDelay = 0;
  if (config.decayTimeOfDay) {
    initialDelay = getMillisecondsUntilTimeOfDay(config.decayTimeOfDay);
  }

  // Run first decay after initial delay
  setTimeout(async () => {
    await runScheduledDecay(db);

    // Then run on interval
    decayIntervalId = setInterval(async () => {
      await runScheduledDecay(db);
    }, intervalMs);
  }, initialDelay);

  console.log(`    First decay run in ${Math.round(initialDelay / 1000 / 60)} minutes`);
}

/**
 * Run the decay job
 */
async function runScheduledDecay(db: Db): Promise<void> {
  console.log(`[${new Date().toISOString()}] Running scheduled decay pass...`);

  try {
    const stats = await runDecayPass(db);

    console.log(`  Decay complete:`, {
      totalMemories: stats.totalMemories,
      decayed: stats.decayed,
      archivalCandidates: stats.archivalCandidates,
      expirationCandidates: stats.expirationCandidates,
      errors: stats.errors,
      duration: `${stats.duration}ms`,
    });

    if (stats.expirationCandidates > 0) {
      console.log(`  ⚠️  ${stats.expirationCandidates} memories below expiration threshold`);
    }
  } catch (error) {
    console.error("  Decay job failed:", error);
  }
}

/**
 * Calculate milliseconds until a specific time of day (HH:MM format)
 * 
 * @param timeOfDay - Time in "HH:MM" format (24-hour)
 * @returns Milliseconds until that time (today or tomorrow)
 */
function getMillisecondsUntilTimeOfDay(timeOfDay: string): number {
  const [hours, minutes] = timeOfDay.split(":").map(Number);

  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // If target time has already passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}
