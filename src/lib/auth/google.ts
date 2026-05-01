// Direct HTTP calls to Google OAuth endpoints — no Authlib or next-auth needed.
// Matches the approach used in the original FastAPI backend.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope:         "openid email profile",
    state,
    access_type:   "online",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{ id_token: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
      grant_type:    "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to exchange OAuth code: ${body}`);
  }

  return res.json();
}

export async function getUserInfo(idToken: string): Promise<{ sub: string; email: string }> {
  const res = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${idToken}`);

  if (!res.ok) {
    throw new Error("Failed to verify id_token");
  }

  const data = await res.json();

  if (!data.sub || !data.email) {
    throw new Error("Missing sub or email in Google id_token");
  }

  return { sub: data.sub, email: data.email };
}
