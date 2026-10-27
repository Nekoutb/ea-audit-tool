import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveSignoffPolicyAction, saveTaskRulesAction } from "@/app/actions/signoff-policy";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { SignoffMatrixImport } from "@/components/SignoffMatrixImport";
import { SubmitButton } from "@/components/SubmitButton";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { localizedTitle } from "@/lib/page-title";
import { atLeast, isRole } from "@/lib/rbac";
import { MATRIX_ROLE_LABELS, matrixTasks, phaseLabel } from "@/lib/signoff-matrix";
import { TEAM_LADDER, effectiveTaskRule, getPolicy } from "@/lib/signoff-policy";

export const generateMetadata = localizedTitle("Sign-off rules", "Règles de signature");

/**
 * The firm's sign-off rules (F002): the policy defaults, the per-task role
 * table, and the Excel matrix round-trip. Firm administrators and partners.
 */
export default async function SignoffSettingsPage(props: {
  searchParams: Promise<{ error?: string; saved?: string; n?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isRole(session.user.role) || !atLeast(session.user.role, "partner")) notFound();

  const { error, saved, n } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const t = getMessages(locale);
  const { policy, rules } = await getPolicy();
  const roleLabel = (role: (typeof TEAM_LADDER)[number]) => MATRIX_ROLE_LABELS[role][fr ? "fr" : "en"];
  const tasks = matrixTasks();
  const phases = [...new Set(tasks.map((x) => x.phase))];

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const th =
    "border-b border-line bg-surface-2 px-3 py-2 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const td = "border-t border-line px-3 py-2 align-middle text-[12.5px]";

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <Link href="/settings" className="mt-8 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
        ← {t.settings.title}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-ink">
        {fr ? "Règles de signature du cabinet" : "Firm sign-off rules"}
      </h1>
      <p className="mt-1 max-w-3xl text-[13px] text-ink-soft">
        {fr
          ? "Chaque signature est donnée par un membre de l'équipe ayant accepté la mission, au rang minimum requis pour la tâche. Les signatures d'associé sont celles de l'associé responsable de la mission ou de son délégué. Rang : Assistant audit < Senior < Manager < Senior manager < Directeur < Associé."
          : "Every sign-off is given by an accepted member of the engagement team at or above the task's minimum role. Partner sign-offs belong to the engagement partner or their delegate. Ladder: Staff < Senior < Manager < Senior manager < Director < Partner."}
      </p>
      <ErrorBanner error={error} locale={locale} />
      {saved ? (
        <p
          className="mt-4 rounded-[var(--radius-atlas-sm)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          data-testid="signoff-saved"
        >
          {saved === "rules"
            ? fr
              ? `Règles enregistrées (${n ?? 0} tâche(s) modifiée(s)).`
              : `Rules saved (${n ?? 0} task(s) changed).`
            : fr
              ? "Politique enregistrée."
              : "Policy saved."}
        </p>
      ) : null}

      {/* (a) the policy defaults */}
      <Panel className="mt-6 p-6" data-testid="signoff-policy-panel">
        <PanelHeader
          title={fr ? "Politique par défaut" : "Policy defaults"}
          hint={
            fr
              ? "relève la matrice par défaut pour toute tâche sans règle propre"
              : "raises the default matrix for every task without a rule of its own"
          }
        />
        <form action={saveSignoffPolicyAction} className="mt-4 flex flex-col gap-4">
          <label className="flex max-w-md flex-col gap-1 text-sm text-ink-soft">
            {fr ? "Rôle minimum du réviseur (plancher, toutes tâches)" : "Minimum reviewer role (floor, every task)"}
            <select name="minReviewerRole" defaultValue={policy.minReviewerRole} className={input} data-testid="policy-min-reviewer">
              {TEAM_LADDER.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex max-w-3xl flex-col gap-1 text-sm text-ink-soft">
            {fr
              ? "Tâches exigeant la signature de l'associé (codes, en plus de la matrice par défaut ; « Non » dans le tableau par tâche la lève)"
              : "Tasks requiring the partner's sign-off (codes, in addition to the default matrix; \"No\" in the per-task table lifts one)"}
            <textarea
              name="requirePartnerOn"
              rows={2}
              defaultValue={policy.requirePartnerOn.join(", ")}
              className={`${input} font-mono`}
              data-testid="policy-require-partner"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="requireDistinct"
              defaultChecked={policy.requireDistinctPreparerApprover}
              data-testid="policy-distinct"
            />
            {fr
              ? "Le préparateur et l'approbateur d'une tâche doivent être deux personnes différentes"
              : "A task's preparer and approver must be two different people"}
          </label>
          <div className="flex items-center gap-2 text-sm text-muted" data-testid="policy-sole-practitioner">
            <input type="checkbox" disabled checked={false} readOnly aria-describedby="sole-practitioner-note" />
            <span>
              {fr ? "Exemption du praticien individuel (auto-revue)" : "Sole-practitioner exemption (self-review)"}
              {" — "}
              <strong id="sole-practitioner-note">{fr ? "non autorisée" : "not permitted"}</strong>
              {fr
                ? " : le préparateur d'un papier ne le révise jamais (ISA 220 ¶29)."
                : ": the preparer of a paper never reviews it (ISA 220 ¶29)."}
            </span>
          </div>
          <div>
            <SubmitButton className={btnPrimary} testId="policy-save">
              {fr ? "Enregistrer la politique" : "Save the policy"}
            </SubmitButton>
          </div>
        </form>
      </Panel>

      {/* (c) the Excel round-trip */}
      <Panel className="mt-6 p-6" data-testid="signoff-matrix-panel">
        <PanelHeader
          title={fr ? "Matrice Excel" : "Excel matrix"}
          hint={
            fr
              ? "feuille « Tasks » : seules les colonnes I à K sont importées ; une cellule vide applique la règle par défaut"
              : 'sheet "Tasks": only columns I to K are imported; a blank cell applies the firm default'
          }
        />
        <div className="mt-4 flex flex-col gap-5">
          <div>
            <a href="/api/settings/signoff-matrix" className={btnPrimary} data-testid="signoff-matrix-download">
              {fr ? "Télécharger la matrice (Excel)" : "Download the matrix (Excel)"}
            </a>
          </div>
          <SignoffMatrixImport locale={fr ? "fr" : "en"} errorMessages={t.planning.errors as Record<string, string>} />
        </div>
      </Panel>

      {/* (b) the per-task table */}
      <Panel flush className="mt-6" data-testid="signoff-rules-panel">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader
            title={fr ? "Règles par tâche" : "Rules per task"}
            hint={
              fr
                ? `${tasks.length} tâches · « Par défaut » affiche entre parenthèses la valeur qui s'applique`
                : `${tasks.length} tasks · "Default" shows in brackets the value that applies`
            }
          />
        </div>
        <form action={saveTaskRulesAction}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]" data-testid="signoff-rules-table">
              <thead>
                <tr>
                  <th className={th}>Code</th>
                  <th className={th}>{fr ? "Tâche" : "Task"}</th>
                  <th className={th}>{fr ? "Préparateur minimum" : "Minimum preparer"}</th>
                  <th className={th}>{fr ? "Réviseur minimum" : "Minimum reviewer"}</th>
                  <th className={th}>{fr ? "Signature associé" : "Partner sign-off"}</th>
                </tr>
              </thead>
              {phases.map((phase) => (
                <tbody key={phase}>
                  <tr>
                    <th colSpan={5} className="bg-surface-2 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                      {phaseLabel(phase, fr ? "fr" : "en")}
                    </th>
                  </tr>
                  {tasks
                    .filter((x) => x.phase === phase)
                    .map(({ entry }) => {
                      const rule = rules.get(entry.code);
                      // what "default" resolves to: the firm policy, without this task's own rule
                      const fallback = effectiveTaskRule(policy, new Map(), entry.code);
                      const title = fr ? entry.titleFr : entry.titleEn;
                      return (
                        <tr key={entry.code} data-testid={`signoff-rule-${entry.code}`}>
                          <td className={`${td} font-mono font-bold text-ink-soft`}>{entry.code}</td>
                          <td className={`${td} text-ink`}>{title}</td>
                          <td className={td}>
                            <select
                              name={`prep:${entry.code}`}
                              defaultValue={rule?.minPreparer ?? ""}
                              className={input}
                              aria-label={`${entry.code} — ${fr ? "préparateur minimum" : "minimum preparer"}`}
                            >
                              <option value="">
                                {fr ? "Par défaut" : "Default"} ({roleLabel(fallback.minPreparer)})
                              </option>
                              {TEAM_LADDER.map((r) => (
                                <option key={r} value={r}>
                                  {roleLabel(r)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={td}>
                            <select
                              name={`rev:${entry.code}`}
                              defaultValue={rule?.minReviewer ?? ""}
                              className={input}
                              aria-label={`${entry.code} — ${fr ? "réviseur minimum" : "minimum reviewer"}`}
                            >
                              <option value="">
                                {fr ? "Par défaut" : "Default"} ({roleLabel(fallback.minReviewer)})
                              </option>
                              {TEAM_LADDER.map((r) => (
                                <option key={r} value={r}>
                                  {roleLabel(r)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={td}>
                            <select
                              name={`partner:${entry.code}`}
                              defaultValue={
                                rule?.partnerRequired === true ? "yes" : rule?.partnerRequired === false ? "no" : ""
                              }
                              className={input}
                              aria-label={`${entry.code} — ${fr ? "signature associé" : "partner sign-off"}`}
                            >
                              <option value="">
                                {fr ? "Par défaut" : "Default"} (
                                {fallback.partnerRequired ? (fr ? "oui" : "yes") : fr ? "non" : "no"})
                              </option>
                              <option value="yes">{fr ? "Oui" : "Yes"}</option>
                              <option value="no">{fr ? "Non" : "No"}</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              ))}
            </table>
          </div>
          <div className="border-t border-line px-5 py-4">
            <SubmitButton className={btnPrimary} testId="signoff-rules-save">
              {fr ? "Enregistrer les règles" : "Save the rules"}
            </SubmitButton>
          </div>
        </form>
      </Panel>
    </main>
  );
}
