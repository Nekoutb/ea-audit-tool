// The design-procedures model, pure and client-safe — the same split as
// lib/cra-model.ts beside lib/cra.ts.
//
// The board needs the nature and timing option sets to render its drop-downs,
// and the validator needs them to refuse anything a drop-down could not have
// produced. Keeping them in lib/design-procedures.ts made the board import that
// module for a value rather than a type, and with it the connection pool: the
// browser bundle then tried to resolve `fs` and the production build failed,
// though a type-check saw nothing wrong because types erase and values do not.
//
// So the pieces both sides need live here, where nothing touches the database.

/**
 * The nature and timing a procedure may be designed with. The same two sets
 * bound the primary procedures on screen AND the custom ones on the way into
 * storage — a drop-down the browser constrains is not a control until the
 * server refuses the values it barred.
 */
export const NATURE_OPTIONS = [
  { value: "combined", en: "SAPs + tests of details", fr: "Analytiques + tests de détail" },
  { value: "tod_led", en: "Tests of details led", fr: "Tests de détail en priorité" },
  { value: "sap_led", en: "Analytics led, data tested", fr: "Analytiques en priorité, données testées" },
] as const;

export const TIMING_OPTIONS = [
  { value: "period_end", en: "At / near period end", fr: "À / près de la clôture" },
  { value: "interim_3", en: "Interim ≤ 3 months + rollforward", fr: "Intercalaire ≤ 3 mois + liaison" },
  { value: "interim_6", en: "Interim ≤ 6 months + rollforward", fr: "Intercalaire ≤ 6 mois + liaison" },
] as const;

export const NATURE_VALUES: string[] = NATURE_OPTIONS.map((o) => o.value);
export const TIMING_VALUES: string[] = TIMING_OPTIONS.map((o) => o.value);

/** A custom substantive procedure: everything a library procedure has, written by hand. */
export interface OspProcedure {
  id: string;
  en: string;
  fr: string;
  /** the assertions this procedure answers, a subset of C,E,A,V,P */
  assertions: string[];
  nature: string;
  timing: string;
  extent: string;
}

/** Caps on the stored `osp_list` — a design, not a document store. */
export const OSP_MAX = 20;
export const OSP_TEXT_MAX = 800;
export const OSP_EXTENT_MAX = 400;
export const OSP_ID = /^[A-Za-z0-9_-]{1,40}$/;
export const ASSERTIONS = ["C", "E", "A", "V", "P"];
