import Link from "next/link";
import { getMessages, type Locale } from "@/lib/i18n";

export function EngagementTabs({
  engagementId,
  locale,
  active,
}: {
  engagementId: string;
  locale: Locale;
  active: "file" | "acceptance" | "planning" | "risks";
}) {
  const t = getMessages(locale);
  const tabs = [
    { key: "file", href: `/engagements/${engagementId}`, label: t.fileIndex.title },
    { key: "acceptance", href: `/engagements/${engagementId}/acceptance`, label: t.planning.acceptanceTitle },
    { key: "planning", href: `/engagements/${engagementId}/planning`, label: t.planning.planningTitle },
    { key: "risks", href: `/engagements/${engagementId}/risks`, label: t.planning.risksTitle },
  ] as const;
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          data-testid={`tab-${tab.key}`}
          className={
            tab.key === active
              ? "rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
              : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
