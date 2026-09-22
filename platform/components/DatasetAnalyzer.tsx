"use client";

// Sub-ledger analyzer: pick the dataset kind and file → the server returns the
// headers with example values → confirm the mandatory columns (each choice
// shows the data behind it) → ingest. The confirmed mapping is stored with the
// dataset and its amount column drives the total.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Messages } from "@/lib/i18n";
import { autoMap, encodeJeKey, FIELDS, JE_KEY, JE_KEY_JOIN, JE_KEY_MAX, jeKeyColumns } from "@/lib/dataset-mapping";
import { SUB_LEDGER_KINDS, type SubLedgerKind } from "@/lib/subledger-kinds";

export function DatasetAnalyzer({
  engagementId,
  locale,
  messages,
  fixedKind,
}: {
  engagementId: string;
  locale: "en" | "fr";
  messages: Messages["planning"];
  /** lock the analyzer to one dataset kind (the dedicated analyzer pages) */
  fixedKind?: SubLedgerKind;
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<SubLedgerKind>(fixedKind ?? "ar_open_items");
  // GL mirrors the trial balance: pre-audit, post-audit and prior-year ledgers,
  // and a new upload replaces the previous one of the chosen timing.
  const [timing, setTiming] = useState<"pre_audit" | "post_audit" | "prior_year">("pre_audit");
  const [preview, setPreview] = useState<{ headers: string[]; headerSamples: Record<string, string[]>; rowCount: number } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"analyze" | "ingest" | null>(null);
  const [headerRow, setHeaderRow] = useState(true);
  const [done, setDone] = useState<string | null>(null);

  async function analyze() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    setPending("analyze");
    const form = new FormData();
    form.set("file", file);
    form.set("headerRow", headerRow ? "1" : "0");
    const response = await fetch(`/api/engagements/${engagementId}/subledgers/preview`, { method: "POST", body: form });
    setPending(null);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = (body.error ?? "file-required") as keyof typeof messages.errors;
      setError(messages.errors[code] ?? String(body.error));
      return;
    }
    setPreview(body);
    setMapping(autoMap(kind, body.headers));
  }

  async function ingest() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    setPending("ingest");
    const form = new FormData();
    form.set("kind", kind);
    form.set("timing", timing);
    form.set("file", file);
    form.set("headerRow", headerRow ? "1" : "0");
    form.set("mapping", JSON.stringify(mapping));
    setDone(null);
    const response = await fetch(`/api/engagements/${engagementId}/subledgers`, { method: "POST", body: form });
    setPending(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const code = (body.error ?? "file-required") as keyof typeof messages.errors;
      setError(messages.errors[code] ?? String(body.error));
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { rowCount?: number };
    // The answer the user is owed: it worked, and this is how much arrived.
    setDone(
      fr
        ? `✓ Import réussi — ${body.rowCount ?? "?"} lignes ingérées (${file.name})`
        : `✓ Import successful — ${body.rowCount ?? "?"} rows ingested (${file.name})`,
    );
    setPreview(null);
    router.refresh();
  }

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600";
  // A general ledger states its value either as one signed amount column or as
  // a debit/credit pair — mapping the pair satisfies the amount requirement.
  const amountSatisfied =
    Boolean(mapping.amount) || (Boolean(mapping.debit) && Boolean(mapping.credit));
  const missing = preview
    ? FIELDS[kind].filter((field) => {
        if (!field.required) return false;
        if (field.key === "amount" && kind === "journal_entries") return !amountSatisfied;
        // the composite identifier stands in for the JE number
        if (field.key === "jeNumber" && kind === "journal_entries" && jeKeyColumns(mapping).length > 0) return false;
        return !mapping[field.key];
      }).length
    : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {fixedKind ? null : (
          <select
            value={kind}
            onChange={(e) => { setKind(e.target.value as SubLedgerKind); setPreview(null); }}
            className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600"
            data-testid="dataset-kind"
          >
            {SUB_LEDGER_KINDS.map((value) => (
              <option key={value} value={value}>{messages.dataPage.kinds[value]}</option>
            ))}
          </select>
        )}
        {kind === "journal_entries" ? (
          <select
            value={timing}
            onChange={(e) => setTiming(e.target.value as "pre_audit" | "post_audit" | "prior_year")}
            className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600"
            data-testid="dataset-timing"
          >
            <option value="pre_audit">{fr ? "Grand livre pré-audit" : "Pre-audit GL"}</option>
            <option value="post_audit">{fr ? "Grand livre post-audit" : "Post-audit GL"}</option>
            <option value="prior_year">{fr ? "Grand livre N-1" : "Prior-year GL"}</option>
          </select>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.txt"
          data-testid="dataset-file"
          onChange={() => setPreview(null)}
          className="text-sm text-ink-soft file:mr-3 file:rounded-[var(--radius-atlas-sm)] file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-soft"
        />
        <label className="flex items-center gap-1.5 text-[12px] text-ink-soft">
          <input
            type="checkbox"
            checked={headerRow}
            onChange={(e) => { setHeaderRow(e.target.checked); setPreview(null); }}
            data-testid="dataset-header-row"
          />
          {fr ? "La 1re ligne contient les en-têtes" : "First row contains headers"}
        </label>
        {pending === "ingest" ? (
          <span className="flex items-center gap-2 text-[12.5px] font-medium text-amber-700 dark:text-amber-400" data-testid="dataset-ingesting">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" aria-hidden />
            {fr ? "Ingestion en cours — un grand livre volumineux peut prendre une minute…" : "Ingesting — a large ledger can take a minute…"}
          </span>
        ) : null}
        {done ? (
          <span className="text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400" data-testid="dataset-done">{done}</span>
        ) : null}
        <button
          type="button"
          onClick={analyze}
          disabled={pending !== null}
          data-testid="dataset-analyze"
          className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending === "analyze" ? "…" : fr ? "Analyser" : "Analyze"}
        </button>
        {error ? <p role="alert" className="text-sm text-rose">{error}</p> : null}
      </div>

      {preview ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-atlas)] border border-line bg-surface-2/50 p-4" data-testid="dataset-confirm">
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
            {fr ? "Colonnes obligatoires — confirmer" : "Mandatory columns — confirm"}
          </h3>
          <div className="overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
            <table className="w-full text-[12px]" data-testid="dataset-fields">
              <thead>
                <tr className="bg-surface-2 text-left text-muted">
                  <th className="px-3 py-1.5">{fr ? "Colonne requise" : "Required column"}</th>
                  <th className="px-3 py-1.5">{fr ? "Colonne du fichier" : "Your file's column"}</th>
                  <th className="px-3 py-1.5">{fr ? "Exemple de données" : "Example data"}</th>
                </tr>
              </thead>
              <tbody>
                {kind === "journal_entries" ? (() => {
                  const keyCols = jeKeyColumns(mapping);
                  const toggle = (h: string) =>
                    setMapping((m) => {
                      const current = jeKeyColumns(m);
                      const next = current.includes(h) ? current.filter((x) => x !== h) : [...current, h].slice(0, JE_KEY_MAX);
                      const out = { ...m };
                      if (next.length > 0) out[JE_KEY] = encodeJeKey(next); else delete out[JE_KEY];
                      return out;
                    });
                  const sample = keyCols.length === 0
                    ? "—"
                    : [0, 1, 2].map((i) => keyCols.map((h) => (preview.headerSamples[h] ?? [])[i] ?? "").join(JE_KEY_JOIN)).filter((s) => s.replace(/[ ·]/g, "") !== "").join("   |   ") || "—";
                  return (
                    <tr className="border-t border-line bg-emerald-50/40 dark:bg-emerald-950/20" data-testid="ds-row-jeKey">
                      <td className="px-3 py-1.5 align-top font-medium text-ink">
                        {fr ? "Identifiant unique d'écriture" : "Unique JE identifier"}
                        <span className="mt-0.5 block text-[10.5px] font-normal leading-snug text-muted">
                          {fr
                            ? `Une colonne, ou plusieurs qui ensemble identifient une écriture (p. ex. journal + n° de pièce). Vide : le numéro d'écriture ci-dessous sert d'identifiant. ${JE_KEY_MAX} colonnes au plus.`
                            : `One column, or several that together identify one journal entry (e.g. journal + voucher number). Empty: the JE number below is the identifier. Up to ${JE_KEY_MAX} columns.`}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 align-top">
                        <div className="flex flex-wrap gap-x-3 gap-y-1" data-testid="ds-col-jeKey">
                          {preview.headers.map((h) => (
                            <label key={h} className="flex items-center gap-1 text-[11.5px] text-ink-soft">
                              <input type="checkbox" checked={keyCols.includes(h)} onChange={() => toggle(h)} data-testid={`ds-jekey-${h.replace(/[^A-Za-z0-9]/g, "_")}`} />
                              {h}
                            </label>
                          ))}
                        </div>
                        {keyCols.length > 0 ? (
                          <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300" data-testid="ds-jekey-order">
                            {fr ? "Ordre : " : "Order: "}{keyCols.join(JE_KEY_JOIN)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5 align-top font-mono text-[11px] text-muted" data-testid="ds-sample-jeKey">{sample}</td>
                    </tr>
                  );
                })() : null}
                {FIELDS[kind].map((field) => (
                  <tr key={field.key} className={`border-t border-line ${field.required && !mapping[field.key] && !(field.key === "jeNumber" && jeKeyColumns(mapping).length > 0) ? "bg-[var(--color-warn-soft)]" : ""}`}>
                    <td className="px-3 py-1.5 font-medium text-ink">
                      {fr ? field.fr : field.en}
                      {field.required ? <b className="text-rose"> *</b> : null}
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        className={input}
                        value={mapping[field.key] ?? ""}
                        data-testid={`ds-col-${field.key}`}
                        onChange={(e) =>
                          setMapping((m) => {
                            const next = { ...m };
                            if (e.target.value) next[field.key] = e.target.value; else delete next[field.key];
                            return next;
                          })
                        }
                      >
                        <option value="">—</option>
                        {preview.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-muted" data-testid={`ds-sample-${field.key}`}>
                      {mapping[field.key] ? (preview.headerSamples[mapping[field.key]] ?? []).join(" · ") || "—" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={ingest}
              disabled={pending !== null || missing > 0}
              data-testid="dataset-upload"
              className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {pending === "ingest" ? "…" : fr ? "Confirmer et ingérer" : "Confirm & ingest"}
            </button>
            <span className="text-[12px] text-muted tnum">
              {preview.rowCount} {fr ? "lignes" : "rows"}
            </span>
            {missing > 0 ? (
              <span className="text-[12px] text-warn">
                {fr ? `${missing} colonne(s) obligatoire(s) non mappée(s)` : `${missing} mandatory column(s) unmapped`}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
