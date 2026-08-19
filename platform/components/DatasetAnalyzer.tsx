"use client";

// Sub-ledger analyzer: pick the dataset kind and file → the server returns the
// headers with example values → confirm the mandatory columns (each choice
// shows the data behind it) → ingest. The confirmed mapping is stored with the
// dataset and its amount column drives the total.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Messages } from "@/lib/i18n";
import { SUB_LEDGER_KINDS, type SubLedgerKind } from "@/lib/subledger-kinds";

interface FieldDef {
  key: string;
  en: string;
  fr: string;
  required?: boolean;
  /** normalized header fragments that auto-select this field */
  aliases: string[];
}

// Mandatory fields per dataset kind — the audit-relevant columns of each file.
const FIELDS: Record<SubLedgerKind, FieldDef[]> = {
  journal_entries: [
    { key: "account", en: "Account number", fr: "Numéro de compte", required: true, aliases: ["compte", "account", "code"] },
    { key: "accountName", en: "Account name", fr: "Intitulé du compte", aliases: ["intitule", "libellecompte", "accountname", "designation"] },
    { key: "jeNumber", en: "JE number", fr: "Numéro d'écriture", required: true, aliases: ["piece", "numeroecriture", "jenumber", "entry", "numero"] },
    { key: "jeDescription", en: "Transaction description", fr: "Libellé de l'écriture", required: true, aliases: ["libelleecriture", "description", "narration", "libelle"] },
    { key: "amount", en: "Amount", fr: "Montant", required: true, aliases: ["montant", "amount", "debit", "valeur"] },
    { key: "journalDate", en: "Journal date (period)", fr: "Date du journal (période)", required: true, aliases: ["datejournal", "journaldate", "dateoperation", "date"] },
    { key: "jeDate", en: "JE date (entered)", fr: "Date de saisie", aliases: ["datesaisie", "dateecriture", "jedate", "entrydate"] },
    { key: "costCenter", en: "Cost centre", fr: "Centre de coût", aliases: ["centredecout", "centrecout", "costcenter", "costcentre", "section", "analytique"] },
    { key: "recordedBy", en: "Recorded by", fr: "Saisi par", aliases: ["saisipar", "recordedby", "utilisateur", "user", "operateur"] },
    { key: "preparedBy", en: "Prepared by", fr: "Préparé par", aliases: ["preparepar", "preparedby", "auteur"] },
    { key: "approvedBy", en: "Approved by", fr: "Approuvé par", aliases: ["approuvepar", "approvedby", "validepar", "validation"] },
  ],
  ap_open_items: [
    { key: "party", en: "Supplier number", fr: "Numéro fournisseur", required: true, aliases: ["code", "numero", "compte", "fournisseur", "supplier", "vendor"] },
    { key: "partyName", en: "Supplier name", fr: "Nom du fournisseur", required: true, aliases: ["nomfournisseur", "suppliername", "vendorname", "supplier", "fournisseur", "nom", "name", "intitule"] },
    { key: "reference", en: "Transaction reference", fr: "Référence de la transaction", required: true, aliases: ["reference", "piece", "facture", "invoice", "numerofacture", "document"] },
    { key: "date", en: "Transaction date", fr: "Date de la transaction", required: true, aliases: ["datefacture", "invoicedate", "datepiece", "date"] },
    { key: "amount", en: "Transaction amount", fr: "Montant de la transaction", required: true, aliases: ["montant", "amount", "solde", "balance", "valeur"] },
    { key: "transactionType", en: "Transaction type", fr: "Type de transaction", aliases: ["type", "typepiece", "nature", "sens"] },
    { key: "location", en: "Supplier location", fr: "Localisation du fournisseur", aliases: ["ville", "pays", "location", "region", "adresse"] },
    { key: "paymentTerms", en: "Payment terms (optional)", fr: "Conditions de paiement (optionnel)", aliases: ["terms", "term", "delai", "echeance", "paiement", "payment"] },
  ],
  ar_open_items: [
    { key: "party", en: "Customer number", fr: "Numéro client", required: true, aliases: ["code", "numero", "compte", "client", "customer"] },
    { key: "partyName", en: "Customer name", fr: "Nom du client", required: true, aliases: ["nomclient", "customername", "customer", "client", "nom", "name", "intitule"] },
    { key: "reference", en: "Invoice reference", fr: "Référence de la facture", required: true, aliases: ["reference", "facture", "invoice", "numerofacture", "piece", "document"] },
    { key: "date", en: "Invoice date", fr: "Date de la facture", required: true, aliases: ["datefacture", "invoicedate", "datepiece", "date"] },
    { key: "amount", en: "Transaction amount", fr: "Montant de la transaction", required: true, aliases: ["montant", "amount", "solde", "balance", "valeur"] },
    { key: "transactionType", en: "Transaction type", fr: "Type de transaction", aliases: ["type", "typepiece", "nature", "sens"] },
    { key: "location", en: "Customer location", fr: "Localisation du client", aliases: ["ville", "pays", "location", "region", "adresse"] },
    { key: "paymentTerms", en: "Payment terms (optional)", fr: "Conditions de paiement (optionnel)", aliases: ["terms", "term", "delai", "echeance", "paiement", "payment"] },
  ],
  inventory_listing: [
    { key: "item", en: "Item number", fr: "Numéro d'article", required: true, aliases: ["article", "item", "reference", "code", "sku"] },
    { key: "itemDescription", en: "Item description", fr: "Désignation de l'article", required: true, aliases: ["designation", "description", "libelle", "intitule"] },
    { key: "quantity", en: "Quantity", fr: "Quantité", required: true, aliases: ["quantite", "quantity", "qte", "qty"] },
    { key: "unitPrice", en: "Unit price", fr: "Prix unitaire", required: true, aliases: ["prixunitaire", "unitprice", "pu", "cout"] },
    { key: "amount", en: "Amount", fr: "Montant", required: true, aliases: ["montant", "amount", "valeur", "total"] },
  ],
  fixed_asset_register: [
    { key: "item", en: "Asset number", fr: "Numéro d'immobilisation", required: true, aliases: ["immobilisation", "asset", "reference", "code"] },
    { key: "itemDescription", en: "Description", fr: "Désignation", required: true, aliases: ["designation", "description", "libelle"] },
    { key: "amount", en: "Cost", fr: "Coût d'acquisition", required: true, aliases: ["cout", "cost", "valeurbrute", "montant"] },
    { key: "depreciation", en: "Accumulated depreciation", fr: "Amortissements cumulés", aliases: ["amortissement", "depreciation", "cumul"] },
    { key: "nbv", en: "Net book value", fr: "Valeur nette comptable", aliases: ["vnc", "netbookvalue", "valeurnette"] },
  ],
  payroll_register: [
    { key: "party", en: "Employee number", fr: "Matricule", required: true, aliases: ["matricule", "employee", "code"] },
    { key: "partyName", en: "Employee name", fr: "Nom du salarié", required: true, aliases: ["nom", "name", "salarie", "employeename"] },
    { key: "amount", en: "Gross pay", fr: "Salaire brut", required: true, aliases: ["brut", "gross", "salaire", "montant"] },
    { key: "net", en: "Net pay", fr: "Salaire net", aliases: ["net", "netapayer"] },
  ],
  bank_statement: [
    { key: "date", en: "Date", fr: "Date", required: true, aliases: ["date"] },
    { key: "description", en: "Description", fr: "Libellé", required: true, aliases: ["libelle", "description", "narration"] },
    { key: "amount", en: "Amount", fr: "Montant", required: true, aliases: ["montant", "amount", "valeur"] },
  ],
  supplier_statements: [
    { key: "party", en: "Supplier number", fr: "Numéro fournisseur", required: true, aliases: ["fournisseur", "supplier", "compte", "code"] },
    { key: "partyName", en: "Supplier name", fr: "Nom du fournisseur", aliases: ["nomfournisseur", "suppliername", "nom", "name"] },
    { key: "amount", en: "Amount", fr: "Montant", required: true, aliases: ["montant", "amount", "solde", "balance"] },
  ],
};

const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

function autoMap(kind: SubLedgerKind, headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalized = headers.map((h) => ({ h, n: norm(h) }));
  // exact alias matches claim their header first, then substring matches fill in
  for (const exact of [true, false]) {
    for (const field of FIELDS[kind]) {
      if (mapping[field.key]) continue;
      for (const alias of field.aliases) {
        const hit = normalized.find(
          (x) => (exact ? x.n === alias : x.n.includes(alias)) && !Object.values(mapping).includes(x.h),
        );
        if (hit) { mapping[field.key] = hit.h; break; }
      }
    }
  }
  return mapping;
}

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

  async function analyze() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    setPending("analyze");
    const form = new FormData();
    form.set("file", file);
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
    form.set("mapping", JSON.stringify(mapping));
    const response = await fetch(`/api/engagements/${engagementId}/subledgers`, { method: "POST", body: form });
    setPending(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const code = (body.error ?? "file-required") as keyof typeof messages.errors;
      setError(messages.errors[code] ?? String(body.error));
      return;
    }
    setPreview(null);
    router.refresh();
  }

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600";
  const missing = preview
    ? FIELDS[kind].filter((field) => field.required && !mapping[field.key]).length
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
                {FIELDS[kind].map((field) => (
                  <tr key={field.key} className={`border-t border-line ${field.required && !mapping[field.key] ? "bg-[var(--color-warn-soft)]" : ""}`}>
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
