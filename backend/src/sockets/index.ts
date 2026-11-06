/**
 * ==============================================================================
 * Real-Time WebSocket Communication Hub (src/sockets/index.ts)
 * ==============================================================================
 * What does this file do in plain English?
 * Normal web requests are one-way: The frontend asks for data, and the backend replies.
 * But in an emergency system, that is too slow! If an ambulance moves or an SOS is triggered,
 * the backend must instantly "push" the alert to the hospital screen without waiting.
 *
 * Socket.IO provides a 2-way open connection (like a live walkie-talkie):
 * 1. Authenticates every user connection using their JWT login token.
 * 2. Places users into private virtual "rooms" (channels):
 *    - `hospital:<hospitalId>` -> Only staff at this hospital hear alerts for their facility.
 *    - `ambulance:<ambulanceId>` -> Only this driver receives intake updates.
 *    - `emergency:<emergencyId>` -> Live GPS coordinates of an active emergency run.
 *    - `ops:live` -> Central city-wide traffic operations room.
 * 3. Provides clean helper functions to broadcast events to specific channels.
 * ==============================================================================
 */

import type { Server } from "socket.io";
import { verifyToken } from "../utils/jwt.js";

// Cached reference to the active Socket.IO server instance
let ioRef: Server | null = null;

export function attachSockets(io: Server) {
  ioRef = io;

  // Step 1: Security Gatekeeper for WebSockets
  // Every connecting client must send a valid JWT authentication token
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token || typeof token !== "string") {
        return next(new Error("Authentication required"));
      }
      const payload = verifyToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  // Step 2: Handle New Connections & Room Assignments
  io.on("connection", (socket) => {
    const user = socket.data.user as { sub: string; role: string; hospitalId?: string | null; ambulanceId?: string | null };

    // Join user to their personal notification room
    socket.join(`user:${user.sub}`);
    socket.join(`role:${user.role}`);

    // If this is hospital staff, join them to their hospital's dedicated alert channel
    if (user.hospitalId) socket.join(`hospital:${user.hospitalId}`);

    // If this is an ambulance driver, join them to their vehicle's channel
    if (user.ambulanceId) socket.join(`ambulance:${user.ambulanceId}`);

    // Join the general operations room for live traffic updates
    socket.join("ops:live");

    // Dynamic subscription: Allows dashboards to listen to a specific emergency incident
    socket.on("ops:subscribe", (emergencyId: string) => {
      if (emergencyId) socket.join(`emergency:${emergencyId}`);
    });
  });
}

// --- TARGETED BROADCAST HELPER FUNCTIONS ---

/** Send an event ONLY to staff at a specific hospital */
export function emitToHospital(hospitalId: string, event: string, payload: unknown) {
  ioRef?.to(`hospital:${hospitalId}`).emit(event, payload);
}

/** Send an event ONLY to a specific ambulance driver */
export function emitToAmbulance(ambulanceId: string, event: string, payload: unknown) {
  ioRef?.to(`ambulance:${ambulanceId}`).emit(event, payload);
}

/** Send an event to all screens viewing a specific emergency incident */
export function emitToEmergency(emergencyId: string, event: string, payload: unknown) {
  ioRef?.to(`emergency:${emergencyId}`).emit(event, payload);
}

/** Send an event to all users with a specific role (e.g. all TRAFFIC_CONTROL officers) */
export function emitToRole(role: string, event: string, payload: unknown) {
  ioRef?.to(`role:${role}`).emit(event, payload);
}

/** Broadcast an event to everyone currently in the live operations room */
export function emitLive(event: string, payload: unknown) {
  ioRef?.to("ops:live").emit(event, payload);
}
