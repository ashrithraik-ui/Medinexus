/**
 * ==============================================================================
 * LIFELINE 360 - Central Backend Server Entry Point (src/index.ts)
 * ==============================================================================
 * This is the main starting point of the entire backend application.
 * Think of this file like the "reception desk and electrical grid" of a hospital:
 * 1. It turns on the Express web server to receive HTTP requests from users.
 * 2. It sets up WebSockets (Socket.IO) for real-time live GPS & audio sirens.
 * 3. It applies security shields (Helmet & CORS) so only allowed apps can connect.
 * 4. It routes incoming requests to the appropriate department (Auth, Hospitals, Ambulances, etc.).
 * 5. It starts the automated green corridor traffic light simulation.
 * 6. It connects to MongoDB to store and backup hospital staff and driver records.
 * ==============================================================================
 */

import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler } from "./middleware/error.js";
import { attachSockets } from "./sockets/index.js";

// Import all API Route Handlers (Department Managers)
import { authRouter } from "./routes/auth.js";
import { hospitalsRouter } from "./routes/hospitals.js";
import { doctorsRouter } from "./routes/doctors.js";
import { bedsRouter } from "./routes/beds.js";
import { ambulancesRouter } from "./routes/ambulances.js";
import { emergenciesRouter } from "./routes/emergencies.js";
import { trafficRouter } from "./routes/traffic.js";
import { notificationsRouter } from "./routes/notifications.js";
import { adminRouter } from "./routes/admin.js";

// Import Database & Service initializers
import {
  connectMongoDB,
  ensureMongoDBServer,
  syncAllUsersToMongoDB,
  syncAllHospitalsToMongoDB,
  getMongoDBStatus,
} from "./lib/mongodb.js";
import { startTrafficSignalCycling } from "./services/trafficCycle.js";

// Create the main Express application instance
const app = express();

// --- SECURITY & BODY PARSING MIDDLEWARES ---
// Helmet: Sets secure HTTP headers to protect against common web vulnerabilities
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS (Cross-Origin Resource Sharing): Allows the React frontend (running on port 5173) to communicate with this backend (on port 4000)
app.use(cors({ origin: env.clientOrigin, credentials: true }));

// Express JSON Parser: Reads incoming data sent in JSON format (up to 1 megabyte per request)
app.use(express.json({ limit: "1mb" }));

// --- SYSTEM HEALTH & STATUS CHECKS ---
// Health Check Endpoint: Lets external monitors or developers verify that the backend is alive
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "LIFELINE 360",
    demo: env.demoMode,
    safety: "Traffic priority is simulated and is not connected to public signal infrastructure.",
  });
});

// MongoDB Status Endpoint: Returns live connection status and document counts for staff, hospitals & drivers
app.get("/api/mongodb/status", async (_req, res) => {
  const status = await getMongoDBStatus();
  res.json(status);
});

// --- REGISTER API ROUTE DEPARTMENTS ---
// When a browser or app makes a request to a URL starting with one of these paths,
// Express forwards it to the dedicated router file:
app.use("/api/auth", authRouter);                   // Login, Registration & Email OTP verification
app.use("/api/hospitals", hospitalsRouter);         // Hospital details, staff roster & search
app.use("/api/doctors", doctorsRouter);             // Specialist doctor on-duty/off-duty statuses
app.use("/api/beds", bedsRouter);                   // ICU and emergency bed count updates
app.use("/api/ambulances", ambulancesRouter);       // Ambulance driver profiles & live GPS tracking
app.use("/api/emergencies", emergenciesRouter);     // SOS triage, patient dispatch & intake approvals
app.use("/api/traffic", trafficRouter);             // Traffic signal lights along the corridor
app.use("/api/notifications", notificationsRouter); // User alert history & message center
app.use("/api/admin", adminRouter);                 // Admin management panel & system audits

// Global Error Handler: Catches any unexpected crashes or bad inputs and returns clean error messages
app.use(errorHandler);

// --- WEBSOCKET & SERVER INITIALIZATION ---
// Create a standard Node.js HTTP server wrapping the Express app
const server = http.createServer(app);

// Attach Socket.IO to enable bidirectional, real-time communication (e.g. live ambulance pins on map)
const io = new Server(server, {
  cors: { origin: env.clientOrigin, credentials: true },
});
attachSockets(io);

// Start listening for incoming traffic on the configured port (default: 4000)
server.listen(env.port, () => {
  console.log(`LIFELINE 360 API running on http://localhost:${env.port}`);

  // 1. Start the automated background traffic light cycle (Red -> Green -> Yellow)
  startTrafficSignalCycling();

  // 2. Connect to MongoDB (port 27017) and synchronize hospital staff & driver records
  connectMongoDB()
    .then(async () => {
      await syncAllUsersToMongoDB();
      await syncAllHospitalsToMongoDB();
    })
    .catch((err) => console.warn("[MongoDB] Startup notice:", err));
});

// Graceful Shutdown: When the server is stopped (Ctrl+C / SIGINT), cleanly disconnect Prisma database client
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
