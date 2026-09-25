"use client";

// A plain textarea sized to its text, folding in the paper's compact view —
// the same behaviour as the answer boxes in RichText (lib/use-auto-size.ts),
// for the few boxes that carry no formatting toolbar.

import { useRef, type TextareaHTMLAttributes } from "react";
import { useAutoSize } from "@/lib/use-auto-size";

export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const folded = useAutoSize(ref);
  return (
    <div className="relative">
      <textarea {...props} ref={ref} data-folded={folded ? "1" : undefined} />
      {folded ? (
        <span
          aria-hidden
          className="wp-fold-fade pointer-events-none absolute inset-x-0 bottom-0 h-5 rounded-b-[var(--radius-atlas-xs)] bg-gradient-to-b from-transparent to-[color:var(--wp-input)]"
        />
      ) : null}
    </div>
  );
}
