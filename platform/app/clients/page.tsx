import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { createClientAction } from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { LEGAL_FORMS, listClients } from "@/lib/clients";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Clients · AuditISA" };

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const locale = await getLocale();
  const t = getMessages(locale);
  const clients = await listClients();

  const inputClass =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em] text-ink">
        {t.clients.title}
      </h1>

      {clients.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t.clients.empty}</p>
      ) : (
        <Panel flush className="mt-6 overflow-x-auto">
          <table className="w-full text-sm" data-testid="clients-table">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">{t.clients.name}</th>
                <th className="px-4 py-3 font-semibold">{t.clients.legalForm}</th>
                <th className="px-4 py-3 font-semibold">{t.clients.engagements}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-t border-line transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-3 font-medium text-ink">{client.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{client.legalForm}</td>
                  <td className="px-4 py-3 text-ink-soft tnum">{client.engagementCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clients/${client.id}`}
                      className="inline-flex min-h-[24px] items-center font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {t.clients.view}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel className="mt-10 p-6">
        <PanelHeader title={t.clients.newClient} />
        <form action={createClientAction} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.clients.name}</span>
            <input name="name" required className={inputClass} data-testid="client-name" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.clients.legalForm}</span>
            <select name="legalForm" className={inputClass} defaultValue="SA">
              {LEGAL_FORMS.map((form) => (
                <option key={form} value={form}>
                  {form}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink-soft">
            <input type="checkbox" name="listed" /> {t.clients.listed}
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink-soft">
            <input type="checkbox" name="coCac" /> {t.clients.coCac}
          </label>
          <button type="submit" data-testid="create-client" className={btnPrimary}>
            {t.clients.createClient}
          </button>
        </form>
      </Panel>
    </main>
  );
}
