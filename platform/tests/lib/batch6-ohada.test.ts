import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// lib/working-papers reaches next-auth through lib/tenant; nothing here signs in
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import { FIRST_REPLY_DAYS } from "@/lib/alerte";
import { DEFAULT_FILE_INDEX, itemsForComplexity, shortTitle, tierOf } from "@/lib/file-index";
import {
  LEAD_INDEX_BY_CODE,
  SUB_INDEX_BY_CODE,
  leadIndexFor,
  leadScheduleAlerts,
  subIndexFor,
  subIndexLabel,
} from "@/lib/lead-classes";
import {
  LEGAL_FORMS,
  hasUnresolvedLegalFormToken,
  isLegalForm,
  legalFormLabel,
  organName,
  resolveLegalFormPaper,
  resolveLegalFormText,
  taskAppliesToForm,
  type LegalForm,
} from "@/lib/legal-forms";
import { PERFORMANCE_PCT_RANGE, TRIVIAL_PCT_RANGE } from "@/lib/materiality-model";
import { CONCLUSION_PAPERS } from "@/lib/papers/conclusion";
import { FINANCIAL_STATEMENTS_PAPER } from "@/lib/papers/financial-statements";
import { JOURNAL_ENTRIES_PAPER } from "@/lib/papers/journal-entries";
import { ART_525_HEADCOUNT_THRESHOLD, STATUTORY_525_PAPER, personsFromHeadcount } from "@/lib/papers/statutory-525";
import { STRATEGY_PAPERS } from "@/lib/papers/strategy";
import { paperKeys, requiredKeys, type PaperDef, type PaperItem, type PaperProc } from "@/lib/papers/types";
import { PROGRAM_LIBRARY } from "@/lib/program-library";
import { opinionParagraph } from "@/lib/report";
import { hasUnresolvedToken, isaRef, resolvePaper } from "@/lib/standards-edition";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

// The firm's decisions of 2026-10-27, OHADA/ISA batch (F032–F033, F047–F060):
// the ISA 240 ¶32 sub-paragraphs on the journal-entry paper, one materiality
// vocabulary, E4.36 core, the AUSCGIE articles on the statutory papers and the
// legal-form resolver that names each form's organs, the report's art. 710
// certification formula, the alerte's one-month first reply, and the lead
// taxonomy corrections (490, 292/295, 499, class 20).

const procs = (def: PaperDef): PaperProc[] => (def.sections ?? []).flatMap((s) => (s.kind === "proc" ? s.procs : []));
const items = (def: PaperDef): PaperItem[] => (def.sections ?? []).flatMap((s) => (s.kind === "yn" ? s.items : []));
const proc = (def: PaperDef, key: string): PaperProc => {
  const p = procs(def).find((x) => x.key === key);
  if (!p) throw new Error(`no procedure ${key}`);
  return p;
};
const text = (def: PaperDef): string => JSON.stringify(def);
/** the paper as an engagement of that form reads it, under the current edition */
const forForm = (code: string, form: LegalForm): PaperDef => resolveLegalFormPaper(resolvePaper(CONCLUSION_PAPERS[code], "current"), form);

/* ------------------------------------------------------------------ F032 --- */

describe("F032 — ISA 240 ¶32 on the journal-entry paper", () => {
  it("keys each required procedure to its sub-paragraph of ¶32", () => {
    expect(isaRef("current", "ISA240.jeTesting")).toBe("ISA 240 ¶32");
    expect(isaRef("current", "ISA240.jeInquiry")).toBe("ISA 240 ¶32(a)(i)");
    expect(isaRef("current", "ISA240.jePeriodEnd")).toBe("ISA 240 ¶32(a)(ii)");
    expect(isaRef("current", "ISA240.jeThroughout")).toBe("ISA 240 ¶32(a)(iii)");
    expect(isaRef("current", "ISA240.jeEstimates")).toBe("ISA 240 ¶32(b)");
    expect(isaRef("current", "ISA240.unusual")).toBe("ISA 240 ¶32(c)");
    expect(isaRef("current", "ISA240.std.E31")).toBe("ISA 240 ¶31–33");
    expect(isaRef("current", "ISA240.jeInquiry", "fr")).toBe("ISA 240 ¶32 a) i)");
    expect(isaRef("revised_2026", "ISA240.jeThroughout")).toBe("ISA 240 (Revised) ¶32(a)(iii)");
  });

  it("cites them on the E3.1 procedures and leaves no token unresolved", () => {
    const e31 = resolvePaper(JOURNAL_ENTRIES_PAPER, "current");
    expect(e31.std).toMatch(/^ISA 240 ¶31–33 · ISA 240 ¶29\(c\)/);
    expect(proc(e31, "inquiry").srcEn).toContain("ISA 240 ¶32(a)(i)");
    expect(proc(e31, "period_end").srcEn).toContain("ISA 240 ¶32(a)(ii)");
    expect(proc(e31, "throughout").srcEn).toContain("ISA 240 ¶32(a)(iii)");
    expect(proc(e31, "throughout").srcFr).toContain("ISA 240 ¶32 a) iii)");
    expect(proc(e31, "estimates").srcEn).toContain("ISA 240 ¶32(b)");
    expect(proc(e31, "unusual").srcEn).toContain("ISA 240 ¶32(c)");
    expect(proc(e31, "approval").srcEn).toContain("ISA 240 ¶33");
    expect(e31.reqEn!.join(" ")).toContain("tested in every case (ISA 240 ¶32(a)(ii))");
    expect(e31.reqEn!.join(" ")).toContain("conclusion recorded (ISA 240 ¶32(a)(iii)");
    expect(hasUnresolvedToken(text(e31))).toBe(false);
    // nothing on the paper still points at ¶33 for the required procedures
    expect(text(e31)).not.toMatch(/¶33\([abc]\)/);
  });

  it("S5.4 reads the 'throughout' decision under ¶32(a)(iii)", () => {
    const s54 = resolvePaper(STRATEGY_PAPERS["S5.4"], "current");
    expect(s54.reqEn!.join(" ")).toContain("testing throughout the period is a decision to record (ISA 240 ¶32(a)(iii))");
    expect(s54.reqFr!.join(" ")).toContain("(ISA 240 ¶32 a) iii))");
    expect(text(s54)).not.toContain("¶32(a)(ii))\".");
    expect(hasUnresolvedToken(text(s54))).toBe(false);
  });
});

/* ------------------------------------------------------------------ F033 --- */

describe("F033 — one materiality vocabulary", () => {
  it("narrows the clearly trivial range to 3–5% and keeps performance materiality at 60–85%", () => {
    expect(TRIVIAL_PCT_RANGE).toEqual({ min: 3, max: 5, default: 5 });
    expect(PERFORMANCE_PCT_RANGE).toEqual({ min: 60, max: 85, default: 75 });
  });

  it("names the three thresholds the same way everywhere in the messages", () => {
    const m = en.planning.materiality;
    expect(m.overall).toBe("Overall materiality");
    expect(m.performance).toBe("Performance materiality");
    expect(m.trivial).toBe("Clearly trivial threshold (SAD nominal)");
    expect(m.trivialPct).toContain("3–5");
    const mf = fr.planning.materiality;
    expect(mf.overall).toBe("Seuil de signification global");
    expect(mf.performance).toBe("Seuil de travail");
    expect(mf.trivial).toBe("Seuil des anomalies manifestement négligeables (SAD nominal)");
    // the banned words: TE / tolerable error for performance materiality, PM for it
    const all = JSON.stringify(en) + JSON.stringify(fr);
    expect(all).not.toMatch(/tolerable error/i);
    expect(all).not.toMatch(/erreur tolérable/i);
    expect(all).not.toMatch(/\bTE\b/);
    expect(all).not.toMatch(/\(PM − TE\)|SS − ET/);
    expect(en.planning.errors["specific-above-te"]).toContain("performance materiality");
    expect(fr.planning.errors["performance-justification-required"]).toContain("seuil de travail");
  });

  it("writes the P6.1 paper and the file index in that vocabulary", () => {
    const p61 = text(STRATEGY_PAPERS["P6.1"]);
    expect(p61).not.toMatch(/\bTE\b|\bPM\b|tolerable/);
    expect(p61).toContain("3–5% of overall materiality");
    expect(p61).toContain("seuil des anomalies manifestement négligeables à 3–5 % du seuil de signification global");
    const entry = DEFAULT_FILE_INDEX.find((e) => e.code === "P6.1")!;
    expect(entry.titleEn).not.toMatch(/\bTE\b|\bPM\b/);
    expect(shortTitle("P6.1", "fr", "")).toBe("Seuil de signification (ISA 320)");
  });
});

/* ------------------------------------------------------------ F047 / F048 --- */

describe("F047 — the TFT tie-out on every file", () => {
  it("tiers E4.36 core so the simplest file gets it", () => {
    const entry = DEFAULT_FILE_INDEX.find((e) => e.code === "E4.36")!;
    expect(tierOf(entry)).toBe("core");
    expect(itemsForComplexity("very_simple").map((e) => e.code)).toContain("E4.36");
  });

  it("E6.10 cross-refers E4.36 and agrees the DSF to the definitive statements", () => {
    const tft = proc(FINANCIAL_STATEMENTS_PAPER, "tft");
    expect(tft.en).toContain("E4.36");
    expect(tft.fr).toContain("E4.36");
    const dsf = proc(FINANCIAL_STATEMENTS_PAPER, "dsf");
    expect(dsf.en).toMatch(/DSF filed .* definitive financial statements .* reconcile the fiscal result/);
    expect(dsf.fr).toContain("résultat fiscal du résultat comptable");
    const keys = items(FINANCIAL_STATEMENTS_PAPER).map((i) => i.key);
    expect(keys).toContain("tft_tied");
    expect(keys).toContain("dsf_agreed");
  });

  it("ships the migration that adds E4.36 and marks C5.7 conditional on a SARL or a GIE", () => {
    const sql = readFileSync("migrations/20261104000002_e436_core_c57_conditional.sql", "utf8");
    expect(sql).toMatch(/^-- Up Migration\s*$/m);
    expect(sql).toMatch(/^-- Down Migration\s*$/m);
    expect(sql).toContain("'E4.36'");
    expect(sql).toContain("'task_added'");
    expect(sql).toContain("c.legal_form IN ('SARL', 'GIE')");
    expect(sql).toContain("SET conditional = true");
    // the down never deletes a row that carries work
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM document d/);
  });
});

describe("F048 — AUSCGIE, not AUDCIF, for article 710", () => {
  it("bans 'AUDCIF art. 7xx' from the papers and the program library", () => {
    const corpus = [
      text(FINANCIAL_STATEMENTS_PAPER),
      JSON.stringify(PROGRAM_LIBRARY),
      ...Object.values(CONCLUSION_PAPERS).map(text),
      text(STATUTORY_525_PAPER),
    ].join("\n");
    expect(corpus).not.toMatch(/AUDCIF art\. 7\d\d/);
    expect(text(FINANCIAL_STATEMENTS_PAPER)).toContain("AUSCGIE art. 710");
    expect(proc(FINANCIAL_STATEMENTS_PAPER, "presentation").srcFr).toContain("AUSCGIE art. 710");
    // AUDCIF art. 34 (intangibility of the opening balance sheet) stays where it was
    expect(proc(FINANCIAL_STATEMENTS_PAPER, "tie_n1").srcEn).toContain("AUDCIF art. 34");
  });
});

/* ------------------------------------------------------------------ F049 --- */

describe("F049 — the certification of article 710", () => {
  it("C5.1 drafts the art. 710 formula and the specific verifications, and cross-refers C5.2–C5.10", () => {
    const c51 = forForm("C5.1", "SA");
    expect(c51.std).toContain("AUSCGIE arts. 710–716");
    expect(proc(c51, "certification").en).toContain("Nous certifions que les états financiers annuels");
    expect(proc(c51, "certification").fr).toContain("sont réguliers et sincères et donnent une image fidèle");
    const sv = proc(c51, "specific_verifications");
    expect(sv.en).toMatch(/art\. 713/);
    expect(sv.en).toMatch(/art\. 714/);
    expect(sv.en).toMatch(/art\. 525, C5\.10/);
    expect(sv.en).toMatch(/art\. 746-2, C5\.7/);
    expect(proc(c51, "statutory").en).toContain("C5.2 to C5.10");
    expect(items(c51).map((i) => i.key)).toEqual(expect.arrayContaining(["certification_form", "specific_done"]));
    // the organs are named for the form: shareholders on an SA, members on a SARL
    expect(sv.fr).toContain("actionnaires");
    expect(proc(forForm("C5.1", "SARL"), "specific_verifications").fr).toContain("associés");
  });

  it("the report's opinion paragraph uses « Nous certifions » / « We certify »", () => {
    const u = opinionParagraph("unmodified", "ELIMELEC SA", "31 décembre 2026", "fr");
    expect(u.body).toMatch(/^Nous certifions que les états financiers annuels de ELIMELEC SA pour l'exercice clos le 31 décembre 2026 sont réguliers et sincères et donnent une image fidèle du résultat des opérations de l'exercice écoulé ainsi que de la situation financière et du patrimoine de la société à la fin de cet exercice/);
    expect(u.body).not.toContain("À notre avis");
    expect(opinionParagraph("qualified", "X", "D", "fr").body).toMatch(/^Nous certifions que, sous réserve des points décrits/);
    expect(opinionParagraph("adverse", "X", "D", "fr").body).toContain("nous certifions que les états financiers annuels de X pour l'exercice clos le D ne sont pas réguliers et sincères");
    expect(opinionParagraph("disclaimer", "X", "D", "fr").body).toContain("nous ne sommes pas en mesure de certifier");
    expect(opinionParagraph("unmodified", "X", "31 December 2026", "en").body).toMatch(/^We certify that the annual financial statements of X for the year ended 31 December 2026 are regular and sincere/);
    expect(opinionParagraph("qualified", "X", "D", "en").body).toMatch(/^We certify that, except for the matters/);
  });
});

/* ------------------------------------------------------------------ F052 --- */

describe("F052 — legal forms and the organ resolver", () => {
  it("adds the SA with an administrateur général", () => {
    expect(LEGAL_FORMS).toEqual(["SA", "SA_AG", "SARL", "SAS", "GIE", "OTHER"]);
    expect(isLegalForm("SA_AG")).toBe(true);
    expect(legalFormLabel("SA_AG", "fr")).toBe("SA (administrateur général)");
    expect(legalFormLabel("SA", "en")).toBe("SA (board of directors)");
    expect(legalFormLabel("OTHER", "fr")).toBe("Autre");
    expect(legalFormLabel("SARL", "fr")).toBe("SARL");
    const sql = readFileSync("migrations/20261104000001_legal_form_sa_ag.sql", "utf8");
    expect(sql).toContain("CHECK (legal_form IN ('SA', 'SA_AG', 'SARL', 'SAS', 'GIE', 'OTHER'))");
    expect(sql).toMatch(/^-- Down Migration\s*$/m);
  });

  it("names each form's organs", () => {
    expect(organName("SA", "board", "fr")).toBe("conseil d'administration");
    expect(organName("SA", "chair", "fr")).toContain("PCA");
    expect(organName("SA", "ceo", "fr")).toMatch(/DG.*PDG/);
    expect(organName("SA_AG", "board", "fr")).toContain("administrateur général");
    expect(organName("SARL", "ceo", "en")).toBe("gérant");
    expect(organName("SARL", "meeting", "fr")).toBe("assemblée des associés");
    expect(organName("SAS", "chair", "fr")).toBe("président");
    expect(organName("SAS", "board", "fr")).toContain("organes statutaires");
    expect(organName("GIE", "chair", "fr")).toBe("administrateur");
    expect(organName(null, "board", "en")).toBe("governing body");
    expect(resolveLegalFormText("send it to the [[lf.board]] and the [[lf.members]]", "SARL", "en")).toBe("send it to the gérant (the SARL has no board) and the members");
    // an unknown key stays visible, like the edition resolver
    expect(resolveLegalFormText("[[lf.nothing]]", "SA", "en")).toBe("[[lf.nothing]]");
  });

  it("resolves every statutory paper for every form with no token left and only keys the raw paper knows", () => {
    for (const code of ["C5.1", "C5.2", "C5.3", "C5.4", "C5.5", "C5.6", "C5.7", "C5.8", "C5.9"]) {
      const raw = CONCLUSION_PAPERS[code];
      const allowed = paperKeys(raw);
      for (const form of LEGAL_FORMS) {
        const def = forForm(code, form);
        expect(hasUnresolvedLegalFormToken(text(def)), `${code} ${form}`).toBe(false);
        expect(hasUnresolvedToken(text(def)), `${code} ${form}`).toBe(false);
        for (const key of requiredKeys(def)) expect(allowed.has(key), `${code} ${form} ${key}`).toBe(true);
      }
    }
    // the raw statutory papers do carry tokens — the resolver is doing work
    expect(hasUnresolvedLegalFormToken(text(CONCLUSION_PAPERS["C5.3"]))).toBe(true);
    // and resolution is cached per definition and form
    expect(forForm("C5.3", "SA")).toBe(forForm("C5.3", "SA"));
    expect(forForm("C5.3", "SA")).not.toBe(forForm("C5.3", "SARL"));
  });

  it("leaves C5.7 off a SARL or a GIE file and keeps it on the others", () => {
    expect(taskAppliesToForm("C5.7", "SARL")).toBe(false);
    expect(taskAppliesToForm("C5.7", "GIE")).toBe(false);
    expect(taskAppliesToForm("C5.7", "SA")).toBe(true);
    expect(taskAppliesToForm("C5.7", "SA_AG")).toBe(true);
    expect(taskAppliesToForm("C5.7", "SAS")).toBe(true);
    expect(taskAppliesToForm("C5.7", null)).toBe(true);
    expect(taskAppliesToForm("C5.3", "SARL")).toBe(true);
    expect(itemsForComplexity("complex", "SARL").map((e) => e.code)).not.toContain("C5.7");
    expect(itemsForComplexity("complex", "SA").map((e) => e.code)).toContain("C5.7");
    expect(itemsForComplexity("complex").map((e) => e.code)).toContain("C5.7");
  });
});

/* ------------------------------------------------------------------ F050 --- */

describe("F050 — C5.3 regulated agreements by legal form", () => {
  it("cites the SA, SARL and SAS articles, all to validate, and links the legal register", () => {
    const raw = CONCLUSION_PAPERS["C5.3"];
    expect(raw.std).toContain("arts. 438–448 (SA)");
    expect(raw.std).toContain("arts. 350–358 (SARL)");
    expect(raw.std).toContain("art. 853-14 (SAS)");
    expect(raw.std).toContain("arts. 450 / 356");
    expect(raw.std).toContain("à valider");
    expect(raw.tools).toContain("legal");
    expect(raw.reqEn!.join(" ")).toMatch(/ten per cent or more of the voting rights.*art\. 438/);
    expect(raw.reqEn!.join(" ")).toMatch(/ordinary course of business.*art\. 439/);
    expect(proc(raw, "register").en).toContain("/legal");
  });

  it("lists candidates, excludes ordinary-course agreements and detects forbidden ones on every form", () => {
    for (const form of LEGAL_FORMS) {
      const keys = procs(forForm("C5.3", form)).map((p) => p.key);
      expect(keys, form).toEqual(expect.arrayContaining(["candidates", "notify", "ordinary_course", "forbidden", "terms", "continuing", "register", "draft", "unauthorised"]));
    }
    expect(proc(forForm("C5.3", "SA"), "forbidden").srcEn).toContain("arts. 450 (SA) / 356 (SARL)");
  });

  it("branches the authorisation on the form: board (SA), general meeting (SA_AG), members' approval (SARL), statutes (SAS)", () => {
    const keysOf = (form: LegalForm) => procs(forForm("C5.3", form)).map((p) => p.key);
    expect(keysOf("SA")).toContain("authorisation");
    expect(keysOf("SA")).not.toContain("approval");
    expect(keysOf("SA_AG")).toContain("authorisation_ag");
    expect(keysOf("SA_AG")).not.toContain("authorisation");
    expect(keysOf("SARL")).toContain("approval");
    expect(keysOf("SARL")).not.toContain("authorisation");
    expect(keysOf("SAS")).toContain("statutes_sas");
    expect(keysOf("GIE")).not.toContain("authorisation");
    const itemKeys = (form: LegalForm) => items(forForm("C5.3", form)).map((i) => i.key);
    expect(itemKeys("SA")).toEqual(expect.arrayContaining(["authorised", "abstained"]));
    expect(itemKeys("SARL")).toContain("approved");
    expect(itemKeys("SARL")).not.toContain("authorised");
    // the organs read right on each form
    expect(proc(forForm("C5.3", "SARL"), "candidates").fr).toContain("gérants");
    expect(proc(forForm("C5.3", "SA"), "unauthorised").fr).toContain("assemblée générale des actionnaires");
    expect(proc(forForm("C5.3", "SARL"), "unauthorised").fr).toContain("assemblée des associés");
  });
});

/* ------------------------------------------------------------------ F051 --- */

describe("F051 — the alert procedure's stages and deadlines", () => {
  it("gives the first reply one month (AUSCGIE 2014 reading) and keeps the 15-day board steps", () => {
    expect(FIRST_REPLY_DAYS).toBe(30);
    expect(en.planning.legal.alerteDeadlineNote).toContain("to validate");
    expect(fr.planning.legal.alerteDeadlineNote).toContain("à valider");
    expect(fr.planning.legal.alerteDeadlineNote).toContain("un mois");
  });

  it("C5.5 numbers the stages per form, informs the court and links the alerte tool", () => {
    const raw = CONCLUSION_PAPERS["C5.5"];
    expect(raw.std).toContain("arts. 150–152");
    expect(raw.std).toContain("arts. 153–156");
    expect(raw.tools).toContain("legal");
    const req = raw.reqEn!.join(" ");
    expect(req).toMatch(/\(1\).*\(2\).*within one month.*\(3\).*\(4\).*competent court/);
    expect(req).toContain("fifteen days");
    expect(proc(raw, "stage1").en).toContain("/legal, C5.5");
    expect(proc(raw, "court").srcEn).toContain("arts. 151–152 / 154, 156");
    // the board stage exists only on an SA
    expect(procs(forForm("C5.5", "SA")).map((p) => p.key)).toContain("stage2");
    expect(procs(forForm("C5.5", "SA_AG")).map((p) => p.key)).toContain("stage2");
    expect(procs(forForm("C5.5", "SARL")).map((p) => p.key)).not.toContain("stage2");
    expect(items(forForm("C5.5", "SARL")).map((i) => i.key)).toContain("court_informed");
    expect(proc(forForm("C5.5", "SA"), "stage1").fr).toContain("président du conseil d'administration ou PDG");
    expect(proc(forForm("C5.5", "SA_AG"), "stage1").fr).toContain("administrateur général");
  });
});

/* ------------------------------------------------------- F053 – F058 --- */

describe("F053 — C5.4 article 715 report", () => {
  it("adds the items needing modification and cites art. 715 on every source", () => {
    const c54 = forForm("C5.4", "SA");
    expect(c54.std).toContain("AUSCGIE art. 715");
    const fm = proc(c54, "fs_modifications");
    expect(fm.en).toContain("C1.1");
    expect(fm.en).toContain("valuation methods");
    for (const p of procs(c54)) expect(p.srcEn, p.key).toContain("AUSCGIE art. 715");
    expect(items(c54).map((i) => i.key)).toContain("modifications");
    expect(c54.ownsFr).toContain("conseil d'administration");
    expect(forForm("C5.4", "SARL").ownsFr).toContain("gérant");
  });
});

describe("F054 — C5.6 révélation", () => {
  it("cites art. 716 and the art. 899 sanction, to validate", () => {
    const c56 = CONCLUSION_PAPERS["C5.6"];
    expect(c56.std).toContain("art. 716");
    expect(c56.std).toContain("art. 899");
    expect(c56.std).toContain("à valider");
    expect(c56.reqEn![0]).toMatch(/article 899 .*to validate/);
    expect(c56.reqFr![0]).toContain("article 899 de l'Acte (à valider)");
    expect(proc(c56, "materiality").en).toContain("article 899");
    expect(proc(c56, "materiality").srcEn).toContain("899");
  });
});

describe("F055 — C5.7 securities held by an intermediary", () => {
  it("cites arts. 746-1/746-2 and branches on the holding mode", () => {
    const c57 = forForm("C5.7", "SA");
    expect(c57.std).toContain("746-1 and 746-2");
    expect(procs(c57).map((p) => p.key)).toEqual(expect.arrayContaining(["holding_mode", "intermediary", "attest"]));
    expect(proc(c57, "intermediary").en).toContain("reconcile the total securities and the holders to the share capital");
    expect(items(c57).map((i) => i.key)).toContain("intermediary_reconciled");
    expect(en.planning.legal.heldByIntermediary).toContain("746-1");
    expect(en.planning.errors["titres-intermediary-required"]).toBeTruthy();
  });
});

describe("F056 — C5.8 loss of half the capital", () => {
  it("cites the SA and SARL articles with the four-month and second-year deadlines, form-aware", () => {
    const raw = CONCLUSION_PAPERS["C5.8"];
    expect(raw.std).toContain("arts. 664–668 (SA)");
    expect(raw.std).toContain("arts. 371–373 (SARL)");
    const req = raw.reqEn!.join(" ");
    expect(req).toContain("within the four months following the approval");
    expect(req).toContain("end of the second financial year");
    expect(req).toContain("account 101");
    const above = (form: LegalForm) => items(forForm("C5.8", form)).filter((i) => i.key === "above");
    expect(above("SA")).toHaveLength(1);
    expect(above("SA")[0].en).toContain("article 664 (SA)");
    expect(above("SA_AG")[0].en).toContain("article 664 (SA)");
    expect(above("SARL")).toHaveLength(1);
    expect(above("SARL")[0].en).toContain("article 371 (SARL)");
    expect(above("SAS")).toHaveLength(1);
    expect(above("OTHER")).toHaveLength(1);
    expect(proc(forForm("C5.8", "SARL"), "meeting").fr).toContain("assemblée des associés extraordinaire");
  });
});

describe("F057 — C5.9 joint appointment", () => {
  it("records the reason for the joint appointment and the sector regulator", () => {
    const c59 = CONCLUSION_PAPERS["C5.9"];
    expect(c59.std).toContain("art. 702");
    expect(c59.std).toContain("COBAC, CIMA");
    const facts = (c59.sections ?? []).find((s) => s.kind === "fields" && s.titleEn.startsWith("Part B"));
    expect(facts).toBeDefined();
    if (facts?.kind !== "fields") throw new Error("facts");
    const reason = facts.fields.find((f) => f.key === "joint_reason")!;
    expect(reason.kind).toBe("select");
    expect(reason.options!.map((o) => o.value)).toEqual(["public_offering", "bank", "insurer", "statutes", "other"]);
    expect(facts.fields.map((f) => f.key)).toContain("regulator");
    const reg = proc(c59, "regulator");
    expect(reg.en).toContain("COBAC");
    expect(reg.en).toContain("CIMA");
    // the evaluation follows as Part C and the outcome as Part D
    expect((c59.sections ?? []).map((s) => s.titleEn.slice(0, 6))).toEqual(["Part A", "Part B", "Part C", "Part D"]);
    expect(paperKeys(c59).has("joint_reason")).toBe(true);
  });
});

describe("F058 — C5.10 article 525", () => {
  it("states the 200-employee threshold and selects five or ten from the headcount", () => {
    expect(ART_525_HEADCOUNT_THRESHOLD).toBe(200);
    expect(STATUTORY_525_PAPER.std).toContain("Règlement n°01/2017/CM/OHADA (normes professionnelles) et ISAE 3000 par analogie");
    expect(STATUTORY_525_PAPER.std).not.toContain("ISRS 4400");
    expect(text(STATUTORY_525_PAPER)).not.toContain("ISRS");
    expect(STATUTORY_525_PAPER.reqEn![0]).toContain("exceeds two hundred employees");
    const facts = STATUTORY_525_PAPER.sections![0];
    if (facts.kind !== "fields") throw new Error("facts");
    expect(facts.fields.find((f) => f.key === "persons")!.options!.map((o) => o.en)).toEqual([
      "Five — headcount of 200 employees or fewer (à valider)",
      "Ten — headcount above 200 employees (à valider)",
    ]);
    expect(personsFromHeadcount("212 salariés au 31/12 (registre du personnel)")).toBe("ten");
    expect(personsFromHeadcount("Effectif : 1 024 personnes")).toBe("ten");
    expect(personsFromHeadcount("200 employees")).toBe("five");
    expect(personsFromHeadcount("48")).toBe("five");
    expect(personsFromHeadcount("to be confirmed")).toBeNull();
    expect(personsFromHeadcount("")).toBeNull();
  });
});

/* ------------------------------------------------------------ F059 / F060 --- */

describe("F059 — the lead taxonomy corrections", () => {
  it("sends 490 to the payables as N-3, 292/295 to K, 499 to the short-term provisions", () => {
    expect(leadIndexFor("490")).toBe("N");
    expect(leadIndexFor("4901000")).toBe("N");
    expect(subIndexFor("4901000")).toBe("N-3");
    expect(SUB_INDEX_BY_CODE["N-3"].labelEn).toBe("Impairment of supplier debit balances");
    expect(SUB_INDEX_BY_CODE["N-3"].labelFr).toBe("Dépréciations des comptes fournisseurs");
    expect(subIndexLabel(SUB_INDEX_BY_CODE["N-3"], "fr")).toBe("Dépréciations des comptes fournisseurs");
    // 491 (customers) is untouched
    expect(leadIndexFor("491")).toBe("E");
    expect(subIndexFor("4911")).toBe("E-2");
    expect(leadIndexFor("292")).toBe("K");
    expect(leadIndexFor("295")).toBe("K");
    expect(subIndexFor("2921")).toBe("K-6");
    expect(subIndexFor("2951")).toBe("K-6");
    expect(leadIndexFor("291")).toBe("L");
    expect(leadIndexFor("296")).toBe("J");
    expect(leadIndexFor("499")).toBe("P1");
    expect(subIndexFor("4991")).toBe("P1-2");
    expect(leadIndexFor("498")).toBe("G2");
  });

  it("alerts when 490 carries a balance", () => {
    const alerts = leadScheduleAlerts([
      { account: "4011000", closing: -5_000_000 },
      { account: "4901000", closing: -250_000 },
    ]);
    expect(alerts.map((a) => a.code)).toEqual(["supplier_debit_impairment"]);
    expect(alerts[0].accounts).toEqual(["4901000"]);
    expect(alerts[0].fr).toContain("fournisseurs débiteurs");
    expect(leadScheduleAlerts([{ account: "4901000", closing: 0 }, { account: "4011000", closing: -1 }])).toEqual([]);
  });
});

describe("F060 — intangible assets and the legacy class 20", () => {
  it("renames index L and sub-total L-1 and alerts when class 20 carries a balance", () => {
    expect(LEAD_INDEX_BY_CODE.L.labelEn).toBe("Intangible Assets");
    expect(LEAD_INDEX_BY_CODE.L.labelFr).toBe("Immobilisations incorporelles");
    expect(SUB_INDEX_BY_CODE["L-1"].labelEn).toBe("Legacy class 20 — non-compliant with SYSCOHADA révisé");
    expect(SUB_INDEX_BY_CODE["L-1"].labelFr).toBe("Charges immobilisées (classe 20, supprimée)");
    expect(subIndexLabel(SUB_INDEX_BY_CODE["L-1"], "en")).toBe("Legacy class 20 — non-compliant with SYSCOHADA révisé");
    expect(subIndexFor("2010000")).toBe("L-1");
    const alerts = leadScheduleAlerts([
      { account: "2010000", closing: 1_200_000 },
      { account: "2110000", closing: 8_000_000 },
    ]);
    expect(alerts.map((a) => a.code)).toEqual(["legacy_class_20"]);
    expect(alerts[0].en).toContain("removed by the SYSCOHADA révisé");
    expect(alerts[0].fr).toContain("classe a été supprimée");
    expect(leadScheduleAlerts([{ account: "2110000", closing: 8_000_000 }])).toEqual([]);
  });
});
