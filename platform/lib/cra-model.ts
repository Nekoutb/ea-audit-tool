// The Combined Risk Assessment model, pure and client-safe: inherent risk and
// control risk are assessed separately per relevant assertion (ISA 315
// (Revised 2019) ¶34) and combine into one of four levels that calibrate the
// substantive response (ISA 330 ¶7). A significant risk never adds a fifth
// level — it overlays special audit considerations on the level reached.

export type CraIr = "lower" | "higher";
export type CraCr = "rely" | "not_rely";
export type CraLevel = "minimal" | "low" | "moderate" | "high";

/** Sampling-tool vocabulary: the level plus the significant-risk overlay. */
export type CraTod = "minimal" | "low" | "low_sr" | "moderate" | "high" | "high_sr";

/** The IR × CR matrix. Rows: lower/higher inherent risk. Columns: rely/not rely. */
export function craOf(ir: CraIr, cr: CraCr): CraLevel {
  if (ir === "lower") return cr === "rely" ? "minimal" : "moderate";
  return cr === "rely" ? "low" : "high";
}

/**
 * Sampling-tool value with the significant-risk overlay. A significant risk
 * sits at the top of the higher-IR range, so it lands on low (rely) or high
 * (not rely); if the recorded assessments disagree we stay conservative.
 */
export function toTod(level: CraLevel, significant: boolean): CraTod {
  if (!significant) return level;
  if (level === "minimal" || level === "low") return "low_sr";
  return "high_sr";
}

/** Severity order, used to roll a set of assertion cells up to one account value. */
const TOD_RANK: Record<CraTod, number> = {
  minimal: 0,
  low: 1,
  low_sr: 2,
  moderate: 3,
  high: 4,
  high_sr: 5,
};

export function worstTod(values: CraTod[]): CraTod | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => (TOD_RANK[b] > TOD_RANK[a] ? b : a));
}

export function craLevelLabel(level: CraLevel, locale: "en" | "fr"): string {
  const en: Record<CraLevel, string> = { minimal: "Minimal", low: "Low", moderate: "Moderate", high: "High" };
  const fr: Record<CraLevel, string> = { minimal: "Minimal", low: "Faible", moderate: "Modéré", high: "Élevé" };
  return locale === "fr" ? fr[level] : en[level];
}

export function todLabel(v: CraTod, locale: "en" | "fr"): string {
  const base = craLevelLabel(v.replace("_sr", "") as CraLevel, locale);
  return v.endsWith("_sr") ? `${base} +SR` : base;
}

/** Chip tone per level, shared by the matrix, S5.5 and the E4 header. */
export function craTone(level: CraLevel): "good" | "warn" | "rose" | "muted" {
  if (level === "minimal") return "good";
  if (level === "low") return "good";
  if (level === "moderate") return "warn";
  return "rose";
}

/**
 * Key-item testing threshold guidance (fraction of tolerable error, judgmental
 * ranges): thresholds fall as the CRA rises, and liability/expense sides sit
 * tighter than asset/income because the exposure is understatement.
 */
export function thresholdSuggestion(level: CraLevel, locale: "en" | "fr"): string {
  const t: Record<CraLevel, [string, string]> = {
    minimal: ["75–100%", "25–50%"],
    low: ["50–75%", "15–25%"],
    moderate: ["25–50%", "10–15%"],
    high: ["10–25%", "5–10%"],
  };
  const [ai, le] = t[level];
  return locale === "fr"
    ? `Éléments clés — actif/produits : seuil ≈ ${ai} de l'ET · passif/charges : ≈ ${le}`
    : `Key items — assets/income: threshold ≈ ${ai} of TE · liabilities/expense: ≈ ${le}`;
}

/**
 * Timing window guidance: the allowable interim date (and so the rollforward
 * period) shrinks as the CRA rises.
 */
export function timingSuggestion(level: CraLevel, locale: "en" | "fr"): string {
  const en: Record<CraLevel, string> = {
    minimal: "Interim possible up to ~6 months before the period end, with rollforward",
    low: "Interim possible up to ~3 months before the period end, with rollforward",
    moderate: "At or near the period end (interim at most ~1 month before)",
    high: "At or near the period end (interim at most ~1 month before)",
  };
  const fr: Record<CraLevel, string> = {
    minimal: "Intercalaire possible jusqu'à ~6 mois avant la clôture, avec travaux de liaison",
    low: "Intercalaire possible jusqu'à ~3 mois avant la clôture, avec travaux de liaison",
    moderate: "À la clôture ou près de la clôture (intercalaire ≤ ~1 mois)",
    high: "À la clôture ou près de la clôture (intercalaire ≤ ~1 mois)",
  };
  return locale === "fr" ? fr[level] : en[level];
}
