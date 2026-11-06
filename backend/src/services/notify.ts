/**
 * ==============================================================================
 * Hospital & Driver Notification Dispatcher Service (src/services/notify.ts)
 * ==============================================================================
 * What does this file do in plain English?
 * When critical events happen (like a driver picking a hospital, or a hospital
 * confirming an intake bed), this service:
 * 1. Saves the notification permanently into the database so the user can see it later in their alert history.
 * 2. Instantly fires a real-time WebSocket ping (`notification:new`) directly to the
 *    recipient's screen (the hospital desk or ambulance driver tablet) so they don't have to refresh!
 * ==============================================================================
 */

import { prisma } from "../lib/prisma.js";
import { emitToAmbulance, emitToHospital, emitLive } from "../sockets/index.js";

/**
 * notifyHospital()
 * ------------------------------------------------------------------------------
 * Sends a notification to all emergency staff members on duty at a specific hospital.
 */
export async function notifyHospital(params: {
  hospitalId: string;
  emergencyId: string;
  title: string;
  body: string;
  type: string;
  payload: unknown;
}) {
  // Find all active staff members working at this hospital
  const staff = await prisma.user.findMany({
    where: { hospitalId: params.hospitalId, role: "HOSPITAL_STAFF", isActive: true },
  });

  // Save a copy of the notification in the database for each staff member
  const records = await Promise.all(
    [null, ...staff.map((s) => s.id)].map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          hospitalId: params.hospitalId,
          emergencyRequestId: params.emergencyId,
          type: params.type,
          title: params.title,
          body: params.body,
          payload: JSON.stringify(params.payload),
        },
      }),
    ),
  );

  const message = records[0];

  // Send an instant real-time pop-up alert to the hospital's screen over WebSockets
  emitToHospital(params.hospitalId, "notification:new", {
    ...message,
    payload: params.payload,
  });

  // Also notify the central operations control room
  emitLive("notification:new", { hospitalId: params.hospitalId, type: params.type, title: params.title });
  return message;
}

/**
 * notifyAmbulance()
 * ------------------------------------------------------------------------------
 * Sends an urgent notification to the driver of a specific ambulance.
 */
export async function notifyAmbulance(params: {
  ambulanceId: string;
  userId: string;
  emergencyId: string;
  title: string;
  body: string;
  type: string;
  payload: unknown;
}) {
  // Save notification in database
  const record = await prisma.notification.create({
    data: {
      userId: params.userId,
      emergencyRequestId: params.emergencyId,
      type: params.type,
      title: params.title,
      body: params.body,
      payload: JSON.stringify(params.payload),
    },
  });

  // Instantly deliver to the driver's screen via WebSocket
  emitToAmbulance(params.ambulanceId, "notification:new", { ...record, payload: params.payload });
  return record;
}
