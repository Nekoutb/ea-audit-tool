"use client";

import { useMemo, useState } from "react";
import { Chip, Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { SubmitButton } from "@/components/SubmitButton";
import {
  COMPLEXITY_QUESTIONS,
  classifyComplexity,
  type ComplexityAnswers,
  type EngagementComplexity,
} from "@/lib/complexity";
import { itemsForComplexity } from "@/lib/file-index";

const LEVEL_TONE: Record<EngagementComplexity, "rose" | "warn" | "good"> = {
  complex: "rose",
  non_complex: "warn",
  very_simple: "good",
};

/**
 * The nature-of-entity screen shown after an engagement is created: seventeen
 * yes/no questions conclude whether the entity is complex, non-complex or
 * simple, with a live preview. The conclusion scales the audit file — a simple
 * entity receives the core set and the work is primarily substantive; a
 * complex entity receives the full range. The server recomputes the
 * classification from the raw answers.
 */
export function NatureAssessment({
  action,
  labels,
}: {
  action: (formData: FormData) => void;
  labels: {
    title: string;
    hint: string;
    resultLabel: string;
    levels: Record<EngagementComplexity, string>;
    formsNote: string; // contains {count}
    questions: Record<string, string>;
    submit: string;
    scopeNote: Record<EngagementComplexity, string>;
  };
}) {
  const [answers, setAnswers] = useState<ComplexityAnswers>(
    Object.fromEntries(COMPLEXITY_QUESTIONS.map((q) => [q.key, false])),
  );
  const { level } = useMemo(() => classifyComplexity(answers), [answers]);
  const formCount = useMemo(() => itemsForComplexity(level).length, [level]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Panel flush>
        <div className="border-b border-line px-6 py-4">
          <PanelHeader title={labels.title} hint={labels.hint} />
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-1 p-4 md:grid-cols-2" data-testid="complexity-questions">
          {COMPLEXITY_QUESTIONS.map((q, i) => (
            <label
              key={q.key}
              className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-atlas-xs)] px-3 py-2 text-sm text-ink transition hover:bg-surface-2"
            >
              <span className="w-6 flex-shrink-0 text-right text-[11px] font-extrabold text-emerald-700/45 tnum dark:text-emerald-400/45">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">{labels.questions[q.key] ?? q.key}</span>
              <input
                type="checkbox"
                name={`q_${q.key}`}
                checked={answers[q.key]}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.checked }))}
                className="h-4 w-4 flex-shrink-0 accent-[var(--color-emerald-700)]"
                data-testid={`cq-${q.key}`}
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
              {labels.resultLabel}
            </span>
            <span data-testid="complexity-result">
              <Chip tone={LEVEL_TONE[level]}>{labels.levels[level]}</Chip>
            </span>
            <span className="text-xs text-muted tnum">
              {labels.formsNote.replace("{count}", String(formCount))} · {labels.scopeNote[level]}
            </span>
          </div>
          <SubmitButton className={btnPrimary} testId="classify-entity">
            {labels.submit}
          </SubmitButton>
        </div>
      </Panel>
    </form>
  );
}
