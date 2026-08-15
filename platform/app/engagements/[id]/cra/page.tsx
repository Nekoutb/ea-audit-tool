import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { CraMatrix, CRA_LABELS } from "@/components/CraMatrix";
import { NavLink } from "@/components/NavLink";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { craRows } from "@/lib/cra";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "CRA · AuditISA" };

/** Read-only CRA matrix (EY-Canvas-style structure): one row per E-section. */
export default async function CraPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const t = getMessages(locale);
  const l = CRA_LABELS[locale];

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const rows = await craRows(id);
  const significantCount = rows.filter((row) => row.significant).length;

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <NavLink
            href={`/engagements/${id}/tools`}
            className="inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            testId="back-to-dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            {locale === "fr" ? "Retour aux outils" : "Back to tools"}
          </NavLink>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{l.title}</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {l.subtitle}
            <span className="px-2 text-line-strong">·</span>
            {engagement.clientName}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.fiscalYear} {engagement.fiscalYear}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">{l.significant}</div>
          <div className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-rose tnum">
            {significantCount}
            <span className="text-muted">/{rows.length}</span>
          </div>
        </div>
      </div>

      <Panel flush className="flex flex-col">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader
            title={l.cols.account}
            right={<span className="text-xs font-semibold text-muted tnum">{rows.length}</span>}
          />
        </div>
        <CraMatrix engagementId={id} rows={rows} locale={locale} />
      </Panel>
    </main>
  );
}
