"use client";

// The journal-entry selection studio.
//
// One screen for the choice ISA 240 ¶32 asks the auditor to make and then to be
// able to defend: which criteria direct the sample, what thresholds each of them
// carries, and which line items came back. The catalogue arrives from
// lib/je-selection as data — every control below is rendered from a criterion's
// declared parameters, so a criterion that gains a threshold gains its control
// here without this file being touched.
//
// The result is read the way the engine produces it: one row per LINE carrying
// every reason it was selected, never one row per criterion. The parameters and
// the methodology rationale stay on screen beside the counts, because the
// working paper has to say why the selection was directed the way it was, and a
// count without its threshold cannot say that.
//
// Amount convention, carried from the engine and never reversed here:
//   signed = debit - credit  -> debits positive, credits negative,
// and negatives print in parentheses through num() in components/ui/excel.tsx.

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Chip, Panel, PanelHeader, btnGhost, btnPrimary } from "@/components/ui/atlas";
import { SCell, SRow, Sheet, SheetNote, SheetTable, num, type SheetCol } from "@/components/ui/excel";
import type {
  CriterionCategory, CriterionCoverage, CriterionDef, CriterionParamDef,
  RuleFieldDef, RuleFieldType, RuleOperator, SelectionResult,
} from "@/lib/je-selection";

export interface JeDatasetOption {
  id: string;
  sourceFilename: string;
  timing: "pre_audit" | "post_audit" | "prior_year";
  rowCount: number;
  createdAt: string;
}

/** Page sizes offered; the engine caps one page at 500 lines whatever is asked. */
const PAGE_SIZES = [50, 100, 200, 500];

const TIMING: Record<JeDatasetOption["timing"], { en: string; fr: string }> = {
  pre_audit: { en: "Pre-audit GL", fr: "Grand livre pré-audit" },
  post_audit: { en: "Post-audit GL", fr: "Grand livre post-audit" },
  prior_year: { en: "Prior-year GL", fr: "Grand livre N-1" },
};

const CATEGORY: Record<CriterionCategory, { en: string; fr: string }> = {
  timing: { en: "Timing", fr: "Rattachement" },
  documentation: { en: "Documentation", fr: "Documentation" },
  value: { en: "Value", fr: "Valeur" },
  pattern: { en: "Pattern", fr: "Tendance" },
  attribution: { en: "Attribution", fr: "Attribution" },
  custom: { en: "Auditor's own", fr: "Propre à l'auditeur" },
};

/** The two operators that compare against nothing, so no value box is shown for them. */
const NO_VALUE: readonly RuleOperator[] = ["isEmpty", "isNotEmpty"];

const field =
  "h-8 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 text-[12px] text-ink outline-none focus:border-emerald-600";

interface DraftRule {
  id: string;
  field: string;
  operator: RuleOperator;
  value: string;
  value2: string;
}

/**
 * A criterion's parameters as the controls hold them: text for everything typed,
 * an array for a multi-choice that declares its options. The filler terms are a
 * multi-choice WITHOUT options, so they are held as the raw line being edited and
 * split only when the run is sent — splitting on each keystroke would swallow the
 * separator as it is typed.
 */
type ParamValues = Record<string, string | string[]>;

function initialValues(criteria: readonly CriterionDef[]): ParamValues {
  const values: ParamValues = {};
  for (const def of criteria) {
    for (const param of def.params) {
      values[param.key] = Array.isArray(param.default)
        ? (param.options ? [...param.default] : param.default.join(", "))
        : String(param.default);
    }
  }
  return values;
}

const splitTerms = (raw: string): string[] =>
  raw.split(/[,;\n]+/).map((term) => term.trim()).filter((term) => term.length > 0);

export function JeSelectionStudio({
  engagementId,
  locale,
  datasets,
  criteria,
  ruleFields,
  ruleOperators,
  operatorLabels,
  analyzerHref,
  glConsoleHref,
}: {
  engagementId: string;
  locale: "en" | "fr";
  datasets: JeDatasetOption[];
  /** JE_CRITERIA, handed down rather than imported: lib/je-selection opens the pool */
  criteria: CriterionDef[];
  ruleFields: RuleFieldDef[];
  ruleOperators: Record<RuleFieldType, readonly RuleOperator[]>;
  operatorLabels: Record<RuleOperator, { en: string; fr: string }>;
  /** the GL Analyzer, where a ledger is imported in the first place */
  analyzerHref: string;
  /** the GL Correlation Console, the one screen that prepares the projection */
  glConsoleHref: string;
}) {
  const fr = locale === "fr";
  const T = (en: string, frText: string) => (fr ? frText : en);

  const builtIn = useMemo(() => criteria.filter((c) => c.key !== "user-defined"), [criteria]);
  const custom = useMemo(() => criteria.find((c) => c.key === "user-defined") ?? null, [criteria]);

  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const dataset = datasets.find((d) => d.id === datasetId) ?? null;

  // Every built-in criterion starts on, the stance the pairing parameter takes
  // too: the auditor narrows a risk-directed selection rather than assembling one
  // from nothing.
  const [chosen, setChosen] = useState<string[]>(() => builtIn.map((c) => c.key));
  const [values, setValues] = useState<ParamValues>(() => initialValues(criteria));
  const [rules, setRules] = useState<DraftRule[]>([]);
  const [limit, setLimit] = useState(200);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SelectionResult | null>(null);

  const ruleSeq = useRef(0);

  const fieldByKey = useMemo(
    () => Object.fromEntries(ruleFields.map((f) => [f.key, f])) as Record<string, RuleFieldDef>,
    [ruleFields],
  );
  const paramLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const def of criteria) {
      for (const param of def.params) labels[param.key] = fr ? param.labelFr : param.labelEn;
    }
    return labels;
  }, [criteria, fr]);

  const ruleIsIncomplete = (rule: DraftRule): boolean => {
    if (NO_VALUE.includes(rule.operator)) return false;
    if (rule.value.trim() === "") return true;
    return rule.operator === "between" && rule.value2.trim() === "";
  };
  const incomplete = rules.filter(ruleIsIncomplete).length;
  const runnable = datasetId !== "" && incomplete === 0 && (chosen.length > 0 || rules.length > 0);

  // -- transport ----------------------------------------------------------

  const messageFor = (code: string): string => {
    switch (code) {
      case "no-criteria":
        return T(
          "Choose at least one criterion, or write a rule of your own.",
          "Retenez au moins un critère, ou rédigez une règle qui vous est propre.",
        );
      case "invalid-rule-field":
      case "invalid-rule-operator":
      case "invalid-rule-value":
        return T(
          "One of your own rules is not usable as written — check its column, its operator and the value it compares against.",
          "L'une de vos règles n'est pas exploitable telle qu'elle est écrite — vérifiez sa colonne, son opérateur et la valeur comparée.",
        );
      case "invalid-dataset":
        return T(
          "No general ledger was named for this run.",
          "Aucun grand livre n'a été désigné pour cette exécution.",
        );
      case "not-on-this-engagement":
        return T("You are not on this engagement.", "Vous n'êtes pas affecté à cette mission.");
      case "unauthenticated":
        return T("Your session has expired. Sign in again.", "Votre session a expiré. Reconnectez-vous.");
      case "network":
        return T("The selection could not be sent.", "La sélection n'a pas pu être envoyée.");
      default:
        return T("The selection could not be run.", "La sélection n'a pas pu être exécutée.");
    }
  };

  const paramsPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = { locale };
    for (const def of criteria) {
      for (const param of def.params) {
        const raw = values[param.key];
        if (param.kind === "integer" || param.kind === "number") {
          payload[param.key] = Number(String(raw).replace(",", "."));
        } else if (param.kind === "multi") {
          payload[param.key] = Array.isArray(raw) ? raw : splitTerms(String(raw));
        } else {
          payload[param.key] = String(raw);
        }
      }
    }
    return payload;
  };

  const run = async (offset: number) => {
    setPending(true);
    setError(null);
    let response: Response | null = null;
    try {
      response = await fetch(`/api/engagements/${engagementId}/je-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          criteria: chosen,
          params: paramsPayload(),
          userRules: rules.map((rule) => ({
            id: rule.id,
            field: rule.field,
            operator: rule.operator,
            value: rule.value,
            value2: rule.value2,
          })),
          limit,
          offset,
        }),
      });
    } catch {
      response = null;
    }
    if (!response) {
      setPending(false);
      setResult(null);
      setError(messageFor("network"));
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { result?: SelectionResult; error?: string };
    setPending(false);
    if (!response.ok || !body.result) {
      setResult(null);
      setError(messageFor(String(body.error ?? "selection-failed")));
      return;
    }
    setResult(body.result);
  };

  // -- criteria -----------------------------------------------------------

  const toggle = (key: string) =>
    setChosen((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  const setValue = (key: string, value: string | string[]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const toggleOption = (key: string, option: string) =>
    setValues((current) => {
      const held = Array.isArray(current[key]) ? (current[key] as string[]) : [];
      return { ...current, [key]: held.includes(option) ? held.filter((v) => v !== option) : [...held, option] };
    });

  function paramControl(def: CriterionDef, param: CriterionParamDef) {
    const id = `je-param-${param.key}`;
    const raw = values[param.key];
    const label = fr ? param.labelFr : param.labelEn;
    const help = fr ? param.helpFr : param.helpEn;
    const isGroup = param.kind === "multi" && Boolean(param.options);

    let control;
    if (param.kind === "choice") {
      control = (
        <select
          id={id}
          value={String(raw ?? "")}
          onChange={(e) => setValue(param.key, e.target.value)}
          className={`${field} w-full`}
          data-testid={id}
        >
          {(param.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {fr ? option.labelFr : option.labelEn}
            </option>
          ))}
        </select>
      );
    } else if (param.kind === "multi" && param.options) {
      const held = Array.isArray(raw) ? raw : [];
      control = (
        <div role="group" aria-label={label} className="flex flex-col gap-1" data-testid={id}>
          {param.options.map((option) => (
            <label key={option.value} className="flex items-start gap-2 text-[11.5px] text-ink">
              <input
                type="checkbox"
                checked={held.includes(option.value)}
                onChange={() => toggleOption(param.key, option.value)}
                className="mt-[3px] accent-emerald-700"
                data-testid={`${id}-${option.value}`}
              />
              <span>{fr ? option.labelFr : option.labelEn}</span>
            </label>
          ))}
        </div>
      );
    } else if (param.kind === "multi") {
      control = (
        <textarea
          id={id}
          rows={3}
          value={String(raw ?? "")}
          onChange={(e) => setValue(param.key, e.target.value)}
          className="w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1.5 text-[11.5px] leading-snug text-ink outline-none focus:border-emerald-600"
          data-testid={id}
        />
      );
    } else {
      control = (
        <input
          id={id}
          type={param.kind === "text" ? "text" : "number"}
          inputMode={param.kind === "integer" ? "numeric" : undefined}
          step={param.kind === "integer" ? 1 : "any"}
          min={param.min}
          max={param.max}
          value={String(raw ?? "")}
          onChange={(e) => setValue(param.key, e.target.value)}
          className={`${field} w-full tnum`}
          data-testid={id}
        />
      );
    }

    return (
      <div key={`${def.key}-${param.key}`} className="flex flex-col gap-1">
        {isGroup ? (
          <p className="text-[11px] font-semibold text-ink-soft">{label}</p>
        ) : (
          <label htmlFor={id} className="text-[11px] font-semibold text-ink-soft">{label}</label>
        )}
        {control}
        <p className="text-[10.5px] leading-snug text-muted">{help}</p>
      </div>
    );
  }

  // -- the auditor's own rules --------------------------------------------

  const addRule = () => {
    const first = ruleFields[0];
    if (!first) return;
    ruleSeq.current += 1;
    setRules((current) => [
      ...current,
      { id: `r${ruleSeq.current}`, field: first.key, operator: ruleOperators[first.type][0], value: "", value2: "" },
    ]);
  };

  const editRule = (id: string, patch: Partial<DraftRule>) =>
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  const changeRuleField = (id: string, key: string) =>
    setRules((current) =>
      current.map((rule) => {
        if (rule.id !== id) return rule;
        const next = fieldByKey[key];
        if (!next) return rule;
        // An operator that does not fit the new column would be refused by the
        // engine, so it gives way to the first one that does fit rather than
        // being carried across; the value goes with it, since a date typed for a
        // text column is not the same value.
        const allowed = ruleOperators[next.type];
        const operator = allowed.includes(rule.operator) ? rule.operator : allowed[0];
        return { ...rule, field: key, operator, value: "", value2: "" };
      }),
    );

  const removeRule = (id: string) => setRules((current) => current.filter((rule) => rule.id !== id));

  const inputTypeFor = (type: RuleFieldType): string =>
    type === "date" ? "date" : type === "number" ? "number" : "text";

  // -- nothing to select from ---------------------------------------------

  if (datasets.length === 0) {
    return (
      <Sheet title={T("No general ledger imported", "Aucun grand livre importé")} testId="je-no-dataset">
        <SheetNote>
          {T(
            "This engagement has no general-ledger dataset, so there is nothing to select from. Import the ledger in the GL Analyzer, prepare it in the GL Correlation Console, then come back here.",
            "Cette mission n'a aucun jeu de données de grand livre : il n'y a rien à sélectionner. Importer le grand livre dans l'analyseur, le préparer dans la console de corrélation, puis revenir ici.",
          )}
        </SheetNote>
        <div>
          <Link href={analyzerHref} className={btnGhost} data-testid="je-analyzer-link">
            {T("Open the GL Analyzer", "Ouvrir l'analyseur du grand livre")}
          </Link>
        </div>
      </Sheet>
    );
  }

  // -- what came back -----------------------------------------------------

  const emptyProjection = result !== null && result.population.lines === 0;
  const nothingSelected = result !== null && !emptyProjection && result.selectedLines === 0;
  const offset = result?.offset ?? 0;

  const populationCols: SheetCol[] = [
    { label: T("Source file", "Fichier source"), width: 220 },
    { label: T("Ledger lines", "Lignes du grand livre"), align: "right", width: 120 },
    { label: T("Entries", "Écritures"), align: "right", width: 110 },
    { label: T("Dated lines", "Lignes datées"), align: "right", width: 120 },
    { label: T("Lines selected", "Lignes retenues"), align: "right", width: 130 },
    { label: T("Entries selected", "Écritures retenues"), align: "right", width: 140 },
    { label: T("Shown here", "Affichées ici"), align: "right", width: 120 },
  ];

  const coverageCols: SheetCol[] = [
    { label: T("Criterion", "Critère"), width: 240 },
    { label: T("What it selects", "Ce qu'il retient"), width: 420 },
    { label: T("Parameters it ran with", "Paramètres retenus"), width: 340 },
    { label: T("Lines", "Lignes"), align: "right", width: 90 },
    { label: T("Entries", "Écritures"), align: "right", width: 100 },
  ];

  const lineCols: SheetCol[] = [
    { label: T("Entry", "Écriture"), width: 120 },
    { label: T("Journal", "Journal"), width: 90 },
    { label: T("Journal date", "Date de journal"), width: 110 },
    { label: T("Entry date", "Date de saisie"), width: 110 },
    { label: T("Account", "Compte"), width: 100 },
    { label: T("Account name", "Libellé du compte"), width: 190 },
    { label: T("Description", "Libellé"), width: 240 },
    { label: T("Debit", "Débit"), align: "right", width: 120 },
    { label: T("Credit", "Crédit"), align: "right", width: 120 },
    { label: T("Signed", "Signé"), align: "right", width: 120 },
    { label: T("Preparer", "Préparateur"), width: 130 },
    { label: T("Reviewer", "Réviseur"), width: 130 },
    { label: T("Why this line was selected", "Motifs de la sélection"), width: 560 },
  ];

  /** The thresholds one criterion ran with, in the words the parameter carries. */
  const settingsOf = (row: CriterionCoverage): string => {
    if (row.key.startsWith("user:")) {
      const ruleField = fieldByKey[String(row.settings.field ?? "")];
      const operator = String(row.settings.operator ?? "") as RuleOperator;
      const operatorLabel = operatorLabels[operator];
      return [
        ruleField ? (fr ? ruleField.labelFr : ruleField.labelEn) : String(row.settings.field ?? ""),
        operatorLabel ? (fr ? operatorLabel.fr : operatorLabel.en) : operator,
      ].join(" · ");
    }
    const parts = Object.entries(row.settings).map(([key, value]) => {
      const label = paramLabels[key] ?? key;
      if (Array.isArray(value)) {
        const shown = value.slice(0, 6).join(", ");
        return `${label}: ${value.length > 6 ? `${shown} (+${value.length - 6})` : shown}`;
      }
      return `${label}: ${String(value)}`;
    });
    return parts.length > 0 ? parts.join(" · ") : T("no threshold", "aucun seuil");
  };

  /** The same thresholds in full, since a long list is abbreviated in the cell. */
  const settingsTitle = (row: CriterionCoverage): string =>
    Object.entries(row.settings)
      .map(([key, value]) => `${paramLabels[key] ?? key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
      .join("\n");

  return (
    <div className="flex flex-col gap-4" data-testid="je-selection-studio">
      {/* A. THE LEDGER AND THE RUN ------------------------------------------ */}
      <Panel>
        <PanelHeader
          title={T("Ledger and run", "Grand livre et exécution")}
          hint={T(
            "the selection runs against the prepared projection of one general ledger",
            "la sélection s'exécute sur la projection préparée d'un grand livre",
          )}
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="je-dataset" className="text-[11px] font-semibold text-ink-soft">
              {T("General ledger version", "Version du grand livre")}
            </label>
            <select
              id="je-dataset"
              value={datasetId}
              onChange={(e) => { setDatasetId(e.target.value); setResult(null); setError(null); }}
              className={`${field} w-[420px] max-w-full`}
              data-testid="je-dataset-select"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {`${fr ? TIMING[d.timing].fr : TIMING[d.timing].en} · ${d.sourceFilename} · ${d.createdAt}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="je-limit" className="text-[11px] font-semibold text-ink-soft">
              {T("Lines per page", "Lignes par page")}
            </label>
            <select
              id="je-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className={`${field} w-[110px] tnum`}
              data-testid="je-limit-select"
            >
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void run(0)}
            disabled={pending || !runnable}
            className={`${btnPrimary} disabled:opacity-50`}
            data-testid="je-run"
          >
            {pending ? T("Selecting…", "Sélection en cours…") : T("Run the selection", "Exécuter la sélection")}
          </button>
          <span className="text-[11.5px] text-muted" data-testid="je-run-summary">
            {T(
              `${chosen.length} criteria and ${rules.length} rule(s) of your own, over ${dataset?.rowCount ?? 0} imported source rows.`,
              `${chosen.length} critères et ${rules.length} règle(s) qui vous sont propres, sur ${dataset?.rowCount ?? 0} lignes source importées.`,
            )}
          </span>
        </div>
        {incomplete > 0 ? (
          <p className="mt-2 text-[12px] font-semibold text-warn" data-testid="je-rules-incomplete">
            {T(
              `${incomplete} of your own rules is still missing the value it compares against.`,
              `${incomplete} de vos règles attend encore la valeur qu'elle compare.`,
            )}
          </p>
        ) : null}
        {chosen.length === 0 && rules.length === 0 ? (
          <p className="mt-2 text-[12px] font-semibold text-warn" data-testid="je-no-criteria">
            {T(
              "Nothing is chosen yet. A selection needs at least one criterion, or one rule of your own.",
              "Rien n'est retenu pour l'instant. Une sélection exige au moins un critère, ou une règle qui vous est propre.",
            )}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-[12px] font-semibold text-rose" role="alert" data-testid="je-error">{error}</p>
        ) : null}
      </Panel>

      {/* B. THE CATALOGUE --------------------------------------------------- */}
      <Panel>
        <PanelHeader
          title={T("Criteria", "Critères")}
          hint={T(
            "each one carries its own thresholds and the methodology reason for choosing it",
            "chacun porte ses propres seuils et la raison méthodologique de son choix",
          )}
          right={
            <>
              <button
                type="button"
                onClick={() => setChosen(builtIn.map((c) => c.key))}
                className={`${btnGhost} h-8 px-3 text-[12px]`}
                data-testid="je-select-all"
              >
                {T("All", "Tous")}
              </button>
              <button
                type="button"
                onClick={() => setChosen([])}
                className={`${btnGhost} h-8 px-3 text-[12px]`}
                data-testid="je-select-none"
              >
                {T("None", "Aucun")}
              </button>
            </>
          }
        />
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="je-criteria">
          {builtIn.map((def) => {
            const on = chosen.includes(def.key);
            return (
              <div
                key={def.key}
                className={`rounded-[var(--radius-atlas-sm)] border p-3 transition ${on ? "border-emerald-600/40 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-line bg-surface"}`}
                data-testid={`je-criterion-${def.key}`}
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(def.key)}
                    className="mt-[3px] accent-emerald-700"
                    data-testid={`je-criterion-toggle-${def.key}`}
                  />
                  <span className="flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="text-[13px] text-ink">{fr ? def.nameFr : def.nameEn}</b>
                      <Chip tone="muted">{fr ? CATEGORY[def.category].fr : CATEGORY[def.category].en}</Chip>
                      {def.entryLevel ? <Chip tone="accent">{T("Whole entry", "Écriture entière")}</Chip> : null}
                    </span>
                    <span className="mt-1 block text-[11.5px] leading-snug text-ink-soft">
                      {fr ? def.descriptionFr : def.descriptionEn}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted">
                      {fr ? def.rationaleFr : def.rationaleEn}
                    </span>
                  </span>
                </label>
                {on && def.params.length > 0 ? (
                  <div className="mt-2.5 grid grid-cols-1 gap-2.5 border-t border-line pt-2.5 sm:grid-cols-2">
                    {def.params.map((param) => paramControl(def, param))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted" data-testid="je-shared-params">
          {T(
            "The date tested is one setting shared by every timing criterion: changing it on one changes it on all of them, because a run reads a single date per line.",
            "La date testée est un réglage commun à tous les critères de rattachement : la modifier sur l'un la modifie sur tous, une exécution ne lisant qu'une date par ligne.",
          )}
        </p>
      </Panel>

      {/* C. THE AUDITOR'S OWN RULES ----------------------------------------- */}
      <Panel>
        <PanelHeader
          title={custom ? (fr ? custom.nameFr : custom.nameEn) : T("Your own rules", "Vos propres règles")}
          hint={custom ? (fr ? custom.descriptionFr : custom.descriptionEn) : undefined}
          right={
            <button type="button" onClick={addRule} className={`${btnGhost} h-8 px-3 text-[12px]`} data-testid="je-rule-add">
              {T("Add a rule", "Ajouter une règle")}
            </button>
          }
        />
        {custom ? (
          <p className="mt-2 text-[11px] leading-snug text-muted">{fr ? custom.rationaleFr : custom.rationaleEn}</p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2" data-testid="je-rules">
          {rules.length === 0 ? (
            <p className="text-[12px] text-ink-soft" data-testid="je-rules-empty">
              {T(
                "No rule of your own yet. The built-in criteria run without one.",
                "Aucune règle propre pour l'instant. Les critères intégrés s'exécutent sans elle.",
              )}
            </p>
          ) : null}
          {rules.map((rule) => {
            const def = fieldByKey[rule.field];
            const type: RuleFieldType = def?.type ?? "text";
            const showValue = !NO_VALUE.includes(rule.operator);
            return (
              <div key={rule.id} className="flex flex-wrap items-center gap-2" data-testid={`je-rule-${rule.id}`}>
                <select
                  value={rule.field}
                  onChange={(e) => changeRuleField(rule.id, e.target.value)}
                  className={`${field} w-[190px]`}
                  aria-label={T("Ledger column", "Colonne du grand livre")}
                  data-testid={`je-rule-field-${rule.id}`}
                >
                  {ruleFields.map((f) => (
                    <option key={f.key} value={f.key}>{fr ? f.labelFr : f.labelEn}</option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={(e) => editRule(rule.id, { operator: e.target.value as RuleOperator })}
                  className={`${field} w-[190px]`}
                  aria-label={T("Operator", "Opérateur")}
                  data-testid={`je-rule-operator-${rule.id}`}
                >
                  {ruleOperators[type].map((op) => (
                    <option key={op} value={op}>{fr ? operatorLabels[op].fr : operatorLabels[op].en}</option>
                  ))}
                </select>
                {showValue ? (
                  <input
                    type={inputTypeFor(type)}
                    value={rule.value}
                    onChange={(e) => editRule(rule.id, { value: e.target.value })}
                    className={`${field} w-[180px]`}
                    aria-label={T("Value", "Valeur")}
                    data-testid={`je-rule-value-${rule.id}`}
                  />
                ) : null}
                {showValue && rule.operator === "between" ? (
                  <input
                    type={inputTypeFor(type)}
                    value={rule.value2}
                    onChange={(e) => editRule(rule.id, { value2: e.target.value })}
                    className={`${field} w-[180px]`}
                    aria-label={T("Second bound", "Seconde borne")}
                    data-testid={`je-rule-value2-${rule.id}`}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className={`${btnGhost} h-8 px-3 text-[12px]`}
                  data-testid={`je-rule-remove-${rule.id}`}
                >
                  {T("Remove", "Retirer")}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* D. THE RESULT ------------------------------------------------------ */}
      {result ? (
        <>
          <Sheet
            title={T("Population and coverage", "Population et couverture")}
            subtitle={dataset?.sourceFilename}
            testId="je-population"
          >
            <SheetTable cols={populationCols} testId="je-population-table">
              <tbody>
                <SRow n={1} testId="je-population-row">
                  <SCell wrap>{dataset?.sourceFilename ?? "—"}</SCell>
                  <SCell align="right" kind="calc">{num(result.population.lines)}</SCell>
                  <SCell align="right" kind="calc">{num(result.population.entries)}</SCell>
                  <SCell align="right" kind="calc">{num(result.population.datedLines)}</SCell>
                  <SCell align="right" kind="calc">{num(result.selectedLines)}</SCell>
                  <SCell align="right" kind="calc">{num(result.selectedEntries)}</SCell>
                  <SCell align="right" kind="calc">{num(result.lines.length)}</SCell>
                </SRow>
              </tbody>
            </SheetTable>

            {result.notes.map((note, i) => (
              <SheetNote key={i} testId={`je-note-${i}`}>{note}</SheetNote>
            ))}

            {emptyProjection ? (
              <>
                <SheetNote testId="je-unbuilt">
                  {T(
                    "This ledger has no prepared projection: the imported file has not been turned into typed ledger lines, so there is no population to select from. An empty table here would read as a clean ledger, which is not what happened. Prepare the ledger in the GL Correlation Console, then run the selection again.",
                    "Ce grand livre n'a pas de projection préparée : le fichier importé n'a pas été transformé en lignes typées, il n'y a donc aucune population à sélectionner. Un tableau vide se lirait ici comme un grand livre sans anomalie, ce qui n'est pas ce qui s'est passé. Préparez le grand livre dans la console de corrélation, puis relancez la sélection.",
                  )}
                </SheetNote>
                <div>
                  <Link href={glConsoleHref} className={btnGhost} data-testid="je-console-link">
                    {T("Open the GL Correlation Console", "Ouvrir la console de corrélation")}
                  </Link>
                </div>
              </>
            ) : null}

            {nothingSelected ? (
              <SheetNote testId="je-nothing-selected">
                {T(
                  "No line met any of the criteria as they are set. That is a result rather than the absence of one, so carry the thresholds above into the working paper: they are what the conclusion rests on.",
                  "Aucune ligne ne satisfait les critères tels qu'ils sont réglés. C'est un résultat, non l'absence de résultat : reprenez les seuils ci-dessus dans le dossier, car c'est sur eux que repose la conclusion.",
                )}
              </SheetNote>
            ) : null}

            {!emptyProjection ? (
              <SheetTable cols={coverageCols} testId="je-coverage">
                <tbody>
                  {result.criteria.map((row, i) => (
                    <SRow key={row.key} n={i + 1} testId={`je-coverage-${row.key}`}>
                      <SCell wrap>{row.name}</SCell>
                      <SCell wrap>{row.description}</SCell>
                      <SCell wrap title={settingsTitle(row)}>{settingsOf(row)}</SCell>
                      <SCell align="right" kind="calc">{num(row.matchedLines)}</SCell>
                      <SCell align="right" kind="calc">{num(row.matchedEntries)}</SCell>
                    </SRow>
                  ))}
                </tbody>
              </SheetTable>
            ) : null}
          </Sheet>

          {result.lines.length > 0 ? (
            <Sheet
              title={T("Line items selected for testing", "Lignes retenues pour test")}
              subtitle={T(
                `Lines ${offset + 1}–${offset + result.lines.length} of ${result.selectedLines}`,
                `Lignes ${offset + 1} à ${offset + result.lines.length} sur ${result.selectedLines}`,
              )}
              objective={T(
                "One row per line item, carrying every reason it was selected. A line caught by four criteria appears once with four reasons: the auditor tests the item, and the reasons are what the working paper cites.",
                "Une ligne par élément retenu, portant tous les motifs de sa sélection. Une ligne retenue par quatre critères apparaît une seule fois avec quatre motifs : l'auditeur teste l'élément, et les motifs sont ce que le dossier cite.",
              )}
              testId="je-lines"
            >
              <SheetTable cols={lineCols} testId="je-lines-table">
                <tbody>
                  {result.lines.map((line, i) => (
                    <SRow key={line.id} n={offset + i + 1} testId={`je-line-${line.id}`}>
                      <SCell>{line.jeNumber}</SCell>
                      <SCell>{line.journalCode ?? "—"}</SCell>
                      <SCell>{line.journalDate ?? "—"}</SCell>
                      <SCell>{line.entryDate ?? "—"}</SCell>
                      <SCell>{line.account}</SCell>
                      <SCell wrap>{line.accountName ?? "—"}</SCell>
                      <SCell wrap>{line.lineDescription || line.jeDescription || "—"}</SCell>
                      <SCell align="right">{num(line.debit)}</SCell>
                      <SCell align="right">{num(line.credit)}</SCell>
                      <SCell align="right" kind="calc">{num(line.signed)}</SCell>
                      <SCell wrap>{line.preparer ?? "—"}</SCell>
                      <SCell wrap>{line.reviewer ?? "—"}</SCell>
                      <SCell wrap testId={`je-line-reasons-${line.id}`}>
                        <span className="flex flex-col gap-1">
                          {line.reasons.map((reason, r) => (
                            <span key={`${reason.criterion}-${r}`} className="block">
                              <b className="text-ink">{reason.label}</b>
                              <span className="text-ink-soft"> — {reason.detail}</span>
                            </span>
                          ))}
                        </span>
                      </SCell>
                    </SRow>
                  ))}
                </tbody>
              </SheetTable>

              <div className="flex flex-wrap items-center gap-2">
                {/* Paging walks by the lines actually shown rather than by the
                    page size, so changing the page size between two pages can
                    overlap a few lines but can never step over one. */}
                <button
                  type="button"
                  onClick={() => void run(Math.max(0, offset - limit))}
                  disabled={pending || offset === 0}
                  className={`${btnGhost} h-8 px-3 text-[12px] disabled:opacity-40`}
                  data-testid="je-prev"
                >
                  ← {T("Previous", "Précédentes")}
                </button>
                <button
                  type="button"
                  onClick={() => void run(offset + result.lines.length)}
                  disabled={pending || !result.truncated}
                  className={`${btnGhost} h-8 px-3 text-[12px] disabled:opacity-40`}
                  data-testid="je-next"
                >
                  {T("Next", "Suivantes")} →
                </button>
                <span className="text-[11.5px] text-muted" data-testid="je-page-note">
                  {result.truncated
                    ? T(
                        `${result.selectedLines - offset - result.lines.length} selected lines beyond this page.`,
                        `${result.selectedLines - offset - result.lines.length} lignes retenues au-delà de cette page.`,
                      )
                    : T("End of the selection.", "Fin de la sélection.")}
                </span>
              </div>
            </Sheet>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
