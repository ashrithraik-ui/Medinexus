/**
 * ==============================================================================
 * JSON Web Token (JWT) Security Utilities (src/utils/jwt.ts)
 * ==============================================================================
 * What does this file do in plain English?
 * When a user logs in, we don't want them having to type their password on every
 * single click. Instead, we give their browser a "Digital Keycard / Wristband" (a JWT).
 *
 * This keycard contains:
 * - `sub`: User ID
 * - `role`: User's job title (e.g. AMBULANCE_DRIVER, HOSPITAL_STAFF, ADMIN)
 * - `hospitalId` / `ambulanceId`: The facility or vehicle they belong to.
 *
 * It is digitally signed using a secret key (`env.jwtSecret`) so no one can forge
 * or alter their permissions!
 * ==============================================================================
 */

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type JwtPayload = {
  sub: string;
  role: string;
  hospitalId?: string | null;
  ambulanceId?: string | null;
};

/**
 * signToken(payload)
 * ------------------------------------------------------------------------------
 * Generates a signed, encrypted token valid for 12 hours.
 */
export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

/**
 * verifyToken(token)
 * ------------------------------------------------------------------------------
 * Checks the cryptographic signature of the token.
 * If someone tampered with the payload or if 12 hours have passed, this throws an error.
 */
export function verifyToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as JwtPayload & { iat: number; exp: number };
}
