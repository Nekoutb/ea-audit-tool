import Link from "next/link";

/** What a tool leans on, each item ticked or linking to where it is done (F063). */
export function PrerequisitesStrip({
  items,
  title,
  testId,
}: {
  items: { ok: boolean; label: string; href: string; key: string }[];
  title: string;
  testId?: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-[12px]" data-testid={testId}>
      <b className="text-ink">{title}</b>
      {items.map((item) =>
        item.ok ? (
          <span key={item.key} className="text-emerald-700 dark:text-emerald-400" data-testid={`prereq-${item.key}`} data-ok="true">
            ✓ {item.label}
          </span>
        ) : (
          <Link key={item.key} href={item.href} className="font-semibold text-warn underline" data-testid={`prereq-${item.key}`} data-ok="false">
            {item.label}
          </Link>
        ),
      )}
    </div>
  );
}
