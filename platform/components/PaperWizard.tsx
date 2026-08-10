"use client";

import { useMemo, useState } from "react";
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
 * The paginated working paper: the page never scrolls, so the paper is walked
 * step by step — conclusion and key findings first, then the questionnaire and
 * procedure results in screen-sized chunks. Every step stays mounted (hidden,
 * not unmounted) so one Save submits the whole paper regardless of the step
 * shown.
 */

const CHUNK = 5;

type StepItem =
  | { kind: "field"; field: PaperField }
  | { kind: "proc"; key: string; text: string; src: string; index: number }
  | { kind: "yn"; key: string; whyKey: string; text: string; na?: boolean; index: number };

interface Step {
  title: string;
  items: StepItem[];
}

function buildSteps(def: PaperDef, fr: boolean): Step[] {
  const steps: Step[] = [];
  const push = (title: string, items: StepItem[]) => {
    for (let i = 0; i < items.length; i += CHUNK) {
      const page = Math.floor(i / CHUNK);
      const pages = Math.ceil(items.length / CHUNK);
      steps.push({ title: pages > 1 ? `${title} · ${page + 1}/${pages}` : title, items: items.slice(i, i + CHUNK) });
    }
  };
  (def.sections ?? []).forEach((s) => {
    const title = fr ? s.titleFr : s.titleEn;
    if (s.kind === "fields") {
      push(title, s.fields.map((field) => ({ kind: "field" as const, field })));
    } else if (s.kind === "proc") {
      push(
        title,
        s.procs.map((p, i) => ({
          kind: "proc" as const,
          key: p.key,
          text: fr ? p.fr : p.en,
          src: fr ? p.srcFr : p.srcEn,
          index: i + 1,
        })),
      );
    } else {
      push(
        title,
        s.items.map((it, i) => ({
          kind: "yn" as const,
          key: it.key,
          whyKey: ynWhyKey(it.key),
          text: fr ? it.fr : it.en,
          na: it.na,
          index: i + 1,
        })),
      );
    }
  });
  if (def.fields?.length) {
    push(fr ? "Feuille" : "Paper", def.fields.map((field) => ({ kind: "field" as const, field })));
  }
  return steps;
}

const AMBER =
  "w-full resize-none rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-input)] px-2.5 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-emerald-600/25";

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
  const steps = useMemo(() => buildSteps(def, fr), [def, fr]);
  const [step, setStep] = useState(0);
  const total = steps.length + 1; // step 0 = conclusion & key findings
  const concl = (fr ? def.conclFr : def.conclEn) ?? [];

  return (
    <form
      action={action}
      data-testid={`wp-form-${code}`}
      className="flex h-full min-h-0 flex-col"
    >
      {/* step indicator */}
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
          {step === 0
            ? fr
              ? "Conclusion & constats clés"
              : "Conclusion & key findings"
            : steps[step - 1].title}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted tnum" data-testid="wp-step">
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

      {/* step 0: overall conclusion + key findings (always mounted) */}
      <div hidden={step !== 0} className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {concl.map((c, i) => (
          <div key={i} className="rounded-[var(--radius-atlas-sm)] border border-line px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-[12.3px] text-ink">{c}</p>
              <span className="flex flex-shrink-0 gap-2.5">
                {["yes", "no"].map((v) => (
                  <label key={v} className="flex items-center gap-1 text-[11.5px] text-ink-soft">
                    <input
                      type="radio"
                      name={conclKey(i)}
                      value={v}
                      defaultChecked={values[conclKey(i)] === v}
                      disabled={readOnly}
                      data-testid={`wp-${conclKey(i)}-${v}`}
                      className="h-3.5 w-3.5 accent-emerald-700"
                    />
                    {v === "yes" ? (fr ? "Oui" : "Yes") : fr ? "Non" : "No"}
                  </label>
                ))}
              </span>
            </div>
            <input
              name={conclWhyKey(i)}
              defaultValue={values[conclWhyKey(i)] ?? ""}
              readOnly={readOnly}
              placeholder={fr ? "Expliquer une réponse « Non »" : "Explain a “No” answer"}
              className={`${AMBER} mt-1.5`}
            />
          </div>
        ))}
        <label className="flex min-h-0 flex-1 flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
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
            className="min-h-0 w-full flex-1 resize-none rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-input)] px-2.5 py-1.5 text-[12.5px] font-normal normal-case tracking-normal text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-emerald-600/25"
          />
        </label>
      </div>

      {/* questionnaire steps (all mounted; hidden when not current) */}
      {steps.map((s, si) => (
        <div key={si} hidden={step !== si + 1} className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          {s.items.map((item) => {
            if (item.kind === "field") {
              const f = item.field;
              const label = fr ? f.labelFr : f.labelEn;
              if (f.kind === "auto") {
                return (
                  <div key={f.key}>
                    <span className="block text-[11px] text-muted">{label}</span>
                    <p className="rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-auto)] px-2.5 py-1.5 text-[12.5px] text-ink-soft" data-testid={`wp-auto-${f.key}`}>
                      {autoValues[f.key] ?? (fr ? `Renseigné par « ${f.source} »` : `Filled by the ${f.source}`)}
                    </p>
                  </div>
                );
              }
              if (f.kind === "select") {
                return (
                  <div key={f.key} className="rounded-[var(--radius-atlas-sm)] border border-line px-2.5 py-1.5">
                    <span className="block text-[11px] text-muted">{label}</span>
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
                          <span className="inline-flex items-center rounded-full border border-line-strong px-3 py-1 text-[11.8px] font-semibold text-ink-soft transition peer-checked:border-emerald-600 peer-checked:bg-emerald-600 peer-checked:text-white hover:border-emerald-600">
                            {fr ? o.fr : o.en}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <label key={f.key} className="block">
                  <span className="block text-[11px] text-muted">{label}</span>
                  <input
                    name={f.key}
                    defaultValue={values[f.key] ?? ""}
                    readOnly={readOnly}
                    data-testid={`wp-${f.key}`}
                    placeholder={fr ? "Consigner les travaux effectués" : "Record the work performed"}
                    className={AMBER}
                  />
                </label>
              );
            }
            if (item.kind === "proc") {
              return (
                <div key={item.key} className="rounded-[var(--radius-atlas-sm)] border border-line px-2.5 py-1.5">
                  <p className="text-[12.2px] text-ink">
                    <span className="mr-1 font-mono text-[10.5px] text-muted tnum">{item.index}.</span>
                    {item.text}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-muted">
                    {fr ? "Sources attendues : " : "Expected sources: "}
                    {item.src}
                  </p>
                  <input
                    name={procKey(item.key)}
                    defaultValue={values[procKey(item.key)] ?? ""}
                    readOnly={readOnly}
                    data-testid={`wp-${procKey(item.key)}`}
                    placeholder={fr ? "Résultat et référence du dossier" : "Result and working-paper reference"}
                    className={`${AMBER} mt-1`}
                  />
                </div>
              );
            }
            const name = ynKey(item.key);
            return (
              <div key={item.key} className="rounded-[var(--radius-atlas-sm)] border border-line px-2.5 py-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[12.2px] text-ink">
                    <span className="mr-1 font-mono text-[10.5px] text-muted tnum">{item.index}.</span>
                    {item.text}
                  </p>
                  <span className="flex flex-shrink-0 gap-2">
                    {["yes", "no", ...(item.na ? ["na"] : [])].map((v) => (
                      <label key={v} className="flex items-center gap-1 text-[11.5px] text-ink-soft">
                        <input
                          type="radio"
                          name={name}
                          value={v}
                          defaultChecked={values[name] === v}
                          disabled={readOnly}
                          data-testid={`wp-${name}-${v}`}
                          className="h-3.5 w-3.5 accent-emerald-700"
                        />
                        {v === "yes" ? (fr ? "Oui" : "Yes") : v === "no" ? (fr ? "Non" : "No") : fr ? "S.O." : "N/A"}
                      </label>
                    ))}
                  </span>
                </div>
                <input
                  name={item.whyKey}
                  defaultValue={values[item.whyKey] ?? ""}
                  readOnly={readOnly}
                  data-testid={`wp-${item.whyKey}`}
                  placeholder={fr ? "Expliquer une réponse « Non »" : "Explain a “No” answer"}
                  className={`${AMBER} mt-1`}
                />
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
