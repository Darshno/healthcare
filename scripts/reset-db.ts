import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("No DATABASE_URL found in environment; skipping DB SQL reset.");
    process.exit(0);
  }

  console.log("Connecting to database via pg Client...");
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log("Connected successfully. Resetting database...");

    await client.query(`DROP TABLE IF EXISTS "facility_memberships" CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS "facilities" CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS "facility" CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS "facility_membership" CASCADE;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "hospitals" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "name" varchar(255) NOT NULL,
        "language" "defaultLanguage" DEFAULT 'en' NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.query(`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE;`);
    await client.query(`TRUNCATE TABLE "patients" RESTART IDENTITY CASCADE;`);
    await client.query(`TRUNCATE TABLE "queue_entries" RESTART IDENTITY CASCADE;`);
    await client.query(`TRUNCATE TABLE "teleconsult_sessions" RESTART IDENTITY CASCADE;`);
    await client.query(`TRUNCATE TABLE "triage_results" RESTART IDENTITY CASCADE;`);
    await client.query(`TRUNCATE TABLE "sync_operations" RESTART IDENTITY CASCADE;`);
    await client.query(`TRUNCATE TABLE "beds" RESTART IDENTITY CASCADE;`);
    await client.query(`TRUNCATE TABLE "hospital_units" RESTART IDENTITY CASCADE;`);
    await client.query(`TRUNCATE TABLE "bed_occupancy" RESTART IDENTITY CASCADE;`);

    console.log("Database reset completed cleanly!");
  } catch (err) {
    console.error("Database reset warning/error:", err);
  } finally {
    await client.end();
  }

  process.exit(0);
}

main();
