"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { RichText } from "@/components/RichText";
import { useCompactView } from "@/lib/use-auto-size";
import { SubmitButton } from "@/components/SubmitButton";
import { UnsavedGuard } from "@/components/UnsavedGuard";
import {
  NA,
  autoFieldEmpty,
  conclKey,
  conclWhyKey,
  procKey,
  procNaKey,
  procWhyKey,
  ynKey,
  ynWhyKey,
  type PaperDef,
  type PaperField,
} from "@/lib/papers/types";

/**
 * The paginated working paper. The page never scrolls, so the paper is walked
 * step by step — a read-only status summary first (what was concluded, who
 * signed), then the questionnaire in one continuous stream chunked into
 * screen-sized pages (sections flow into each other; a small label marks
 * where a new part begins), and the answerable conclusion with the key
 * findings on the LAST page, where the work it concludes on has been read
 * (F039, 2026-10-27 — embed papers already ended that way). The yellow
 * explanation box appears when "No" or "N/A" is selected (F040: an N/A must
 * say why), and every yellow box grows as its text wraps. All steps stay
 * mounted so one Save submits the whole paper.
 */

/**
 * Estimated worst-case height per item (px), reserving room for the yellow
 * box every question could open — so a page can never clip, whatever is
 * answered. Pages are packed against the measured column height.
 */
const COST = { yn: 64, proc: 140, input: 80, select: 86, auto: 72, header: 22 } as const;
function itemCost(it: StepItem): number {
  const base =
    it.kind === "proc"
      ? COST.proc
      : it.kind === "yn"
        ? COST.yn
        : it.field.kind === "select"
          ? COST.select
          : it.field.kind === "auto"
            ? COST.auto
            : COST.input;
  return base + (it.sectionTitle ? COST.header : 0);
}

type StepItem = (
  | { kind: "field"; field: PaperField }
  | { kind: "proc"; key: string; text: string; src: string; index: number }
  | { kind: "yn"; key: string; whyKey: string; text: string; index: number }
) & { sectionTitle?: string; sectionIntro?: string };

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
        items.push({ kind: "yn", key: it.key, whyKey: ynWhyKey(it.key), text: fr ? it.fr : it.en, index: i + 1 }),
      );
    }
    if (items.length > before) {
      items[before].sectionTitle = title;
      items[before].sectionIntro = fr ? s.introFr : s.introEn;
    }
  });
  (def.fields ?? []).forEach((field) => items.push({ kind: "field", field }));
  return items;
}

const AMBER =
  "w-full resize-none overflow-hidden rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-input)] px-2.5 py-1.5 text-[13.2px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-emerald-600/25";


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
  // Every answer box carries the marker toolbar (bold/italic/underline/
  // colour/lists) — values stay plain text, as the file's formatting
  // convention requires (exports, hashing, search all keep working).
  return (
    <div className="mt-1">
      <RichText
        name={name}
        rows={1}
        defaultValue={defaultValue}
        readOnly={readOnly}
        placeholder={placeholder}
        testId={testId}
        className={AMBER}
      />
    </div>
  );
}

/** One signature as the page-1 summary shows it: who and when, or not yet. */
export interface PaperSignature {
  name: string;
  at: string;
}

export function PaperWizard({
  code,
  def,
  values,
  autoValues,
  locale,
  action,
  readOnly,
  embed,
  embedTitle,
  embedOnly,
  baseVersion,
  baseDigests,
  lockedKeys,
  signoffs,
  editionLabel,
}: {
  /** "Standards edition: ISA in force" — the engagement's edition, printed on page 1 (F045) */
  editionLabel?: string;
  /** fields shown but not editable by this user (C4.2: the reviewer's part vs the team's, UAT run 3 B02) */
  lockedKeys?: string[];
  /** paperVersion() at load time, posted back so a concurrent save is refused, not overwritten */
  baseVersion?: string;
  /** paperBaseDigests() of the loaded values: only a field both people changed is held back */
  baseDigests?: string;
  code: string;
  def: PaperDef;
  values: Record<string, string>;
  autoValues: Record<string, string>;
  locale: "en" | "fr";
  action: (formData: FormData) => void;
  readOnly?: boolean;
  /** replaces page 0 entirely (no status summary) — the questionnaire starts on page 2 */
  embed?: React.ReactNode;
  embedTitle?: string;
  /** the embed IS the whole paper: no questionnaire pages, no paper save button */
  embedOnly?: boolean;
  /** the paper's sign-off state, shown read-only on page 1 (F039) */
  signoffs?: { preparer: PaperSignature | null; reviewer: PaperSignature | null; eqr?: PaperSignature | null };
}) {
  const fr = locale === "fr";
  const locked = new Set(lockedKeys ?? []);
  const ro = (key: string) => Boolean(readOnly) || locked.has(key);
  const items = useMemo(() => buildItems(def, fr), [def, fr]);
  // Measure the space a page really has on this screen, and pack items so
  // the worst case (every yellow box open) still fits — anything more flows
  // to the next page.
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaH, setAreaH] = useState(560);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setAreaH(Math.max(240, el.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const conclCount = ((fr ? def.conclFr : def.conclEn) ?? []).length;
  const steps = useMemo(() => {
    // page 1 opens with the status summary, then the questions flow straight
    // beneath — no page is left mostly empty. An embed claims the whole first
    // page for itself: the questionnaire starts on page 2.
    const preludeCost = embed ? areaH + 1 : conclCount * 30 + 150;
    const out: StepItem[][] = [];
    let page: StepItem[] = [];
    let used = preludeCost;
    for (const it of items) {
      const c = itemCost(it);
      if (used + c > areaH && (page.length > 0 || out.length === 0)) {
        out.push(page);
        page = [];
        used = 0;
      }
      page.push(it);
      used += c;
    }
    out.push(page);
    return out;
  }, [items, areaH, conclCount, embed]);
  const soloEmbed = Boolean(embed && embedOnly);
  // The conclusion & key findings take the final page of their own, after
  // every questionnaire page (F039) — unless the embed is the whole paper.
  const conclPage = soloEmbed ? -1 : Math.max(1, steps.length);
  const total = soloEmbed ? 1 : conclPage + 1;
  const lastPage = total - 1;
  const [step, setStep] = useState(0);
  // Compact view folds long answers to two lines until clicked; the default
  // shows every answer in full (lib/use-auto-size.ts).
  const [compact, setCompact] = useCompactView();
  // Tell the guidance rail which items are on screen (practical tips follow the page).
  useLayoutEffect(() => {
    const pageKeys = (steps[step] ?? []).map((it) => (it.kind === "proc" ? "p:" + it.key : it.kind === "yn" ? "q:" + it.key : "f:" + it.field.key));
    const keys = step === conclPage ? ["__conclusion__", ...pageKeys] : pageKeys;
    window.dispatchEvent(new CustomEvent("wp-step-items", { detail: { keys } }));
  }, [step, steps, conclPage]);
  // if a resize shrinks the page count, stay on a valid step
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must clamp before paint or the vanished page flashes; the updater is a no-op when already valid
    setStep((s) => Math.min(s, Math.max(0, lastPage)));
  }, [lastPage]);
  const concl = (fr ? def.conclFr : def.conclEn) ?? [];

  // Answers that gate the yellow boxes: yn questions, procedure N/A flags and
  // the conclusions. The status summary on page 1 reads the conclusions live.
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const it of items) {
      if (it.kind === "yn") init[ynKey(it.key)] = values[ynKey(it.key)] ?? "";
      if (it.kind === "proc") init[procNaKey(it.key)] = values[procNaKey(it.key)] ?? "";
    }
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
        disabled={ro(name)}
        onChange={() => answer(name, v)}
        data-testid={`wp-${name}-${v}`}
        className="h-3.5 w-3.5 accent-emerald-700"
      />
      {label}
    </label>
  );

  // The reason box under a factor: "No" asks how it was resolved, "N/A" why
  // the item does not apply (F040) — both mandatory for the paper to count
  // as answered (lib/papers/types.ts keyAnswered).
  const whyBox = (name: string, whyKey: string, state: string) =>
    state === "no" || state === NA ? (
      <div>
        {state === NA ? (
          <span className="mt-1 block text-[10.5px] font-semibold text-muted" data-testid={`wp-${whyKey}-na-label`}>
            {fr ? "Motif de la non-application (obligatoire)" : "Reason not applicable (required)"}
          </span>
        ) : null}
        <Amber
          name={whyKey}
          defaultValue={values[whyKey] ?? ""}
          placeholder={
            state === NA
              ? fr ? "Pourquoi cet élément ne s'applique pas à la mission" : "Why this item does not apply to the engagement"
              : fr ? "Motif, et suite donnée" : "Reason, and how it was resolved"
          }
          readOnly={ro(whyKey)}
          testId={`wp-${whyKey}`}
        />
      </div>
    ) : null;

  // One questionnaire item — shared by page 0 (beneath the status summary) and
  // every later page.
  const renderItem = (item: StepItem) => {
            const header = item.sectionTitle ? (
              <div className="mb-1 mt-1">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-emerald-700 dark:text-emerald-400">
                  {item.sectionTitle}
                </p>
                {item.sectionIntro ? (
                  <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{item.sectionIntro}</p>
                ) : null}
              </div>
            ) : null;
            if (item.kind === "field") {
              const f = item.field;
              const label = fr ? f.labelFr : f.labelEn;
              if (f.kind === "auto") {
                return (
                  <div key={f.key}>
                    {header}
                    <span className="block text-[11.5px] text-muted">{label}</span>
                    <p className="whitespace-pre-line rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-auto)] px-2.5 py-1.5 text-[13.2px] text-ink-soft" data-testid={`wp-auto-${f.key}`}>
                      {autoValues[f.key] ?? autoFieldEmpty(f.source, fr)}
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
                              disabled={ro(f.key)}
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
                      readOnly={ro(f.key)}
                      testId={`wp-${f.key}`}
                    />
                  </label>
                </div>
              );
            }
            if (item.kind === "proc") {
              // A procedure is done (its result recorded) or not applicable —
              // and an N/A carries its reason instead of a result (F040). The
              // hidden "" before the box clears the flag when it is unticked:
              // the action keeps the last value posted under a name.
              const naName = procNaKey(item.key);
              const na = answers[naName] === NA;
              return (
                <div key={item.key}>
                  {header}
                  <div className="rounded-[var(--radius-atlas-sm)] border border-line px-2.5 py-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-[13.2px] text-ink">
                        <span className="mr-1 font-mono text-[11px] text-muted tnum">{item.index}.</span>
                        {item.text}
                      </p>
                      <label className="flex flex-shrink-0 cursor-pointer items-center gap-1 text-[12.3px] text-ink-soft">
                        <input type="hidden" name={naName} value="" />
                        <input
                          type="checkbox"
                          name={naName}
                          value={NA}
                          defaultChecked={na}
                          disabled={ro(naName)}
                          onChange={(e) => answer(naName, e.target.checked ? NA : "")}
                          data-testid={`wp-${naName}`}
                          className="h-3.5 w-3.5 accent-emerald-700"
                        />
                        {fr ? "S.O." : "N/A"}
                      </label>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {fr ? "Sources attendues : " : "Expected sources: "}
                      {item.src}
                    </p>
                    {na ? (
                      whyBox(naName, procWhyKey(item.key), NA)
                    ) : (
                      <Amber
                        name={procKey(item.key)}
                        defaultValue={values[procKey(item.key)] ?? ""}
                        placeholder={fr ? "Résultat et référence du dossier" : "Result and working-paper reference"}
                        readOnly={ro(procKey(item.key))}
                        testId={`wp-${procKey(item.key)}`}
                      />
                    )}
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
                      {radio(name, NA, fr ? "S.O." : "N/A", values[name] === NA)}
                    </span>
                  </div>
                  {whyBox(name, item.whyKey, answers[name] ?? "")}
                </div>
              </div>
            );
  };

  // The conclusion and key findings, answerable on the last page. They used
  // to open page 1 (and to be dropped entirely behind an embed, so a paper
  // like C6.2 counted conclusions nobody could answer and could never reach
  // "complete" — UAT B04); since F039 every paper concludes where the work
  // it concludes on has been read.
  const conclusionBlock = (
    <>
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
                  readOnly={ro(conclWhyKey(i))}
                />
              ) : null}
            </div>
          ))}
          <label className="flex flex-col gap-1 text-[11.5px] font-bold uppercase tracking-[0.07em] text-muted">
            {fr ? "Constats clés" : "Key findings"}
            <RichText
              name="key_findings"
              defaultValue={values["key_findings"] ?? ""}
              readOnly={ro("key_findings")}
              testId="wp-key-findings"
              placeholder={
                fr
                  ? "Constats importants du travail effectué — repris en C1.2/C1.1 le cas échéant"
                  : "Significant findings from the work performed — routed to C1.2/C1.1 where applicable"
              }
              className="min-h-[96px] w-full resize-none overflow-hidden rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-input)] px-2.5 py-1.5 text-[13.2px] font-normal normal-case tracking-normal text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-emerald-600/25"
            />
          </label>
    </>
  );

  // Page 1 (F039): what the paper concluded and who signed it, read-only —
  // the live radios sit on the last page. Reads `answers` so a conclusion
  // chosen on the last page shows here before the save.
  const conclusionTone = (v: string) =>
    v === "yes"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : v === "no"
        ? "bg-[var(--color-rose-soft)] text-rose"
        : "bg-surface-2 text-muted";
  const signatureLine = (label: string, s: PaperSignature | null | undefined, testId: string) => (
    <span className="flex items-center gap-1.5 text-[12px]" data-testid={testId} data-signed={String(Boolean(s))}>
      <span className="text-muted">{label}</span>
      {s ? (
        <span className="font-semibold text-ink">{s.name} · {s.at}</span>
      ) : (
        <span className="text-muted">{fr ? "non signé" : "not signed"}</span>
      )}
    </span>
  );
  const statusBlock = (
    <div className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2" data-testid="wp-status">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-muted">
        <span>{fr ? "État de la feuille" : "Paper status"}</span>
        {editionLabel ? (
          <span className="normal-case tracking-normal font-semibold" data-testid="wp-edition">{editionLabel}</span>
        ) : null}
      </p>
      {concl.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-1">
          {concl.map((c, i) => {
            const v = answers[conclKey(i)] ?? "";
            return (
              <li key={i} className="flex items-start justify-between gap-3 text-[12.3px] text-ink-soft" data-testid={`wp-status-concl-${i}`} data-value={v}>
                <span className="min-w-0 flex-1">{c}</span>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${conclusionTone(v)}`}>
                  {v === "yes" ? (fr ? "Oui" : "Yes") : v === "no" ? (fr ? "Non" : "No") : fr ? "Pas encore conclu" : "Not yet concluded"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        {signatureLine(fr ? "Préparateur" : "Preparer", signoffs?.preparer, "wp-status-preparer")}
        {signatureLine(fr ? "Réviseur" : "Reviewer", signoffs?.reviewer, "wp-status-reviewer")}
        {signoffs?.eqr !== undefined ? signatureLine("EQR", signoffs.eqr, "wp-status-eqr") : null}
      </div>
      {!readOnly ? (
        <button
          type="button"
          onClick={() => setStep(conclPage)}
          className="mt-1.5 text-[11.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          data-testid="wp-goto-conclusion"
        >
          {fr ? `Conclure en dernière page (${conclPage + 1}/${total}) ›` : `Conclude on the last page (${conclPage + 1}/${total}) ›`}
        </button>
      ) : null}
    </div>
  );

  return (
    <form action={action} data-testid={`wp-form-${code}`} className="flex h-full min-h-0 flex-col">
      {baseVersion !== undefined ? <input type="hidden" name="__baseVersion" value={baseVersion} /> : null}
      {baseDigests !== undefined ? <input type="hidden" name="__baseDigests" value={baseDigests} /> : null}
      <UnsavedGuard message={fr ? "Des modifications non enregistrées seront perdues." : "Unsaved changes will be lost."} />
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.07em] text-muted" data-testid="wp-page-title">
          {step === conclPage
            ? fr
              ? "Conclusion & constats clés"
              : "Conclusion & key findings"
            : step === 0
            ? embed
              ? (embedTitle ?? (fr ? "Travaux" : "Work"))
              : fr
                ? "État & questionnaire"
                : "Status & questionnaire"
            : fr
              ? "Questionnaire"
              : "Questionnaire"}
        </span>
        {soloEmbed ? null : (
        <span className="flex items-center gap-1.5">
          <label
            className="mr-1 flex cursor-pointer items-center gap-1 text-[11.5px] text-muted print:hidden"
            title={fr ? "Replier les réponses longues à deux lignes ; un clic sur une réponse l'ouvre en entier" : "Fold long answers to two lines; click an answer to open it in full"}
          >
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => setCompact(e.target.checked)}
              className="h-3.5 w-3.5 accent-emerald-700"
              data-testid="wp-compact-toggle"
            />
            {fr ? "Vue compacte" : "Compact view"}
          </label>
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
        )}
      </div>

      {/* the measuring shell: all steps render inside; its height drives packing */}
      {/* wp-steps / wp-step: print lays every step out in flow, in DOM order — the
          conclusion page is rendered last so it prints last (globals.css @media print, UAT B107) */}
      <div ref={areaRef} className="wp-steps relative min-h-0 flex-1 overflow-hidden">
      {/* step 0: the embed when one is given, else the status summary + the first questions */}
      {embed ? (
        <div hidden={step !== 0} className="wp-step absolute inset-0 mt-2 overflow-y-auto overflow-x-hidden" data-testid="wp-embed">
          {embed}
        </div>
      ) : (
      <div hidden={step !== 0} className="wp-step absolute inset-0 mt-2 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
        {statusBlock}
        {(steps[0] ?? []).map(renderItem)}
      </div>
      )}

      {/* questionnaire pages beyond the first */}
      {soloEmbed ? null : steps.slice(1).map((pageItems, si) => (
        <div key={si} hidden={step !== si + 1} className="wp-step absolute inset-0 mt-2 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
          {pageItems.map(renderItem)}
        </div>
      ))}

      {/* the last page: conclusion & key findings */}
      {conclPage >= 0 ? (
        <div hidden={step !== conclPage} className="wp-step absolute inset-0 mt-2 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden" data-testid="wp-conclusion-page">
          {conclusionBlock}
        </div>
      ) : null}

      </div>

      {readOnly || soloEmbed ? null : (
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
