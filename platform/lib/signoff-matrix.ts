// The firm's sign-off role matrix as a workbook (F002): downloaded from the
// settings panel, completed offline, imported back.
//
// The layout is fixed. A "Rôles" sheet first (the ladder, for reference), then
// the "Tasks" sheet, header in row 1, one task per row:
//   A Code · B Phase · C Task (FR) · D Task (EN) · E Tier
//   F Today's minimum preparer · G Today's minimum reviewer · H Partner sign-off today
//   I Your minimum preparer · J Your minimum reviewer · K Partner sign-off required (Oui/Non)
//   L Comment
// Import finds the sheet by its name and reads by column POSITION, never by
// header text: the header is localised. Only I-K are saved; a blank cell is
// NULL, i.e. the firm default.
//
// Pure functions over plain data, so they can be tested without a database.

import ExcelJS from "exceljs";
import { phaseOfTask } from "@/lib/engagement-dashboard";
import { DEFAULT_FILE_INDEX } from "@/lib/file-index";
import {
  TEAM_LADDER,
  effectiveTaskRule,
  type LadderRole,
  type SignoffPolicy,
  type TaskRule,
  type TaskRuleInput,
} from "@/lib/signoff-policy";

export type MatrixLocale = "fr" | "en";

export const MATRIX_SHEET = "Tasks";
export const ROLES_SHEET = "Rôles";

/** Short ladder labels used in the workbook cells. */
export const MATRIX_ROLE_LABELS: Record<LadderRole, { fr: string; en: string }> = {
  staff: { fr: "Assistant audit", en: "Staff" },
  senior: { fr: "Senior", en: "Senior" },
  manager: { fr: "Manager", en: "Manager" },
  senior_manager: { fr: "Senior manager", en: "Senior manager" },
  director: { fr: "Directeur", en: "Director" },
  partner: { fr: "Associé", en: "Partner" },
};

/** The longer labels of the team page (messages planning.team.roles), also accepted on import. */
const LONG_LABELS: Record<LadderRole, string[]> = {
  staff: ["Audit staff", "Assistant"],
  senior: ["Audit senior", "Senior audit"],
  manager: ["Audit manager", "Manager audit"],
  senior_manager: ["Audit senior manager", "Senior manager audit", "Senior-manager", "senior-manager"],
  director: ["Audit director", "Directeur audit"],
  partner: ["Audit partner", "Associé d'audit", "Associé d’audit"],
};

const PHASE_LABELS: Record<string, { fr: string; en: string }> = {
  acceptance: { fr: "Acceptation", en: "Acceptance" },
  planning: { fr: "Planification", en: "Planning" },
  execution: { fr: "Exécution", en: "Execution" },
  conclusion: { fr: "Conclusion", en: "Conclusion" },
};

const TIER_LABELS: Record<string, { fr: string; en: string }> = {
  core: { fr: "Essentiel", en: "Core" },
  standard: { fr: "Standard", en: "Standard" },
  extended: { fr: "Étendu", en: "Extended" },
};

const HEADERS: Record<MatrixLocale, string[]> = {
  fr: [
    "Code",
    "Phase",
    "Tâche (FR)",
    "Tâche (EN)",
    "Niveau",
    "Préparateur minimum aujourd'hui",
    "Réviseur minimum aujourd'hui",
    "Signature associé aujourd'hui",
    "Votre préparateur minimum",
    "Votre réviseur minimum",
    "Signature associé requise (Oui/Non)",
    "Commentaire",
  ],
  en: [
    "Code",
    "Phase",
    "Task (FR)",
    "Task (EN)",
    "Tier",
    "Today's minimum preparer",
    "Today's minimum reviewer",
    "Partner sign-off today",
    "Your minimum preparer",
    "Your minimum reviewer",
    "Partner sign-off required (Yes/No)",
    "Comment",
  ],
};

const PHASE_ORDER = ["acceptance", "planning", "execution", "conclusion"];

/** The 117 tasks of the default index, in phase order then index order. */
export function matrixTasks() {
  return DEFAULT_FILE_INDEX.map((entry, index) => ({ entry, index, phase: phaseOfTask(entry.section, entry.code) })).sort(
    (a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || a.index - b.index,
  );
}

export function phaseLabel(phase: string, locale: MatrixLocale): string {
  return PHASE_LABELS[phase]?.[locale] ?? phase;
}

function yesNo(value: boolean, locale: MatrixLocale): string {
  return value ? (locale === "fr" ? "Oui" : "Yes") : locale === "fr" ? "Non" : "No";
}

/** Build the matrix workbook with the firm's current values. */
export async function buildSignoffMatrix(
  policy: SignoffPolicy,
  rules: ReadonlyMap<string, TaskRule>,
  locale: MatrixLocale,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditISA";

  const roles = wb.addWorksheet(ROLES_SHEET);
  roles.columns = [
    { header: locale === "fr" ? "Rang" : "Rank", width: 8 },
    { header: locale === "fr" ? "Clé" : "Key", width: 18 },
    { header: "FR", width: 20 },
    { header: "EN", width: 20 },
  ];
  TEAM_LADDER.forEach((role, i) => {
    roles.addRow([i + 1, role, MATRIX_ROLE_LABELS[role].fr, MATRIX_ROLE_LABELS[role].en]);
  });
  roles.getRow(1).font = { bold: true };
  roles.addRow([]);
  roles.addRow([
    "",
    locale === "fr"
      ? "Une cellule vide en colonnes I, J ou K applique la règle par défaut du cabinet. K accepte Oui/Non (ou Yes/No)."
      : "A blank cell in columns I, J or K applies the firm default. K accepts Yes/No (or Oui/Non).",
  ]);

  const ws = wb.addWorksheet(MATRIX_SHEET);
  ws.addRow(HEADERS[locale]);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const widths = [9, 14, 48, 48, 11, 16, 16, 14, 16, 16, 16, 30];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  const roleList = `"${TEAM_LADDER.map((r) => MATRIX_ROLE_LABELS[r][locale]).join(",")}"`;
  const ynList = locale === "fr" ? '"Oui,Non"' : '"Yes,No"';
  for (const { entry, phase } of matrixTasks()) {
    const rule = rules.get(entry.code);
    const effective = effectiveTaskRule(policy, rules, entry.code);
    const row = ws.addRow([
      entry.code,
      phaseLabel(phase, locale),
      entry.titleFr,
      entry.titleEn,
      TIER_LABELS[entry.tier ?? "standard"][locale],
      MATRIX_ROLE_LABELS[effective.minPreparer][locale],
      MATRIX_ROLE_LABELS[effective.minReviewer][locale],
      yesNo(effective.partnerRequired, locale),
      rule?.minPreparer ? MATRIX_ROLE_LABELS[rule.minPreparer][locale] : "",
      rule?.minReviewer ? MATRIX_ROLE_LABELS[rule.minReviewer][locale] : "",
      rule?.partnerRequired === null || rule?.partnerRequired === undefined ? "" : yesNo(rule.partnerRequired, locale),
      "",
    ]);
    for (const col of [9, 10]) {
      row.getCell(col).dataValidation = { type: "list", allowBlank: true, formulae: [roleList] };
    }
    row.getCell(11).dataValidation = { type: "list", allowBlank: true, formulae: [ynList] };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* --------------------------------- import --------------------------------- */

function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[\s_-]+/g, " ")
    .trim()
    .toLowerCase();
}

const ROLE_LOOKUP = new Map<string, LadderRole>();
for (const role of TEAM_LADDER) {
  for (const label of [role, MATRIX_ROLE_LABELS[role].fr, MATRIX_ROLE_LABELS[role].en, ...LONG_LABELS[role]]) {
    ROLE_LOOKUP.set(normalise(label), role);
  }
}

/** A ladder role from a key or its FR/EN label; null for a blank cell; undefined if unknown. */
export function parseMatrixRole(text: string): LadderRole | null | undefined {
  if (text.trim() === "") return null;
  return ROLE_LOOKUP.get(normalise(text));
}

/** Oui/Non (Yes/No, true/false, 1/0); null for a blank cell; undefined if unknown. */
export function parseMatrixYesNo(text: string): boolean | null | undefined {
  const v = normalise(text);
  if (v === "") return null;
  if (["oui", "yes", "o", "y", "true", "vrai", "1"].includes(v)) return true;
  if (["non", "no", "n", "false", "faux", "0"].includes(v)) return false;
  return undefined;
}

/** The text a cell shows, whatever exceljs stored (rich text, formula result, number). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((r) => r.text).join("");
    if ("result" in value && value.result !== undefined && value.result !== null) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value && typeof value.text === "string") return value.text;
  }
  return "";
}

export interface MatrixRowError {
  /** the worksheet row number, as Excel shows it */
  row: number;
  message: string;
}

export interface MatrixParseResult {
  rules: TaskRuleInput[];
  errors: MatrixRowError[];
}

const ERR = {
  noSheet: { fr: "Le classeur ne contient pas de feuille « Tasks ».", en: 'The workbook has no "Tasks" sheet.' },
  unreadable: { fr: "Le fichier n'est pas un classeur Excel lisible (.xlsx).", en: "The file is not a readable Excel workbook (.xlsx)." },
  unknownCode: { fr: "code de tâche inconnu « {v} » (colonne A)", en: 'unknown task code "{v}" (column A)' },
  duplicate: { fr: "la tâche {v} apparaît plusieurs fois", en: "task {v} appears more than once" },
  badRole: { fr: "rôle inconnu « {v} » en colonne {c}", en: 'unknown role "{v}" in column {c}' },
  badYesNo: { fr: "valeur « {v} » en colonne K : attendu Oui ou Non", en: 'value "{v}" in column K: expected Yes or No' },
  empty: { fr: "aucune tâche trouvée dans la feuille « Tasks »", en: 'no task found on the "Tasks" sheet' },
} as const;

function msg(key: keyof typeof ERR, locale: MatrixLocale, v = "", c = ""): string {
  return ERR[key][locale].replace("{v}", v).replace("{c}", c);
}

/**
 * Read a completed matrix. Every row is validated; the result carries the
 * rules to save (columns I-K only) and every row's errors. The caller saves
 * nothing when there is any error.
 */
export async function parseSignoffMatrix(content: ArrayBuffer | Buffer, locale: MatrixLocale): Promise<MatrixParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(content as ArrayBuffer);
  } catch {
    return { rules: [], errors: [{ row: 0, message: msg("unreadable", locale) }] };
  }
  const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === MATRIX_SHEET.toLowerCase());
  if (!ws) return { rules: [], errors: [{ row: 0, message: msg("noSheet", locale) }] };

  const known = new Set(DEFAULT_FILE_INDEX.map((e) => e.code));
  const seen = new Set<string>();
  const rules: TaskRuleInput[] = [];
  const errors: MatrixRowError[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // the header, whatever its language
    const code = cellText(row.getCell(1).value).trim();
    const prep = cellText(row.getCell(9).value).trim();
    const rev = cellText(row.getCell(10).value).trim();
    const partner = cellText(row.getCell(11).value).trim();
    if (code === "" && prep === "" && rev === "" && partner === "") return;
    const problems: string[] = [];
    if (!known.has(code)) problems.push(msg("unknownCode", locale, code));
    else if (seen.has(code)) problems.push(msg("duplicate", locale, code));
    seen.add(code);
    const minPreparer = parseMatrixRole(prep);
    if (minPreparer === undefined) problems.push(msg("badRole", locale, prep, "I"));
    const minReviewer = parseMatrixRole(rev);
    if (minReviewer === undefined) problems.push(msg("badRole", locale, rev, "J"));
    const partnerRequired = parseMatrixYesNo(partner);
    if (partnerRequired === undefined) problems.push(msg("badYesNo", locale, partner));
    if (problems.length > 0) {
      errors.push({ row: rowNumber, message: problems.join(" ; ") });
      return;
    }
    rules.push({
      code,
      minPreparer: minPreparer ?? null,
      minReviewer: minReviewer ?? null,
      partnerRequired: partnerRequired ?? null,
    });
  });
  if (rules.length === 0 && errors.length === 0) errors.push({ row: 0, message: msg("empty", locale) });
  return { rules, errors };
}
