import { config } from "dotenv";
import { join } from "path";

// Load .env.local before anything else
config({ path: join(process.cwd(), ".env.local") });

import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local");
    process.exit(1);
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    console.log(`Admin ${email} already exists — nothing to do.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ email, passwordHash, role: "admin" });
  console.log(`Admin ${email} created.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
