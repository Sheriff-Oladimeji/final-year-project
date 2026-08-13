ALTER TABLE "notebooks" ADD COLUMN "topics_extracting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notebooks" ADD COLUMN "topics_extracted_at" timestamp with time zone;