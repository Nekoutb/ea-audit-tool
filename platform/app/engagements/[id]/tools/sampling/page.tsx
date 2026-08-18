import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { SamplingStudio } from "@/components/SamplingStudio";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { engagementTasks } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";
import { craRollupByIndex } from "@/lib/cra";
import { listGlAccounts, listScots } from "@/lib/scots";

export const metadata = { title: "Sampling · AuditISA" };

/** Cycle tasks that carry the sampling engine. */
const SAMPLING_CODES = ["E4.1", "E4.2", "E4.3", "E4.4", "E4.5", "E4.8"];

/**
 * The Sampling screen: sizes are computed, never typed — MUS from confidence
 * and tolerable misstatement, attributes from control frequency. The runs live
 * on the cycle tasks; this screen routes to them.
 */
export default async function SamplingPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [tasks, scots, glAccounts, craByIndex] = await Promise.all([
    engagementTasks(id),
    listScots(id),
    listGlAccounts(id),
    craRollupByIndex(id).catch(() => ({})),
  ]);
  const rows = SAMPLING_CODES.map((code) => tasks.find((x) => x.code === code)).filter(
    (x): x is NonNullable<typeof x> => Boolean(x),
  );
  // the purpose list: every control selected for testing on S2.1, with the
  // attributes the frequency table needs — and whether it is the ONLY selected
  // control covering one of its assertions (larger minimum sample).
  const selectedAll = scots.flatMap((s) =>
    s.controls
      .filter((c) => c.selectedForTesting)
      .map((c) => {
        const covered = new Set<string>();
        for (const w of s.wcgws) if (c.wcgwIds.includes(w.id)) for (const a of w.assertions) covered.add(a);
        return { scot: s, c, assertions: [...covered] };
      }),
  );
  const assertionCounts = new Map<string, number>();
  for (const row of selectedAll)
    for (const a of row.assertions) assertionCounts.set(a, (assertionCounts.get(a) ?? 0) + 1);
  const purposes = selectedAll.map(({ scot, c, assertions }) => ({
    controlId: c.id,
    controlName: c.name,
    scotName: scot.name,
    sampleSize: c.sampleSize,
    frequency: c.frequency,
    controlType: c.controlType,
    assertions,
    sole: assertions.some((a) => (assertionCounts.get(a) ?? 0) === 1),
  }));

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="sampling-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Échantillonnage" : "Sampling"}
        </h1>
      </div>

      <Panel className="mt-4">
        <PanelHeader
          title={fr ? "Tests de contrôles — déterminer l'échantillon" : "Tests of controls — determine the sample"}
          hint={fr ? "assigné directement à la conception du test (S2.2)" : "assigned straight onto the test design (S2.2)"}
        />
        <div className="mt-3">
          <SamplingStudio
            engagementId={id}
            purposes={purposes}
            glAccounts={glAccounts}
            craByIndex={craByIndex}
            s22Href={(() => { const t = tasks.find((x) => x.code === "S2.2"); return t ? `/engagements/${id}/sections/${t.id}` : undefined; })()}
            locale={fr ? "fr" : "en"}
          />
        </div>
      </Panel>

      <Panel className="mt-4">
        <p className="text-[13px] text-ink-soft">
          {fr
            ? "Sondages substantifs sur les cycles : les tailles sont calculées, jamais saisies — MUS à partir de la confiance et de l'anomalie tolérable. Ils se lancent depuis la tâche de cycle concernée — ci-dessous."
            : "Substantive sampling on the cycles: sizes are computed, never typed — MUS from confidence and tolerable misstatement. Runs launch from the cycle task concerned — below."}
        </p>
        <ul className="mt-3 divide-y divide-line" data-testid="sampling-tasks">
          {rows.map((task) => (
            <li key={task.code}>
              <Link
                href={`/engagements/${id}/sections/${task.id}`}
                className="flex items-center gap-3 py-2.5 transition hover:bg-surface-2"
                data-testid={`sampling-${task.code}`}
              >
                <span className="font-mono text-[11px] font-semibold text-muted">{task.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {fr ? task.titleFr : task.titleEn}
                </span>
                <span className="flex-shrink-0 text-muted" aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
