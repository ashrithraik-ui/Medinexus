/**
 * ==============================================================================
 * Hospital Discovery & Facility Readiness Router (src/routes/hospitals.ts)
 * ==============================================================================
 * This file handles hospital queries and readiness statuses:
 * 1. `GET /api/hospitals`: Returns all hospitals with their available ICU beds & doctors.
 * 2. `GET /api/hospitals/public`: Lightweight unauthenticated list for dropdown menus.
 * 3. `GET /api/hospitals/staff-mongodb`: Reads staff accounts stored directly in MongoDB.
 * 4. `GET /api/hospitals/me`: Returns the facility details for the logged-in hospital staff.
 * 5. `PATCH /api/hospitals/me`: Updates hospital readiness status ('READY', 'LIMITED', 'UNAVAILABLE').
 * 6. `POST /api/hospitals/recommend`: Executes the intelligent multi-factor scoring algorithm
 *    to find the fastest and best-equipped hospital for a patient.
 * ==============================================================================
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { auth, type AuthedRequest } from "../middleware/auth.js";
import { recommendHospitals } from "../utils/recommendation.js";
import { emitLive } from "../sockets/index.js";

export const hospitalsRouter = Router();

/**
 * ------------------------------------------------------------------------------
 * GET /api/hospitals
 * ------------------------------------------------------------------------------
 * Returns all hospitals in the system with their real-time beds and doctor rosters.
 */
hospitalsRouter.get("/", auth(), async (_req, res, next) => {
  try {
    const hospitals = await prisma.hospital.findMany({
      include: { beds: true, doctors: { include: { availability: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ hospitals: hospitals.map(shapeHospital), demo: true });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/hospitals/public
 * ------------------------------------------------------------------------------
 * Public endpoint returning minimal hospital names & IDs for registration dropdowns.
 */
hospitalsRouter.get("/public", async (_req, res, next) => {
  try {
    const hospitals = await prisma.hospital.findMany({
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });
    res.json({ hospitals });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/hospitals/staff-mongodb
 * ------------------------------------------------------------------------------
 * Reads hospital staff and facility records directly from MongoDB collection `hospital_staff`.
 */
hospitalsRouter.get("/staff-mongodb", async (_req, res, next) => {
  try {
    const { getHospitalStaffFromMongoDB } = await import("../lib/mongodb.js");
    const staff = await getHospitalStaffFromMongoDB();
    res.json({ ok: true, count: staff.length, staff });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/hospitals/me
 * ------------------------------------------------------------------------------
 * Retrieves the hospital details linked to the current logged-in hospital staff member.
 */
hospitalsRouter.get("/me", auth(), async (req: AuthedRequest, res, next) => {
  try {
    const targetHospitalId = (req.query.hospitalId as string) || req.user?.hospitalId;
    if (!targetHospitalId) {
      const first = await prisma.hospital.findFirst({
        include: { beds: true, doctors: { include: { availability: true } } },
        orderBy: { name: "asc" },
      });
      return res.json({ hospital: first ? shapeHospital(first) : null });
    }
    const hospital = await prisma.hospital.findUnique({
      where: { id: targetHospitalId },
      include: { beds: true, doctors: { include: { availability: true } } },
    });
    res.json({ hospital: hospital ? shapeHospital(hospital) : null });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * PATCH /api/hospitals/me
 * ------------------------------------------------------------------------------
 * Allows hospital staff to update their hospital's readiness status.
 * (e.g. Set to 'LIMITED' or 'UNAVAILABLE' if the emergency ward is completely full).
 */
hospitalsRouter.patch("/me", auth(["HOSPITAL_STAFF"]), async (req: AuthedRequest, res, next) => {
  try {
    if (!req.user?.hospitalId) return res.status(400).json({ error: "No hospital linked" });
    const data = z
      .object({
        name: z.string().min(2).optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        facilities: z.array(z.string()).optional(),
        readinessStatus: z.enum(["READY", "LIMITED", "UNAVAILABLE"]).optional(),
      })
      .parse(req.body);

    const hospital = await prisma.hospital.update({
      where: { id: req.user.hospitalId },
      data: {
        ...data,
        facilities: data.facilities ? JSON.stringify(data.facilities) : undefined,
      },
      include: { beds: true, doctors: { include: { availability: true } } },
    });
    // Broadcast status change so ambulances don't dispatch to an unavailable hospital
    emitLive("hospital:updated", { hospitalId: hospital.id, readinessStatus: hospital.readinessStatus });
    res.json({ hospital: shapeHospital(hospital) });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/hospitals/recommend
 * ------------------------------------------------------------------------------
 * The Brain of the Triage System:
 * Takes the patient's condition (e.g. Heart Attack, Pregnancy, Trauma) and GPS coordinates,
 * then scores and ranks all nearby hospitals to find the fastest, best-equipped choice!
 */
hospitalsRouter.post("/recommend", auth(["AMBULANCE_DRIVER", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const data = z
      .object({
        emergencyType: z.enum(["ROAD_ACCIDENT", "HEART_ATTACK", "PREGNANCY", "OTHER"]),
        latitude: z.number(),
        longitude: z.number(),
      })
      .parse(req.body);

    const hospitals = await prisma.hospital.findMany({
      include: { beds: true, doctors: { include: { availability: true } } },
    });

    // Run the scoring algorithm
    const ranked = recommendHospitals(data.emergencyType, data.latitude, data.longitude, hospitals);
    const suitable = ranked.filter((r) => r.suitable);

    res.json({
      algorithm: "rule-based-suitability-scoring",
      demo: true,
      disclaimer: "Availability is DEMO DATA seeded for the hackathon and is not verified real-world capacity.",
      recommendations: ranked,
      best: suitable[0] || null,
      noneSuitable: suitable.length === 0,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Helper function: Formats raw database hospital objects into clean JSON
 * with facilities parsed from strings into arrays.
 */
function shapeHospital(hospital: {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone: string;
  facilities: string;
  readinessStatus: string;
  traumaCapable: boolean;
  cardiacCapable: boolean;
  maternityCapable: boolean;
  isDemoData: boolean;
  beds: { total: number; available: number } | null;
  doctors: { id: string; name: string; specialization: string; availability: { isAvailable: boolean; shiftNote: string | null } | null }[];
}) {
  return {
    ...hospital,
    facilities: JSON.parse(hospital.facilities || "[]"),
    doctors: hospital.doctors,
  };
}
