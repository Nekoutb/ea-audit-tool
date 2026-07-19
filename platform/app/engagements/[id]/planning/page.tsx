import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  addPbcAction,
  approveMaterialityAction,
  assignTeamAction,
  carryForwardAction,
  closePlanningAction,
  createMaterialityAction,
  removeTeamAction,
  setBudgetAction,
  setMaterialAction,
  setPbcStatusAction,
} from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner, GatesPanel } from "@/components/GatesPanel";
import { Chip, Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { FORM_DEFINITIONS, isFormComplete, type FormValues } from "@/lib/forms";
import { planningCloseGates } from "@/lib/gates";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { BENCHMARK_RANGES, BENCHMARKS, listMaterialityVersions } from "@/lib/materiality";
import { listBudget, listFirmUsers, listPbc, listTeam, TEAM_ROLES } from "@/lib/team";
import { requireTenant } from "@/lib/tenant";

export const metadata = { title: "Planning · AuditISA" };

const PLANNING_CODES = [
  "D1", "D3.1", "D4.1", "D4.2", "D4.3", "D4.4", "D4.5", "D4.6", "D4.7", "D4.8", "D4.9",
  "D5.1", "D5.2", "D5.4", "D5.5", "D5.6", "D5.7", "D6.1", "D7.1", "D7.2",
];

// Conditional D-forms only activate when their D1 trigger question is answered
// "yes" (spec §5.2). [Adversarial-review fix]
const CONDITIONAL_TRIGGERS: Record<string, string> = {
  "D4.5": "assess_control_env",
  "D4.6": "assess_it_env",
  "D4.7": "uses_expert",
  "D4.8": "uses_service_org",
  "D4.9": "has_internal_audit",
};

async function driverStatuses(engagementId: string): Promise<Map<string, string>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const responses = await tx.query<{ code: string; field_key: string; value: unknown }>(
      "SELECT code, field_key, value FROM form_response WHERE engagement_id = $1",
      [engagementId],
    );
    const byCode = new Map<string, FormValues>();
    for (const row of responses.rows) {
      const values = byCode.get(row.code) ?? {};
      values[row.field_key] = row.value;
      byCode.set(row.code, values);
    }
    const signed = await tx.query<{ code: string }>(
      `SELECT DISTINCT fi.code
         FROM signoff s
         JOIN document d ON d.id = s.document_id
         JOIN file_item fi ON fi.id = d.file_item_id
        WHERE fi.engagement_id = $1 AND s.voided_at IS NULL AND s.role = 'partner'`,
      [engagementId],
    );
    const signedCodes = new Set(signed.rows.map((r) => r.code));

    const d1 = byCode.get("D1") ?? {};
    const statuses = new Map<string, string>();
    for (const code of PLANNING_CODES) {
      const trigger = CONDITIONAL_TRIGGERS[code];
      if (trigger && d1[trigger] !== true) {
        statuses.set(code, "not_required");
        continue;
      }
      const definition = FORM_DEFINITIONS[code];
      const values = byCode.get(code);
      if (signedCodes.has(code)) statuses.set(code, "signed");
      else if (!values || Object.keys(values).length === 0) statuses.set(code, "not_started");
      else if (definition && isFormComplete(definition, values)) statuses.set(code, "complete");
      else statuses.set(code, "in_progress");
    }
    return statuses;
  });
}

export default async function PlanningPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; failed?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error, failed } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tp = t.planning;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [gates, statuses, versions, team, users, budget, pbc, items] = await Promise.all([
    planningCloseGates(id),
    driverStatuses(id),
    listMaterialityVersions(id),
    listTeam(id),
    listFirmUsers(),
    listBudget(id),
    listPbc(id),
    listFileItems(id),
  ]);
  const eSections = items.filter((item) => item.section === "E");
  const materialFlags = await (async () => {
    const { tenantId } = await requireTenant();
    return withTenant(tenantId, async (tx) => {
      const result = await tx.query<{ id: string; material: boolean }>(
        "SELECT id, material FROM file_item WHERE engagement_id = $1 AND section = 'E'",
        [id],
      );
      return new Map(result.rows.map((r) => [r.id, r.material]));
    });
  })();

  const btn =
    "inline-flex items-center rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-surface-2";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em] text-ink">
        {engagement.clientName} — {engagement.fiscalYear} · {tp.planningTitle}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="planning" />
      <ErrorBanner error={error} failed={failed} locale={locale} />

      <Panel className="mt-6">
        <PanelHeader
          title={tp.driver.title}
          right={
            <form action={carryForwardAction.bind(null, id)}>
              <button type="submit" className={btn} data-testid="carry-forward">
                {tp.carryForward}
              </button>
            </form>
          }
        />
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
          <table className="w-full text-sm" data-testid="driver-table">
            <tbody>
              {PLANNING_CODES.map((code) => {
                const status = statuses.get(code) ?? "not_started";
                return (
                  <tr key={code} className="border-t border-line first:border-t-0 hover:bg-surface-2">
                    <td className="w-20 px-4 py-2 font-mono text-xs font-semibold text-ink tnum">
                      {code}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          status === "signed"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : status === "complete"
                              ? "text-ink"
                              : "text-muted"
                        }
                      >
                        {tp.driver.statusValues[status as keyof typeof tp.driver.statusValues]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {FORM_DEFINITIONS[code] && status !== "not_required" ? (
                        <Link
                          href={
                            CONDITIONAL_TRIGGERS[code]
                              ? `/engagements/${id}/considerations#${encodeURIComponent(code)}`
                              : `/engagements/${id}/forms/${encodeURIComponent(code)}`
                          }
                          className="inline-flex min-h-[32px] items-center font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          {tp.openForm}
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title={`${tp.materiality.title} (D5.1)`} />
        {versions.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
            <table className="w-full text-sm" data-testid="materiality-table">
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id} className="border-t border-line first:border-t-0 hover:bg-surface-2">
                    <td className="px-4 py-2 font-mono text-xs font-semibold tnum">v{version.versionNo}</td>
                    <td className="px-4 py-2">{tp.materiality.benchmarks[version.benchmark]}</td>
                    <td className="px-4 py-2 tnum">{formatFCFA(version.overall)}</td>
                    <td className="px-4 py-2 text-muted tnum">{formatFCFA(version.performance)} PM</td>
                    <td className="px-4 py-2 text-muted tnum">{formatFCFA(version.trivial)} CT</td>
                    <td className="px-4 py-2" data-testid={`materiality-status-${version.versionNo}`}>
                      {tp.materiality.statusLabel[version.status]}
                      {version.approvedByName ? ` — ${version.approvedByName}` : ""}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {version.status === "draft" ? (
                        <form action={approveMaterialityAction.bind(null, id, version.versionNo)}>
                          <button type="submit" className={btn} data-testid="approve-materiality">
                            {tp.materiality.approve}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <form action={createMaterialityAction.bind(null, id)} className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tp.materiality.benchmark}</span>
            <select name="benchmark" className={input} data-testid="materiality-benchmark">
              {BENCHMARKS.map((benchmark) => (
                <option key={benchmark} value={benchmark}>
                  {tp.materiality.benchmarks[benchmark]} ({BENCHMARK_RANGES[benchmark].min}–
                  {BENCHMARK_RANGES[benchmark].max} %)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tp.materiality.amount}</span>
            <input name="benchmarkAmount" type="number" min="1" required className={input} data-testid="materiality-amount" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tp.materiality.percentage}</span>
            <input name="percentage" type="number" step="0.1" min="0.1" max="100" required className={input} data-testid="materiality-pct" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tp.materiality.performancePct}</span>
            <input name="performancePct" type="number" min="60" max="85" defaultValue="75" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tp.materiality.trivialPct}</span>
            <input name="trivialPct" type="number" step="0.5" min="0.5" max="10" defaultValue="5" className={input} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tp.materiality.justification}</span>
            <input name="justification" required className={input} data-testid="materiality-justification" />
          </label>
          <div className="flex items-end">
            <button type="submit" className={btnPrimary} data-testid="create-materiality">
              {tp.materiality.compute}
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title={`${tp.team.title} (D6.1)`} />
        <ul className="mt-3 flex flex-col gap-1 text-sm" data-testid="team-list">
          {team.map((member) => (
            <li key={member.id} className="flex items-center justify-between rounded-[var(--radius-atlas-sm)] border border-line bg-surface px-3 py-1.5">
              <span>
                {member.userName} — {tp.team.roles[member.teamRole]}
              </span>
              <form action={removeTeamAction.bind(null, id, member.userId)}>
                <button type="submit" className="text-xs text-rose hover:underline">
                  {tp.team.remove}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={assignTeamAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tp.team.user}</span>
            <select name="userId" className={input} data-testid="team-user">
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tp.team.role}</span>
            <select name="teamRole" className={input} data-testid="team-role">
              {TEAM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {tp.team.roles[role]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btn} data-testid="assign-team">
            {tp.team.assign}
          </button>
        </form>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
          {tp.budget.title}
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {budget.map((line) => (
            <li key={line.grade} className="rounded-[var(--radius-atlas-xs)] bg-surface-2 px-2 py-1 text-ink-soft tnum">
              {line.grade}: {line.hours} h
            </li>
          ))}
        </ul>
        <form action={setBudgetAction.bind(null, id)} className="mt-2 flex flex-wrap items-end gap-3">
          <input name="grade" placeholder={tp.budget.grade} aria-label={tp.budget.grade} required className={input} />
          <input name="hours" type="number" step="0.5" min="0" placeholder={tp.budget.hours} aria-label={tp.budget.hours} required className={input} />
          <button type="submit" className={btn}>
            {tp.budget.set}
          </button>
        </form>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
          {tp.pbc.title}
        </h3>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {pbc.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-[var(--radius-atlas-sm)] border border-line bg-surface px-3 py-1.5">
              <span>{item.title}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted">{tp.pbc.status[item.status]}</span>
                {item.status !== "accepted" ? (
                  <form
                    action={setPbcStatusAction.bind(
                      null,
                      id,
                      item.id,
                      item.status === "requested" ? "uploaded" : "accepted",
                    )}
                  >
                    <button type="submit" className="inline-flex min-h-[24px] items-center text-xs text-emerald-700 hover:underline dark:text-emerald-400">
                      → {tp.pbc.status[item.status === "requested" ? "uploaded" : "accepted"]}
                    </button>
                  </form>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <form action={addPbcAction.bind(null, id)} className="mt-2 flex flex-wrap items-end gap-3">
          <input name="title" placeholder={tp.pbc.itemTitle} aria-label={tp.pbc.itemTitle} required className={input} />
          <button type="submit" className={btn}>
            {tp.pbc.add}
          </button>
        </form>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title={`${tp.sections.material} — E`} />
        <ul className="mt-3 grid grid-cols-1 gap-1.5 text-sm md:grid-cols-2">
          {eSections.map((section) => {
            const material = materialFlags.get(section.id) ?? false;
            return (
              <li key={section.id} className="flex items-center justify-between rounded-[var(--radius-atlas-sm)] border border-line bg-surface px-3 py-1.5">
                <Link
                  href={`/engagements/${id}/sections/${section.id}`}
                  className="inline-flex min-h-[24px] items-center font-mono text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {section.code}
                </Link>
                <span className="flex items-center gap-2">
                  {material ? <Chip tone="warn">{tp.sections.material}</Chip> : null}
                  <form action={setMaterialAction.bind(null, id, section.id, !material)}>
                    <button type="submit" className="inline-flex min-h-[24px] items-center text-xs text-muted hover:underline" data-testid={`toggle-material-${section.code}`}>
                      {material ? tp.sections.unmarkMaterial : tp.sections.markMaterial}
                    </button>
                  </form>
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title={tp.gates} />
        <div className="mt-3">
          <GatesPanel gates={gates} locale={locale} />
        </div>
        {engagement.phase === "planning" ? (
          <form action={closePlanningAction.bind(null, id)} className="mt-4">
            <button type="submit" className={btnPrimary} data-testid="close-planning">
              {tp.closePlanning}
            </button>
          </form>
        ) : null}
      </Panel>
    </main>
  );
}
