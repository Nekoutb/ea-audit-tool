import Link from "next/link";
import { getMessages, type Locale } from "@/lib/i18n";

/**
 * Workspace navigation. Redesigned per the UI audit (W4): instead of a flat row
 * of 11 competing tabs, destinations are clustered under three small group
 * labels (Phase work / Data / Registers) with a distinct Dashboard shortcut.
 * Every data-testid is unchanged. The audit-file index screen is intentionally
 * not a tab (hub-and-spoke: tasks are reached from the dashboard).
 */
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
  const base = `/engagements/${engagementId}`;
  const groups: { label: string | null; tabs: { key: string; href: string; label: string }[] }[] = [
    {
      label: null,
      tabs: [{ key: "dashboard", href: `${base}/dashboard`, label: `← ${t.nav.dashboard}` }],
    },
    {
      label: t.tabGroups.phases,
      tabs: [
        { key: "acceptance", href: `${base}/acceptance`, label: t.planning.acceptanceTitle },
        { key: "planning", href: `${base}/planning`, label: t.planning.planningTitle },
        { key: "conclusion", href: `${base}/conclusion`, label: t.planning.conclusion.title },
      ],
    },
    {
      label: t.tabGroups.data,
      tabs: [
        { key: "data", href: `${base}/data`, label: t.planning.dataTitle },
        { key: "analytics", href: `${base}/analytics`, label: t.planning.analyticsTitle },
      ],
    },
    {
      label: t.tabGroups.registers,
      tabs: [
        { key: "risks", href: `${base}/risks`, label: t.planning.risksTitle },
        { key: "findings", href: `${base}/findings`, label: t.planning.findings.title },
        { key: "confirmations", href: `${base}/confirmations`, label: t.planning.confirmations.title },
        { key: "pbc", href: `${base}/pbc`, label: t.pbc.title },
        { key: "legal", href: `${base}/legal`, label: t.planning.legal.title },
      ],
    },
  ];
  return (
    <div className="mt-4 flex flex-nowrap items-end gap-4 overflow-x-auto border-b border-line pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {groups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? "border-l border-line-strong pl-4" : ""}>
          {group.label ? (
            <div className="mb-1 px-1 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-muted">
              {group.label}
            </div>
          ) : (
            <div className="mb-1 h-[14px]" aria-hidden />
          )}
          <div className="flex flex-nowrap gap-1">
            {group.tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                data-testid={`tab-${tab.key}`}
                aria-current={tab.key === active ? "page" : undefined}
                className={
                  tab.key === active
                    ? "flex-shrink-0 whitespace-nowrap rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                    : "flex-shrink-0 whitespace-nowrap rounded-[var(--radius-atlas-xs)] px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-surface-2"
                }
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
