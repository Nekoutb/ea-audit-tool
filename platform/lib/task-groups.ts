// The task strategy & hierarchy framework, aligned to the GAM-style roadmap:
// four phases (Planning & Risk Identification / Strategy & Risk Assessment /
// Execution / Conclusion & Reporting), each split into task groups, each group
// holding the detail tasks. Internal file_item codes (D3.1, E100, B5 …) stay
// the storage keys — this module is the presentation and grouping layer that
// maps them to display codes and rolls them up.

export type SectionKey = "acceptance" | "strategy" | "execution" | "conclusion";

export const SECTION_ORDER: SectionKey[] = ["acceptance", "strategy", "execution", "conclusion"];

export const SECTION_LABELS: Record<SectionKey, { en: string; fr: string }> = {
  acceptance: { en: "Planning & Risk Identification", fr: "Planification & identification des risques" },
  strategy: { en: "Strategy & Risk Assessment", fr: "Stratégie & évaluation des risques" },
  execution: { en: "Execution", fr: "Exécution" },
  conclusion: { en: "Conclusion & Reporting", fr: "Conclusion & rapports" },
};

/** The quality gate each phase closes against. */
export const SECTION_GATE: Record<SectionKey, string> = {
  acceptance: "G1",
  strategy: "G2",
  execution: "G3 · G4",
  conclusion: "G4 · G5 · G6",
};

export interface TaskGroupDef {
  /** URL slug + stable id, e.g. "p1". */
  id: string;
  /** Display code, e.g. "P1". */
  code: string;
  section: SectionKey;
  titleEn: string;
  titleFr: string;
  /** Internal file_item codes in display order. */
  members: string[];
}

export const TASK_GROUPS: TaskGroupDef[] = [
  // Five to six grouped tasks per phase — the console's flyout list, mirroring
  // the roadmap boxes. Members stay in the order the work is performed; every
  // internal code lives in exactly one group. Internal codes remain the
  // storage keys throughout.

  // ---- Planning & Risk Identification ----
  { id: "p1", code: "P1", section: "acceptance", titleEn: "Acceptance & Continuance", titleFr: "Acceptation & maintien", members: ["D3.1", "D3.4", "D3.3", "D3.5", "D3.6"] },
  { id: "p2", code: "P2", section: "acceptance", titleEn: "Independence & Team", titleFr: "Indépendance & équipe", members: ["D3.2", "D6.1"] },
  { id: "p3", code: "P3", section: "acceptance", titleEn: "Understand the Business", titleFr: "Comprendre l'activité", members: ["D4.2", "D4.3"] },
  { id: "p4", code: "P4", section: "acceptance", titleEn: "Entity-Level Controls & IT", titleFr: "Contrôles de l'entité & informatique", members: ["D4.4", "D4.5", "D4.6"] },
  { id: "p5", code: "P5", section: "acceptance", titleEn: "Fraud Risks & Team Discussion", titleFr: "Risques de fraude & discussion d'équipe", members: ["D5.4", "D7.1"] },
  { id: "p6", code: "P6", section: "acceptance", titleEn: "Materiality & Scope", titleFr: "Seuil de signification & périmètre", members: ["D5.1", "D5.8"] },

  // ---- Strategy & Risk Assessment ----
  { id: "s1", code: "S1", section: "strategy", titleEn: "SCOTs, Flows & Walkthroughs", titleFr: "SCOT, flux & cheminements", members: ["D8.1", "D8.2", "D8.3", "D8.4"] },
  { id: "s2", code: "S2", section: "strategy", titleEn: "Controls Strategy", titleFr: "Stratégie de contrôles", members: ["D8.5", "D8.6"] },
  { id: "s3", code: "S3", section: "strategy", titleEn: "Combined Risk Assessment", titleFr: "Évaluation combinée des risques", members: ["D7.2", "D5.2", "D5.5", "D5.6", "D5.7"] },
  { id: "s4", code: "S4", section: "strategy", titleEn: "Use of Others' Work", titleFr: "Travaux de tiers", members: ["D4.7", "D4.8", "D4.9"] },
  { id: "s5", code: "S5", section: "strategy", titleEn: "Audit Strategies Memorandum", titleFr: "Mémorandum de stratégie d'audit", members: ["D1", "D4.1"] },

  // ---- Execution ----
  { id: "e1", code: "E1", section: "execution", titleEn: "Tests of Controls & Updates", titleFr: "Tests de contrôles & mises à jour", members: ["E500", "E510", "E520"] },
  { id: "e2", code: "E2", section: "execution", titleEn: "Journal Entries & Fraud", titleFr: "Écritures comptables & fraude", members: ["E350"] },
  { id: "e3", code: "E3", section: "execution", titleEn: "Transaction Cycles", titleFr: "Cycles de transactions", members: ["E100", "E110", "E120"] },
  { id: "e4", code: "E4", section: "execution", titleEn: "Accounts", titleFr: "Comptes", members: ["E130", "E140", "E150", "E160", "E170"] },
  { id: "e5", code: "E5", section: "execution", titleEn: "General Procedures", titleFr: "Procédures générales", members: ["E180", "E190", "E200", "E210", "E220", "E230", "E270", "E280", "E600", "E610", "E620", "E630", "E700"] },
  { id: "e6", code: "E6", section: "execution", titleEn: "Standards Responses & Reassessment", titleFr: "Réponses normatives & réévaluation", members: ["E310", "E320", "E330", "E360", "E370", "E380", "E390", "E300"] },

  // ---- Conclusion & Reporting ----
  { id: "c1", code: "C1", section: "conclusion", titleEn: "Summary of Audit Differences", titleFr: "Récapitulatif des écarts d'audit", members: ["B5", "B4", "B3"] },
  { id: "c2", code: "C2", section: "conclusion", titleEn: "Final Financial Statement Review", titleFr: "Revue finale des états financiers", members: ["A1", "B7"] },
  { id: "c3", code: "C3", section: "conclusion", titleEn: "Representations", titleFr: "Déclarations", members: ["B8", "B9"] },
  { id: "c4", code: "C4", section: "conclusion", titleEn: "Review & Approval", titleFr: "Revue & approbation", members: ["B1", "B2", "B6"] },
  { id: "c5", code: "C5", section: "conclusion", titleEn: "Client Communications & Statutory Reports", titleFr: "Communications client & rapports légaux", members: ["C1", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"] },
  { id: "c6", code: "C6", section: "conclusion", titleEn: "Documentation & Archive", titleFr: "Documentation & archivage", members: ["B10", "B11"] },
];

export const GROUP_BY_ID: Record<string, TaskGroupDef> = Object.fromEntries(
  TASK_GROUPS.map((g) => [g.id, g]),
);

/** internal code → its group (built once). */
const GROUP_OF: Record<string, TaskGroupDef> = {};
/** internal code → display code (e.g. D4.2 → P3.1). */
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

/** Display code for an internal code; falls back to the internal code. */
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
