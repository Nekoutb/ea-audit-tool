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
import { withTenant } from "@/lib/db";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { FORM_DEFINITIONS, isFormComplete, type FormValues } from "@/lib/forms";
import { planningCloseGates } from "@/lib/gates";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { BENCHMARK_RANGES, BENCHMARKS, listMaterialityVersions } from "@/lib/materiality";
import { listBudget, listFirmUsers, listPbc, listTeam, TEAM_ROLES } from "@/lib/team";
import { requireTenant } from "@/lib/tenant";

const PLANNING_CODES = [
  "D1", "D3.1", "D4.1", "D4.2", "D4.3", "D4.4", "D4.5", "D4.6", "D4.7", "D4.8", "D4.9",
  "D5.1", "D5.2", "D5.4", "D5.5", "D5.6", "D5.7", "D6.1", "D7.1", "D7.2",
];

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

    const statuses = new Map<string, string>();
    for (const code of PLANNING_CODES) {
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
    "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
  const btnPrimary =
    "rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800";
  const input =
    "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const card = "mt-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {engagement.clientName} — {engagement.fiscalYear} · {tp.planningTitle}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="planning" />
      <ErrorBanner error={error} failed={failed} locale={locale} />

      <section className={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {tp.driver.title}
          </h2>
          <form action={carryForwardAction.bind(null, id)}>
            <button type="submit" className={btn} data-testid="carry-forward">
              {tp.carryForward}
            </button>
          </form>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm" data-testid="driver-table">
            <tbody>
              {PLANNING_CODES.map((code) => {
                const status = statuses.get(code) ?? "not_started";
                return (
                  <tr key={code} className="border-t border-slate-200 first:border-t-0 dark:border-slate-800">
                    <td className="w-20 px-4 py-2 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {code}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          status === "signed"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : status === "complete"
                              ? "text-slate-900 dark:text-slate-100"
                              : "text-slate-500 dark:text-slate-400"
                        }
                      >
                        {tp.driver.statusValues[status as keyof typeof tp.driver.statusValues]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {FORM_DEFINITIONS[code] ? (
                        <Link
                          href={`/engagements/${id}/forms/${encodeURIComponent(code)}`}
                          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
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
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {tp.materiality.title} (D5.1)
        </h2>
        {versions.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm" data-testid="materiality-table">
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id} className="border-t border-slate-200 first:border-t-0 dark:border-slate-800">
                    <td className="px-4 py-2 font-mono text-xs font-semibold">v{version.versionNo}</td>
                    <td className="px-4 py-2">{tp.materiality.benchmarks[version.benchmark]}</td>
                    <td className="px-4 py-2">{formatFCFA(version.overall)}</td>
                    <td className="px-4 py-2 text-slate-500">{formatFCFA(version.performance)} PM</td>
                    <td className="px-4 py-2 text-slate-500">{formatFCFA(version.trivial)} CT</td>
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
            <span className="text-slate-600 dark:text-slate-400">{tp.materiality.benchmark}</span>
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
            <span className="text-slate-600 dark:text-slate-400">{tp.materiality.amount}</span>
            <input name="benchmarkAmount" type="number" min="1" required className={input} data-testid="materiality-amount" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{tp.materiality.percentage}</span>
            <input name="percentage" type="number" step="0.1" min="0.1" max="100" required className={input} data-testid="materiality-pct" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{tp.materiality.performancePct}</span>
            <input name="performancePct" type="number" min="60" max="85" defaultValue="75" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{tp.materiality.trivialPct}</span>
            <input name="trivialPct" type="number" step="0.5" min="0.5" max="10" defaultValue="5" className={input} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{tp.materiality.justification}</span>
            <input name="justification" required className={input} data-testid="materiality-justification" />
          </label>
          <div className="flex items-end">
            <button type="submit" className={btnPrimary} data-testid="create-materiality">
              {tp.materiality.compute}
            </button>
          </div>
        </form>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {tp.team.title} (D6.1)
        </h2>
        <ul className="mt-3 flex flex-col gap-1 text-sm" data-testid="team-list">
          {team.map((member) => (
            <li key={member.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-1.5 dark:border-slate-800">
              <span>
                {member.userName} — {tp.team.roles[member.teamRole]}
              </span>
              <form action={removeTeamAction.bind(null, id, member.userId)}>
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  {tp.team.remove}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={assignTeamAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{tp.team.user}</span>
            <select name="userId" className={input} data-testid="team-user">
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{tp.team.role}</span>
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

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {tp.budget.title}
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {budget.map((line) => (
            <li key={line.grade} className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">
              {line.grade}: {line.hours} h
            </li>
          ))}
        </ul>
        <form action={setBudgetAction.bind(null, id)} className="mt-2 flex flex-wrap items-end gap-3">
          <input name="grade" placeholder={tp.budget.grade} required className={input} />
          <input name="hours" type="number" step="0.5" min="0" placeholder={tp.budget.hours} required className={input} />
          <button type="submit" className={btn}>
            {tp.budget.set}
          </button>
        </form>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {tp.pbc.title}
        </h3>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {pbc.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-1.5 dark:border-slate-800">
              <span>{item.title}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{tp.pbc.status[item.status]}</span>
                {item.status !== "accepted" ? (
                  <form
                    action={setPbcStatusAction.bind(
                      null,
                      id,
                      item.id,
                      item.status === "requested" ? "uploaded" : "accepted",
                    )}
                  >
                    <button type="submit" className="text-xs text-emerald-700 hover:underline">
                      → {tp.pbc.status[item.status === "requested" ? "uploaded" : "accepted"]}
                    </button>
                  </form>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <form action={addPbcAction.bind(null, id)} className="mt-2 flex flex-wrap items-end gap-3">
          <input name="title" placeholder={tp.pbc.itemTitle} required className={input} />
          <button type="submit" className={btn}>
            {tp.pbc.add}
          </button>
        </form>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {tp.sections.material} — E
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-1.5 text-sm md:grid-cols-2">
          {eSections.map((section) => {
            const material = materialFlags.get(section.id) ?? false;
            return (
              <li key={section.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-1.5 dark:border-slate-800">
                <Link
                  href={`/engagements/${id}/sections/${section.id}`}
                  className="font-mono text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {section.code}
                </Link>
                <span className="flex items-center gap-2">
                  {material ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {tp.sections.material}
                    </span>
                  ) : null}
                  <form action={setMaterialAction.bind(null, id, section.id, !material)}>
                    <button type="submit" className="text-xs text-slate-500 hover:underline" data-testid={`toggle-material-${section.code}`}>
                      {material ? tp.sections.unmarkMaterial : tp.sections.markMaterial}
                    </button>
                  </form>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{tp.gates}</h2>
        <GatesPanel gates={gates} locale={locale} />
        {engagement.phase === "planning" ? (
          <form action={closePlanningAction.bind(null, id)} className="mt-4">
            <button type="submit" className={btnPrimary} data-testid="close-planning">
              {tp.closePlanning}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
