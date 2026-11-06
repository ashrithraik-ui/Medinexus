/**
 * ==============================================================================
 * User & Hospital In-App Notification Center Router (src/routes/notifications.ts)
 * ==============================================================================
 * This file powers the in-app alert bell / notification drawer:
 * 1. `GET /api/notifications`: Retrieves historical alert messages sent to the user
 *    (e.g. "Ambulance KA-09-G-2662 en-route to your hospital with ETA 8 mins").
 * 2. `POST /api/notifications/:id/read`: Marks an individual alert as read.
 * ==============================================================================
 */

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { auth, type AuthedRequest } from "../middleware/auth.js";

export const notificationsRouter = Router();

/**
 * ------------------------------------------------------------------------------
 * GET /api/notifications
 * ------------------------------------------------------------------------------
 * Retrieves the latest 40 notifications for the logged-in user or their linked hospital facility.
 */
notificationsRouter.get("/", auth(), async (req: AuthedRequest, res, next) => {
  try {
    const items = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: req.user!.sub },
          req.user!.hospitalId ? { hospitalId: req.user!.hospitalId, userId: null } : undefined,
        ].filter(Boolean) as object[],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    res.json({
      notifications: items.map((n) => ({
        ...n,
        payload: n.payload ? JSON.parse(n.payload) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/notifications/:id/read
 * ------------------------------------------------------------------------------
 * Marks an alert as acknowledged / read when the user clicks on it in the UI.
 */
notificationsRouter.post("/:id/read", auth(), async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
