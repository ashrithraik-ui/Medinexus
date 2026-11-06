/**
 * ==============================================================================
 * Specialist Doctor Roster & On-Duty Status Router (src/routes/doctors.ts)
 * ==============================================================================
 * This file manages the doctors assigned to hospital emergency departments:
 * 1. `GET /api/doctors`: Lists all doctors and their live availability (On-Duty / Off-Duty).
 * 2. `POST /api/doctors`: Adds a new doctor with their medical specialty (e.g. Cardiologist).
 * 3. `PATCH /api/doctors/:id`: Toggles whether a doctor is currently on shift or unavailable.
 * 4. `DELETE /api/doctors/:id`: Removes a doctor from the hospital roster.
 *
 * Why this matters:
 * If an incoming patient suffered a massive heart attack, the recommendation algorithm
 * checks if this hospital has a CARDIOLOGIST currently on-duty (`isAvailable: true`).
 * ==============================================================================
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { auth, type AuthedRequest } from "../middleware/auth.js";
import { emitLive } from "../sockets/index.js";

export const doctorsRouter = Router();

// Allowed medical specializations recognized by our emergency triage engine
const spec = z.enum(["CARDIOLOGIST", "ORTHOPEDIC", "GYNECOLOGIST", "GENERAL_PHYSICIAN", "EMERGENCY_MEDICINE"]);

/**
 * ------------------------------------------------------------------------------
 * GET /api/doctors
 * ------------------------------------------------------------------------------
 * Purpose: Retrieves the full roster of doctors for the hospital, including whether
 * each doctor is currently clocked-in and available for emergencies.
 */
doctorsRouter.get("/", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const hospitalId = req.user?.role === "ADMIN" ? String(req.query.hospitalId || "") : req.user?.hospitalId;
    const doctors = await prisma.doctor.findMany({
      where: hospitalId ? { hospitalId } : undefined,
      include: { availability: true },
      orderBy: { name: "asc" },
    });
    res.json({ doctors });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/doctors
 * ------------------------------------------------------------------------------
 * Purpose: Allows hospital emergency desk staff to add a new doctor to the roster.
 */
doctorsRouter.post("/", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const data = z.object({ name: z.string().min(2), specialization: spec, phone: z.string().optional() }).parse(req.body);
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId && req.user?.role !== "ADMIN") return res.status(400).json({ error: "No hospital linked" });

    const doctor = await prisma.doctor.create({
      data: {
        hospitalId: hospitalId || z.string().parse(req.body.hospitalId),
        name: data.name,
        specialization: data.specialization,
        phone: data.phone,
        availability: { create: { isAvailable: true } },
      },
      include: { availability: true },
    });

    // Notify connected ambulances that doctor availability has changed
    emitLive("hospital:updated", { hospitalId: doctor.hospitalId });
    res.status(201).json({ doctor });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * PATCH /api/doctors/:id
 * ------------------------------------------------------------------------------
 * Purpose: Toggles doctor shift status (On-Duty vs Off-Duty / In-Surgery).
 * When toggled, the algorithm instantly recalculates hospital suitability scores.
 */
doctorsRouter.patch("/:id", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(2).optional(),
        specialization: spec.optional(),
        phone: z.string().optional(),
        isAvailable: z.boolean().optional(),
        shiftNote: z.string().optional(),
      })
      .parse(req.body);

    const id = req.params.id as string;
    const existing = await prisma.doctor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Doctor not found" });

    // Security check: Hospital staff can only modify doctors belonging to their own facility
    if (req.user?.role === "HOSPITAL_STAFF" && existing.hospitalId !== req.user.hospitalId) {
      return res.status(403).json({ error: "Cannot edit another hospital's doctors" });
    }

    const doctor = await prisma.doctor.update({
      where: { id },
      data: {
        name: data.name,
        specialization: data.specialization,
        phone: data.phone,
        availability: data.isAvailable === undefined && data.shiftNote === undefined
          ? undefined
          : {
              upsert: {
                create: { isAvailable: data.isAvailable ?? true, shiftNote: data.shiftNote },
                update: { isAvailable: data.isAvailable, shiftNote: data.shiftNote },
              },
            },
      },
      include: { availability: true },
    });

    // Broadcast update across the system
    emitLive("hospital:updated", { hospitalId: doctor.hospitalId });
    res.json({ doctor });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * DELETE /api/doctors/:id
 * ------------------------------------------------------------------------------
 * Purpose: Removes a doctor from the hospital staff list.
 */
doctorsRouter.delete("/:id", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.doctor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Doctor not found" });

    if (req.user?.role === "HOSPITAL_STAFF" && existing.hospitalId !== req.user.hospitalId) {
      return res.status(403).json({ error: "Cannot delete another hospital's doctors" });
    }

    await prisma.doctor.delete({ where: { id } });
    emitLive("hospital:updated", { hospitalId: existing.hospitalId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
