import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { approveRiskAdditionAction } from "@/app/actions/execution";
import {
  decideLeadAction,
  dismissPotentialAction,
  linkRiskIndexAction,
  mapRiskAction,
  promotePotentialAction,
  rebutRiskAction,
  unlinkRiskIndexAction,
  updateRiskAction,
} from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { LEAD_INDEXES } from "@/lib/lead-classes";
import { ASSERTIONS, inherentRating, listPotentialRisks, listRisks, type Risk } from "@/lib/risks";
import { riskLeads } from "@/lib/risk-leads";
import { significantAccounts } from "@/lib/significant-accounts";

export const metadata = { title: "Risk console · AuditISA" };

// The Risk Console (ISA 315 Revised 2019): Sources — everything the file knows
// that feeds risk identification, as promotable leads; Canvas — each risk
// assessed on the spectrum of inherent risk with its inherent risk factors;
// Linkage — risks carried onto lead-schedule indexes and assertions, from
// which P6.2 derives relevant assertions and significance.

const FACTORS = [
  { key: "complexity", en: "Complexity", fr: "Complexité" },
  { key: "subjectivity", en: "Subjectivity", fr: "Subjectivité" },
  { key: "change", en: "Change", fr: "Changement" },
  { key: "uncertainty", en: "Uncertainty", fr: "Incertitude" },
  { key: "bias", en: "Mgmt bias", fr: "Biais de la direction" },
] as const;

function Spectrum({ risks, fr }: { risks: Risk[]; fr: boolean }) {
  const live = risks.filter((r) => !r.rebutted);
  const pos = { low: 0, medium: 1, high: 2 } as const;
  return (
    <svg viewBox="0 0 240 200" className="h-[170px] w-[210px] flex-shrink-0" aria-label="Spectrum of inherent risk">
      <rect x="30" y="10" width="195" height="160" rx="6" className="fill-[var(--color-surface-2,#f3f3f1)]" />
      {/* upper-end region — significant risks live here */}
      <path d="M 225 10 L 160 10 Q 225 55 225 90 Z" className="fill-rose-200/60 dark:fill-rose-900/40" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <line x1={30 + (i + 1) * 65} y1="10" x2={30 + (i + 1) * 65} y2="170" className="stroke-[var(--line,#ddd)]" strokeWidth="0.6" />
          <line x1="30" y1={10 + (i + 1) * 53.3} x2="225" y2={10 + (i + 1) * 53.3} className="stroke-[var(--line,#ddd)]" strokeWidth="0.6" />
        </g>
      ))}
      {live.map((risk, i) => {
        const cx = 30 + pos[risk.likelihood] * 65 + 33 + ((i * 17) % 22) - 11;
        const cy = 170 - (pos[risk.magnitude] * 53.3 + 27) + ((i * 11) % 16) - 8;
        const tone = risk.category === "fraud" ? "fill-rose-600" : risk.category === "business" ? "fill-emerald-700" : "fill-slate-500";
        return (
          <g key={risk.id}>
            <circle cx={cx} cy={cy} r={risk.significant ? 6 : 4} className={`${tone} ${risk.significant ? "stroke-rose-700" : ""}`} strokeWidth="1.5" opacity="0.85" />
            <title>{risk.description}</title>
          </g>
        );
      })}
      <text x="127" y="190" textAnchor="middle" className="fill-[var(--color-muted,#888)] text-[9px]">
        {fr ? "Probabilité →" : "Likelihood →"}
      </text>
      <text x="12" y="95" textAnchor="middle" transform="rotate(-90 12 95)" className="fill-[var(--color-muted,#888)] text-[9px]">
        {fr ? "Ampleur →" : "Magnitude →"}
      </text>
    </svg>
  );
}

export default async function RisksPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const t = getMessages(locale);
  const tr = t.planning.risks;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [potential, risks, items, leads, sigView] = await Promise.all([
    listPotentialRisks(id),
    listRisks(id),
    listFileItems(id),
    riskLeads(id),
    significantAccounts(id).catch(() => null),
  ]);
  const eSections = items.filter((item) => item.section === "E");
  const openLeads = leads.filter((lead) => lead.status === "open");

  // coverage: the orphans planning should not close with
  const liveAssertion = risks.filter((r) => !r.rebutted && r.level === "assertion");
  const unlinked = liveAssertion.filter((r) => r.indexLinks.length === 0).length;
  const unresponded = risks.filter((r) => !r.rebutted && r.significant && r.linkedStepCount === 0).length;
  const sigOrphans = (sigView?.rows ?? []).filter(
    (row) => row.status === "significant" && !row.hasRisk && !row.aboveTe && row.justification.trim() === "",
  ).length;

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";
  const chip = (n: number, okEn: string, okFr: string, badEn: string, badFr: string, testid: string) => (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        n > 0 ? "bg-[var(--color-warn-soft)] text-warn" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      }`}
      data-testid={testid}
    >
      {n > 0 ? `${n} ${fr ? badFr : badEn}` : fr ? okFr : okEn}
    </span>
  );

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="risks-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Console des risques" : "Risk Console"}
        </h1>
        <span className="flex flex-wrap items-center gap-1.5" data-testid="risk-coverage">
          {chip(unlinked, "All risks linked", "Tous les risques reliés", "risk(s) not linked to an index", "risque(s) non relié(s) à un indice", "cov-unlinked")}
          {chip(unresponded, "Responses planned", "Réponses planifiées", "significant risk(s) without a planned response", "risque(s) important(s) sans réponse", "cov-unresponded")}
          {chip(sigOrphans, "Significance grounded", "Significativité fondée", "significant index(es) with no risk and no justification", "indice(s) significatif(s) sans risque ni justification", "cov-orphans")}
        </span>
        <span className="ml-auto"><Spectrum risks={risks} fr={fr} /></span>
      </div>
      <ErrorBanner error={error} locale={locale} />

      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ------------------------------------------------ Lane 1 — Sources */}
        <div className="flex w-full flex-col gap-4 lg:w-[360px] lg:flex-shrink-0">
          <Panel>
            <PanelHeader title={fr ? "Sources — pistes de risque" : "Sources — risk leads"} />
            <p className="mt-1 text-xs text-muted">
              {fr
                ? "Ce que le dossier sait déjà : acceptation, connaissance de l'activité, analyses, déficiences. Promouvoir au registre ou écarter avec motif."
                : "What the file already knows: acceptance, the understanding, analytics, deficiencies. Promote to the register or dismiss with a rationale."}
            </p>
            {openLeads.length === 0 ? (
              <p className="mt-2 text-sm text-muted" data-testid="leads-empty">
                {fr ? "Aucune piste ouverte." : "No open leads."}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2" data-testid="risk-leads">
                {openLeads.map((lead) => (
                  <li key={lead.key} className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-2.5 text-sm" data-testid={`lead-${lead.key.replace(/[^A-Za-z0-9-]/g, "_")}`}>
                    <p className="text-[12.5px] font-medium leading-snug text-ink">{fr ? lead.labelFr : lead.labelEn}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {lead.source} · {lead.detail.slice(0, 140)}
                    </p>
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {fr ? "Promouvoir / écarter" : "Promote / dismiss"}
                      </summary>
                      <form action={decideLeadAction.bind(null, id, lead.key)} className="mt-2 flex flex-col gap-1.5">
                        <input type="hidden" name="source" value={lead.source} />
                        {lead.index ? <input type="hidden" name="index" value={lead.index} /> : null}
                        <textarea name="description" rows={2} defaultValue={`${fr ? lead.labelFr : lead.labelEn} — ${lead.detail.slice(0, 120)}`} className={`${input} text-xs`} />
                        <span className="flex gap-1.5">
                          <select name="category" defaultValue={lead.suggestedCategory} className={`${input} flex-1 text-xs`}>
                            <option value="business">{fr ? "Activité" : "Business"}</option>
                            <option value="fraud">{fr ? "Fraude" : "Fraud"}</option>
                            <option value="error">{fr ? "Erreur" : "Error"}</option>
                          </select>
                          <select name="level" defaultValue={lead.suggestedLevel} className={`${input} flex-1 text-xs`}>
                            <option value="assertion">{fr ? "Assertion" : "Assertion"}</option>
                            <option value="fs">{fr ? "États financiers" : "FS level"}</option>
                          </select>
                        </span>
                        <input
                          name="managementMissed"
                          placeholder={fr ? "Non identifié par la direction ? Pourquoi (¶23)…" : "Missed by management's process? Why (¶23)…"}
                          className={`${input} text-xs`}
                        />
                        <span className="flex gap-1.5">
                          <button type="submit" name="leadAction" value="promote" className={`${btn} bg-emerald-700 !text-white hover:bg-emerald-800`} data-testid={`lead-promote-${lead.key.replace(/[^A-Za-z0-9-]/g, "_")}`}>
                            {fr ? "Promouvoir" : "Promote"}
                          </button>
                        </span>
                        <span className="flex gap-1.5">
                          <input name="rationale" placeholder={fr ? "Motif d'écart…" : "Dismissal rationale…"} className={`${input} flex-1 text-xs`} />
                          <button type="submit" name="leadAction" value="dismiss" className={btn}>
                            {fr ? "Écarter" : "Dismiss"}
                          </button>
                        </span>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title={tr.potential} />
            {potential.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{tr.empty}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2" data-testid="potential-risks">
                {potential.map((risk) => (
                  <li key={risk.id} className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3 text-sm">
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
        </div>

        {/* --------------------------------------- Lanes 2 + 3 — Canvas & links */}
        <Panel className="min-w-0 flex-1">
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
                        {fr
                          ? { business: "activité", fraud: "fraude", error: "erreur" }[risk.category]
                          : { business: "business", fraud: "fraud", error: "error" }[risk.category]}
                      </span>
                    ) : null}
                    {risk.level === "fs" ? (
                      <span className="ml-2 inline-flex items-center rounded-[var(--radius-atlas-xs)] bg-surface px-1.5 py-0.5 text-xs text-ink-soft">
                        {fr ? "États financiers" : "FS level"}
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
                    {tr.rating}: <b className="uppercase text-ink-soft">{risk.rating}</b>
                    {/* ¶34: no reliance on controls → the RMM stays at the inherent assessment */}
                    {!risk.controlsReliance && !risk.rebutted ? (
                      <span className="ml-1" title={fr ? "Pas d'appui prévu sur les contrôles : RAS = risque inhérent (ISA 315 ¶34)" : "No controls reliance planned: RMM = inherent risk (ISA 315 ¶34)"}>
                        · CRA = IR
                      </span>
                    ) : null}{" "}
                    · {tr.statuses[risk.status]} · {risk.linkedStepCount} {tr.linkedSteps}
                  </span>
                </div>
                {risk.sections.length > 0 ? (
                  <p className="mt-1 text-xs text-muted">
                    {risk.sections.map((section) => `${section.code} [${section.assertions.join("")}]`).join(" · ")}
                  </p>
                ) : null}
                {risk.fsNote ? <p className="mt-1 text-xs italic text-muted">{risk.fsNote}</p> : null}

                {/* Lane 3 — where this risk lands in the financial statements */}
                {!risk.rebutted && risk.level === "assertion" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2" data-testid={`risk-links-${risk.presumedType ?? risk.id}`}>
                    {risk.indexLinks.map((link) => (
                      <span key={link.indexCode} className="inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-[var(--color-warn-soft)] px-2 py-0.5 text-[11px] font-semibold text-ink">
                        <span className="font-mono">{link.indexCode}</span>
                        <span className="text-muted">[{link.assertions.join("") || "—"}]</span>
                        <form action={unlinkRiskIndexAction.bind(null, id, risk.id, link.indexCode)}>
                          <button type="submit" className="text-muted hover:text-rose" title={fr ? "Délier" : "Unlink"}>×</button>
                        </form>
                      </span>
                    ))}
                    <details>
                      <summary className="cursor-pointer text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400" data-testid={`link-open-${risk.presumedType ?? risk.id}`}>
                        {fr ? "+ Lier à un indice" : "+ Link to index"}
                      </summary>
                      <form action={linkRiskIndexAction.bind(null, id, risk.id)} className="mt-1.5 flex flex-wrap items-center gap-2">
                        <select name="indexCode" className={input} data-testid={`link-index-${risk.presumedType ?? risk.id}`}>
                          {LEAD_INDEXES.map((def) => (
                            <option key={def.code} value={def.code}>
                              {def.code} — {def.labelEn}
                            </option>
                          ))}
                        </select>
                        <span className="flex items-center gap-1 text-xs text-muted">
                          {ASSERTIONS.map((assertion) => (
                            <label key={assertion} className="flex items-center gap-0.5">
                              <input type="checkbox" name="linkAssertions" value={assertion} />
                              {assertion}
                            </label>
                          ))}
                        </span>
                        <button type="submit" className={btn} data-testid={`link-save-${risk.presumedType ?? risk.id}`}>
                          {fr ? "Lier" : "Link"}
                        </button>
                      </form>
                    </details>
                  </div>
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
                      {/* ISA 315 ¶31(a): the factors driving the susceptibility */}
                      <fieldset className="flex flex-col text-xs text-muted">
                        <legend className="text-xs text-muted">{fr ? "Facteurs de risque inhérent" : "Inherent risk factors"}</legend>
                        <input type="hidden" name="factors_present" value="1" />
                        <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {FACTORS.map((factor) => (
                            <label key={factor.key} className="flex items-center gap-0.5 rounded-full border border-line px-1.5 py-0.5">
                              <input
                                type="checkbox"
                                name="factors"
                                value={factor.key}
                                defaultChecked={risk.inherentFactors.includes(factor.key)}
                                data-testid={`factor-${factor.key}-${risk.presumedType ?? risk.id}`}
                              />
                              {fr ? factor.fr : factor.en}
                            </label>
                          ))}
                        </span>
                      </fieldset>
                      {risk.presumedType === null ? (
                        <label className="flex items-center gap-1 text-xs text-muted">
                          <input type="hidden" name="significant_present" value="1" />
                          <input type="checkbox" name="significant" defaultChecked={risk.significant} />
                          {tr.significant}
                          {inherentRating(risk.likelihood, risk.magnitude) === "high" && !risk.significant ? (
                            <span className="text-warn" title={fr ? "Haut du spectre — envisager de le marquer important" : "Upper end of the spectrum — consider marking significant"}>!</span>
                          ) : null}
                        </label>
                      ) : null}
                      <label className="flex items-center gap-1 text-xs text-muted">
                        <input type="hidden" name="controlsReliance_present" value="1" />
                        <input type="checkbox" name="controlsReliance" defaultChecked={risk.controlsReliance} />
                        {tr.controlsReliance}
                      </label>
                      {risk.level === "fs" ? (
                        <label className="flex flex-col text-xs text-muted">
                          {fr ? "Effet généralisé (¶30)" : "Pervasive effect (¶30)"}
                          <input name="fsNote" defaultValue={risk.fsNote ?? ""} placeholder={fr ? "Effet sur les états financiers et réponse globale…" : "Effect on the statements and the overall response…"} className={input} />
                        </label>
                      ) : null}
                      <label className="flex flex-col text-xs text-muted">
                        {fr ? "Catégorie" : "Category"}
                        <select
                          name="category"
                          defaultValue={risk.category ?? ""}
                          className={input}
                          data-testid={`risk-cat-${risk.presumedType ?? risk.id}`}
                        >
                          <option value="">—</option>
                          <option value="business">{fr ? "Risque d'activité" : "Business risk"}</option>
                          <option value="fraud">{fr ? "Fraude" : "Fraud"}</option>
                          <option value="error">{fr ? "Erreur" : "Error"}</option>
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
      </div>

      <p className="mt-6 text-sm text-muted">
        <Link href={`/engagements/${id}/forms/P5.2`} className="text-emerald-700 hover:underline dark:text-emerald-400">
          P5.2
        </Link>
      </p>
    </main>
  );
}
