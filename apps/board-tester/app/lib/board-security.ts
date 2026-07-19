const encoder = new TextEncoder();
const PIN_ITERATIONS = 120_000;
const SESSION_DAYS = 30;

function toHex(bytes: ArrayBuffer | Uint8Array) {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toHex(bytes);
}

export function createPinSalt() {
  return randomToken(16);
}

export async function hashPin(pin: string, saltHex: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map((value) => Number.parseInt(value, 16)) ?? [],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PIN_ITERATIONS,
    },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashToken(token: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
}

export function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function createSession() {
  const token = randomToken();
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  return { token, expiresAt };
}

export function createRecoveryToken() {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  return { token, expiresAt };
}

export function readSessionToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === "prc_board_session") return value.join("=");
  }
  return null;
}

export function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `prc_board_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${secure}`;
}
