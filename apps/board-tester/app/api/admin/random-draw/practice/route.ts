import { isAdminRequest } from "../../../../lib/admin-auth";
import { loadRandomDrawState } from "../../../../lib/random-draw-admin";
import {
  hashOrderedEntryIds,
  secureUniformIndex,
} from "../../../../lib/random-draw";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  try {
    const state = await loadRandomDrawState();
    const entryIds = state.eligibleCandidates.map((candidate) => candidate.entryId);
    if (!entryIds.length) {
      return Response.json({ error: "There are no currently eligible entries to test." }, { status: 409 });
    }
    const sample = secureUniformIndex(entryIds.length);
    return Response.json({
      practice: true,
      permanent: false,
      generatedAt: new Date().toISOString(),
      currentEligibleCount: entryIds.length,
      currentPoolSha256: await hashOrderedEntryIds(entryIds),
      sampleNumber: sample.selectedIndex + 1,
      rejectionCount: sample.rejectionCount,
      message: "Practice completed. No entrant was identified and no official result was saved.",
    });
  } catch {
    return Response.json({ error: "The practice run could not be completed." }, { status: 500 });
  }
}
