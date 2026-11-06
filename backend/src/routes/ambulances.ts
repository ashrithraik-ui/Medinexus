/**
 * ==============================================================================
 * Ambulance Fleet & Live GPS Telemetry Router (src/routes/ambulances.ts)
 * ==============================================================================
 * This file handles everything related to ambulance vehicles and their live movement:
 * 1. `GET /api/ambulances/me`: Retrieves the logged-in driver's ambulance profile and past dispatch history.
 * 2. `POST /api/ambulances/location`: Receives real-time GPS pings from the moving ambulance.
 *    - Updates the vehicle's position in the database.
 *    - Broadcasts the live pin location to the hospital emergency desk and traffic ops center over WebSockets.
 *    - Automatically feeds coordinates to the Green Corridor engine to turn upcoming traffic lights GREEN!
 * ==============================================================================
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { auth, type AuthedRequest } from "../middleware/auth.js";
import { evaluateGreenCorridor } from "../services/greenCorridor.js";
import { emitLive, emitToEmergency, emitToHospital } from "../sockets/index.js";

export const ambulancesRouter = Router();

/**
 * ------------------------------------------------------------------------------
 * GET /api/ambulances/me
 * ------------------------------------------------------------------------------
 * Purpose: Returns the currently logged-in driver's vehicle details.
 * Security: Only accessible by users with the role 'AMBULANCE_DRIVER'.
 */
ambulancesRouter.get("/me", auth(["AMBULANCE_DRIVER"]), async (req: AuthedRequest, res, next) => {
  try {
    const ambulance = await prisma.ambulance.findUnique({
      where: { userId: req.user!.sub },
      include: {
        emergencies: {
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { patient: true, hospital: true },
        },
      },
    });
    res.json({ ambulance });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/ambulances/location
 * ------------------------------------------------------------------------------
 * Purpose: Receives the ambulance's current GPS location, heading (compass angle),
 * and speed from the driver's phone or vehicle tracking hardware.
 *
 * What happens on every GPS ping:
 * 1. Saves coordinates to the database history log.
 * 2. Broadcasts the new location to all active dashboards in real-time.
 * 3. Evaluates the Green Corridor: If approaching a red traffic light on the route,
 *    it turns that traffic light GREEN ahead of time!
 */
ambulancesRouter.post("/location", auth(["AMBULANCE_DRIVER"]), async (req: AuthedRequest, res, next) => {
  try {
    // Validate the incoming GPS payload format using Zod
    const data = z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        heading: z.number().optional(),
        speedKmh: z.number().optional(),
        emergencyId: z.string().optional(),
        arrived: z.boolean().optional(),
      })
      .parse(req.body);

    // Locate the ambulance profile linked to this authenticated driver
    const ambulance = await prisma.ambulance.findUnique({ where: { userId: req.user!.sub } });
    if (!ambulance) return res.status(404).json({ error: "Ambulance not found" });

    // Update the vehicle's current position and duty status
    await prisma.ambulance.update({
      where: { id: ambulance.id },
      data: { currentLat: data.latitude, currentLng: data.longitude, status: data.arrived ? "IDLE" : "ON_DUTY" },
    });

    // Record this GPS coordinate point into our historical audit log
    await prisma.ambulanceLocation.create({
      data: {
        ambulanceId: ambulance.id,
        emergencyRequestId: data.emergencyId,
        latitude: data.latitude,
        longitude: data.longitude,
        heading: data.heading,
        speedKmh: data.speedKmh,
      },
    });

    // Construct the live telemetry payload to send across WebSockets
    const locationPayload = {
      ambulanceId: ambulance.id,
      vehicleCode: ambulance.vehicleCode,
      emergencyId: data.emergencyId,
      latitude: data.latitude,
      longitude: data.longitude,
      heading: data.heading,
      speedKmh: data.speedKmh,
    };

    // 1. Broadcast to the public operations room
    emitLive("ambulance:location", locationPayload);

    // 2. If this ambulance is currently responding to an active emergency:
    if (data.emergencyId) {
      // Send location directly to subscribers of this emergency ticket
      emitToEmergency(data.emergencyId, "ambulance:location", locationPayload);

      // Also alert the specific hospital emergency desk expecting this patient
      const emergency = await prisma.emergencyRequest.findUnique({ where: { id: data.emergencyId } });
      if (emergency?.hospitalId) emitToHospital(emergency.hospitalId, "ambulance:location", locationPayload);

      // 3. Trigger the Predictive Green Corridor algorithm!
      const corridor = await evaluateGreenCorridor({
        emergencyId: data.emergencyId,
        lat: data.latitude,
        lng: data.longitude,
        arrived: data.arrived,
      });
      return res.json({ ok: true, corridor });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
