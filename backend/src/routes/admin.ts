/**
 * ==============================================================================
 * Master System Administration Router (src/routes/admin.ts)
 * ==============================================================================
 * This file contains administrative endpoints used by city operators and system admins.
 * Access is strictly locked to users with the 'ADMIN' role.
 *
 * Capabilities:
 * 1. `GET /api/admin/overview`: System-wide counts of ambulances, hospitals, and active runs.
 * 2. `GET /api/admin/users`: Lists all users registered on the platform.
 * 3. `PATCH /api/admin/users/:id`: Activates/deactivates accounts or changes roles.
 * 4. `POST /api/admin/users`: Allows admins to provision new accounts directly.
 * 5. `GET /api/admin/hospitals` & `PATCH /api/admin/hospitals/:id`: Manages hospital facilities.
 * 6. `GET /api/admin/ambulances` & `PATCH /api/admin/ambulances/:id`: Manages emergency vehicle fleet.
 * 7. `GET /api/admin/emergencies`: Audit trail of all active and resolved emergency tickets.
 * ==============================================================================
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { auth } from "../middleware/auth.js";

export const adminRouter = Router();

// Protect ALL routes in this file: Only users with the 'ADMIN' role are allowed through!
adminRouter.use(auth(["ADMIN"]));

/**
 * ------------------------------------------------------------------------------
 * GET /api/admin/overview
 * ------------------------------------------------------------------------------
 * Aggregates high-level platform statistics for the administrator dashboard:
 * - Total ambulances registered
 * - Total hospitals connected
 * - Total emergency incidents (historical + active)
 * - Recent system audit logs
 */
adminRouter.get("/overview", async (_req, res, next) => {
  try {
    const [ambulances, hospitals, emergencies, active, users, logs] = await Promise.all([
      prisma.ambulance.count(),
      prisma.hospital.count(),
      prisma.emergencyRequest.count(),
      prisma.emergencyRequest.count({ where: { status: { in: ["CREATED", "PENDING_HOSPITAL", "ACCEPTED", "EN_ROUTE"] } } }),
      prisma.user.count(),
      prisma.systemLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    const hospitalAvailability = await prisma.hospital.findMany({
      include: { beds: true },
      orderBy: { name: "asc" },
    });
    res.json({
      totals: { ambulances, hospitals, emergencies, active, users },
      hospitalAvailability,
      logs,
      demo: true,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/admin/users
 * ------------------------------------------------------------------------------
 * Lists all registered user accounts with their role and active status.
 */
adminRouter.get("/users", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: { ambulance: true, hospital: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        hospital: u.hospital?.name,
        ambulance: u.ambulance?.vehicleCode,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * PATCH /api/admin/users/:id
 * ------------------------------------------------------------------------------
 * Enables or disables a user account (e.g. suspending a driver or revoking staff access).
 */
adminRouter.patch("/users/:id", async (req, res, next) => {
  try {
    const data = z.object({ isActive: z.boolean().optional(), role: z.string().optional() }).parse(req.body);
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ user: { id: user.id, role: user.role, isActive: user.isActive } });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/admin/users
 * ------------------------------------------------------------------------------
 * Allows an administrator to manually create an account.
 */
adminRouter.post("/users", async (req, res, next) => {
  try {
    const data = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string(),
        role: z.enum(["ADMIN", "AMBULANCE_DRIVER", "HOSPITAL_STAFF", "TRAFFIC_CONTROL"]),
        hospitalId: z.string().optional(),
      })
      .parse(req.body);
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: await bcrypt.hash(data.password, 10),
        name: data.name,
        role: data.role,
        hospitalId: data.hospitalId,
      },
    });
    res.status(201).json({ user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/admin/hospitals & PATCH /api/admin/hospitals/:id
 * ------------------------------------------------------------------------------
 * View and edit hospital facility configurations.
 */
adminRouter.get("/hospitals", async (_req, res, next) => {
  try {
    const hospitals = await prisma.hospital.findMany({ include: { beds: true } });
    res.json({ hospitals });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/hospitals/:id", async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().optional(),
        readinessStatus: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
      })
      .parse(req.body);
    const hospital = await prisma.hospital.update({ where: { id: req.params.id }, data });
    res.json({ hospital });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/admin/ambulances & PATCH /api/admin/ambulances/:id
 * ------------------------------------------------------------------------------
 * View and edit emergency vehicle fleet statuses.
 */
adminRouter.get("/ambulances", async (_req, res, next) => {
  try {
    const ambulances = await prisma.ambulance.findMany({ include: { user: true } });
    res.json({
      ambulances: ambulances.map((a) => ({
        id: a.id,
        vehicleCode: a.vehicleCode,
        status: a.status,
        driver: a.user.name,
        email: a.user.email,
        currentLat: a.currentLat,
        currentLng: a.currentLng,
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/ambulances/:id", async (req, res, next) => {
  try {
    const data = z.object({ status: z.string().optional(), vehicleCode: z.string().optional() }).parse(req.body);
    const ambulance = await prisma.ambulance.update({ where: { id: req.params.id }, data });
    res.json({ ambulance });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/admin/emergencies
 * ------------------------------------------------------------------------------
 * Audit trail of all historical emergency dispatches, intake decisions, and timestamps.
 */
adminRouter.get("/emergencies", async (_req, res, next) => {
  try {
    const emergencies = await prisma.emergencyRequest.findMany({
      include: { ambulance: true, hospital: true, patient: true, history: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ emergencies });
  } catch (err) {
    next(err);
  }
});
