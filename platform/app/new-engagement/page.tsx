import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { EngagementWizard } from "@/components/EngagementWizard";
import { ErrorBanner } from "@/components/GatesPanel";
import { listClients } from "@/lib/clients";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "New engagement · AuditISA" };

/** Engagement creation: the three identity questions; scope and team follow. */
export default async function NewEngagementPage(props: {
  searchParams: Promise<{ client?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { client, error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const te = t.engagements;

  const clients = await listClients();
  // The ?client= parameter (from an entity page) preselects that client's name.
  const defaultClientName = client ? clients.find((c) => c.id === client)?.name : undefined;

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} />
      <div className="mx-auto w-full max-w-4xl pt-4">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{te.newEngagementTitle}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{te.newEngagementHint}</p>
        <ErrorBanner error={error} locale={locale} />
        <div className="mt-4">
          <EngagementWizard
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            defaultClientName={defaultClientName}
            locale={locale === "fr" ? "fr" : "en"}
            labels={{
              clientLabel: te.client,
              yearLabel: te.fiscalYear,
              submit: te.createEngagement,
            }}
          />
        </div>
      </div>
    </main>
  );
}
