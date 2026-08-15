import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel } from "@/components/ui/atlas";
import { engagementTasks } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";

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
  const tasks = await engagementTasks(id);
  const rows = SAMPLING_CODES.map((code) => tasks.find((x) => x.code === code)).filter(
    (x): x is NonNullable<typeof x> => Boolean(x),
  );

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
        <p className="text-[13px] text-ink-soft">
          {fr
            ? "Les tailles d'échantillon sont calculées, jamais saisies : sondage MUS à partir de la confiance et de l'anomalie tolérable, tests par attributs selon la fréquence du contrôle. Les sondages se lancent depuis la tâche de cycle concernée — ci-dessous."
            : "Sample sizes are computed, never typed: MUS from confidence and tolerable misstatement, attribute tests from control frequency. Runs launch from the cycle task concerned — below."}
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
