import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel, btnPrimary } from "@/components/ui/atlas";
import { answerText, cleanFilters, firmActivityFacets, listFirmActivity } from "@/lib/audit-log";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { localizedTitle } from "@/lib/page-title";

export const generateMetadata = localizedTitle("Audit log", "Journal d'audit");

/**
 * Settings > Audit log (F027): every entry of the firm's activity log, across
 * all engagements and the firm-level actions, filterable and paginated, with a
 * CSV export of the filtered set. Firm administrators only.
 */
export default async function FirmAuditLogPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "firm_admin") notFound();

  const raw = await props.searchParams;
  const filters = cleanFilters(raw);
  const page = Number(raw.page ?? "1") || 1;
  const locale = await getLocale();
  const t = getMessages(locale);
  const ta = t.auditLog;
  const [{ rows, total, page: current, pages }, facets] = await Promise.all([
    listFirmActivity(filters, page),
    firmActivityFacets(),
  ]);

  // the filters, as a query string, for the pager and the export
  const qs = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-emerald-600";
  const th =
    "border-b border-line bg-surface-2 px-2.5 py-2 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const td = "border-t border-line px-2.5 py-1.5 align-top text-[12px]";
  const clip = (s: string | null) => {
    const text = answerText(s);
    if (text === null) return "—";
    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  };

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <Link href="/settings" className="mt-8 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
        ← {t.settings.title}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-ink">{ta.title}</h1>
      <p className="mt-1 max-w-3xl text-[13px] text-ink-soft">{ta.intro}</p>

      <Panel className="mt-5 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3" data-testid="audit-log-filters">
          <label className="flex flex-col gap-1 text-[12px] text-ink-soft">
            {ta.user}
            <select name="userId" defaultValue={filters.userId ?? ""} className={input}>
              <option value="">{ta.all}</option>
              {facets.users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-soft">
            {ta.engagement}
            <select name="engagementId" defaultValue={filters.engagementId ?? ""} className={input}>
              <option value="">{ta.all}</option>
              <option value="firm">{ta.firmLevel}</option>
              {facets.engagements.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-soft">
            {ta.from}
            <input type="date" name="from" defaultValue={filters.from ?? ""} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-soft">
            {ta.to}
            <input type="date" name="to" defaultValue={filters.to ?? ""} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-soft">
            {ta.entity}
            <select name="entityType" defaultValue={filters.entityType ?? ""} className={input}>
              <option value="">{ta.all}</option>
              {facets.entityTypes.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-soft">
            {ta.action}
            <select name="action" defaultValue={filters.action ?? ""} className={input}>
              <option value="">{ta.all}</option>
              {facets.actions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          <button type="submit" className={btnPrimary} data-testid="audit-log-apply">{ta.apply}</button>
          <Link href="/settings/audit-log" className="text-[12.5px] font-medium text-ink-soft hover:underline">{ta.reset}</Link>
          <a href={`/api/settings/audit-log${qs()}`} className="ml-auto text-[12.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400" data-testid="audit-log-export">
            {ta.exportCsv}
          </a>
        </form>
      </Panel>

      <p className="mt-4 text-[12px] text-muted" data-testid="audit-log-count">
        {ta.count.replace("{n}", String(total)).replace("{page}", String(current)).replace("{pages}", String(pages))}
      </p>
      <div className="mt-2 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
        <table className="w-full border-collapse" data-testid="audit-log-table">
          <thead>
            <tr>
              <th className={th}>{ta.at}</th>
              <th className={th}>{ta.user}</th>
              <th className={th}>{ta.engagement}</th>
              <th className={th}>{ta.entity}</th>
              <th className={th}>{ta.action}</th>
              <th className={th}>{ta.summary}</th>
              <th className={th}>{ta.before}</th>
              <th className={th}>{ta.after}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={td} colSpan={8}>{ta.empty}</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} whitespace-nowrap tnum text-muted`}>{r.at}</td>
                  <td className={td}>
                    {r.userName ?? "—"}
                    {r.actingRole ? <span className="block text-[10.5px] text-muted">{r.actingRole}</span> : null}
                  </td>
                  <td className={td}>{r.engagementName ?? ta.firmLevel}</td>
                  <td className={`${td} font-mono text-[11px]`}>{r.entityType}</td>
                  <td className={`${td} font-mono text-[11px]`}>
                    {r.action}
                    {r.outcome !== "success" ? <span className="block text-rose">{r.outcome}</span> : null}
                  </td>
                  <td className={td}>{r.summary ?? "—"}</td>
                  <td className={`${td} max-w-[220px] break-words text-ink-soft`}>{clip(r.beforeValue)}</td>
                  <td className={`${td} max-w-[220px] break-words text-ink-soft`}>{clip(r.afterValue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className="mt-3 flex items-center gap-3 text-[12.5px]" data-testid="audit-log-pager">
          {current > 1 ? <Link href={`/settings/audit-log${qs({ page: String(current - 1) })}`} className="font-medium text-emerald-700 hover:underline">← {ta.previous}</Link> : null}
          <span className="text-muted">{current} / {pages}</span>
          {current < pages ? <Link href={`/settings/audit-log${qs({ page: String(current + 1) })}`} className="font-medium text-emerald-700 hover:underline">{ta.next} →</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
