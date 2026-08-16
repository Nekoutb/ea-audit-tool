"use client";

// Trial Balance Analyzer: pick a file → the server detects the columns and the
// account classes → confirm (or fix) both → ingest as the next TB version.
// The file never leaves the browser between the two calls — preview and ingest
// each receive it directly.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Messages } from "@/lib/i18n";
import { ACCOUNT_CLASSES, INDEX_SECTION, LEAD_INDEXES, LEAD_INDEX_BY_CODE, defaultIndexForClass } from "@/lib/lead-classes";

type TbColumn =
  | "account" | "label" | "openingDebit" | "openingCredit"
  | "debit" | "credit" | "closingDebit" | "closingCredit" | "closing" | "opening";

interface Preview {
  headers: string[];
  headerSamples: Record<string, string[]>;
  mapping: Partial<Record<TbColumn, string>>;
  mappingError: string | null;
  rowCount: number;
  sample: { account: string; label: string | null; opening: number; closing: number }[];
  classes: { prefix: string; accountCount: number; closingTotal: number; section: string | null; leadIndex: string | null }[];
}

// The four columns the user confirms. Debit/credit-style files are still
// detected server-side: when a concept is covered by variant columns the row
// shows one editable select per variant, so a wrong detection is a two-click
// fix — never a locked label.
const CONCEPTS: {
  key: TbColumn;
  en: string;
  fr: string;
  variants: TbColumn[];
}[] = [
  { key: "account", en: "Account number", fr: "Numéro de compte", variants: [] },
  { key: "label", en: "Account name", fr: "Intitulé du compte", variants: [] },
  { key: "opening", en: "Opening balance", fr: "Solde d'ouverture", variants: ["openingDebit", "openingCredit"] },
  { key: "closing", en: "Closing balance", fr: "Solde de clôture", variants: ["closingDebit", "closingCredit", "debit", "credit"] },
];

const VARIANT_LABELS: Partial<Record<TbColumn, { en: string; fr: string }>> = {
  openingDebit: { en: "Opening debit", fr: "Débit d'ouverture" },
  openingCredit: { en: "Opening credit", fr: "Crédit d'ouverture" },
  closingDebit: { en: "Closing debit", fr: "Débit de clôture" },
  closingCredit: { en: "Closing credit", fr: "Crédit de clôture" },
  debit: { en: "Movement debit", fr: "Mouvement débit" },
  credit: { en: "Movement credit", fr: "Mouvement crédit" },
};

// debit ↔ credit partners: a lone detected side always offers the other
const VARIANT_PAIR: Partial<Record<TbColumn, TbColumn>> = {
  openingDebit: "openingCredit", openingCredit: "openingDebit",
  closingDebit: "closingCredit", closingCredit: "closingDebit",
  debit: "credit", credit: "debit",
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export function TbAnalyzer({
  engagementId,
  locale,
  messages,
}: {
  engagementId: string;
  locale: "en" | "fr";
  messages: Messages["planning"];
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [timing, setTiming] = useState<"pre_audit" | "post_audit">("pre_audit");
  const [mapping, setMapping] = useState<Partial<Record<TbColumn, string>>>({});
  const [indexMap, setIndexMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<"analyze" | "ingest" | null>(null);

  async function analyze(withMapping?: Partial<Record<TbColumn, string>>) {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    setStatus(null);
    setPending("analyze");
    const form = new FormData();
    form.set("file", file);
    if (withMapping) form.set("mapping", JSON.stringify(withMapping));
    const response = await fetch(`/api/engagements/${engagementId}/tb/preview`, { method: "POST", body: form });
    setPending(null);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = (body.error ?? "file-required") as keyof typeof messages.errors;
      setError(messages.errors[code] ?? String(body.error));
      return;
    }
    const p = body as Preview;
    setPreview(p);
    setMapping(p.mapping);
    const im: Record<string, string> = {};
    for (const c of p.classes) if (c.leadIndex) im[c.prefix] = c.leadIndex;
    setIndexMap(im);
  }

  async function ingest() {
    const file = fileRef.current?.files?.[0];
    if (!file || !preview) return;
    setError(null);
    setPending("ingest");
    const form = new FormData();
    form.set("file", file);
    form.set("mapping", JSON.stringify(mapping));
    form.set("timing", timing);
    // the internal working-paper section follows the chosen index
    const overrides = preview.classes
      .filter((c) => indexMap[c.prefix] && INDEX_SECTION[indexMap[c.prefix]] && INDEX_SECTION[indexMap[c.prefix]] !== c.section)
      .map((c) => ({ prefix: c.prefix, sectionCode: INDEX_SECTION[indexMap[c.prefix]] }));
    form.set("overrides", JSON.stringify(overrides));
    const indexOverrides = preview.classes
      .filter((c) => indexMap[c.prefix] && indexMap[c.prefix] !== c.leadIndex)
      .map((c) => ({ prefix: c.prefix, indexCode: indexMap[c.prefix] }));
    form.set("indexOverrides", JSON.stringify(indexOverrides));
    const response = await fetch(`/api/engagements/${engagementId}/tb`, { method: "POST", body: form });
    setPending(null);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = (body.error ?? "file-required") as keyof typeof messages.errors;
      setError(messages.errors[code] ?? String(body.error));
      return;
    }
    setStatus(`${timing === "pre_audit" ? (fr ? "TB pré-audit" : "Pre-audit TB") : (fr ? "TB post-audit" : "Post-audit TB")}: ${body.status}`);
    setPreview(null);
    router.refresh();
  }

  const select =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600";
  const unmappedCount = preview ? preview.classes.filter((c) => !indexMap[c.prefix]).length : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={timing}
          onChange={(e) => setTiming(e.target.value as "pre_audit" | "post_audit")}
          data-testid="tb-timing"
          className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-emerald-600"
        >
          <option value="pre_audit">{fr ? "TB pré-audit" : "Pre-audit TB"}</option>
          <option value="post_audit">{fr ? "TB post-audit" : "Post-audit TB"}</option>
        </select>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.txt"
          data-testid="tb-file"
          onChange={() => { setPreview(null); setStatus(null); setError(null); }}
          className="text-sm text-ink-soft file:mr-3 file:rounded-[var(--radius-atlas-sm)] file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-soft"
        />
        <button
          type="button"
          onClick={() => analyze()}
          disabled={pending !== null}
          data-testid="tb-analyze"
          className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending === "analyze" ? "…" : fr ? "Analyser" : "Analyze"}
        </button>
        {status ? (
          <span className="text-sm text-emerald-700 tnum" data-testid="tb-import-status">{status}</span>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-rose">{error}</p>
        ) : null}
      </div>

      {preview ? (
        <div className="flex flex-col gap-4 rounded-[var(--radius-atlas)] border border-line bg-surface-2/50 p-4" data-testid="tb-confirm">
          {/* step 1 — the detected columns, editable */}
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
              {fr ? "1 · Colonnes obligatoires — confirmer" : "1 · Mandatory columns — confirm"}
            </h3>
            <div className="mt-2 overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
              {/* fixed column widths: choosing a file column never shifts the table */}
              <table className="w-auto table-fixed text-[12px]" data-testid="tb-columns">
                <thead>
                  <tr className="bg-surface-2 text-left text-muted">
                    <th className="w-[150px] px-2 py-1">{fr ? "Colonne requise" : "Required column"}</th>
                    <th className="w-[200px] px-2 py-1">{fr ? "Colonne du fichier" : "Your file's column"}</th>
                    <th className="w-[280px] px-2 py-1">{fr ? "Exemple de données" : "Example data"}</th>
                  </tr>
                </thead>
                <tbody>
                  {CONCEPTS.map((concept) => {
                    const coveredBy = concept.variants.filter((v) => mapping[v]);
                    const covered = Boolean(mapping[concept.key]) || coveredBy.length > 0;
                    const sampleHeader = mapping[concept.key] ?? (coveredBy[0] ? mapping[coveredBy[0]] : undefined);
                    return (
                      <tr key={concept.key} className={`border-t border-line ${covered ? "" : "bg-[var(--color-warn-soft)]"}`}>
                        <td className="truncate px-2 py-1 font-medium text-ink">
                          {fr ? concept.fr : concept.en}
                          <b className="text-rose"> *</b>
                        </td>
                        <td className="px-3 py-1.5">
                          {!mapping[concept.key] && coveredBy.length > 0 ? (
                            <span className="flex flex-col gap-1" data-testid={`tb-col-${concept.key}`}>
                              {concept.variants
                                .filter((v) => mapping[v] || (VARIANT_PAIR[v] && mapping[VARIANT_PAIR[v]!]))
                                .map((v) => (
                                  <label key={v} className="flex items-center gap-1.5">
                                    <span className="w-[96px] flex-shrink-0 text-[10.5px] text-emerald-700 dark:text-emerald-400">
                                      {fr ? VARIANT_LABELS[v]?.fr : VARIANT_LABELS[v]?.en}
                                    </span>
                                    <select
                                      className={select}
                                      value={mapping[v] ?? ""}
                                      data-testid={`tb-col-${v}`}
                                      onChange={(e) => {
                                        const next = { ...mapping };
                                        if (e.target.value) next[v] = e.target.value; else delete next[v];
                                        setMapping(next);
                                        analyze(next);
                                      }}
                                    >
                                      <option value="">—</option>
                                      {preview.headers.map((h) => (
                                        <option key={h} value={h}>{h}</option>
                                      ))}
                                    </select>
                                  </label>
                                ))}
                              <select
                                className={`${select} text-muted`}
                                value=""
                                data-testid={`tb-single-${concept.key}`}
                                title={fr ? "Remplacer la paire débit/crédit par une seule colonne de solde" : "Replace the debit/credit pair with a single balance column"}
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const next = { ...mapping };
                                  next[concept.key] = e.target.value;
                                  for (const v of concept.variants) delete next[v];
                                  setMapping(next);
                                  analyze(next);
                                }}
                              >
                                <option value="">{fr ? "… ou une seule colonne" : "… or use a single column"}</option>
                                {preview.headers.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </span>
                          ) : (
                            <select
                              className={select}
                              value={mapping[concept.key] ?? ""}
                              data-testid={`tb-col-${concept.key}`}
                              onChange={(e) => {
                                const next = { ...mapping };
                                if (e.target.value) next[concept.key] = e.target.value; else delete next[concept.key];
                                setMapping(next);
                                analyze(next);
                              }}
                            >
                              <option value="">—</option>
                              {preview.headers.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="truncate px-2 py-1 font-mono text-[11px] text-muted" data-testid={`tb-sample-${concept.key}`}>
                          {sampleHeader ? (preview.headerSamples?.[sampleHeader] ?? []).join(" · ") || "—" : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {preview.mappingError ? (
              <p className="mt-2 text-[12px] text-rose">
                {messages.errors[preview.mappingError as keyof typeof messages.errors] ?? preview.mappingError}
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-muted tnum">
                {preview.rowCount} {fr ? "lignes reconnues" : "rows recognized"}
              </p>
            )}
          </div>

          {/* step 2 — sample rows */}
          {preview.sample.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                {fr ? "2 · Aperçu" : "2 · Preview"}
              </h3>
              <div className="mt-1 overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
                <table className="w-full text-[12px]" data-testid="tb-sample">
                  <thead>
                    <tr className="bg-surface-2 text-left text-muted">
                      <th className="px-3 py-1.5">{fr ? "Compte" : "Account"}</th>
                      <th className="px-3 py-1.5">{fr ? "Intitulé" : "Name"}</th>
                      <th className="px-3 py-1.5 text-right">{fr ? "Ouverture" : "Opening"}</th>
                      <th className="px-3 py-1.5 text-right">{fr ? "Clôture" : "Closing"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row) => (
                      <tr key={row.account} className="border-t border-line">
                        <td className="px-3 py-1 font-mono">{row.account}</td>
                        <td className="px-3 py-1">{row.label ?? "—"}</td>
                        <td className="px-3 py-1 text-right tnum">{fmt(row.opening)}</td>
                        <td className="px-3 py-1 text-right tnum">{fmt(row.closing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* step 3 — account classes & lead schedules, behind a reveal */}
          {preview.classes.length > 0 ? (
            <details data-testid="tb-classes-details">
              <summary className="cursor-pointer select-none text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted hover:text-ink" data-testid="tb-classes-toggle">
                {fr
                  ? `3 · Classes de comptes & feuilles maîtresses (${preview.classes.length}) — cliquer pour afficher`
                  : `3 · Account classes & lead schedules (${preview.classes.length}) — click to reveal`}
              </summary>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {fr
                  ? "Type, classe et indice sont attribués automatiquement ; toute correction est mémorisée pour ce client."
                  : "Type, class and index are auto-assigned; any correction is remembered for this client."}
              </p>
              <div className="mt-1 overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
                <table className="w-full text-[12px]" data-testid="tb-classes">
                  <thead>
                    <tr className="bg-surface-2 text-left text-muted">
                      <th className="px-3 py-1.5">{fr ? "Préfixe" : "Prefix"}</th>
                      <th className="px-3 py-1.5 text-right">{fr ? "Comptes" : "Accounts"}</th>
                      <th className="px-3 py-1.5 text-right">{fr ? "Solde de clôture" : "Closing total"}</th>
                      <th className="px-3 py-1.5">{fr ? "Type de compte" : "Account type"}</th>
                      <th className="px-3 py-1.5">{fr ? "Classe de compte" : "Account class"}</th>
                      <th className="px-3 py-1.5">{fr ? "Feuille maîtresse (indice)" : "Lead schedule (index)"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.classes.map((c) => {
                      const idxDef = indexMap[c.prefix] ? LEAD_INDEX_BY_CODE[indexMap[c.prefix]] : undefined;
                      return (
                      <tr key={c.prefix} className={`border-t border-line ${indexMap[c.prefix] ? "" : "bg-[var(--color-warn-soft)]"}`} data-testid={`tb-class-${c.prefix}`}>
                        <td className="px-3 py-1 font-mono font-semibold">{c.prefix}</td>
                        <td className="px-3 py-1 text-right tnum">{c.accountCount}</td>
                        <td className="px-3 py-1 text-right tnum">{fmt(c.closingTotal)}</td>
                        <td className="px-3 py-1 text-ink-soft" data-testid={`tb-type-${c.prefix}`}>{idxDef?.accountType ?? "—"}</td>
                        <td className="px-3 py-1">
                          {/* picking a class re-homes the prefix to that class's first index */}
                          <select
                            className={select}
                            value={idxDef?.accountClass ?? ""}
                            data-testid={`tb-acclass-${c.prefix}`}
                            onChange={(e) =>
                              setIndexMap((m) => {
                                const next = { ...m };
                                const code = e.target.value ? defaultIndexForClass(e.target.value) : null;
                                if (code) next[c.prefix] = code; else delete next[c.prefix];
                                return next;
                              })
                            }
                          >
                            <option value="">—</option>
                            {ACCOUNT_CLASSES.map((cls) => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1">
                          <select
                            className={select}
                            value={indexMap[c.prefix] ?? ""}
                            data-testid={`tb-index-${c.prefix}`}
                            onChange={(e) =>
                              setIndexMap((m) => {
                                const next = { ...m };
                                if (e.target.value) next[c.prefix] = e.target.value; else delete next[c.prefix];
                                return next;
                              })
                            }
                          >
                            <option value="">—</option>
                            {LEAD_INDEXES.map((d) => (
                              <option key={d.code} value={d.code}>{d.code} — {d.labelEn}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={ingest}
              disabled={pending !== null || Boolean(preview.mappingError)}
              data-testid="tb-upload"
              className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {pending === "ingest" ? "…" : fr ? "Confirmer et ingérer" : "Confirm & ingest"}
            </button>
            {unmappedCount > 0 ? (
              <span className="text-[12px] text-warn">
                {fr
                  ? `${unmappedCount} classe(s) non mappée(s) — leurs comptes resteront hors feuilles maîtresses`
                  : `${unmappedCount} unmapped class(es) — their accounts will stay outside the lead schedules`}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
