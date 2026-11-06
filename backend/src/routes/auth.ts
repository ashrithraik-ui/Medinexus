/**
 * ==============================================================================
 * User Authentication & Registration Router (src/routes/auth.ts)
 * ==============================================================================
 * This file is the "Front Desk" for all users of the LIFELINE 360 system:
 * 1. `POST /api/auth/send-otp`: Sends a real 6-digit verification code to the driver's or staff's email.
 * 2. `POST /api/auth/verify-otp`: Checks if the code typed by the user matches what was emailed.
 * 3. `POST /api/auth/register`: Creates new user accounts.
 *    - For Ambulance Drivers: Generates vehicle registration codes and saves to MongoDB.
 *    - For Hospital Staff: Records hospital facility name, phone, bed count, and doctor specialties to MongoDB.
 * 4. `POST /api/auth/login`: Checks email and password (using bcrypt hashing) and issues a 12-hour login token.
 * 5. `GET /api/auth/me`: Returns the current user's profile and linked ambulance/hospital information.
 * ==============================================================================
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../utils/jwt.js";
import { auth, type AuthedRequest } from "../middleware/auth.js";
import { saveDriverToMongoDB, saveHospitalStaffToMongoDB, saveHospitalToMongoDB } from "../lib/mongodb.js";
import { clearVerifiedEmail, isEmailVerified, sendOtpEmail, verifyOtpCode } from "../services/otp.js";

export const authRouter = Router();

// Zod Schema: Defines the required and optional fields when someone registers
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(["AMBULANCE_DRIVER", "HOSPITAL_STAFF", "TRAFFIC_CONTROL"]),
  phone: z.string().optional(),
  hospitalId: z.string().optional(),
  hospitalName: z.string().optional(),
  hospitalPhone: z.string().optional(),
  numberOfBeds: z.number().or(z.string()).optional(),
  doctors: z.string().or(z.array(z.string())).optional(),
  newHospitalName: z.string().optional(),
  newHospitalAddress: z.string().optional(),
  newHospitalCity: z.string().optional(),
  newHospitalPhone: z.string().optional(),
  newHospitalBeds: z.number().or(z.string()).optional(),
  vehicleCode: z.string().optional(),
  otp: z.string().optional(),
});

/**
 * ------------------------------------------------------------------------------
 * 1. POST /api/auth/send-otp
 * ------------------------------------------------------------------------------
 * Generates and emails a 6-digit verification code to ensure the user owns the email address.
 * Uses real Google Gmail SMTP (configured in backend/.env).
 */
authRouter.post("/send-otp", async (req, res, next) => {
  try {
    const { email, name } = z
      .object({ email: z.string().email(), name: z.string().optional() })
      .parse(req.body);

    // Make sure the email isn't already registered
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return res.status(409).json({ error: "Email is already registered. Please login instead." });
    }

    // Call the OTP service to send an email via Nodemailer
    const result = await sendOtpEmail(email, name);
    if (!result.success) {
      return res.status(400).json({
        error: `${result.error} (Backup verification code: ${result.localOtp})`,
      });
    }

    if (result.realEmailSent) {
      return res.json({
        ok: true,
        realEmailSent: true,
        message: `A verification OTP code has been sent to ${email}. Please check your email inbox.`,
      });
    } else {
      return res.json({
        ok: true,
        realEmailSent: false,
        message: `NOTICE: Real outbound email requires EMAIL_USER & EMAIL_PASS in backend/.env. For testing now, your verification code is: ${result.localOtp}`,
        code: result.localOtp,
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * 2. POST /api/auth/verify-otp
 * ------------------------------------------------------------------------------
 * Checks the 6-digit OTP code entered by the user against the memory store.
 */
authRouter.post("/verify-otp", async (req, res, next) => {
  try {
    const { email, otp } = z
      .object({ email: z.string().email(), otp: z.string().min(4) })
      .parse(req.body);

    const valid = verifyOtpCode(email, otp);
    if (!valid) {
      return res.status(400).json({ error: "Invalid or expired verification OTP." });
    }

    res.json({ ok: true, verified: true, message: "Email successfully verified." });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * 3. POST /api/auth/register
 * ------------------------------------------------------------------------------
 * Completes user registration:
 * - Creates user account in Prisma (SQLite).
 * - Hashes password using bcrypt (passwords are never saved in plain text).
 * - If Ambulance Driver: Creates an ambulance profile and saves record to MongoDB `ambulance_drivers`.
 * - If Hospital Staff: Creates or links a hospital, seeds doctors/beds, and saves record to MongoDB `hospital_staff` & `hospitals`.
 */
authRouter.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const normalizedEmail = data.email.toLowerCase().trim();

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    let finalHospitalId = data.hospitalId;

    // --- CASE A: Registering Hospital Staff with a brand new hospital facility ---
    if (data.role === "HOSPITAL_STAFF") {
      if (data.newHospitalName && data.newHospitalName.trim()) {
        const hName = data.newHospitalName.trim();
        const hCity = data.newHospitalCity?.trim() || "Bangalore";
        const isMysore = hCity.toLowerCase().includes("mysore");
        const baseLat = isMysore ? 12.3118 : 12.9592;
        const baseLng = isMysore ? 76.6509 : 77.6200;
        const lat = Number((baseLat + (Math.random() - 0.5) * 0.03).toFixed(4));
        const lng = Number((baseLng + (Math.random() - 0.5) * 0.03).toFixed(4));
        const hAddress = data.newHospitalAddress?.trim() || `${hName}, ${hCity}`;
        const hPhone = data.newHospitalPhone?.trim() || data.phone?.trim() || "080-25000000";
        const bedsTotal = Number(data.newHospitalBeds) || 12;
        const bedsAvail = Math.max(1, Math.floor(bedsTotal * 0.6));

        // Create the hospital in SQLite
        const createdHospital = await prisma.hospital.create({
          data: {
            name: hName,
            address: hAddress,
            city: hCity,
            latitude: lat,
            longitude: lng,
            phone: hPhone,
            facilities: JSON.stringify(["Level-1 Trauma Bay", "Cardiac Care Unit", "Emergency OT", "Blood Bank", "ICU"]),
            traumaCapable: true,
            cardiacCapable: true,
            maternityCapable: true,
            readinessStatus: "READY",
            isDemoData: false,
            beds: {
              create: {
                total: bedsTotal,
                available: bedsAvail,
              },
            },
          },
          include: { beds: true },
        });

        finalHospitalId = createdHospital.id;

        // Store the newly created Hospital in MongoDB collection `hospitals`
        await saveHospitalToMongoDB({
          hospitalId: createdHospital.id,
          name: createdHospital.name,
          address: createdHospital.address,
          city: createdHospital.city,
          latitude: createdHospital.latitude,
          longitude: createdHospital.longitude,
          phone: createdHospital.phone,
          facilities: ["Level-1 Trauma Bay", "Cardiac Care Unit", "Emergency OT", "Blood Bank", "ICU"],
          traumaCapable: true,
          cardiacCapable: true,
          maternityCapable: true,
          readinessStatus: "READY",
          beds: { total: bedsTotal, available: bedsAvail },
          registeredAt: createdHospital.createdAt,
        }).catch((err) => console.error("[MongoDB] New hospital sync error:", err));
      } else if (!data.hospitalId) {
        return res.status(400).json({ error: "Hospital staff must select or register a hospital" });
      }
    }

    // --- CASE B: Require Email Verification for Drivers and Staff ---
    if (data.role === "AMBULANCE_DRIVER" || data.role === "HOSPITAL_STAFF") {
      const isVerified = isEmailVerified(normalizedEmail) || (data.otp && verifyOtpCode(normalizedEmail, data.otp));
      if (!isVerified) {
        return res.status(400).json({ error: "Please verify your email with the OTP code sent to your email." });
      }
    }

    // Save the User record in SQLite (with a securely salted password hash)
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(data.password, 10),
        name: data.name.trim(),
        role: data.role,
        phone: data.phone?.trim() || null,
        hospitalId: data.role === "HOSPITAL_STAFF" ? finalHospitalId : null,
      },
    });

    let ambulanceId: string | null = null;
    let vehicleCode = data.vehicleCode || `KA-09-G-${Math.floor(1000 + Math.random() * 8999)}`;

    // --- CASE C: Post-Registration Setup for Ambulance Drivers ---
    if (data.role === "AMBULANCE_DRIVER") {
      const ambulance = await prisma.ambulance.create({
        data: {
          userId: user.id,
          vehicleCode,
          isDemoData: true,
        },
      });
      ambulanceId = ambulance.id;
      vehicleCode = ambulance.vehicleCode;

      // Store Driver in MongoDB collection `ambulance_drivers`
      await saveDriverToMongoDB({
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        vehicleCode,
        registeredAt: user.createdAt,
      }).catch((err) => console.error("[MongoDB] Sync error:", err));

      clearVerifiedEmail(normalizedEmail);
    }
    // --- CASE D: Post-Registration Setup for Hospital Staff ---
    else if (data.role === "HOSPITAL_STAFF" && finalHospitalId) {
      const hospital = await prisma.hospital.findUnique({
        where: { id: finalHospitalId },
        include: { beds: true, doctors: true },
      });

      const effectiveHospName = data.hospitalName?.trim() || data.newHospitalName?.trim() || hospital?.name || "Hospital Facility";
      const effectiveHospPhone = data.hospitalPhone?.trim() || data.newHospitalPhone?.trim() || data.phone?.trim() || hospital?.phone || "080-25000000";
      const effectiveBeds = Number(data.numberOfBeds || data.newHospitalBeds) || hospital?.beds?.total || 15;
      const effectiveDocs =
        (typeof data.doctors === "string" ? data.doctors.trim() : Array.isArray(data.doctors) ? data.doctors.join(", ") : "") ||
        (hospital?.doctors?.map((d) => `${d.name} (${d.specialization})`).join(", ")) ||
        "Dr. Rajesh (Cardiology), Dr. Priya (Trauma & Emergency)";

      // If doctor names were provided during registration, insert them into SQLite Doctors table
      if (typeof data.doctors === "string" && data.doctors.trim()) {
        const docNames = data.doctors.split(",").map((d) => d.trim()).filter(Boolean);
        for (const docStr of docNames) {
          const spec = docStr.toLowerCase().includes("card")
            ? "Cardiologist"
            : docStr.toLowerCase().includes("ortho") || docStr.toLowerCase().includes("trauma")
            ? "Orthopedic Surgeon"
            : "Emergency Medicine Specialist";
          await prisma.doctor.create({
            data: {
              hospitalId: finalHospitalId,
              name: docStr.replace(/\(.*?\)/g, "").trim() || docStr,
              specialization: spec,
              phone: effectiveHospPhone,
              isDemoData: false,
            },
          }).catch(() => {});
        }
      }

      // 1. Store Staff & Facility details in MongoDB collection `hospital_staff`
      await saveHospitalStaffToMongoDB({
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || effectiveHospPhone,
        role: user.role,
        hospitalId: finalHospitalId,
        hospitalName: effectiveHospName,
        hospitalPhone: effectiveHospPhone,
        numberOfBeds: effectiveBeds,
        doctors: effectiveDocs,
        registeredAt: user.createdAt,
      }).catch((err) => console.error("[MongoDB] Hospital staff sync error:", err));

      // 2. Also ensure Hospital Facility is saved in MongoDB collection `hospitals`
      await saveHospitalToMongoDB({
        hospitalId: finalHospitalId,
        name: effectiveHospName,
        address: hospital?.address || `${effectiveHospName}, Bangalore`,
        city: hospital?.city || "Bangalore",
        latitude: hospital?.latitude || 12.9592,
        longitude: hospital?.longitude || 77.6200,
        phone: effectiveHospPhone,
        facilities: hospital?.facilities || ["Level-1 Trauma Bay", "Cath Lab", "ICU", "Blood Bank"],
        traumaCapable: true,
        cardiacCapable: true,
        maternityCapable: true,
        readinessStatus: "READY",
        beds: { total: effectiveBeds, available: Math.max(1, Math.floor(effectiveBeds * 0.6)) },
        numberOfBeds: effectiveBeds,
        doctors: effectiveDocs,
        registeredAt: hospital?.createdAt || user.createdAt,
      }).catch((err) => console.error("[MongoDB] Hospital facility sync error:", err));

      clearVerifiedEmail(normalizedEmail);
    }

    // Generate signed JWT token so the user is immediately logged in
    const token = signToken({
      sub: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
      ambulanceId,
    });

    res.status(201).json({
      token,
      user: serializeUser(user, ambulanceId),
      message:
        data.role === "HOSPITAL_STAFF"
          ? "Hospital administrator registered successfully."
          : "Ambulance driver registered successfully.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * 4. POST /api/auth/login
 * ------------------------------------------------------------------------------
 * Verifies email and password, then returns a signed JWT token for session auth.
 */
authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { ambulance: true },
    });

    // If user does not exist or account was deactivated by admin
    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

    // Compare plain-text password with the stored cryptographic hash
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // Generate signed JWT token
    const token = signToken({
      sub: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
      ambulanceId: user.ambulance?.id ?? null,
    });

    res.json({ token, user: serializeUser(user, user.ambulance?.id ?? null) });
  } catch (err) {
    next(err);
  }
});

/**
 * ------------------------------------------------------------------------------
 * 5. GET /api/auth/me
 * ------------------------------------------------------------------------------
 * Returns the current authenticated user's profile and linked assets.
 */
authRouter.get("/me", auth(), async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      include: { ambulance: true, hospital: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      user: {
        ...serializeUser(user, user.ambulance?.id ?? null),
        hospital: user.hospital
          ? { id: user.hospital.id, name: user.hospital.name, readinessStatus: user.hospital.readinessStatus }
          : null,
        ambulance: user.ambulance
          ? {
              id: user.ambulance.id,
              vehicleCode: user.ambulance.vehicleCode,
              status: user.ambulance.status,
              currentLat: user.ambulance.currentLat,
              currentLng: user.ambulance.currentLng,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Helper function: Strips sensitive password hashes from user objects
 * before sending them to the frontend browser.
 */
function serializeUser(user: { id: string; email: string; name: string; role: string; hospitalId: string | null; phone: string | null }, ambulanceId: string | null) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hospitalId: user.hospitalId,
    phone: user.phone,
    ambulanceId,
  };
}
