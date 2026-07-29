export const NFL_TEAMS = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
] as const;

export type NflTeam = (typeof NFL_TEAMS)[number];
export type MetricKey = "dstPointsAllowed" | "yardsPerPlay" | "pffOffense" | "epaPerPlay";
export type PasteMode = "ranked" | "csv";
export type MetricRanks = Partial<Record<NflTeam, number>>;

export const TEAM_NAMES: Record<NflTeam, string> = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  LV: "Las Vegas Raiders",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
};

export const METRICS: Array<{
  key: MetricKey;
  label: string;
  shortLabel: string;
  description: string;
  direction: "higher-easier" | "lower-easier";
  defaultWeight: number;
}> = [
  {
    key: "dstPointsAllowed",
    label: "Fantasy points allowed to DST",
    shortLabel: "DST points allowed",
    description: "More points allowed means an easier offense to target.",
    direction: "higher-easier",
    defaultWeight: 2,
  },
  {
    key: "yardsPerPlay",
    label: "Offensive yards per play",
    shortLabel: "Yards per play",
    description: "Fewer yards per play means an easier offense to target.",
    direction: "lower-easier",
    defaultWeight: 1,
  },
  {
    key: "pffOffense",
    label: "PFF offensive grade",
    shortLabel: "PFF offense",
    description: "A lower offensive grade means an easier offense to target.",
    direction: "lower-easier",
    defaultWeight: 1,
  },
  {
    key: "epaPerPlay",
    label: "Offensive EPA per play",
    shortLabel: "EPA per play",
    description: "A lower EPA per play means an easier offense to target.",
    direction: "lower-easier",
    defaultWeight: 1,
  },
];

export type ParseResult = {
  ranks: MetricRanks;
  recognized: number;
  missing: NflTeam[];
  duplicates: NflTeam[];
  unrecognized: string[];
};

function normalize(value: string) {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const aliases = new Map<string, NflTeam>();

function addAliases(team: NflTeam, ...values: string[]) {
  for (const value of values) aliases.set(normalize(value), team);
}

for (const team of NFL_TEAMS) {
  const fullName = TEAM_NAMES[team];
  const nickname = fullName.split(" ").at(-1) ?? fullName;
  addAliases(team, team, fullName, nickname);
}

addAliases("ARI", "AZ", "ARZ", "Arizona");
addAliases("BAL", "Baltimore");
addAliases("GB", "Green Bay");
addAliases("JAX", "JAC", "Jacksonville");
addAliases("KC", "Kansas City");
addAliases("LAC", "LA Chargers", "Los Angeles Chargers", "Chargers");
addAliases("LAR", "LA Rams", "Los Angeles Rams", "Rams");
addAliases("LV", "Las Vegas", "Oakland", "OAK");
addAliases("NE", "New England");
addAliases("NO", "New Orleans");
addAliases("NYG", "NY Giants", "New York Giants", "Giants");
addAliases("NYJ", "NY Jets", "New York Jets", "Jets");
addAliases("SF", "San Francisco", "San Fran", "SFO", "49ers", "Niners");
addAliases("TB", "Tampa Bay");
addAliases("WAS", "Washington", "WSH", "Commanders");

export function resolveTeam(value: string): NflTeam | null {
  const clean = normalize(
    value
      .replace(/^\s*#?\d{1,2}\s*[.)\-:]?\s*/, "")
      .replace(/\s+\(?[-+]?\d+(?:\.\d+)?\)?\s*$/, ""),
  );
  if (aliases.has(clean)) return aliases.get(clean) ?? null;

  const candidates = [...aliases.entries()]
    .filter(([alias]) => alias.length >= 3 && (` ${clean} `).includes(` ${alias} `))
    .sort((left, right) => right[0].length - left[0].length);
  return candidates[0]?.[1] ?? null;
}

function averageTieRanks(
  values: Array<{ team: NflTeam; value: number }>,
  direction: "higher-easier" | "lower-easier",
) {
  const sorted = [...values].sort((left, right) => {
    const difference =
      direction === "higher-easier"
        ? right.value - left.value
        : left.value - right.value;
    return difference || left.team.localeCompare(right.team);
  });
  const ranks: MetricRanks = {};

  for (let index = 0; index < sorted.length; ) {
    let end = index + 1;
    while (end < sorted.length && sorted[end].value === sorted[index].value) end += 1;
    const averageRank = (index + 1 + end) / 2;
    for (let cursor = index; cursor < end; cursor += 1) {
      ranks[sorted[cursor].team] = averageRank;
    }
    index = end;
  }
  return ranks;
}

function emptyResult(): ParseResult {
  return {
    ranks: {},
    recognized: 0,
    missing: [...NFL_TEAMS],
    duplicates: [],
    unrecognized: [],
  };
}

export function parseMetricPaste(
  text: string,
  mode: PasteMode,
  direction: "higher-easier" | "lower-easier",
): ParseResult {
  if (!text.trim()) return emptyResult();

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Set<NflTeam>();
  const duplicates = new Set<NflTeam>();
  const unrecognized: string[] = [];

  if (mode === "ranked") {
    const ranks: MetricRanks = {};
    for (const line of lines) {
      const cells = line.split(/\t|,|;/).map((cell) => cell.trim());
      const team =
        cells.map(resolveTeam).find((candidate): candidate is NflTeam => Boolean(candidate)) ??
        resolveTeam(line);
      if (!team) {
        if (!/^(rank|team|offense)$/i.test(line)) unrecognized.push(line);
        continue;
      }
      if (seen.has(team)) {
        duplicates.add(team);
        continue;
      }
      seen.add(team);
      ranks[team] = seen.size;
    }
    return {
      ranks,
      recognized: seen.size,
      missing: NFL_TEAMS.filter((team) => !seen.has(team)),
      duplicates: [...duplicates],
      unrecognized,
    };
  }

  const rawValues: Array<{ team: NflTeam; value: number }> = [];
  for (const line of lines) {
    const cells = line.split(/\t|,|;/).map((cell) => cell.trim());
    const team =
      cells.map(resolveTeam).find((candidate): candidate is NflTeam => Boolean(candidate)) ??
      resolveTeam(line);
    const numericCells = cells
      .map((cell) => Number(cell.replace(/[%$]/g, "").trim()))
      .filter(Number.isFinite);
    if (!team || !numericCells.length) {
      if (!/^(rank|team|offense|name)/i.test(line)) unrecognized.push(line);
      continue;
    }
    if (seen.has(team)) {
      duplicates.add(team);
      continue;
    }
    seen.add(team);
    rawValues.push({ team, value: numericCells.at(-1) as number });
  }

  return {
    ranks: averageTieRanks(rawValues, direction),
    recognized: seen.size,
    missing: NFL_TEAMS.filter((team) => !seen.has(team)),
    duplicates: [...duplicates],
    unrecognized,
  };
}

export function calculateOffensiveGrades(
  ranks: Record<MetricKey, MetricRanks>,
  weights: Record<MetricKey, number>,
) {
  const grades: Partial<Record<NflTeam, number>> = {};
  const totalWeight = METRICS.reduce(
    (total, metric) => total + Math.max(0, weights[metric.key]),
    0,
  );
  if (!totalWeight) return grades;

  for (const team of NFL_TEAMS) {
    const complete = METRICS.every((metric) => Number.isFinite(ranks[metric.key][team]));
    if (!complete) continue;
    grades[team] =
      METRICS.reduce(
        (total, metric) =>
          total + (ranks[metric.key][team] as number) * Math.max(0, weights[metric.key]),
        0,
      ) / totalWeight;
  }
  return grades;
}

export function average(values: Array<number | undefined | null>) {
  const eligible = values.filter((value): value is number => Number.isFinite(value));
  if (!eligible.length) return null;
  return eligible.reduce((total, value) => total + value, 0) / eligible.length;
}
