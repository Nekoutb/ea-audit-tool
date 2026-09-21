import Link from "next/link";
import { archiveAction, rollforwardAction } from "@/app/actions/conclusion";
import type { ArchiveChecklist as Checklist } from "@/lib/archive-checklist";

// The archive checklist as a board: every gate, green or red, grouped the way
// a reviewer reads a file, and behind each red gate the items still standing
// in the way, each a link to where it is put right. On C6.2 the same board
// carries the Archive button, because the decision to lock the file belongs
// next to the list of what would stop it.
//
// The button follows the archive itself: partner-only, and inert until every
// gate is green, so the screen can never offer an archive the engine would
// refuse. After the archive the board turns into the way forward — the archived
// register, and the roll-forward into the next year.

const btn =
  "rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40";
const input =
  "rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[12.5px] text-ink outline-none focus:border-emerald-600";

export function ArchiveChecklist({
  engagementId,
  checklist,
  locale,
  archive,
}: {
  engagementId: string;
  checklist: Checklist;
  locale: "en" | "fr";
  /** Present on C6.2 only: the button and what follows it. */
  archive?: { canArchive: boolean; fiscalYear: number };
}) {
  const fr = locale === "fr";
  const total = checklist.groups.reduce((n, g) => n + g.gates.length, 0);
  const green = checklist.groups.reduce((n, g) => n + g.gates.filter((x) => x.ok).length, 0);
  const ready = checklist.blocking === 0 && checklist.archivedAt === null;

  return (
    <div className="flex flex-col gap-3" data-testid="archive-checklist">
      <div
        className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-atlas-sm)] border px-3 py-2 text-[12.5px] ${
          checklist.archivedAt
            ? "border-line bg-surface-2 text-ink-soft"
            : ready
              ? "border-emerald-700/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-rose/40 bg-rose/5 text-ink"
        }`}
        data-testid="archive-summary"
      >
        {checklist.archivedAt ? (
          <span className="font-semibold">
            {fr ? "Dossier archivé le" : "File archived on"} <span className="tnum">{checklist.archivedAt.slice(0, 10)}</span>
          </span>
        ) : (
          <>
            <span className="font-semibold">
              {green} / {total} {fr ? "portes au vert" : "gates green"}
            </span>
            {checklist.blocking > 0 ? (
              <span className="font-bold text-rose" data-testid="archive-blocking">
                {checklist.blocking} {fr ? "empêche(nt) l'archivage" : "would refuse the archive"}
              </span>
            ) : (
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {fr ? "Prêt à archiver" : "Ready to archive"}
              </span>
            )}
          </>
        )}
      </div>

      {checklist.groups.map((group) => (
        <section key={group.key} className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface" data-testid={`archive-group-${group.key}`}>
          <h3 className="border-b border-line bg-surface-2 px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-muted">
            {fr ? group.titleFr : group.titleEn}
          </h3>
          <ul className="flex flex-col">
            {group.gates.map((gate) => (
              <li
                key={gate.key}
                className={`border-b border-line px-3 py-2 last:border-b-0 ${gate.ok ? "" : "bg-rose/5"}`}
                data-testid={`archive-gate-${gate.key}`}
                data-ok={gate.ok ? "1" : "0"}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-px text-[13px] font-bold ${gate.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose"}`} aria-hidden>
                    {gate.ok ? "✓" : "✗"}
                  </span>
                  <span className={`flex-1 text-[12.5px] leading-snug ${gate.ok ? "text-ink-soft" : "font-semibold text-ink"}`}>
                    {fr ? gate.labelFr : gate.labelEn}
                    {!gate.ok && gate.pending > 0 ? (
                      <span className="ml-1.5 rounded-full bg-rose/10 px-1.5 text-[10.5px] font-bold text-rose tnum">{gate.pending}</span>
                    ) : null}
                  </span>
                  {!gate.ok ? (
                    <Link href={gate.href} className="text-[11.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400" data-testid={`archive-fix-${gate.key}`}>
                      {fr ? "Corriger →" : "Fix →"}
                    </Link>
                  ) : null}
                </div>
                {!gate.ok && gate.items.length > 0 ? (
                  <ul className="mt-1.5 flex flex-col gap-0.5 pl-6">
                    {gate.items.map((item, i) => (
                      <li key={`${gate.key}-${i}`} className="text-[11.5px] leading-snug">
                        <Link
                          href={item.href}
                          className="text-ink-soft hover:text-ink hover:underline"
                          data-testid={item.code ? `archive-item-${gate.key}-${item.code}` : undefined}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {archive ? (
        <div className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface p-3" data-testid="archive-actions">
          {checklist.archivedAt ? (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] text-ink-soft">
                {fr
                  ? "Le dossier est figé : aucune modification n'est plus possible. Tous les membres invités ont été notifiés."
                  : "The file is frozen: nothing on it can be changed any more. Everyone invited to the engagement has been notified."}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <Link
                  href="/engagements?archived=1"
                  className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft hover:bg-surface-2 hover:text-ink"
                  data-testid="archived-register"
                >
                  {fr ? "Missions archivées" : "Archived engagements"}
                </Link>
                <form action={rollforwardAction.bind(null, engagementId)} className="flex items-end gap-2">
                  <label className="flex flex-col text-[11px] font-semibold text-muted">
                    {fr ? "Reconduire vers l'exercice" : "Roll forward to fiscal year"}
                    <input type="number" name="newYear" required defaultValue={archive.fiscalYear + 1} className={`${input} mt-1 w-28 tnum`} data-testid="rollforward-year" />
                  </label>
                  <button type="submit" className={btn} data-testid="rollforward">
                    {fr ? "Reconduire" : "Roll forward"}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {ready && archive.canArchive ? (
                <form action={archiveAction.bind(null, engagementId)}>
                  <button type="submit" className={btn} data-testid="archive-file">
                    {fr ? "Archiver la mission" : "Archive the engagement"}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  disabled
                  className={btn}
                  title={
                    !archive.canArchive
                      ? fr ? "Seul l'associé peut archiver" : "Only the engagement partner can archive"
                      : fr ? "Toutes les portes doivent être au vert" : "Every gate must be green first"
                  }
                  data-testid="archive-file-disabled"
                >
                  {fr ? "Archiver la mission" : "Archive the engagement"}
                </button>
              )}
              <p className="text-[11.5px] leading-snug text-muted">
                {fr
                  ? "L'archivage fige toute action sur la mission, conserve l'ensemble du dossier et en notifie chaque membre invité. La mission reste consultable et peut être reconduite depuis la liste des missions archivées."
                  : "Archiving freezes every action on the engagement, keeps the whole file, and notifies everyone invited to it. The engagement stays readable and can be rolled forward from the archived list."}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
