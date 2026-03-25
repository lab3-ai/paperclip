ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'guest' NOT NULL;
--> statement-breakpoint
UPDATE "user" SET "role" = 'superadmin' WHERE "id" IN (SELECT "user_id" FROM "instance_user_roles" WHERE "role" = 'instance_admin');