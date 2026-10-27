import Link from "next/link";
import { localizedTitle } from "@/lib/page-title";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveSapAction } from "@/app/actions/sap";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import { craLevelLabel, craTone } from "@/lib/cra-model";
import { getEngagement } from "@/lib/engagements";
import { formatFCFA } from "@/lib/i18n";
import { leadIndexLabel } from "@/lib/lead-classes";
import { getLocale } from "@/lib/locale";
import { canWrite, type Role } from "@/lib/rbac";
import { sapView, type SapIndexView } from "@/lib/sap";
import { SAP_ASSERTIONS, SAP_PCT_MAX, SAP_PCT_MIN, sapAssertionLabel, thresholdPctFor } from "@/lib/sap-model";

export const generateMetadata = localizedTitle("Substantive Analytics", "Analytiques substantives");

/**
 * The substantive analytical procedures tool (F038, ISA 520 ¶5): the lead
 * indexes of the file on the left, and for the chosen index one procedure per
 * assertion — expectation model and inputs, the expected value, the
 * reliability of the data, the threshold (firm default per CRA level, or an
 * override with its reason), the recorded amount from the trial balance, the
 * difference against the threshold, the investigation and corroboration, and
 * the conclusion on the assertion. Reached from the Tools tile, from S5.5 and
 * from each E4 paper, which counts its procedures.
 */
export default async function SapPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ index?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { index, error } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const view = await sapView(id);
  const current: SapIndexView | null = view.indexes.find((i) => i.def.code === index) ?? null;
  // an archived file is read-only everywhere (ISA 230 ¶15-16); so is a read-only role
  const readOnly = engagement.phase === "archived" || !canWrite(session.user.role as Role);

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-[12.5px] text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60";
  const label = "flex flex-col gap-0.5 text-[11.5px] font-semibold text-ink-soft";
  const num = (n: number | null) => (n === null ? "—" : formatFCFA(n));

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="sap-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Procédures analytiques substantives (ISA 520)" : "Substantive analytical procedures (ISA 520)"}
        </h1>
        <span className="ml-auto text-[12px] text-muted" data-testid="sap-context">
          {fr ? "PM" : "PM"}: {num(view.performanceMateriality)} · {fr ? "seuils" : "thresholds"} {view.thresholds.low} / {view.thresholds.moderate} / {view.thresholds.high} % ({fr ? "ECR faible / modéré / élevé" : "low / moderate / high CRA"})
          {view.hasTb ? "" : fr ? " · aucune balance valide — montants comptabilisés saisis à la main" : " · no valid TB — recorded amounts typed by hand"}
        </span>
      </div>
      <ErrorBanner error={error} locale={locale} />
      <p className="mt-2 max-w-4xl text-[12.5px] text-muted">
        {fr
          ? "L'attente se construit avant de regarder le montant comptabilisé (ISA 520 ¶5). L'écart acceptable est une part du seuil de planification fixée par l'ECR de l'assertion en S3.1 ; un écart au-delà est investigué et corroboré avant de conclure. La revue des variations des feuilles maîtresses reste l'analytique de risque (ISA 315) et n'est pas remplacée."
          : "The expectation is built before looking at the recorded amount (ISA 520 ¶5). The acceptable difference is a share of performance materiality set by the assertion's CRA on S3.1; a difference beyond it is investigated and corroborated before concluding. The variance review of the lead schedules stays the risk analytic (ISA 315) and is not replaced."}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[18rem_1fr]">
        <Panel className="p-3" data-testid="sap-indexes">
          <PanelHeader title={fr ? "Indices" : "Indexes"} hint={fr ? "procédures · conclues" : "procedures · concluded"} />
          <ul className="mt-2 flex flex-col">
            {view.indexes.map((ix) => {
              const concluded = ix.procedures.filter((p) => p.conclusion).length;
              const exceeding = ix.procedures.filter((p) => p.evaluation.exceeds).length;
              const active = current?.def.code === ix.def.code;
              return (
                <li key={ix.def.code}>
                  <Link
                    href={`/engagements/${id}/tools/sap?index=${encodeURIComponent(ix.def.code)}`}
                    className={`flex items-baseline gap-2 rounded-[var(--radius-atlas-xs)] px-2 py-1 text-[12.3px] transition hover:bg-surface-2 ${active ? "bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "text-ink-soft"}`}
                    data-testid={`sap-index-${ix.def.code}`}
                  >
                    <span className="w-8 font-mono text-[10.5px] text-muted">{ix.def.code}</span>
                    <span className="min-w-0 flex-1 truncate">{leadIndexLabel(ix.def, fr ? "fr" : "en")}</span>
                    <span className="font-mono text-[10.5px] text-muted tnum">
                      {ix.procedures.length} · {concluded}
                      {exceeding > 0 ? <span className="text-rose"> · {exceeding}↑</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        {current ? (
          <div className="flex flex-col gap-3" data-testid="sap-index-detail">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[16px] font-semibold text-ink">
                {current.def.code} — {leadIndexLabel(current.def, fr ? "fr" : "en")}
              </h2>
              <span className="text-[12px] text-muted">
                {fr ? "Solde de clôture (balance)" : "Closing balance (TB)"}: <b className="tnum">{num(current.tbClosing)}</b>
              </span>
              {current.fileItemId ? (
                <Link href={`/engagements/${id}/sections/${current.fileItemId}`} className="text-[12px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400" data-testid="sap-open-paper">
                  {current.taskCode} → {fr ? "papier du compte" : "account paper"}
                </Link>
              ) : null}
            </div>
            {SAP_ASSERTIONS.map((assertion) => {
              const p = current.procedures.find((x) => x.assertion === assertion) ?? null;
              const level = current.cra[assertion] ?? null;
              const defaultPct = thresholdPctFor(level, view.thresholds);
              const ev = p?.evaluation ?? null;
              return (
                <Panel key={assertion} className="p-4" data-testid={`sap-${assertion}`}>
                  <div id={`sap-${assertion}`} className="flex flex-wrap items-center gap-2">
                    <b className="text-[13.5px] text-ink">
                      {assertion} — {sapAssertionLabel(assertion, fr ? "fr" : "en")}
                    </b>
                    <Chip tone={level ? craTone(level) : "muted"}>
                      {fr ? "ECR" : "CRA"}: {level ? craLevelLabel(level, fr ? "fr" : "en") : fr ? "non évaluée" : "not assessed"}
                    </Chip>
                    <span className="text-[11.5px] text-muted">
                      {fr ? "seuil par défaut" : "default threshold"} {defaultPct} % {fr ? "du PM" : "of PM"}
                    </span>
                    {ev ? (
                      <span className="ml-auto flex items-center gap-2 text-[12px]" data-testid={`sap-${assertion}-evaluation`}>
                        <span className="text-muted">{fr ? "écart" : "difference"} <b className="tnum text-ink">{num(ev.difference)}</b></span>
                        <span className="text-muted">{fr ? "seuil" : "threshold"} <b className="tnum text-ink">{num(ev.threshold)}</b></span>
                        {ev.exceeds === null ? (
                          <Chip tone="muted">{fr ? "non évaluable" : "not evaluable"}</Chip>
                        ) : ev.exceeds ? (
                          <Chip tone="rose">{fr ? "au-dessus du seuil" : "above threshold"}</Chip>
                        ) : (
                          <Chip tone="good">{fr ? "dans le seuil" : "within threshold"}</Chip>
                        )}
                        {p?.conclusion ? (
                          <Chip tone={p.conclusion === "supported" ? "good" : "rose"}>
                            {p.conclusion === "supported" ? (fr ? "assertion étayée" : "assertion supported") : fr ? "assertion non étayée" : "assertion not supported"}
                          </Chip>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                  <form action={saveSapAction.bind(null, id)} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    <input type="hidden" name="indexCode" value={current.def.code} />
                    <input type="hidden" name="assertion" value={assertion} />
                    <fieldset disabled={readOnly} className="contents">
                      <label className={`${label} xl:col-span-2`}>
                        {fr ? "Modèle d'attente (comment l'attente est construite, à partir de quelles relations)" : "Expectation model (how the expectation is built, from which relationships)"}
                        <textarea name="expectationModel" rows={2} required defaultValue={p?.expectationModel ?? ""} className={input} data-testid={`sap-${assertion}-model`} />
                      </label>
                      <label className={label}>
                        {fr ? "Valeur attendue (FCFA)" : "Expected value (FCFA)"}
                        <input name="expectedValue" type="number" step="1" required defaultValue={p?.expectedValue ?? ""} className={`${input} tnum`} data-testid={`sap-${assertion}-expected`} />
                      </label>
                      <label className={`${label} xl:col-span-2`}>
                        {fr ? "Données d'entrée (sources, montants, hypothèses)" : "Inputs (sources, amounts, assumptions)"}
                        <textarea name="inputs" rows={2} defaultValue={p?.inputs ?? ""} className={input} />
                      </label>
                      <label className={label}>
                        {fr ? "Fiabilité des données (ISA 520 ¶5(b))" : "Data reliability (ISA 520 ¶5(b))"}
                        <input name="dataReliability" defaultValue={p?.dataReliability ?? ""} className={input} placeholder={fr ? "source, indépendance, contrôles testés" : "source, independence, controls tested"} />
                      </label>
                      {current.tbClosing === null ? (
                        <label className={label}>
                          {fr ? "Montant comptabilisé (aucune balance : saisie manuelle)" : "Recorded amount (no TB: typed by hand)"}
                          <input name="actualValue" type="number" step="1" defaultValue={p?.actualValue ?? ""} className={`${input} tnum`} data-testid={`sap-${assertion}-actual`} />
                        </label>
                      ) : (
                        <div className={label}>
                          {fr ? "Montant comptabilisé (balance)" : "Recorded amount (TB)"}
                          <span className="tnum text-[12.5px] text-ink" data-testid={`sap-${assertion}-actual`}>{num(current.tbClosing)}</span>
                        </div>
                      )}
                      <label className={label}>
                        {fr ? "Seuil dérogatoire (% du PM, vide = défaut du cabinet)" : "Threshold override (% of PM, blank = firm default)"}
                        <input name="thresholdOverridePct" type="number" min={SAP_PCT_MIN} max={SAP_PCT_MAX} step="1" defaultValue={p?.thresholdOverridePct ?? ""} className={`${input} tnum`} data-testid={`sap-${assertion}-override`} />
                      </label>
                      <label className={label}>
                        {fr ? "Motif de la dérogation (obligatoire avec un seuil dérogatoire)" : "Reason for the override (mandatory with an override)"}
                        <input name="thresholdOverrideReason" defaultValue={p?.thresholdOverrideReason ?? ""} className={input} data-testid={`sap-${assertion}-override-reason`} />
                      </label>
                      <label className={`${label} xl:col-span-2`}>
                        {fr ? "Investigation de l'écart (explications de la direction)" : "Investigation of the difference (management's explanations)"}
                        <textarea name="investigation" rows={2} defaultValue={p?.investigation ?? ""} className={input} />
                      </label>
                      <label className={label}>
                        {fr ? "Corroboration (éléments probants obtenus)" : "Corroboration (evidence obtained)"}
                        <textarea name="corroboration" rows={2} defaultValue={p?.corroboration ?? ""} className={input} />
                      </label>
                      <label className={label}>
                        {fr ? "Conclusion sur l'assertion" : "Conclusion on the assertion"}
                        <select name="conclusion" defaultValue={p?.conclusion ?? ""} className={input} data-testid={`sap-${assertion}-conclusion`}>
                          <option value="">—</option>
                          <option value="supported">{fr ? "Assertion étayée" : "Assertion supported"}</option>
                          <option value="not_supported">{fr ? "Assertion non étayée — anomalie / procédures complémentaires" : "Assertion not supported — misstatement / further procedures"}</option>
                        </select>
                      </label>
                      {readOnly ? null : (
                        <div className="flex items-end gap-2">
                          <button type="submit" className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800" data-testid={`sap-${assertion}-save`}>
                            {fr ? "Enregistrer la procédure" : "Save the procedure"}
                          </button>
                          {p?.updatedByName ? <span className="text-[11px] text-muted">{p.updatedByName} · {p.updatedAt}</span> : null}
                        </div>
                      )}
                    </fieldset>
                  </form>
                </Panel>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-muted" data-testid="sap-pick-index">
            {fr ? "Choisir un indice pour construire ou revoir ses procédures analytiques substantives." : "Pick an index to build or review its substantive analytical procedures."}
          </p>
        )}
      </div>
    </main>
  );
}
