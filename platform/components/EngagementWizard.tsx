"use client";

import { useMemo, useState } from "react";
import { createEngagementAction } from "@/app/actions/audit-file";
import { Chip, Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import {
  COMPLEXITY_QUESTIONS,
  applyNamingConvention,
  classifyComplexity,
  type ComplexityAnswers,
  type EngagementComplexity,
} from "@/lib/complexity";
import { itemsForComplexity } from "@/lib/file-index";

export interface WizardLabels {
  clientLabel: string;
  nameLabel: string;
  nameHint: string;
  yearLabel: string;
  periodEndLabel: string;
  assessmentTitle: string;
  assessmentHint: string;
  resultLabel: string;
  levels: Record<EngagementComplexity, string>;
  formsNote: string; // contains {count}
  questions: Record<string, string>;
  submit: string;
  yes: string;
  no: string;
}

const LEVEL_TONE: Record<EngagementComplexity, "rose" | "warn" | "good"> = {
  complex: "rose",
  non_complex: "warn",
  very_simple: "good",
};

/**
 * Engagement creation wizard: identity (client, name from the firm's naming
 * convention, year, period end) plus the 15-question complexity assessment with
 * a live classification preview. The server action recomputes the classification
 * from the raw answers — the preview is informational.
 */
export function EngagementWizard({
  clients,
  defaultClientId,
  namingPattern,
  labels,
}: {
  clients: { id: string; name: string }[];
  defaultClientId?: string;
  namingPattern: string;
  labels: WizardLabels;
}) {
  const currentYear = new Date().getFullYear();
  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");
  const [year, setYear] = useState(String(currentYear));
  const [name, setName] = useState<string | null>(null); // null = follow convention
  const [answers, setAnswers] = useState<ComplexityAnswers>(
    Object.fromEntries(COMPLEXITY_QUESTIONS.map((q) => [q.key, false])),
  );

  const clientName = clients.find((c) => c.id === clientId)?.name ?? "";
  const conventionName = applyNamingConvention(namingPattern, clientName, year || currentYear);
  const effectiveName = name ?? conventionName;
  const { level } = useMemo(() => classifyComplexity(answers), [answers]);
  const formCount = useMemo(() => itemsForComplexity(level).length, [level]);

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const label = "flex flex-col gap-1 text-sm text-ink-soft";

  return (
    <form action={createEngagementAction} className="flex flex-col gap-4">
      <Panel className="p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className={label}>
            {labels.clientLabel}
            <select
              name="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className={input}
              data-testid="engagement-client"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            {labels.yearLabel}
            <input
              name="fiscalYear"
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
              className={input}
              data-testid="engagement-year"
            />
          </label>
          <label className={label}>
            {labels.periodEndLabel}
            <input
              name="periodEnd"
              type="date"
              defaultValue={`${currentYear}-12-31`}
              required
              className={input}
              data-testid="engagement-period-end"
            />
          </label>
          <label className={label}>
            {labels.nameLabel}
            <input
              name="name"
              value={effectiveName}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              required
              className={input}
              data-testid="engagement-name"
            />
            <span className="text-xs text-muted">{labels.nameHint}</span>
          </label>
        </div>
      </Panel>

      <Panel flush>
        <div className="border-b border-line px-6 py-4">
          <PanelHeader title={labels.assessmentTitle} hint={labels.assessmentHint} />
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
          <div className="flex items-center gap-3">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
              {labels.resultLabel}
            </span>
            <span data-testid="complexity-result">
              <Chip tone={LEVEL_TONE[level]}>{labels.levels[level]}</Chip>
            </span>
            <span className="text-xs text-muted tnum">
              {labels.formsNote.replace("{count}", String(formCount))}
            </span>
          </div>
          <button type="submit" className={btnPrimary} data-testid="create-engagement">
            {labels.submit}
          </button>
        </div>
      </Panel>
    </form>
  );
}
