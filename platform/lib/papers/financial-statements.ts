// E6.10 Financial statement procedures — the tie-out of the accounts and the
// notes [pointage des comptes et annexes], written against the handbook's own
// procedure (pages 321–323) and the standards it rests on.
//
// The handbook treats this as a procedure in its own right, in five movements:
// tie column N to the final lead schedules and column N-1 to the accounts
// attached to our prior-year report; bring the audit points and the summary of
// audit differences to bear; formalise and conclude on the bridge from the
// audited accounts to the definitive ones [passage comptes audités → comptes
// définitifs]; review content and presentation against the framework and
// formalise the notes review in the disclosure checklist [questionnaire de
// contrôle de l'annexe]; then report every presentation or method anomaly,
// error or omission to the senior or manager. Its cautions are carried as
// tips on the procedures they belong to, because that is where a preparer
// reads them.
//
// Two things the sources do not supply are not invented here. No source
// explains what "SRM" stands for, so the paper says what the handbook says —
// the summary review memorandum the file keeps as C1.2 — and no more. And the
// bridge and the version comparison of the notes are handbook practice, not
// ISA requirements; their references point to the nearest ISA paragraph (F026).
import { OHADA_FS_CHECKLIST } from "@/lib/ohada-fs-checklist";
import type { PaperDef, PaperItem, PaperProc, PaperSection } from "@/lib/papers/types";

const P = (
  key: string,
  en: string,
  fr: string,
  srcEn: string,
  srcFr: string,
  tipEn?: string,
  tipFr?: string,
): PaperProc => (tipEn && tipFr ? { key, en, fr, srcEn, srcFr, tipEn, tipFr } : { key, en, fr, srcEn, srcFr });

const Q = (key: string, en: string, fr: string, na?: boolean): PaperItem =>
  na ? { key, en, fr, na } : { key, en, fr };

const proc = (
  titleEn: string,
  titleFr: string,
  introEn: string,
  introFr: string,
  procs: PaperProc[],
): PaperSection => ({ kind: "proc", titleEn, titleFr, introEn, introFr, procs });

/**
 * Part G: the OHADA financial statement checklist as yes/no answers on the paper
 * (F062), so the answers carry the paper's sign-offs. Kept in the same order as
 * the catalogue the E6.10.1 workbook is generated from; each row names its article.
 */
const OHADA_CHECKLIST_SECTIONS: PaperSection[] = OHADA_FS_CHECKLIST.map((section) => ({
  kind: "yn" as const,
  titleEn: `Part G — E6.10.1 Checklist ${section.key}: ${section.titleEn}`,
  titleFr: `Partie G — E6.10.1 Questionnaire ${section.key} : ${section.titleFr}`,
  introEn: section.introEn,
  introFr: section.introFr,
  items: section.rows.map((row) => ({
    key: `ohada_${row.ref.replace(/[^A-Za-z0-9]+/g, "_")}`,
    en: `${row.ref} — ${row.en} (${row.article})`,
    fr: `${row.ref} — ${row.fr} (${row.article})`,
  })),
}));

export const FINANCIAL_STATEMENTS_PAPER: PaperDef = {
  std: "ISA 700 (Revised) ¶10–15 · ISA 450 ¶5–13 · ISA 710 ¶7–9 · ISA 510 ¶5–8 · ISA 330 ¶30 · AUDCIF art. 34 · AUSCGIE art. 710",
  ownsEn:
    "the tie-out of the financial statements and notes to the final lead schedules and to the prior-year accounts, the bridge from audited to definitive accounts, and the review of content and presentation against the framework",
  ownsFr:
    "le pointage des états financiers et des notes annexes aux leads définitifs et aux comptes de l'exercice précédent, le passage des comptes audités aux comptes définitifs et la revue du contenu et de la présentation au regard du référentiel",
  tools: ["sad", "lead-schedule"],
  reqEn: [
    "The annual financial statements — balance sheet, income statement, cash-flow statement and notes — form an indivisible whole [tout indissociable]. Before the report is signed, every figure and every disclosure in them is tied to the audited accounting: column N to the final lead schedules, marked in each lead so that no account is left untied, and column N-1 to the definitive accounts attached to our prior-year report, because the opening balance sheet is the prior closing one and its presentation may not change from one year to the next (AUDCIF art. 34; ISA 510 ¶5–8; ISA 710 ¶7–9; ISA 330 ¶30).",
    "The audit points of the final phase are brought to bear on the definitive accounts: the summary review memorandum and the summary of audit differences are linked to this work, every adjustment agreed is confirmed as posted, and reclassifications — credit balances on customers, debit balances on suppliers — are watched for, because they are where a posted adjustment most often fails to reach the statements (ISA 450 ¶5–13).",
    "The bridge from the audited accounts to the definitive accounts [passage comptes audités → comptes définitifs] is systematically formalised and concluded on, every significant difference explained. A point on the bridge that is not cleared is not left on the paper: it is reported to the senior (ISA 450 ¶8).",
    "Content and presentation are reviewed critically against the framework: whether the level of information in the notes and the way it is presented give a true and fair view, whether an adjustment is called for, and whether the answer bears on the opinion (ISA 700 (Revised) ¶12–14; AUSCGIE art. 710). A number of disclosures are mandatory, and the review of the notes is formalised in the disclosure checklist [questionnaire de contrôle de l'annexe] — the E6.10 OHADA financial statement checklist on this file — every 'No' commented and the significant ones carried to the summary of audit differences (ISA 450 ¶5–8).",
    "The object of the whole procedure is to identify presentation or method anomalies, errors and omissions and report them to the senior or manager. Prior-year answers are not copied and questions not understood are not answered 'not applicable'; where the note wording was tied to N-1, the preparer steps back to confirm no change was needed; the reasoning is by significance and relevance; and the N-1 figures AND the matrix of the notes are validated against our N-1 report, not against the client's draft (ISA 710 ¶7).",
  ],
  reqFr: [
    "Les états financiers annuels — bilan, compte de résultat, tableau des flux de trésorerie et notes annexes — forment un tout indissociable. Avant la signature du rapport, chaque chiffre et chaque information qu'ils contiennent sont pointés à la comptabilité auditée : la colonne N aux leads définitifs, en matérialisant dans chaque lead que tous les comptes ont été pointés, et la colonne N-1 aux comptes définitifs joints à notre rapport de l'exercice précédent, parce que le bilan d'ouverture est le bilan de clôture précédent et que sa présentation ne peut varier d'un exercice à l'autre (AUDCIF art. 34 ; ISA 510 ¶5–8 ; ISA 710 ¶7–9 ; ISA 330 ¶30).",
    "Les points d'audit de la phase finale sont rapprochés des comptes définitifs : le mémorandum récapitulatif de revue et le récapitulatif des écarts d'audit sont liés à ces travaux, chaque ajustement convenu est vérifié comme passé, et les reclassements — clients créditeurs, fournisseurs débiteurs — font l'objet d'un point d'attention, car c'est là qu'un ajustement passé manque le plus souvent d'atteindre les états (ISA 450 ¶5–13).",
    "Le passage des comptes audités aux comptes définitifs est systématiquement formalisé et conclu, chaque écart significatif étant expliqué. Un point non levé sur ce passage ne reste pas sur le papier : il est signalé au senior (ISA 450 ¶8).",
    "Le contenu et la présentation font l'objet d'une revue critique au regard du référentiel : le niveau d'information des notes et la manière dont elles sont présentées donnent-ils une image fidèle, un ajustement s'impose-t-il, et la réponse pèse-t-elle sur l'opinion (ISA 700 révisée ¶12–14 ; AUSCGIE art. 710). Un certain nombre d'informations ont un caractère obligatoire, et la revue des notes est formalisée dans le questionnaire de contrôle de l'annexe — le contrôle des états financiers OHADA E6.10 de ce dossier — chaque « Non » étant commenté et les plus significatifs reportés au récapitulatif des écarts d'audit (ISA 450 ¶5–8).",
    "L'objectif de l'ensemble est de relever les anomalies de présentation ou de méthode, les erreurs et les omissions et de les signaler au senior ou au manager. Les réponses de l'exercice précédent ne sont pas recopiées et les questions non comprises ne sont pas mises en « sans objet » ; lorsque le libellé de l'annexe a été pointé iso N-1, le préparateur prend du recul pour s'assurer qu'aucune évolution n'était nécessaire ; le raisonnement se fait en fonction du caractère significatif et pertinent ; et les chiffres N-1 AINSI QUE la matrice de l'annexe sont validés avec notre rapport N-1, non avec le projet du client (ISA 710 ¶7).",
  ],
  sections: [
    proc(
      "Part A — Tie-out [pointage]",
      "Partie A — Pointage",
      "Perform each procedure and record the result, the version of the statements it was performed on and the working-paper reference of the evidence filed.",
      "Mettre en œuvre chaque procédure et consigner le résultat, la version des états sur laquelle elle a été réalisée et la référence du dossier.",
      [
        P(
          "tie_n1",
          "Tie column N-1 to the definitive accounts attached to our prior-year report — every caption of the balance sheet, income statement, cash-flow statement and notes — and record any difference and its cause.",
          "Pointer la colonne N-1 aux comptes définitifs joints à notre rapport de l'exercice précédent — chaque poste du bilan, du compte de résultat, du tableau des flux de trésorerie et des notes — et consigner tout écart et sa cause.",
          "Our signed prior-year report and the accounts attached to it · AUDCIF art. 34 · ISA 710 ¶7",
          "Notre rapport signé de l'exercice précédent et les comptes qui y sont joints · AUDCIF art. 34 · ISA 710 ¶7",
          "Validate the N-1 figures AND the matrix of the notes against our N-1 report — not against the client's own prior-year file, which may have changed since we signed.",
          "Valider les chiffres N-1 AINSI QUE la matrice de l'annexe avec notre rapport N-1 — non avec le dossier N-1 du client, qui a pu évoluer depuis notre signature.",
        ),
        P(
          "tie_n",
          "Tie column N to the final lead schedules and mark in each lead that every account was tied, so that the leads themselves show nothing was left untied.",
          "Pointer la colonne N aux leads définitifs et matérialiser dans chaque lead que tous les comptes ont été pointés, de sorte que les leads eux-mêmes montrent qu'aucun compte n'a été omis.",
          "Final lead schedules (Tools → Lead Schedule) · trial balance · ISA 330 ¶30",
          "Leads définitifs (Outils → Feuilles maîtresses) · balance · ISA 330 ¶30",
        ),
        P(
          "tft",
          "Cross-refer the cash flow statement [TFT] to E4.36: the TFT ties to the opening and closing cash of the balance sheet, each line to its movement schedule, and the recomputation is on E4.36 — this paper only confirms the version tied there is the definitive one.",
          "Renvoyer le tableau des flux de trésorerie (TFT) à E4.36 : le TFT se rapproche de la trésorerie d'ouverture et de clôture du bilan, chaque ligne de son tableau de mouvements, et le recalcul figure en E4.36 — la présente feuille vérifie seulement que la version rapprochée là est la version définitive.",
          "E4.36 Cash Flow (TFT) Tie-out · definitive statements · SYSCOHADA — tableau des flux de trésorerie",
          "E4.36 Concordance du TFT · états définitifs · SYSCOHADA — tableau des flux de trésorerie",
          "The TFT is one of the four statements of the SYSCOHADA set, so it is tied on every file (E4.36 is a core paper). The recomputation is not automated: E4.36 holds it, and a TFT version changed after E4.36 concluded reopens E4.36.",
          "Le TFT est l'un des quatre états du jeu SYSCOHADA : il est rapproché sur tout dossier (E4.36 est une feuille de base). Le recalcul n'est pas automatisé : E4.36 le porte, et une version du TFT modifiée après la conclusion de E4.36 rouvre E4.36.",
        ),
        P(
          "note_versions",
          "Compare successive versions of the client's notes and confirm the changes expected from our review were made and that no unexpected change was introduced.",
          "Comparer les versions successives de l'annexe du client et vérifier que les modifications attendues de notre revue ont été apportées et qu'aucune modification inattendue n'a été introduite.",
          "Successive drafts of the notes · comparison output (PDF compare or equivalent) · ISA 700 (Revised) ¶13",
          "Versions successives de l'annexe · résultat de la comparaison (comparaison PDF ou équivalent) · ISA 700 révisée ¶13",
          "Attention to the changes that were expected and did not happen, not only to those that did.",
          "Attention aux modifications attendues qui n'ont pas été effectuées, et pas seulement à celles qui l'ont été.",
        ),
      ],
    ),
    proc(
      "Part B — Audit points",
      "Partie B — Points d'audit",
      "Bring the conclusions of the final phase to bear on the definitive accounts.",
      "Rapprocher les conclusions de la phase finale des comptes définitifs.",
      [
        P(
          "srm_sad",
          "Link this work to the summary review memorandum (C1.2) and the summary of audit differences (C1.1): every point and every difference raised on the final accounts is traced to what the definitive accounts show.",
          "Faire le lien entre ces travaux, le mémorandum récapitulatif de revue (C1.2) et le récapitulatif des écarts d'audit (C1.1) : chaque point et chaque écart relevé sur les comptes finaux est suivi jusqu'à ce que montrent les comptes définitifs.",
          "C1.2 summary review memorandum · C1.1 / Tools → Summary of Audit Differences · ISA 450 ¶5–13",
          "C1.2 mémorandum récapitulatif · C1.1 / Outils → Récapitulatif des écarts d'audit · ISA 450 ¶5–13",
        ),
        P(
          "adjustments",
          "Confirm with the senior that the audit points raised on the final accounts were taken into account and that the adjustments agreed were posted, and check the reclassifications between customers and suppliers — credit balances on customers, debit balances on suppliers — were made.",
          "Vérifier avec le senior que les points d'audit relevés sur le final ont été pris en compte et que les ajustements convenus ont été passés, et contrôler que les reclassements clients créditeurs / fournisseurs débiteurs ont été effectués.",
          "Senior's review · posted adjustments · aged balances · ISA 450 ¶8",
          "Revue du senior · ajustements passés · balances âgées · ISA 450 ¶8",
        ),
      ],
    ),
    proc(
      "Part C — The bridge from audited to definitive accounts [passage]",
      "Partie C — Passage des comptes audités aux comptes définitifs",
      "Formalise the bridge every time; conclude on it; explain every significant difference.",
      "Formaliser systématiquement le passage ; conclure ; expliquer chaque écart significatif.",
      [
        P(
          "bridge",
          "Prepare the bridge from the audited accounts to the definitive accounts, caption by caption, and conclude on it — satisfactory or not — explaining every significant difference.",
          "Établir le passage des comptes audités aux comptes définitifs, poste par poste, et conclure — satisfaisant ou non — en expliquant chaque écart significatif.",
          "Bridge schedule with conclusion · audited trial balance · definitive statements · ISA 330 ¶30",
          "Tableau de passage avec conclusion · balance auditée · états définitifs · ISA 330 ¶30",
          "Any question or point not cleared on the bridge is reported to the senior. It is never carried as an open point on a concluded paper.",
          "Toute question ou point non levé sur le passage est signalé au senior. Il n'est jamais porté en point ouvert sur un papier conclu.",
        ),
      ],
    ),
    proc(
      "Part D — Content and mandatory disclosures",
      "Partie D — Contenu et informations obligatoires",
      "Review the statements as a whole against the framework, then formalise the review of the notes in the checklist.",
      "Revoir les états dans leur ensemble au regard du référentiel, puis formaliser la revue de l'annexe dans le questionnaire.",
      [
        P(
          "presentation",
          "Review critically the level of information in the notes and the way the statements are presented, against the framework, asking of each shortfall whether an adjustment is called for and whether it bears on the opinion.",
          "Faire une revue critique du niveau d'information des notes et de la présentation des états au regard du référentiel, en se demandant pour chaque insuffisance si un ajustement s'impose et si elle pèse sur l'opinion.",
          "Definitive statements · AUDCIF and SYSCOHADA révisé · ISA 700 (Revised) ¶12–14 · AUSCGIE art. 710",
          "États définitifs · AUDCIF et SYSCOHADA révisé · ISA 700 révisée ¶12–14 · AUSCGIE art. 710",
          "Reason by significance and relevance. A note that is technically required but immaterial is not the same finding as a material omission.",
          "Raisonner en fonction du caractère significatif et pertinent. Une note techniquement requise mais non significative n'est pas le même constat qu'une omission significative.",
        ),
        P(
          "checklist",
          "Complete the E6.10.1 OHADA financial statement checklist in Part G of this paper — every requirement answered, every 'No' commented, the completed checklist filed on this task — and carry the significant 'No's and any missing specific information to the summary of audit differences as misstatements in disclosures.",
          "Compléter le contrôle des états financiers OHADA E6.10.1 en partie G de cette feuille — chaque exigence répondue, chaque « Non » commenté, le questionnaire complété joint à cette tâche — et reporter les « Non » significatifs et toute information spécifique manquante au récapitulatif des écarts d'audit en anomalies de présentation.",
          "Part G of this paper (E6.10.1) · C1.1 · ISA 700 (Revised) ¶12–14",
          "Partie G de cette feuille (E6.10.1) · C1.1 · ISA 700 révisée ¶12–14",
          "Do not copy prior-year answers, and do not mark 'not applicable' a question that is not understood. Where the wording of a note was tied to N-1, step back and confirm no change was needed.",
          "Ne pas recopier les réponses de l'exercice précédent, et ne pas mettre en « sans objet » une question non comprise. Lorsque le libellé d'une note a été pointé iso N-1, prendre du recul et s'assurer qu'aucune évolution n'était nécessaire.",
        ),
        P(
          "dsf",
          "Agree the DSF filed [déclaration statistique et fiscale] to the definitive financial statements — balance sheet, income statement, TFT and notes, figure for figure — and reconcile the fiscal result to the accounting result through the tax computation (reintegrations, deductions, losses carried forward); explain every difference and carry an unexplained one to the senior.",
          "Rapprocher la DSF déposée (déclaration statistique et fiscale) des états financiers définitifs — bilan, compte de résultat, TFT et notes, chiffre par chiffre — et rapprocher le résultat fiscal du résultat comptable au travers du tableau de détermination (réintégrations, déductions, déficits reportables) ; expliquer chaque écart et faire remonter au senior un écart inexpliqué.",
          "DSF as filed (receipt) · definitive statements · tax computation · E4.34 income tax",
          "DSF telle que déposée (récépissé) · états définitifs · tableau de détermination du résultat fiscal · E4.34 impôt sur le résultat",
          "Obtain the DSF actually filed with the tax administration, with its receipt, not the draft the accountant keeps: a DSF filed before our adjustments were posted differs from the definitive statements by exactly those adjustments, and the difference is a report matter.",
          "Obtenir la DSF effectivement déposée auprès de l'administration fiscale, avec son récépissé, non le projet que conserve le comptable : une DSF déposée avant la passation de nos ajustements diffère des états définitifs d'exactement ces ajustements, et l'écart est un point du rapport.",
        ),
        P(
          "comparatives",
          "Check that the comparative figures comply with the framework and that any restatement or reclassification of the prior year is disclosed as such.",
          "Vérifier que les chiffres comparatifs sont conformes au référentiel et que tout retraitement ou reclassement de l'exercice précédent est présenté comme tel.",
          "Notes on comparatives · our N-1 report · ISA 710 ¶7–9 · AUDCIF art. 34",
          "Notes sur les comparatifs · notre rapport N-1 · ISA 710 ¶7–9 · AUDCIF art. 34",
        ),
      ],
    ),
    proc(
      "Part E — Conclusion of the procedure",
      "Partie E — Conclusion de la procédure",
      "What was found, and who was told.",
      "Ce qui a été relevé, et à qui cela a été signalé.",
      [
        P(
          "report",
          "Report every presentation or method anomaly, error and omission identified to the senior or manager, with the disposition of each, and escalate any point still unresolved on the bridge.",
          "Signaler au senior ou au manager chaque anomalie de présentation ou de méthode, erreur et omission relevée, avec le sort réservé à chacune, et faire remonter tout point encore non levé sur le passage.",
          "Review notes on this task · ISA 220 (Revised) ¶30",
          "Notes de revue sur cette tâche · ISA 220 révisée ¶30",
        ),
        P(
          "analytics",
          "Perform the overall analytical review of the definitive statements and record that they are consistent with our understanding of the entity and with the audit evidence obtained.",
          "Réaliser la revue analytique d'ensemble des états définitifs et consigner qu'ils sont cohérents avec notre connaissance de l'entité et les éléments probants obtenus.",
          "C2.1 final review · ISA 520 ¶6",
          "C2.1 revue finale · ISA 520 ¶6",
        ),
      ],
    ),
    {
      kind: "yn",
      titleEn: "Part F — Evaluation",
      titleFr: "Partie F — Évaluation",
      introEn: "Answer each statement from the work above. Explain each 'No' in the box beneath it, including what was reported and to whom.",
      introFr: "Répondre à chaque affirmation à partir des travaux ci-dessus. Expliquer chaque « Non », y compris ce qui a été signalé et à qui.",
      items: [
        Q("n1_agrees", "Column N-1 agrees to the accounts attached to our prior-year report, figures and notes alike.", "La colonne N-1 concorde avec les comptes joints à notre rapport de l'exercice précédent, chiffres et notes compris."),
        Q("n_agrees", "Column N agrees to the final lead schedules, and each lead is marked as tied.", "La colonne N concorde avec les leads définitifs, et chaque lead est matérialisé comme pointé."),
        Q("tft_tied", "The cash flow statement (TFT) of the definitive statements is the version tied and recomputed on E4.36.", "Le tableau des flux de trésorerie (TFT) des états définitifs est la version rapprochée et recalculée en E4.36."),
        Q("dsf_agreed", "The DSF filed agrees to the definitive financial statements, and the fiscal result reconciles to the accounting result without unexplained difference.", "La DSF déposée concorde avec les états financiers définitifs, et le résultat fiscal se rapproche du résultat comptable sans écart inexpliqué."),
        Q("adjustments_in", "Every audit point of the final phase and every agreed adjustment, reclassifications included, is reflected in the definitive accounts.", "Chaque point d'audit de la phase finale et chaque ajustement convenu, reclassements compris, est reflété dans les comptes définitifs."),
        Q("bridge_ok", "The bridge from audited to definitive accounts is formalised and concluded, every significant difference explained, and no point is left uncleared.", "Le passage des comptes audités aux comptes définitifs est formalisé et conclu, chaque écart significatif expliqué, et aucun point n'est laissé non levé."),
        Q("checklist_done", "The financial statement checklist is complete, every 'No' is commented, and the significant ones are in the summary of audit differences.", "Le contrôle des états financiers est complet, chaque « Non » est commenté, et les plus significatifs figurent au récapitulatif des écarts d'audit."),
        Q("presentation_ok", "The level of disclosure and the presentation give a true and fair view under the framework, or the shortfall has been evaluated for its effect on the opinion.", "Le niveau d'information et la présentation donnent une image fidèle au regard du référentiel, ou l'insuffisance a été appréciée quant à son incidence sur l'opinion."),
        Q("not_copied", "Prior-year answers were not copied, and the reasoning was by significance and relevance.", "Les réponses de l'exercice précédent n'ont pas été recopiées, et le raisonnement s'est fait en fonction du caractère significatif et pertinent."),
        Q("reported", "Every anomaly, error and omission found was reported to the senior or manager.", "Chaque anomalie, erreur et omission relevée a été signalée au senior ou au manager."),
      ],
    },
    ...OHADA_CHECKLIST_SECTIONS,
  ],
  conclEn: [
    "The financial statements agree to the final lead schedules and, for the comparative column, to the accounts attached to our prior-year report.",
    "The bridge from the audited accounts to the definitive accounts is satisfactory, and every significant difference is explained.",
    "The disclosures and the presentation comply with the framework; the anomalies identified were reported to the senior or manager and, where significant, recorded in the summary of audit differences.",
  ],
  conclFr: [
    "Les états financiers concordent avec les leads définitifs et, pour la colonne comparative, avec les comptes joints à notre rapport de l'exercice précédent.",
    "Le passage des comptes audités aux comptes définitifs est satisfaisant, et chaque écart significatif est expliqué.",
    "Les informations fournies et la présentation sont conformes au référentiel ; les anomalies relevées ont été signalées au senior ou au manager et, lorsqu'elles sont significatives, portées au récapitulatif des écarts d'audit.",
  ],
};

/**
 * Keyed the way the execution set keys its papers, so wiring it in is a change
 * of one entry rather than a change of shape.
 */
export const FINANCIAL_STATEMENT_PAPERS: Record<string, PaperDef> = {
  "E6.10": FINANCIAL_STATEMENTS_PAPER,
};
