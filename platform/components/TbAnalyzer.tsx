"use client";

// Trial Balance Analyzer: pick a file → the server detects the columns and the
// account classes → confirm (or fix) both → ingest as the next TB version.
// The file never leaves the browser between the two calls — preview and ingest
// each receive it directly.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Messages } from "@/lib/i18n";

type TbColumn =
  | "account" | "label" | "openingDebit" | "openingCredit"
  | "debit" | "credit" | "closingDebit" | "closingCredit" | "closing";

interface Preview {
  headers: string[];
  headerSamples: Record<string, string[]>;
  mapping: Partial<Record<TbColumn, string>>;
  mappingError: string | null;
  rowCount: number;
  sample: { account: string; label: string | null; opening: number; closing: number }[];
  classes: { prefix: string; accountCount: number; closingTotal: number; section: string | null }[];
}

const COLUMN_LABELS: Record<TbColumn, { en: string; fr: string; required?: boolean }> = {
  account: { en: "Account number", fr: "Numéro de compte", required: true },
  label: { en: "Account name", fr: "Intitulé du compte", required: true },
  openingDebit: { en: "Opening balance — debit", fr: "Solde d'ouverture — débit" },
  openingCredit: { en: "Opening balance — credit", fr: "Solde d'ouverture — crédit" },
  debit: { en: "Movements — debit", fr: "Mouvements — débit" },
  credit: { en: "Movements — credit", fr: "Mouvements — crédit" },
  closingDebit: { en: "Closing balance — debit", fr: "Solde de clôture — débit" },
  closingCredit: { en: "Closing balance — credit", fr: "Solde de clôture — crédit" },
  closing: { en: "Closing balance (net)", fr: "Solde de clôture (net)" },
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export function TbAnalyzer({
  engagementId,
  sectionOptions,
  locale,
  messages,
}: {
  engagementId: string;
  /** lead-schedule section codes the classes can map to, e.g. E100 */
  sectionOptions: { code: string; title: string }[];
  locale: "en" | "fr";
  messages: Messages["planning"];
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<TbColumn, string>>>({});
  const [classMap, setClassMap] = useState<Record<string, string>>({});
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
    const cm: Record<string, string> = {};
    for (const c of p.classes) if (c.section) cm[c.prefix] = c.section;
    setClassMap(cm);
  }

  async function ingest() {
    const file = fileRef.current?.files?.[0];
    if (!file || !preview) return;
    setError(null);
    setPending("ingest");
    const form = new FormData();
    form.set("file", file);
    form.set("mapping", JSON.stringify(mapping));
    const overrides = preview.classes
      .filter((c) => classMap[c.prefix] && classMap[c.prefix] !== c.section)
      .map((c) => ({ prefix: c.prefix, sectionCode: classMap[c.prefix] }));
    form.set("overrides", JSON.stringify(overrides));
    const response = await fetch(`/api/engagements/${engagementId}/tb`, { method: "POST", body: form });
    setPending(null);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = (body.error ?? "file-required") as keyof typeof messages.errors;
      setError(messages.errors[code] ?? String(body.error));
      return;
    }
    setStatus(`v${body.versionNo}: ${body.status}`);
    setPreview(null);
    router.refresh();
  }

  const select =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600";
  const unmappedCount = preview ? preview.classes.filter((c) => !classMap[c.prefix]).length : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
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
              <table className="w-full text-[12px]" data-testid="tb-columns">
                <thead>
                  <tr className="bg-surface-2 text-left text-muted">
                    <th className="px-3 py-1.5">{fr ? "Colonne requise" : "Required column"}</th>
                    <th className="px-3 py-1.5">{fr ? "Colonne du fichier" : "Your file's column"}</th>
                    <th className="px-3 py-1.5">{fr ? "Exemple de données" : "Example data"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(COLUMN_LABELS) as TbColumn[]).map((col) => (
                    <tr key={col} className={`border-t border-line ${COLUMN_LABELS[col].required && !mapping[col] ? "bg-[var(--color-warn-soft)]" : ""}`}>
                      <td className="px-3 py-1.5 font-medium text-ink">
                        {fr ? COLUMN_LABELS[col].fr : COLUMN_LABELS[col].en}
                        {COLUMN_LABELS[col].required ? <b className="text-rose"> *</b> : null}
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          className={select}
                          value={mapping[col] ?? ""}
                          data-testid={`tb-col-${col}`}
                          onChange={(e) => {
                            const next = { ...mapping };
                            if (e.target.value) next[col] = e.target.value; else delete next[col];
                            setMapping(next);
                            analyze(next);
                          }}
                        >
                          <option value="">—</option>
                          {preview.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-muted" data-testid={`tb-sample-${col}`}>
                        {mapping[col] ? (preview.headerSamples?.[mapping[col]!] ?? []).join(" · ") || "—" : "—"}
                      </td>
                    </tr>
                  ))}
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

          {/* step 3 — account classes → lead schedules */}
          {preview.classes.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                {fr
                  ? "3 · Classes de comptes → feuilles maîtresses"
                  : "3 · Account classes → lead schedules"}
              </h3>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {fr
                  ? "Chaque classe alimente la feuille maîtresse indiquée ; corriger ici crée une règle client."
                  : "Each class feeds the lead schedule shown; changing one records a client rule."}
              </p>
              <div className="mt-1 overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
                <table className="w-full text-[12px]" data-testid="tb-classes">
                  <thead>
                    <tr className="bg-surface-2 text-left text-muted">
                      <th className="px-3 py-1.5">{fr ? "Préfixe" : "Prefix"}</th>
                      <th className="px-3 py-1.5 text-right">{fr ? "Comptes" : "Accounts"}</th>
                      <th className="px-3 py-1.5 text-right">{fr ? "Solde de clôture" : "Closing total"}</th>
                      <th className="px-3 py-1.5">{fr ? "Feuille maîtresse" : "Lead schedule"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.classes.map((c) => (
                      <tr key={c.prefix} className={`border-t border-line ${classMap[c.prefix] ? "" : "bg-[var(--color-warn-soft)]"}`} data-testid={`tb-class-${c.prefix}`}>
                        <td className="px-3 py-1 font-mono font-semibold">{c.prefix}</td>
                        <td className="px-3 py-1 text-right tnum">{c.accountCount}</td>
                        <td className="px-3 py-1 text-right tnum">{fmt(c.closingTotal)}</td>
                        <td className="px-3 py-1">
                          <select
                            className={select}
                            value={classMap[c.prefix] ?? ""}
                            data-testid={`tb-class-map-${c.prefix}`}
                            onChange={(e) =>
                              setClassMap((m) => {
                                const next = { ...m };
                                if (e.target.value) next[c.prefix] = e.target.value; else delete next[c.prefix];
                                return next;
                              })
                            }
                          >
                            <option value="">{fr ? "— non mappé —" : "— unmapped —"}</option>
                            {sectionOptions.map((o) => (
                              <option key={o.code} value={o.code}>{o.code} — {o.title}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
