// The task strategy & hierarchy framework, aligned to the GAM-style roadmap:
// four phases (Planning & Risk Identification / Strategy & Risk Assessment /
// Execution / Conclusion & Reporting), each split into task groups, each group
// holding the detail tasks. Internal file_item codes (P1.1, E4.1, C1.1 …) stay
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
  { id: "p1", code: "P1", section: "acceptance", titleEn: "Acceptance & Continuance", titleFr: "Acceptation & maintien", members: ["P1.1", "P1.2", "P1.3", "P1.4", "P1.5"] },
  { id: "p2", code: "P2", section: "acceptance", titleEn: "Independence & Team", titleFr: "Indépendance & équipe", members: ["P2.1", "P2.2", "P2.3"] },
  { id: "p3", code: "P3", section: "acceptance", titleEn: "Understand the Business", titleFr: "Comprendre l'activité", members: ["P3.1", "P3.2"] },
  { id: "p4", code: "P4", section: "acceptance", titleEn: "Entity-Level Controls & IT", titleFr: "Contrôles de l'entité & informatique", members: ["P4.1", "P4.2", "P4.3"] },
  { id: "p5", code: "P5", section: "acceptance", titleEn: "Fraud Risks & Team Discussion", titleFr: "Risques de fraude & discussion d'équipe", members: ["P5.1", "P5.2"] },
  { id: "p6", code: "P6", section: "acceptance", titleEn: "Materiality & Significant Accounts", titleFr: "Seuil de signification & comptes significatifs", members: ["P6.1", "P6.2"] },

  { id: "p7", code: "P7", section: "acceptance", titleEn: "Planning Review & Approval", titleFr: "Revue & approbation de la planification", members: ["P7.1", "P7.2"] },

  // ---- Strategy & Risk Assessment ----
  { id: "s1", code: "S1", section: "strategy", titleEn: "SCOTs, Flows & Walkthroughs", titleFr: "SCOT, flux & cheminements", members: ["S1.1", "S1.2", "S1.3", "S1.4"] },
  { id: "s2", code: "S2", section: "strategy", titleEn: "Controls Strategy", titleFr: "Stratégie de contrôles", members: ["S2.1", "S2.2"] },
  { id: "s3", code: "S3", section: "strategy", titleEn: "Combined Risk Assessment", titleFr: "Évaluation combinée des risques", members: ["S3.1"] },
  { id: "s4", code: "S4", section: "strategy", titleEn: "Specific Risk Areas", titleFr: "Zones de risque spécifiques", members: ["S4.1", "S4.2", "S4.3", "S4.4"] },
  { id: "s5", code: "S5", section: "strategy", titleEn: "Use of Others' Work", titleFr: "Travaux de tiers", members: ["S5.1", "S5.2", "S5.3"] },
  { id: "s6", code: "S6", section: "strategy", titleEn: "Audit Strategies Memorandum", titleFr: "Mémorandum de stratégie d'audit", members: ["S6.1", "S6.2"] },

  // ---- Execution ----
  { id: "e1", code: "E1", section: "execution", titleEn: "Tests of Controls & Updates", titleFr: "Tests de contrôles & mises à jour", members: ["E1.1", "E1.2", "E1.3"] },
  { id: "e2", code: "E2", section: "execution", titleEn: "Journal Entries & Fraud", titleFr: "Écritures comptables & fraude", members: ["E2.1"] },
  { id: "e4", code: "E4", section: "execution", titleEn: "Accounts", titleFr: "Comptes", members: ["E4.1", "E4.2", "E4.3", "E4.4", "E4.5", "E4.6", "E4.7", "E4.8", "E4.9", "E4.10", "E4.11", "E4.12", "E4.13", "E4.14", "E4.15", "E4.16", "E4.17", "E4.18", "E4.19", "E4.20", "E4.21", "E4.22", "E4.23", "E4.24", "E4.25", "E4.26", "E4.27", "E4.28", "E4.29", "E4.30", "E4.31", "E4.32", "E4.33", "E4.34", "E4.35", "E4.36"] },
  { id: "e5", code: "E5", section: "execution", titleEn: "General Procedures", titleFr: "Procédures générales", members: ["E5.1", "E5.2", "E5.3", "E5.4", "E5.5"] },
  { id: "e6", code: "E6", section: "execution", titleEn: "Standards Responses & Reassessment", titleFr: "Réponses normatives & réévaluation", members: ["E6.1", "E6.2", "E6.3", "E6.4", "E6.5", "E6.6", "E6.7", "E6.8"] },

  // ---- Conclusion & Reporting ----
  { id: "c1", code: "C1", section: "conclusion", titleEn: "Summary of Audit Differences", titleFr: "Récapitulatif des écarts d'audit", members: ["C1.1", "C1.2", "C1.3"] },
  { id: "c2", code: "C2", section: "conclusion", titleEn: "Final Financial Statement Review", titleFr: "Revue finale des états financiers", members: ["C2.1", "C2.2"] },
  { id: "c3", code: "C3", section: "conclusion", titleEn: "Representations", titleFr: "Déclarations", members: ["C3.1", "C3.2"] },
  { id: "c4", code: "C4", section: "conclusion", titleEn: "Review & Approval", titleFr: "Revue & approbation", members: ["C4.1", "C4.2", "C4.3"] },
  { id: "c5", code: "C5", section: "conclusion", titleEn: "Client Communications & Statutory Reports", titleFr: "Communications client & rapports légaux", members: ["C5.1", "C5.2", "C5.3", "C5.4", "C5.5", "C5.6", "C5.7", "C5.8", "C5.9"] },
  { id: "c6", code: "C6", section: "conclusion", titleEn: "Documentation & Archive", titleFr: "Documentation & archivage", members: ["C6.1", "C6.2"] },
];

export const GROUP_BY_ID: Record<string, TaskGroupDef> = Object.fromEntries(
  TASK_GROUPS.map((g) => [g.id, g]),
);

/** internal code → its group (built once). */
const GROUP_OF: Record<string, TaskGroupDef> = {};
/** internal code → display code (e.g. P3.1 → P3.1). */
const DISPLAY_CODE: Record<string, string> = {};
for (const g of TASK_GROUPS) {
  g.members.forEach((code, i) => {
    GROUP_OF[code] = g;
    DISPLAY_CODE[code] = `${g.code}.${i + 1}`;
  });
}

/** The group a task belongs to, or null for codes outside the framework. */
export function groupOfTask(code: string): TaskGroupDef | null {
  if (GROUP_OF[code]) return GROUP_OF[code];
  // The recoded scheme embeds the group in the task code (P6.2 → group P6),
  // so any code the member lists miss still resolves to its group.
  const prefix = code.split(".")[0];
  return TASK_GROUPS.find((g) => g.code === prefix) ?? null;
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
