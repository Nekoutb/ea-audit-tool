import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { financialAnalysis, type RatioRow } from "@/lib/financial-analysis";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Financial Analysis · AuditISA" };

const GROUPS: RatioRow["group"][] = ["Liquidity", "Activity", "Profitability", "Leverage", "Investment"];
const fmtN = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

function fmtValue(row: RatioRow): string {
  if (row.value === null) return "—";
  if (row.unit === "FCFA") return `${fmtN(row.value)} FCFA`;
  if (row.unit === "%") return `${row.value}%`;
  if (row.unit === "days") return `${row.value} days`;
  return `${row.value}×`;
}

/** The ratio battery, straight from the pre-audit TB (+ GL for DSO/DPO). */
export default async function FinancialAnalysisPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const analysis = await financialAnalysis(id);

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools/data-analytics`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour à l'analyse de données" : "Back to Data Analytics"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="finanalysis-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Analyse financière" : "Financial Analysis"}
        </h1>
      </div>

      {!analysis ? (
        <Panel className="mt-4">
          <p className="text-[13px] text-muted" data-testid="finanalysis-no-tb">
            {fr
              ? "Aucune balance pré-audit ingérée — les ratios se calculent à partir de la balance."
              : "No pre-audit trial balance ingested yet — the ratios compute from the trial balance."}
          </p>
        </Panel>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="finanalysis">
          {GROUPS.map((group) => {
            const rows = analysis.ratios.filter((r) => r.group === group);
            if (rows.length === 0) return null;
            return (
              <Panel key={group}>
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">{group}</h2>
                <table className="mt-1.5 w-full text-[13px]">
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key} className="border-t border-line first:border-t-0" data-testid={`ratio-${row.key}`}>
                        <td className="py-1.5 pr-3">
                          <span className="text-ink-soft">{row.label}</span>
                          {row.note ? (
                            <span className="block text-[11px] text-muted">{row.note}</span>
                          ) : null}
                        </td>
                        <td className={`py-1.5 text-right font-semibold tnum ${row.value === null ? "text-muted" : "text-ink"}`}>
                          {fmtValue(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            );
          })}
        </div>
      )}
    </main>
  );
}
