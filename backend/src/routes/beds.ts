/**
 * ==============================================================================
 * Hospital Bed & ICU Inventory Router (src/routes/beds.ts)
 * ==============================================================================
 * This file allows Hospital Staff and Administrators to update the live count of
 * emergency and ICU beds in their hospital.
 *
 * Why this matters:
 * When an ambulance driver chooses a hospital for a patient in critical condition,
 * the recommendation engine checks this live bed count. If a hospital has 0 beds,
 * the system warns the driver and recommends an alternate facility with open capacity.
 * ==============================================================================
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { auth, type AuthedRequest } from "../middleware/auth.js";
import { emitLive } from "../sockets/index.js";

export const bedsRouter = Router();

/**
 * ------------------------------------------------------------------------------
 * PATCH /api/beds
 * ------------------------------------------------------------------------------
 * Updates the total and available bed count for the hospital.
 *
 * Security: Requires 'HOSPITAL_STAFF' or 'ADMIN' role.
 * Real-Time: Broadcasts a `hospital:updated` WebSocket event so all ambulances
 * see the new bed counts immediately on their live map and ranking cards.
 */
bedsRouter.patch("/", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    // Validate inputs: Available beds and total beds must be positive integers
    const data = z.object({ total: z.number().int().min(0).optional(), available: z.number().int().min(0) }).parse(req.body);

    // Identify which hospital is being modified
    const hospitalId = req.user?.role === "ADMIN" ? String(req.body.hospitalId || req.user.hospitalId) : req.user?.hospitalId;
    if (!hospitalId) return res.status(400).json({ error: "No hospital linked to this user" });

    // Sanity check: Ensure available beds cannot be higher than total capacity
    const current = await prisma.emergencyBeds.findUnique({ where: { hospitalId } });
    const total = data.total ?? current?.total ?? data.available;
    if (data.available > total) return res.status(400).json({ error: "Available beds cannot exceed total beds" });

    // Save or update (upsert) bed counts in the database
    const beds = await prisma.emergencyBeds.upsert({
      where: { hospitalId },
      create: { hospitalId, total, available: data.available },
      update: { total, available: data.available },
    });

    // Broadcast the updated bed count to all connected ambulances and ops dashboards
    emitLive("hospital:updated", { hospitalId, beds });

    res.json({ beds });
  } catch (err) {
    next(err);
  }
});
