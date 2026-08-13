// The Excel-grid convention shared by every spreadsheet-style table in the
// tool. One set of classes and one column geometry, so equivalent columns line
// up between tables that sit above one another — Current Y in one grid is
// exactly above Current Y in the next.

export const GRID_CELL =
  "border border-[color:var(--line-strong,#c9c9c9)] px-1.5 py-[1px] text-[10.6px] whitespace-nowrap";
export const GRID_NUM = `${GRID_CELL} text-right tnum`;
export const GRID_HEAD = "bg-surface-2 font-bold text-ink";
/** Commentary cells are permanently tinted so the editable column is obvious. */
export const GRID_COMMENT_INPUT =
  "w-full bg-[var(--color-warn-soft)] px-1 py-0.5 text-[10.8px] text-ink outline-none placeholder:text-muted/70 focus:ring-1 focus:ring-emerald-600/40";

/** A fixed column geometry: table-fixed + colgroup keeps widths static. */
export function colWidths(...widths: (number | null)[]): { width: string | undefined }[] {
  return widths.map((w) => ({ width: w === null ? undefined : `${w}px` }));
}
