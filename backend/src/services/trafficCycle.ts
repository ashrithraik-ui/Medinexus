/**
 * ==============================================================================
 * Urban Traffic Light Cycle Simulator (src/services/trafficCycle.ts)
 * ==============================================================================
 * What does this file do in plain English?
 * In a real city, traffic lights continuously cycle through three colors:
 * - RED (Stop) -> 8 seconds
 * - GREEN (Go) -> 7 seconds
 * - YELLOW (Caution / Prepare to stop) -> 3 seconds
 *
 * This background service acts like the "City Traffic Control Timer":
 * 1. Every 2.5 seconds, it checks all traffic intersections in the city.
 * 2. If a signal is in 'NORMAL' mode, it advances its color timer.
 * 3. It adds a natural "phase offset" between intersections so lights don't all
 *    turn red or green at the exact same moment.
 * 4. IMPORTANT: If an ambulance is approaching, the Green Corridor locks that
 *    specific intersection to 'EMERGENCY_PRIORITY' (SOLID GREEN), and this timer
 *    skips it until the ambulance has safely crossed!
 * ==============================================================================
 */

import { prisma } from "../lib/prisma.js";
import { emitLive } from "../sockets/index.js";

// Global timer reference to ensure only one traffic loop is running at any time
let cycleTimer: ReturnType<typeof setInterval> | null = null;

export function startTrafficSignalCycling() {
  if (cycleTimer) return;

  // Run the traffic light cycle every 2500 milliseconds (2.5 seconds)
  cycleTimer = setInterval(async () => {
    try {
      // Step 1: Only cycle signals operating under NORMAL traffic conditions.
      // (Any signal currently locked green for an ambulance is untouched!)
      const normalSignals = await prisma.trafficSignal.findMany({
        where: { mode: "NORMAL" },
      });

      const now = Math.floor(Date.now() / 1000); // Current unix time in seconds
      const updates = [];

      for (const sig of normalSignals) {
        // Stagger phases across intersections based on sequence order (e.g. Signal #1, #2, #3...)
        // An 18-second total loop: 8s RED + 7s GREEN + 3s YELLOW = 18 seconds
        const offset = (sig.sequenceOrder * 5) % 18;
        const phase = (now + offset) % 18;

        let nextStatus: "RED" | "GREEN" | "YELLOW" = "RED";
        if (phase < 8) {
          nextStatus = "RED"; // Hold RED for 8 seconds
        } else if (phase < 15) {
          nextStatus = "GREEN"; // Hold GREEN for 7 seconds
        } else {
          nextStatus = "YELLOW"; // Hold YELLOW for 3 seconds
        }

        // Only write to the database if the signal's color actually changed
        if (sig.status !== nextStatus) {
          updates.push(
            prisma.trafficSignal.update({
              where: { id: sig.id },
              data: { status: nextStatus },
            })
          );
        }
      }

      // Step 2: If any lights changed color, save changes and broadcast to all live maps!
      if (updates.length > 0) {
        await Promise.all(updates);
        const allSignals = await prisma.trafficSignal.findMany({
          orderBy: { sequenceOrder: "asc" },
        });
        emitLive("traffic:signals", { signals: allSignals });
      }
    } catch {
      // Silently catch transient database locks during hot-reloads
    }
  }, 2500);
}
