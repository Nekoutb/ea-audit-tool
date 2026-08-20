// Excel-worksheet primitives: a small presentational kit that makes an in-app
// table read like a sheet of a working-paper workbook — column letters across
// the top, row numbers down the left, #DAE9F8 header cells, #E7E6E6 calculated
// cells, white input cells, hairline borders. Server-component safe (no state,
// no effects) so both server and client pages can compose them. The palette is
// declared as CSS custom properties on `.xl-sheet`, with a `[data-theme="dark"]`
// override block that follows the project's dark-mode convention.

import type { ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Column letters: 0 -> A, 25 -> Z, 26 -> AA. */
function colLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

const SHEET_CSS = `
.xl-sheet{
  --xl-paper:#ffffff;
  --xl-head:#DAE9F8;
  --xl-head-ink:#123059;
  --xl-calc:#E7E6E6;
  --xl-input:#ffffff;
  --xl-line:#DCE1E7;
  --xl-frame:#BFC7D1;
  --xl-gutter:#F0F2F5;
  --xl-gutter-ink:#5c6672;
  --xl-ink:#1f2328;
  --xl-ink-soft:#4a525c;
  --xl-neg:#A11B1B;
  background:var(--xl-paper);
  border:1px solid var(--xl-frame);
  border-radius:10px;
  color:var(--xl-ink);
  overflow:hidden;
}
[data-theme="dark"] .xl-sheet{
  --xl-paper:#14171b;
  --xl-head:#22354a;
  --xl-head-ink:#cfe2f8;
  --xl-calc:#262a2f;
  --xl-input:#1a1e23;
  --xl-line:#333941;
  --xl-frame:#4a515b;
  --xl-gutter:#232830;
  --xl-gutter-ink:#9aa5b3;
  --xl-ink:#e8ecf2;
  --xl-ink-soft:#b3bdca;
  --xl-neg:#f08a8a;
}
.xl-cap{padding:12px 14px 10px;border-bottom:1px solid var(--xl-frame);}
.xl-cap-t{font-size:12.5px;font-weight:800;letter-spacing:-0.01em;color:var(--xl-ink);}
.xl-cap-s{margin-left:8px;font-size:11px;font-weight:600;color:var(--xl-gutter-ink);}
.xl-cap-o{margin-top:4px;max-width:86ch;font-size:11.5px;line-height:1.5;color:var(--xl-ink-soft);white-space:normal;}
.xl-body{display:flex;flex-direction:column;gap:12px;padding:12px 14px 14px;}
.xl-note{font-size:11.5px;line-height:1.5;color:var(--xl-ink-soft);white-space:normal;}
.xl-scroll{overflow-x:auto;border:1px solid var(--xl-frame);background:var(--xl-paper);}
.xl-tbl{min-width:100%;border-collapse:separate;border-spacing:0;font-size:11.5px;color:var(--xl-ink);}
.xl-tbl th,.xl-tbl td{
  padding:3px 7px;
  text-align:left;
  vertical-align:top;
  white-space:nowrap;
  background:var(--xl-input);
  border-right:1px solid var(--xl-line);
  border-bottom:1px solid var(--xl-line);
}
.xl-tbl tr > *:last-child{border-right:0;}
.xl-tbl tbody tr:last-child > *{border-bottom:0;}
.xl-tbl .xl-k-header{background:var(--xl-head);color:var(--xl-head-ink);font-weight:700;}
.xl-tbl .xl-k-calc{background:var(--xl-calc);}
.xl-tbl .xl-gut{
  background:var(--xl-gutter);
  color:var(--xl-gutter-ink);
  font-size:8.5pt;
  font-weight:600;
  text-align:center;
  padding:2px 6px;
}
.xl-tbl .xl-letters > *{position:sticky;top:0;z-index:3;}
.xl-tbl .xl-rowno{position:sticky;left:0;z-index:2;}
.xl-tbl .xl-letters > .xl-rowno{z-index:4;}
.xl-tbl .xl-total > *{border-top:2px solid var(--xl-frame);font-weight:700;}
.xl-tbl .xl-a-right{text-align:right;}
.xl-tbl .xl-a-center{text-align:center;}
.xl-tbl .xl-wrap{white-space:normal;}
.xl-neg{color:var(--xl-neg);}
`;

/** One shared <style> element; React dedupes hoisted styles by href. */
function SheetStyles() {
  return (
    <style href="atlas-excel-sheet" precedence="atlas">
      {SHEET_CSS}
    </style>
  );
}

export type SheetAlign = "left" | "right" | "center";
/** Cell tone: header strip, derived/calculated value, or plain data. */
export type SheetCellKind = "input" | "calc" | "header";
export type SheetCol = { label: ReactNode; width?: number; align?: SheetAlign };

const ALIGN: Record<SheetAlign, string> = {
  left: "",
  right: "xl-a-right",
  center: "xl-a-center",
};

const NUM_FMT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/**
 * Workbook number rule: thousands separated, negatives in parentheses and in
 * the negative red, null/undefined as an em dash. Returns a node so the red
 * only wraps the number itself.
 */
export function num(
  value: number | null | undefined,
  opts?: { digits?: number; minDigits?: number; suffix?: string; signed?: boolean },
): ReactNode {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const digits = opts?.digits ?? 0;
  const minDigits = opts?.minDigits ?? 0;
  const fmt =
    digits === 0 && minDigits === 0
      ? NUM_FMT
      : new Intl.NumberFormat("fr-FR", {
          minimumFractionDigits: minDigits,
          maximumFractionDigits: Math.max(digits, minDigits),
        });
  const suffix = opts?.suffix ?? "";
  const body = fmt.format(Math.abs(value)) + suffix;
  if (value < 0) return <span className="xl-neg">({body})</span>;
  return `${opts?.signed && value > 0 ? "+" : ""}${body}`;
}

/** The worksheet frame: white paper, a bold title row and a wrapped objective. */
export function Sheet({
  title,
  subtitle,
  objective,
  testId,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  objective?: ReactNode;
  testId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("xl-sheet", className)} data-testid={testId}>
      <SheetStyles />
      <div className="xl-cap">
        <div className="xl-cap-t">
          {title}
          {subtitle ? <span className="xl-cap-s">{subtitle}</span> : null}
        </div>
        {objective ? <p className="xl-cap-o">{objective}</p> : null}
      </div>
      <div className="xl-body">{children}</div>
    </section>
  );
}

/** A wrapped paragraph inside a sheet body (hints, explanations, totals prose). */
export function SheetNote({
  children,
  testId,
  className,
}: {
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <p className={cx("xl-note", className)} data-testid={testId}>
      {children}
    </p>
  );
}

/** Sticky column-letter strip + #DAE9F8 header row; children is the caller's <tbody>. */
export function SheetTable({
  cols,
  children,
  testId,
  gutter = 34,
  className,
}: {
  cols: SheetCol[];
  children: ReactNode;
  testId?: string;
  /** width of the row-number column */
  gutter?: number;
  className?: string;
}) {
  return (
    <div className={cx("xl-scroll", className)}>
      <table className="xl-tbl" data-testid={testId}>
        <colgroup>
          <col style={{ width: `${gutter}px` }} />
          {cols.map((col, i) => (
            <col key={i} style={col.width ? { width: `${col.width}px` } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr className="xl-letters">
            <th className="xl-gut xl-rowno" aria-hidden="true" />
            {cols.map((_, i) => (
              <th key={i} className="xl-gut" aria-hidden="true">
                {colLetter(i)}
              </th>
            ))}
          </tr>
          <tr>
            <th className="xl-gut xl-rowno" aria-hidden="true" />
            {cols.map((col, i) => (
              <th
                key={i}
                scope="col"
                className={cx("xl-k-header", "xl-wrap", ALIGN[col.align ?? "left"])}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

/** A sheet row: renders its sticky row number, then the cells the caller gives. */
export function SRow({
  n,
  total,
  testId,
  className,
  children,
}: {
  n: number;
  /** totals row: 2px rule above and bold */
  total?: boolean;
  testId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <tr className={cx(total && "xl-total", className)} data-testid={testId}>
      <th scope="row" className="xl-gut xl-rowno">
        {n}
      </th>
      {children}
    </tr>
  );
}

/** One sheet cell carrying the workbook palette; numbers get right + tabular. */
export function SCell({
  align = "left",
  kind = "input",
  colSpan,
  wrap,
  title,
  className,
  testId,
  children,
}: {
  align?: SheetAlign;
  kind?: SheetCellKind;
  colSpan?: number;
  /** allow the text to wrap (name lists, interpretations) */
  wrap?: boolean;
  title?: string;
  className?: string;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <td
      colSpan={colSpan}
      title={title}
      data-testid={testId}
      className={cx(
        kind === "header" ? "xl-k-header" : kind === "calc" ? "xl-k-calc" : null,
        ALIGN[align],
        align === "right" && "tnum",
        wrap && "xl-wrap",
        className,
      )}
    >
      {children}
    </td>
  );
}
