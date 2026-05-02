import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });

import { db } from "../src/db";
import { user } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    console.error("ADMIN_EMAIL must be set in .env.local");
    process.exit(1);
  }

  const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing[0]) {
    if (existing[0].role !== "admin") {
      await db.update(user).set({ role: "admin" }).where(eq(user.id, existing[0].id));
      console.log(`Promoted ${email} to admin.`);
    } else {
      console.log(`Admin ${email} already exists — nothing to do.`);
    }
    process.exit(0);
  }

  // Insert directly — Better Auth will manage future sign-ins via magic link
  await db.insert(user).values({
    id: crypto.randomUUID(),
    name: email,
    email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: "admin",
  });

  console.log(`Admin ${email} created. They can now sign in via magic link.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
