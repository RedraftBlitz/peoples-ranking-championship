import { isAdminRequest } from "../../../lib/admin-auth";
import { loadRandomDrawState } from "../../../lib/random-draw-admin";
import { RANDOM_DRAW_UTC } from "../../../lib/entry-rules";
import { maskDrawEmail } from "../../../lib/random-draw";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().toLocaleLowerCase("en-US").slice(0, 100);
    const requestedStatus = url.searchParams.get("status") ?? "all";
    const status = requestedStatus === "eligible" || requestedStatus === "excluded"
      ? requestedStatus
      : "all";
    const requestedPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const page = Number.isFinite(requestedPage)
      ? Math.max(1, Math.min(requestedPage, 10_000))
      : 1;
    const state = await loadRandomDrawState();
    const matching = state.candidates.filter((candidate) => {
      const matchesStatus = status === "all"
        || (status === "eligible" ? candidate.eligible : !candidate.eligible);
      const matchesQuery = !query
        || candidate.email.toLocaleLowerCase("en-US").includes(query)
        || candidate.boardName?.toLocaleLowerCase("en-US").includes(query)
        || candidate.entryId.toLocaleLowerCase("en-US").includes(query);
      return matchesStatus && matchesQuery;
    });
    const offset = (page - 1) * PAGE_SIZE;
    const pageCandidates = matching.slice(offset, offset + PAGE_SIZE);
    const countByCode = (code: string) => state.candidates.filter(
      (candidate) => candidate.exclusionCode === code,
    ).length;

    return Response.json({
      generatedAt: state.nowIso,
      season: 2026,
      drawTimeUtc: RANDOM_DRAW_UTC,
      summary: {
        combinedDeduplicatedEntries: state.candidates.length,
        eligibleEntries: state.eligibleCandidates.length,
        manualExclusions: countByCode("manual"),
        skillPrizeExclusions: countByCode("skill_prize_winner"),
        disqualifiedBoardExclusions: countByCode("board_disqualified"),
        previousSelections: countByCode("previous_selection"),
      },
      readiness: state.readiness,
      publications: {
        final: state.finalPublication
          ? {
              id: state.finalPublication.id,
              boardCount: state.finalPublication.board_count,
              completedWeeks: state.finalPublication.completed_weeks,
              scheduledFor: state.finalPublication.scheduled_for,
            }
          : null,
      },
      candidates: pageCandidates.map((candidate) => ({
        entryId: candidate.entryId,
        emailMasked: maskDrawEmail(candidate.email),
        sources: candidate.sources,
        boardName: candidate.boardName,
        submittedAt: candidate.submittedAt,
        eligible: candidate.eligible,
        exclusionCode: candidate.exclusionCode,
        exclusionReason: candidate.exclusionReason,
        manualAction: candidate.eligibilityAction
          ? {
              action: candidate.eligibilityAction.action,
              reason: candidate.eligibilityAction.reason,
              createdAt: candidate.eligibilityAction.createdAt,
            }
          : null,
      })),
      draws: state.drawRecords.map((draw) => ({
        id: draw.id,
        sequence: draw.sequence,
        drawType: draw.draw_type,
        priorDrawId: draw.prior_draw_id,
        methodVersion: draw.method_version,
        rulesVersion: draw.rules_version,
        poolCount: draw.pool_count,
        poolSha256: draw.pool_sha256,
        selectedNumber: draw.selected_number,
        selectedEntryId: draw.selected_entry_id,
        selectedEmailMasked: maskDrawEmail(draw.selected_email_key),
        selectedSource: draw.selected_source,
        selectedBoardId: draw.selected_board_id,
        randomValueHex: draw.random_value_hex,
        rejectionCount: draw.rejection_count,
        alternateReason: draw.alternate_reason,
        drawnBy: draw.drawn_by,
        drawnAt: draw.drawn_at,
        winnerStatus: draw.winnerStatus,
        winnerStatusReason: draw.winnerStatusReason,
        winnerStatusAt: draw.winnerStatusAt,
      })),
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        totalMatching: matching.length,
        totalPages: Math.max(1, Math.ceil(matching.length / PAGE_SIZE)),
      },
    });
  } catch {
    return Response.json(
      { error: "Random Draw operations could not be loaded." },
      { status: 500 },
    );
  }
}
