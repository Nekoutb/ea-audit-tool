// SAMPLE 3.3 — minimum sample sizes for tests of controls, shared by the
// sampling tool and the E1.2 test-of-controls board. Discovery sampling: the
// sizes assume no or very few exceptions in the population; exceptions found
// mean extend or stop and reassess (SAMPLE 3.6.2).
import { freqLabel } from "@/lib/control-labels";

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
  // The test of one belongs to a genuinely AUTOMATED control, where the
  // application performs the control and effective ITGCs carry it across the
  // period. An IT-dependent manual control still has a person performing it,
  // so it follows the frequency table like any other manual control; the
  // report it depends on is tested separately as IPE.
  if (controlType === "automated") {
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
  return { size: capped, rule: fr ? `Manuel, ${freqLabel(f, true).toLowerCase()} → minimum ${size}` : `Manual, ${freqLabel(f, false).toLowerCase()} → minimum ${size}` };
}

/**
 * The random selection: `size` distinct occurrence numbers from 1 to
 * `population`, ascending; a population smaller than the size yields all of
 * it. `rng` supplies the randomness: the server passes a generator derived
 * from a stored seed (seededRng), so a draw can be reproduced from its seed
 * (F061). The default is for tests and previews only.
 */
export function drawTocSample(population: number, size: number, rng: () => number = Math.random): number[] {
  const n = Math.max(0, Math.floor(population));
  const k = Math.min(Math.max(0, Math.floor(size)), n);
  if (k === 0) return [];
  // partial Fisher–Yates over 1..n: exact, unbiased, and cheap for a large population
  const picked = new Map<number, number>();
  const out: number[] = [];
  for (let i = 0; i < k; i += 1) {
    const j = i + Math.floor(rng() * (n - i));
    const vi = picked.get(i) ?? i + 1;
    const vj = picked.get(j) ?? j + 1;
    out.push(vj);
    picked.set(j, vi);
    picked.set(i, vj);
  }
  return out.sort((a, b) => a - b);
}

/**
 * A generator over [0, 1) derived from `seed` — the i-th call returns
 * `random(seed, i)`. The server passes lib/engines.ts seededRandom, which is
 * HMAC-based and stays out of this client-safe module.
 */
export function seededRng(seed: string, random: (seed: string, index: number) => number): () => number {
  let i = 0;
  return () => random(seed, i++);
}

/**
 * Has testing of the drawn sample started? True once any row of the E1.2 grid
 * carries a result for any attribute — the first item tested (F061): from then
 * on a redraw is a manager-rank decision.
 */
export function tocTestingStarted(grid: { rows?: { results?: Record<string, string> }[] } | null | undefined): boolean {
  if (!grid || !Array.isArray(grid.rows)) return false;
  return grid.rows.some((r) => Object.values(r?.results ?? {}).some((v) => typeof v === "string" && v !== ""));
}

/** The size a 25-item plan extends to after a single deviation. */
export const TOC_EXTENDED_SIZE = 60;

/**
 * `rely` — the plan is clean and the planned reliance stands.
 * `extend` — one deviation on the 25-item plan. Extend to 60 in total, then
 *   re-evaluate on the 60 rule. Extending is a decision recorded with the
 *   exception once its cause is known (SAMPLE 3.6.2), never a re-draw until
 *   the count fits.
 * `high` / `moderate` — the 60-item outcomes. Moderate keeps reliance but
 *   reduces the assurance taken from the control in S3.1.
 * `none` — do not rely. Revise S3.1 and extend the substantive response.
 */
export type TocReliance = "high" | "moderate" | "rely" | "extend" | "none";

/**
 * Deviation evaluation for the SAMPLE 3.3 plans. `plan` is the minimum from
 * `tocSuggested`; `tested` is the items actually tested, which exceeds the plan
 * once a test has been extended.
 */
export function tocEvaluate(plan: number, tested: number, deviations: number): TocReliance {
  if (deviations < 0) return "none";
  // A test extended to 60, or planned at 60, is judged on the 60 rule.
  if (tested >= TOC_EXTENDED_SIZE || plan >= TOC_EXTENDED_SIZE) {
    if (deviations === 0) return "high";
    return deviations === 1 ? "moderate" : "none";
  }
  if (plan >= 25) {
    if (deviations === 0) return "rely";
    return deviations === 1 ? "extend" : "none";
  }
  // 5, 2, 1 and the occurrence plans: the hypothesis is no exceptions at all.
  return deviations === 0 ? "rely" : "none";
}
