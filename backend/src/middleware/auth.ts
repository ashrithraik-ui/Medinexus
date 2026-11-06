/**
 * ==============================================================================
 * Authentication & Security Gatekeeper Middleware (src/middleware/auth.ts)
 * ==============================================================================
 * Think of this file like a "Security Guard checking ID badges" at hospital doors:
 * 1. Checks if the incoming request brought an access badge (the `Bearer <token>` JWT).
 * 2. Verifies that the badge is genuine and hasn't expired.
 * 3. Checks if the person has the right job title / role (e.g. Doctor, Ambulance Driver, or Admin).
 * 4. If everything is valid, it lets them through to the endpoint. Otherwise, it turns them away!
 * ==============================================================================
 */

import type { NextFunction, Request, Response } from "express";
import { verifyToken, type JwtPayload } from "../utils/jwt.js";

// Extend the standard Express Request object so downstream route handlers
// can read `req.user` to know who is making the request (their ID, role, etc.)
export type AuthedRequest = Request & { user?: JwtPayload };

/**
 * auth(requiredRoles)
 * ------------------------------------------------------------------------------
 * Middleware function that protects endpoints:
 * @param requiredRoles (Optional) Array of allowed roles, e.g. ["HOSPITAL_STAFF", "ADMIN"].
 * If omitted, any authenticated user can enter.
 */
export function auth(requiredRoles?: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    // 1. Look for the "Authorization" header sent by the frontend
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    // If no token is provided, return 401 Unauthorized
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      // 2. Cryptographically verify the token signature
      const payload = verifyToken(token);

      // 3. Check role authorization: If the route requires specific roles, make sure the user qualifies
      if (requiredRoles && !requiredRoles.includes(payload.role)) {
        return res.status(403).json({ error: "You do not have access to this resource" });
      }

      // 4. Attach the verified user details to `req.user` for the route to use
      req.user = payload;

      // Everything looks good! Hand control over to the next handler in line
      next();
    } catch {
      // If the token was tampered with or expired past 12 hours
      return res.status(401).json({ error: "Invalid or expired session" });
    }
  };
}
