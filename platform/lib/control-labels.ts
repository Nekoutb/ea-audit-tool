// Display labels for control and SCOT attributes. Pure and client-safe: the
// WCGW builder, the ToC board, the sampling studio and the workbook exports all
// render the same stored keys (UAT run2-B107/B108: the French UI and workbooks
// showed 'manual', 'monthly', 'prevent', 'routine').

export const CONTROL_FREQUENCIES = [
  { value: "daily", en: "Daily", fr: "Quotidien" },
  { value: "weekly", en: "Weekly", fr: "Hebdomadaire" },
  { value: "monthly", en: "Monthly", fr: "Mensuel" },
  { value: "quarterly", en: "Quarterly", fr: "Trimestriel" },
  { value: "semi_annually", en: "Semi-annually", fr: "Semestriel" },
  { value: "annually", en: "Annually", fr: "Annuel" },
] as const;

export const freqLabel = (v: string | null | undefined, fr: boolean): string => {
  const f = CONTROL_FREQUENCIES.find((x) => x.value === v);
  return f ? (fr ? f.fr : f.en) : v ?? "—";
};

export const typeShort = (t: string | null | undefined, fr: boolean): string =>
  t === "manual" ? (fr ? "Manuel" : "Manual") : t === "it_dependent" ? (fr ? "Dépendant IT" : "IT-dependent") : fr ? "Automatisé" : "Automated";

export const objectiveLabel = (o: string | null | undefined, fr: boolean): string =>
  o === "prevent" ? (fr ? "Prévention" : "Prevent") : o === "detect" ? (fr ? "Détection" : "Detect") : o ?? "—";

export const transactionTypeLabel = (t: string | null | undefined, fr: boolean): string =>
  t === "routine" ? (fr ? "Routinier" : "Routine") : t === "non_routine" ? (fr ? "Non routinier" : "Non-routine") : t === "estimation" ? "Estimation" : t ?? "—";
