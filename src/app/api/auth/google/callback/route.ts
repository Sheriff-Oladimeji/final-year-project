import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, getUserInfo } from "@/lib/auth/google";
import { getSession } from "@/lib/auth/session";
import { findByGoogleSub, createStudent } from "@/db/queries/users";
import { createSession } from "@/db/queries/sessions";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cookieStore = await cookies();

  // ── CSRF check ──────────────────────────────────────────────────────────────
  const stateFromGoogle = searchParams.get("state");
  const stateFromCookie = cookieStore.get("oauth_state")?.value;

  if (!stateFromGoogle || !stateFromCookie || stateFromGoogle !== stateFromCookie) {
    return NextResponse.redirect(new URL("/?error=oauth_state", request.nextUrl.origin));
  }

  // Clear the temporary state cookie immediately
  cookieStore.delete("oauth_state");

  // ── Code exchange ───────────────────────────────────────────────────────────
  const code = searchParams.get("code");
  if (!code) {
    const error = searchParams.get("error") ?? "unknown";
    return NextResponse.redirect(new URL(`/?error=${error}`, request.nextUrl.origin));
  }

  let googleSub: string;
  let email: string;

  try {
    const tokenData = await exchangeCode(code);
    const userInfo = await getUserInfo(tokenData.id_token);
    googleSub = userInfo.sub;
    email = userInfo.email;
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.nextUrl.origin));
  }

  // ── Upsert user ─────────────────────────────────────────────────────────────
  let user = await findByGoogleSub(googleSub);
  if (!user) {
    user = await createStudent({ googleSub, email });
  }

  if (user.disabledAt) {
    return NextResponse.redirect(new URL("/?error=account_disabled", request.nextUrl.origin));
  }

  // ── Create DB session row ───────────────────────────────────────────────────
  const dbSession = await createSession(user.id);

  // ── Set iron-session cookie ─────────────────────────────────────────────────
  const session = await getSession();
  session.userId = user.id;
  session.role = user.role as "student" | "admin";
  session.sessionId = dbSession.id;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));
}
