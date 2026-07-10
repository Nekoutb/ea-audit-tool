import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { createClientAction } from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { LEGAL_FORMS, listClients } from "@/lib/clients";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const locale = await getLocale();
  const t = getMessages(locale);
  const clients = await listClients();

  const inputClass =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {t.clients.title}
      </h1>

      {clients.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t.clients.empty}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm" data-testid="clients-table">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{t.clients.name}</th>
                <th className="px-4 py-3">{t.clients.legalForm}</th>
                <th className="px-4 py-3">{t.clients.engagements}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {client.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {client.legalForm}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {client.engagementCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {t.clients.view}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-10 rounded-xl border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t.clients.newClient}
        </h2>
        <form action={createClientAction} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{t.clients.name}</span>
            <input name="name" required className={inputClass} data-testid="client-name" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{t.clients.legalForm}</span>
            <select name="legalForm" className={inputClass} defaultValue="SA">
              {LEGAL_FORMS.map((form) => (
                <option key={form} value={form}>
                  {form}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" name="listed" /> {t.clients.listed}
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" name="coCac" /> {t.clients.coCac}
          </label>
          <button
            type="submit"
            data-testid="create-client"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {t.clients.createClient}
          </button>
        </form>
      </section>
    </main>
  );
}
