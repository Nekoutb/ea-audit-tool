import { NextResponse } from "next/server";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { recordSelectionDesign, runSelection, type SelectionParams, type UserRule } from "@/lib/je-selection";
import { ArchivedError } from "@/lib/mutability";
import { ForbiddenError } from "@/lib/tenant";

/**
 * The journal-entry selection engine's single endpoint: the criteria the
 * auditor chose, run over one projected ledger, returning the line items to
 * test and the reason each of them was picked.
 *
 * A run writes nothing, so there is no archive guard on it. A selection is read back
 * long after the file closes — that is when somebody asks how the sample was
 * directed — and an archived engagement has to be able to answer.
 *
 * The codes lib/je-selection throws are the auditor's own mistakes: no
 * criterion chosen, a rule whose operator does not fit its field, a rule
 * missing the value it compares against. Those come back as 400 with the code
 * intact so the studio can phrase them in the reader's language; anything else
 * is ours and comes back as 500 with the reason in the server log.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REQUEST_ERRORS = new Set([
  "no-criteria",
  "invalid-rule-field",
  "invalid-rule-operator",
  "invalid-rule-value",
]);

interface SelectionBody {
  datasetId?: unknown;
  criteria?: unknown;
  params?: unknown;
  userRules?: unknown;
  limit?: unknown;
  offset?: unknown;
  /** record this run as the S5.4 selection design (the studio's "Record" button) */
  recordDesign?: unknown;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid-engagement" }, { status: 400 });

  try {
    await requireEngagementAccess(id);

    const body = (await request.json()) as SelectionBody;
    const datasetId = String(body.datasetId ?? "");
    if (!UUID_RE.test(datasetId)) return NextResponse.json({ error: "invalid-dataset" }, { status: 400 });

    // Every threshold below is clamped by resolveSettings and every rule is
    // re-checked by normaliseUserRule, so the request is handed over as it
    // arrived rather than half-validated twice in two different places.
    const criteria = Array.isArray(body.criteria) ? body.criteria.map((key) => String(key)) : [];
    const params = (body.params ?? {}) as SelectionParams;
    const userRules = Array.isArray(body.userRules) ? (body.userRules as UserRule[]) : [];
    const result = await runSelection(id, datasetId, { criteria, params, userRules, limit: Number(body.limit), offset: Number(body.offset) });

    // An exploratory run no longer rewrites the S5.4 design (UAT run 2 B16):
    // only the auditor's explicit "Record as the S5.4 design" does.
    if (body.recordDesign === true) {
      await recordSelectionDesign(id, {
        datasetId,
        criteria,
        params,
        userRules,
        selectedLines: result.selectedLines,
        populationLines: result.population.lines,
      });
      return NextResponse.json({ result, designRecorded: true });
    }

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ArchivedError || (error instanceof Error && /engagement-archived/.test(error.message))) {
      return NextResponse.json({ error: "archived" }, { status: 423 });
    }
    if (error instanceof Error && error.message === "je-design-empty") {
      return NextResponse.json({ error: "je-design-empty" }, { status: 400 });
    }
    if (error instanceof Error && /UNAUTHENTICATED/.test(error.message)) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (error instanceof Error && REQUEST_ERRORS.has(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Postgres 57014 query_canceled: the statement timeout fired. Not a fault
    // to hide as 500 — the studio tells the auditor to narrow the criteria.
    if ((error as { code?: string } | null)?.code === "57014") {
      return NextResponse.json({ error: "selection-timeout" }, { status: 503 });
    }
    console.error("[je-selection] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "selection-failed" }, { status: 500 });
  }
}
