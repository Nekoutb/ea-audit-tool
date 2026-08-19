import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { SadBoard } from "@/components/SadBoard";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";
import { sadView } from "@/lib/sad";

export const metadata = { title: "Summary of Audit Differences · AuditISA" };

/**
 * The Summary of Audit Differences (ISA 450): adjustments proposed in the
 * substantive working papers flow here, classified per caption, corrected or
 * not, and posted onto the misstatement schedule C1.1 evaluates.
 */
export default async function SadPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const view = await sadView(id);

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="sad-back"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">
            {fr ? "Récapitulatif des écarts d'audit (SAD)" : "Summary of Audit Differences (SAD)"}
          </h1>
          <p className="text-[12.5px] text-ink-soft">
            {fr
              ? "Alimenté par les conclusions des procédures substantives · évalué en C1.1 · joint à la lettre d'affirmation (C3.1)"
              : "Fed by the substantive-procedure conclusions · evaluated in C1.1 · attached to the representation letter (C3.1)"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <SadBoard engagementId={id} view={view} locale={locale} />
      </div>
    </main>
  );
}
