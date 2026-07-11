import Link from "next/link";
import { getMessages, type Locale } from "@/lib/i18n";

export function EngagementTabs({
  engagementId,
  locale,
  active,
}: {
  engagementId: string;
  locale: Locale;
  active:
    | "dashboard"
    | "file"
    | "acceptance"
    | "planning"
    | "risks"
    | "data"
    | "analytics"
    | "findings"
    | "confirmations"
    | "pbc"
    | "legal"
    | "conclusion";
}) {
  const t = getMessages(locale);
  const tabs = [
    { key: "dashboard", href: `/engagements/${engagementId}/dashboard`, label: t.nav.dashboard },
    { key: "file", href: `/engagements/${engagementId}`, label: t.fileIndex.title },
    { key: "acceptance", href: `/engagements/${engagementId}/acceptance`, label: t.planning.acceptanceTitle },
    { key: "planning", href: `/engagements/${engagementId}/planning`, label: t.planning.planningTitle },
    { key: "risks", href: `/engagements/${engagementId}/risks`, label: t.planning.risksTitle },
    { key: "data", href: `/engagements/${engagementId}/data`, label: t.planning.dataTitle },
    { key: "analytics", href: `/engagements/${engagementId}/analytics`, label: t.planning.analyticsTitle },
    { key: "findings", href: `/engagements/${engagementId}/findings`, label: t.planning.findings.title },
    { key: "confirmations", href: `/engagements/${engagementId}/confirmations`, label: t.planning.confirmations.title },
    { key: "pbc", href: `/engagements/${engagementId}/pbc`, label: t.pbc.title },
    { key: "legal", href: `/engagements/${engagementId}/legal`, label: t.planning.legal.title },
    { key: "conclusion", href: `/engagements/${engagementId}/conclusion`, label: t.planning.conclusion.title },
  ] as const;
  return (
    <div className="mt-4 flex flex-nowrap gap-1.5 overflow-x-auto border-b border-line pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          data-testid={`tab-${tab.key}`}
          aria-current={tab.key === active ? "page" : undefined}
          className={
            tab.key === active
              ? "flex-shrink-0 rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
              : "flex-shrink-0 rounded-[var(--radius-atlas-xs)] px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-surface-2"
          }
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
