import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { RegisterRow, type RegisterRowData } from "@/components/RegisterRow";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { phaseDeadline, type DashboardPhase } from "@/lib/engagement-dashboard";
import { listEngagements, type EngagementRegisterRow } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Engagements · AuditISA" };

type StageTone = "acc" | "warn" | "prog" | "done" | "muted";
const STAGE_TONE: Record<string, StageTone> = {
  acceptance: "acc",
  planning: "warn",
  execution: "prog",
  conclusion: "done",
  archived: "muted",
};

/**
 * The engagements register — the definitive list of audit assignments and the
 * primary route into each audit file (IA audit, Part 5B). Archived engagements
 * are hidden behind their filter; concluded/archived rows offer FY+1
 * roll-forward directly.
 */
export default async function EngagementsPage(props: {
  searchParams: Promise<{ stage?: string; archived?: string; q?: string; year?: string; partner?: string; mine?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { stage, archived, q, year, partner, mine } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const te = t.engagements;
  const showArchived = archived === "1" || stage === "archived";
  const query = (q ?? "").trim().toLowerCase();

  const all = await listEngagements();
  const engagements = all.filter((e) => {
    if (stage && e.phase !== stage) return false;
    if (!showArchived && e.phase === "archived") return false;
    if (query && !`${e.name ?? ""} ${e.clientName}`.toLowerCase().includes(query)) return false;
    if (year && String(e.fiscalYear) !== year) return false;
    if (partner && (e.partnerName ?? "") !== partner) return false;
    if (mine === "1" && !e.isMine) return false;
    return true;
  });
  const archivedCount = all.filter((e) => e.phase === "archived").length;
  const years = [...new Set(all.map((e) => e.fiscalYear))].sort((a, b) => b - a);
  const partners = [...new Set(all.map((e) => e.partnerName).filter((p): p is string => Boolean(p)))].sort();
  const hasFilters = Boolean(query || year || partner || mine === "1");

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const rows: RegisterRowData[] = engagements.map((e: EngagementRegisterRow) => {
    const isArchived = e.phase === "archived";
    const deadlineIso = isArchived
      ? (e.reportDate ?? e.periodEnd)
      : phaseDeadline(e.periodEnd, e.phase as DashboardPhase);
    const status = isArchived
      ? { label: te.status.archived, tone: "muted" as const }
      : e.reportDate
        ? { label: te.status.reportIssued, tone: "done" as const }
        : deadlineIso < todayIso
          ? { label: te.status.behind, tone: "over" as const }
          : { label: te.status.onTrack, tone: "ok" as const };
    return {
      id: e.id,
      title: e.name ?? e.clientName,
      clientName: e.name ? e.clientName : null,
      fiscalYear: e.fiscalYear,
      partnerName: e.partnerName,
      stage: { label: te.stages[e.phase], tone: STAGE_TONE[e.phase] ?? "muted" },
      status,
      pct: e.tasksTotal > 0 ? Math.round((e.tasksDone / e.tasksTotal) * 100) : 0,
      deadline: deadlineIso,
      lastActivity: e.lastActivity ?? te.never,
      rollForward:
        e.phase === "conclusion" || e.phase === "archived"
          ? { newYear: e.fiscalYear + 1, label: te.rollForward.replace("{year}", String(e.fiscalYear + 1)) }
          : null,
      openLabel: te.open,
    };
  });

  const th =
    "border-b border-line bg-surface-2 px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted first:px-5";

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-4">
      <AppNav locale={locale} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{te.title}</h1>
          {stage ? (
            <p className="mt-1 text-[13px] text-ink-soft">
              {te.stage}: {te.stages[stage as keyof typeof te.stages] ?? stage}{" "}
              <Link href="/engagements" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                ×
              </Link>
            </p>
          ) : null}
        </div>
        <Link href="/new-engagement" className={btnPrimary} data-testid="new-engagement">
          {te.newEngagement}
        </Link>
      </div>

      <form method="GET" className="flex flex-wrap items-center gap-2.5" data-testid="register-filters">
        {stage ? <input type="hidden" name="stage" value={stage} /> : null}
        {showArchived && stage !== "archived" ? <input type="hidden" name="archived" value="1" /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={te.searchPlaceholder}
          className="w-64 rounded-full border border-line-strong bg-surface px-4 py-2 text-[13px] text-ink outline-none backdrop-blur-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          data-testid="register-search"
        />
        <select
          name="year"
          defaultValue={year ?? ""}
          className="rounded-full border border-line-strong bg-surface px-3 py-2 text-[12.5px] text-ink-soft outline-none backdrop-blur-xl"
          data-testid="filter-year"
        >
          <option value="">{te.filterYear}: {te.allOption}</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          name="partner"
          defaultValue={partner ?? ""}
          className="max-w-[180px] rounded-full border border-line-strong bg-surface px-3 py-2 text-[12.5px] text-ink-soft outline-none backdrop-blur-xl"
          data-testid="filter-partner"
        >
          <option value="">{te.filterPartner}: {te.allOption}</option>
          {partners.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft backdrop-blur-xl">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine === "1"} className="h-3.5 w-3.5 accent-[var(--color-emerald-700)]" data-testid="filter-mine" />
          {te.filterMine}
        </label>
        <button
          type="submit"
          className="rounded-full border border-line-strong bg-surface px-4 py-2 text-[12.5px] font-semibold text-ink-soft transition hover:bg-surface-2"
          data-testid="apply-filters"
        >
          OK
        </button>
        {hasFilters ? (
          <Link href="/engagements" className="text-[12.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            {te.clearFilters}
          </Link>
        ) : null}
      </form>

      {engagements.length === 0 ? (
        <Panel className="p-6">
          <p className="text-sm text-muted">{te.empty}</p>
        </Panel>
      ) : (
        <Panel flush>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <PanelHeader title={te.title} hint={String(engagements.length)} />
            {archivedCount > 0 ? (
              <Link
                href={showArchived ? "/engagements" : "/engagements?archived=1"}
                data-testid="toggle-archived"
                className="inline-flex min-h-[24px] items-center text-[12.5px] font-semibold text-ink-soft hover:underline"
              >
                {showArchived ? te.hideArchived : `${te.showArchived} (${archivedCount})`}
              </Link>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed" data-testid="engagements-table">
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={th}>{te.title}</th>
                  <th className={th}>{te.fiscalYear}</th>
                  <th className={th}>{te.partner}</th>
                  <th className={th}>{te.stage}</th>
                  <th className={th}>{te.progress}</th>
                  <th className={th}>{te.deadlineCol}</th>
                  <th className={th}>{te.lastActivity}</th>
                  <th className={`${th} text-right`} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <RegisterRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </main>
  );
}
