import { notFound, redirect } from "next/navigation";
import { localizedTitle } from "@/lib/page-title";
import { auth } from "@/auth";
import { acceptPbcAction, addPbcItemAction, attachPbcAction, chasePbcAction } from "@/app/actions/pbc";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel } from "@/components/ui/atlas";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listPbcItems } from "@/lib/pbc";

export const generateMetadata = localizedTitle("PBC requests", "Demandes PBC");

/**
 * Whole calendar days since a YYYY-MM-DD date — how long the client has had the
 * request. Compared as calendar dates in the firm's time zone (WAT), so a
 * request made today is 0 days old whatever the hour (UAT run2-B112).
 */
function ageDays(iso: string): number {
  const then = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date())}T00:00:00Z`);
  return Number.isFinite(then) && Number.isFinite(today) ? Math.max(0, Math.floor((today - then) / 86_400_000)) : 0;
}

export default async function PbcPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tp = t.pbc;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [items, fileItems] = await Promise.all([listPbcItems(id), listFileItems(id)]);
  const eSections = fileItems.filter((item) => item.section === "E");

  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.01em] text-ink">
        {engagement.clientName} — {engagement.fiscalYear} · {tp.title}
      </h1>
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-6">
        <form action={addPbcItemAction.bind(null, id)} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-muted">
            {tp.itemTitle}
            <input name="title" required className={`${input} mt-1 w-72`} data-testid="pbc-title" />
          </label>
          <label className="flex flex-col text-xs text-muted">
            {tp.note}
            <input name="note" className={`${input} mt-1 w-96`} data-testid="pbc-note" />
          </label>
          <button type="submit" className={btn} data-testid="pbc-add">
            {tp.add}
          </button>
        </form>

        {items.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
            <table className="w-full text-sm" data-testid="pbc-table">
              <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">{tp.itemTitle}</th>
                  <th className="px-3 py-2 font-semibold">{tp.colStatus}</th>
                  <th className="px-3 py-2 font-semibold">{tp.requestedOn}</th>
                  <th className="px-3 py-2 font-semibold">{tp.uploadedOn}</th>
                  <th className="px-3 py-2 font-semibold">{tp.age}</th>
                  <th className="px-3 py-2 font-semibold">{tp.colFile}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-line hover:bg-surface-2">
                    <td className="px-3 py-2 text-ink">{item.title}</td>
                    <td className="w-28 px-3 py-2 text-xs text-ink-soft" data-testid={`pbc-status-${item.title}`}>
                      {t.portal.statuses[item.status]}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted tnum">{item.createdAt}</td>
                    <td className="px-3 py-2 text-xs text-muted tnum">{item.uploadedAt ?? "—"}</td>
                    <td className="px-3 py-2 text-xs tnum" data-testid={`pbc-age-${item.title}`}>
                      {item.status === "requested" ? (
                        <span className={ageDays(item.createdAt) > 14 ? "font-semibold text-rose" : "text-ink-soft"}>
                          {ageDays(item.createdAt)} {tp.days}
                          {item.chaseCount > 0 ? (
                            <span className="ml-1 text-muted">· {tp.chased.replace("{count}", String(item.chaseCount)).replace("{date}", item.chasedAt ?? "")}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{item.filename ?? ""}</td>
                    <td className="px-3 py-2 text-right">
                      {item.status === "requested" ? (
                        <form action={chasePbcAction.bind(null, id, item.id)} className="inline-flex justify-end">
                          <button type="submit" className={btn} data-testid={`pbc-chase-${item.title}`}>
                            {tp.chase}
                          </button>
                        </form>
                      ) : null}
                      {/* Accepting files the upload as evidence on a section — the
                          section is required, or the file is reachable from nowhere. */}
                      {item.status === "uploaded" || (item.status === "accepted" && !item.documentId && item.filename) ? (
                        <form
                          action={(item.status === "uploaded" ? acceptPbcAction : attachPbcAction).bind(null, id, item.id)}
                          className="flex items-center justify-end gap-1.5"
                        >
                          <select name="fileItemId" required className={input} data-testid={`pbc-attach-${item.title}`}>
                            <option value="">{tp.noAttach}</option>
                            {eSections.map((section) => (
                              <option key={section.id} value={section.id}>
                                {tp.attachTo} {section.code}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className={btn} data-testid={`pbc-accept-${item.title}`}>
                            {item.status === "uploaded" ? tp.accept : tp.attach}
                          </button>
                        </form>
                      ) : item.documentId ? (
                        <a
                          href={`/documents/${item.documentId}`}
                          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                          data-testid={`pbc-doc-${item.title}`}
                        >
                          {tp.viewDocument} →
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </main>
  );
}
