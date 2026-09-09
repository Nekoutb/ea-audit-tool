// E3.1 Journal entries and other adjustments — the working paper as the firm's
// own workbook.
//
// Five tabs:
//   1 Cover      the Readme inputs, the fraud-risk context, the four
//                unpredictability levers, the four controls, the conclusion
//   2 Population the ledger relied on and the completeness and accuracy work
//                done on it, because the entry population is itself IPE
//   3 Criteria   every criterion applied, its parameters, why it was applied
//                and how many entries and lines it matched
//   4 Selection  the items selected, the reason each was picked, and the four
//                tests applied to each one
//   5 Exceptions one row per item that failed a test, carrying the analysis
//
// Engagement identity is typed ONCE, in the Readme block on the Cover. Every
// other tab reads those cells by formula, so a corrected client name or a
// changed reviewer propagates through the file instead of being retyped.
//
// The order of the tabs is the order of the argument the paper has to make: this
// is the population, this is how we know it is complete, these are the criteria
// we directed the selection with, these are the items they returned, and this is
// what we found. A selection tab without a population tab in front of it asserts
// coverage of a population nobody established.
//
// Nothing here selects anything. lib/je-selection.ts holds the single definition
// of what each criterion means and returns the lines with their reasons already
// attached; this module lays that out. The view's field names are the engine's
// field names for that reason — a workbook column called something else is a
// column somebody has to translate back before they can check it.
//
// One thing the workbook never says, on any tab: that a number of entries was
// sampled at random. International Audit Methodology 321.03 rules that out for
// journal entry testing, and a paper whose method line reads "25 entries
// selected" documents the wrong audit however well the items were tested.
//
// The builder is a pure function over JeView so it can be tested without a
// database; lib/je-export.ts supplies the view.

import ExcelJS from "exceljs";

/* ============================== the view ============================== */

/** The ledger extract the selection ran over, and what the projection made of it. */
export interface JeLedger {
  /** the file the client provided, as the import recorded it */
  sourceFilename: string;
  /** pre_audit · post_audit · prior_year, as the dataset was registered */
  timing: string;
  /** rows in the imported dataset, before projection */
  datasetRows: number;
  /** lines projected into the tested population */
  lines: number;
  entries: number;
  /** lines carrying the date the timing criteria read; the rest are invisible to them */
  datedLines: number;
}

/** One population check, in the shape lib/gl-line.ts states them. */
export interface JePopulationCheck {
  key: string;
  label: string;
  status: "passed" | "warning" | "failed";
  detail: string;
}

/** One criterion as it was actually run, with the coverage it produced. */
export interface JeCriterion {
  /** the engine's criterion key, or `user:<id>` for a rule the auditor wrote */
  key: string;
  name: string;
  description: string;
  /** the methodology hook the paper cites for choosing it */
  rationale: string;
  /** the thresholds this run used — the engine's own parameter names */
  settings: Record<string, string | number | readonly string[]>;
  matchedEntries: number;
  matchedLines: number;
}

/** One reason a line was selected: the criterion, and what on this line satisfied it. */
export interface JeReason {
  label: string;
  detail: string;
}

/** One selected line item, carrying the entry it belongs to. */
export interface JeSelectedLine {
  jeNumber: string;
  lineNo: number;
  journalCode: string | null;
  journalDate: string | null;
  entryDate: string | null;
  account: string;
  accountName: string | null;
  description: string | null;
  debit: number;
  credit: number;
  signed: number;
  preparer: string | null;
  reviewer: string | null;
  approver: string | null;
  reference: string | null;
  thirdPartyName: string | null;
  costCenter: string | null;
  entryLines: number;
  entryGrossValue: number;
  reasons: JeReason[];
}

/**
 * A recorded exception. The fields the tool does not capture arrive null and are
 * written as entry cells: the workbook never asserts a judgement the preparer
 * has not made, and whether an entry indicates fraud is the judgement that
 * matters most here.
 */
export interface JeException {
  ref: string;
  jeNumber: string;
  lineNo: number | null;
  criteria: string;
  what: string;
  amount: number | null;
  fraudIndication: boolean | null;
  misstatement: string;
  implication: string;
  resolution: string;
  communicated: string;
}

export interface JeView {
  locale: "en" | "fr";
  clientName: string;
  fiscalYear: number;
  periodEnd: string;
  preparer: string | null;
  reviewer: string | null;
  partner: string | null;
  /** which of the two dates the ledger carries the timing criteria read */
  dateBasis: "journal" | "entry";
  ledger: JeLedger | null;
  populationChecks: JePopulationCheck[];
  criteria: JeCriterion[];
  selectedEntries: number;
  selectedLines: number;
  lines: JeSelectedLine[];
  exceptions: JeException[];
  /** what the engine wanted the reader to know about this run */
  notes: string[];
  /** the criteria flagged more lines than the engine reasons about */
  ceilingHit: boolean;
  /** the page shows fewer lines than were selected */
  truncated: boolean;
}

/* ============================ blank template =========================== */

/**
 * The empty E3.1 paper, for the Templates section: no ledger, six criteria rows
 * waiting to be described and twenty selection rows, so the auditor sees the
 * structure of the argument rather than a set of instructions about it. Nothing
 * is asserted — every identity, criterion and result cell arrives as an entry
 * cell, and the sample carries no selection the tool did not make.
 */
export function blankJeTemplate(): JeView {
  return {
    locale: "en",
    clientName: "",
    fiscalYear: new Date().getFullYear(),
    periodEnd: "",
    preparer: null,
    reviewer: null,
    partner: null,
    dateBasis: "journal",
    ledger: null,
    populationChecks: [],
    criteria: Array.from({ length: 6 }, () => ({
      key: "",
      name: "",
      description: "",
      rationale: "",
      settings: {},
      matchedEntries: 0,
      matchedLines: 0,
    })),
    selectedEntries: 0,
    selectedLines: 0,
    lines: Array.from({ length: 20 }, () => ({
      jeNumber: "",
      lineNo: 0,
      journalCode: null,
      journalDate: null,
      entryDate: null,
      account: "",
      accountName: null,
      description: null,
      debit: 0,
      credit: 0,
      signed: 0,
      preparer: null,
      reviewer: null,
      approver: null,
      reference: null,
      thirdPartyName: null,
      costCenter: null,
      entryLines: 0,
      entryGrossValue: 0,
      reasons: [],
    })),
    exceptions: [],
    notes: [],
    ceilingHit: false,
    truncated: false,
  };
}

/* ============================== styling =============================== */

const HDR = "FFD9D9D9";
const BAND = "FFC0C0C0";
const ENTRY = "FFFFF2CC";
const OK = "FFC6EFCE";
const BAD = "FFFFC7CE";
const WARN = "FFFFEB9C";
const OK_TEXT = "FF006100";
const BAD_TEXT = "FF9C0006";

/** The glyphs the preparer picks from, and what they mean. */
const TICK = "✓";
const CROSS = "✗";
const NA = "n/a";

const fill = (cell: ExcelJS.Cell, argb: string) => {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
};
const box = (cell: ExcelJS.Cell) => {
  cell.border = {
    top: { style: "thin", color: { argb: "FF999999" } },
    left: { style: "thin", color: { argb: "FF999999" } },
    bottom: { style: "thin", color: { argb: "FF999999" } },
    right: { style: "thin", color: { argb: "FF999999" } },
  };
};

const MONEY = "#,##0.00";

/* ===================== the Readme inputs on the Cover =================== */

/**
 * Fixed addresses. Every other tab reads these, so they must not move without
 * updating inputRef below. The names are internal keys; what the sheet shows is
 * the localised label beside them, so a French file and an English one address
 * the same cells.
 */
const INPUT_ROW_START = 4;
const INPUT_FIELDS = [
  "client",
  "engagement",
  "fiscalYear",
  "periodEnd",
  "ledger",
  "preparedBy",
  "datePrepared",
  "reviewedBy",
  "dateReviewed",
  "partner",
  "dateApproved",
] as const;

type InputField = (typeof INPUT_FIELDS)[number];

/**
 * A reference into the Readme block, written WITHOUT a leading "=".
 *
 * The `<f>` element of a cell holds the formula body only; a leading "=" is not
 * part of it. Excel treats a file that carries one as damaged, repairs it on
 * open, and silently drops the sheet's contents.
 */
const inputRef = (field: InputField): string =>
  `Cover!$D$${INPUT_ROW_START + INPUT_FIELDS.indexOf(field)}`;

/* ============================ small helpers ============================ */

/**
 * A parameter set as one readable line. The engine's own parameter names are
 * kept rather than prettified: the auditor who wants to reproduce this run types
 * them back into the tool, and a renamed threshold is a threshold nobody can
 * find again. Long lists are cut, because a criterion's twenty filler terms are
 * not what the reviewer is reading this column for.
 */
export function formatSettings(
  settings: Record<string, string | number | readonly string[]>,
  limit = 6,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(settings)) {
    if (Array.isArray(value)) {
      const shown = value.slice(0, limit).join(", ");
      parts.push(`${key} = ${shown}${value.length > limit ? ` … (+${value.length - limit})` : ""}`);
    } else {
      parts.push(`${key} = ${String(value)}`);
    }
  }
  return parts.join("   ·   ");
}

/* ============================== builder =============================== */

export async function buildJeWorkbook(view: JeView): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditISA";
  wb.created = new Date();

  const fr = view.locale === "fr";
  const T = (en: string, frText: string): string => (fr ? frText : en);

  const PAPER = T("E3.1 Journal entries and other adjustments", "E3.1 Écritures comptables et autres ajustements");

  const page = (ws: ExcelJS.Worksheet, footer: string) => {
    ws.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
    ws.headerFooter = { oddFooter: `&L${footer}&R&P / &N` };
  };

  const INPUT_LABEL: Record<InputField, string> = {
    client: T("Client / company", "Client / société"),
    engagement: T("Engagement", "Mission"),
    fiscalYear: T("Fiscal year", "Exercice"),
    periodEnd: T("Period end", "Date de clôture"),
    ledger: T("Ledger tested", "Grand livre testé"),
    preparedBy: T("Prepared by", "Préparé par"),
    datePrepared: T("Date prepared", "Date de préparation"),
    reviewedBy: T("Reviewed by", "Revu par"),
    dateReviewed: T("Date reviewed", "Date de revue"),
    partner: T("Partner", "Associé"),
    dateApproved: T("Date approved", "Date d'approbation"),
  };

  const ledgerLine = view.ledger
    ? `${view.ledger.sourceFilename} · ${view.ledger.timing}`
    : T("No journal entry dataset has been imported", "Aucun jeu de données d'écritures n'a été importé");

  const inputValue: Record<InputField, string | number> = {
    client: view.clientName,
    engagement: T(`Statutory audit — FY ${view.fiscalYear}`, `Audit légal — exercice ${view.fiscalYear}`),
    fiscalYear: view.fiscalYear,
    periodEnd: view.periodEnd,
    ledger: ledgerLine,
    preparedBy: view.preparer ?? "",
    datePrepared: "",
    reviewedBy: view.reviewer ?? "",
    dateReviewed: "",
    partner: view.partner ?? "",
    dateApproved: "",
  };

  /**
   * The identity band every tab except the Cover carries. Values are formulas
   * into the Readme block, never copies of it.
   */
  const identityBand = (ws: ExcelJS.Worksheet, title: string) => {
    const t = ws.addRow([`${PAPER} — ${title}`]);
    t.font = { bold: true, size: 13 };
    const fields: InputField[] = ["client", "engagement", "periodEnd", "preparedBy", "reviewedBy"];
    const keyRow = ws.addRow([...fields.map((f) => INPUT_LABEL[f]), T("Index", "Réf.")]);
    keyRow.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true }; });
    const valRow = ws.addRow([]);
    fields.forEach((field, i) => {
      valRow.getCell(i + 1).value = {
        formula: inputRef(field),
        result: String(inputValue[field] ?? ""),
      } as ExcelJS.CellFormulaValue;
    });
    valRow.getCell(fields.length + 1).value = "E3.1";
    valRow.eachCell((cell) => { box(cell); cell.alignment = { wrapText: true, vertical: "top" }; });
    ws.addRow([]);
  };

  const sectionBand = (ws: ExcelJS.Worksheet, label: string, span: number) => {
    const row = ws.addRow([label]);
    ws.mergeCells(row.number, 1, row.number, span);
    for (let c = 1; c <= span; c += 1) { fill(row.getCell(c), BAND); box(row.getCell(c)); }
    row.getCell(1).font = { bold: true };
    return row;
  };

  /** A key-and-value row on the Cover, the value typed by the auditor when empty. */
  const coverRow = (ws: ExcelJS.Worksheet, key: string, value: string, height?: number) => {
    const row = ws.addRow(["", key]);
    ws.mergeCells(row.number, 2, row.number, 3);
    ws.mergeCells(row.number, 4, row.number, 6);
    const k = row.getCell(2);
    k.font = { bold: true };
    k.alignment = { wrapText: true, vertical: "top" };
    fill(k, HDR);
    box(k);
    const v = row.getCell(4);
    v.value = value;
    v.alignment = { wrapText: true, vertical: "top" };
    box(v);
    if (value === "") fill(v, ENTRY);
    row.height = height ?? (value.length > 150 ? 40 : value.length > 90 ? 28 : 16);
    return row;
  };

  /* ----------------------------- 1 Cover ------------------------------ */
  const cover = wb.addWorksheet("Cover");
  page(cover, T("Cover", "Page de garde"));
  cover.columns = [
    { width: 6 }, { width: 18 }, { width: 26 }, { width: 52 }, { width: 32 }, { width: 20 },
  ] as ExcelJS.Column[];

  const coverTitle = cover.addRow([PAPER]);
  coverTitle.font = { bold: true, size: 13 };
  cover.addRow([]);
  sectionBand(
    cover,
    T(
      "Readme — enter these once; every tab in this file reads them",
      "À lire — saisir une seule fois ; tous les onglets du fichier les lisent",
    ),
    6,
  );

  INPUT_FIELDS.forEach((field, i) => {
    const row = cover.addRow(["", INPUT_LABEL[field], "", inputValue[field]]);
    cover.mergeCells(row.number, 2, row.number, 3);
    cover.mergeCells(row.number, 4, row.number, 6);
    const key = row.getCell(2);
    key.font = { bold: true };
    fill(key, HDR);
    box(key);
    const value = row.getCell(4);
    box(value);
    fill(value, ENTRY);
    value.alignment = { vertical: "top", wrapText: true };
    if (row.number !== INPUT_ROW_START + i) throw new Error("readme-layout-moved");
  });
  cover.addRow([]);

  sectionBand(cover, T("Scope and standards", "Objet et normes"), 6);
  coverRow(
    cover,
    T("This paper owns", "Ce papier couvre"),
    T(
      "The testing of journal entries and other adjustments in response to the presumed risk of management override of controls — the population and its completeness, the criteria the selection was directed by, the items selected, the work done on each and the conclusion.",
      "Le test des écritures comptables et autres ajustements en réponse au risque présumé de contournement des contrôles par la direction : la population et son exhaustivité, les critères ayant orienté la sélection, les éléments retenus, les travaux menés sur chacun et la conclusion.",
    ),
    44,
  );
  coverRow(
    cover,
    T("Standards", "Normes"),
    "ISA 240 ¶31–34 · ISA 240 ¶29(c) · ISA 315 (Revised 2019) ¶26 · IAM 321",
  );
  coverRow(
    cover,
    T("Feeds from · into", "Alimenté par · alimente"),
    T(
      "E1.2 IPE · S3.1 strategy and partner approval · S2.2 control design   →   C1.1 misstatements · C1.2 significant matters · E6.7 estimates bias · E6.2 significant unusual transactions",
      "IPE de E1.2 · stratégie et approbation de l'associé en S3.1 · conception des contrôles en S2.2   →   C1.1 anomalies · C1.2 points significatifs · E6.7 biais sur les estimations · E6.2 opérations significatives inhabituelles",
    ),
    32,
  );
  coverRow(
    cover,
    T("Method", "Méthode"),
    T(
      "The selection is directed by risk. A random sample of a fixed number of entries — twenty-five, for instance — is not appropriate for journal entry testing (IAM 321.03), and testing the entries identified by inquiry alone is not appropriate either. Every item on the Selection tab was returned by a stated criterion and carries the reason it was picked.",
      "La sélection est orientée par le risque. Une sélection aléatoire d'un nombre fixe d'écritures — vingt-cinq, par exemple — n'est pas appropriée pour le test des écritures (IAM 321.03), et tester par le seul entretien les écritures identifiées ne l'est pas davantage. Chaque élément de l'onglet Sélection provient d'un critère énoncé et porte le motif de sa sélection.",
    ),
    56,
  );
  cover.addRow([]);

  sectionBand(cover, T("Fraud risk — management override", "Risque de fraude — contournement par la direction"), 6);
  coverRow(
    cover,
    T("Why this work is done", "Pourquoi ces travaux"),
    T(
      "Management is uniquely placed to override controls that otherwise appear to operate effectively. The level of the risk varies between entities but it is present in all of them, and because the way an override may occur cannot be predicted, it is treated as a significant risk on every engagement (ISA 240 ¶31).",
      "La direction est dans une position unique pour contourner des contrôles qui paraissent par ailleurs fonctionner efficacement. Le niveau de ce risque varie d'une entité à l'autre mais il reste présent dans toutes, et parce que les modalités d'un contournement ne peuvent être anticipées, il est traité comme un risque important sur toute mission (ISA 240 ¶31).",
    ),
    48,
  );
  const likelihood = coverRow(
    cover,
    T("Likelihood of override assessed as", "Probabilité de contournement évaluée à"),
    "",
  );
  likelihood.getCell(4).dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [T('"Higher,Normal"', '"Élevée,Normale"')],
  };
  coverRow(
    cover,
    T("Partner approval of the strategy", "Approbation de la stratégie par l'associé"),
    "",
  );
  coverRow(
    cover,
    T(
      "Where higher — formalised review of the procedures and their conclusion",
      "Si élevée — revue formalisée des procédures et de leur conclusion",
    ),
    "",
  );
  cover.addRow([]);

  sectionBand(
    cover,
    T(
      "Unpredictability — record which lever was used and how (ISA 240 ¶29(c))",
      "Imprévisibilité — consigner quel levier a été actionné et comment (ISA 240 ¶29 c))",
    ),
    6,
  );
  const LEVERS: string[] = [
    T(
      "Amounts and types of entry selected",
      "Montants et types d'écritures retenus",
    ),
    T("Timing of the testing", "Moment des tests"),
    T(
      "Locations or organisational units selected",
      "Sites ou unités organisationnelles retenus",
    ),
    T(
      "Extent of the procedures, following the assessed fraud risk",
      "Étendue des procédures, selon le risque de fraude évalué",
    ),
  ];
  for (const lever of LEVERS) coverRow(cover, lever, "");
  cover.addRow([]);

  sectionBand(
    cover,
    T(
      "Controls over journal entries — what exists, who performs it, how we know it operates (ISA 315 ¶26)",
      "Contrôles sur les écritures — ce qui existe, qui l'exécute, comment nous savons qu'il fonctionne (ISA 315 ¶26)",
    ),
    6,
  );
  const CONTROLS: string[] = [
    T(
      "Segregation of duties over authorising, posting, reviewing and reconciling entries",
      "Séparation des tâches entre l'autorisation, la saisie, la revue et le rapprochement des écritures",
    ),
    T(
      "Access rights over who may record and who may approve an entry",
      "Droits d'accès déterminant qui peut saisir et qui peut approuver une écriture",
    ),
    T(
      "Oversight by management or internal audit, including post-entry review",
      "Supervision par la direction ou l'audit interne, y compris la revue a posteriori des écritures",
    ),
    T(
      "Regular testing of those controls by internal audit, where there is one",
      "Test régulier de ces contrôles par l'audit interne, lorsqu'il existe",
    ),
  ];
  for (const control of CONTROLS) coverRow(cover, control, "");
  cover.addRow([]);

  sectionBand(cover, T("What the selection returned", "Résultat de la sélection"), 6);
  const summaryHead = cover.addRow([
    "",
    T("Measure", "Mesure"),
    T("Count", "Nombre"),
    T("Note", "Observation"),
  ]);
  cover.mergeCells(summaryHead.number, 4, summaryHead.number, 6);
  [2, 3, 4].forEach((c) => {
    fill(summaryHead.getCell(c), HDR);
    box(summaryHead.getCell(c));
    summaryHead.getCell(c).font = { bold: true };
  });
  const SUMMARY: [string, number, string][] = [
    [
      T("Lines in the population", "Lignes de la population"),
      view.ledger?.lines ?? 0,
      T("Established on the Population tab", "Établie dans l'onglet Population"),
    ],
    [
      T("Entries in the population", "Écritures de la population"),
      view.ledger?.entries ?? 0,
      "",
    ],
    [
      T("Criteria applied", "Critères appliqués"),
      view.criteria.length,
      T("Each one, with its parameters, on the Criteria tab", "Chacun, avec ses paramètres, dans l'onglet Critères"),
    ],
    [
      T("Entries selected", "Écritures retenues"),
      view.selectedEntries,
      "",
    ],
    [
      T("Lines selected", "Lignes retenues"),
      view.selectedLines,
      view.truncated
        ? T(
            "More lines were selected than this file lists; the Selection tab shows the first page.",
            "Plus de lignes ont été retenues que ce fichier n'en liste ; l'onglet Sélection en présente la première page.",
          )
        : "",
    ],
    [
      T("Exceptions recorded", "Exceptions consignées"),
      view.exceptions.length,
      "",
    ],
  ];
  for (const [label, count, note] of SUMMARY) {
    const row = cover.addRow(["", label, count, note]);
    cover.mergeCells(row.number, 4, row.number, 6);
    [2, 3, 4].forEach((c) => box(row.getCell(c)));
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
  }
  cover.addRow([]);

  if (view.notes.length > 0 || view.ceilingHit) {
    sectionBand(cover, T("Notes on this run", "Observations sur cette exécution"), 6);
    for (const note of view.notes) {
      const row = cover.addRow(["", note]);
      cover.mergeCells(row.number, 2, row.number, 6);
      row.getCell(2).alignment = { wrapText: true, vertical: "top" };
      box(row.getCell(2));
      if (view.ceilingHit) fill(row.getCell(2), WARN);
      row.height = note.length > 200 ? 40 : 26;
    }
    cover.addRow([]);
  }

  sectionBand(cover, T("Conclusion", "Conclusion"), 6);
  const clean = view.exceptions.length === 0;
  const verdict = cover.addRow([
    "",
    clean ? T("No exception", "Aucune exception") : T("Exceptions", "Exceptions"),
    clean
      ? T(
          "Every entry selected is supported by a business rationale, was authorised at the correct level, is correctly accounted for and is recorded in the correct period. No indication of management override of controls giving rise to a material misstatement due to fraud was identified.",
          "Chaque écriture retenue repose sur une justification économique, a été autorisée au niveau approprié, est correctement comptabilisée et correctement rattachée à l'exercice. Aucun indice de contournement des contrôles par la direction donnant lieu à une anomalie significative résultant de fraudes n'a été relevé.",
        )
      : T(
          "One or more entries failed a test. Each is analysed on the Exceptions tab: whether it may indicate fraud, the misstatement raised in C1.1, what it means for the other aspects of the audit — in particular the reliability of management's representations — and how it was resolved.",
          "Une ou plusieurs écritures ont échoué à un test. Chacune est analysée dans l'onglet Exceptions : indication éventuelle d'une fraude, anomalie portée en C1.1, incidence sur les autres aspects de l'audit — en particulier la fiabilité des déclarations de la direction — et résolution.",
        ),
  ]);
  fill(verdict.getCell(2), clean ? OK : BAD);
  verdict.getCell(2).font = { bold: true, color: { argb: clean ? OK_TEXT : BAD_TEXT } };
  box(verdict.getCell(2));
  cover.mergeCells(verdict.number, 3, verdict.number, 6);
  verdict.getCell(3).alignment = { wrapText: true, vertical: "top" };
  verdict.height = 52;

  const conclHead = cover.addRow(["", T("Conclusion statement", "Affirmation de conclusion")]);
  cover.mergeCells(conclHead.number, 2, conclHead.number, 5);
  conclHead.getCell(6).value = T("Answer", "Réponse");
  [2, 6].forEach((c) => { fill(conclHead.getCell(c), HDR); box(conclHead.getCell(c)); conclHead.getCell(c).font = { bold: true }; });
  const CONCLUSIONS: string[] = [
    T(
      "The entries and other adjustments selected are appropriate: business rationale, level of authorisation, accounting and period of recording were each verified.",
      "Les écritures et autres ajustements retenus sont appropriés : justification économique, niveau d'autorisation, comptabilisation et rattachement à l'exercice ont chacun été vérifiés.",
    ),
    T(
      "No indication of management override giving rise to a material misstatement due to fraud was identified; where misstatements were found, their possible indication of fraud and their implications for the rest of the audit have been considered.",
      "Aucun indice de contournement par la direction donnant lieu à une anomalie significative résultant de fraudes n'a été relevé ; lorsque des anomalies ont été relevées, leur indication éventuelle d'une fraude et leurs incidences sur le reste de l'audit ont été appréciées.",
    ),
    T(
      "The procedures performed, with the estimates bias review and the review of significant unusual transactions, respond to the presumed significant risk of management override; any residual specific risk is answered by the additional procedures cross-referenced.",
      "Les procédures mises en œuvre, avec l'examen des estimations à la recherche de biais et la revue des opérations significatives inhabituelles, répondent au risque important présumé de contournement ; tout risque spécifique résiduel est couvert par les procédures complémentaires référencées.",
    ),
  ];
  for (const statement of CONCLUSIONS) {
    const row = cover.addRow(["", statement]);
    cover.mergeCells(row.number, 2, row.number, 5);
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    box(row.getCell(2));
    const answer = row.getCell(6);
    box(answer);
    fill(answer, ENTRY);
    answer.alignment = { horizontal: "center", vertical: "middle" };
    answer.dataValidation = { type: "list", allowBlank: true, formulae: [`"${TICK},${CROSS},${NA}"`] };
    row.height = 40;
  }
  cover.addRow([]);

  sectionBand(cover, T("Sign-off", "Signatures"), 6);
  const signHead = cover.addRow(["", T("Role", "Rôle"), T("Name", "Nom"), T("Date", "Date")]);
  [2, 3, 4].forEach((c) => { fill(signHead.getCell(c), HDR); box(signHead.getCell(c)); signHead.getCell(c).font = { bold: true }; });
  ([
    [INPUT_LABEL.preparedBy, "preparedBy", "datePrepared"],
    [INPUT_LABEL.reviewedBy, "reviewedBy", "dateReviewed"],
    [INPUT_LABEL.partner, "partner", "dateApproved"],
  ] as [string, InputField, InputField][]).forEach(([label, nameField, dateField]) => {
    const row = cover.addRow(["", label]);
    row.getCell(3).value = {
      formula: inputRef(nameField), result: String(inputValue[nameField] ?? ""),
    } as ExcelJS.CellFormulaValue;
    row.getCell(4).value = {
      formula: inputRef(dateField), result: String(inputValue[dateField] ?? ""),
    } as ExcelJS.CellFormulaValue;
    for (const c of [2, 3, 4]) box(row.getCell(c));
  });
  const signNote = cover.addRow([
    "",
    T(
      "Sign-off is held by the tool. These cells read the Readme block and are not typed over.",
      "Les signatures sont tenues par l'outil. Ces cellules lisent le bloc « À lire » et ne se saisissent pas.",
    ),
  ]);
  cover.mergeCells(signNote.number, 2, signNote.number, 6);
  signNote.getCell(2).font = { italic: true };

  cover.views = [{ state: "frozen", ySplit: 3 }];

  /* --------------------------- 2 Population --------------------------- */
  const population = wb.addWorksheet("Population");
  page(population, T("Population — the ledger relied on", "Population — le grand livre utilisé"));
  population.columns = [
    { width: 12 }, { width: 34 }, { width: 14 }, { width: 30 },
    { width: 40 }, { width: 40 }, { width: 26 }, { width: 18 }, { width: 16 },
  ] as ExcelJS.Column[];
  identityBand(population, T("Population", "Population"));

  sectionBand(
    population,
    T(
      "The journal entry population is information produced by the entity",
      "La population des écritures est une information produite par l'entité",
    ),
    9,
  );
  const IPE_LINES: [string, string][] = [
    [
      T("What that means", "Ce que cela signifie"),
      T(
        "The list of journal entries did not come from an independent source. It was produced by the entity's own accounting system, by staff who chose the report, the date range and the posting statuses it was run with. Anything selected from it inherits whatever that extraction left out.",
        "La liste des écritures ne provient pas d'une source indépendante. Elle a été produite par le système comptable de l'entité, par des personnes qui ont choisi l'état, la plage de dates et les statuts de comptabilisation retenus pour l'extraire. Tout ce qui en est retenu hérite de ce que cette extraction a laissé de côté.",
      ),
    ],
    [
      T("Why it matters here", "Pourquoi c'est déterminant ici"),
      T(
        "A criterion can only find what the extract contains. An entry that never reached the file is not an entry the weekend test cleared — it is an entry nobody looked at, and no count of matched lines on the Criteria tab says otherwise. Establishing the population is therefore done before anything is selected from it, not afterwards.",
        "Un critère ne peut trouver que ce que contient l'extraction. Une écriture absente du fichier n'est pas une écriture que le test du week-end a écartée : c'est une écriture que personne n'a regardée, et aucun décompte de lignes retenues dans l'onglet Critères n'y change rien. L'établissement de la population précède donc toute sélection, il ne la suit pas.",
      ),
    ],
    [
      T("Completeness", "Exhaustivité"),
      T(
        "That the extract holds every entry posted in the period — nothing dropped by a filter, a date range, a posting status, a journal code or a permission. Establish it by agreeing the record count and the total debits and credits back to the general ledger, and by recording the parameters the extract was run with.",
        "L'extraction contient toutes les écritures comptabilisées sur la période — rien n'a été écarté par un filtre, une plage de dates, un statut de comptabilisation, un code journal ou une habilitation. L'établir en rapprochant le nombre d'enregistrements et les totaux débit et crédit du grand livre, et en consignant les paramètres d'extraction retenus.",
      ),
    ],
    [
      T("Accuracy", "Exactitude"),
      T(
        "That the fields the criteria read carry the values the system holds — dates, amounts, descriptions, preparer and reviewer names. A criterion reading a column the import mapped to the wrong field selects the wrong lines and says nothing about it. Establish accuracy by tracing a sample of lines back to the source records.",
        "Les champs que lisent les critères portent bien les valeurs détenues par le système : dates, montants, libellés, noms du préparateur et du réviseur. Un critère qui lit une colonne mal rattachée à l'import retient de mauvaises lignes sans le signaler. Établir l'exactitude en rattachant un échantillon de lignes aux enregistrements source.",
      ),
    ],
  ];
  for (const [term, text] of IPE_LINES) {
    const row = population.addRow([term, text]);
    population.mergeCells(row.number, 2, row.number, 9);
    const k = row.getCell(1);
    k.font = { bold: true };
    k.alignment = { vertical: "top", wrapText: true };
    box(k);
    const v = row.getCell(2);
    v.alignment = { wrapText: true, vertical: "top" };
    box(v);
    row.height = text.length > 340 ? 58 : text.length > 240 ? 46 : 34;
  }
  population.addRow([]);

  sectionBand(population, T("The ledger relied on", "Le grand livre utilisé"), 9);
  const dateBasisLabel = view.dateBasis === "entry"
    ? T("entry (recording) date", "date de saisie")
    : T("journal date", "date de journal");
  const LEDGER_ROWS: [string, string][] = [
    [T("Source file", "Fichier source"), view.ledger?.sourceFilename ?? ""],
    [T("Timing of the extract", "Moment de l'extraction"), view.ledger?.timing ?? ""],
    [T("Rows in the import", "Lignes de l'import"), view.ledger ? String(view.ledger.datasetRows) : ""],
    [T("Lines in the tested population", "Lignes de la population testée"), view.ledger ? String(view.ledger.lines) : ""],
    [T("Entries in the tested population", "Écritures de la population testée"), view.ledger ? String(view.ledger.entries) : ""],
    [
      T(`Lines carrying a ${dateBasisLabel}`, `Lignes portant une ${dateBasisLabel}`),
      view.ledger ? String(view.ledger.datedLines) : "",
    ],
    [
      T("Date the timing criteria read", "Date lue par les critères de calendrier"),
      dateBasisLabel,
    ],
  ];
  for (const [key, value] of LEDGER_ROWS) {
    const row = population.addRow([key, value]);
    population.mergeCells(row.number, 2, row.number, 9);
    const k = row.getCell(1);
    k.font = { bold: true };
    fill(k, HDR);
    box(k);
    const v = row.getCell(2);
    v.alignment = { wrapText: true, vertical: "top" };
    box(v);
    if (value === "") fill(v, ENTRY);
  }
  if (!view.ledger) {
    const none = population.addRow([
      T(
        "No journal entry dataset is registered on this engagement, so no population has been established and nothing has been selected. Import the ledger and run the selection before this paper is concluded.",
        "Aucun jeu de données d'écritures n'est enregistré sur cette mission : aucune population n'a donc été établie et rien n'a été retenu. Importer le grand livre et exécuter la sélection avant de conclure ce papier.",
      ),
    ]);
    population.mergeCells(none.number, 1, none.number, 9);
    none.getCell(1).alignment = { wrapText: true, vertical: "top" };
    fill(none.getCell(1), WARN);
    box(none.getCell(1));
    none.height = 30;
  }
  population.addRow([]);

  sectionBand(
    population,
    T("Automated checks on the projected population", "Contrôles automatiques sur la population projetée"),
    9,
  );
  const checkHead = population.addRow([
    T("Ref", "Réf."),
    T("Check", "Contrôle"),
    T("Status", "État"),
    T("What the check found", "Constat du contrôle"),
  ]);
  population.mergeCells(checkHead.number, 4, checkHead.number, 9);
  [1, 2, 3, 4].forEach((c) => {
    fill(checkHead.getCell(c), HDR);
    box(checkHead.getCell(c));
    checkHead.getCell(c).font = { bold: true };
    checkHead.getCell(c).alignment = { wrapText: true, vertical: "middle" };
  });
  const STATUS_LABEL: Record<JePopulationCheck["status"], string> = {
    passed: T("Passed", "Satisfait"),
    warning: T("Warning", "Réserve"),
    failed: T("Failed", "Échec"),
  };
  if (view.populationChecks.length === 0) {
    const none = population.addRow([
      "",
      T(
        "The population checks have not been run. They are part of establishing completeness, not a substitute for it.",
        "Les contrôles de population n'ont pas été exécutés. Ils participent à l'établissement de l'exhaustivité, ils ne s'y substituent pas.",
      ),
    ]);
    population.mergeCells(none.number, 2, none.number, 9);
    none.getCell(2).font = { italic: true };
  }
  view.populationChecks.forEach((check, i) => {
    const row = population.addRow([`P-${i + 1}`, check.label, STATUS_LABEL[check.status], check.detail]);
    population.mergeCells(row.number, 4, row.number, 9);
    [1, 2, 3, 4].forEach((c) => {
      box(row.getCell(c));
      row.getCell(c).alignment = { wrapText: true, vertical: "top" };
    });
    fill(row.getCell(3), check.status === "passed" ? OK : check.status === "warning" ? WARN : BAD);
    row.getCell(3).font = {
      bold: true,
      color: { argb: check.status === "failed" ? BAD_TEXT : OK_TEXT },
    };
    row.height = check.detail.length > 120 ? 30 : 18;
  });
  population.addRow([]);

  sectionBand(
    population,
    T("Work performed on the population", "Travaux réalisés sur la population"),
    9,
  );
  const WORK_ROWS: string[] = [
    T(
      "Completeness — procedure performed and evidence retained (record count and debit/credit totals agreed to the general ledger)",
      "Exhaustivité — procédure mise en œuvre et éléments conservés (nombre d'enregistrements et totaux débit/crédit rapprochés du grand livre)",
    ),
    T(
      "Accuracy — procedure performed and evidence retained (sample of lines traced back to the source records)",
      "Exactitude — procédure mise en œuvre et éléments conservés (échantillon de lignes rattaché aux enregistrements source)",
    ),
    T(
      "Extract parameters — who ran it, when, on which date range, with which posting statuses and journal codes",
      "Paramètres d'extraction — qui l'a exécutée, quand, sur quelle plage de dates, avec quels statuts de comptabilisation et codes journaux",
    ),
    T(
      "Entries recorded outside the accounting system — top-side adjustments to the closing trial balance, and how they were obtained",
      "Écritures passées hors du système comptable — ajustements « top-side » sur la balance de clôture et modalités de leur obtention",
    ),
    T(
      "Conclusion on the population, and what was done where completeness or accuracy could not be established",
      "Conclusion sur la population et suites données lorsque l'exhaustivité ou l'exactitude n'a pu être établie",
    ),
  ];
  for (const label of WORK_ROWS) {
    const row = population.addRow([label]);
    population.mergeCells(row.number, 1, row.number, 3);
    population.mergeCells(row.number, 4, row.number, 9);
    const k = row.getCell(1);
    k.font = { bold: true };
    k.alignment = { wrapText: true, vertical: "top" };
    fill(k, HDR);
    box(k);
    const v = row.getCell(4);
    v.alignment = { wrapText: true, vertical: "top" };
    box(v);
    fill(v, ENTRY);
    row.height = 34;
  }
  population.views = [{ state: "frozen", ySplit: 3 }];

  /* ---------------------------- 3 Criteria ---------------------------- */
  const criteria = wb.addWorksheet("Criteria");
  page(criteria, T("Criteria — how the selection was directed", "Critères — comment la sélection a été orientée"));
  const CRIT_SPAN = 9;
  criteria.columns = [
    { width: 10 }, { width: 30 }, { width: 42 }, { width: 46 }, { width: 34 },
    { width: 11 }, { width: 11 }, { width: 38 }, { width: 20 },
  ] as ExcelJS.Column[];
  identityBand(criteria, T("Criteria", "Critères"));

  const critIntro = criteria.addRow([
    T(
      "Each criterion below was chosen because something about the entries it returns is worth reading — never because a number of items had to be reached. The parameters are the thresholds this run actually used; changing one changes what the tool returns, so a re-run under different thresholds is a different selection and is documented as one. Criteria considered and set aside are recorded at the foot of this tab, because a criterion nobody applied is a judgement as much as one that was.",
      "Chaque critère ci-dessous a été retenu parce que les écritures qu'il fait remonter méritent lecture — jamais parce qu'un nombre d'éléments devait être atteint. Les paramètres sont les seuils effectivement utilisés lors de cette exécution ; en modifier un modifie ce que l'outil restitue : une nouvelle exécution sous d'autres seuils constitue une autre sélection et est documentée comme telle. Les critères examinés puis écartés figurent au bas de cet onglet, car un critère non appliqué relève d'un jugement autant qu'un critère appliqué.",
    ),
  ]);
  criteria.mergeCells(critIntro.number, 1, critIntro.number, CRIT_SPAN);
  critIntro.getCell(1).alignment = { wrapText: true, vertical: "top" };
  critIntro.getCell(1).font = { italic: true };
  fill(critIntro.getCell(1), HDR);
  box(critIntro.getCell(1));
  critIntro.height = 52;
  criteria.addRow([]);

  const critHead = criteria.addRow([
    T("Ref", "Réf."),
    T("Criterion", "Critère"),
    T("What it selects", "Ce qu'il retient"),
    T("Why it is applied", "Pourquoi il est appliqué"),
    T("Parameters used", "Paramètres retenus"),
    T("Entries", "Écritures"),
    T("Lines", "Lignes"),
    T("Why on this engagement", "Pourquoi sur cette mission"),
    T("Work reference", "Référence des travaux"),
  ]);
  critHead.eachCell((cell) => {
    fill(cell, HDR); box(cell); cell.font = { bold: true };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  critHead.height = 30;
  criteria.views = [{ state: "frozen", ySplit: critHead.number, xSplit: 2 }];

  view.criteria.forEach((criterion, i) => {
    const row = criteria.addRow([
      criterion.key || `C-${i + 1}`,
      criterion.name,
      criterion.description,
      criterion.rationale,
      formatSettings(criterion.settings),
      criterion.matchedEntries,
      criterion.matchedLines,
      "",
      "",
    ]);
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > CRIT_SPAN) return;
      box(cell);
      cell.alignment = { wrapText: true, vertical: "top" };
    });
    for (const c of [1, 2, 3, 4, 5, 8, 9]) {
      const value = row.getCell(c).value;
      if (value === "" || value === null || value === undefined) fill(row.getCell(c), ENTRY);
    }
    // A criterion that matched nothing is not a finding, and it is not a failure
    // either: it is the reader's cue that this risk was looked for and absent.
    if (criterion.matchedLines === 0 && criterion.name !== "") {
      fill(row.getCell(7), OK);
      row.getCell(7).font = { color: { argb: OK_TEXT } };
    }
    row.height = 44;
  });

  criteria.addRow([]);
  sectionBand(
    criteria,
    T("Criteria considered and not applied, and why", "Critères examinés et non retenus, et pourquoi"),
    CRIT_SPAN,
  );
  for (let i = 0; i < 4; i += 1) {
    const row = criteria.addRow([`N-${i + 1}`, "", ""]);
    criteria.mergeCells(row.number, 2, row.number, 3);
    criteria.mergeCells(row.number, 4, row.number, CRIT_SPAN);
    for (const c of [1, 2, 4]) {
      box(row.getCell(c));
      row.getCell(c).alignment = { wrapText: true, vertical: "top" };
      fill(row.getCell(c), c === 1 ? HDR : ENTRY);
    }
    row.height = 22;
  }
  const critFoot = criteria.addRow([
    T(
      "Out-of-hours posting is not offered as a criterion. The imported ledger carries a posting date and no time of day, so there is nothing to test the hour of entry against; inventing one would be worse than not offering the test.",
      "La comptabilisation hors heures ouvrées n'est pas proposée comme critère. Le grand livre importé porte une date de comptabilisation sans heure : rien ne permet de tester l'heure de saisie, et en inventer une vaudrait moins que de ne pas proposer le test.",
    ),
  ]);
  criteria.mergeCells(critFoot.number, 1, critFoot.number, CRIT_SPAN);
  critFoot.getCell(1).font = { italic: true };
  critFoot.getCell(1).alignment = { wrapText: true, vertical: "top" };
  critFoot.height = 28;

  /* --------------------------- 4 Selection ---------------------------- */
  const selection = wb.addWorksheet("Selection");
  page(selection, T("Selection — the items tested", "Sélection — les éléments testés"));
  const FIRST_TEST = 23;
  const TEST_COUNT = 4;
  const OUTCOME_COL = 28;
  const SEL_SPAN = 29;
  selection.columns = [
    { width: 5 }, { width: 16 }, { width: 6 }, { width: 12 }, { width: 12 }, { width: 10 },
    { width: 12 }, { width: 26 }, { width: 40 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 14 },
    { width: 8 }, { width: 14 }, { width: 8 }, { width: 52 },
    { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
    { width: 40 }, { width: 12 }, { width: 34 },
  ] as ExcelJS.Column[];
  identityBand(selection, T("Selection", "Sélection"));

  const selLegend = selection.addRow([
    T(
      `Legend:  ${TICK} the point holds   ${CROSS} it does not — the item is an exception and goes to the Exceptions tab   ${NA} not applicable to this item.`
      + "   The four test columns are the four points ISA 240 requires of every entry selected: an underlying business rationale, authorisation at the correct level, correct accounting, and recording in the correct period."
      + "   Outcome is a formula — Exception if any of the four is ✗, blank until all four are answered. Inquiry alone answers none of them.",
      `Légende :  ${TICK} le point est vérifié   ${CROSS} il ne l'est pas — l'élément constitue une exception et rejoint l'onglet Exceptions   ${NA} sans objet pour cet élément.`
      + " Les quatre colonnes de test sont les quatre points que l'ISA 240 exige pour chaque écriture retenue : justification économique sous-jacente, autorisation au niveau approprié, correcte comptabilisation, correct rattachement à l'exercice."
      + " Le résultat est une formule — « Exception » si l'un des quatre est ✗, vide tant que les quatre ne sont pas renseignés. L'entretien seul n'en renseigne aucun.",
    ),
  ]);
  selection.mergeCells(selLegend.number, 1, selLegend.number, SEL_SPAN);
  selLegend.getCell(1).alignment = { wrapText: true, vertical: "top" };
  selLegend.getCell(1).font = { italic: true };
  fill(selLegend.getCell(1), HDR);
  box(selLegend.getCell(1));
  selLegend.height = 44;
  selection.addRow([]);

  const selHead = selection.addRow([
    "#",
    T("Entry no.", "N° d'écriture"),
    T("Line", "Ligne"),
    T("Journal date", "Date de journal"),
    T("Entry date", "Date de saisie"),
    T("Journal", "Journal"),
    T("Account", "Compte"),
    T("Account name", "Libellé du compte"),
    T("Description", "Libellé"),
    T("Debit", "Débit"),
    T("Credit", "Crédit"),
    T("Signed", "Montant signé"),
    T("Preparer", "Préparateur"),
    T("Reviewer", "Réviseur"),
    T("Approver", "Approbateur"),
    T("Reference", "Référence"),
    T("Third party", "Tiers"),
    T("Cost centre", "Centre de coût"),
    T("Lines", "Lignes"),
    T("Entry gross", "Valeur brute"),
    T("Crit.", "Crit."),
    T("Why this item was selected", "Motif de sélection de cet élément"),
    T("Rationale", "Justif."),
    T("Author.", "Autor."),
    T("Account.", "Compta."),
    T("Period", "Rattach."),
    T("Work done and evidence retained", "Travaux réalisés et éléments conservés"),
    T("Outcome", "Résultat"),
    T("Note", "Observation"),
  ]);
  selHead.eachCell({ includeEmpty: true }, (cell, c) => {
    if (c > SEL_SPAN) return;
    fill(cell, HDR); box(cell); cell.font = { bold: true };
    cell.alignment = { wrapText: true, vertical: "middle" };
    if (c >= FIRST_TEST && c < FIRST_TEST + TEST_COUNT) cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  selHead.height = 34;
  selection.views = [{ state: "frozen", ySplit: selHead.number, xSplit: 2 }];

  const firstDataRow = selHead.number + 1;
  view.lines.forEach((line, i) => {
    const row = selection.addRow([
      i + 1,
      line.jeNumber,
      line.lineNo || "",
      line.journalDate ?? "",
      line.entryDate ?? "",
      line.journalCode ?? "",
      line.account,
      line.accountName ?? "",
      line.description ?? "",
      line.debit,
      line.credit,
      line.signed,
      line.preparer ?? "",
      line.reviewer ?? "",
      line.approver ?? "",
      line.reference ?? "",
      line.thirdPartyName ?? "",
      line.costCenter ?? "",
      line.entryLines || "",
      line.entryGrossValue,
      line.reasons.length || "",
      line.reasons.map((r) => `${r.label} — ${r.detail}`).join("\n"),
      "", "", "", "",
      "", null, "",
    ]);
    for (let c = 1; c <= SEL_SPAN; c += 1) {
      const cell = row.getCell(c);
      box(cell);
      cell.alignment = { wrapText: true, vertical: "top" };
    }
    for (const c of [10, 11, 12, 20]) row.getCell(c).numFmt = MONEY;

    for (let a = 0; a < TEST_COUNT; a += 1) {
      const cell = row.getCell(FIRST_TEST + a);
      cell.value = "";
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.dataValidation = { type: "list", allowBlank: true, formulae: [`"${TICK},${CROSS},${NA}"`] };
      fill(cell, ENTRY);
    }
    fill(row.getCell(FIRST_TEST + TEST_COUNT), ENTRY);
    fill(row.getCell(SEL_SPAN), ENTRY);

    const from = `${selection.getColumn(FIRST_TEST).letter}${row.number}`;
    const to = `${selection.getColumn(FIRST_TEST + TEST_COUNT - 1).letter}${row.number}`;
    row.getCell(OUTCOME_COL).value = {
      formula: `IF(COUNTIF(${from}:${to},"${CROSS}")>0,"${T("Exception", "Exception")}",IF(COUNTBLANK(${from}:${to})>0,"","${T("Clean", "Conforme")}"))`,
      result: "",
    } as ExcelJS.CellFormulaValue;
    row.getCell(OUTCOME_COL).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(OUTCOME_COL).font = { bold: true };
    row.height = Math.min(72, 18 + line.reasons.length * 13);
  });

  if (view.lines.length === 0) {
    const none = selection.addRow([
      T(
        "No item has been selected. Either the selection has not been run, or every criterion applied returned nothing — the Criteria tab says which, and the difference matters.",
        "Aucun élément n'a été retenu. Soit la sélection n'a pas été exécutée, soit tous les critères appliqués n'ont rien fait remonter — l'onglet Critères indique lequel des deux, et la distinction compte.",
      ),
    ]);
    selection.mergeCells(none.number, 1, none.number, SEL_SPAN);
    none.getCell(1).font = { italic: true };
    none.getCell(1).alignment = { wrapText: true, vertical: "top" };
  } else {
    const lastDataRow = selection.rowCount;
    const testRef = `${selection.getColumn(FIRST_TEST).letter}${firstDataRow}:${selection.getColumn(FIRST_TEST + TEST_COUNT - 1).letter}${lastDataRow}`;
    selection.addConditionalFormatting({
      ref: testRef,
      rules: [
        { type: "cellIs", operator: "equal", priority: 1, formulae: [`"${TICK}"`],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: OK } }, font: { color: { argb: OK_TEXT }, bold: true } } },
        { type: "cellIs", operator: "equal", priority: 2, formulae: [`"${CROSS}"`],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: BAD } }, font: { color: { argb: BAD_TEXT }, bold: true } } },
      ],
    });
    const outcomeLetter = selection.getColumn(OUTCOME_COL).letter;
    selection.addConditionalFormatting({
      ref: `${outcomeLetter}${firstDataRow}:${outcomeLetter}${lastDataRow}`,
      rules: [
        { type: "cellIs", operator: "equal", priority: 1, formulae: [`"${T("Clean", "Conforme")}"`],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: OK } }, font: { color: { argb: OK_TEXT }, bold: true } } },
        { type: "cellIs", operator: "equal", priority: 2, formulae: [`"${T("Exception", "Exception")}"`],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: BAD } }, font: { color: { argb: BAD_TEXT }, bold: true } } },
      ],
    });

    const total = selection.addRow([T("Total", "Total")]);
    selection.mergeCells(total.number, 1, total.number, 9);
    total.getCell(1).font = { bold: true };
    for (const c of [10, 11, 12]) {
      const letter = selection.getColumn(c).letter;
      total.getCell(c).value = {
        formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`,
        result: view.lines.reduce((sum, l) => sum + (c === 10 ? l.debit : c === 11 ? l.credit : l.signed), 0),
      } as ExcelJS.CellFormulaValue;
      total.getCell(c).numFmt = MONEY;
    }
    total.getCell(OUTCOME_COL).value = {
      formula: `COUNTIF(${outcomeLetter}${firstDataRow}:${outcomeLetter}${lastDataRow},"${T("Exception", "Exception")}")`,
      result: 0,
    } as ExcelJS.CellFormulaValue;
    total.getCell(OUTCOME_COL).alignment = { horizontal: "center" };
    for (let c = 1; c <= SEL_SPAN; c += 1) { box(total.getCell(c)); fill(total.getCell(c), HDR); }
    total.font = { bold: true };
  }

  if (view.truncated) {
    const cut = selection.addRow([
      T(
        "This tab lists the first page of the selection. The remaining items are in the tool; export again once the criteria are narrowed, or test the rest from the tool and record the reference here.",
        "Cet onglet présente la première page de la sélection. Les éléments restants se trouvent dans l'outil ; exporter de nouveau après resserrement des critères, ou tester le reste depuis l'outil et en consigner la référence ici.",
      ),
    ]);
    selection.mergeCells(cut.number, 1, cut.number, SEL_SPAN);
    fill(cut.getCell(1), WARN);
    box(cut.getCell(1));
    cut.getCell(1).alignment = { wrapText: true, vertical: "top" };
  }

  /* --------------------------- 5 Exceptions --------------------------- */
  const exceptions = wb.addWorksheet("Exceptions");
  page(exceptions, T("Exceptions", "Exceptions"));
  const EXC_SPAN = 11;
  exceptions.columns = [
    { width: 8 }, { width: 16 }, { width: 6 }, { width: 26 }, { width: 44 }, { width: 15 },
    { width: 12 }, { width: 30 }, { width: 40 }, { width: 34 }, { width: 22 },
  ] as ExcelJS.Column[];
  identityBand(exceptions, T("Exceptions", "Exceptions"));

  const excHead = exceptions.addRow([
    T("Exc.", "Exc."),
    T("Entry no.", "N° d'écriture"),
    T("Line", "Ligne"),
    T("Criteria matched", "Critères satisfaits"),
    T("What the exception is", "Nature de l'exception"),
    T("Amount", "Montant"),
    T("May indicate fraud", "Indice de fraude"),
    T("Misstatement raised in C1.1", "Anomalie portée en C1.1"),
    T("Implication for the rest of the audit, including management's representations", "Incidence sur le reste de l'audit, y compris les déclarations de la direction"),
    T("Resolution", "Résolution"),
    T("Communicated", "Communiqué à"),
  ]);
  excHead.eachCell((cell) => {
    fill(cell, HDR); box(cell); cell.font = { bold: true };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  excHead.height = 34;
  exceptions.views = [{ state: "frozen", ySplit: excHead.number, xSplit: 1 }];

  if (view.exceptions.length === 0) {
    const none = exceptions.addRow([
      T(
        "No item selected failed any of the four tests. An empty tab is a conclusion only once every item on the Selection tab carries an outcome.",
        "Aucun élément retenu n'a échoué à l'un des quatre tests. Un onglet vide ne vaut conclusion que lorsque chaque élément de l'onglet Sélection porte un résultat.",
      ),
    ]);
    exceptions.mergeCells(none.number, 1, none.number, EXC_SPAN);
    none.getCell(1).font = { italic: true };
    none.getCell(1).alignment = { wrapText: true, vertical: "top" };
  }
  for (const exception of view.exceptions) {
    const row = exceptions.addRow([
      exception.ref,
      exception.jeNumber,
      exception.lineNo ?? "",
      exception.criteria,
      exception.what,
      exception.amount,
      exception.fraudIndication === null ? "" : exception.fraudIndication ? T("Yes", "Oui") : T("No", "Non"),
      exception.misstatement,
      exception.implication,
      exception.resolution,
      exception.communicated,
    ]);
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > EXC_SPAN) return;
      box(cell);
      cell.alignment = { wrapText: true, vertical: "top" };
    });
    row.getCell(6).numFmt = MONEY;
    for (const c of [5, 7, 8, 9, 10, 11]) {
      const value = row.getCell(c).value;
      if (value === "" || value === null || value === undefined) fill(row.getCell(c), ENTRY);
    }
    row.getCell(7).dataValidation = {
      type: "list", allowBlank: true, formulae: [T('"Yes,No"', '"Oui,Non"')],
    };
    if (exception.fraudIndication === true) fill(row.getCell(7), BAD);
    row.height = 32;
  }
  exceptions.addRow([]);
  const excNote = exceptions.addRow([
    T(
      "A misstatement found here is considered for what it may indicate about fraud and for what it means elsewhere in the audit — in particular the reliability of management's representations (ISA 240 ¶35–36). Where the identified risk of override is not fully answered by the procedures performed, the additional procedures are designed, performed and cross-referenced on the Cover.",
      "Une anomalie relevée ici est appréciée au regard de ce qu'elle peut révéler d'une fraude et de ses incidences ailleurs dans l'audit — en particulier la fiabilité des déclarations de la direction (ISA 240 ¶35-36). Lorsque le risque de contournement identifié n'est pas entièrement couvert par les procédures mises en œuvre, les procédures complémentaires sont conçues, réalisées et référencées sur la page de garde.",
    ),
  ]);
  exceptions.mergeCells(excNote.number, 1, excNote.number, EXC_SPAN);
  excNote.getCell(1).font = { italic: true };
  excNote.getCell(1).alignment = { wrapText: true, vertical: "top" };
  excNote.height = 40;

  /* ------------------- house style: 10pt everywhere ------------------- */
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const current = cell.font ?? {};
        cell.font = {
          ...current,
          name: current.name ?? "Calibri",
          size: (current.size ?? 0) >= 12 ? current.size : 10,
        };
      });
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
