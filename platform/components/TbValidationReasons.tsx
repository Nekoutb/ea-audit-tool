import type { TbValidationSummary } from "@/lib/tb";
import { explainTbSummary } from "@/lib/tb-reasons";

// What made a trial-balance import invalid — or what a valid one still
// carries — one line per finding, naming the column, the accounts, the
// amounts, so the file can be put right and re-uploaded.

export function TbValidationReasons({
  summary,
  locale,
  testId,
}: {
  summary: TbValidationSummary | null;
  locale: "en" | "fr";
  testId?: string;
}) {
  if (!summary) return null;
  const lines = explainTbSummary(summary, locale);
  if (lines.length === 0) return null;
  const bad = summary.status === "invalid";
  return (
    <ul
      className={`mt-2 flex flex-col gap-1 rounded-[var(--radius-atlas-sm)] border px-3 py-2 text-[12px] leading-snug ${bad ? "border-rose/40 bg-rose/5 text-ink" : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"}`}
      data-testid={testId ?? "tb-validation-reasons"}
    >
      {lines.map((line, i) => (
        <li key={i} className="flex gap-1.5">
          <span aria-hidden className={bad ? "font-bold text-rose" : "font-bold"}>{line.blocking ? "✗" : "!"}</span>
          <span>{line.text}</span>
        </li>
      ))}
    </ul>
  );
}
