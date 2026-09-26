// Why a trial-balance import is invalid — or what a valid one still carries —
// as lines a person can act on. Pure and client-safe: the analyzer renders it
// in the browser right after an upload, the data page on the server.
import type { TbColumn, TbValidationSummary } from "@/lib/tb";

export interface TbReason {
  /** the finding makes the import invalid; otherwise it is a warning the auditor should read */
  blocking: boolean;
  text: string;
}

const COLUMN_LABEL: Record<TbColumn, { en: string; fr: string }> = {
  account: { en: "Account", fr: "Compte" },
  label: { en: "Label", fr: "Libellé" },
  openingDebit: { en: "Opening debit", fr: "Débit d'ouverture" },
  openingCredit: { en: "Opening credit", fr: "Crédit d'ouverture" },
  opening: { en: "Opening balance", fr: "Solde d'ouverture" },
  debit: { en: "Debit movement", fr: "Mouvement débit" },
  credit: { en: "Credit movement", fr: "Mouvement crédit" },
  closingDebit: { en: "Closing debit", fr: "Débit de clôture" },
  closingCredit: { en: "Closing credit", fr: "Crédit de clôture" },
  closing: { en: "Closing balance", fr: "Solde de clôture" },
};

/**
 * Why an import is invalid — or what a valid one still carries — as lines
 * a person can act on: the column that could not be read and the values in
 * it, the totals that do not agree and by how much, the accounts concerned.
 */
/** A stored import status in the UI language (UAT run2-B106: the French UI showed 'valid'). */
export function tbStatusLabel(status: string | null | undefined, locale: "en" | "fr"): string {
  const fr = locale === "fr";
  if (status === "valid") return fr ? "valide" : "valid";
  if (status === "invalid") return fr ? "invalide" : "invalid";
  if (status === "pending") return fr ? "en attente" : "pending";
  if (!status) return "";
  return fr ? "avec avertissements" : "with warnings";
}

export function explainTbSummary(summary: TbValidationSummary, locale: "en" | "fr"): TbReason[] {
  const fr = locale === "fr";
  const nf = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v);
  const list = (items: string[], max = 8) => items.slice(0, max).join(", ") + (items.length > max ? ` … (+${items.length - max})` : "");
  const out: TbReason[] = [];
  const c = summary.checks;
  const r = summary.readability;

  if (r) {
    for (const u of r.unreadable) {
      const col = fr ? COLUMN_LABEL[u.column].fr : COLUMN_LABEL[u.column].en;
      const ex = u.examples.map((e) => `${fr ? "ligne du fichier" : "file row"} ${e.row} (${e.account}): "${e.value}"`).join("; ");
      out.push({
        blocking: true,
        text: fr
          ? `Colonne « ${u.header} » (${col}) : ${nf(u.count)} valeur(s) illisible(s) en montant, lues comme 0 — ${ex}. Mettre ces cellules au format nombre (ou 1 234,56 / 1 234.56 / (1 234)) puis réimporter.`
          : `Column "${u.header}" (${col}): ${nf(u.count)} value(s) not readable as an amount, read as 0 — ${ex}. Put those cells in number format (or 1 234,56 / 1,234.56 / (1,234)) and re-upload.`,
      });
    }
    if (r.rowsWithoutAccount > 0) {
      out.push({
        blocking: false,
        text: fr
          ? `${nf(r.rowsWithoutAccount)} ligne(s) sans numéro de compte (colonne « ${summary.mapping.account ?? "?"} ») ont été ignorées — totaux, sous-totaux ou lignes vides en général.`
          : `${nf(r.rowsWithoutAccount)} row(s) with no account number (column "${summary.mapping.account ?? "?"}") were skipped — usually totals, subtotals or blank lines.`,
      });
    }
  }
  if (!c.balanced.ok) {
    const d = c.balanced.totalDebit - c.balanced.totalCredit;
    out.push({
      blocking: true,
      text: fr
        ? `Les mouvements ne s'équilibrent pas : débit ${nf(c.balanced.totalDebit)} ≠ crédit ${nf(c.balanced.totalCredit)} — écart ${nf(d)}.`
        : `Movements do not balance: debit ${nf(c.balanced.totalDebit)} ≠ credit ${nf(c.balanced.totalCredit)} — difference ${nf(d)}.`,
    });
  }
  if (!c.openingBalanced.ok) {
    const d = c.openingBalanced.totalDebit - c.openingBalanced.totalCredit;
    out.push({
      blocking: true,
      text: fr
        ? `Les soldes d'ouverture ne s'équilibrent pas : débit ${nf(c.openingBalanced.totalDebit)} ≠ crédit ${nf(c.openingBalanced.totalCredit)} — écart ${nf(d)}.`
        : `Opening balances do not balance: debit ${nf(c.openingBalanced.totalDebit)} ≠ credit ${nf(c.openingBalanced.totalCredit)} — difference ${nf(d)}.`,
    });
  }
  if (!c.closingEquation.ok) {
    out.push({
      blocking: true,
      text: fr
        ? `Clôture ≠ ouverture + mouvements sur ${nf(c.closingEquation.failures.length)} compte(s) : ${list(c.closingEquation.failures)}.`
        : `Closing ≠ opening + movements on ${nf(c.closingEquation.failures.length)} account(s): ${list(c.closingEquation.failures)}.`,
    });
  }
  if (!c.codification.ok) {
    out.push({
      blocking: false,
      text: fr
        ? `${nf(c.codification.badAccounts.length)} numéro(s) de compte hors codification (1 à 8 chiffres, sans zéro initial) : ${list(c.codification.badAccounts)}.`
        : `${nf(c.codification.badAccounts.length)} account number(s) outside the codification (1–8 digits, no leading zero): ${list(c.codification.badAccounts)}.`,
    });
  }
  if (c.unknownAccounts.length > 0) {
    out.push({
      blocking: false,
      text: fr
        ? `${nf(c.unknownAccounts.length)} compte(s) sans règle de regroupement SYSCOHADA (à mapper dans l'analyseur) : ${list(c.unknownAccounts)}.`
        : `${nf(c.unknownAccounts.length)} account(s) with no SYSCOHADA grouping rule (map them in the analyzer): ${list(c.unknownAccounts)}.`,
    });
  }
  if (c.openingTiesToPrior.checked && c.openingTiesToPrior.exceptions.length > 0) {
    const ex = c.openingTiesToPrior.exceptions.slice(0, 5).map((e) => `${e.account === "12x/13x" ? (fr ? "résultat reporté 12x/13x (classes 6-8 et 12/13 N-1)" : "result carried forward 12x/13x (prior classes 6-8 and 12/13)") : e.account} (${nf(e.opening)} vs ${nf(e.priorClosing)})`).join(", ");
    out.push({
      blocking: false,
      text: fr
        ? `${nf(c.openingTiesToPrior.exceptions.length)} solde(s) d'ouverture différent(s) de la clôture N-1 : ${ex}${c.openingTiesToPrior.exceptions.length > 5 ? " …" : ""}.`
        : `${nf(c.openingTiesToPrior.exceptions.length)} opening balance(s) differ from the prior-year closing: ${ex}${c.openingTiesToPrior.exceptions.length > 5 ? " …" : ""}.`,
    });
  }
  return out;
}
