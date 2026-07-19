import { env } from "cloudflare:workers";

export function getD1(): D1Database {
  if (!env.DB) {
    throw new Error("Protected-board storage is unavailable.");
  }
  return env.DB;
}
