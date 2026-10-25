// Applies db/migrations/*.sql to DATABASE_URL. Run: node --env-file=.env.local scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";
import { readdirSync, readFileSync } from "node:fs";
const sql = neon(process.env.DATABASE_URL);
for (const f of readdirSync("db/migrations").sort()) {
  for (const stmt of readFileSync(`db/migrations/${f}`, "utf8").split(";").map((s) => s.trim()).filter(Boolean)) await sql.query(stmt);
  console.log("applied", f);
}
