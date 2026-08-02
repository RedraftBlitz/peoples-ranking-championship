import { getD1 } from "../../../db/d1";
import {
  isLikelyBot,
  mountainDateKey,
  sha256Hex,
  trackedPublicPath,
  visitorCookie,
  visitorIdFromCookie,
} from "../../lib/traffic";

export async function POST(request: Request) {
  try {
    const userAgent = request.headers.get("user-agent") ?? "";
    if (!userAgent || isLikelyBot(userAgent)) return new Response(null, { status: 204 });

    const payload = await request.json().catch(() => null) as { path?: unknown } | null;
    const path = trackedPublicPath(payload?.path);
    if (!path) return new Response(null, { status: 204 });

    const existingVisitorId = visitorIdFromCookie(request.headers.get("cookie"));
    const visitorId = existingVisitorId ?? crypto.randomUUID();
    const visitorHash = await sha256Hex(visitorId);
    const viewedAt = new Date().toISOString();

    await getD1()
      .prepare(
        `INSERT INTO traffic_daily
          (day, path, visitor_hash, view_count, first_viewed_at, last_viewed_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?4)
         ON CONFLICT(day, path, visitor_hash) DO UPDATE SET
           view_count = traffic_daily.view_count + 1,
           last_viewed_at = excluded.last_viewed_at`,
      )
      .bind(mountainDateKey(), path, visitorHash, viewedAt)
      .run();

    const headers = new Headers({ "cache-control": "no-store" });
    if (!existingVisitorId) headers.set("set-cookie", visitorCookie(visitorId));
    return new Response(null, { status: 204, headers });
  } catch {
    // Traffic measurement must never interfere with the public contest experience.
    return new Response(null, { status: 204 });
  }
}
