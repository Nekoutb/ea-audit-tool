import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { classifyEntityAction } from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { NatureAssessment } from "@/components/NatureAssessment";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Nature of entity · AuditISA" };

/**
 * Shown once the engagement is created: seventeen questions conclude the
 * nature of the entity (complex, non-complex, simple), and the conclusion
 * propagates the audit file at the matching scope.
 */
export default async function NaturePage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const t = getMessages(locale);
  const te = t.engagements;
  const fr = locale === "fr";

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const boundAction = classifyEntityAction.bind(null, id);

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mx-auto w-full max-w-4xl pt-4">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink" data-testid="nature-title">
          {fr ? "Nature de l’entité" : "Nature of entity"}
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          {engagement.name ?? engagement.clientName}
          <span className="px-2 text-line-strong">·</span>
          {fr
            ? "La conclusion détermine l’étendue des tâches créées dans le dossier."
            : "The conclusion determines the scope of the tasks propagated into the file."}
        </p>
        <div className="mt-4">
          <NatureAssessment
            action={boundAction}
            labels={{
              title: fr ? "Questionnaire — nature de l’entité" : "Nature of entity questionnaire",
              hint: te.assessment.hint,
              resultLabel: te.assessment.result,
              levels: te.assessment.levels,
              formsNote: te.assessment.formsNote,
              questions: te.assessment.questions,
              submit: fr ? "Conclure et créer les tâches" : "Conclude and propagate tasks",
              scopeNote: {
                complex: fr
                  ? "Étendue complète des travaux."
                  : "The full range of activities will be performed.",
                non_complex: fr
                  ? "Étendue standard, formulaires étendus exclus."
                  : "Standard scope; the extended forms are excluded.",
                very_simple: fr
                  ? "Travaux principalement substantifs lorsque la phase concernée est atteinte."
                  : "Substantive procedures will be performed primarily when that phase is reached.",
              },
            }}
          />
        </div>
      </div>
    </main>
  );
}
