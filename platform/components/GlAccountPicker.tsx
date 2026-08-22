"use client";

// The account picker shared by all three GL Correlation Console views.
//
// One selection, one relationship mode, three views reading them — an auditor
// picks the accounts once and then moves between entry analysis, two-account
// correlation and the analytics catalogue without re-picking. The picker never
// holds the ledger: it asks the engine for the account list (a SQL GROUP BY,
// capped) and keeps only what it has been shown.
//
// Amount convention, unchanged from the engine: signed = debit - credit, so
// debits are positive and credits negative, and negatives print in parentheses.

import { useEffect, useRef, useState } from "react";
import { SCell, SRow, Sheet, SheetNote, SheetTable, num, type SheetCol } from "@/components/ui/excel";
import type { AccountList, AccountSummary, EntryMode } from "@/lib/gl-correlation";

/** entryAnalysis caps the selection at 25 accounts; refuse past that, visibly. */
export const MAX_SELECTED = 25;

export function GlAccountPicker({
  engagementId,
  datasetId,
  locale,
  selected,
  onSelectedChange,
  mode,
  onModeChange,
}: {
  engagementId: string;
  datasetId: string;
  locale: "en" | "fr";
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  mode: EntryMode;
  onModeChange: (next: EntryMode) => void;
}) {
  const fr = locale === "fr";
  const [search, setSearch] = useState("");
  const [list, setList] = useState<AccountList | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // Everything the picker has ever been shown, so a selected account keeps its
  // figures after the search term that surfaced it is cleared.
  const known = useRef(new Map<string, AccountSummary>());

  useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      setPending(true);
      setError(null);
      try {
        const response = await fetch(`/api/engagements/${engagementId}/gl-analytics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "accounts", datasetId, search: search || undefined }),
        });
        const body = (await response.json().catch(() => ({}))) as { accounts?: AccountList; error?: string };
        if (!live) return;
        if (!response.ok || !body.accounts) {
          setError(fr ? "La liste des comptes n'a pas pu être chargée." : "The account list could not be loaded.");
          setList(null);
          return;
        }
        for (const account of body.accounts.accounts) known.current.set(account.account, account);
        setList(body.accounts);
      } catch {
        if (live) setError(fr ? "La liste des comptes n'a pas pu être chargée." : "The account list could not be loaded.");
      } finally {
        if (live) setPending(false);
      }
    }, search ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [engagementId, datasetId, search, fr]);

  const capped = (next: string[]): string[] => {
    if (next.length > MAX_SELECTED) {
      setNotice(
        fr
          ? `La sélection est limitée à ${MAX_SELECTED} comptes ; les comptes au-delà n'ont pas été ajoutés.`
          : `The selection is capped at ${MAX_SELECTED} accounts; accounts beyond that were not added.`,
      );
      return next.slice(0, MAX_SELECTED);
    }
    setNotice(null);
    return next;
  };

  const toggle = (account: string) => {
    onSelectedChange(
      selected.includes(account)
        ? selected.filter((a) => a !== account)
        : capped([...selected, account]),
    );
  };

  const addRange = () => {
    const from = rangeFrom.trim();
    const to = rangeTo.trim();
    if (!from && !to) {
      setNotice(fr ? "Indiquer au moins une borne de la plage." : "Give at least one end of the range.");
      return;
    }
    const inRange = (list?.accounts ?? [])
      .map((a) => a.account)
      .filter((code) => (from ? code >= from : true) && (to ? code <= to : true));
    if (inRange.length === 0) {
      setNotice(fr ? "Aucun compte listé dans cette plage." : "No listed account falls in that range.");
      return;
    }
    onSelectedChange(capped([...new Set([...selected, ...inRange])]));
  };

  const clear = () => {
    onSelectedChange([]);
    setNotice(null);
  };

  // eslint-disable-next-line react-hooks/refs -- `known` is a fetch-populated lookup cache; rendering the last known metadata for a code is the point
  const rows = selected.map((code) => known.current.get(code) ?? {
    account: code, name: null, lines: 0, entries: 0, debit: 0, credit: 0, signed: 0,
  });
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const totalSigned = rows.reduce((s, r) => s + r.signed, 0);
  const totalPostings = rows.reduce((s, r) => s + r.lines, 0);

  const selCols: SheetCol[] = [
    { label: fr ? "Compte" : "Account", width: 110 },
    { label: fr ? "Intitulé" : "Account name", width: 240 },
    { label: fr ? "Écritures" : "Postings", align: "right", width: 90 },
    { label: fr ? "Débit" : "Debit", align: "right", width: 120 },
    { label: fr ? "Crédit" : "Credit", align: "right", width: 120 },
    { label: fr ? "Net signé" : "Net signed", align: "right", width: 120 },
    { label: fr ? "Retirer" : "Remove", align: "center", width: 80 },
  ];

  const listCols: SheetCol[] = [
    { label: fr ? "Choisir" : "Select", align: "center", width: 64 },
    { label: fr ? "Compte" : "Account", width: 110 },
    { label: fr ? "Intitulé" : "Account name", width: 260 },
    { label: fr ? "Écritures" : "Postings", align: "right", width: 90 },
    { label: fr ? "Débit" : "Debit", align: "right", width: 120 },
    { label: fr ? "Crédit" : "Credit", align: "right", width: 120 },
    { label: fr ? "Net signé" : "Net signed", align: "right", width: 120 },
  ];

  const modeLabel = mode === "all"
    ? (fr ? "Tous les comptes sélectionnés" : "All selected accounts")
    : (fr ? "L'un des comptes sélectionnés" : "Any selected account");

  return (
    <Sheet
      title={fr ? "Sélection de comptes" : "Account selection"}
      subtitle={
        fr
          ? `${selected.length} sélectionné(s) · mode : ${modeLabel}`
          : `${selected.length} selected · mode: ${modeLabel}`
      }
      objective={
        fr
          ? "Rechercher par numéro ou intitulé, sélectionner un ou plusieurs comptes ou une plage, puis choisir le mode de relation. La sélection et le mode servent aux trois vues."
          : "Search by number or name, select one or many accounts or a range, then choose the relationship mode. The selection and the mode drive all three views."
      }
      testId="gl-account-picker"
    >
      {/* search + range + clear ------------------------------------------- */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="gl-account-search" className="text-[11px] font-semibold text-ink-soft">
            {fr ? "Rechercher un compte" : "Search accounts"}
          </label>
          <input
            id="gl-account-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={fr ? "numéro ou intitulé" : "number or name"}
            className="h-8 w-56 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 text-[12px] text-ink outline-none focus:border-emerald-600"
            data-testid="gl-account-search"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="gl-range-from" className="text-[11px] font-semibold text-ink-soft">
            {fr ? "Plage — de" : "Range — from"}
          </label>
          <input
            id="gl-range-from"
            type="text"
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="h-8 w-28 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 text-[12px] text-ink outline-none focus:border-emerald-600 tnum"
            data-testid="gl-range-from"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="gl-range-to" className="text-[11px] font-semibold text-ink-soft">
            {fr ? "Plage — à" : "Range — to"}
          </label>
          <input
            id="gl-range-to"
            type="text"
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            className="h-8 w-28 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 text-[12px] text-ink outline-none focus:border-emerald-600 tnum"
            data-testid="gl-range-to"
          />
        </div>
        <button
          type="button"
          onClick={addRange}
          className="h-8 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 text-[12px] font-semibold text-ink-soft transition hover:bg-surface-2"
          data-testid="gl-range-add"
        >
          {fr ? "Ajouter la plage" : "Select range"}
        </button>
        <button
          type="button"
          onClick={clear}
          className="h-8 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 text-[12px] font-semibold text-ink-soft transition hover:bg-surface-2"
          data-testid="gl-selection-clear"
        >
          {fr ? "Tout effacer" : "Clear all"}
        </button>
      </div>

      {/* relationship mode ------------------------------------------------- */}
      <fieldset className="flex flex-wrap items-center gap-3 rounded-[var(--radius-atlas-sm)] border border-line-strong px-3 py-2" data-testid="gl-mode">
        <legend className="px-1 text-[11px] font-semibold text-ink-soft">
          {fr ? "Mode de relation" : "Relationship mode"}
        </legend>
        <label className="flex items-center gap-1.5 text-[12px] text-ink" htmlFor="gl-mode-any">
          <input
            id="gl-mode-any"
            type="radio"
            name="gl-relationship-mode"
            value="any"
            checked={mode === "any"}
            onChange={() => onModeChange("any")}
            data-testid="gl-mode-any"
          />
          {fr ? "L'un des comptes sélectionnés" : "Any selected account"}
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-ink" htmlFor="gl-mode-all">
          <input
            id="gl-mode-all"
            type="radio"
            name="gl-relationship-mode"
            value="all"
            checked={mode === "all"}
            onChange={() => onModeChange("all")}
            data-testid="gl-mode-all"
          />
          {fr ? "Tous les comptes sélectionnés" : "All selected accounts"}
        </label>
        <span className="text-[11.5px] font-semibold text-ink" data-testid="gl-mode-active">
          {fr ? `Mode actif : ${modeLabel}` : `Active mode: ${modeLabel}`}
        </span>
      </fieldset>

      <SheetNote>
        {mode === "all"
          ? fr
            ? "Mode « tous » : seules les écritures touchant chacun des comptes sélectionnés sont retenues."
            : "\"All\" mode: only journal entries touching every selected account are kept."
          : fr
            ? "Mode « l'un » : toute écriture touchant au moins un des comptes sélectionnés est retenue."
            : "\"Any\" mode: every journal entry touching at least one selected account is kept."}
      </SheetNote>

      {notice ? (
        <SheetNote testId="gl-picker-notice">{notice}</SheetNote>
      ) : null}
      {error ? (
        <SheetNote testId="gl-picker-error">{error}</SheetNote>
      ) : null}

      {/* the selection ----------------------------------------------------- */}
      {selected.length > 0 ? (
        <SheetTable cols={selCols} testId="gl-selected-accounts">
          <tbody>
            {rows.map((row, i) => (
              <SRow key={row.account} n={i + 1} testId={`gl-selected-${row.account}`}>
                <SCell>{row.account}</SCell>
                <SCell wrap>{row.name ?? "—"}</SCell>
                <SCell align="right">{num(row.lines)}</SCell>
                <SCell align="right">{num(row.debit)}</SCell>
                <SCell align="right">{num(row.credit)}</SCell>
                <SCell align="right" kind="calc">{num(row.signed)}</SCell>
                <SCell align="center">
                  <button
                    type="button"
                    onClick={() => toggle(row.account)}
                    aria-label={fr ? `Retirer le compte ${row.account}` : `Remove account ${row.account}`}
                    className="rounded border border-line-strong px-1.5 text-[11px] font-bold text-ink-soft transition hover:bg-surface-2"
                    data-testid={`gl-remove-${row.account}`}
                  >
                    ×
                  </button>
                </SCell>
              </SRow>
            ))}
            <SRow n={rows.length + 1} total testId="gl-selected-total">
              <SCell kind="calc">{fr ? "Total" : "Total"}</SCell>
              <SCell kind="calc">{selected.length} {fr ? "comptes" : "accounts"}</SCell>
              <SCell align="right" kind="calc">{num(totalPostings)}</SCell>
              <SCell align="right" kind="calc">{num(totalDebit)}</SCell>
              <SCell align="right" kind="calc">{num(totalCredit)}</SCell>
              <SCell align="right" kind="calc">{num(totalSigned)}</SCell>
              <SCell kind="calc" />
            </SRow>
          </tbody>
        </SheetTable>
      ) : (
        <SheetNote testId="gl-selection-empty">
          {fr ? "Aucun compte sélectionné." : "No account selected."}
        </SheetNote>
      )}

      {/* the account list -------------------------------------------------- */}
      <SheetTable cols={listCols} testId="gl-account-list">
        <tbody>
          {(list?.accounts ?? []).map((account, i) => {
            const on = selected.includes(account.account);
            return (
              <SRow key={account.account} n={i + 1} testId={`gl-account-${account.account}`}>
                <SCell align="center">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(account.account)}
                    aria-label={
                      fr
                        ? `Sélectionner le compte ${account.account} ${account.name ?? ""}`.trim()
                        : `Select account ${account.account} ${account.name ?? ""}`.trim()
                    }
                    data-testid={`gl-account-check-${account.account}`}
                  />
                </SCell>
                <SCell>{account.account}</SCell>
                <SCell wrap>{account.name ?? "—"}</SCell>
                <SCell align="right">{num(account.lines)}</SCell>
                <SCell align="right">{num(account.debit)}</SCell>
                <SCell align="right">{num(account.credit)}</SCell>
                <SCell align="right" kind="calc">{num(account.signed)}</SCell>
              </SRow>
            );
          })}
          {(list?.accounts.length ?? 0) === 0 ? (
            <SRow n={1} testId="gl-account-list-empty">
              <SCell colSpan={7} wrap>
                {pending
                  ? fr ? "Chargement…" : "Loading…"
                  : fr ? "Aucun compte ne correspond." : "No account matches."}
              </SCell>
            </SRow>
          ) : null}
        </tbody>
      </SheetTable>

      <SheetNote testId="gl-account-list-note">
        {list
          ? fr
            ? `${list.accounts.length} compte(s) affiché(s) sur ${list.total} dans le grand livre${list.truncated ? " — liste tronquée : affiner la recherche" : ""}. La plage s'applique aux comptes affichés.`
            : `${list.accounts.length} of ${list.total} ledger accounts shown${list.truncated ? " — list truncated: narrow the search" : ""}. The range applies to the accounts shown.`
          : fr
            ? "Liste des comptes indisponible."
            : "Account list unavailable."}
      </SheetNote>
    </Sheet>
  );
}
