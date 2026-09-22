// The columns each sub-ledger kind needs, and the guess that maps a file's
// headers onto them. Pure: the analyzer screen renders it, the import stores
// the confirmed result, and a test can hold the guess to a real file's headers
// without a browser.
//
// The guess matters most for the general ledger's entry number: a ledger whose
// "JE number" is really its journal code turns every journal into one entry,
// and every entry-level analysis in the console silently becomes a study of
// the whole journal. So the entry-number aliases are the file vocabulary
// actually met (JE N°, N° écriture, N° pièce…) and the journal-code aliases
// include the abbreviations (C.j, Jrn) that used to be left unclaimed.
import type { SubLedgerKind } from "@/lib/subledger-kinds";

export interface FieldDef {
  key: string;
  en: string;
  fr: string;
  required?: boolean;
  /** normalized header fragments that auto-select this field */
  aliases: string[];
}

// Mandatory fields per dataset kind — the audit-relevant columns of each file.
export const FIELDS: Record<SubLedgerKind, FieldDef[]> = {
  journal_entries: [
    { key: "account", en: "Account number", fr: "Numéro de compte", required: true, aliases: ["compte", "account", "code"] },
    { key: "accountName", en: "Account name", fr: "Intitulé du compte", aliases: ["intitule", "libellecompte", "accountname", "designation"] },
    // The entry number claims its header before the journal code can: "jen"
    // is "JE N°" as the files write it, "npiece"/"nopiece" the voucher number.
    { key: "jeNumber", en: "JE number", fr: "Numéro d'écriture", required: true, aliases: ["jen", "jenumber", "jeno", "numeroecriture", "numecriture", "noecriture", "necriture", "npiece", "nopiece", "numeropiece", "piece", "entrynumber", "voucher", "entry", "numero"] },
    { key: "jeDescription", en: "Transaction description", fr: "Libellé de l'écriture", required: true, aliases: ["libelleecriture", "description", "narration", "libelle"] },
    // "debit" is deliberately NOT an alias here any more: the ledger now has a
    // dedicated Debit field below, and letting Amount claim a Debit column
    // first would leave the pair half-mapped (credit alone) and the signed
    // amount silently taken from the debit side only.
    { key: "amount", en: "Amount", fr: "Montant", required: true, aliases: ["montant", "amount", "valeur"] },
    { key: "journalDate", en: "Journal date (period)", fr: "Date du journal (période)", required: true, aliases: ["datejournal", "journaldate", "dateoperation", "date"] },
    { key: "jeDate", en: "JE date (entered)", fr: "Date de saisie", aliases: ["datesaisie", "dateecriture", "jedate", "entrydate"] },
    { key: "costCenter", en: "Cost centre", fr: "Centre de coût", aliases: ["centredecout", "centrecout", "costcenter", "costcentre", "section", "analytique"] },
    { key: "recordedBy", en: "Recorded by", fr: "Saisi par", aliases: ["saisipar", "recordedby", "utilisateur", "user", "operateur"] },
    { key: "preparedBy", en: "Prepared by", fr: "Préparé par", aliases: ["preparepar", "preparedby", "auteur"] },
    { key: "approvedBy", en: "Approved by", fr: "Approuvé par", aliases: ["approuvepar", "approvedby", "validepar", "validation"] },
    // Optional GL-analytics columns. Mapping them unlocks the analytics that
    // depend on them (lib/gl-analytics.ts); leaving them blank only makes those
    // analytics report themselves unavailable — never a misleading result.
    { key: "debit", en: "Debit", fr: "Débit", aliases: ["debit", "debitamount", "mouvementdebit"] },
    { key: "credit", en: "Credit", fr: "Crédit", aliases: ["credit", "creditamount", "mouvementcredit"] },
    { key: "journalCode", en: "Journal code", fr: "Code journal", aliases: ["cj", "codej", "jrn", "journal", "codejournal", "journalcode"] },
    { key: "reference", en: "Reference", fr: "Référence", aliases: ["reference", "piecejustificative", "piece", "ref", "docref"] },
    { key: "thirdPartyCode", en: "Third-party code", fr: "Code tiers", aliases: ["tiers", "codetiers", "thirdparty", "partner"] },
    { key: "thirdPartyName", en: "Third-party name", fr: "Nom du tiers", aliases: ["nomtiers", "thirdpartyname", "partnername"] },
    { key: "reviewer", en: "Reviewer", fr: "Réviseur", aliases: ["revisepar", "reviewer", "controlepar"] },
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

export const norm = (s: string): string =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/**
 * Map a file's headers onto the kind's fields. Exact alias matches claim their
 * header first, then substring matches fill in; a header is claimed once.
 * Every alias list is ordered from the most specific spelling to the vaguest,
 * so "N° de compte" is an account before "code" can make it one.
 */
export function autoMap(kind: SubLedgerKind, headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalized = headers.map((h) => ({ h, n: norm(h) }));
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

/**
 * Whether the column mapped as the entry number behaves like a journal code:
 * a handful of distinct values over a ledger of thousands of lines. Lines per
 * "entry" above 40, or fewer than 20 distinct values on more than 500 lines,
 * is not how entries are numbered anywhere.
 */
export function jeNumberLooksLikeJournalCode(lines: number, entries: number): boolean {
  if (lines < 100 || entries <= 0) return false;
  return lines / entries > 40 || (lines > 500 && entries < 20);
}
