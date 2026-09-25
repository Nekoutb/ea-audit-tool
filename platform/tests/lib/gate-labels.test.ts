import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

// Every gate key the planning (lib/gates.ts) and completion (lib/completion.ts)
// engines emit must carry a label in both locales, in one of the two maps the
// GatesPanel consults. The planning keys were renamed (p22/p52/s31) while the
// messages still said d61/d71/d72, so the panel printed raw keys (UAT B118).
const PLANNING_GATE_KEYS = [
  "d31_form_complete",
  "d31_partner_signed",
  "independence_complete",
  "independence_exceptions_disposed",
  "materiality_approved",
  "p22_partner_signed",
  "p52_partner_signed",
  "s31_partner_signed",
  "significant_risks_linked",
  "rebuttals_approved",
  "material_sections_covered",
  "tb_mapped",
];

const COMPLETION_GATE_KEYS = [
  "sections_concluded",
  "risks_concluded",
  "b5_within_materiality",
  "final_analytical_review",
  "fs_tieout_passed",
  "disclosure_checklist",
  "subsequent_events",
  "rep_letters_generated",
  "b4_cleared",
  "partner_conclusion",
];

function labelsOf(messages: typeof en): Record<string, string> {
  return {
    ...(messages.planning.gateNames as Record<string, string>),
    ...(messages.planning.conclusion.gateNames as Record<string, string>),
  };
}

describe("gate labels", () => {
  for (const [locale, messages] of [["en", en], ["fr", fr]] as const) {
    it(`every planning and completion gate key has a ${locale} label`, () => {
      const labels = labelsOf(messages as typeof en);
      for (const key of [...PLANNING_GATE_KEYS, ...COMPLETION_GATE_KEYS]) {
        expect(labels[key], `missing ${locale} label for gate ${key}`).toBeTruthy();
      }
    });
  }
});
