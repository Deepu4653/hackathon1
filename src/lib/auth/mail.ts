/**
 * Transactional email for the local runtime.
 *
 * Supabase Auth sends its own emails in production. When SMTP_URL is not
 * configured, the app never pretends an email was delivered: it reports back and
 * (only when ALLOW_DEV_RESET_LINK=true) surfaces the reset link in the UI for
 * local development. No secret is ever logged.
 */

import { createTransport, type Transporter } from "nodemailer";
import { serverEnv, publicEnvFallbackAppUrl } from "./mail-env";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!serverEnv.smtpUrl) return null;
  if (!transporter) {
    transporter = createTransport(serverEnv.smtpUrl);
  }
  return transporter;
}

export interface DeliveryResult {
  sent: boolean;
  error?: string;
}

export async function sendPasswordResetEmail(to: string, relativeLink: string): Promise<DeliveryResult> {
  const transport = getTransporter();
  if (!transport) return { sent: false, error: "SMTP_URL is not configured" };

  const link = `${publicEnvFallbackAppUrl()}${relativeLink}`;
  try {
    await transport.sendMail({
      from: serverEnv.mailFrom,
      to,
      subject: "Reset your X-FARM AI password",
      text: `Use this link to set a new password (valid for 1 hour): ${link}`,
      html: `<p>Use the link below to set a new password for your X-FARM AI account. It is valid for 1 hour.</p><p><a href="${link}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });
    return { sent: true };
  } catch (error) {
    console.error("[mail] password reset delivery failed:", error instanceof Error ? error.message : error);
    return { sent: false, error: "Email delivery failed" };
  }
}
