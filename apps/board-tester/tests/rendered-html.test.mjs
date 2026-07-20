import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("connects the Board tester to exact demo scoring", async () => {
  const [component, adapter, engine, curves] = await Promise.all([
    readFile(new URL("app/components/BoardTester.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/demo-scoring.ts", projectRoot), "utf8"),
    readFile(new URL("../../packages/scoring-engine/src/engine.ts", projectRoot), "utf8"),
    readFile(new URL("app/data/demo-curves.json", projectRoot), "utf8"),
  ]);

  assert.match(component, /Demo results · not official/);
  assert.match(component, /Your Board score/);
  assert.match(component, /demoField\.currentBoard\.boardAccuracy/);
  assert.match(component, /demoField\.currentBoard\.positionalAccuracy/);
  assert.match(component, /demoField\.currentBoard\.bvmAccuracy/);
  assert.match(component, /demoField\.currentBoard\.percentile/);
  assert.match(component, /demoField\.currentBoard\.tier/);
  assert.match(component, /<DemoLeaderboard rows=\{demoField\.leaderboard\}/);
  assert.match(adapter, /scoreField\(/);
  assert.match(adapter, /completedWeeks:\s*1/);
  assert.match(adapter, /mode:\s*"fabricated-demo-data"/);
  assert.match(engine, /BOARD_POSITIONAL_WEIGHT = new Rational\(4n, 5n\)/);
  assert.match(engine, /BVM_SEASON_WEIGHT = new Rational\(7n, 10n\)/);
  assert.equal(JSON.parse(curves).length, 330);
});

test("emits a deployable build without starter-preview remnants", async () => {
  await Promise.all([
    access(new URL("dist/server/index.js", projectRoot)),
    access(new URL("dist/client", projectRoot)),
  ]);
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
    readFile(new URL("package.json", projectRoot), "utf8"),
  ]);
  assert.match(page, /<BoardTester \/>/);
  assert.match(layout, /title:\s*"PRC Board Tester"/);
  assert.doesNotMatch(page, /codex-preview|_sites-preview/i);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("keeps ranking controls with the user", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("app/components/BoardTester.tsx", projectRoot), "utf8"),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
  ]);

  assert.match(component, /className="floating-undo"/);
  assert.match(component, /setFollowedPlayerId\(id\)/);
  assert.match(component, /scrollIntoView/);
  assert.match(component, /autoScrollWhileDragging\(event\.clientY\)/);
  assert.match(component, /Build your Board\./);
  assert.match(styles, /\.floating-undo\s*\{[\s\S]*position:\s*fixed/);
});

test("adds a private manual weekly scoring approval workflow", async () => {
  const [page, component, importer, uploadRoute, approvalRoute, migration, fixture] = await Promise.all([
    readFile(new URL("app/admin/updates/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AdminScoringUpdates.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/fantasypros-import.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/scoring-updates/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/scoring-updates/[id]/approve/route.ts", projectRoot), "utf8"),
    readFile(new URL("drizzle/0001_flawless_runaways.sql", projectRoot), "utf8"),
    readFile(new URL("tests/fixtures/fantasypros-half-format.csv", projectRoot), "utf8"),
  ]);

  assert.match(page, /requireChatGPTUser\("\/admin\/updates"\)/);
  assert.match(page, /isAdminEmail\(user\.email\)/);
  assert.match(component, /10:00 AM Mountain · 12:00 PM Eastern/);
  assert.match(component, /Upload & Review/);
  assert.match(component, /Approve Update/);
  assert.match(importer, /"PLAYER",\s*"POS",\s*"GP"/);
  assert.match(importer, /buildBvmSnapshot/);
  assert.match(importer, /unresolvedBvmTop150/);
  assert.match(uploadRoute, /status = analysis\.review\.ready \? "pending_review" : "blocked"/);
  assert.match(approvalRoute, /status = 'approved'/);
  assert.match(migration, /CREATE TABLE `scoring_snapshots`/);
  assert.match(fixture, /RK,PLAYER,POS,GP,1,2,3/);
});
