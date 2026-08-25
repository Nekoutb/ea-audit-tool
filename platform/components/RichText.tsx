"use client";

// A plain textarea with a small formatting toolbar. Marks are written as
// lightweight markers around the selection — **bold**, _underline_, *italic*,
// "- " list items — so the stored value stays plain text that exports, diffs
// and searches like any other answer in the file.

import { useRef, useState, type CSSProperties } from "react";

type Mark = "bold" | "italic" | "underline" | "bullet" | "number";

/** Colour marks wrap the selection as {#hex|text} — still plain text. */
const COLORS = ["#b91c1c", "#b45309", "#15803d", "#1d4ed8"];

const WRAP: Record<"bold" | "italic" | "underline", string> = {
  bold: "**",
  italic: "*",
  underline: "_",
};

export function RichText({
  name,
  defaultValue,
  placeholder,
  readOnly,
  rows,
  className,
  style,
  testId,
  onInput,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  readOnly?: boolean;
  rows?: number;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  onInput?: (event: React.FormEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  /** floating toolbar over a mouse selection, positioned at the pointer */
  const [pop, setPop] = useState<{ x: number; y: number } | null>(null);

  function applyColor(color: string) {
    const el = ref.current;
    if (!el || readOnly) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    const selected = value.slice(start, end) || (el.placeholder ? "" : "");
    el.value = `${value.slice(0, start)}{${color}|${selected}}${value.slice(end)}`;
    el.selectionStart = start + color.length + 2;
    el.selectionEnd = start + color.length + 2 + selected.length;
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function apply(mark: Mark) {
    const el = ref.current;
    if (!el || readOnly) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    const selected = value.slice(start, end);

    if (mark === "bullet" || mark === "number") {
      // prefix every line of the selection (or the current line)
      const from = value.lastIndexOf("\n", start - 1) + 1;
      const to = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);
      const lines = value.slice(from, to).split("\n");
      const marked = lines
        .map((line, i) => (mark === "bullet" ? `- ${line}` : `${i + 1}. ${line}`))
        .join("\n");
      el.value = value.slice(0, from) + marked + value.slice(to);
      el.selectionStart = from;
      el.selectionEnd = from + marked.length;
    } else {
      const token = WRAP[mark];
      el.value = value.slice(0, start) + token + selected + token + value.slice(end);
      el.selectionStart = start + token.length;
      el.selectionEnd = end + token.length;
    }
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Ctrl/Cmd+B / I / U mark the selection without leaving the keyboard.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b" || k === "i" || k === "u") {
      e.preventDefault();
      apply(k === "b" ? "bold" : k === "i" ? "italic" : "underline");
    }
  }

  function onMouseUp(e: React.MouseEvent<HTMLTextAreaElement>) {
    const el = ref.current;
    if (!el || readOnly) return;
    if (el.selectionEnd > el.selectionStart) setPop({ x: e.clientX, y: e.clientY });
    else setPop(null);
  }

  const btn =
    "grid h-5 w-5 place-items-center rounded-[3px] border border-line text-[10px] leading-none text-ink-soft transition hover:border-emerald-600 hover:text-emerald-700";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {readOnly ? null : (
        <div className="mb-1 flex items-center gap-1" data-testid={testId ? `${testId}-toolbar` : undefined}>
          <button type="button" onClick={() => apply("bold")} className={`${btn} font-extrabold`} title="Bold" data-testid={testId ? `${testId}-bold` : undefined}>B</button>
          <button type="button" onClick={() => apply("italic")} className={`${btn} italic`} title="Italic" data-testid={testId ? `${testId}-italic` : undefined}>I</button>
          <button type="button" onClick={() => apply("underline")} className={`${btn} underline`} title="Underline" data-testid={testId ? `${testId}-underline` : undefined}>U</button>
          <button type="button" onClick={() => apply("bullet")} className={btn} title="Bulleted list" data-testid={testId ? `${testId}-bullet` : undefined}>•</button>
          <button type="button" onClick={() => apply("number")} className={btn} title="Numbered list" data-testid={testId ? `${testId}-number` : undefined}>1.</button>
          <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => applyColor(c)}
              className="h-4 w-4 rounded-full border border-line"
              style={{ background: c }}
              title={`Colour ${c}`}
              aria-label={`Colour ${c}`}
              data-testid={testId ? `${testId}-color-${c.slice(1)}` : undefined}
            />
          ))}
        </div>
      )}
      <textarea
        ref={ref}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        readOnly={readOnly}
        rows={rows}
        style={style}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onMouseUp={onMouseUp}
        onBlur={() => window.setTimeout(() => setPop(null), 200)}
        data-testid={testId}
        className={className}
      />
      {pop ? (
        <div
          className="fixed z-50 flex items-center gap-1 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface p-1 shadow-atlas-sm"
          style={{ left: pop.x, top: Math.max(8, pop.y - 44) }}
          onMouseDown={(e) => e.preventDefault()}
          data-testid={testId ? testId + "-popover" : undefined}
        >
          <button type="button" onClick={() => { apply("bold"); setPop(null); }} className={btn + " font-extrabold"} title="Bold (Ctrl+B)">B</button>
          <button type="button" onClick={() => { apply("italic"); setPop(null); }} className={btn + " italic"} title="Italic (Ctrl+I)">I</button>
          <button type="button" onClick={() => { apply("underline"); setPop(null); }} className={btn + " underline"} title="Underline (Ctrl+U)">U</button>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { applyColor(c); setPop(null); }}
              className="h-4 w-4 rounded-full border border-line"
              style={{ background: c }}
              title={"Colour " + c}
              aria-label={"Colour " + c}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
