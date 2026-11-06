/**
 * ==============================================================================
 * Environment Configuration (src/config/env.ts)
 * ==============================================================================
 * This file reads settings from the `.env` file (like secret keys, port numbers,
 * and distance thresholds) and exports them in a clean, typed JavaScript object.
 *
 * Why this is useful:
 * Instead of searching through code for numbers like "4000" or passwords,
 * everything is centralized here and can be adjusted without rewriting code.
 * ==============================================================================
 */

import dotenv from "dotenv";

// Load values from the .env file on disk into process.env
dotenv.config();

export const env = {
  // The port number where this backend server listens (default: 4000)
  port: Number(process.env.PORT || 4000),

  // The web address of our React frontend. Used by CORS to allow safe browser connections.
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",

  // Secret password used to digitally sign login tokens (JWTs) so they cannot be forged
  jwtSecret: process.env.JWT_SECRET || "lifeline360-dev-secret",

  // How long a user remains logged in before needing to sign in again (default: 12 hours)
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",

  // Green Corridor: Distance (in meters) before an intersection where the light turns green (~350m)
  approachMeters: Number(process.env.GREEN_CORRIDOR_APPROACH_METERS || 350),

  // Green Corridor: Distance (in meters) past an intersection where the light returns to normal cycle (~40m)
  clearMeters: Number(process.env.GREEN_CORRIDOR_CLEAR_METERS || 40),

  // Demo mode flag: Allows simulated ambulance movement and test patients during demonstrations
  demoMode: (process.env.DEMO_MODE || "true") === "true",
};
