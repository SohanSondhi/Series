CREATE TABLE "connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"connected_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_user_connection" UNIQUE("user_id","connected_user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"number" varchar(20) NOT NULL,
	"age" integer,
	"location" varchar(200),
	"instagram" varchar(100),
	"twitter" varchar(100),
	"linkedin" varchar(200),
	"profile_picture" text,
	"bio" text DEFAULT '',
	"weekly_recap" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_connected_user_id_users_id_fk" FOREIGN KEY ("connected_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_connection" ON "connections" USING btree ("user_id","connected_user_id");--> statement-breakpoint
CREATE INDEX "idx_users_number" ON "users" USING btree ("number");