"use client";

// The Practical considerations rail: concrete how-to tips for the questionnaire
// items currently on screen. PaperWizard announces the visible item keys via a
// "wp-step-items" event; this block follows the page the user is on. Papers
// without bespoke tips fall back to their procedures' expected sources.

import { useEffect, useState } from "react";

export interface TipEntry {
  /** "p:<key>" | "q:<key>" | "__conclusion__" */
  key: string;
  text: string;
}

export function PracticalTips({
  tips,
  locale,
}: {
  tips: TipEntry[];
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [visible, setVisible] = useState<string[]>(["__conclusion__"]);

  useEffect(() => {
    const onStep = (e: Event) => {
      const detail = (e as CustomEvent<{ keys: string[] }>).detail;
      if (detail?.keys) setVisible(detail.keys);
    };
    window.addEventListener("wp-step-items", onStep);
    return () => window.removeEventListener("wp-step-items", onStep);
  }, []);

  const shown = tips.filter((t) => visible.includes(t.key)).slice(0, 4);
  if (shown.length === 0) return null;

  return (
    <div className="mt-3 flex min-h-0 flex-col border-t border-line pt-2" data-testid="wp-practical">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
        {fr ? "Considérations pratiques" : "Practical considerations"}
      </h2>
      <ul className="mt-1.5 flex min-h-0 flex-col gap-1.5 overflow-y-auto">
        {shown.map((tip) => (
          <li key={tip.key} className="flex gap-1.5 text-[11.5px] leading-snug text-ink-soft">
            <span className="text-warn" aria-hidden>▸</span>
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
