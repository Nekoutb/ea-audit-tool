// The task strategy & hierarchy framework (design-mockups/task-hierarchy-framework.md):
// three sections (Planning & Strategy ST / Execution E / Conclusion C), each split
// into task groups, each group holding the detail tasks. Internal file_item codes
// (D3.1, E100, B5 …) stay the storage keys — this module is the presentation and
// grouping layer that maps them to the ST/E/C display codes and rolls them up.

export type SectionKey = "acceptance" | "strategy" | "execution" | "conclusion";

export const SECTION_ORDER: SectionKey[] = ["acceptance", "strategy", "execution", "conclusion"];

export const SECTION_LABELS: Record<SectionKey, { en: string; fr: string }> = {
  acceptance: { en: "Acceptance", fr: "Acceptation" },
  strategy: { en: "Scope & Strategy", fr: "Cadrage & Stratégie" },
  execution: { en: "Execution", fr: "Exécution" },
  conclusion: { en: "Conclusion", fr: "Conclusion" },
};

/** The quality gate each phase closes against. */
export const SECTION_GATE: Record<SectionKey, string> = {
  acceptance: "G1",
  strategy: "G2",
  execution: "G3 · G4",
  conclusion: "G4 · G5 · G6",
};

export interface TaskGroupDef {
  /** URL slug + stable id, e.g. "st1". */
  id: string;
  /** Display code, e.g. "ST1". */
  code: string;
  section: SectionKey;
  titleEn: string;
  titleFr: string;
  /** Internal file_item codes in display order. */
  members: string[];
}

export const TASK_GROUPS: TaskGroupDef[] = [
  // Six grouped tasks per phase — the console's flyout list. Members stay in
  // the order the work is performed; every internal code lives in exactly one
  // group. Internal codes remain the storage keys throughout.

  // ---- Acceptance ----
  { id: "a1", code: "A1", section: "acceptance", titleEn: "Client background & integrity", titleFr: "Contexte client & intégrité", members: ["D3.1"] },
  { id: "a2", code: "A2", section: "acceptance", titleEn: "Resources & capability", titleFr: "Ressources & capacité", members: ["D6.1"] },
  { id: "a3", code: "A3", section: "acceptance", titleEn: "Independence & ethics", titleFr: "Indépendance & éthique", members: ["D3.2"] },
  { id: "a4", code: "A4", section: "acceptance", titleEn: "Preconditions for the audit", titleFr: "Conditions préalables à l'audit", members: ["D3.3"] },
  { id: "a5", code: "A5", section: "acceptance", titleEn: "Predecessor & opening balances", titleFr: "Prédécesseur & soldes d'ouverture", members: ["D3.4"] },
  { id: "a6", code: "A6", section: "acceptance", titleEn: "Engagement letter & quality review", titleFr: "Lettre de mission & revue qualité", members: ["D3.5", "D3.6"] },

  // ---- Scope & Strategy ----
  { id: "s1", code: "S1", section: "strategy", titleEn: "Strategy & direction", titleFr: "Stratégie & direction", members: ["D1", "D4.1", "D7.1"] },
  { id: "s2", code: "S2", section: "strategy", titleEn: "Understanding the entity", titleFr: "Connaissance de l'entité", members: ["D4.2", "D4.3"] },
  { id: "s3", code: "S3", section: "strategy", titleEn: "Internal control & IT", titleFr: "Contrôle interne & informatique", members: ["D4.4", "D4.5", "D4.6"] },
  { id: "s4", code: "S4", section: "strategy", titleEn: "Reliance on others", titleFr: "Appui sur des tiers", members: ["D4.7", "D4.8", "D4.9"] },
  { id: "s5", code: "S5", section: "strategy", titleEn: "Materiality & specific risks", titleFr: "Seuil & risques spécifiques", members: ["D5.1", "D5.2", "D5.4", "D5.5", "D5.6", "D5.7"] },
  { id: "s6", code: "S6", section: "strategy", titleEn: "Risk register & response plan", titleFr: "Registre des risques & réponses", members: ["D7.2"] },

  // ---- Execution ----
  { id: "e1", code: "E1", section: "execution", titleEn: "Transaction flows", titleFr: "Flux de transactions", members: ["E100", "E110", "E120"] },
  { id: "e2", code: "E2", section: "execution", titleEn: "IT controls", titleFr: "Contrôles informatiques", members: ["E500", "E510"] },
  { id: "e3", code: "E3", section: "execution", titleEn: "Assets & financing", titleFr: "Actifs & financement", members: ["E130", "E140", "E150", "E160", "E170"] },
  { id: "e4", code: "E4", section: "execution", titleEn: "Tax, provisions & other balances", titleFr: "Impôts, provisions & autres soldes", members: ["E180", "E190", "E200", "E210", "E220", "E230", "E270", "E280"] },
  { id: "e5", code: "E5", section: "execution", titleEn: "Fraud & management override", titleFr: "Fraude & contournement des contrôles", members: ["E350"] },
  { id: "e6", code: "E6", section: "execution", titleEn: "General procedures", titleFr: "Procédures générales", members: ["E310", "E320", "E330", "E360", "E370", "E380", "E390"] },

  // ---- Conclusion ----
  { id: "c1", code: "C1", section: "conclusion", titleEn: "Financial statements & completion", titleFr: "États financiers & achèvement", members: ["A1", "B1", "B6", "B10"] },
  { id: "c2", code: "C2", section: "conclusion", titleEn: "Misstatements & significant matters", titleFr: "Anomalies & points significatifs", members: ["B5", "B4", "B3"] },
  { id: "c3", code: "C3", section: "conclusion", titleEn: "Subsequent events & going concern", titleFr: "Événements postérieurs & continuité", members: ["B7"] },
  { id: "c4", code: "C4", section: "conclusion", titleEn: "Representations & confirmations", titleFr: "Déclarations & confirmations", members: ["B8", "B9"] },
  { id: "c5", code: "C5", section: "conclusion", titleEn: "Quality, governance & the report", titleFr: "Qualité, gouvernance & rapport", members: ["B2", "C1"] },
  { id: "c6", code: "C6", section: "conclusion", titleEn: "OHADA statutory", titleFr: "Statutaire OHADA", members: ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"] },
];

export const GROUP_BY_ID: Record<string, TaskGroupDef> = Object.fromEntries(
  TASK_GROUPS.map((g) => [g.id, g]),
);

/** internal code → its group (built once). */
const GROUP_OF: Record<string, TaskGroupDef> = {};
/** internal code → display code (e.g. D4.2 → ST3.1). */
const DISPLAY_CODE: Record<string, string> = {};
for (const g of TASK_GROUPS) {
  g.members.forEach((code, i) => {
    GROUP_OF[code] = g;
    DISPLAY_CODE[code] = `${g.code}.${i + 1}`;
  });
}

/** The group a task belongs to, or null for codes outside the framework. */
export function groupOfTask(code: string): TaskGroupDef | null {
  return GROUP_OF[code] ?? null;
}

/** ST/E/C display code for an internal code; falls back to the internal code. */
export function displayCode(code: string): string {
  return DISPLAY_CODE[code] ?? code;
}

export function groupTitle(g: TaskGroupDef, locale: "en" | "fr"): string {
  return locale === "fr" ? g.titleFr : g.titleEn;
}

export function sectionLabel(section: SectionKey, locale: "en" | "fr"): string {
  return SECTION_LABELS[section][locale];
}

/** Groups of one section, in framework order. */
export function groupsOfSection(section: SectionKey): TaskGroupDef[] {
  return TASK_GROUPS.filter((g) => g.section === section);
}
