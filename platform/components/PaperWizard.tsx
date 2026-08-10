"use client";

import { useMemo, useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import {
  conclKey,
  conclWhyKey,
  procKey,
  ynKey,
  ynWhyKey,
  type PaperDef,
  type PaperField,
} from "@/lib/papers/types";

/**
 * The paginated working paper. The page never scrolls, so the paper is walked
 * step by step — conclusion and key findings first, then the questionnaire in
 * one continuous stream chunked into screen-sized pages (sections flow into
 * each other; a small label marks where a new part begins). The yellow
 * explanation box appears only when "No" is selected, and every yellow box
 * grows as its text wraps. All steps stay mounted so one Save submits the
 * whole paper.
 */

const CHUNK = 7;

type StepItem = (
  | { kind: "field"; field: PaperField }
  | { kind: "proc"; key: string; text: string; src: string; index: number }
  | { kind: "yn"; key: string; whyKey: string; text: string; na?: boolean; index: number }
) & { sectionTitle?: string };

function buildItems(def: PaperDef, fr: boolean): StepItem[] {
  const items: StepItem[] = [];
  (def.sections ?? []).forEach((s) => {
    const title = fr ? s.titleFr : s.titleEn;
    const before = items.length;
    if (s.kind === "fields") {
      s.fields.forEach((field) => items.push({ kind: "field", field }));
    } else if (s.kind === "proc") {
      s.procs.forEach((p, i) =>
        items.push({ kind: "proc", key: p.key, text: fr ? p.fr : p.en, src: fr ? p.srcFr : p.srcEn, index: i + 1 }),
      );
    } else {
      s.items.forEach((it, i) =>
        items.push({ kind: "yn", key: it.key, whyKey: ynWhyKey(it.key), text: fr ? it.fr : it.en, na: it.na, index: i + 1 }),
      );
    }
    if (items.length > before) items[before].sectionTitle = title;
  });
  (def.fields ?? []).forEach((field) => items.push({ kind: "field", field }));
  return items;
}

const AMBER =
  "w-full resize-none overflow-hidden rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-input)] px-2.5 py-1.5 text-[13.2px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-emerald-600/25";

/** A yellow box that grows with its content as lines wrap. */
function autoGrow(e: FormEvent<HTMLTextAreaElement>) {
  const el = e.currentTarget;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

function Amber({
  name,
  defaultValue,
  placeholder,
  readOnly,
  testId,
}: {
  name: string;
  defaultValue: string;
  placeholder: string;
  readOnly?: boolean;
  testId?: string;
}) {
  return (
    <textarea
      name={name}
      rows={1}
      defaultValue={defaultValue}
      readOnly={readOnly}
      onInput={autoGrow}
      ref={(el) => {
        if (el && el.value) {
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
        }
      }}
      placeholder={placeholder}
      data-testid={testId}
      className={`${AMBER} mt-1`}
    />
  );
}

export function PaperWizard({
  code,
  def,
  values,
  autoValues,
  locale,
  action,
  readOnly,
}: {
  code: string;
  def: PaperDef;
  values: Record<string, string>;
  autoValues: Record<string, string>;
  locale: "en" | "fr";
  action: (formData: FormData) => void;
  readOnly?: boolean;
}) {
  const fr = locale === "fr";
  const items = useMemo(() => buildItems(def, fr), [def, fr]);
  const steps = useMemo(() => {
    const out: StepItem[][] = [];
    for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
    return out;
  }, [items]);
  const [step, setStep] = useState(0);
  const total = steps.length + 1; // step 0 = conclusion & key findings
  const concl = (fr ? def.conclFr : def.conclEn) ?? [];

  // Answers that gate the yellow boxes: yn questions and the conclusions.
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const it of items) if (it.kind === "yn") init[ynKey(it.key)] = values[ynKey(it.key)] ?? "";
    concl.forEach((_, i) => (init[conclKey(i)] = values[conclKey(i)] ?? ""));
    return init;
  });
  const answer = (name: string, v: string) => setAnswers((prev) => ({ ...prev, [name]: v }));

  const radio = (name: string, v: string, label: string, checked: boolean) => (
    <label key={v} className="flex cursor-pointer items-center gap-1 text-[12.3px] text-ink-soft">
      <input
        type="radio"
        name={name}
        value={v}
        defaultChecked={checked}
        disabled={readOnly}
        onChange={() => answer(name, v)}
        data-testid={`wp-${name}-${v}`}
        className="h-3.5 w-3.5 accent-emerald-700"
      />
      {label}
    </label>
  );

  return (
    <form action={action} data-testid={`wp-form-${code}`} className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.07em] text-muted">
          {step === 0
            ? fr
              ? "Conclusion & constats clés"
              : "Conclusion & key findings"
            : fr
              ? "Questionnaire"
              : "Questionnaire"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-muted tnum" data-testid="wp-step">
            {step + 1}/{total}
          </span>
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            data-testid="wp-back"
            className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-ink-soft disabled:opacity-30"
            aria-label={fr ? "Précédent" : "Back"}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
            disabled={step === total - 1}
            data-testid="wp-next"
            className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-ink-soft disabled:opacity-30"
            aria-label={fr ? "Suivant" : "Next"}
          >
            ›
          </button>
        </span>
      </div>

      {/* step 0: overall conclusion + key findings */}
      <div hidden={step !== 0} className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {concl.map((c, i) => (
          <div key={i} className="rounded-[var(--radius-atlas-sm)] border border-line px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-[13.2px] text-ink">{c}</p>
              <span className="flex flex-shrink-0 gap-2.5">
                {radio(conclKey(i), "yes", fr ? "Oui" : "Yes", values[conclKey(i)] === "yes")}
                {radio(conclKey(i), "no", fr ? "Non" : "No", values[conclKey(i)] === "no")}
              </span>
            </div>
            {answers[conclKey(i)] === "no" ? (
              <Amber
                name={conclWhyKey(i)}
                defaultValue={values[conclWhyKey(i)] ?? ""}
                placeholder={fr ? "Expliquer la réponse « Non »" : "Explain the “No” answer"}
                readOnly={readOnly}
              />
            ) : null}
          </div>
        ))}
        <label className="flex min-h-0 flex-1 flex-col gap-1 text-[11.5px] font-bold uppercase tracking-[0.07em] text-muted">
          {fr ? "Constats clés" : "Key findings"}
          <textarea
            name="key_findings"
            defaultValue={values["key_findings"] ?? ""}
            readOnly={readOnly}
            data-testid="wp-key-findings"
            placeholder={
              fr
                ? "Constats importants du travail effectué — repris en B4/B5 le cas échéant"
                : "Significant findings from the work performed — routed to B4/B5 where applicable"
            }
            className="min-h-0 w-full flex-1 resize-none rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-input)] px-2.5 py-1.5 text-[13.2px] font-normal normal-case tracking-normal text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-emerald-600/25"
          />
        </label>
      </div>

      {/* the questionnaire, one continuous stream in screen-sized pages */}
      {steps.map((pageItems, si) => (
        <div key={si} hidden={step !== si + 1} className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          {pageItems.map((item) => {
            const header = item.sectionTitle ? (
              <p className="mb-0.5 mt-1 text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-emerald-700 dark:text-emerald-400">
                {item.sectionTitle}
              </p>
            ) : null;
            if (item.kind === "field") {
              const f = item.field;
              const label = fr ? f.labelFr : f.labelEn;
              if (f.kind === "auto") {
                return (
                  <div key={f.key}>
                    {header}
                    <span className="block text-[11.5px] text-muted">{label}</span>
                    <p className="rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-auto)] px-2.5 py-1.5 text-[13.2px] text-ink-soft" data-testid={`wp-auto-${f.key}`}>
                      {autoValues[f.key] ?? (fr ? `Renseigné par « ${f.source} »` : `Filled by the ${f.source}`)}
                    </p>
                  </div>
                );
              }
              if (f.kind === "select") {
                return (
                  <div key={f.key}>
                    {header}
                    <div className="rounded-[var(--radius-atlas-sm)] border border-line px-2.5 py-1.5">
                      <span className="block text-[11.5px] text-muted">{label}</span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(f.options ?? []).map((o) => (
                          <label key={o.value} className="cursor-pointer">
                            <input
                              type="radio"
                              name={f.key}
                              value={o.value}
                              defaultChecked={values[f.key] === o.value}
                              disabled={readOnly}
                              data-testid={`wp-${f.key}-${o.value}`}
                              className="peer sr-only"
                            />
                            <span className="inline-flex items-center rounded-full border border-line-strong px-3 py-1 text-[12.5px] font-semibold text-ink-soft transition peer-checked:border-emerald-600 peer-checked:bg-emerald-600 peer-checked:text-white hover:border-emerald-600">
                              {fr ? o.fr : o.en}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={f.key}>
                  {header}
                  <label className="block">
                    <span className="block text-[11.5px] text-muted">{label}</span>
                    <Amber
                      name={f.key}
                      defaultValue={values[f.key] ?? ""}
                      placeholder={fr ? "Consigner les travaux effectués" : "Record the work performed"}
                      readOnly={readOnly}
                      testId={`wp-${f.key}`}
                    />
                  </label>
                </div>
              );
            }
            if (item.kind === "proc") {
              return (
                <div key={item.key}>
                  {header}
                  <div className="rounded-[var(--radius-atlas-sm)] border border-line px-2.5 py-1.5">
                    <p className="text-[13.2px] text-ink">
                      <span className="mr-1 font-mono text-[11px] text-muted tnum">{item.index}.</span>
                      {item.text}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {fr ? "Sources attendues : " : "Expected sources: "}
                      {item.src}
                    </p>
                    <Amber
                      name={procKey(item.key)}
                      defaultValue={values[procKey(item.key)] ?? ""}
                      placeholder={fr ? "Résultat et référence du dossier" : "Result and working-paper reference"}
                      readOnly={readOnly}
                      testId={`wp-${procKey(item.key)}`}
                    />
                  </div>
                </div>
              );
            }
            const name = ynKey(item.key);
            return (
              <div key={item.key}>
                {header}
                <div className="rounded-[var(--radius-atlas-sm)] border border-line px-2.5 py-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-[13.2px] text-ink">
                      <span className="mr-1 font-mono text-[11px] text-muted tnum">{item.index}.</span>
                      {item.text}
                    </p>
                    <span className="flex flex-shrink-0 gap-2">
                      {radio(name, "yes", fr ? "Oui" : "Yes", values[name] === "yes")}
                      {radio(name, "no", fr ? "Non" : "No", values[name] === "no")}
                      {item.na ? radio(name, "na", fr ? "S.O." : "N/A", values[name] === "na") : null}
                    </span>
                  </div>
                  {answers[name] === "no" ? (
                    <Amber
                      name={item.whyKey}
                      defaultValue={values[item.whyKey] ?? ""}
                      placeholder={fr ? "Motif, et suite donnée" : "Reason, and how it was resolved"}
                      readOnly={readOnly}
                      testId={`wp-${item.whyKey}`}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {readOnly ? null : (
        <div className="mt-auto flex justify-end border-t border-line pt-2">
          <SubmitButton
            testId={`wp-save-${code}`}
            className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {fr ? "Enregistrer la feuille" : "Save paper"}
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
