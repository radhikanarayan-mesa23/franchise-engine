import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;
/** Null when DATABASE_URL is not set; repo then falls back to in-memory storage. */
export function db(): NeonQueryFunction<false, false> | null {
  if (!process.env.DATABASE_URL) return null;
  client ??= neon(process.env.DATABASE_URL);
  return client;
}
