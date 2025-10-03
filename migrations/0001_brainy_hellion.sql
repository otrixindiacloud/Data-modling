ALTER TABLE "data_models" ADD COLUMN "domain_id" integer;--> statement-breakpoint
ALTER TABLE "data_models" ADD COLUMN "data_area_id" integer;--> statement-breakpoint
ALTER TABLE "data_models" ADD CONSTRAINT "data_models_domain_id_data_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."data_domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_models" ADD CONSTRAINT "data_models_data_area_id_data_areas_id_fk" FOREIGN KEY ("data_area_id") REFERENCES "public"."data_areas"("id") ON DELETE no action ON UPDATE no action;