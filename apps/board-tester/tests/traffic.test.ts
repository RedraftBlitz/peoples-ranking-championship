import assert from "node:assert/strict";
import test from "node:test";
import {
  isLikelyBot,
  mountainDateKey,
  mountainDateKeyDaysAgo,
  trackedPublicPath,
  visitorCookie,
  visitorIdFromCookie,
} from "../app/lib/traffic.ts";

test("tracks only public PRC pages and groups shared Board tokens", () => {
  assert.equal(trackedPublicPath("/"), "/");
  assert.equal(trackedPublicPath("/scoring/"), "/scoring");
  assert.equal(trackedPublicPath("/boards/abc123-token"), "/boards/shared");
  assert.equal(trackedPublicPath("/admin"), null);
  assert.equal(trackedPublicPath("/api/leaderboard"), null);
  assert.equal(trackedPublicPath("/not-a-real-page"), null);
});

test("uses Mountain Time day boundaries and rolling date keys", () => {
  assert.equal(mountainDateKey(new Date("2026-08-02T05:30:00.000Z")), "2026-08-01");
  assert.equal(mountainDateKey(new Date("2026-08-02T06:30:00.000Z")), "2026-08-02");
  assert.equal(mountainDateKeyDaysAgo(6, new Date("2026-08-02T18:00:00.000Z")), "2026-07-27");
});

test("keeps the anonymous visitor value first-party and rejects malformed cookies", () => {
  const visitorId = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(visitorIdFromCookie(`other=1; prc_visitor=${visitorId}`), visitorId);
  assert.equal(visitorIdFromCookie("prc_visitor=not-valid"), null);
  assert.match(visitorCookie(visitorId), /HttpOnly; Secure; SameSite=Lax/);
});

test("filters common crawlers from the public traffic count", () => {
  assert.equal(isLikelyBot("Mozilla/5.0 Chrome/140 Safari/537.36"), false);
  assert.equal(isLikelyBot("Googlebot/2.1"), true);
  assert.equal(isLikelyBot("facebookexternalhit/1.1"), true);
});
