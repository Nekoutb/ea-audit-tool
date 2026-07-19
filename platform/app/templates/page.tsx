import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import { DEFAULT_FILE_INDEX, shortTitle } from "@/lib/file-index";
import { canManageFirm, type Role } from "@/lib/rbac";
import { listOverrides } from "@/lib/template-overrides";
import { templateFor } from "@/lib/templates";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Templates · AuditISA" };

export default async function TemplatesPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canManageFirm(session.user.role as Role)) redirect("/dashboard");

  const { saved, error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tp = t.templates;
  const overrides = new Set((await listOverrides()).map((o) => o.code));

  return (
    <main className="min-h-screen w-full px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.01em] text-ink">{tp.title}</h1>
      <p className="mt-1 text-[13px] text-ink-soft">{tp.subtitle}</p>

      {saved ? (
        <p data-testid="template-saved" className="mt-4 rounded-[var(--radius-atlas-sm)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {tp.saved.replace("{code}", saved)}
        </p>
      ) : null}
      {error ? (
        <p data-testid="template-error" className="mt-4 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-[var(--color-rose-soft)] px-4 py-3 text-sm text-rose">
          {(tp.errors as Record<string, string>)[error] ?? error}
        </p>
      ) : null}

      <Panel flush className="mt-6">
        <div className="border-b border-line px-5 py-4">
          <PanelHeader title={tp.list} hint={String(DEFAULT_FILE_INDEX.length)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="templates-table">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">{tp.code}</th>
                <th className="px-5 py-3 font-semibold">{tp.name}</th>
                <th className="px-5 py-3 font-semibold">{tp.base}</th>
                <th className="px-5 py-3 font-semibold">{tp.status}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {DEFAULT_FILE_INDEX.map((entry) => {
                const tmpl = templateFor(entry.code);
                const customized = overrides.has(entry.code);
                return (
                  <tr key={entry.code} className="border-t border-line" data-testid={`template-row-${entry.code}`}>
                    <td className="px-5 py-3 font-mono text-xs font-bold text-ink-soft">{entry.code}</td>
                    <td className="px-5 py-3 font-medium text-ink">
                      {shortTitle(entry.code, locale, locale === "fr" ? entry.titleFr : entry.titleEn)}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">{tmpl.id} v{tmpl.version}</td>
                    <td className="px-5 py-3">
                      {customized ? <Chip tone="warn">{tp.customized}</Chip> : <Chip tone="muted">{tp.standard}</Chip>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/templates/${encodeURIComponent(entry.code)}`}
                        data-testid={`edit-template-${entry.code}`}
                        className="text-[12.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        {tp.edit}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </main>
  );
}
