import { NextResponse } from "next/server";
import {
  PHASE_ORDER,
  PHASE_SLUG_OF,
  engagementPhaseProgress,
  phaseTasks,
} from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";

/**
 * Data integration: machine-readable engagement status. Session-authenticated
 * and tenant-scoped like every other read (RLS underneath); returns the
 * engagement summary, per-phase progress and the full task list with sign-off
 * states, so firms can pull audit status into their own tooling.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const engagement = await getEngagement(id);
    if (!engagement) return NextResponse.json({ error: "not-found" }, { status: 404 });
    const phases = await engagementPhaseProgress(id, engagement.phase);
    const tasksByPhase = await Promise.all(PHASE_ORDER.map((phase) => phaseTasks(id, phase)));
    return NextResponse.json({
      engagement: {
        id: engagement.id,
        name: engagement.name,
        client: engagement.clientName,
        fiscalYear: engagement.fiscalYear,
        periodEnd: engagement.periodEnd,
        phase: engagement.phase,
        complexity: engagement.complexity,
      },
      phases: phases.map((p) => ({
        phase: PHASE_SLUG_OF[p.phase],
        done: p.done,
        total: p.total,
        status: p.status,
      })),
      tasks: PHASE_ORDER.flatMap((phase, i) =>
        tasksByPhase[i].map((task) => ({
          phase: PHASE_SLUG_OF[phase],
          code: task.code,
          title: task.titleEn,
          status: task.status,
          preparer: task.preparerName,
          preparerSignedAt: task.preparerAt,
          reviewer: task.reviewerName,
          reviewerSignedAt: task.reviewerAt,
        })),
      ),
    });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
