/**
 * ==============================================================================
 * Smart Traffic Signals & Green Corridor Router (src/routes/traffic.ts)
 * ==============================================================================
 * This file handles traffic signal operations along the emergency transit corridor:
 * 1. `GET /api/traffic/signals`: Returns all traffic signal intersections, their
 *    physical GPS locations, and current light colors (RED, GREEN, YELLOW, or PRIORITY).
 * 2. `GET /api/traffic/priorities`: Returns an audit log of every green corridor
 *    preemption event (which ambulance was given green priority, at what intersection, and when).
 * ==============================================================================
 */

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth } from "../middleware/auth.js";
import { env } from "../config/env.js";

export const trafficRouter = Router();

/**
 * ------------------------------------------------------------------------------
 * GET /api/traffic/signals
 * ------------------------------------------------------------------------------
 * Returns all traffic lights in geographic sequence order (Signal #1 through Signal #10)
 * so the frontend map can paint their live status beacons.
 */
trafficRouter.get("/signals", auth(), async (_req, res, next) => {
  try {
    const signals = await prisma.trafficSignal.findMany({ orderBy: { sequenceOrder: "asc" } });
    res.json({
      signals,
      demo: true,
      approachMeters: env.approachMeters,
      safetyNote:
        "SIMULATION ONLY. LIFELINE 360 does not connect to or modify real public traffic signals. Future integration requires authorized traffic controllers, compatible hardware, and safety validation.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/traffic/priorities
 * ------------------------------------------------------------------------------
 * Returns historical logs of green corridor overrides.
 * Security: Only accessible by Traffic Police / Control room operators and Admins.
 */
trafficRouter.get("/priorities", auth(["TRAFFIC_CONTROL", "ADMIN"]), async (_req, res, next) => {
  try {
    const priorities = await prisma.trafficPriorityRequest.findMany({
      include: { signal: true, emergency: { include: { ambulance: true, hospital: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ priorities, demo: true });
  } catch (err) {
    next(err);
  }
});
