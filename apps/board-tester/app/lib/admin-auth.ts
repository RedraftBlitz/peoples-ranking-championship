import { env } from "cloudflare:workers";

const USER_EMAIL_HEADER = "oai-authenticated-user-email";

export function configuredAdminEmail(): string {
  return String(env.PRC_ADMIN_EMAIL ?? "").trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const configured = configuredAdminEmail();
  return Boolean(configured && email?.trim().toLowerCase() === configured);
}

export function isAdminRequest(request: Request): boolean {
  return isAdminEmail(request.headers.get(USER_EMAIL_HEADER));
}
