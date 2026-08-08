import Link from "next/link";
import { type Locale } from "@/lib/i18n";
import { SECTION_ORDER, sectionLabel, type SectionKey } from "@/lib/task-groups";

/**
 * Engagement navigation, rebuilt to the console design: the four phases sit in a
 * single segmented control, with the cross-cutting destinations beside it. It
 * replaces the eleven-tab cluster — every task is now reached through its phase.
 */
export function PhaseNav({
  engagementId,
  locale,
  active,
}: {
  engagementId: string;
  locale: Locale;
  /** a phase key, "overview", or one of the cross-cutting destinations */
  active: SectionKey | "overview" | "tools" | "documents" | "team" | null;
}) {
  const base = `/engagements/${engagementId}`;
  const side = [
    { key: "tools", href: `${base}/tools`, label: locale === "fr" ? "Outils" : "Tools" },
    // The audit file index lives at the engagement root, not /documents.
    { key: "documents", href: base, label: locale === "fr" ? "Dossier" : "Audit file" },
    { key: "team", href: `${base}/team`, label: locale === "fr" ? "Équipe" : "Team" },
  ];

  return (
    <nav className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label={locale === "fr" ? "Phases" : "Phases"}>
      <div className="inline-flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-[var(--radius-atlas)] bg-surface-2 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={`${base}/dashboard`}
          data-testid="phase-overview"
          aria-current={active === "overview" ? "page" : undefined}
          className={segClass(active === "overview")}
        >
          {locale === "fr" ? "Vue d’ensemble" : "Overview"}
        </Link>
        {SECTION_ORDER.map((key) => (
          <Link
            key={key}
            href={`${base}/phase/${key}`}
            data-testid={`phase-${key}`}
            aria-current={active === key ? "page" : undefined}
            className={segClass(active === key)}
          >
            {sectionLabel(key, locale)}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {side.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            data-testid={`nav-${s.key}`}
            aria-current={active === s.key ? "page" : undefined}
            className={
              active === s.key
                ? "rounded-[var(--radius-atlas-sm)] px-3 py-1.5 text-sm font-medium text-ink"
                : "rounded-[var(--radius-atlas-sm)] px-3 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
            }
          >
            {s.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function segClass(on: boolean): string {
  return on
    ? "flex-shrink-0 whitespace-nowrap rounded-[var(--radius-atlas-sm)] bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink shadow-sm"
    : "flex-shrink-0 whitespace-nowrap rounded-[var(--radius-atlas-sm)] px-3.5 py-1.5 text-sm font-medium text-muted transition hover:text-ink";
}
