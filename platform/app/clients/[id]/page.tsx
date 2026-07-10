import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { createEngagementAction } from "@/app/actions/audit-file";
import { addPortalContactAction } from "@/app/actions/pbc";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
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

  const currentYear = new Date().getFullYear();
  const inputClass =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <AppNav locale={locale} />
      <div className="mt-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{client.name}</h1>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {t.clients.legalForm}: {client.legalForm}
          {client.listed ? ` · ${t.clients.listed}` : ""}
          {client.coCac ? ` · ${t.clients.coCac}` : ""}
        </span>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t.engagements.title}
        </h2>
        {engagements.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t.engagements.empty}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="client-engagements">
            {engagements.map((engagement) => (
              <li
                key={engagement.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800"
              >
                <span className="text-sm text-slate-800 dark:text-slate-200">
                  {t.engagements.fiscalYear} {engagement.fiscalYear} —{" "}
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

      <section className="mt-10 rounded-xl border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t.engagements.newEngagement}
        </h2>
        <form action={createEngagementAction} className="mt-4 flex flex-wrap items-end gap-4">
          <input type="hidden" name="clientId" value={client.id} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{t.engagements.fiscalYear}</span>
            <input
              name="fiscalYear"
              type="number"
              min="2000"
              max="2100"
              defaultValue={currentYear}
              required
              className={inputClass}
              data-testid="engagement-year"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{t.engagements.periodEnd}</span>
            <input
              name="periodEnd"
              type="date"
              defaultValue={`${currentYear}-12-31`}
              required
              className={inputClass}
              data-testid="engagement-period-end"
            />
          </label>
          <button
            type="submit"
            data-testid="create-engagement"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {t.engagements.createEngagement}
          </button>
        </form>
      </section>

      <section className="mt-10 rounded-xl border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.pbc.contacts}</h2>
        <ErrorBanner error={error} locale={locale} />
        {contacts.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300" data-testid="portal-contacts">
            {contacts.map((contact) => (
              <li key={contact.id}>
                {contact.name ?? contact.email} — <span className="font-mono text-xs">{contact.email}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={addPortalContactAction.bind(null, client.id)} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{t.pbc.contactName}</span>
            <input name="name" required className={inputClass} data-testid="contact-name" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{t.pbc.contactEmail}</span>
            <input name="email" type="email" required className={inputClass} data-testid="contact-email" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{t.pbc.contactPassword}</span>
            <input name="password" type="password" required minLength={8} className={inputClass} data-testid="contact-password" />
          </label>
          <button
            type="submit"
            data-testid="add-contact"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {t.pbc.addContact}
          </button>
        </form>
      </section>
    </main>
  );
}
