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
