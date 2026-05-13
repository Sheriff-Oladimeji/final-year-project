CREATE TABLE "notebooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interactions" RENAME COLUMN "material_id" TO "notebook_id";--> statement-breakpoint
ALTER TABLE "topics" RENAME COLUMN "material_id" TO "notebook_id";--> statement-breakpoint
ALTER TABLE "interactions" DROP CONSTRAINT "interactions_material_id_materials_id_fk";
--> statement-breakpoint
ALTER TABLE "topics" DROP CONSTRAINT "topics_material_id_materials_id_fk";
--> statement-breakpoint
DROP INDEX "interactions_material_id_idx";--> statement-breakpoint
DROP INDEX "uq_topics_user_material_name";--> statement-breakpoint
DROP INDEX "topics_material_id_idx";--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "notebook_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notebooks_user_id_idx" ON "notebooks" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interactions_notebook_id_idx" ON "interactions" USING btree ("notebook_id");--> statement-breakpoint
CREATE INDEX "materials_notebook_id_idx" ON "materials" USING btree ("notebook_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_topics_user_notebook_name" ON "topics" USING btree ("user_id","notebook_id","name");--> statement-breakpoint
CREATE INDEX "topics_notebook_id_idx" ON "topics" USING btree ("notebook_id");
