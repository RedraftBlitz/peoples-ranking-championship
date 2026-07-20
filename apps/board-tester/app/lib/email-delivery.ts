import { env } from "cloudflare:workers";

const DEFAULT_FROM = "PRC <no-reply@updates.redraftblitz.com>";

function configuredApiKey() {
  return String(env.RESEND_API_KEY ?? "").trim();
}

function configuredFrom() {
  return String(env.RESEND_FROM_EMAIL ?? DEFAULT_FROM).trim() || DEFAULT_FROM;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function emailDeliveryConfigured() {
  return Boolean(configuredApiKey());
}

export function submissionEmailVerificationRequired() {
  const explicitlyRequired =
    String(env.PRC_EMAIL_VERIFICATION_REQUIRED ?? "").trim().toLowerCase() ===
    "true";
  return explicitlyRequired || emailDeliveryConfigured();
}

async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = configuredApiKey();
  if (!apiKey) throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: configuredFrom(),
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) throw new Error("EMAIL_DELIVERY_FAILED");
}

export async function sendSubmissionVerificationEmail(input: {
  to: string;
  boardName: string;
  code: string;
}) {
  const boardName = escapeHtml(input.boardName);
  const code = escapeHtml(input.code);
  await sendEmail({
    to: input.to,
    subject: "Verify your email for your PRC Board",
    text: `Your verification code for ${input.boardName} is ${input.code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;color:#10272b;line-height:1.55"><p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#087d79">People's Ranking Championship</p><h1 style="font-family:Georgia,serif;font-size:26px">Verify your email</h1><p>Use this code to verify the contact email for <strong>${boardName}</strong>:</p><p style="font-size:30px;font-weight:800;letter-spacing:.2em">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
  });
}

export async function sendPinResetEmail(input: {
  to: string;
  boardName: string;
  code: string;
}) {
  const boardName = escapeHtml(input.boardName);
  const code = escapeHtml(input.code);
  await sendEmail({
    to: input.to,
    subject: "Reset your PRC Board PIN",
    text: `Your PIN reset code for ${input.boardName} is ${input.code}. It expires in 10 minutes. Your old PIN cannot be viewed or emailed.`,
    html: `<div style="font-family:Arial,sans-serif;color:#10272b;line-height:1.55"><p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#087d79">People's Ranking Championship</p><h1 style="font-family:Georgia,serif;font-size:26px">Reset your Board PIN</h1><p>Use this code to choose a new PIN for <strong>${boardName}</strong>:</p><p style="font-size:30px;font-weight:800;letter-spacing:.2em">${code}</p><p>This code expires in 10 minutes. Your old PIN cannot be viewed or emailed.</p></div>`,
  });
}

export async function sendRandomDrawVerificationEmail(input: {
  to: string;
  code: string;
}) {
  const code = escapeHtml(input.code);
  await sendEmail({
    to: input.to,
    subject: "Verify your free PRC Random Draw entry",
    text: `Your PRC Random Draw verification code is ${input.code}. It expires in 10 minutes. No purchase or Board is required. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;color:#10272b;line-height:1.55"><p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#087d79">People's Ranking Championship</p><h1 style="font-family:Georgia,serif;font-size:26px">Verify your free Random Draw entry</h1><p>Use this code to complete your entry:</p><p style="font-size:30px;font-weight:800;letter-spacing:.2em">${code}</p><p>This code expires in 10 minutes. No purchase, payment, or completed Board is required.</p></div>`,
  });
}
