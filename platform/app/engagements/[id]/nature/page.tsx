import { notFound, redirect } from "next/navigation";
import { localizedTitle } from "@/lib/page-title";
import { auth } from "@/auth";
import { classifyEntityAction } from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { NatureAssessment } from "@/components/NatureAssessment";
import type { ComplexityAnswers } from "@/lib/complexity";
import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { requireTenant } from "@/lib/tenant";

export const generateMetadata = localizedTitle("Nature of entity", "Nature de l'entité");

/**
 * Shown once the engagement is created: seventeen questions conclude the
 * nature of the entity (complex, non-complex, simple), and the conclusion
 * propagates the audit file at the matching scope.
 */
export default async function NaturePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const t = getMessages(locale);
  const te = t.engagements;
  const fr = locale === "fr";

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const { error } = await props.searchParams;

  // The recorded answers and whether the file was already propagated: the
  // questionnaire reopens as saved, and a reclassification once planning has
  // started needs a reason (UAT run 2 B77).
  const { tenantId } = await requireTenant();
  const saved = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ answers: ComplexityAnswers | null; propagated: boolean }>(
      `SELECT e.complexity_answers AS answers,
              EXISTS (SELECT 1 FROM file_item fi WHERE fi.engagement_id = e.id) AS propagated
         FROM engagement e WHERE e.id = $1`,
      [id],
    );
    return r.rows[0] ?? { answers: null, propagated: false };
  });
  const concluded = saved.propagated && saved.answers !== null;
  const needsReason = concluded && engagement.phase !== "acceptance";

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
        <ErrorBanner error={error} locale={locale} />
        {concluded ? (
          <p className="mt-3 text-[13px] text-ink-soft" data-testid="nature-current">
            {fr ? "Conclusion enregistrée : " : "Recorded conclusion: "}
            <b className="text-ink">{te.assessment.levels[engagement.complexity]}</b>
            {needsReason
              ? fr
                ? " — la planification a commencé : une nouvelle conclusion doit être motivée et ajoute les tâches manquantes au dossier."
                : " — planning has started: a new conclusion must state its reason and adds the missing tasks to the file."
              : ""}
          </p>
        ) : null}
        <div className="mt-4">
          <NatureAssessment
            action={boundAction}
            initialAnswers={saved.answers}
            reasonLabel={
              needsReason
                ? fr
                  ? "Motif de la reclassification (obligatoire)"
                  : "Reason for reclassifying (required)"
                : undefined
            }
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
