"use client";

import { useState } from "react";

/**
 * One independence question: yes/no tickboxes, and — the moment the exception
 * answer ("yes") is chosen — a required textarea for the circumstances and
 * mitigating factors/safeguards (IESBA Code §120: identify, evaluate,
 * address). Server-side validation re-checks; this is the honest UI for it.
 */
export function IndependenceQuestionField({
  qkey,
  label,
  yesLabel,
  noLabel,
  noteLabel,
  notePlaceholder,
}: {
  qkey: string;
  label: string;
  yesLabel: string;
  noLabel: string;
  noteLabel: string;
  notePlaceholder: string;
}) {
  const [exception, setException] = useState(false);
  return (
    <fieldset className="rounded-[var(--radius-atlas)] border border-line p-3 text-sm">
      <legend className="px-1 text-ink">{label}</legend>
      <div className="mt-1 flex gap-5">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={qkey}
            value="no"
            defaultChecked
            required
            onChange={() => setException(false)}
            data-testid={`q-${qkey}-no`}
          />
          {noLabel}
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={qkey}
            value="yes"
            onChange={() => setException(true)}
            data-testid={`q-${qkey}-yes`}
          />
          {yesLabel}
        </label>
      </div>
      {exception ? (
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{noteLabel}</span>
          <textarea
            name={`note_${qkey}`}
            required
            rows={3}
            placeholder={notePlaceholder}
            className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            data-testid={`q-${qkey}-note`}
          />
        </label>
      ) : null}
    </fieldset>
  );
}
