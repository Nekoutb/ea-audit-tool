import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { NoteRegister } from "@/components/NoteRegister";
import { Panel } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";
import { noteRegister } from "@/lib/task-notes";

export const metadata = { title: "Review notes · AuditISA" };

/**
 * The review-note register: every note of the engagement, filterable by scope
 * (all / for me / by me) and state, each row opening the task it was raised on.
 * The dashboard's "For me" and "By me" lines land here with the filter set.
 */
export default async function ReviewNotesPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { scope } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const notes = await noteRegister(id);
  const initialScope = scope === "for_me" || scope === "by_me" ? scope : "all";

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="notes-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Notes de revue" : "Review notes"}
        </h1>
      </div>

      <Panel className="mt-4">
        <NoteRegister engagementId={id} notes={notes} initialScope={initialScope} locale={fr ? "fr" : "en"} />
      </Panel>
    </main>
  );
}
