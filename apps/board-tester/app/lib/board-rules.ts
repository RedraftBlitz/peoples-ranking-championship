export const BOARD_SEASON = 2026;

export function normalizeBoardName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}
export function boardNameKey(value: string) {
  return normalizeBoardName(value).toLocaleLowerCase("en-US");
}

export function validateBoardName(value: string) {
  const normalized = normalizeBoardName(value);
  if (normalized.length < 3 || normalized.length > 30) {
    return "Board Name must be 3–30 characters.";
  }
  if (!/[\p{L}\p{N}]/u.test(normalized)) {
    return "Board Name must contain a letter or number.";
  }
  if (!/^[\p{L}\p{N} ._'’-]+$/u.test(normalized)) {
    return "Board Name contains an unsupported character.";
  }
  return null;
}

export function validatePin(value: string) {
  return /^\d{6}$/.test(value) ? null : "PIN must contain exactly six digits.";
}

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function validateEmail(value: string, required = false) {
  if (required && !value) return "Email is required.";
  if (!value) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? null
    : "Enter a valid email address.";
}

export function validateEmailCode(value: string) {
  return /^\d{6}$/.test(value)
    ? null
    : "Verification code must contain exactly six digits.";
}

export function validateBoardStateAgainstEligibleIds(
  order: unknown,
  personalIds: unknown,
  eligibleValues: Iterable<string>,
) {
  const eligibleIds = new Set(eligibleValues);
  if (
    !Array.isArray(order) ||
    order.length !== eligibleIds.size ||
    new Set(order).size !== eligibleIds.size ||
    !order.every((id) => typeof id === "string" && eligibleIds.has(id))
  ) {
    return "The player order is incomplete or contains a duplicate.";
  }

  if (
    !Array.isArray(personalIds) ||
    new Set(personalIds).size !== personalIds.length ||
    !personalIds.every(
      (id) => typeof id === "string" && eligibleIds.has(id),
    )
  ) {
    return "Personal Rankings contain an invalid player.";
  }

  return null;
}
