import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { addPortalContactAction } from "@/app/actions/pbc";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { getClient } from "@/lib/clients";
import { listEngagements } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listPortalContacts } from "@/lib/pbc";

export default async function ClientDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);

  const client = await getClient(id);
  if (!client) notFound();
  const [engagements, contacts] = await Promise.all([listEngagements(id), listPortalContacts(id)]);

  const inputClass =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-10">
      <AppNav locale={locale} />
      <div className="mt-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{client.name}</h1>
        <span className="text-sm text-muted">
          {t.clients.legalForm}: {client.legalForm}
          {client.listed ? ` · ${t.clients.listed}` : ""}
          {client.coCac ? ` · ${t.clients.coCac}` : ""}
        </span>
      </div>

      <section className="mt-8">
        <PanelHeader title={t.engagements.title} />
        {engagements.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t.engagements.empty}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="client-engagements">
            {engagements.map((engagement) => (
              <li
                key={engagement.id}
                className="flex items-center justify-between rounded-[var(--radius-atlas)] border border-line bg-surface px-4 py-3 shadow-[var(--shadow-atlas)]"
              >
                <span className="text-sm text-ink-soft">
                  {t.engagements.fiscalYear} <span className="tnum">{engagement.fiscalYear}</span> —{" "}
                  {t.engagements.phases[engagement.phase]}
                </span>
                <Link
                  href={`/engagements/${engagement.id}`}
                  className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {t.engagements.open}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Panel className="mt-10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PanelHeader title={t.engagements.newEngagement} hint={t.engagements.newEngagementHint} />
          <Link
            href={`/new-engagement?client=${client.id}`}
            className={btnPrimary}
            data-testid="new-engagement"
          >
            {t.engagements.newEngagement}
          </Link>
        </div>
      </Panel>

      <Panel className="mt-10 p-6">
        <PanelHeader title={t.pbc.contacts} />
        <ErrorBanner error={error} locale={locale} />
        {contacts.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-soft" data-testid="portal-contacts">
            {contacts.map((contact) => (
              <li key={contact.id}>
                {contact.name ?? contact.email} — <span className="font-mono text-xs">{contact.email}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={addPortalContactAction.bind(null, client.id)} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.pbc.contactName}</span>
            <input name="name" required className={inputClass} data-testid="contact-name" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.pbc.contactEmail}</span>
            <input name="email" type="email" required className={inputClass} data-testid="contact-email" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.pbc.contactPassword}</span>
            <input name="password" type="password" required minLength={8} className={inputClass} data-testid="contact-password" />
          </label>
          <button
            type="submit"
            data-testid="add-contact"
            className={btnPrimary}
          >
            {t.pbc.addContact}
          </button>
        </form>
      </Panel>
    </main>
  );
}
