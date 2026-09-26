import { notFound, redirect } from "next/navigation";
import { localizedTitle } from "@/lib/page-title";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { SubmitButton } from "@/components/SubmitButton";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { listEngagements } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";
import { listResults, progressFor, recordResult, uatAvailable } from "@/lib/uat";
import { UAT_SECTIONS, type UatStatus } from "@/lib/uat-scenarios";

export const generateMetadata = localizedTitle("Acceptance testing", "Recette utilisateur");

/**
 * The acceptance-testing workbook.
 *
 * It lives inside the application rather than in a document for one reason:
 * a tester is already here. Every scenario links to the screen it is about, so
 * there is no hunting, and the verdict is recorded where the next person can
 * see it instead of in a copy of a spreadsheet on somebody's laptop.
 *
 * Present only on the dev/staging instance — see lib/uat.ts.
 */
async function saveAction(formData: FormData): Promise<void> {
  "use server";
  const scenarioKey = String(formData.get("scenarioKey") ?? "");
  await recordResult({
    scenarioKey,
    status: String(formData.get("status") ?? "not_started"),
    notes: String(formData.get("notes") ?? ""),
  });
  redirect(`/uat?saved=${encodeURIComponent(scenarioKey)}#${encodeURIComponent(scenarioKey)}`);
}

const STATUS_LABEL: Record<UatStatus, { en: string; fr: string; tone: string }> = {
  not_started: { en: "Not started", fr: "Non commencé", tone: "border-line text-muted" },
  passed: {
    en: "Works",
    fr: "Fonctionne",
    tone: "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  failed: {
    en: "Does not work",
    fr: "Ne fonctionne pas",
    tone: "border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  },
  blocked: {
    en: "Could not test",
    fr: "Test impossible",
    tone: "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

export default async function UatPage(props: {
  searchParams: Promise<{ engagement?: string; saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Absent on production, not merely hidden: acceptance testing means creating
  // rubbish data and archiving files to watch the refusal.
  if (!uatAvailable()) notFound();

  const { engagement: chosen, saved } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const [results, engagements] = await Promise.all([listResults(), listEngagements()]);
  const progress = progressFor(results);
  const mine = new Map(results.filter((r) => r.mine).map((r) => [r.scenarioKey, r]));
  const others = results.filter((r) => !r.mine && r.status !== "not_started");

  const engagementId = chosen || engagements[0]?.id || null;
  const linkFor = (path?: string): string | null => {
    if (!path) return null;
    if (!path.includes(":id")) return path;
    return engagementId ? path.replace(":id", engagementId) : null;
  };

  const input =
    "w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <>
      <AppNav locale={locale} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">
          {fr ? "Recette · instance de test" : "Acceptance testing · staging"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-ink">
          {fr ? "Cahier de recette" : "Acceptance test workbook"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {fr
            ? "Parcourez chaque point, sur cette instance de test uniquement. Pour chacun : dites s'il fonctionne, et décrivez précisément ce qui s'est passé si ce n'est pas le cas. Vos réponses sont enregistrées au fur et à mesure et visibles par les autres testeurs."
            : "Work through each item, on this staging instance only. For each one: say whether it works, and describe exactly what happened if it does not. Your answers are saved as you go and visible to the other testers."}
        </p>

        <Panel className="mt-6 p-5">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <span className="text-ink">
              <b className="text-2xl">{progress.passed}</b>
              <span className="text-muted">
                {" "}
                / {progress.total} {fr ? "vérifiés" : "confirmed working"}
              </span>
            </span>
            {progress.failed > 0 ? (
              <span className="text-rose">
                {progress.failed} {fr ? "en échec" : "not working"}
              </span>
            ) : null}
            {progress.blocked > 0 ? (
              <span className="text-amber-700 dark:text-amber-400">
                {progress.blocked} {fr ? "impossibles à tester" : "could not test"}
              </span>
            ) : null}
            <span className="text-muted">
              {progress.notStarted} {fr ? "à faire" : "to do"}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full bg-emerald-600"
              style={{ width: `${Math.round((progress.passed / progress.total) * 100)}%` }}
            />
          </div>
        </Panel>

        {engagements.length > 0 ? (
          <Panel className="mt-4 p-5">
            <PanelHeader
              title={fr ? "Mission utilisée pour les liens" : "Engagement the links point at"}
            />
            <form className="mt-3 flex flex-wrap items-end gap-3">
              <select
                name="engagement"
                defaultValue={engagementId ?? ""}
                className={`${input} max-w-sm`}
              >
                {engagements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.clientName} — {e.fiscalYear}
                  </option>
                ))}
              </select>
              <SubmitButton className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
                {fr ? "Utiliser" : "Use this one"}
              </SubmitButton>
            </form>
          </Panel>
        ) : (
          <p className="mt-4 rounded-[var(--radius-atlas-sm)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            {fr
              ? "Aucune mission sur cette instance : commencez par la section 3, qui en crée une."
              : "No engagements on this instance yet — start at section 3, which creates one."}
          </p>
        )}

        <Panel className="mt-4 p-5">
          <PanelHeader title={fr ? "Les phases" : "The phases"} />
          <ul className="mt-3 space-y-1.5 text-sm">
            {UAT_SECTIONS.map((section) => {
              const done = section.scenarios.filter(
                (x) => mine.get(x.key)?.status === "passed",
              ).length;
              return (
                <li key={section.key}>
                  <a
                    href={`#${section.key}`}
                    className="text-emerald-700 hover:underline dark:text-emerald-500"
                  >
                    {section.title}
                  </a>
                  <span className="text-muted">
                    {" — "}
                    {done} / {section.scenarios.length} {fr ? "vérifiés" : "confirmed"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        {UAT_SECTIONS.map((section) => (
          <section key={section.key} id={section.key} className="mt-10 scroll-mt-4">
            <h2 className="text-xl font-semibold text-ink">{section.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{section.intro}</p>

            {section.scenarios.map((scenario) => {
              const result = mine.get(scenario.key);
              const status: UatStatus = result?.status ?? "not_started";
              const href = linkFor(scenario.path);
              const otherAnswers = others.filter((o) => o.scenarioKey === scenario.key);
              return (
                <Panel key={scenario.key} className="mt-4 p-5" id={scenario.key}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-ink">
                      {scenario.ref ? (
                        <span className="mr-2 rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-500">
                          {scenario.ref}
                        </span>
                      ) : null}
                      {scenario.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_LABEL[status].tone}`}
                    >
                      {fr ? STATUS_LABEL[status].fr : STATUS_LABEL[status].en}
                    </span>
                  </div>
                  {scenario.why ? (
                    <p className="mt-2 text-sm italic text-muted">{scenario.why}</p>
                  ) : null}

                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink">
                    {scenario.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>

                  <p className="mt-3 rounded-[var(--radius-atlas-sm)] border border-line bg-canvas px-3 py-2 text-sm text-ink">
                    <b>{fr ? "Attendu : " : "Expected: "}</b>
                    {scenario.expect}
                  </p>

                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener"
                      className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-500"
                    >
                      {fr ? "Ouvrir l'écran concerné →" : "Open the screen →"}
                    </a>
                  ) : null}

                  <form action={saveAction} className="mt-4 border-t border-line pt-4">
                    <input type="hidden" name="scenarioKey" value={scenario.key} />
                    <div className="flex flex-wrap gap-4">
                      {(Object.keys(STATUS_LABEL) as UatStatus[]).map((value) => (
                        <label key={value} className="flex items-center gap-2 text-sm text-ink">
                          <input
                            type="radio"
                            name="status"
                            value={value}
                            defaultChecked={status === value}
                            className="accent-emerald-700"
                          />
                          {fr ? STATUS_LABEL[value].fr : STATUS_LABEL[value].en}
                        </label>
                      ))}
                    </div>
                    <label className="mt-3 block text-sm">
                      <span className="text-ink-soft">
                        {fr
                          ? "Ce qui s'est passé — écran, étape, message exact, et ce que vous attendiez"
                          : "What happened — the screen, the step, the exact message, and what you expected instead"}
                      </span>
                      <textarea
                        name="notes"
                        rows={3}
                        defaultValue={result?.notes ?? ""}
                        className={`${input} mt-1`}
                      />
                    </label>
                    <div className="mt-3 flex items-center gap-3">
                      <SubmitButton className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                        {fr ? "Enregistrer" : "Save"}
                      </SubmitButton>
                      {saved === scenario.key ? (
                        <span className="text-sm text-emerald-700 dark:text-emerald-500">
                          {fr ? "Enregistré" : "Saved"}
                        </span>
                      ) : null}
                      {result?.updatedAt ? (
                        <span className="text-xs text-muted">
                          {fr ? "Dernière réponse " : "Last answered "}
                          {/* firm time, labelled — not the server's UTC (UAT B165) */}
                          {new Date(result.updatedAt).toLocaleString(fr ? "fr-FR" : "en-GB", { timeZone: "Africa/Douala", timeZoneName: "short" })}
                        </span>
                      ) : null}
                    </div>
                  </form>

                  {otherAnswers.length > 0 ? (
                    <div className="mt-3 border-t border-line pt-3">
                      {otherAnswers.map((o) => (
                        <p key={o.who} className="text-xs text-muted">
                          <b className="text-ink-soft">{o.who}</b>
                          {" — "}
                          {fr ? STATUS_LABEL[o.status].fr : STATUS_LABEL[o.status].en}
                          {o.notes ? `: ${o.notes}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </Panel>
              );
            })}
          </section>
        ))}
      </main>
    </>
  );
}
