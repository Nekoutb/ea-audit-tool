// SAMPLE 3.3 — minimum sample sizes for tests of controls, shared by the
// sampling tool and the E1.2 test-of-controls board. Discovery sampling: the
// sizes assume no or very few exceptions in the population; exceptions found
// mean extend or stop and reassess (SAMPLE 3.6.2).

export const normFreq = (f: string | null): string => {
  const s = (f ?? "").toLowerCase();
  if (s.includes("dail") || s.includes("jour") || s.includes("continuous") || s.includes("many")) return "daily";
  if (s.includes("week") || s.includes("hebdo")) return "weekly";
  if (s.includes("month") || s.includes("mens")) return "monthly";
  if (s.includes("quart") || s.includes("trim")) return "quarterly";
  if (s.includes("semi") || s.includes("semes")) return "semi_annually";
  if (s.includes("ann")) return "annually";
  return s;
};

/** The minimum-sample table for tests of controls (SAMPLE 3.3). */
export function tocSuggested(
  controlType: string,
  frequency: string | null,
  population: number | null,
  sole: boolean,
  fr: boolean,
): { size: number; rule: string } | { needPopulation: true } | null {
  if (controlType !== "manual") {
    return { size: 1, rule: fr ? "Contrôle automatisé — test unique (ITGC efficaces)" : "Automated/application control — test of one (ITGCs effective)" };
  }
  const f = normFreq(frequency);
  if (f === "daily") {
    if (!population || population < 1) return { needPopulation: true };
    if (population > 250) {
      return sole
        ? { size: 60, rule: fr ? "Quotidien, seul contrôle sur l'assertion → 60" : "Daily, only control on its assertion → 60" }
        : { size: 25, rule: fr ? "Quotidien, population > 250 → 25" : "Daily, population > 250 → 25" };
    }
    if (population >= 50) return { size: Math.ceil(population * 0.1), rule: fr ? "50–250 occurrences → 10 %" : "50–250 occurrences → 10%" };
    if (population >= 5) return { size: 5, rule: fr ? "< 50 occurrences → 5" : "Under 50 occurrences → 5" };
    return { size: population, rule: fr ? "< 5 occurrences → 100 %" : "Under 5 occurrences → all of them" };
  }
  const table: Record<string, number> = { weekly: 5, monthly: 2, quarterly: 2, semi_annually: 2, annually: 1 };
  const size = table[f];
  if (!size) return null;
  const capped = population && population > 0 ? Math.min(size, population) : size;
  return { size: capped, rule: fr ? `Manuel ${frequency ?? ""} → minimum ${size}` : `Manual, ${frequency ?? "?"} → minimum ${size}` };
}
