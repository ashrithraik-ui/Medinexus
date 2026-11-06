/**
 * ==============================================================================
 * Global Error Safety Net Middleware (src/middleware/error.ts)
 * ==============================================================================
 * Think of this file like the "Hospital Safety Inspector / Crash Absorber":
 * If any route in the application throws an unexpected error or if a user submits
 * invalid information (like typing an invalid email or negative beds), this file
 * catches the problem cleanly and responds with a helpful, friendly JSON message
 * rather than letting the entire backend crash.
 * ==============================================================================
 */

import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Case 1: Input Validation Error (handled by Zod)
  // For example: A required field was left empty or a number was out of bounds
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
    });
  }

  // Case 2: Unexpected Server Exception
  // Log the technical error details to the terminal for debugging
  console.error("[ServerError]", err);

  const message = err instanceof Error ? err.message : "Unexpected server error";
  return res.status(500).json({ error: message });
}
