import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("connects the Board tester to exact demo scoring and official standings", async () => {
  const [component, officialLeaderboard, adapter, engine, curves] = await Promise.all([
    readFile(new URL("app/components/BoardTester.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/OfficialLeaderboard.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/demo-scoring.ts", projectRoot), "utf8"),
    readFile(new URL("../../packages/scoring-engine/src/engine.ts", projectRoot), "utf8"),
    readFile(new URL("app/data/demo-curves.json", projectRoot), "utf8"),
  ]);

  assert.match(component, /Your Board score/);
  assert.match(component, /demoField\.currentBoard\.boardAccuracy/);
  assert.match(component, /demoField\.currentBoard\.positionalAccuracy/);
  assert.match(component, /demoField\.currentBoard\.bvmAccuracy/);
  assert.match(component, /demoField\.currentBoard\.percentile/);
  assert.match(component, /demoField\.currentBoard\.tier/);
  assert.match(component, /<OfficialLeaderboard currentBoardName=/);
  assert.match(officialLeaderboard, /Official preseason standings/);
  assert.match(officialLeaderboard, /first published Week 1 update/);
  assert.match(officialLeaderboard, /fetch\("\/api\/leaderboard"/);
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
  assert.match(layout, /title:\s*"People's Ranking Championship"/);
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
  assert.match(component, /className="mobile-board-controls"/);
  assert.match(component, /id="player-search"/);
  assert.match(component, /className="mobile-score-toggle"/);
  assert.match(component, /className="search-empty search-prompt"/);
  assert.match(component, /setFollowedPlayerId\(id\)/);
  assert.match(component, /scrollIntoView/);
  assert.match(component, /autoScrollWhileDragging\(event\.clientY\)/);
  assert.match(component, /Build Your Board/);
  assert.match(styles, /\.floating-undo\s*\{[\s\S]*position:\s*fixed/);
  assert.match(styles, /\.mobile-board-controls\s*\{[\s\S]*position:\s*fixed/);
  assert.match(styles, /\.hero-copy > p\s*\{\s*display:\s*none/);
  assert.match(styles, /\.score-strip\s*\{\s*display:\s*none/);
  assert.match(styles, /\.demo-score-grid\.is-mobile-open\s*\{[\s\S]*display:\s*grid/);
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

test("adds manual FantasyCalc review without rearranging saved Boards", async () => {
  const [
    component,
    importer,
    reviewRoute,
    approvalRoute,
    marketRoute,
    board,
    migration,
  ] = await Promise.all([
    readFile(new URL("app/components/AdminMarketUpdates.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/fantasycalc-import.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/market-updates/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/market-updates/[id]/approve/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/market/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/components/BoardTester.tsx", projectRoot), "utf8"),
    readFile(new URL("drizzle/0002_loud_martin_li.sql", projectRoot), "utf8"),
  ]);

  assert.match(component, /Check FantasyCalc Now/);
  assert.match(component, /Saved Boards rearranged/);
  assert.match(component, /Existing saved Boards keep their exact order/);
  assert.match(importer, /savedBoardsRearranged:\s*0/);
  assert.match(importer, /\["jr", "sr", "ii", "iii", "iv", "v"\]/);
  assert.match(importer, /`FC-\$\{row\.externalId\}`/);
  assert.match(reviewRoute, /FANTASYCALC_SOURCE_URL/);
  assert.match(approvalRoute, /UPDATE market_snapshots/);
  assert.doesNotMatch(approvalRoute, /UPDATE boards/);
  assert.match(marketRoute, /approvedMarketSnapshotOrBase/);
  assert.match(board, /fetch\("\/api\/market"/);
  assert.match(board, /reconcileOrder\(saved\.order/);
  assert.match(migration, /CREATE TABLE `market_snapshots`/);
});

test("permanently locks final entries after two-step verification", async () => {
  const [component, submitRoute, saveRoute, rules, marketApproval, migration] = await Promise.all([
    readFile(new URL("app/components/BoardTester.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/boards/[id]/submit/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/boards/[id]/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/lib/entry-rules.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/market-updates/[id]/approve/route.ts", projectRoot), "utf8"),
    readFile(new URL("drizzle/0003_mushy_shen.sql", projectRoot), "utf8"),
  ]);

  assert.match(component, /Final verification · Step 1 of 2/);
  assert.match(component, /Final verification · Step 2 of 2/);
  assert.match(component, /Permanently Submit My Board/);
  assert.match(component, /draggable=\{!isEntered\}/);
  assert.match(component, /Final Board permanently locked/);
  assert.match(component, /Move 1 player directly · any amount/);
  assert.match(component, /not affiliated with,[\s\S]*FantasyCalc, FantasyPros, or Fanatics/);
  assert.match(submitRoute, /hashPin\(pin, pinRow\.pin_salt\)/);
  assert.match(submitRoute, /secureEqual\(candidate, pinRow\.pin_hash\)/);
  assert.match(submitRoute, /status = 'entered'/);
  assert.match(submitRoute, /final_top_150_json/);
  assert.match(saveRoute, /board\.status === "entered"/);
  assert.match(rules, /2026-09-09T20:00:00\.000Z/);
  assert.match(marketApproval, /entryDeadlinePassed\(\)/);
  assert.match(migration, /CREATE TABLE `board_entries`/);
  assert.match(migration, /CREATE UNIQUE INDEX `board_entries_board_unique`/);
});

test("publishes a stable preseason leaderboard and exact approved scoring", async () => {
  const [publicRoute, scoringApproval, leaderboardLogic, component, migration] = await Promise.all([
    readFile(new URL("app/api/leaderboard/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/scoring-updates/[id]/approve/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/lib/official-leaderboard.ts", projectRoot), "utf8"),
    readFile(new URL("app/components/OfficialLeaderboard.tsx", projectRoot), "utf8"),
    readFile(new URL("drizzle/0004_goofy_hercules.sql", projectRoot), "utf8"),
  ]);

  assert.match(publicRoute, /WHERE season = \?1 AND scheduled_for <= \?2/);
  assert.match(publicRoute, /mode: "preseason"/);
  assert.match(publicRoute, /mode: "scored"/);
  assert.match(scoringApproval, /leaderboardPublicationPayload/);
  assert.match(scoringApproval, /INSERT INTO leaderboard_publications/);
  assert.match(leaderboardLogic, /PRESEASON_RANDOM_SEED/);
  assert.match(leaderboardLogic, /boardAccuracy: row\.boardAccuracy\.toFraction\(\)/);
  assert.match(component, /Placement is randomized once and stays stable/);
  assert.match(component, /Accuracy/);
  assert.match(component, /Percentile/);
  assert.match(migration, /CREATE TABLE `leaderboard_publications`/);
  assert.match(migration, /scoring_spec_version/);
});

test("keeps draft recovery optional and requires verified email at submission", async () => {
  const [
    component,
    emailSender,
    emailStatus,
    verificationSend,
    verificationCheck,
    recoveryRequest,
    recoveryReset,
    submitRoute,
    boardSecurity,
    migration,
  ] = await Promise.all([
    readFile(new URL("app/components/BoardTester.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/email-delivery.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/email/status/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/boards/[id]/email/send-code/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/boards/[id]/email/verify/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/boards/recovery/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/boards/recovery/reset/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/boards/[id]/submit/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/lib/board-security.ts", projectRoot), "utf8"),
    readFile(new URL("drizzle/0005_fluffy_bromley.sql", projectRoot), "utf8"),
  ]);

  assert.match(component, /Recovery email <em>optional<\/em>/);
  assert.match(component, /A verified email is required for final submission/);
  assert.match(component, /Send Verification Code/);
  assert.match(component, /name="emailVerificationCode"/);
  assert.match(component, /value=\{verificationCode\}/);
  assert.match(component, /code: verificationCode/);
  assert.match(component, /Send PIN Reset Code/);
  assert.match(component, /name="pinRecoveryCode"/);
  assert.match(component, /value=\{pinRecoveryCode\}/);
  assert.match(component, /code: pinRecoveryCode/);
  assert.match(component, /Verify your email above to unlock permanent submission/);
  assert.match(emailSender, /https:\/\/api\.resend\.com\/emails/);
  assert.match(emailSender, /no-reply@updates\.redraftblitz\.com/);
  assert.match(emailStatus, /submissionEmailVerificationRequired\(\)/);
  assert.match(verificationSend, /Please wait one minute/);
  assert.match(verificationCheck, /failedAttempts|failed_attempts/);
  assert.match(recoveryRequest, /GENERIC_MESSAGE/);
  assert.match(recoveryReset, /DELETE FROM board_sessions/);
  assert.match(recoveryReset, /recovery_email_verified_at/);
  assert.match(submitRoute, /submissionEmailVerificationRequired\(\)/);
  assert.match(submitRoute, /Verify a contact email before permanently submitting/);
  assert.match(boardSecurity, /PIN_ITERATIONS = 100_000/);
  assert.doesNotMatch(boardSecurity, /PIN_ITERATIONS = 120_000/);
  assert.match(migration, /CREATE TABLE `email_verification_requests`/);
  assert.match(migration, /ALTER TABLE `boards` ADD `recovery_email_verified_at`/);
});

test("adds a private contest control room with safe final-entry exports", async () => {
  const [page, component, dashboardRoute, exportRoute, updateCenter] = await Promise.all([
    readFile(new URL("app/admin/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AdminDashboard.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/dashboard/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/entries/export/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/components/AdminScoringUpdates.tsx", projectRoot), "utf8"),
  ]);

  assert.match(page, /requireChatGPTUser\("\/admin"\)/);
  assert.match(page, /isAdminEmail\(user\.email\)/);
  assert.match(component, /Contest control room/);
  assert.match(component, /Search every Board/);
  assert.match(component, /Resend domain pending/);
  assert.match(component, /Download Exact Backup/);
  assert.match(dashboardRoute, /isAdminRequest\(request\)/);
  assert.match(dashboardRoute, /verified_final_entries/);
  assert.match(dashboardRoute, /temporarily_pin_locked/);
  assert.match(dashboardRoute, /leaderboard_publications/);
  assert.match(exportRoute, /containsPrivateContactInformation: true/);
  assert.match(exportRoute, /excludesCredentials: true/);
  assert.doesNotMatch(exportRoute, /pin_hash|pin_salt|token_hash|token_salt/);
  assert.match(updateCenter, /href="\/admin"/);
});

test("publishes the contest guide and approved 2026 prize lineup", async () => {
  const [howItWorks, prizes, scoring, faq, officialRules, contestPage, board] = await Promise.all([
    readFile(new URL("app/how-it-works/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/prizes/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/scoring/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/faq/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/official-rules/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/ContestPage.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/BoardTester.tsx", projectRoot), "utf8"),
  ]);

  assert.match(howItWorks, /Weeks 1–17 count; Week 18 does not/);
  assert.match(prizes, /LaDainian Tomlinson full-size signed helmet/);
  assert.doesNotMatch(prizes, /Greatest Fantasy Football Player of All Time/);
  assert.match(prizes, /\$200 Fanatics gift card/);
  assert.match(prizes, /Approximate package value: \$450/);
  assert.match(prizes, /approximately \$200/);
  assert.match(prizes, /First Round Crown/);
  assert.match(prizes, /\$100 Fanatics gift card/);
  assert.match(prizes, /\$50 Fanatics gift card/);
  assert.match(prizes, /prize pool levels up at 5,000 official Boards/);
  assert.match(prizes, /gift card doubles from \$200 to \$400/);
  assert.match(prizes, /Second place receives a \$200 Fanatics gift card/);
  assert.match(prizes, /third place[\s\S]*\$100 Fanatics gift card/);
  assert.match(prizes, /each tied eligible winner receives the full/);
  assert.match(scoring, /80%/);
  assert.match(scoring, /70% Season Value/);
  assert.match(scoring, /QB13 · RB37 · WR49 · TE13/);
  assert.match(faq, /30 days to respond/);
  assert.match(contestPage, /Random Draw/);
  assert.match(contestPage, /href="\/privacy"/);
  assert.match(officialRules, /one final Board per[\s\S]*verified email address/);
  assert.match(officialRules, /independently operated[\s\S]*personally prize-funded/);
  assert.match(officialRules, /duplicate physical[\s\S]*prizes will be provided when required/);
  assert.match(board, /href="\/how-it-works"/);
  assert.match(board, /name="acceptedEligibility"/);
  assert.match(board, /name="acceptedOfficialRules"/);
});

test("enforces one final 2026 Board per verified email", async () => {
  const [submitRoute, schema, migration, rules] = await Promise.all([
    readFile(new URL("app/api/boards/[id]/submit/route.ts", projectRoot), "utf8"),
    readFile(new URL("db/schema.ts", projectRoot), "utf8"),
    readFile(new URL("drizzle/0006_majestic_ben_grimm.sql", projectRoot), "utf8"),
    readFile(new URL("app/lib/entry-rules.ts", projectRoot), "utf8"),
  ]);

  assert.match(submitRoute, /acceptedEligibility !== true/);
  assert.match(submitRoute, /acceptedOfficialRules !== true/);
  assert.match(submitRoute, /WHERE season = 2026 AND entry_email_key = \?1/);
  assert.match(submitRoute, /board\.recovery_email_key/);
  assert.match(schema, /board_entries_season_email_unique/);
  assert.match(migration, /CREATE UNIQUE INDEX `board_entries_season_email_unique`/);
  assert.match(rules, /PRC-2026-FINAL-ENTRY-v3/);
  assert.match(rules, /2026-09-09T22:00:00\.000Z/);
  assert.match(rules, /2026-09-10T00:20:00\.000Z/);
  assert.match(rules, /2027-01-15T17:00:00\.000Z/);
});

test("adds a verified no-Board Random Draw entry with one chance per email", async () => {
  const [
    page,
    component,
    sendRoute,
    verifyRoute,
    emailDelivery,
    schema,
    migration,
    officialRules,
    privacy,
    prizes,
    faq,
  ] = await Promise.all([
    readFile(new URL("app/random-draw/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/RandomDrawEntry.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/random-draw/send-code/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/random-draw/verify/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/lib/email-delivery.ts", projectRoot), "utf8"),
    readFile(new URL("db/schema.ts", projectRoot), "utf8"),
    readFile(new URL("drizzle/0007_random_draw_entry.sql", projectRoot), "utf8"),
    readFile(new URL("app/official-rules/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/privacy/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/prizes/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/faq/page.tsx", projectRoot), "utf8"),
  ]);

  assert.match(page, /No Board required/);
  assert.match(page, /RANDOM_DRAW_LABEL/);
  assert.match(component, /acceptedEligibility/);
  assert.match(component, /acceptedOfficialRules/);
  assert.match(component, /randomDrawVerificationCode/);
  assert.match(sendRoute, /UNION ALL[\s\S]*random_draw_entries/);
  assert.match(sendRoute, /entryDeadlinePassed\(\)/);
  assert.match(verifyRoute, /INSERT OR IGNORE INTO random_draw_entries/);
  assert.match(verifyRoute, /secureEqual/);
  assert.match(emailDelivery, /sendRandomDrawVerificationEmail/);
  assert.match(schema, /randomDrawEntries/);
  assert.match(migration, /random_draw_entries_season_email_unique/);
  assert.match(officialRules, /Free Random Draw Only entry/);
  assert.match(officialRules, /cryptographically secure random-number/);
  assert.match(officialRules, /Darian Hudock/);
  assert.match(officialRules, /Bernalillo County/);
  assert.doesNotMatch(officialRules, /Remaining legal terms|selection and audit procedure/);
  assert.doesNotMatch(officialRules, /Operator review version/);
  assert.match(privacy, /does not sell entrant personal information/);
  assert.match(prizes, /Random Draw Only form/);
  assert.match(faq, /cryptographically secure uniform random-number process/);
});
