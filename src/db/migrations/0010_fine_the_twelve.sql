ALTER TABLE "notebooks" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "notebooks" ADD COLUMN "starter_suggestions" text[] DEFAULT ARRAY[]::text[] NOT NULL;