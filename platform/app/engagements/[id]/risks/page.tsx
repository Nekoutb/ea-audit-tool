import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { approveRiskAdditionAction } from "@/app/actions/execution";
import {
  dismissPotentialAction,
  mapRiskAction,
  promotePotentialAction,
  rebutRiskAction,
  updateRiskAction,
} from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { ASSERTIONS, listPotentialRisks, listRisks } from "@/lib/risks";

export const metadata = { title: "Risk register · AuditISA" };

export default async function RisksPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tr = t.planning.risks;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [potential, risks, items] = await Promise.all([
    listPotentialRisks(id),
    listRisks(id),
    listFileItems(id),
  ]);
  const eSections = items.filter((item) => item.section === "E");

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={locale === "fr" ? "Retour aux outils" : "Back to tools"}
          aria-label={locale === "fr" ? "Retour" : "Back"}
          data-testid="risks-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {t.planning.risksTitle}
        </h1>
      </div>
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-6">
        <PanelHeader title={tr.potential} />
        {potential.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{tr.empty}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="potential-risks">
            {potential.map((risk) => (
              <li
                key={risk.id}
                className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3 text-sm"
              >
                <p className="text-ink">
                  {risk.description}
                  <span className="ml-2 text-xs text-muted">
                    {tr.source}: {risk.sourceCode} · {risk.raisedByName} · {risk.status}
                  </span>
                </p>
                {risk.status === "open" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={promotePotentialAction.bind(null, id, risk.id)}>
                      <button type="submit" className={btn} data-testid={`promote-${risk.id}`}>
                        {tr.promote}
                      </button>
                    </form>
                    <form action={dismissPotentialAction.bind(null, id, risk.id)} className="flex items-center gap-2">
                      <input name="rationale" placeholder={tr.dismissRationale} required className={input} />
                      <button type="submit" className={btn}>
                        {tr.dismiss}
                      </button>
                    </form>
                  </div>
                ) : risk.dismissalRationale ? (
                  <p className="mt-1 text-xs text-muted">{risk.dismissalRationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title={tr.register} />
        <ul className="mt-3 flex flex-col gap-3" data-testid="risk-register">
          {risks.map((risk) => (
            <li
              key={risk.id}
              className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-4"
              data-testid={`risk-${risk.presumedType ?? risk.id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-ink">
                  {risk.description}
                  {risk.category ? (
                    <span
                      className={`ml-2 inline-flex items-center rounded-[var(--radius-atlas-xs)] px-1.5 py-0.5 text-xs font-semibold ${
                        risk.category === "fraud"
                          ? "bg-[var(--color-rose-soft)] text-rose"
                          : risk.category === "business"
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-surface text-ink-soft"
                      }`}
                      data-testid={`risk-category-${risk.id}`}
                    >
                      {locale === "fr"
                        ? { business: "activité", fraud: "fraude", error: "erreur" }[risk.category]
                        : { business: "business", fraud: "fraud", error: "error" }[risk.category]}
                    </span>
                  ) : null}
                  {risk.presumedType ? (
                    <span className="ml-2 inline-flex items-center rounded-[var(--radius-atlas-xs)] bg-surface px-1.5 py-0.5 text-xs text-ink-soft">
                      {tr.presumed}
                    </span>
                  ) : null}
                  {risk.significant && !risk.rebutted ? (
                    <span className="ml-2 inline-flex items-center rounded-[var(--radius-atlas-xs)] bg-[var(--color-rose-soft)] px-1.5 py-0.5 text-xs font-semibold text-rose">
                      {tr.significant}
                    </span>
                  ) : null}
                  {risk.rebutted ? (
                    <span className="ml-2 inline-flex items-center rounded-[var(--radius-atlas-xs)] bg-surface px-1.5 py-0.5 text-xs text-muted">
                      {tr.rebutted}
                    </span>
                  ) : null}
                  {risk.addedAfterPlanning && !risk.additionApproved ? (
                    <span
                      className="ml-2 inline-flex items-center rounded-[var(--radius-atlas-xs)] bg-[var(--color-warn-soft)] px-1.5 py-0.5 text-xs font-semibold text-warn"
                      data-testid={`pending-approval-${risk.id}`}
                    >
                      {t.planning.execution.pendingApproval}
                    </span>
                  ) : null}
                </p>
                {risk.addedAfterPlanning && !risk.additionApproved ? (
                  <form action={approveRiskAdditionAction.bind(null, id, risk.id)} className="mt-1">
                    <button type="submit" className={btn} data-testid={`approve-addition-${risk.id}`}>
                      {t.planning.execution.approveAddition}
                    </button>
                  </form>
                ) : null}
                <span className="text-xs text-muted">
                  {tr.rating}: <b className="uppercase text-ink-soft">{risk.rating}</b> · {tr.statuses[risk.status]} ·{" "}
                  {risk.linkedStepCount} {tr.linkedSteps}
                </span>
              </div>
              {risk.sections.length > 0 ? (
                <p className="mt-1 text-xs text-muted">
                  {risk.sections.map((section) => `${section.code} [${section.assertions.join("")}]`).join(" · ")}
                </p>
              ) : null}

              {!risk.rebutted ? (
                <div className="mt-3 flex flex-wrap items-end gap-4">
                  <form action={updateRiskAction.bind(null, id, risk.id)} className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col text-xs text-muted">
                      {tr.likelihood}
                      <select name="likelihood" defaultValue={risk.likelihood} className={input}>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                    </label>
                    <label className="flex flex-col text-xs text-muted">
                      {tr.magnitude}
                      <select name="magnitude" defaultValue={risk.magnitude} className={input}>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                    </label>
                    {risk.presumedType === null ? (
                      <label className="flex items-center gap-1 text-xs text-muted">
                        <input type="hidden" name="significant_present" value="1" />
                        <input type="checkbox" name="significant" defaultChecked={risk.significant} />
                        {tr.significant}
                      </label>
                    ) : null}
                    <label className="flex items-center gap-1 text-xs text-muted">
                      <input type="hidden" name="controlsReliance_present" value="1" />
                      <input type="checkbox" name="controlsReliance" defaultChecked={risk.controlsReliance} />
                      {tr.controlsReliance}
                    </label>
                    <label className="flex flex-col text-xs text-muted">
                      {locale === "fr" ? "Catégorie" : "Category"}
                      <select
                        name="category"
                        defaultValue={risk.category ?? ""}
                        className={input}
                        data-testid={`risk-cat-${risk.presumedType ?? risk.id}`}
                      >
                        <option value="">—</option>
                        <option value="business">{locale === "fr" ? "Risque d'activité" : "Business risk"}</option>
                        <option value="fraud">{locale === "fr" ? "Fraude" : "Fraud"}</option>
                        <option value="error">{locale === "fr" ? "Erreur" : "Error"}</option>
                      </select>
                    </label>
                    <label className="flex flex-col text-xs text-muted">
                      {tr.statusLabel}
                      <select
                        name="status"
                        defaultValue={risk.status}
                        className={input}
                        data-testid={`risk-status-${risk.presumedType ?? risk.id}`}
                      >
                        {(["identified", "response_planned", "response_executed", "concluded"] as const).map((status) => (
                          <option key={status} value={status}>
                            {tr.statuses[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className={btn} data-testid={`risk-update-${risk.presumedType ?? risk.id}`}>
                      {tr.update}
                    </button>
                  </form>

                  <form action={mapRiskAction.bind(null, id, risk.id)} className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col text-xs text-muted">
                      {tr.mapSection}
                      <select name="fileItemId" className={input} data-testid={`map-section-${risk.id}`}>
                        {eSections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.code}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="flex items-center gap-1 text-xs text-muted">
                      {ASSERTIONS.map((assertion) => (
                        <label key={assertion} className="flex items-center gap-0.5">
                          <input type="checkbox" name="assertions" value={assertion} />
                          {assertion}
                        </label>
                      ))}
                    </span>
                    <button type="submit" className={btn}>
                      {tr.mapSection}
                    </button>
                  </form>

                  {risk.presumedType === "revenue_fraud" ? (
                    <form action={rebutRiskAction.bind(null, id, risk.id)} className="flex items-end gap-2">
                      <input name="justification" placeholder={tr.rebutJustification} required className={input} />
                      <button type="submit" className={btn}>
                        {tr.rebut}
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>

      <p className="mt-6 text-sm text-muted">
        <Link href={`/engagements/${id}/forms/D7.1`} className="text-emerald-700 hover:underline dark:text-emerald-400">
          D7.1
        </Link>
      </p>
    </main>
  );
}
