/**
 * ==============================================================================
 * Central Emergency SOS Triage & Transit Lifecycle Router (src/routes/emergencies.ts)
 * ==============================================================================
 * This file is the core workflow engine for patient emergencies:
 * 1. `POST /api/emergencies`: Creates a new patient emergency incident and runs the hospital recommendation algorithm.
 * 2. `POST /api/emergencies/:id/select-hospital`: Ambulance driver chooses destination hospital. Triggers audio siren & alerts!
 * 3. `POST /api/emergencies/:id/decision`: Hospital staff Accepts or Rejects/Diverts patient.
 * 4. `POST /api/emergencies/:id/start-transit`: Ambulance begins driving along the green corridor.
 * 5. `POST /api/emergencies/:id/arrive`: Ambulance reaches hospital; all traffic signals unlocked back to normal.
 * 6. `POST /api/emergencies/:id/reset`: Resets simulated emergency run and releases traffic lights.
 * 7. `GET /api/emergencies/latest-dispatch`: Allows hospital desk to auto-sync with incoming ambulance dispatches.
 * ==============================================================================
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { auth, type AuthedRequest } from "../middleware/auth.js";
import { buildCorridorRoute, densifyRoute, estimateMinutes, haversineKm, MYSORE_DEMO_ROUTE } from "../utils/geo.js";
import { recommendHospitals } from "../utils/recommendation.js";
import { notifyAmbulance, notifyHospital } from "../services/notify.js";
import { emitLive, emitToAmbulance, emitToEmergency, emitToHospital, emitToRole } from "../sockets/index.js";
import { publicPatient } from "../utils/sanitize.js";
import { evaluateGreenCorridor } from "../services/greenCorridor.js";

export const emergenciesRouter = Router();

/**
 * ------------------------------------------------------------------------------
 * 1. POST /api/emergencies
 * ------------------------------------------------------------------------------
 * Purpose: Ambulance driver enters patient details (condition, name, age, pickup GPS).
 * The backend creates an emergency incident and returns ranked hospital recommendations.
 */
emergenciesRouter.post("/", auth(["AMBULANCE_DRIVER"]), async (req: AuthedRequest, res, next) => {
  try {
    const data = z
      .object({
        emergencyType: z.enum(["ROAD_ACCIDENT", "HEART_ATTACK", "PREGNANCY", "OTHER"]),
        displayName: z.string().min(2),
        age: z.number().int().min(0).max(120).optional(),
        gender: z.string().optional(),
        notes: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
        pickupAddress: z.string().optional(),
      })
      .parse(req.body);

    const ambulance = await prisma.ambulance.findUnique({ where: { userId: req.user!.sub } });
    if (!ambulance) return res.status(404).json({ error: "Ambulance profile missing" });

    const patient = await prisma.patient.create({
      data: {
        displayName: data.displayName,
        age: data.age,
        gender: data.gender,
        notes: data.notes,
        emergencyType: data.emergencyType,
      },
    });

    const hospitals = await prisma.hospital.findMany({
      include: { beds: true, doctors: { include: { availability: true } } },
    });
    const ranked = recommendHospitals(data.emergencyType, data.latitude, data.longitude, hospitals);
    const best = ranked.find((r) => r.suitable) || null;

    const emergency = await prisma.emergencyRequest.create({
      data: {
        ambulanceId: ambulance.id,
        patientId: patient.id,
        type: data.emergencyType,
        status: "CREATED",
        pickupLat: data.latitude,
        pickupLng: data.longitude,
        pickupAddress: data.pickupAddress || "Mysore pickup (demo)",
        recommendedHospitalId: best?.hospitalId,
        recommendationReasons: JSON.stringify(ranked),
      },
      include: { patient: true, ambulance: true },
    });

    await prisma.ambulance.update({
      where: { id: ambulance.id },
      data: { status: "ON_DUTY", currentLat: data.latitude, currentLng: data.longitude },
    });

    await prisma.systemLog.create({
      data: {
        actorId: req.user!.sub,
        action: "EMERGENCY_CREATED",
        detail: `${data.emergencyType} by ${ambulance.vehicleCode}`,
      },
    });

    res.status(201).json({
      emergency,
      recommendations: ranked,
      best,
      noneSuitable: !best,
      algorithm: "rule-based-suitability-scoring",
      demo: true,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * 2. POST /api/emergencies/:id/select-hospital
 * ------------------------------------------------------------------------------
 * Purpose: The ambulance driver selects a destination hospital from the recommendations.
 * What happens:
 * 1. Calculates the route geometry and estimated arrival time (ETA).
 * 2. Broadcasts a high-priority dispatch event to the hospital emergency desk.
 * 3. Triggers the audible emergency siren on the hospital's dashboard!
 */
emergenciesRouter.post("/:id/select-hospital", auth(["AMBULANCE_DRIVER"]), async (req: AuthedRequest, res, next) => {
  try {
    const { hospitalId } = z.object({ hospitalId: z.string() }).parse(req.body);
    const id = req.params.id as string;
    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { ambulance: { include: { user: true } }, patient: true },
    });
    if (!emergency) return res.status(404).json({ error: "Emergency not found" });
    if (emergency.ambulance.userId !== req.user!.sub) return res.status(403).json({ error: "Not your emergency" });

    const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });

    const allSignals = await prisma.trafficSignal.findMany();
    const distanceKm = haversineKm(emergency.pickupLat, emergency.pickupLng, hospital.latitude, hospital.longitude);
    const etaMinutes = estimateMinutes(distanceKm);
    const keyPoints = buildCorridorRoute(
      emergency.pickupLat,
      emergency.pickupLng,
      hospital.latitude,
      hospital.longitude,
      allSignals
    );
    const route = densifyRoute(keyPoints, 35);

    const updated = await prisma.emergencyRequest.update({
      where: { id: emergency.id },
      data: {
        hospitalId,
        status: "PENDING_HOSPITAL",
        distanceKm,
        etaMinutes,
        routeJson: JSON.stringify(route),
      },
      include: { patient: true, ambulance: { include: { user: true } }, hospital: true },
    });

    const specialist = getRequiredSpecialist(updated.type);
    const driverName = updated.ambulance.user?.name || "Ambulance Driver Sanjay";
    const driverPhone = updated.ambulance.user?.phone || "+91 98765 00001";
    const patientCondition = updated.patient?.notes || `${pretty(updated.type)} emergency reported. Immediate clinical intake requested.`;

    const payload = {
      emergencyId: updated.id,
      type: updated.type,
      ambulanceId: updated.ambulanceId,
      vehicleCode: updated.ambulance.vehicleCode,
      driverName,
      driverPhone,
      requiredSpecialist: specialist,
      patientCondition,
      etaMinutes,
      distanceKm,
      pickupAddress: updated.pickupAddress,
      patient: publicPatient(updated.patient, true),
      demo: true,
    };

    await notifyHospital({
      hospitalId,
      emergencyId: updated.id,
      type: "EMERGENCY_REQUEST",
      title: `Incoming ${pretty(updated.type)} emergency`,
      body: `${updated.ambulance.vehicleCode} (${driverName}) is requesting intake. ETA ${etaMinutes} min. Required specialist: ${specialist}.`,
      payload,
    });

    emitToHospital(hospitalId, "emergency:incoming", payload);
    emitLive("emergency:incoming", {
      ...payload,
      hospitalId,
      hospitalName: hospital.name,
      route,
      emergencyId: updated.id,
    });
    emitLive("ambulance:hospital_selected", {
      emergencyId: updated.id,
      hospitalId,
      hospitalName: hospital.name,
      route,
      ambulance: {
        id: updated.ambulanceId,
        vehicleCode: updated.ambulance.vehicleCode,
        driverName,
        driverPhone,
      },
      patient: updated.patient,
      etaMinutes,
      distanceKm,
    });
    emitLive("emergency:updated", { id: updated.id, status: updated.status, hospitalId });
    emitToRole("TRAFFIC_CONTROL", "emergency:route", {
      emergencyId: updated.id,
      route,
      hospital: { id: hospital.id, name: hospital.name, latitude: hospital.latitude, longitude: hospital.longitude },
      ambulance: {
        id: updated.ambulanceId,
        vehicleCode: updated.ambulance.vehicleCode,
        latitude: emergency.pickupLat,
        longitude: emergency.pickupLng,
      },
    });

    res.json({ emergency: updated, route, demo: true });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * 3. POST /api/emergencies/:id/decision
 * ------------------------------------------------------------------------------
 * Purpose: Hospital staff reviews incoming patient vitals and either Accepts or Diverts.
 */
emergenciesRouter.post("/:id/decision", auth(["HOSPITAL_STAFF"]), async (req: AuthedRequest, res, next) => {
  try {
    const { accept, note } = z.object({ accept: z.boolean(), note: z.string().optional() }).parse(req.body);
    const id = req.params.id as string;
    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { ambulance: true, patient: true, hospital: true },
    });
    if (!emergency) return res.status(404).json({ error: "Emergency not found" });
    if (emergency.hospitalId !== req.user!.hospitalId) return res.status(403).json({ error: "Not assigned to your hospital" });

    const updated = await prisma.emergencyRequest.update({
      where: { id: emergency.id },
      data: {
        status: accept ? "ACCEPTED" : "DECLINED",
        acceptedAt: accept ? new Date() : undefined,
        declinedAt: accept ? undefined : new Date(),
        hospitalReadinessNote: note,
        greenCorridorActive: accept,
      },
      include: { ambulance: true, patient: true, hospital: true },
    });

    if (accept && emergency.hospitalId) {
      const beds = await prisma.emergencyBeds.findUnique({ where: { hospitalId: emergency.hospitalId } });
      if (beds && beds.available > 0) {
        await prisma.emergencyBeds.update({
          where: { hospitalId: emergency.hospitalId },
          data: { available: beds.available - 1 },
        });
      }
    }

    await notifyAmbulance({
      ambulanceId: emergency.ambulanceId,
      userId: emergency.ambulance.userId,
      emergencyId: emergency.id,
      type: accept ? "HOSPITAL_ACCEPTED" : "HOSPITAL_DECLINED",
      title: accept ? "Hospital accepted the request" : "Hospital declined the request",
      body: accept
        ? `${emergency.hospital?.name} is preparing for intake.`
        : `${emergency.hospital?.name} cannot accept this emergency. Coordinate manually.`,
      payload: { emergencyId: emergency.id, status: updated.status, note },
    });

    emitToAmbulance(emergency.ambulanceId, "emergency:decision", { emergencyId: emergency.id, accepted: accept, status: updated.status, note });
    emitToEmergency(emergency.id, "emergency:decision", { accepted: accept, status: updated.status });
    emitLive("emergency:updated", { id: updated.id, status: updated.status });

    res.json({ emergency: updated });
  } catch (err) {
    next(err);
  }
});

emergenciesRouter.post("/:id/assign", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const data = z
      .object({
        doctorName: z.string().optional(),
        specialization: z.string().optional(),
        bay: z.string().optional(),
        note: z.string().optional(),
      })
      .parse(req.body);

    const id = req.params.id as string;
    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { ambulance: true, patient: true, hospital: true },
    });
    if (!emergency) return res.status(404).json({ error: "Emergency not found" });

    const parts = [
      data.doctorName ? `Doctor: ${data.doctorName} (${data.specialization || "Specialist"})` : null,
      data.bay ? `Bay: ${data.bay}` : null,
      data.note ? `Note: ${data.note}` : null,
    ].filter(Boolean);

    const formattedNote = parts.length > 0 ? parts.join(" | ") : emergency.hospitalReadinessNote;

    const updated = await prisma.emergencyRequest.update({
      where: { id },
      data: {
        hospitalReadinessNote: formattedNote,
      },
      include: { ambulance: true, patient: true, hospital: true, history: true },
    });

    emitLive("emergency:updated", {
      id: updated.id,
      status: updated.status,
      hospitalReadinessNote: updated.hospitalReadinessNote,
    });
    emitToAmbulance(emergency.ambulanceId, "emergency:updated", {
      id: updated.id,
      status: updated.status,
      hospitalReadinessNote: updated.hospitalReadinessNote,
    });
    if (emergency.hospitalId) {
      emitToHospital(emergency.hospitalId, "emergency:updated", {
        id: updated.id,
        status: updated.status,
        hospitalReadinessNote: updated.hospitalReadinessNote,
      });
    }

    res.json({ emergency: updated });
  } catch (err) {
    next(err);
  }
});

emergenciesRouter.post("/:id/acknowledge", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { ambulance: { include: { user: true } }, patient: true, hospital: true },
    });
    if (!emergency) return res.status(404).json({ error: "Emergency not found" });

    const updated = await prisma.emergencyRequest.update({
      where: { id },
      data: {
        hospitalReadinessNote: emergency.hospitalReadinessNote
          ? `${emergency.hospitalReadinessNote} | Acknowledged by Hospital Desk`
          : "Acknowledged by Hospital Emergency Desk",
      },
      include: { ambulance: true, patient: true, hospital: true },
    });

    emitToAmbulance(emergency.ambulanceId, "emergency:acknowledged", {
      emergencyId: emergency.id,
      hospitalName: emergency.hospital?.name,
      acknowledgedAt: new Date(),
    });
    emitLive("emergency:updated", { id: updated.id, status: updated.status });

    res.json({ ok: true, message: "Emergency intake request acknowledged", emergency: updated });
  } catch (err) {
    next(err);
  }
});

emergenciesRouter.patch("/:id/patient", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const data = z
      .object({
        displayName: z.string().optional(),
        age: z.number().int().optional(),
        gender: z.string().optional(),
        notes: z.string().optional(),
        clinicalObservation: z.string().optional(),
        assignedDoctor: z.string().optional(),
        assignedBay: z.string().optional(),
        admissionStatus: z.string().optional(),
      })
      .parse(req.body);

    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { patient: true, ambulance: { include: { user: true } }, hospital: true },
    });
    if (!emergency) return res.status(404).json({ error: "Emergency not found" });

    // Update patient record
    let updatedNotes = emergency.patient?.notes || "";
    if (data.notes) {
      updatedNotes = data.notes;
    }
    if (data.clinicalObservation) {
      const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      updatedNotes = updatedNotes
        ? `${updatedNotes}\n[${timeStr} Clinical Note]: ${data.clinicalObservation}`
        : `[${timeStr} Clinical Note]: ${data.clinicalObservation}`;
    }

    if (emergency.patientId) {
      await prisma.patient.update({
        where: { id: emergency.patientId },
        data: {
          displayName: data.displayName || undefined,
          age: data.age || undefined,
          gender: data.gender || undefined,
          notes: updatedNotes,
        },
      });
    }

    // Update emergency request assignment or status if provided
    let readinessNote = emergency.hospitalReadinessNote || "";
    if (data.assignedDoctor || data.assignedBay) {
      const parts = [
        data.assignedDoctor ? `Doctor: ${data.assignedDoctor}` : null,
        data.assignedBay ? `Bay: ${data.assignedBay}` : null,
      ].filter(Boolean);
      readinessNote = parts.join(" | ");
    }

    const updated = await prisma.emergencyRequest.update({
      where: { id },
      data: {
        hospitalReadinessNote: readinessNote || undefined,
        status: (data.admissionStatus as any) || undefined,
      },
      include: { patient: true, ambulance: { include: { user: true } }, hospital: true },
    });

    emitLive("emergency:updated", { id: updated.id, status: updated.status, patient: updated.patient });

    res.json({ ok: true, emergency: updated, message: "Patient record updated successfully" });
  } catch (err) {
    next(err);
  }
});

emergenciesRouter.post("/:id/admit", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { ambulance: true, patient: true, hospital: true, history: true },
    });
    if (!emergency) return res.status(404).json({ error: "Emergency not found" });

    const timeline = [
      { at: emergency.createdAt, event: "Emergency created" },
      emergency.acceptedAt ? { at: emergency.acceptedAt, event: "Hospital accepted" } : null,
      emergency.enRouteAt ? { at: emergency.enRouteAt, event: "En route" } : null,
      { at: new Date(), event: "Admitted to Hospital Emergency Bay" },
    ].filter(Boolean);

    const updated = await prisma.emergencyRequest.update({
      where: { id: emergency.id },
      data: {
        status: "ARRIVED",
        arrivedAt: emergency.arrivedAt || new Date(),
        completedAt: new Date(),
        greenCorridorActive: false,
        history: emergency.history
          ? undefined
          : {
              create: {
                summary: `${pretty(emergency.type)} admitted at ${emergency.hospital?.name || "Hospital"}`,
                timeline: JSON.stringify(timeline),
              },
            },
      },
      include: { hospital: true, patient: true, ambulance: true, history: true },
    });

    const arrival = {
      emergencyId: updated.id,
      status: "ARRIVED",
      hospitalName: updated.hospital?.name,
    };
    if (emergency.hospitalId) emitToHospital(emergency.hospitalId, "emergency:arrived", arrival);
    emitToAmbulance(emergency.ambulanceId, "emergency:arrived", arrival);
    emitLive("emergency:arrived", arrival);
    emitLive("emergency:updated", { id: updated.id, status: "ARRIVED" });

    res.json({ emergency: updated });
  } catch (err) {
    next(err);
  }
});

emergenciesRouter.patch("/:id/patient", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const data = z
      .object({
        displayName: z.string().optional(),
        age: z.number().int().optional(),
        gender: z.string().optional(),
        notes: z.string().optional(),
        clinicalObservation: z.string().optional(),
        assignedDoctor: z.string().optional(),
        assignedBay: z.string().optional(),
        admissionStatus: z.string().optional(),
      })
      .parse(req.body);

    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { patient: true, ambulance: { include: { user: true } }, hospital: true },
    });
    if (!emergency) return res.status(404).json({ error: "Emergency not found" });

    // Update patient record
    let updatedNotes = emergency.patient?.notes || "";
    if (data.notes) {
      updatedNotes = data.notes;
    }
    if (data.clinicalObservation) {
      const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      updatedNotes = updatedNotes
        ? `${updatedNotes}\n[${timeStr} Clinical Note]: ${data.clinicalObservation}`
        : `[${timeStr} Clinical Note]: ${data.clinicalObservation}`;
    }

    if (emergency.patientId) {
      await prisma.patient.update({
        where: { id: emergency.patientId },
        data: {
          displayName: data.displayName || undefined,
          age: data.age || undefined,
          gender: data.gender || undefined,
          notes: updatedNotes,
        },
      });
    }

    // Update emergency request assignment or status if provided
    let readinessNote = emergency.hospitalReadinessNote || "";
    if (data.assignedDoctor || data.assignedBay) {
      const parts = [
        data.assignedDoctor ? `Doctor: ${data.assignedDoctor}` : null,
        data.assignedBay ? `Bay: ${data.assignedBay}` : null,
      ].filter(Boolean);
      readinessNote = parts.join(" | ");
    }

    const updated = await prisma.emergencyRequest.update({
      where: { id },
      data: {
        hospitalReadinessNote: readinessNote || undefined,
        status: (data.admissionStatus as any) || undefined,
      },
      include: { patient: true, ambulance: { include: { user: true } }, hospital: true },
    });

    emitLive("emergency:updated", { id: updated.id, status: updated.status, patient: updated.patient });

    res.json({ ok: true, emergency: updated, message: "Patient record updated successfully" });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * 4. POST /api/emergencies/:id/start-transit
 * ------------------------------------------------------------------------------
 * Purpose: Ambulance begins movement towards the hospital. Activates green corridor mode.
 */
emergenciesRouter.post("/:id/start-transit", auth(["AMBULANCE_DRIVER"]), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { ambulance: true },
    });
    if (!emergency || emergency.ambulance.userId !== req.user!.sub) {
      return res.status(404).json({ error: "Emergency not found" });
    }
    const updated = await prisma.emergencyRequest.update({
      where: { id: emergency.id },
      data: { status: "EN_ROUTE", enRouteAt: new Date(), greenCorridorActive: true },
      include: { hospital: true, patient: true, ambulance: true },
    });
    emitLive("emergency:updated", { id: updated.id, status: "EN_ROUTE" });
    if (updated.hospitalId) emitToHospital(updated.hospitalId, "emergency:updated", { id: updated.id, status: "EN_ROUTE" });
    res.json({ emergency: updated, route: updated.routeJson ? JSON.parse(updated.routeJson) : MYSORE_DEMO_ROUTE });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * 5. POST /api/emergencies/:id/arrive
 * ------------------------------------------------------------------------------
 * Purpose: Ambulance reaches hospital doors.
 * Releases all green corridor traffic signals back to normal cycles.
 */
emergenciesRouter.post("/:id/arrive", auth(["AMBULANCE_DRIVER"]), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { ambulance: true, patient: true, hospital: true },
    });
    if (!emergency || emergency.ambulance.userId !== req.user!.sub) {
      return res.status(404).json({ error: "Emergency not found" });
    }

    await evaluateGreenCorridor({
      emergencyId: emergency.id,
      lat: emergency.hospital?.latitude || emergency.pickupLat,
      lng: emergency.hospital?.longitude || emergency.pickupLng,
      arrived: true,
    });

    const timeline = [
      { at: emergency.createdAt, event: "Emergency created" },
      emergency.acceptedAt ? { at: emergency.acceptedAt, event: "Hospital accepted" } : null,
      emergency.enRouteAt ? { at: emergency.enRouteAt, event: "En route" } : null,
      { at: new Date(), event: "Arrived at hospital" },
    ].filter(Boolean);

    const updated = await prisma.emergencyRequest.update({
      where: { id: emergency.id },
      data: {
        status: "ARRIVED",
        arrivedAt: new Date(),
        completedAt: new Date(),
        greenCorridorActive: false,
        history: {
          create: {
            summary: `${pretty(emergency.type)} transfer completed at ${emergency.hospital?.name || "selected hospital"}`,
            timeline: JSON.stringify(timeline),
          },
        },
      },
      include: { hospital: true, patient: true, ambulance: true, history: true },
    });

    await prisma.ambulance.update({
      where: { id: emergency.ambulanceId },
      data: { status: "IDLE" },
    });

    const arrival = {
      emergencyId: updated.id,
      status: "ARRIVED",
      hospitalName: updated.hospital?.name,
    };
    emitToHospital(emergency.hospitalId || "", "emergency:arrived", arrival);
    emitToAmbulance(emergency.ambulanceId, "emergency:arrived", arrival);
    emitLive("emergency:arrived", arrival);
    emitToRole("TRAFFIC_CONTROL", "emergency:arrived", arrival);

    res.json({ emergency: updated });
  } catch (err) {
    next(err);
  }
});

emergenciesRouter.patch("/:id/patient", auth(["HOSPITAL_STAFF", "ADMIN"]), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const data = z
      .object({
        displayName: z.string().optional(),
        age: z.number().int().optional(),
        gender: z.string().optional(),
        notes: z.string().optional(),
        clinicalObservation: z.string().optional(),
        assignedDoctor: z.string().optional(),
        assignedBay: z.string().optional(),
        admissionStatus: z.string().optional(),
      })
      .parse(req.body);

    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { patient: true, ambulance: { include: { user: true } }, hospital: true },
    });
    if (!emergency) return res.status(404).json({ error: "Emergency not found" });

    // Update patient record
    let updatedNotes = emergency.patient?.notes || "";
    if (data.notes) {
      updatedNotes = data.notes;
    }
    if (data.clinicalObservation) {
      const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      updatedNotes = updatedNotes
        ? `${updatedNotes}\n[${timeStr} Clinical Note]: ${data.clinicalObservation}`
        : `[${timeStr} Clinical Note]: ${data.clinicalObservation}`;
    }

    if (emergency.patientId) {
      await prisma.patient.update({
        where: { id: emergency.patientId },
        data: {
          displayName: data.displayName || undefined,
          age: data.age || undefined,
          gender: data.gender || undefined,
          notes: updatedNotes,
        },
      });
    }

    // Update emergency request assignment or status if provided
    let readinessNote = emergency.hospitalReadinessNote || "";
    if (data.assignedDoctor || data.assignedBay) {
      const parts = [
        data.assignedDoctor ? `Doctor: ${data.assignedDoctor}` : null,
        data.assignedBay ? `Bay: ${data.assignedBay}` : null,
      ].filter(Boolean);
      readinessNote = parts.join(" | ");
    }

    const updated = await prisma.emergencyRequest.update({
      where: { id },
      data: {
        hospitalReadinessNote: readinessNote || undefined,
        status: (data.admissionStatus as any) || undefined,
      },
      include: { patient: true, ambulance: { include: { user: true } }, hospital: true },
    });

    emitLive("emergency:updated", { id: updated.id, status: updated.status, patient: updated.patient });

    res.json({ ok: true, emergency: updated, message: "Patient record updated successfully" });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * 6. POST /api/emergencies/:id/reset
 * ------------------------------------------------------------------------------
 * Purpose: Resets the simulation run and restores all traffic lights.
 */
emergenciesRouter.post("/:id/reset", auth(["AMBULANCE_DRIVER"]), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { ambulance: true, patient: true, hospital: true },
    });
    if (!emergency || emergency.ambulance.userId !== req.user!.sub) {
      return res.status(404).json({ error: "Emergency not found" });
    }

    await evaluateGreenCorridor({
      emergencyId: emergency.id,
      lat: emergency.pickupLat,
      lng: emergency.pickupLng,
      reset: true,
    });

    const updated = await prisma.emergencyRequest.update({
      where: { id: emergency.id },
      data: {
        status: "ACCEPTED",
        greenCorridorActive: false,
      },
      include: { hospital: true, patient: true, ambulance: true },
    });

    await prisma.ambulance.update({
      where: { id: emergency.ambulanceId },
      data: {
        currentLat: emergency.pickupLat,
        currentLng: emergency.pickupLng,
        status: "ON_DUTY",
      },
    });

    emitLive("emergency:updated", { id: updated.id, status: "ACCEPTED" });
    if (updated.hospitalId) emitToHospital(updated.hospitalId, "emergency:updated", { id: updated.id, status: "ACCEPTED" });
    res.json({ ok: true, emergency: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * 7. GET /api/emergencies/latest-dispatch
 * ------------------------------------------------------------------------------
 * Purpose: Allows the Hospital Dashboard to immediately lock onto whichever hospital
 * the ambulance driver selected in Step 3 on /ambulance, syncing route and SOS data.
 */
emergenciesRouter.get("/latest-dispatch", auth(), async (_req: AuthedRequest, res, next) => {
  try {
    const latest = await prisma.emergencyRequest.findFirst({
      where: {
        status: { in: ["PENDING_HOSPITAL", "ACCEPTED", "EN_ROUTE", "ARRIVED"] },
        hospitalId: { not: null },
      },
      include: {
        hospital: { include: { beds: true, doctors: { include: { availability: true } } } },
        ambulance: { include: { user: true } },
        patient: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!latest || !latest.hospital) {
      return res.json({ activeDispatch: null });
    }

    const route = latest.routeJson ? JSON.parse(latest.routeJson) : [];

    res.json({
      activeDispatch: {
        emergencyId: latest.id,
        hospitalId: latest.hospitalId,
        hospitalName: latest.hospital.name,
        hospital: {
          ...latest.hospital,
          facilities: JSON.parse(latest.hospital.facilities || "[]"),
          doctors: latest.hospital.doctors,
        },
        route,
        ambulance: {
          id: latest.ambulance.id,
          vehicleCode: latest.ambulance.vehicleCode,
          driverName: latest.ambulance.user?.name || "Ambulance Driver Sanjay",
          driverPhone: latest.ambulance.user?.phone || "+91 98765 00001",
        },
        patient: latest.patient,
        status: latest.status,
        etaMinutes: latest.etaMinutes,
        distanceKm: latest.distanceKm,
        patientCondition: latest.patient?.notes || `${pretty(latest.type)} emergency reported.`,
        requiredSpecialist: getRequiredSpecialist(latest.type),
      },
    });
  } catch (err) {
    next(err);
  }
});

emergenciesRouter.get("/active", auth(), async (req: AuthedRequest, res, next) => {
  try {
    const role = req.user!.role;
    const targetHospitalId = req.query.hospitalId as string;

    let where: any;
    if (role === "AMBULANCE_DRIVER") {
      where = { ambulance: { userId: req.user!.sub }, status: { notIn: ["COMPLETED", "CANCELLED"] } };
    } else if (targetHospitalId) {
      where = { hospitalId: targetHospitalId };
    } else if (role === "HOSPITAL_STAFF") {
      where = req.user!.hospitalId
        ? { hospitalId: req.user!.hospitalId }
        : { status: { in: ["PENDING_HOSPITAL", "ACCEPTED", "EN_ROUTE", "ARRIVED"] } };
    } else {
      where = { status: { in: ["PENDING_HOSPITAL", "ACCEPTED", "EN_ROUTE", "ARRIVED"] } };
    }

    const list = await prisma.emergencyRequest.findMany({
      where,
      include: { ambulance: { include: { user: true } }, hospital: true, patient: true, history: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    const canSeePhi = role === "AMBULANCE_DRIVER" || role === "HOSPITAL_STAFF" || role === "ADMIN";
    res.json({
      emergencies: list.map((e) => ({
        ...e,
        driverName: e.ambulance?.user?.name || "Ambulance Driver Sanjay",
        driverPhone: e.ambulance?.user?.phone || "+91 98765 00001",
        requiredSpecialist: getRequiredSpecialist(e.type),
        patientCondition: e.patient?.notes || `${pretty(e.type)} emergency reported. Priority trauma dispatch requested.`,
        patient: publicPatient(e.patient, canSeePhi),
        route: e.routeJson ? JSON.parse(e.routeJson) : [],
        recommendations: safeJson(e.recommendationReasons),
      })),
    });
  } catch (err) {
    next(err);
  }
});

emergenciesRouter.get("/:id", auth(), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const emergency = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { ambulance: { include: { user: true } }, hospital: true, patient: true, history: true, priorities: { include: { signal: true } } },
    });
    if (!emergency) return res.status(404).json({ error: "Not found" });
    const role = req.user!.role;
    const allowed =
      role === "ADMIN" ||
      role === "TRAFFIC_CONTROL" ||
      emergency.ambulance.userId === req.user!.sub ||
      emergency.hospitalId === req.user!.hospitalId;
    if (!allowed) return res.status(403).json({ error: "Restricted" });
    const canSeePhi = role !== "TRAFFIC_CONTROL";
    res.json({
      emergency: {
        ...emergency,
        driverName: emergency.ambulance?.user?.name || "Ambulance Driver Sanjay",
        driverPhone: emergency.ambulance?.user?.phone || "+91 98765 00001",
        requiredSpecialist: getRequiredSpecialist(emergency.type),
        patientCondition: emergency.patient?.notes || `${pretty(emergency.type)} emergency reported. Priority trauma dispatch requested.`,
        patient: publicPatient(emergency.patient, canSeePhi),
        route: emergency.routeJson ? JSON.parse(emergency.routeJson) : [],
        recommendations: safeJson(emergency.recommendationReasons),
      },
    });
  } catch (err) {
    next(err);
  }
});

function pretty(code: string) {
  return code.toLowerCase().replaceAll("_", " ");
}

function getRequiredSpecialist(code: string): string {
  if (code === "HEART_ATTACK") return "Cardiologist & Cath Lab Specialist";
  if (code === "ROAD_ACCIDENT") return "Orthopedic Surgeon & Trauma Specialist";
  if (code === "PREGNANCY") return "Gynecologist & Obstetrician";
  return "Emergency Medicine Specialist";
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function buildRoute(fromLat: number, fromLng: number, toLat: number, toLng: number): [number, number][] {
  const demoEnd = MYSORE_DEMO_ROUTE[MYSORE_DEMO_ROUTE.length - 1];
  const nearDemoStart = Math.abs(fromLat - MYSORE_DEMO_ROUTE[0][0]) < 0.02 && Math.abs(fromLng - MYSORE_DEMO_ROUTE[0][1]) < 0.02;
  const nearDemoEnd = Math.abs(toLat - demoEnd[0]) < 0.02 && Math.abs(toLng - demoEnd[1]) < 0.02;
  if (nearDemoStart && nearDemoEnd) return MYSORE_DEMO_ROUTE;
  return [
    [fromLat, fromLng],
    [(fromLat + toLat) / 2 + 0.004, (fromLng + toLng) / 2 - 0.003],
    [toLat, toLng],
  ];
}
