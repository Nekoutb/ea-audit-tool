import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { EngagementWizard } from "@/components/EngagementWizard";
import { ErrorBanner } from "@/components/GatesPanel";
import { getBranding } from "@/lib/branding";
import { LEGAL_FORMS, listClients } from "@/lib/clients";
import { listFirmUsers } from "@/lib/team";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "New engagement · AuditISA" };

/** Dedicated engagement-creation screen (identity + complexity assessment). */
export default async function NewEngagementPage(props: {
  searchParams: Promise<{ client?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { client, error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const te = t.engagements;

  // Zero clients no longer bounces to /clients — the wizard's inline
  // "+ New entity…" step creates the first entity in place (IA audit flow F3).
  const [clients, branding, partners] = await Promise.all([listClients(), getBranding(), listFirmUsers()]);

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} />
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{te.newEngagementTitle}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{te.newEngagementHint}</p>
      </div>
      <ErrorBanner error={error} locale={locale} />
      <EngagementWizard
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        partners={partners}
        legalForms={LEGAL_FORMS}
        defaultClientId={client}
        namingPattern={branding.engagementNaming}
        labels={{
          clientLabel: te.client,
          nameLabel: te.name,
          nameHint: te.nameHint,
          yearLabel: te.fiscalYear,
          periodEndLabel: te.periodEnd,
          assessmentTitle: te.assessment.title,
          assessmentHint: te.assessment.hint,
          resultLabel: te.assessment.result,
          levels: te.assessment.levels,
          formsNote: te.assessment.formsNote,
          questions: te.assessment.questions,
          submit: te.createEngagement,
          yes: t.common.yes,
          no: t.common.no,
          partnerLabel: te.partnerLabel,
          partnerNone: te.partnerNone,
          newEntity: te.newEntity,
          newEntityHint: te.newEntityHint,
          entityName: t.clients.name,
          legalForm: t.clients.legalForm,
          listed: t.clients.listed,
          coCac: t.clients.coCac,
        }}
      />
    </main>
  );
}
