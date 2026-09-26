import { redirect } from "next/navigation";
import { localizedTitle } from "@/lib/page-title";
import Link from "next/link";
import { auth } from "@/auth";
import { createClientAction } from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { Chip, Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { LEGAL_FORMS, SECTORS, legalFormLabel, listClients } from "@/lib/clients";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canWrite } from "@/lib/rbac";

export const generateMetadata = localizedTitle("Entity records", "Fiches des entités");

export default async function ClientsPage(props: {
  searchParams: Promise<{ q?: string; archived?: string; error?: string; name?: string; legalForm?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { q = "", archived, error, name: draftName = "", legalForm: draftLegalForm = "SA" } = await props.searchParams;
  // A refused duplicate comes back with the typed values, so the form can be
  // resubmitted as "create anyway" without retyping (UAT B96).
  const duplicate = error === "duplicate-client";
  const showArchived = archived === "1";
  const locale = await getLocale();
  const t = getMessages(locale);
  // Search and the retired toggle (UAT B98); the create panel only for a role
  // that can write (UAT B127).
  const clients = await listClients({ q, includeArchived: showArchived });
  const writer = canWrite(session.user.role);
  const toggleHref = `/clients?${new URLSearchParams({ ...(q ? { q } : {}), ...(showArchived ? {} : { archived: "1" }) }).toString()}`;

  const inputClass =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em] text-ink">
        {t.clients.title}
      </h1>
      <ErrorBanner error={error} locale={locale} />

      <form method="get" action="/clients" className="mt-4 flex flex-wrap items-end gap-3" data-testid="clients-search">
        {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft">{t.clients.search}</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t.clients.searchPlaceholder}
            className={`${inputClass} w-72`}
            data-testid="clients-q"
          />
        </label>
        <button type="submit" className={btnPrimary}>
          {t.clients.search}
        </button>
        <Link href={toggleHref} className="pb-2 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400" data-testid="clients-archived-toggle">
          {showArchived ? t.clients.hideArchived : t.clients.showArchived}
        </Link>
      </form>

      {clients.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{q ? t.clients.noMatch : t.clients.empty}</p>
      ) : (
        <Panel flush className="mt-6 overflow-x-auto">
          <table className="w-full text-sm" data-testid="clients-table">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">{t.clients.name}</th>
                <th className="px-4 py-3 font-semibold">{t.clients.legalForm}</th>
                <th className="px-4 py-3 font-semibold">{locale === "fr" ? "Nº d'immatriculation" : "Registration nº"}</th>
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
                  <td className="px-4 py-3 font-medium text-ink">
                    {client.name}
                    {client.archivedAt ? <span className="ml-2"><Chip tone="muted">{t.clients.archivedChip}</Chip></span> : null}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{legalFormLabel(client.legalForm, locale)}</td>
                  <td className="px-4 py-3 text-ink-soft tnum" data-testid={`client-registration-${client.id}`}>{client.registrationNumber ?? "—"}</td>
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

      {writer ? (
      <Panel className="mt-10 p-6">
        <PanelHeader title={t.clients.newClient} />
        <form action={createClientAction} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.clients.name}</span>
            <input name="name" required defaultValue={draftName} className={inputClass} data-testid="client-name" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.clients.legalForm}</span>
            <select name="legalForm" className={inputClass} defaultValue={draftLegalForm}>
              {LEGAL_FORMS.map((form) => (
                <option key={form} value={form}>
                  {legalFormLabel(form, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.clients.sector}</span>
            <select name="sector" className={inputClass} defaultValue="" data-testid="client-sector">
              <option value="">—</option>
              {SECTORS.map((sector) => (
                <option key={sector} value={sector}>
                  {t.clients.sectors[sector]}
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
          {duplicate ? (
            <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-warn">
              <input type="checkbox" name="force" value="1" data-testid="client-force" />{" "}
              {locale === "fr" ? "Créer quand même (doublon assumé)" : "Create anyway (duplicate accepted)"}
            </label>
          ) : null}
          <button type="submit" data-testid="create-client" className={btnPrimary}>
            {t.clients.createClient}
          </button>
        </form>
      </Panel>
      ) : null}
    </main>
  );
}
