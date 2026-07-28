import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { db } from "@/db";
import * as schema from "@/db/schema";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Fully separate Better Auth instance for admins. Physically independent
// table set (adminUser/adminSession/adminAccount/adminVerification) and a
// distinct cookie prefix so a browser can hold an admin session and a
// student session at the same time without either clobbering the other.
// Admin accounts are never self-registered — the only way a row appears
// here is the one-time /admin/setup page (src/app/admin/setup).
export const adminAuth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  basePath: "/api/auth/admin",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user:         schema.adminUser,
      session:      schema.adminSession,
      account:      schema.adminAccount,
      verification: schema.adminVerification,
    },
  }),

  advanced: {
    cookiePrefix: "admin-auth",
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: "LearnAI <noreply@learnly.brikta.dev>",
        to: user.email,
        subject: "Reset your LearnAI admin password",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="margin-bottom:8px">Reset your admin password</h2>
            <p style="color:#555;margin-bottom:24px">Click the button below to choose a new password. This link expires in an hour.</p>
            <a href="${url}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">Reset password</a>
            <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this, ignore this email.</p>
          </div>
        `,
      });
    },
  },
});

export type AdminAuth = typeof adminAuth;
