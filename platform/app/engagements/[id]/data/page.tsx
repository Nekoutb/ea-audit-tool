import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { TbAnalyzer } from "@/components/TbAnalyzer";
import { Chip, Panel } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listTbTimings } from "@/lib/tb";
import { rollForward } from "@/lib/tb-rollforward";
import { RollForwardGrid } from "@/components/RollForwardGrid";

export const metadata = { title: "Trial Balance Analyzer · AuditISA" };

/**
 * The Trial Balance Analyzer: upload to the Pre-audit or Post-audit slot
 * (each upload replaces that slot), confirm columns and classes, and read the
 * lead schedules in the workbook layout — index-named, with sub-totals,
 * current year, prior year and the variance.
 */
export default async function DataPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const fr = locale === "fr";

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [timings, roll] = await Promise.all([listTbTimings(id), rollForward(id)]);
  const slotOf = (timing: "pre_audit" | "post_audit") => timings.find((x) => x.timing === timing);

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools/data-analytics`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour à l'analyse de données" : "Back to Data Analytics"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="tb-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Analyseur de balance générale" : "Trial Balance Analyzer"}
        </h1>
      </div>
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-4">
        <TbAnalyzer engagementId={id} locale={fr ? "fr" : "en"} messages={t.planning} />

        {/* the two TB slots — one file each, replaced on re-upload */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="tb-timings">
          {(["pre_audit", "post_audit"] as const).map((timing) => {
            const slot = slotOf(timing);
            return (
              <div key={timing} className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2/50 px-4 py-3" data-testid={`tb-slot-${timing}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                    {timing === "pre_audit" ? (fr ? "TB pré-audit" : "Pre-audit TB") : (fr ? "TB post-audit" : "Post-audit TB")}
                  </span>
                  {slot ? (
                    <Chip tone={slot.status === "valid" ? "good" : slot.status === "invalid" ? "rose" : "warn"}>
                      {slot.status}
                    </Chip>
                  ) : null}
                </div>
                {slot ? (
                  <p className="mt-1.5 text-[12.5px] text-ink-soft">
                    {slot.filename}
                    <span className="px-1.5 text-line-strong">·</span>
                    <span className="tnum">{slot.rowCount} {fr ? "lignes" : "rows"}</span>
                    <span className="px-1.5 text-line-strong">·</span>
                    <span className="tnum">{slot.createdAt}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-[12.5px] text-muted">
                    {fr ? "Aucun fichier — importer ci-dessus." : "No file yet — upload above."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {roll ? (
          <RollForwardGrid result={roll} locale={fr ? "fr" : "en"} />
        ) : (
          <p className="mt-3 text-[12px] text-muted" data-testid="rollforward-empty">
            {fr
              ? "Réconciliation indisponible — importer le grand livre dans l'Analyseur du grand livre."
              : "Roll-forward unavailable — upload the general ledger in the GL Analyzer."}
          </p>
        )}
      </Panel>

    </main>
  );
}
