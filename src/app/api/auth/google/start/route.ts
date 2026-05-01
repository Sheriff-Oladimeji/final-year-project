import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAuthUrl } from "@/lib/auth/google";
import { randomBytes } from "crypto";

export async function GET() {
  // Generate a random CSRF state token and store it in a short-lived cookie.
  // On callback we verify Google echoed the same value back.
  const state = randomBytes(32).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes — plenty of time to complete OAuth
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
