const VISITOR_COOKIE = "prc_visitor";
const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

const PUBLIC_PATHS = new Set([
  "/",
  "/faq",
  "/how-it-works",
  "/official-rules",
  "/privacy",
  "/prizes",
  "/random-draw",
  "/random-draw/results",
  "/scoring",
  "/scoring/complete",
]);

export function trackedPublicPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim().split("?")[0]?.replace(/\/$/, "") || "/";
  if (PUBLIC_PATHS.has(path)) return path;
  if (/^\/boards\/[a-z0-9-]+$/i.test(path)) return "/boards/shared";
  return null;
}

export function mountainDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Traffic date could not be resolved.");
  return `${year}-${month}-${day}`;
}

export function mountainDateKeyDaysAgo(days: number, date = new Date()): string {
  const today = mountainDateKey(date);
  const noonUtc = new Date(`${today}T12:00:00.000Z`);
  noonUtc.setUTCDate(noonUtc.getUTCDate() - Math.max(0, Math.floor(days)));
  return mountainDateKey(noonUtc);
}

export function isLikelyBot(userAgent: string): boolean {
  return /bot|crawler|spider|slurp|headless|preview|facebookexternalhit|twitterbot|discordbot|slackbot|whatsapp|googlebot|bingbot/i.test(
    userAgent,
  );
}

export function visitorIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const [name, ...valueParts] = pair.trim().split("=");
    if (name !== VISITOR_COOKIE) continue;
    const value = decodeURIComponent(valueParts.join("="));
    return /^[a-f0-9-]{32,40}$/i.test(value) ? value : null;
  }
  return null;
}

export function visitorCookie(value: string): string {
  return `${VISITOR_COOKIE}=${encodeURIComponent(value)}; Max-Age=${VISITOR_COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
