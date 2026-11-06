/**
 * ==============================================================================
 * Real Email OTP Verification Service (src/services/otp.ts)
 * ==============================================================================
 * What does this file do in plain English?
 * When a driver or hospital staff signs up, we need to prove that their email
 * address is real and belongs to them.
 *
 * This file:
 * 1. Generates a secure, random 6-digit number (e.g. 583921).
 * 2. Connects to Google's Gmail SMTP server using Nodemailer.
 * 3. Sends a professionally styled HTML verification email with the 6-digit code.
 * 4. Stores the code in memory with a 10-minute countdown timer.
 * 5. Verifies the code when the user types it into the registration form.
 * 6. If email credentials aren't set up, it provides a safe local backup code
 *    so developers can continue testing without getting stuck.
 * ==============================================================================
 */

import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";

type OtpData = {
  code: string;
  expiresAt: number;
  verified: boolean;
};

// In-memory temporary cache to hold active OTPs (keyed by lowercase email)
const otpStore = new Map<string, OtpData>();

/**
 * createTransporter()
 * ------------------------------------------------------------------------------
 * Reads email credentials (EMAIL_USER and EMAIL_PASS) from `backend/.env`
 * and creates a secure connection to Google Gmail's mail servers.
 */
function createTransporter() {
  // Reload .env so changes in credentials take effect immediately without needing server restart
  dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });

  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || "").trim();
  const rawPass = (process.env.EMAIL_PASS || process.env.SMTP_PASS || "").trim();
  // Strip spaces from Google App Passwords (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
  const pass = rawPass.replace(/\s+/g, "");
  const host = process.env.SMTP_HOST || (user.includes("@gmail") ? "smtp.gmail.com" : undefined);
  const port = Number(process.env.SMTP_PORT || (host === "smtp.gmail.com" ? 465 : 587));

  if (user && pass) {
    return nodemailer.createTransport({
      host: host || "smtp.gmail.com",
      port,
      secure: port === 465, // SSL encryption on port 465
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return null;
}

/**
 * sendOtpEmail(email, name)
 * ------------------------------------------------------------------------------
 * Generates a fresh 6-digit code, sets a 10-minute expiration,
 * and sends an email to the recipient.
 */
export async function sendOtpEmail(
  email: string,
  name?: string
): Promise<{ success: boolean; realEmailSent: boolean; error?: string; localOtp?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  // Generate a random 6-digit number between 100000 and 999999
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // Valid for exactly 10 minutes

  // Save the code in memory
  otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    verified: false,
  });

  const transporter = createTransporter();
  const driverName = name ? name.trim() : "Ambulance Driver";

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.EMAIL_USER || `"LIFELINE 360 Emergency" <no-reply@lifeline360.demo>`,
    to: normalizedEmail,
    subject: `LIFELINE 360 Verification Code: ${code}`,
    text: `Hello ${driverName},\n\nYour LIFELINE 360 ambulance driver verification OTP code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0284c7; margin: 0; font-size: 22px;">LIFELINE 360</h2>
          <p style="color: #64748b; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Smart Emergency Response System</p>
        </div>
        <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; text-align: center;">
          <p style="color: #334155; font-size: 14px; margin: 0 0 12px 0;">Hello <strong>${driverName}</strong>,</p>
          <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0;">Your one-time verification code (OTP) for Ambulance Driver registration is:</p>
          <div style="display: inline-block; background-color: #ffffff; border: 2px dashed #0284c7; border-radius: 10px; padding: 12px 28px; margin-bottom: 12px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0 0;">This code is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 20px;">If you did not request this verification, please ignore this email.</p>
      </div>
    `,
  };

  // If email credentials are not yet configured in .env, print to terminal as backup
  if (!transporter) {
    console.warn(`[OTP] NOTICE: EMAIL_USER and EMAIL_PASS are not configured in backend/.env. Real outbound email requires SMTP credentials.`);
    console.log(`[OTP Console Backup] Real OTP generated for ${normalizedEmail} is: ${code}`);
    return {
      success: true,
      realEmailSent: false,
      localOtp: code,
    };
  }

  // Attempt to deliver the email through Gmail SMTP
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[OTP] Real email successfully sent to ${normalizedEmail} (MessageId: ${info.messageId})`);
    return {
      success: true,
      realEmailSent: true,
    };
  } catch (err: any) {
    console.error(`[OTP Error] Failed to send email to ${normalizedEmail}:`, err?.message || err);
    console.log(`[OTP Console Backup] Real OTP generated for ${normalizedEmail} is: ${code}`);

    let userMsg = `Could not deliver email: ${err?.message || String(err)}.`;
    if (err?.code === "EAUTH" || String(err).includes("535")) {
      userMsg = `Google SMTP rejected login (535 BadCredentials). Please ensure EMAIL_USER (${process.env.EMAIL_USER}) matches the exact Google account where the 16-character App Password was generated at myaccount.google.com/apppasswords.`;
    }

    return {
      success: false,
      realEmailSent: false,
      error: userMsg,
      localOtp: code,
    };
  }
}

/**
 * verifyOtpCode(email, enteredCode)
 * ------------------------------------------------------------------------------
 * Compares the user's typed code with the code stored in memory.
 * Checks for expiration (10 minutes).
 */
export function verifyOtpCode(email: string, enteredCode: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  const entry = otpStore.get(normalizedEmail);

  if (!entry) return false;
  // If the 10-minute timer ran out
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalizedEmail);
    return false;
  }

  // If the digits match exactly
  if (entry.code.trim() === enteredCode.trim()) {
    entry.verified = true;
    return true;
  }

  return false;
}

/**
 * isEmailVerified(email)
 * ------------------------------------------------------------------------------
 * Returns true if this email has successfully passed OTP verification.
 */
export function isEmailVerified(email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  return otpStore.get(normalizedEmail)?.verified ?? false;
}

/**
 * clearVerifiedEmail(email)
 * ------------------------------------------------------------------------------
 * Removes the email from the temporary OTP cache once registration is completed.
 */
export function clearVerifiedEmail(email: string) {
  otpStore.delete(email.toLowerCase().trim());
}
