DROP INDEX "uq_topics_user_name";--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "material_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_topics_user_material_name" ON "topics" USING btree ("user_id","material_id","name");--> statement-breakpoint
CREATE INDEX "topics_material_id_idx" ON "topics" USING btree ("material_id");