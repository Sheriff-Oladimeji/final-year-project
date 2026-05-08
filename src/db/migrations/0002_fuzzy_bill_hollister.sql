ALTER TABLE "interactions" ADD COLUMN "material_id" uuid;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interactions_material_id_idx" ON "interactions" USING btree ("material_id");