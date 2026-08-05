// The task strategy & hierarchy framework (design-mockups/task-hierarchy-framework.md):
// three sections (Planning & Strategy ST / Execution E / Conclusion C), each split
// into task groups, each group holding the detail tasks. Internal file_item codes
// (D3.1, E100, B5 …) stay the storage keys — this module is the presentation and
// grouping layer that maps them to the ST/E/C display codes and rolls them up.

export type SectionKey = "strategy" | "execution" | "conclusion";

export const SECTION_ORDER: SectionKey[] = ["strategy", "execution", "conclusion"];

export const SECTION_LABELS: Record<SectionKey, { en: string; fr: string }> = {
  strategy: { en: "Planning & Strategy", fr: "Planification & Stratégie" },
  execution: { en: "Execution", fr: "Exécution" },
  conclusion: { en: "Conclusion", fr: "Conclusion" },
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
  // ---- Planning & Strategy (ST) ----
  { id: "st1", code: "ST1", section: "strategy", titleEn: "Acceptance & Continuance", titleFr: "Acceptation & Maintien", members: ["D3.1", "D6.1"] },
  { id: "st2", code: "ST2", section: "strategy", titleEn: "Strategy & Direction", titleFr: "Stratégie & Direction", members: ["D1", "D4.1", "D7.1"] },
  { id: "st3", code: "ST3", section: "strategy", titleEn: "Understanding the Entity", titleFr: "Connaissance de l'entité", members: ["D4.2", "D4.3", "D4.4", "D4.5"] },
  { id: "st4", code: "ST4", section: "strategy", titleEn: "IT & Reliance", titleFr: "Informatique & Appuis", members: ["D4.6", "D4.7", "D4.8", "D4.9"] },
  { id: "st5", code: "ST5", section: "strategy", titleEn: "Materiality & Specific Risks", titleFr: "Seuil & Risques spécifiques", members: ["D5.1", "D5.2", "D5.4", "D5.5", "D5.6", "D5.7"] },
  { id: "st6", code: "ST6", section: "strategy", titleEn: "Risk Register & Response Plan", titleFr: "Registre des risques & Réponses", members: ["D7.2"] },
  // ---- Execution (E) ----
  { id: "e1", code: "E1", section: "execution", titleEn: "Significant Transaction Classes", titleFr: "Flux de transactions significatifs", members: ["E100", "E110", "E120"] },
  { id: "e2", code: "E2", section: "execution", titleEn: "IT", titleFr: "Informatique", members: ["E500", "E510"] },
  { id: "e3", code: "E3", section: "execution", titleEn: "Accounts", titleFr: "Comptes", members: ["E130", "E140", "E150", "E160", "E170", "E180", "E190", "E200", "E210", "E220", "E230", "E270", "E280"] },
  { id: "e4", code: "E4", section: "execution", titleEn: "General", titleFr: "Général", members: ["E310", "E320", "E330", "E360", "E370", "E380", "E390"] },
  { id: "e5", code: "E5", section: "execution", titleEn: "Response Tasks", titleFr: "Tâches de réponse", members: ["E350"] },
  // ---- Conclusion (C) ----
  { id: "c1", code: "C1", section: "conclusion", titleEn: "Financial Statements & Completion", titleFr: "États financiers & Achèvement", members: ["A1", "B1", "B6", "B10"] },
  { id: "c2", code: "C2", section: "conclusion", titleEn: "Misstatements & Significant Matters", titleFr: "Anomalies & Points significatifs", members: ["B5", "B4", "B3"] },
  { id: "c3", code: "C3", section: "conclusion", titleEn: "Subsequent Events & Going Concern", titleFr: "Événements postérieurs & Continuité", members: ["B7"] },
  { id: "c4", code: "C4", section: "conclusion", titleEn: "Representations & Confirmations", titleFr: "Déclarations & Confirmations", members: ["B8", "B9"] },
  { id: "c5", code: "C5", section: "conclusion", titleEn: "Quality & Governance", titleFr: "Qualité & Gouvernance", members: ["B2", "C1"] },
  { id: "c6", code: "C6", section: "conclusion", titleEn: "Legal & Statutory (OHADA)", titleFr: "Juridique & Statutaire (OHADA)", members: ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"] },
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
