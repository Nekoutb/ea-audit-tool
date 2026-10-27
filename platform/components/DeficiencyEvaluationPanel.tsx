import { saveDeficiencyEvaluationAction } from "@/app/actions/deficiencies";
import { Chip } from "@/components/ui/atlas";
import { LIKELIHOODS, MAGNITUDES, suggestedGrade, type DeficiencyRow } from "@/lib/deficiencies";
import { FINDING_SEVERITIES, type FindingSeverity } from "@/lib/execution";

/**
 * The ISA 265 evaluation grid on C5.11 (F037): one card per deficiency of the
 * findings register, with the severity factors (likelihood, magnitude,
 * accounts and assertions, management's awareness, the A6–A7 indicators),
 * the related deficiencies considered together, the final grade written back
 * to the register, and the date and recipient of the written communication
 * to those charged with governance. Server-rendered: every card is a form
 * posting to saveDeficiencyEvaluationAction.
 */
export function DeficiencyEvaluationPanel({
  engagementId,
  fileItemId,
  rows,
  locale,
  readOnly,
}: {
  engagementId: string;
  fileItemId: string;
  rows: DeficiencyRow[];
  locale: "en" | "fr";
  readOnly: boolean;
}) {
  const fr = locale === "fr";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-[12.5px] text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60";
  const label = "flex flex-col gap-0.5 text-[11.5px] font-semibold text-ink-soft";
  const gradeLabel: Record<FindingSeverity, [string, string]> = {
    significant_deficiency: ["Significant deficiency", "Déficience significative"],
    deficiency: ["Deficiency", "Déficience"],
    observation: ["Observation", "Observation"],
  };
  const likelihoodLabel: Record<(typeof LIKELIHOODS)[number], [string, string]> = {
    remote: ["Remote", "Peu probable"],
    reasonably_possible: ["Reasonably possible", "Raisonnablement possible"],
    probable: ["Probable", "Probable"],
  };
  const magnitudeLabel: Record<(typeof MAGNITUDES)[number], [string, string]> = {
    inconsequential: ["Inconsequential", "Sans conséquence"],
    significant: ["Significant but not material", "Significative sans être matérielle"],
    material: ["Material", "Matérielle"],
  };
  const tone = (g: FindingSeverity | null) => (g === "significant_deficiency" ? "rose" : g === "deficiency" ? "warn" : g === "observation" ? "good" : "muted");
  const significantPending = rows.filter((r) => r.severity === "significant_deficiency" && !r.evaluation?.communicatedOn).length;

  return (
    <div data-testid="deficiency-grid">
      <p className="text-[12px] text-muted">
        {fr
          ? "Chaque déficience du registre des constats (route C5.11) est appréciée ici : probabilité d'anomalie et ampleur potentielle (ISA 265 A5–A6), comptes et assertions exposés, connaissance par la direction, indicateurs A6–A7, déficiences connexes (A7). La gradation finale est reportée au registre ; la date de communication écrite à la gouvernance est ce que la porte d'archivage lit (¶9)."
          : "Every deficiency on the findings register (route C5.11) is evaluated here: likelihood of misstatement and potential magnitude (ISA 265 A5–A6), accounts and assertions exposed, management's awareness, the A6–A7 indicators, related deficiencies (A7). The final grade is written back to the register; the date of the written communication to those charged with governance is what the archive gate reads (¶9)."}
      </p>
      {significantPending > 0 ? (
        <p className="mt-2 rounded-[var(--radius-atlas-sm)] border border-rose-300 bg-[var(--color-rose-soft)] px-3 py-2 text-[12px] font-semibold text-rose" data-testid="deficiency-gate-warning">
          {fr
            ? `${significantPending} déficience(s) significative(s) sans date de communication écrite — le dossier ne peut pas être archivé (ISA 265 ¶9).`
            : `${significantPending} significant deficiency(ies) with no written-communication date — the file cannot be archived (ISA 265 ¶9).`}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-muted" data-testid="deficiency-grid-empty">
          {fr
            ? "Aucune déficience au registre des constats. Une déficience se consigne depuis un papier de compte (point relevé → C5.11), depuis un test de contrôle (déviation → déficience) ou depuis le registre des constats."
            : "No deficiency on the findings register. A deficiency is raised from an account paper (matter arising → C5.11), from a control test (deviation → deficiency) or from the findings register."}
        </p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((row) => {
          const ev = row.evaluation;
          const suggested = suggestedGrade(ev?.likelihood ?? null, ev?.magnitude ?? null);
          const others = rows.filter((r) => r.findingId !== row.findingId);
          return (
            <li key={row.findingId} id={`deficiency-${row.findingId}`} className="rounded-[var(--radius-atlas)] border border-line bg-surface-2/40 p-3" data-testid={`deficiency-${row.findingId}`}>
              <div className="flex flex-wrap items-baseline gap-2">
                {row.sectionCode ? <span className="font-mono text-[10.5px] text-muted">{row.sectionCode}</span> : null}
                <b className="text-[13px] text-ink">{row.title}</b>
                <Chip tone={tone(row.severity)}>{row.severity ? gradeLabel[row.severity][fr ? 1 : 0] : fr ? "non gradée" : "ungraded"}</Chip>
                <span className="text-[11px] text-muted">{row.status === "open" ? (fr ? "ouverte" : "open") : fr ? "levée" : "cleared"}</span>
                {ev?.communicatedOn ? (
                  <span className="ml-auto text-[11px] text-emerald-700 dark:text-emerald-400" data-testid="deficiency-communicated">
                    {fr ? "Communiquée par écrit le" : "Communicated in writing on"} {ev.communicatedOn} · {ev.recipient}
                  </span>
                ) : row.severity === "significant_deficiency" ? (
                  <span className="ml-auto text-[11px] font-semibold text-rose">{fr ? "Communication écrite non datée" : "Written communication not dated"}</span>
                ) : null}
              </div>
              {row.detail ? <p className="mt-1 text-[12px] text-ink-soft">{row.detail}</p> : null}
              {row.recommendation ? (
                <p className="mt-1 text-[12px] text-muted">
                  {fr ? "Recommandation : " : "Recommendation: "}
                  {row.recommendation}
                </p>
              ) : null}
              <form action={saveDeficiencyEvaluationAction.bind(null, engagementId, fileItemId, row.findingId)} className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                <fieldset disabled={readOnly} className="contents">
                  <label className={label}>
                    {fr ? "Probabilité d'une anomalie (A6)" : "Likelihood of misstatement (A6)"}
                    <select name="likelihood" defaultValue={ev?.likelihood ?? ""} className={input} data-testid="deficiency-likelihood">
                      <option value="">—</option>
                      {LIKELIHOODS.map((l) => (
                        <option key={l} value={l}>{likelihoodLabel[l][fr ? 1 : 0]}</option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    {fr ? "Ampleur potentielle (A6)" : "Potential magnitude (A6)"}
                    <select name="magnitude" defaultValue={ev?.magnitude ?? ""} className={input} data-testid="deficiency-magnitude">
                      <option value="">—</option>
                      {MAGNITUDES.map((m) => (
                        <option key={m} value={m}>{magnitudeLabel[m][fr ? 1 : 0]}</option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    {fr ? "Comptes et assertions concernés" : "Accounts and assertions affected"}
                    <input name="accountsAssertions" defaultValue={ev?.accountsAssertions ?? ""} className={input} placeholder={fr ? "ex. Clients (E) — exhaustivité, exactitude" : "e.g. Receivables (E) — completeness, accuracy"} data-testid="deficiency-accounts" />
                  </label>
                  <label className={label}>
                    {fr ? "La direction en a connaissance" : "Management is aware of it"}
                    <select name="managementAware" defaultValue={ev?.managementAware === true ? "yes" : ev?.managementAware === false ? "no" : ""} className={input}>
                      <option value="">—</option>
                      <option value="yes">{fr ? "Oui" : "Yes"}</option>
                      <option value="no">{fr ? "Non" : "No"}</option>
                    </select>
                  </label>
                  <label className={`${label} xl:col-span-2`}>
                    {fr ? "Indicateurs ISA 265 A6–A7 (fraude de la direction, anomalie significative non détectée par les contrôles, absence de réponse à une déficience connue, environnement de contrôle, ...)" : "ISA 265 A6–A7 indicators (management fraud, material misstatement not detected by controls, no remediation of a known deficiency, control environment, …)"}
                    <input name="indicators" defaultValue={ev?.indicators ?? ""} className={input} data-testid="deficiency-indicators" />
                  </label>
                  <label className={label}>
                    {fr ? "Déficiences connexes à considérer ensemble (A7)" : "Related deficiencies considered together (A7)"}
                    <select name="related" multiple defaultValue={ev?.relatedFindingIds ?? []} className={`${input} h-20`} data-testid="deficiency-related">
                      {others.map((o) => (
                        <option key={o.findingId} value={o.findingId}>{o.sectionCode ? `${o.sectionCode} · ` : ""}{o.title}</option>
                      ))}
                    </select>
                  </label>
                  <label className={`${label} xl:col-span-2`}>
                    {fr ? "Agrégation — effet des déficiences connexes prises ensemble" : "Aggregation — the effect of the related deficiencies taken together"}
                    <input name="aggregationNote" defaultValue={ev?.aggregationNote ?? ""} className={input} data-testid="deficiency-aggregation" />
                  </label>
                  <label className={label}>
                    {fr ? "Gradation finale (reportée au registre)" : "Final grade (written back to the register)"}
                    <select name="grade" required defaultValue={ev?.grade ?? row.severity ?? suggested ?? ""} className={input} data-testid="deficiency-grade">
                      <option value="">—</option>
                      {FINDING_SEVERITIES.map((g) => (
                        <option key={g} value={g}>{gradeLabel[g][fr ? 1 : 0]}{suggested === g ? (fr ? " (suggérée)" : " (suggested)") : ""}</option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    {fr ? "Date de la communication écrite à la gouvernance (¶9)" : "Date communicated in writing to governance (¶9)"}
                    <input name="communicatedOn" type="date" defaultValue={ev?.communicatedOn ?? ""} className={input} data-testid="deficiency-communicated-on" />
                  </label>
                  <label className={label}>
                    {fr ? "Destinataire" : "Recipient"}
                    <input name="recipient" defaultValue={ev?.recipient ?? ""} className={input} placeholder={fr ? "ex. Président du conseil d'administration" : "e.g. Chairman of the board"} data-testid="deficiency-recipient" />
                  </label>
                  {readOnly ? null : (
                    <div className="flex items-end gap-2">
                      <button type="submit" className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800" data-testid="deficiency-save">
                        {fr ? "Enregistrer l'appréciation" : "Save the evaluation"}
                      </button>
                      {ev?.updatedByName ? (
                        <span className="text-[11px] text-muted">{ev.updatedByName} · {ev.updatedAt}</span>
                      ) : null}
                    </div>
                  )}
                </fieldset>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
