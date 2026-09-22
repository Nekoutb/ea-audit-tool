import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { SamplingStudio } from "@/components/SamplingStudio";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { engagementTasks } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";
import { listScots } from "@/lib/scots";

export const metadata = { title: "Sampling · AuditISA" };

/** Cycle tasks that carry the sampling engine. */

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
  const [tasks, scots] = await Promise.all([engagementTasks(id), listScots(id)]);
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
    population: c.tocPopulation,
    sampleItems: c.tocSampleItems ?? [],
    drawnAt: c.tocSampleDrawnAt,
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
            s22Href={(() => { const t = tasks.find((x) => x.code === "S2.2"); return t ? `/engagements/${id}/sections/${t.id}` : undefined; })()}
            locale={fr ? "fr" : "en"}
          />
        </div>
      </Panel>

    </main>
  );
}
