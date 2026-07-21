import { env } from "cloudflare:workers";
import { fantasyProsPlayerPointsToCsv } from "./fantasypros-player-points";

export const FANTASYPROS_PLAYER_POINTS_URL =
  "https://api.fantasypros.com/public/v2/json/nfl/2026/player-points?scoring=HALF&start=1&end=17&position=ALL";

export const FANTASYPROS_HALF_PPR_ADP_URL =
  "https://api.fantasypros.com/public/v2/json/nfl/2026/consensus-rankings?position=ALL&scoring=HALF&type=ADP";

export const FANTASYPROS_HALF_PPR_ECR_URL =
  "https://api.fantasypros.com/public/v2/json/nfl/players?ecr=included&show=pos_rank";

function configuredApiKey() {
  return String(env.FANTASYPROS_API_KEY ?? "").trim();
}

export function fantasyProsApiConfigured() {
  return Boolean(configuredApiKey());
}

export async function fetchFantasyProsHalfPprPlayerPoints() {
  const apiKey = configuredApiKey();
  if (!apiKey) throw new Error("FantasyPros API access is not configured.");

  const response = await fetch(FANTASYPROS_PLAYER_POINTS_URL, {
    headers: {
      accept: "application/json",
      "x-api-key": apiKey,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`FantasyPros could not be reached (${response.status}).`);
  }
  const sourceText = await response.text();
  if (sourceText.length > 5 * 1024 * 1024) {
    throw new Error("FantasyPros returned more than 5 MB of scoring data.");
  }
  const payload = JSON.parse(sourceText) as unknown;
  const retrievedAt = new Date().toISOString();
  return {
    sourceText,
    csvText: fantasyProsPlayerPointsToCsv(payload),
    sourceFileName: `fantasypros-api-2026-half-ppr-${retrievedAt.slice(0, 10)}.json`,
    retrievedAt,
  };
}

export async function fetchFantasyProsHalfPprAdp() {
  const apiKey = configuredApiKey();
  if (!apiKey) throw new Error("FantasyPros API access is not configured.");

  const response = await fetch(FANTASYPROS_HALF_PPR_ADP_URL, {
    headers: {
      accept: "application/json",
      "x-api-key": apiKey,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`FantasyPros ADP could not be reached (${response.status}).`);
  }
  const sourceText = await response.text();
  if (sourceText.length > 5 * 1024 * 1024) {
    throw new Error("FantasyPros returned more than 5 MB of ADP data.");
  }
  return {
    sourceText,
    payload: JSON.parse(sourceText) as unknown,
    retrievedAt: new Date().toISOString(),
  };
}

export async function fetchFantasyProsHalfPprEcr() {
  const apiKey = configuredApiKey();
  if (!apiKey) throw new Error("FantasyPros API access is not configured.");

  const response = await fetch(FANTASYPROS_HALF_PPR_ECR_URL, {
    headers: {
      accept: "application/json",
      "x-api-key": apiKey,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`FantasyPros ECR could not be reached (${response.status}).`);
  }
  const sourceText = await response.text();
  if (sourceText.length > 5 * 1024 * 1024) {
    throw new Error("FantasyPros returned more than 5 MB of ECR data.");
  }
  return {
    sourceText,
    payload: JSON.parse(sourceText) as unknown,
    retrievedAt: new Date().toISOString(),
  };
}
