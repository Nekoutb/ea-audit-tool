// Letter generation (spec §4.3, §5.4): engagement letter (ISA 210 + OHADA
// mandate wording, co-CAC variant) and the C5.1 planning communication to TCWG.
// Letters are stored as documents (kind='letter') under the relevant file item.

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { recordActivity } from "@/lib/activity";
import { type Branding, letterheadFooter, letterheadParagraphs, loadBranding } from "@/lib/branding";
import { withTenant } from "@/lib/db";
import { DOCX_MIME } from "@/lib/documents";
import type { Locale } from "@/lib/i18n";
import { requireTenant, requireWrite } from "@/lib/tenant";
import { createHash } from "node:crypto";

export type LetterKind =
  | "engagement"
  | "planning_tcwg"
  | "rep_affirmation"
  | "rep_complementary"
  | "management_letter"
  | "tcwg_completion";

/** File-index destination per letter kind. */
const LETTER_CODES: Record<LetterKind, string> = {
  // The engagement letter is the P1.4 task (ISA 210), not P1.1 acceptance;
  // 20260925000010 moves the letters already generated under P1.1.
  engagement: "P1.4",
  planning_tcwg: "C5.1",
  rep_affirmation: "C3.1",
  rep_complementary: "C3.1",
  management_letter: "C5.1",
  tcwg_completion: "C5.1",
};

/** The engagement's reporting framework, as the letter names it. */
function frameworkLabel(raw: string | null): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "" || v === "syscohada") return "SYSCOHADA révisé (AUDCIF)";
  if (v === "ifrs") return "IFRS";
  return raw!.trim();
}

interface UncorrectedLine {
  description: string;
  amount: number;
}

interface LetterFields {
  clientName: string;
  legalForm: string;
  fiscalYear: number;
  periodEnd: string;
  coCac: boolean;
  mandateType: "statutes" | "ago" | null;
  mandateStartYear: number | null;
  /** engagement letter: the client's identity and the applicable framework */
  framework: string | null;
  address: string | null;
  registrationNumber: string | null;
  niu: string | null;
  /** management_letter only: the C5.1 points to include. */
  c1Points?: string[];
  /** rep_affirmation / tcwg_completion: the uncorrected misstatements on the SAD (ISA 450 ¶14, ¶12) */
  uncorrected?: UncorrectedLine[];
  /** rep_affirmation: the engagement-specific representations recorded on C3.1 */
  specificRepresentations?: string[];
  /** tcwg_completion: significant matters and open points from C1.2 */
  significantMatters?: string[];
  /** tcwg_completion: the team's independence position */
  independence?: { total: number; completed: number; exceptions: number; undisposed: number };
  /** planning_tcwg: what the file records at planning (ISA 260 ¶15-17, UAT run 2 B56) */
  planning?: {
    addressees: string;
    scope: string;
    materiality: { overall: number; performance: number; trivial: number } | null;
    risks: string[];
    team: { name: string; role: string }[];
  };
}

/** Close a sentence with a full stop unless it already ends in punctuation (UAT run 2 B145). */
export function endSentence(text: string): string {
  const t = text.trim();
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

function mandateYears(type: "statutes" | "ago"): number {
  // AUSCGIE art. 704: 2 fiscal years if named in the statutes/constitutive
  // meeting, 6 fiscal years if appointed by the ordinary general meeting.
  return type === "statutes" ? 2 : 6;
}

export function mandateExpiryYear(type: "statutes" | "ago", startYear: number): number {
  return startYear + mandateYears(type) - 1;
}

/** The governance report's independence paragraph, stated from the campaign's counts. */
export function independenceStatement(
  ind: { total: number; completed: number; exceptions: number; undisposed: number },
  fr: boolean,
): string {
  if (ind.total === 0) {
    return fr
      ? "Aucune confirmation d'indépendance n'a été demandée à l'équipe à la date du présent rapport."
      : "No independence confirmation has been requested from the team at the date of this report.";
  }
  const outstanding = Math.max(ind.total - ind.completed - ind.exceptions, 0);
  const parts: string[] = [];
  if (outstanding === 0) {
    parts.push(
      fr
        ? `Chaque membre de l'équipe a confirmé son indépendance par écrit : ${ind.total} confirmation(s) demandée(s), ${ind.completed} sans exception, ${ind.exceptions} avec exception déclarée.`
        : `Every team member confirmed independence in writing: ${ind.total} confirmation(s) requested, ${ind.completed} without exception, ${ind.exceptions} with an exception declared.`,
    );
  } else {
    parts.push(
      fr
        ? `${ind.total} confirmation(s) d'indépendance demandée(s) : ${ind.completed} reçue(s) sans exception, ${ind.exceptions} avec exception déclarée, ${outstanding} non encore reçue(s).`
        : `${ind.total} independence confirmation(s) requested: ${ind.completed} received without exception, ${ind.exceptions} with an exception declared, ${outstanding} not yet received.`,
    );
  }
  if (ind.exceptions > 0) {
    parts.push(
      ind.undisposed > 0
        ? fr
          ? `${ind.undisposed} exception(s) sont en attente de la décision de l'associé. Les sauvegardes appliquées aux exceptions sont consignées en P2.1.`
          : `${ind.undisposed} exception(s) await the partner's disposition. The safeguards applied to the exceptions are recorded on P2.1.`
        : fr
          ? "Les sauvegardes appliquées aux exceptions sont consignées en P2.1."
          : "The safeguards applied to the exceptions are recorded on P2.1.",
    );
  }
  return parts.join(" ");
}

function p(text: string, bold = false): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold })] });
}

async function buildLetter(
  kind: LetterKind,
  f: LetterFields,
  locale: Locale,
  branding: Branding,
): Promise<Buffer> {
  const fr = locale === "fr";
  const children: Paragraph[] = [...letterheadParagraphs(branding)];

  if (kind === "engagement") {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(fr ? "Lettre de mission" : "Engagement letter")],
      }),
      p(`${f.clientName} (${f.legalForm})`),
    );
    // ISA 210 ¶10: the client's identity, then the objective and scope, the
    // responsibilities of each party, the framework and the expected reports.
    const identity = [
      f.address ? (fr ? `Adresse : ${f.address}` : `Address: ${f.address}`) : null,
      f.registrationNumber ? `RCCM : ${f.registrationNumber}` : null,
      f.niu ? `NIU : ${f.niu}` : null,
    ].filter((x): x is string => x !== null);
    if (identity.length > 0) children.push(p(identity.join(" · ")));
    const framework = frameworkLabel(f.framework);
    children.push(
      p(
        fr
          ? `Exercice ${f.fiscalYear} — clôture au ${f.periodEnd} — référentiel comptable applicable : ${framework}.`
          : `Fiscal year ${f.fiscalYear} — period end ${f.periodEnd} — applicable financial reporting framework: ${framework}.`,
      ),
      p(fr ? "Objectif et étendue de l'audit" : "Objective and scope of the audit", true),
      p(
        fr
          ? `Notre mission a pour objectif d'exprimer une opinion sur les états financiers de l'exercice clos le ${f.periodEnd}, établis conformément au référentiel ${framework}. Nous effectuerons l'audit selon les Normes internationales d'audit (ISA) et les obligations du commissaire aux comptes prévues par l'AUSCGIE. Ces normes requièrent que nous nous conformions aux règles d'éthique, planifiions et réalisions l'audit afin d'obtenir une assurance raisonnable que les états financiers ne comportent pas d'anomalies significatives. En raison des limites inhérentes à l'audit et au contrôle interne, le risque qu'une anomalie significative ne soit pas détectée ne peut être éliminé (ISA 210 ¶10(a)).`
          : `The objective of our engagement is to express an opinion on the financial statements for the year ended ${f.periodEnd}, prepared in accordance with ${framework}. We will conduct the audit in accordance with International Standards on Auditing (ISA) and the statutory-auditor obligations of the AUSCGIE. Those standards require that we comply with ethical requirements and plan and perform the audit to obtain reasonable assurance that the financial statements are free from material misstatement. Because of the inherent limitations of an audit and of internal control, an unavoidable risk remains that some material misstatements are not detected (ISA 210 ¶10(a)).`,
      ),
      p(fr ? "Responsabilités de l'auditeur" : "The auditor's responsibilities", true),
      p(
        fr
          ? "Nous sommes responsables de la formation et de l'expression de notre opinion. Nous communiquerons aux responsables de la gouvernance les déficiences significatives du contrôle interne relevées et les autres points requis par les ISA (ISA 210 ¶10(b), ISA 260, ISA 265)."
          : "We are responsible for forming and expressing our opinion. We will communicate to those charged with governance the significant deficiencies in internal control we identify and the other matters the ISAs require (ISA 210 ¶10(b), ISA 260, ISA 265).",
      ),
      p(fr ? "Responsabilités de la direction" : "Management's responsibilities", true),
      p(
        fr
          ? `La direction est responsable de l'établissement des états financiers conformément au référentiel ${framework}, du contrôle interne qu'elle juge nécessaire pour permettre l'établissement d'états financiers exempts d'anomalies significatives, et de nous donner accès à toutes les informations pertinentes, aux informations complémentaires que nous demanderions et, sans restriction, aux personnes de l'entité (ISA 210 ¶6(b), ¶10(c)). Elle nous fournira des déclarations écrites (ISA 580).`
          : `Management is responsible for the preparation of the financial statements in accordance with ${framework}, for such internal control as it determines necessary to enable the preparation of financial statements free from material misstatement, and for providing us with access to all relevant information, any additional information we request and unrestricted access to persons within the entity (ISA 210 ¶6(b), ¶10(c)). Management will provide written representations (ISA 580).`,
      ),
      p(fr ? "Forme et contenu attendus des rapports" : "Expected form and content of the reports", true),
      p(
        fr
          ? "Nous émettrons un rapport d'audit établi selon les ISA 700 (révisée) et suivantes, ainsi que le rapport spécial et les autres rapports prévus par l'AUSCGIE. La forme et le contenu de nos rapports pourront différer selon les constatations de l'audit (ISA 210 ¶10(e))."
          : "We will issue an auditor's report prepared under ISA 700 (Revised) and the related standards, together with the special report and the other reports the AUSCGIE requires. The form and content of our reports may need to be amended in the light of our audit findings (ISA 210 ¶10(e)).",
      ),
    );
    if (f.mandateType && f.mandateStartYear) {
      const expiry = mandateExpiryYear(f.mandateType, f.mandateStartYear);
      children.push(
        p(
          fr
            ? `Mandat : ${mandateYears(f.mandateType)} exercices (art. 704 AUSCGIE), du ${f.mandateStartYear} à ${expiry}.`
            : `Mandate: ${mandateYears(f.mandateType)} fiscal years (AUSCGIE art. 704), from ${f.mandateStartYear} to ${expiry}.`,
        ),
      );
    }
    if (f.coCac) {
      children.push(
        p(
          fr
            ? "Variante co-commissariat : la mission est exercée conjointement avec l'autre commissaire aux comptes ; la répartition des travaux et la revue croisée seront documentées (art. 719)."
            : "Co-commissariat variant: the engagement is performed jointly with the co-statutory auditor; work split and cross-review will be documented (art. 719).",
          true,
        ),
      );
    }
    children.push(
      p(
        fr
          ? "Les experts et collaborateurs assistant le commissaire aux comptes seront désignés conformément à l'article 718."
          : "Experts and staff assisting the statutory auditor will be named in accordance with article 718.",
      ),
      p(fr ? "Signatures : le cabinet / le client" : "Signatures: the firm / the client"),
    );
  } else if (kind === "planning_tcwg") {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [
          new TextRun(
            fr
              ? "Communication sur la planification aux organes de gouvernance (ISA 260)"
              : "Planning communication to those charged with governance (ISA 260)",
          ),
        ],
      }),
      p(`${f.clientName} — ${fr ? "exercice clos le" : "year ended"} ${f.periodEnd}`),
    );
    // ISA 260 ¶15-17: scope and timing, significant risks, materiality, the
    // team and independence, drawn from the file (UAT run 2 B56).
    const pl = f.planning;
    if (pl?.addressees) children.push(p(`${fr ? "Destinataires" : "Addressees"} : ${pl.addressees}`));
    children.push(
      p(fr ? "Étendue et calendrier prévus de l'audit (ISA 260 ¶15)" : "Planned scope and timing of the audit (ISA 260 ¶15)", true),
      p(
        fr
          ? `Nous effectuons l'audit des états financiers de l'exercice clos le ${f.periodEnd}, établis selon le référentiel ${frameworkLabel(f.framework)}, conformément aux Normes internationales d'audit (ISA) et aux dispositions de l'AUSCGIE. L'approche est fondée sur l'évaluation des risques d'anomalies significatives.`
          : `We audit the financial statements for the year ended ${f.periodEnd}, prepared under ${frameworkLabel(f.framework)}, in accordance with International Standards on Auditing (ISA) and the AUSCGIE. The approach is based on the assessment of the risks of material misstatement.`,
      ),
    );
    if (pl?.scope) children.push(p(endSentence(pl.scope)));
    children.push(p(fr ? "Risques importants identifiés (ISA 260 ¶15)" : "Significant risks identified (ISA 260 ¶15)", true));
    if (pl && pl.risks.length > 0) children.push(...pl.risks.map((r) => p(`• ${endSentence(r)}`)));
    else children.push(p(fr ? "Aucun risque important n'est consigné au dossier à la date de la présente communication." : "No significant risk is recorded on the file at the date of this communication."));
    children.push(p(fr ? "Seuils de signification (ISA 320)" : "Materiality (ISA 320)", true));
    if (pl?.materiality) {
      children.push(
        p(
          fr
            ? `Seuil de signification pour les états financiers pris dans leur ensemble : ${fcfa(pl.materiality.overall)} FCFA. Seuil de planification : ${fcfa(pl.materiality.performance)} FCFA. Seuil en deçà duquel les anomalies sont manifestement insignifiantes : ${fcfa(pl.materiality.trivial)} FCFA.`
            : `Materiality for the financial statements as a whole: ${fcfa(pl.materiality.overall)} FCFA. Performance materiality: ${fcfa(pl.materiality.performance)} FCFA. Threshold below which misstatements are clearly trivial: ${fcfa(pl.materiality.trivial)} FCFA.`,
        ),
      );
    } else {
      children.push(p(fr ? "Les seuils de signification ne sont pas encore approuvés à la date de la présente communication." : "Materiality has not yet been approved at the date of this communication."));
    }
    children.push(p(fr ? "Équipe d'audit" : "Audit team", true));
    if (pl && pl.team.length > 0) children.push(...pl.team.map((m) => p(`• ${m.name} — ${m.role}`)));
    else children.push(p(fr ? "La composition de l'équipe n'est pas encore arrêtée." : "The team has not yet been set."));
    children.push(
      p(fr ? "Indépendance (ISA 260 ¶17)" : "Independence (ISA 260 ¶17)", true),
      p(
        fr
          ? "Le cabinet et l'équipe se conforment aux règles d'éthique applicables en matière d'indépendance. Les confirmations d'indépendance de l'équipe sont consignées en P2.1."
          : "The firm and the team comply with the applicable ethical requirements on independence. The team's independence confirmations are recorded on P2.1.",
      ),
      p(fr ? "Le commissaire aux comptes." : "The statutory auditor.", true),
    );
  } else if (kind === "rep_affirmation") {
    // OHADA layer 1: affirmation letter on the draft FS BEFORE the board
    // meeting — signed by the DG and the head of accounting (spec §7 item 9).
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(fr ? "Lettre d'affirmation (avant arrêté des comptes)" : "Affirmation letter (before the board's arrêté)")],
      }),
      p(`${f.clientName} — ${f.fiscalYear} (${f.periodEnd})`),
      // ISA 580 ¶10–11: the responsibility acknowledgements, never qualified by
      // knowledge and belief.
      p(fr ? "Responsabilités de la direction (ISA 580 ¶10–11)" : "Management's responsibilities (ISA 580 ¶10–11)", true),
      p(
        fr
          ? `Nous avons rempli nos responsabilités, telles que définies dans la lettre de mission, relatives à l'établissement des états financiers conformément au référentiel ${frameworkLabel(f.framework)} ; les états financiers donnent une image fidèle conformément à ce référentiel.`
          : `We have fulfilled our responsibilities, as set out in the terms of the audit engagement, for the preparation of the financial statements in accordance with ${frameworkLabel(f.framework)}; the financial statements give a true and fair view in accordance with that framework.`,
      ),
      p(
        fr
          ? "Nous vous avons fourni toutes les informations pertinentes et l'accès convenus dans la lettre de mission, ainsi que les informations complémentaires que vous avez demandées, et un accès sans restriction aux personnes de l'entité. Toutes les opérations ont été enregistrées et sont reflétées dans les états financiers."
          : "We have provided you with all relevant information and access as agreed in the terms of the audit engagement, the additional information you requested, and unrestricted access to persons within the entity. All transactions have been recorded and are reflected in the financial statements.",
      ),
      // Factual representations, to the best of management's knowledge.
      p(fr ? "Autres déclarations" : "Other representations", true),
      p(
        fr
          ? "Au mieux de notre connaissance : les estimations comptables et leurs hypothèses sont raisonnables (ISA 540) ; nous vous avons communiqué les résultats de notre évaluation du risque de fraude, toute fraude connue ou soupçonnée et toute allégation de fraude (ISA 240) ; tous les cas connus de non-conformité aux textes légaux et réglementaires (ISA 250) ; l'identité de toutes les parties liées et de toutes les relations et opérations avec elles, ainsi que les conventions réglementées (ISA 550) ; tous les litiges et réclamations connus ou possibles (ISA 501) ; notre appréciation de la continuité de l'exploitation et les plans d'action envisagés (ISA 570) ; et tous les événements postérieurs à la clôture qui appellent un ajustement ou une information (ISA 560)."
          : "To the best of our knowledge: the accounting estimates and their assumptions are reasonable (ISA 540); we have disclosed the results of our assessment of the risk of fraud, any known or suspected fraud and any allegation of fraud (ISA 240); all known instances of non-compliance with laws and regulations (ISA 250); the identity of all related parties and all related-party relationships and transactions, including regulated agreements (ISA 550); all known actual or possible litigation and claims (ISA 501); our assessment of the entity's ability to continue as a going concern and the plans considered (ISA 570); and all events after the reporting date that require adjustment or disclosure (ISA 560).",
      ),
    );
    for (const rep of f.specificRepresentations ?? []) children.push(p(`• ${rep}`));
    // ISA 450 ¶14: the uncorrected misstatements, listed, with management's
    // statement that they are immaterial.
    const uncorrected = f.uncorrected ?? [];
    children.push(p(fr ? "Anomalies non corrigées (ISA 450 ¶14)" : "Uncorrected misstatements (ISA 450 ¶14)", true));
    if (uncorrected.length === 0) {
      children.push(
        p(
          fr
            ? "Aucune anomalie non corrigée ne nous a été communiquée par l'auditeur."
            : "No uncorrected misstatements have been communicated to us by the auditor.",
        ),
      );
    } else {
      const total = uncorrected.reduce((s, m) => s + m.amount, 0);
      children.push(
        p(
          fr
            ? `Nous estimons que les effets des anomalies non corrigées énumérées ci-dessous, prises individuellement et en cumulé, ne sont pas significatifs au regard des états financiers pris dans leur ensemble. Récapitulatif des écarts d'audit (${uncorrected.length} ligne(s), total ${fcfa(total)} FCFA) :`
            : `We believe the effects of the uncorrected misstatements listed below are immaterial, both individually and in the aggregate, to the financial statements as a whole. Summary of audit differences (${uncorrected.length} item(s), total ${fcfa(total)} FCFA):`,
        ),
        ...uncorrected.map((m) => p(`• ${m.description} — ${fcfa(m.amount)} FCFA`)),
      );
    }
    children.push(
      p(fr ? "Signatures : Directeur Général · Chef comptable" : "Signatures: Managing Director · Head of accounting", true),
    );
  } else if (kind === "rep_complementary") {
    // OHADA layer 2: complementary letter AFTER the board arrête les comptes —
    // signed by the PCA/administrateur général and the DG.
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(fr ? "Lettre d'affirmation complémentaire (après arrêté des comptes)" : "Complementary representation letter (after the board's arrêté)")],
      }),
      p(`${f.clientName} — ${f.fiscalYear} (${f.periodEnd})`),
      p(
        fr
          ? "À la suite de l'arrêté des comptes par le conseil, nous confirmons que les déclarations de la lettre d'affirmation initiale demeurent valables et qu'aucun événement postérieur significatif n'est intervenu depuis, autre que ceux portés à votre connaissance."
          : "Following the board's approval of the accounts, we confirm the representations in the initial affirmation letter remain valid and that no significant subsequent events have occurred other than those communicated to you.",
      ),
      p(fr ? "Signatures : Président du Conseil d'Administration · Directeur Général" : "Signatures: Chairman of the Board · Managing Director", true),
    );
  } else if (kind === "tcwg_completion") {
    // ISA 260 ¶16 / ISA 450 ¶12 / ISA 265 ¶9: the completion report to those
    // charged with governance, built from the file as it stands.
    const uncorrected = f.uncorrected ?? [];
    const total = uncorrected.reduce((s, m) => s + m.amount, 0);
    const ind = f.independence ?? { total: 0, completed: 0, exceptions: 0, undisposed: 0 };
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [
          new TextRun(
            fr
              ? "Rapport aux responsables de la gouvernance — achèvement de l'audit (ISA 260/265)"
              : "Report to those charged with governance — audit completion (ISA 260/265)",
          ),
        ],
      }),
      p(`${f.clientName} — ${f.fiscalYear} (${f.periodEnd})`),
      p(fr ? "Constats significatifs (ISA 260 ¶16, C1.2)" : "Significant findings from the audit (ISA 260 ¶16, C1.2)", true),
      ...((f.significantMatters ?? []).length > 0
        ? (f.significantMatters ?? []).map((m) => p(`• ${m}`))
        : [p(fr ? "Aucun point significatif consigné en C1.2." : "No significant matter recorded on C1.2.")]),
      p(fr ? "Anomalies non corrigées (ISA 450 ¶12)" : "Uncorrected misstatements (ISA 450 ¶12)", true),
      ...(uncorrected.length === 0
        ? [p(fr ? "Aucune anomalie non corrigée." : "No uncorrected misstatements.")]
        : [
            p(
              fr
                ? `${uncorrected.length} anomalie(s) non corrigée(s), total ${fcfa(total)} FCFA. Nous demandons leur correction ; la direction considère que leur effet n'est pas significatif.`
                : `${uncorrected.length} uncorrected misstatement(s), total ${fcfa(total)} FCFA. We request that they be corrected; management considers their effect immaterial.`,
            ),
            ...uncorrected.map((m) => p(`• ${m.description} — ${fcfa(m.amount)} FCFA`)),
          ]),
      p(fr ? "Déficiences du contrôle interne (ISA 265 ¶9)" : "Deficiencies in internal control (ISA 265 ¶9)", true),
      ...((f.c1Points ?? []).length > 0
        ? (f.c1Points ?? []).map((point) => p(`• ${point}`))
        : [p(fr ? "Aucune déficience significative relevée." : "No significant deficiency identified.")]),
      p(fr ? "Indépendance (ISA 260 ¶17)" : "Independence (ISA 260 ¶17)", true),
      // The statement follows the campaign as it stands: "every member
      // confirmed" only when every requested confirmation is back (UAT run 2 B83).
      p(independenceStatement(ind, fr)),
      p(fr ? "Le commissaire aux comptes." : "The statutory auditor.", true),
    );
  } else {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(fr ? "Lettre de recommandations (ISA 265)" : "Management letter (ISA 265)")],
      }),
      p(`${f.clientName} — ${f.fiscalYear}`),
      p(
        fr
          ? "Nous portons à votre attention les déficiences du contrôle interne et points d'amélioration relevés au cours de notre audit, détaillés ci-après."
          : "We bring to your attention the internal-control deficiencies and improvement points identified during our audit, detailed below.",
      ),
      ...(f.c1Points ?? []).map((point) => p(`• ${point}`)),
    );
  }

  children.push(...letterheadFooter(branding));
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

/**
 * Generate a letter as a versioned document under its file item (engagement
 * letter → P1.4; TCWG letters → C5.1; representations → C3.1). Regenerating
 * creates a new version.
 */
export async function generateLetter(
  engagementId: string,
  kind: LetterKind,
  locale: Locale,
): Promise<string> {
  const { tenantId, userId } = await requireWrite();
  return withTenant(tenantId, async (tx) => {
    const info = await tx.query<{
      client_name: string;
      legal_form: string;
      co_cac: boolean;
      mandate_type: "statutes" | "ago" | null;
      mandate_start_year: number | null;
      fiscal_year: number;
      period_end: string;
      framework: string | null;
      address: string | null;
      registration_number: string | null;
      niu: string | null;
    }>(
      `SELECT c.name AS client_name, c.legal_form, c.co_cac, c.mandate_type,
              c.mandate_start_year, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end,
              coalesce(e.framework, c.framework) AS framework,
              c.address, c.registration_number, c.niu
         FROM engagement e JOIN client c ON c.id = e.client_id
        WHERE e.id = $1`,
      [engagementId],
    );
    const row = info.rows[0];
    if (!row) throw new Error("not-found");

    // P7.1 asks for the planning communication to be filed against it: file it
    // there when the task is on the file, else under C5.1 as before (UAT run 2 B56).
    let code = LETTER_CODES[kind];
    if (kind === "planning_tcwg") {
      const p71 = await tx.query("SELECT 1 FROM file_item WHERE engagement_id = $1 AND code = 'P7.1'", [engagementId]);
      if ((p71.rowCount ?? 0) > 0) code = "P7.1";
    }
    const item = await tx.query<{ id: string }>(
      "SELECT id FROM file_item WHERE engagement_id = $1 AND code = $2",
      [engagementId, code],
    );
    if (!item.rows[0]) throw new Error("not-found");
    const fileItemId = item.rows[0].id;

    // Management letter and the completion TCWG report pull the C5.1
    // control-deficiency points (spec §8.3).
    let c1Points: string[] | undefined;
    if (kind === "management_letter" || kind === "tcwg_completion") {
      // ISA 265 order: significant deficiencies first, then deficiencies,
      // then observations; each point names its grading and carries the
      // recommendation and management's response when recorded (UAT B21).
      const findings = await tx.query<{ title: string; detail: string | null; severity: string | null; recommendation: string | null; management_response: string | null }>(
        `SELECT title, detail, severity, recommendation, management_response FROM finding
          WHERE engagement_id = $1 AND route = 'c1'
          ORDER BY CASE severity WHEN 'significant_deficiency' THEN 0 WHEN 'deficiency' THEN 1 WHEN 'observation' THEN 2 ELSE 3 END, created_at`,
        [engagementId],
      );
      const gradeFr: Record<string, string> = { significant_deficiency: "Déficience significative", deficiency: "Déficience", observation: "Observation" };
      const gradeEn: Record<string, string> = { significant_deficiency: "Significant deficiency", deficiency: "Deficiency", observation: "Observation" };
      const gradeOf = (severity: string | null): string =>
        severity ? `[${(locale === "fr" ? gradeFr : gradeEn)[severity] ?? severity}] ` : "";
      c1Points = findings.rows.map((f) => {
        const body = f.detail ? `${f.title} — ${f.detail}` : f.title;
        const reco = f.recommendation ? ` ${locale === "fr" ? "Recommandation" : "Recommendation"} : ${endSentence(f.recommendation)}` : "";
        const resp = f.management_response ? ` ${locale === "fr" ? "Réponse de la direction" : "Management response"} : ${endSentence(f.management_response)}` : "";
        return `${gradeOf(f.severity)}${body}${reco}${resp}`;
      });
    }
    // The uncorrected misstatements on the SAD (ISA 450 ¶12, ¶14), as C1.1
    // evaluates them: non-trivial and not corrected.
    let uncorrected: UncorrectedLine[] | undefined;
    if (kind === "rep_affirmation" || kind === "tcwg_completion") {
      const rows = await tx.query<{ description: string; amount: string }>(
        `SELECT description, amount::text FROM misstatement
          WHERE engagement_id = $1 AND trivial = false AND corrected = false
          ORDER BY abs(amount) DESC, created_at`,
        [engagementId],
      );
      uncorrected = rows.rows.map((m) => ({ description: m.description, amount: Number(m.amount) }));
    }
    // The engagement-specific representations the C3.1 paper records
    // (procedure 2, "specific"), and the significant matters C1.2 collected.
    const paperAnswers = async (code: string, keys: string[]): Promise<string[]> => {
      const r = await tx.query<{ field_key: string; value: string | null }>(
        `SELECT field_key, value #>> '{}' AS value FROM form_response
          WHERE engagement_id = $1 AND code = $2 AND field_key = ANY($3)`,
        [engagementId, `wp:${code}`, keys],
      );
      return keys
        .map((k) => (r.rows.find((row) => row.field_key === k)?.value ?? "").trim())
        .filter((v) => v.length > 0);
    };
    const specificRepresentations =
      // key_findings is the auditor's own note, not a representation (UAT run 2 B153)
      kind === "rep_affirmation" ? await paperAnswers("C3.1", ["p_specific", "p_materiality"]) : undefined;
    let significantMatters: string[] | undefined;
    if (kind === "tcwg_completion") {
      // The matters raised to the C1.2 register come first, with their grading
      // and status; the C1.2 paper's own answers follow (UAT run 2 B82).
      const b4 = await tx.query<{ title: string; detail: string | null; severity: string | null; status: string; management_response: string | null }>(
        `SELECT title, detail, severity, status, management_response FROM finding
          WHERE engagement_id = $1 AND route = 'b4'
          ORDER BY created_at`,
        [engagementId],
      );
      const fr = locale === "fr";
      const sevLabel: Record<string, [string, string]> = {
        significant_deficiency: ["Déficience significative", "Significant deficiency"],
        deficiency: ["Déficience", "Deficiency"],
        observation: ["Observation", "Observation"],
      };
      const statusLabel = (s: string) =>
        s === "open" ? (fr ? "ouvert" : "open") : s === "cleared" || s === "closed" || s === "resolved" ? (fr ? "levé" : "cleared") : s;
      significantMatters = [
        ...b4.rows.map((m) => {
          const grade = m.severity ? `[${(sevLabel[m.severity] ?? [m.severity, m.severity])[fr ? 0 : 1]}] ` : "";
          const body = m.detail ? `${m.title} — ${endSentence(m.detail)}` : endSentence(m.title);
          const resp = m.management_response ? ` ${fr ? "Réponse de la direction" : "Management response"} : ${endSentence(m.management_response)}` : "";
          return `${grade}${body} (${fr ? "statut" : "status"} : ${statusLabel(m.status)})${resp}`;
        }),
        ...(await paperAnswers("C1.2", ["p_collect", "p_conclusion", "p_judgements", "p_disagreements", "key_findings"])),
      ];
    }
    let independence: LetterFields["independence"];
    if (kind === "tcwg_completion") {
      const ic = await tx.query<{ total: string; completed: string; exceptions: string; undisposed: string }>(
        `SELECT count(*)::text AS total,
                count(*) FILTER (WHERE ic.status = 'completed')::text AS completed,
                count(*) FILTER (WHERE ic.status = 'exception')::text AS exceptions,
                count(*) FILTER (WHERE ic.status = 'exception' AND ic.disposition IS NULL)::text AS undisposed
           FROM independence_confirmation ic
           JOIN independence_campaign c ON c.id = ic.campaign_id
          WHERE c.engagement_id = $1`,
        [engagementId],
      );
      const x = ic.rows[0];
      independence = { total: Number(x.total), completed: Number(x.completed), exceptions: Number(x.exceptions), undisposed: Number(x.undisposed) };
    }
    let planning: LetterFields["planning"];
    if (kind === "planning_tcwg") {
      const m = await tx.query<{ overall: string; performance: string; trivial: string }>(
        `SELECT overall::text, performance::text, trivial::text FROM materiality
          WHERE engagement_id = $1 AND status = 'approved'
          ORDER BY version_no DESC LIMIT 1`,
        [engagementId],
      );
      const risks = await tx.query<{ description: string }>(
        `SELECT description FROM risk
          WHERE engagement_id = $1 AND significant AND rebutted = false
          ORDER BY created_at`,
        [engagementId],
      );
      const team = await tx.query<{ name: string; team_role: string }>(
        `SELECT coalesce(u.name, u.email) AS name, tm.team_role
           FROM team_member tm JOIN app_user u ON u.id = tm.user_id
          WHERE tm.engagement_id = $1 AND coalesce(tm.status, 'accepted') <> 'declined'
            AND tm.team_role <> 'eqr_reviewer'
          ORDER BY tm.created_at`,
        [engagementId],
      );
      const roleLabel: Record<string, [string, string]> = {
        partner: ["Associé responsable", "Engagement partner"],
        director: ["Directeur", "Director"],
        senior_manager: ["Manager senior", "Senior manager"],
        manager: ["Manager", "Manager"],
        senior: ["Senior", "Senior"],
        staff: ["Assistant", "Staff"],
      };
      const addressees = await paperAnswers("P7.1", ["addressees"]);
      const scope = await paperAnswers("P7.1", ["scope"]);
      planning = {
        addressees: addressees[0] ?? "",
        scope: scope[0] ?? "",
        materiality: m.rows[0]
          ? { overall: Number(m.rows[0].overall), performance: Number(m.rows[0].performance), trivial: Number(m.rows[0].trivial) }
          : null,
        risks: risks.rows.map((r) => r.description),
        team: team.rows.map((t) => ({
          name: t.name,
          role: (roleLabel[t.team_role] ?? [t.team_role, t.team_role])[locale === "fr" ? 0 : 1],
        })),
      };
    }

    const fr = locale === "fr";
    const TITLES: Record<LetterKind, string> = {
      engagement: fr ? "Lettre de mission" : "Engagement letter",
      planning_tcwg: fr ? "Communication de planification (ISA 260)" : "Planning communication (ISA 260)",
      rep_affirmation: fr ? "Lettre d'affirmation (pré-arrêté)" : "Affirmation letter (pre-arrêté)",
      rep_complementary: fr ? "Lettre d'affirmation complémentaire" : "Complementary representation letter",
      management_letter: fr ? "Lettre de recommandations" : "Management letter",
      tcwg_completion: fr ? "Rapport à la gouvernance — achèvement (ISA 260)" : "Governance report — completion (ISA 260)",
    };
    const title = TITLES[kind];

    const branding = await loadBranding(tx, tenantId);
    const content = await buildLetter(
      kind,
      {
        clientName: row.client_name,
        legalForm: row.legal_form,
        fiscalYear: row.fiscal_year,
        periodEnd: row.period_end,
        coCac: row.co_cac,
        mandateType: row.mandate_type,
        mandateStartYear: row.mandate_start_year,
        framework: row.framework,
        address: row.address,
        registrationNumber: row.registration_number,
        niu: row.niu,
        c1Points,
        uncorrected,
        specificRepresentations,
        significantMatters,
        independence,
        planning,
      },
      locale,
      branding,
    );

    let documentId: string;
    const existing = await tx.query<{ id: string }>(
      "SELECT id FROM document WHERE file_item_id = $1 AND kind = 'letter' AND title = $2 LIMIT 1",
      [fileItemId, title],
    );
    if (existing.rows[0]) {
      documentId = existing.rows[0].id;
    } else {
      const created = await tx.query<{ id: string }>(
        `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by)
         VALUES ($1, $2, $3, $4, $5, 'letter', $6) RETURNING id`,
        [tenantId, engagementId, fileItemId, title, locale, userId],
      );
      documentId = created.rows[0].id;
    }

    const next = await tx.query<{ v: number }>(
      "SELECT coalesce(max(version_no), 0) + 1 AS v FROM document_version WHERE document_id = $1",
      [documentId],
    );
    const sha256 = createHash("sha256").update(content).digest("hex");
    await tx.query(
      `INSERT INTO document_version
         (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [tenantId, documentId, next.rows[0].v, DOCX_MIME, content.length, sha256, content, `letter:${kind}`, userId],
    );
    await tx.query("UPDATE document SET current_version = $2 WHERE id = $1", [
      documentId,
      next.rows[0].v,
    ]);
    return { documentId, versionNo: next.rows[0].v, title, code };
  }).then(async (r) => {
    // A generated letter is a deliverable of the file: the trail names it (UAT B62).
    await recordActivity({
      engagementId,
      entityType: "document",
      entityId: r.documentId,
      action: "letter_generated",
      summary: `${r.code} letter generated: ${r.title} (v${r.versionNo})`,
      after: { kind, versionNo: r.versionNo },
    });
    return r.documentId;
  });
}

/** Letters generated for an engagement (for the acceptance/planning hubs). */
export async function listLetters(
  engagementId: string,
): Promise<{ id: string; title: string; currentVersion: number }[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; title: string; current_version: number }>(
      "SELECT id, title, current_version FROM document WHERE engagement_id = $1 AND kind = 'letter' ORDER BY created_at",
      [engagementId],
    );
    return result.rows.map((r) => ({ id: r.id, title: r.title, currentVersion: r.current_version }));
  });
}
