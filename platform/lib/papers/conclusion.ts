// The Conclusion working papers, including the OHADA statutory set (C5.2–C5.9).
// Same structure as the other phases: numbered procedures that say what to do
// and where the information comes from, an evaluation of what those procedures
// produced, and a conclusion the preparer answers.

import type { PaperDef, PaperItem, PaperProc } from "@/lib/papers/types";

const P = (
  key: string,
  en: string,
  fr: string,
  srcEn: string,
  srcFr: string,
): PaperProc => ({ key, en, fr, srcEn, srcFr });

const Q = (key: string, en: string, fr: string, na?: boolean): PaperItem =>
  na ? { key, en, fr, na } : { key, en, fr };

const PROC_INTRO_EN =
  "Perform each procedure and record the result, stating what was obtained, from whom or from which source, and the reference of the evidence filed.";
const PROC_INTRO_FR =
  "Mettre en œuvre chaque procédure et consigner le résultat : ce qui a été obtenu, auprès de qui ou de quelle source, et la référence du dossier.";
const YN_INTRO_EN =
  "Evaluate the results of the Part A procedures against each statement. Explain each “No” in the box beneath it, including what remains to be done before the report is dated.";
const YN_INTRO_FR =
  "Évaluer les résultats de la partie A au regard de chaque affirmation. Expliquer chaque « Non », y compris ce qui reste à faire avant la date du rapport.";

function mk(args: {
  std: string;
  ownsEn: string;
  ownsFr: string;
  reqEn: string[];
  reqFr: string[];
  procs: PaperProc[];
  items: PaperItem[];
  conclEn: string[];
  conclFr: string[];
  tools?: string[];
  outcome?: boolean;
}): PaperDef {
  const def: PaperDef = {
    std: args.std,
    ownsEn: args.ownsEn,
    ownsFr: args.ownsFr,
    reqEn: args.reqEn,
    reqFr: args.reqFr,
    conclEn: args.conclEn,
    conclFr: args.conclFr,
    tools: args.tools,
    sections: [
      {
        kind: "proc",
        titleEn: "Part A — Procedures and expected sources",
        titleFr: "Partie A — Procédures et sources attendues",
        introEn: PROC_INTRO_EN,
        introFr: PROC_INTRO_FR,
        procs: args.procs,
      },
      {
        kind: "yn",
        titleEn: "Part B — Evaluation",
        titleFr: "Partie B — Évaluation",
        introEn: YN_INTRO_EN,
        introFr: YN_INTRO_FR,
        items: args.items,
      },
    ],
  };
  if (args.outcome !== false) {
    def.sections!.push({
      kind: "fields",
      titleEn: "Part C — Outcome",
      titleFr: "Partie C — Résultat",
      fields: [
        { key: "matters", kind: "input", labelEn: "Matters arising, and where each is carried: C1.2 significant matters, C1.1 misstatements, or C6.1 points forward", labelFr: "Points relevés et leur report : C1.2 points significatifs, C1.1 anomalies, ou C6.1 points reportés" },
        { key: "effect", kind: "input", labelEn: "Effect on the auditor's report, if any", labelFr: "Incidence éventuelle sur le rapport de l'auditeur" },
      ],
    });
  }
  return def;
}

/* ================================ financial statements & completion (C5.1) = */

const C2_1 = mk({
  std: "ISA 700 (Revised) ¶12–15 · ISA 330 ¶25–27 · SYSCOHADA — états financiers",
  ownsEn: "the financial statements as presented, and their agreement to the audited record",
  ownsFr: "les états financiers présentés et leur concordance avec le dossier audité",
  reqEn: [
    "We evaluate whether the financial statements are prepared in all material respects in accordance with the applicable financial reporting framework, including whether they adequately refer to or describe that framework (ISA 700 (Revised) ¶13–15).",
    "The evaluation covers the presentation, structure and content of the statements and the notes, and whether the underlying transactions and events are represented in a manner that achieves fair presentation.",
  ],
  reqFr: [
    "Nous apprécions si les états financiers sont établis, dans tous leurs aspects significatifs, conformément au référentiel applicable et s'ils y font référence de manière appropriée (ISA 700 révisée ¶13–15).",
    "L'appréciation porte sur la présentation, la structure et le contenu des états et des notes, et sur la traduction fidèle des opérations sous-jacentes.",
  ],
  procs: [
    P("analytics", "Perform final analytical procedures at the financial statement level, and evaluate whether the statements as a whole are consistent with our understanding of the entity.", "Mettre en œuvre des procédures analytiques finales au niveau des états financiers et apprécier leur cohérence d'ensemble avec notre connaissance de l'entité.", "Final trial balance · prior financial statements · P3.2 expectations · ISA 520 ¶6", "Balance définitive · états financiers antérieurs · attentes P3.2 · ISA 520 ¶6"),
    P("tieout", "Agree every figure in the primary statements to the final trial balance as adjusted, and confirm the statements cast and cross-cast.", "Rapprocher chaque montant des états de synthèse de la balance définitive ajustée et vérifier les totaux en lignes et en colonnes.", "Final trial balance · adjustment schedule · lead schedules", "Balance définitive · état des ajustements · feuilles maîtresses"),
    P("notes", "Agree every figure in the notes to the primary statements and to the supporting working paper.", "Rapprocher chaque montant des notes des états de synthèse et de la feuille de travail correspondante.", "Draft notes · working papers", "Projet de notes · feuilles de travail"),
    P("adjustments", "Confirm that every adjustment agreed with management in C1.1 has been posted, and that none has been posted that was not agreed.", "Vérifier que chaque ajustement convenu avec la direction en C1.1 a été comptabilisé et qu'aucun autre ne l'a été.", "C1.1 · final trial balance · journal entries", "C1.1 · balance définitive · écritures"),
    P("presentation", "Test the presentation, structure and content of the statements against the framework, including the format prescribed by SYSCOHADA where it applies.", "Tester la présentation, la structure et le contenu des états au regard du référentiel, y compris le format SYSCOHADA le cas échéant.", "SYSCOHADA / IFRS presentation requirements", "Exigences de présentation SYSCOHADA / IFRS"),
    P("disclosure", "Complete the disclosure checklist for the framework, and test each disclosure the entity is required to make.", "Renseigner la liste de contrôle des informations à fournir et tester chaque mention obligatoire.", "Disclosure checklist · framework · draft statements", "Liste de contrôle · référentiel · projet d'états"),
    P("comparatives", "Agree the comparative figures to the prior period financial statements, and cross-refer to E6.5.", "Rapprocher les chiffres comparatifs des états financiers antérieurs et renvoyer à E6.5.", "Prior financial statements · E6.5", "États financiers antérieurs · E6.5"),
    P("consistency", "Read the other information issued with the financial statements, including the management report, and identify any material inconsistency with the statements or with our knowledge.", "Examiner les autres informations diffusées avec les états financiers, dont le rapport de gestion, et relever toute incohérence significative.", "Management report · ISA 720 (Revised)", "Rapport de gestion · ISA 720 révisée"),
    P("terminology", "Confirm the terminology used, including the title of each statement and the description of the framework.", "Vérifier la terminologie employée, dont l'intitulé de chaque état et la désignation du référentiel.", "Framework · draft statements", "Référentiel · projet d'états"),
  ],
  items: [
    Q("ties", "Every figure in the statements and the notes agrees to the audited record (procedures 1, 2).", "Chaque montant des états et des notes concorde avec le dossier audité (procédures 1, 2)."),
    Q("adjustments", "Every agreed adjustment has been posted, and no unagreed adjustment has been (procedure 3).", "Chaque ajustement convenu a été comptabilisé et aucun ajustement non convenu ne l'a été (procédure 3)."),
    Q("disclosures", "The disclosure checklist is complete and every required disclosure is made (procedure 5).", "La liste de contrôle est complète et chaque information requise est fournie (procédure 5)."),
    Q("other_info", "The other information contains no material inconsistency with the financial statements or with our knowledge (procedure 7).", "Les autres informations ne présentent aucune incohérence significative avec les états financiers ni avec notre connaissance (procédure 7)."),
  ],
  conclEn: [
    "The financial statements are prepared, in all material respects, in accordance with the applicable financial reporting framework and agree to the audited record.",
  ],
  conclFr: [
    "Les états financiers sont établis, dans tous leurs aspects significatifs, conformément au référentiel applicable et concordent avec le dossier audité.",
  ],
});

const C4_1 = mk({
  std: "ISA 220 (Revised) ¶29–35 · ISA 230 ¶14–16 · ISA 330 ¶26",
  ownsEn: "the confirmation that the file is complete and the work is done",
  ownsFr: "la confirmation de l'exhaustivité du dossier et de l'achèvement des travaux",
  reqEn: [
    "Before the report is dated, the engagement partner determines that sufficient appropriate audit evidence has been obtained to support the conclusions reached and for the report to be issued (ISA 220 (Revised) ¶36).",
    "The audit documentation is assembled into a final file on a timely basis after the date of the report, and no documentation is deleted or discarded before the end of its retention period (ISA 230 ¶14–16).",
  ],
  reqFr: [
    "Avant la date du rapport, l'associé responsable s'assure que des éléments probants suffisants et appropriés ont été obtenus pour étayer les conclusions et permettre l'émission du rapport (ISA 220 révisée ¶36).",
    "La documentation est constituée en dossier définitif dans un délai raisonnable après la date du rapport et n'est pas supprimée avant la fin de la période de conservation (ISA 230 ¶14–16).",
  ],
  procs: [
    P("programme", "Confirm that every planned procedure in the audit programme has been performed, or that the reason for not performing it is recorded and approved.", "Vérifier que chaque procédure prévue au programme a été mise en œuvre, ou que le motif de sa non-réalisation est consigné et approuvé.", "Audit programme · task list · partner approval", "Programme de travail · liste des tâches · approbation de l'associé"),
    P("signoffs", "Confirm that every working paper carries a preparer sign-off and, where required, a reviewer sign-off.", "Vérifier que chaque feuille de travail porte la signature du préparateur et, le cas échéant, du réviseur.", "Sign-off register · task list", "Registre des signatures · liste des tâches"),
    P("outstanding", "Confirm that every point in C4.3 has been cleared, or that the reason a point remains open is recorded and does not prevent the report from being issued.", "Vérifier que chaque point de C4.3 est levé, ou que le motif de son maintien est consigné et n'empêche pas l'émission du rapport.", "C4.3 points outstanding", "C4.3 points en suspens"),
    P("misstatements", "Confirm that the misstatements in C1.1 have been evaluated and that the effect on the opinion is determined.", "Vérifier que les anomalies de C1.1 ont été évaluées et que leur incidence sur l'opinion est déterminée.", "C1.1 · C5.1", "C1.1 · C5.1"),
    P("consultation", "Confirm that every matter on which consultation was required has been consulted on, and that the conclusion reached has been implemented.", "Vérifier que chaque point appelant une consultation en a fait l'objet et que la conclusion a été mise en œuvre.", "C1.3 consultation record · firm policy", "C1.3 registre des consultations · politique du cabinet"),
    P("eqr", "Where an engagement quality review is required, confirm it has been completed and that the reviewer has raised no unresolved matter.", "Lorsqu'une revue de qualité est requise, vérifier son achèvement et l'absence de point non résolu soulevé par le responsable.", "C4.2 · ISQM 2 ¶25 · P1.5", "C4.2 · ISQM 2 ¶25 · P1.5"),
    P("evidence", "Confirm that the evidence obtained supports each conclusion in the file, and that no conclusion rests on a procedure that was not performed.", "Vérifier que les éléments obtenus étayent chaque conclusion du dossier et qu'aucune conclusion ne repose sur une procédure non réalisée.", "Working papers · partner review notes", "Feuilles de travail · notes de revue de l'associé"),
    P("assembly", "Record the date by which the final file is to be assembled, and the retention period that applies.", "Consigner la date d'achèvement de la constitution du dossier définitif et la durée de conservation applicable.", "ISA 230 ¶14 · firm policy", "ISA 230 ¶14 · politique du cabinet"),
  ],
  items: [
    Q("performed", "Every planned procedure has been performed or its omission is approved (procedure 1).", "Chaque procédure prévue a été réalisée ou son omission est approuvée (procédure 1)."),
    Q("signed", "Every working paper is signed off by its preparer and, where required, its reviewer (procedure 2).", "Chaque feuille de travail est signée par son préparateur et, le cas échéant, par son réviseur (procédure 2)."),
    Q("cleared", "Every point in C4.3 has been cleared (procedure 3).", "Chaque point de C4.3 a été levé (procédure 3)."),
    Q("eqr", "Where required, the engagement quality review is complete and no matter remains unresolved (procedure 6).", "Lorsqu'elle est requise, la revue de qualité est achevée et aucun point ne reste non résolu (procédure 6).", true),
    Q("sufficient", "Sufficient appropriate audit evidence has been obtained to support the opinion (procedure 7).", "Des éléments probants suffisants et appropriés ont été obtenus pour étayer l'opinion (procédure 7)."),
  ],
  conclEn: [
    "The file is complete, the work planned has been performed, and sufficient appropriate audit evidence has been obtained to support the opinion to be expressed.",
  ],
  conclFr: [
    "Le dossier est complet, les travaux prévus ont été réalisés, et des éléments probants suffisants et appropriés ont été obtenus pour étayer l'opinion à exprimer.",
  ],
  outcome: false,
});

const C4_3 = mk({
  std: "ISA 220 (Revised) ¶30–33 · ISA 230 ¶8",
  ownsEn: "the points outstanding and their clearance before the report is dated",
  ownsFr: "les points en suspens et leur levée avant la date du rapport",
  reqEn: [
    "A point outstanding is a matter that must be resolved before the report can be dated. Each is recorded with the person responsible and the date by which it is required.",
    "A point is cleared only when the evidence that resolves it is on the file. Clearing a point by inquiry alone is recorded as such, with the reason it is sufficient.",
  ],
  reqFr: [
    "Un point en suspens doit être résolu avant que le rapport puisse être daté. Chacun est consigné avec le responsable et l'échéance.",
    "Un point n'est levé que lorsque l'élément qui le résout figure au dossier. Une levée par simple entretien est consignée comme telle, avec le motif de sa suffisance.",
  ],
  procs: [
    P("collect", "Collect the points outstanding from every working paper and from the review notes, and record the working paper each relates to.", "Recenser les points en suspens de chaque feuille de travail et des notes de revue, et consigner la feuille concernée.", "Working papers · review notes · task list", "Feuilles de travail · notes de revue · liste des tâches"),
    P("assign", "Assign each point to a person and set the date by which it is required, having regard to the reporting deadline.", "Affecter chaque point à une personne et fixer l'échéance au regard de la date de reporting.", "Team page · timetable · C5.2", "Page Équipe · calendrier · C5.2"),
    P("chase", "Follow up the points not cleared by their date, and escalate to the engagement partner those that put the deadline at risk.", "Relancer les points non levés à l'échéance et remonter à l'associé responsable ceux qui compromettent le calendrier.", "Follow-up record · partner communication", "Suivi des relances · communication à l'associé"),
    P("clear", "Clear each point by filing the evidence that resolves it, and cross-refer the clearance to the working paper.", "Lever chaque point en classant l'élément qui le résout et le renvoyer à la feuille de travail concernée.", "Supporting evidence · working papers", "Éléments justificatifs · feuilles de travail"),
    P("remaining", "For any point still open at the date of the report, record why it does not prevent the opinion from being expressed, or carry it to C5.1 as a limitation.", "Pour tout point encore ouvert à la date du rapport, consigner pourquoi il n'empêche pas l'expression de l'opinion, ou le reporter en C5.1 comme limitation.", "Partner approval · C5.1", "Approbation de l'associé · C5.1"),
  ],
  items: [
    Q("collected", "Every point raised in the file or in the review notes is on this list (procedure 1).", "Chaque point soulevé au dossier ou en note de revue figure sur cette liste (procédure 1)."),
    Q("cleared", "Every point has been cleared by evidence on the file (procedure 4).", "Chaque point a été levé par un élément figurant au dossier (procédure 4)."),
    Q("none_open", "No point remains open at the date of the report (procedure 5).", "Aucun point ne reste ouvert à la date du rapport (procédure 5)."),
  ],
  conclEn: [
    "Every point outstanding has been cleared, or the reason it does not prevent the report from being issued is recorded and approved by the engagement partner.",
  ],
  conclFr: [
    "Chaque point en suspens a été levé, ou le motif pour lequel il n'empêche pas l'émission du rapport est consigné et approuvé par l'associé responsable.",
  ],
  outcome: false,
});

const C6_1 = mk({
  std: "ISA 300 ¶12 · ISA 230 ¶8",
  ownsEn: "the matters to be carried into the next engagement",
  ownsFr: "les points à reporter sur la mission suivante",
  reqEn: [
    "Points forward record what the next engagement needs to know: the matters that took longer than expected, the deficiencies not yet remediated, the balances whose evidence was hard to obtain, and the judgements that will need revisiting.",
    "The record is made at completion, while the reasons are known, and is read when the next engagement's strategy is set in S6.1.",
  ],
  reqFr: [
    "Les points reportés consignent ce que la mission suivante doit savoir : travaux plus longs que prévu, déficiences non corrigées, soldes dont les éléments ont été difficiles à obtenir, et jugements à réexaminer.",
    "Le relevé est établi à l'achèvement, pendant que les motifs sont connus, et lu lors de l'établissement de la stratégie suivante en S6.1.",
  ],
  procs: [
    P("deficiencies", "Record the control deficiencies communicated to the entity that have not been remediated, and the effect each will have on next period's strategy.", "Consigner les déficiences de contrôle communiquées et non corrigées, et leur effet sur la stratégie de l'exercice suivant.", "C4.2 · management letter · P4.1", "C4.2 · lettre de recommandations · P4.1"),
    P("uncorrected", "Record the uncorrected misstatements carried forward and their effect on the opening balances of the next period.", "Consigner les anomalies non corrigées reportées et leur effet sur les soldes d'ouverture suivants.", "C1.1 · E6.5", "C1.1 · E6.5"),
    P("difficulties", "Record the areas where evidence was difficult to obtain, and what would make it easier next period.", "Consigner les zones où les éléments ont été difficiles à obtenir et ce qui les rendrait plus accessibles.", "Working papers · team debrief", "Feuilles de travail · débriefing d'équipe"),
    P("budget", "Compare the time taken by area with the budget, and record where the budget needs to change.", "Comparer les temps passés par zone au budget et consigner les ajustements nécessaires.", "Time records · budget · P2.2", "Temps passés · budget · P2.2"),
    P("judgements", "Record the significant judgements that will need revisiting, including the estimates whose outcome is not yet known.", "Consigner les jugements importants à réexaminer, dont les estimations dont l'issue n'est pas encore connue.", "C1.2 · E6.7 · S4.4", "C1.2 · E6.7 · S4.4"),
    P("statutory", "Record the statutory matters carried forward, including any deadline missed and any procedure engaged under the Uniform Act.", "Consigner les points statutaires reportés, dont toute échéance manquée et toute procédure engagée au titre de l'Acte uniforme.", "C5.2 · C5.5 · C5.8", "C5.2 · C5.5 · C5.8"),
  ],
  items: [
    Q("recorded", "Every matter the next engagement needs to know is recorded here (procedures 1 to 6).", "Chaque point utile à la mission suivante est consigné ici (procédures 1 à 6)."),
    Q("reasons", "Each point records the reason and the action proposed, not only the observation (procedures 3, 4).", "Chaque point consigne le motif et l'action proposée, et pas seulement le constat (procédures 3, 4)."),
  ],
  conclEn: [
    "The matters to be carried into the next engagement are recorded, and will be read when the strategy for that engagement is set.",
  ],
  conclFr: [
    "Les points à reporter sur la mission suivante sont consignés et seront lus lors de l'établissement de sa stratégie.",
  ],
  outcome: false,
});

/* ============================= misstatements & significant matters (C2) == */

const C1_1 = mk({
  std: "ISA 450 ¶5–15",
  ownsEn: "the misstatement schedule and its evaluation",
  ownsFr: "le récapitulatif des anomalies et son évaluation",
  reqEn: [
    "We accumulate misstatements identified during the audit, other than those that are clearly trivial (ISA 450 ¶5). Before evaluating the effect of uncorrected misstatements, we reassess whether materiality remains appropriate in the context of the entity's actual results (ISA 450 ¶10).",
    "We evaluate whether uncorrected misstatements are material individually or in aggregate, considering their size and nature and the circumstances of their occurrence, and the effect of uncorrected misstatements relating to prior periods (ISA 450 ¶11).",
  ],
  reqFr: [
    "Nous cumulons les anomalies relevées, hormis celles manifestement négligeables (ISA 450 ¶5). Avant d'évaluer l'effet des anomalies non corrigées, nous réexaminons le caractère approprié du seuil au regard des résultats effectifs (ISA 450 ¶10).",
    "Nous apprécions si les anomalies non corrigées sont significatives, isolément ou cumulées, en tenant compte de leur montant, de leur nature et des circonstances, ainsi que de celles des exercices antérieurs (ISA 450 ¶11).",
  ],
  procs: [
    P("accumulate", "Accumulate every misstatement identified above the clearly trivial threshold, showing the account, the amount, the assertion and the working paper it came from.", "Cumuler chaque anomalie relevée au-delà du seuil négligeable, en indiquant le compte, le montant, l'assertion et la feuille de travail d'origine.", "Working papers · P6.1 clearly trivial threshold", "Feuilles de travail · seuil négligeable P6.1"),
    P("classify", "Classify each misstatement as factual, judgemental or projected, and show the projection basis for each projected item.", "Classer chaque anomalie en avérée, résultant d'un jugement ou extrapolée, et indiquer la base d'extrapolation.", "Sampling results · ISA 530 ¶14", "Résultats d'échantillonnage · ISA 530 ¶14"),
    P("communicate", "Communicate the misstatements to management on a timely basis and request that each be corrected.", "Communiquer les anomalies à la direction en temps utile et demander leur correction.", "Communication to management · ISA 450 ¶8", "Communication à la direction · ISA 450 ¶8"),
    P("reasons", "Where management declines to correct a misstatement, obtain and record its reasons, and take them into account in evaluating the financial statements.", "Lorsque la direction refuse de corriger, obtenir et consigner ses motifs et en tenir compte dans l'appréciation des états financiers.", "Management's explanation · ISA 450 ¶9", "Explications de la direction · ISA 450 ¶9"),
    P("reassess", "Reassess whether materiality remains appropriate against the entity's actual results, and revise it where required.", "Réexaminer le caractère approprié du seuil au regard des résultats effectifs et le réviser si nécessaire.", "P6.1 · final trial balance · ISA 450 ¶10", "P6.1 · balance définitive · ISA 450 ¶10"),
    P("aggregate", "Evaluate the uncorrected misstatements individually and in aggregate against materiality, including the effect of those relating to prior periods.", "Évaluer les anomalies non corrigées isolément et cumulées au regard du seuil, y compris l'effet de celles des exercices antérieurs.", "Prior period C1.1 · current schedule", "C1.1 de l'exercice précédent · récapitulatif courant"),
    P("nature", "Evaluate each uncorrected misstatement by nature as well as by size: the effect on a covenant, on a loss becoming a profit, on remuneration, on a related party disclosure, or on a trend.", "Apprécier chaque anomalie non corrigée par sa nature autant que par son montant : effet sur un covenant, passage d'une perte à un bénéfice, rémunération, information sur les parties liées ou tendance.", "ISA 450 ¶A16–A23 · loan agreements · E4.8", "ISA 450 ¶A16–A23 · contrats de prêt · E4.8"),
    P("tcwg", "Communicate the uncorrected misstatements to those charged with governance, identifying them individually and explaining their effect on the opinion.", "Communiquer les anomalies non corrigées aux responsables de la gouvernance, en les identifiant individuellement et en expliquant leur effet sur l'opinion.", "ISA 450 ¶12 · governance communication", "ISA 450 ¶12 · communication à la gouvernance"),
    P("representation", "Request the written representation that management believes the effect of the uncorrected misstatements is immaterial, with the schedule attached.", "Demander la déclaration écrite selon laquelle la direction estime l'effet des anomalies non corrigées non significatif, récapitulatif joint.", "C3.1 · ISA 450 ¶14", "C3.1 · ISA 450 ¶14"),
  ],
  items: [
    Q("accumulated", "Every misstatement above the clearly trivial threshold has been accumulated (procedure 1).", "Chaque anomalie dépassant le seuil négligeable a été cumulée (procédure 1)."),
    Q("reassessed", "Materiality has been reassessed against the entity's actual results (procedure 5).", "Le seuil a été réexaminé au regard des résultats effectifs (procédure 5)."),
    Q("immaterial", "The uncorrected misstatements are immaterial individually and in aggregate (procedures 6, 7). A “No” requires the effect on the opinion to be determined in C5.1.", "Les anomalies non corrigées sont non significatives isolément et cumulées (procédures 6, 7). Un « Non » impose de déterminer l'effet sur l'opinion en C5.1."),
    Q("nature", "No uncorrected misstatement is material by nature notwithstanding its size (procedure 7).", "Aucune anomalie non corrigée n'est significative par nature malgré son montant (procédure 7)."),
    Q("communicated", "The uncorrected misstatements have been communicated to those charged with governance (procedure 8).", "Les anomalies non corrigées ont été communiquées aux responsables de la gouvernance (procédure 8)."),
  ],
  conclEn: [
    "The uncorrected misstatements, individually and in aggregate, do not cause the financial statements to be materially misstated.",
  ],
  conclFr: [
    "Les anomalies non corrigées, isolément et cumulées, ne rendent pas les états financiers significativement erronés.",
  ],
});

const C1_2 = mk({
  std: "ISA 230 ¶8(c), ¶10 · ISA 260 (Revised) ¶16 · ISA 701",
  ownsEn: "the significant matters, the conclusions reached and how each was resolved",
  ownsFr: "les points significatifs, les conclusions retenues et leur résolution",
  reqEn: [
    "We document the significant matters arising during the audit, the conclusions reached on them, and the significant professional judgements made in reaching those conclusions (ISA 230 ¶8(c)).",
    "Where key audit matters are to be communicated in the report, they are selected from the matters communicated to those charged with governance, being those that required the most significant attention (ISA 701 ¶9–10).",
  ],
  reqFr: [
    "Nous documentons les points significatifs relevés, les conclusions retenues et les jugements professionnels importants exercés (ISA 230 ¶8(c)).",
    "Lorsque des questions clés de l'audit doivent figurer dans le rapport, elles sont retenues parmi les points communiqués à la gouvernance, comme ayant requis l'attention la plus importante (ISA 701 ¶9–10).",
  ],
  procs: [
    P("collect", "Collect the significant matters from the file: the areas of significant risk, the significant judgements, the difficulties encountered and the disagreements with management.", "Recenser les points significatifs du dossier : zones de risque important, jugements importants, difficultés rencontrées et désaccords avec la direction.", "Working papers · S3.1 · review notes", "Feuilles de travail · S3.1 · notes de revue"),
    P("conclusion", "For each matter, record the conclusion reached and the evidence and reasoning that support it.", "Pour chaque point, consigner la conclusion retenue et les éléments et raisonnements qui l'étayent.", "Working papers · consultation record C1.3", "Feuilles de travail · registre des consultations C1.3"),
    P("judgements", "Record the significant professional judgements made, including the alternatives considered and why the position taken was adopted.", "Consigner les jugements professionnels importants, y compris les options envisagées et le motif du choix retenu.", "Working papers · C1.3 · partner review", "Feuilles de travail · C1.3 · revue de l'associé"),
    P("disagreements", "Record any disagreement with management and how it was resolved, including any matter escalated within the firm.", "Consigner tout désaccord avec la direction et sa résolution, y compris les points remontés au sein du cabinet.", "Correspondence · C1.3 · firm policy", "Correspondance · C1.3 · politique du cabinet"),
    P("communicate", "Communicate the significant findings to those charged with governance, including our views on the qualitative aspects of the entity's accounting practices.", "Communiquer les constats significatifs aux responsables de la gouvernance, y compris notre appréciation des aspects qualitatifs des pratiques comptables.", "ISA 260 (Revised) ¶16 · governance communication", "ISA 260 révisée ¶16 · communication à la gouvernance"),
    P("kam", "Where key audit matters apply, select them from the matters communicated to those charged with governance and draft the description of each.", "Lorsque des questions clés s'appliquent, les sélectionner parmi les points communiqués à la gouvernance et rédiger la description de chacune.", "ISA 701 ¶9–13 · C5.1", "ISA 701 ¶9–13 · C5.1"),
  ],
  items: [
    Q("collected", "Every significant matter arising during the audit is recorded here (procedure 1).", "Chaque point significatif relevé au cours de l'audit est consigné ici (procédure 1)."),
    Q("concluded", "Each matter carries the conclusion reached and the reasoning that supports it (procedures 2, 3).", "Chaque point porte la conclusion retenue et le raisonnement qui l'étaye (procédures 2, 3)."),
    Q("resolved", "Every disagreement with management has been resolved (procedure 4).", "Chaque désaccord avec la direction a été résolu (procédure 4).", true),
    Q("communicated", "The significant findings have been communicated to those charged with governance (procedure 5).", "Les constats significatifs ont été communiqués aux responsables de la gouvernance (procédure 5)."),
  ],
  conclEn: [
    "Every significant matter arising has been concluded on, and the conclusions are supported by the evidence in the file.",
  ],
  conclFr: [
    "Chaque point significatif a fait l'objet d'une conclusion, et ces conclusions sont étayées par les éléments du dossier.",
  ],
});

const C1_3 = mk({
  std: "ISQM 1 ¶31 · ISA 220 (Revised) ¶35 · ISA 230 ¶8",
  ownsEn: "the consultations undertaken and the conclusions implemented",
  ownsFr: "les consultations menées et les conclusions mises en œuvre",
  reqEn: [
    "The firm establishes policies requiring consultation on difficult or contentious matters. The engagement partner takes responsibility for consultation being undertaken on such matters, and for the conclusions agreed being implemented (ISA 220 (Revised) ¶35).",
    "The documentation records the matter, who was consulted, the information provided, and the conclusion reached — sufficient for another practitioner to understand the basis on which it was reached.",
  ],
  reqFr: [
    "Le cabinet impose la consultation sur les questions difficiles ou controversées. L'associé responsable veille à ce qu'elle ait lieu et à ce que les conclusions convenues soient mises en œuvre (ISA 220 révisée ¶35).",
    "La documentation consigne la question, la personne consultée, les informations fournies et la conclusion retenue.",
  ],
  procs: [
    P("identify", "Identify the matters requiring consultation under the firm's policy, including those anticipated in S6.2.", "Identifier les questions appelant une consultation selon la politique du cabinet, y compris celles anticipées en S6.2.", "Firm consultation policy · S6.2 · C1.2", "Politique de consultation · S6.2 · C1.2"),
    P("consult", "Consult a person with the appropriate knowledge and experience, and record their name, their role and the date.", "Consulter une personne disposant des connaissances et de l'expérience appropriées et consigner son nom, sa fonction et la date.", "Consultation note · firm technical function", "Note de consultation · service technique du cabinet"),
    P("information", "Record the information provided to the person consulted, and confirm it was complete and accurate.", "Consigner les informations fournies à la personne consultée et vérifier leur exhaustivité et leur exactitude.", "Consultation note · supporting working papers", "Note de consultation · feuilles de travail justificatives"),
    P("conclusion", "Record the conclusion reached and agree it with the person consulted.", "Consigner la conclusion retenue et la faire valider par la personne consultée.", "Consultation note countersigned", "Note de consultation contresignée"),
    P("implement", "Confirm that the conclusion agreed has been implemented in the file and in the financial statements.", "Vérifier que la conclusion convenue a été mise en œuvre dans le dossier et dans les états financiers.", "Working papers · draft financial statements", "Feuilles de travail · projet d'états financiers"),
    P("external", "Where the matter was referred outside the firm, record the terms on which the external advice was obtained.", "Lorsque la question a été soumise hors du cabinet, consigner les conditions d'obtention de l'avis externe.", "External adviser's terms and opinion", "Termes et avis du conseil externe", ),
  ],
  items: [
    Q("undertaken", "Consultation was undertaken on every matter the firm's policy requires (procedure 1).", "Une consultation a été menée sur chaque question requise par la politique du cabinet (procédure 1)."),
    Q("complete_info", "The person consulted was given complete and accurate information (procedure 3).", "La personne consultée a reçu des informations complètes et exactes (procédure 3)."),
    Q("agreed", "The conclusion is agreed with the person consulted (procedure 4).", "La conclusion est validée par la personne consultée (procédure 4)."),
    Q("implemented", "Every conclusion agreed has been implemented (procedure 5).", "Chaque conclusion convenue a été mise en œuvre (procédure 5)."),
  ],
  conclEn: [
    "Consultation has been undertaken on every matter that required it, and the conclusions agreed have been implemented.",
  ],
  conclFr: [
    "Une consultation a été menée sur chaque question l'exigeant, et les conclusions convenues ont été mises en œuvre.",
  ],
  outcome: false,
});

/* =============================== subsequent events & going concern (C3) == */

const C2_2 = mk({
  std: "ISA 560 ¶6–17 · ISA 570 (Revised) ¶21–24",
  ownsEn: "the subsequent events and going concern conclusions at completion",
  ownsFr: "les conclusions sur les événements postérieurs et la continuité à l'achèvement",
  reqEn: [
    "The subsequent events procedures cover the period to the date of the auditor's report, and are performed as near as practicable to that date (ISA 560 ¶7). After the report is dated we have no obligation to perform procedures, but where a fact becomes known that would have caused us to amend the report, we act on it (ISA 560 ¶10–13).",
    "The going concern conclusion determines whether the basis of accounting is appropriate and whether a material uncertainty exists, and drives the corresponding section of the report (ISA 570 (Revised) ¶21–24).",
  ],
  reqFr: [
    "Les procédures sur les événements postérieurs couvrent la période jusqu'à la date du rapport et sont mises en œuvre au plus près de celle-ci (ISA 560 ¶7). Après cette date, un fait qui nous aurait conduits à modifier le rapport appelle une action (ISA 560 ¶10–13).",
    "La conclusion sur la continuité détermine le caractère approprié de la base comptable et l'existence d'une incertitude significative (ISA 570 révisée ¶21–24).",
  ],
  procs: [
    P("extend", "Extend the procedures performed in E6.6 to the date of the auditor's report, and record the date to which they extend.", "Prolonger les procédures de E6.6 jusqu'à la date du rapport et consigner la date de fin de couverture.", "E6.6 · inquiry · post year-end records", "E6.6 · entretien · enregistrements postérieurs"),
    P("inquire", "Inquire of management and of those charged with governance immediately before the report is dated about any event since the last inquiry.", "S'enquérir auprès de la direction et de la gouvernance, juste avant la date du rapport, de tout événement survenu depuis le dernier entretien.", "Final inquiry note · ISA 560 ¶7(b)", "Note d'entretien final · ISA 560 ¶7(b)"),
    P("minutes", "Read the minutes of any meeting held since the last reading, up to the date of the report.", "Examiner les procès-verbaux des réunions tenues depuis le dernier examen, jusqu'à la date du rapport.", "Post year-end minutes (E6.4)", "Procès-verbaux postérieurs (E6.4)"),
    P("classify", "Classify each event identified as adjusting or non-adjusting, and confirm the treatment or disclosure in the financial statements.", "Classer chaque événement identifié en ajustant ou non ajustant et vérifier son traitement ou sa mention.", "IAS 10 / SYSCOHADA · draft financial statements", "IAS 10 / SYSCOHADA · projet d'états financiers"),
    P("gc_conclude", "Conclude on going concern from the work in E6.3: whether the basis of accounting is appropriate and whether a material uncertainty exists.", "Conclure sur la continuité à partir des travaux de E6.3 : caractère approprié de la base comptable et existence d'une incertitude significative.", "E6.3 · management's assessment · ISA 570 ¶21", "E6.3 · évaluation de la direction · ISA 570 ¶21"),
    P("gc_disclosure", "Where a material uncertainty exists, confirm the financial statements adequately disclose the events and conditions and state that a material uncertainty exists.", "En cas d'incertitude significative, vérifier que les états financiers décrivent de façon appropriée les événements et conditions et mentionnent l'existence de cette incertitude.", "Draft financial statements · ISA 570 ¶22", "Projet d'états financiers · ISA 570 ¶22"),
    P("representation", "Obtain the written representation covering subsequent events and management's plans for future action on going concern.", "Obtenir la déclaration écrite couvrant les événements postérieurs et les plans d'action de la direction sur la continuité.", "C3.1 · ISA 570 ¶16(e)", "C3.1 · ISA 570 ¶16(e)"),
  ],
  items: [
    Q("to_date", "The procedures extend to the date of the auditor's report (procedures 1 to 3).", "Les procédures couvrent la période jusqu'à la date du rapport (procédures 1 à 3)."),
    Q("treated", "Every adjusting event has been reflected and every non-adjusting event of significance has been disclosed (procedure 4).", "Chaque événement ajustant a été traduit dans les comptes et chaque événement non ajustant significatif a été mentionné (procédure 4)."),
    Q("basis", "The going concern basis of accounting is appropriate (procedure 5).", "La base comptable de continuité d'exploitation est appropriée (procédure 5)."),
    Q("no_uncertainty", "No material uncertainty related to going concern exists (procedure 5). A “No” requires the disclosure and the report section to be prepared.", "Aucune incertitude significative liée à la continuité n'existe (procédure 5). Un « Non » impose l'annexe et la section correspondante du rapport."),
  ],
  conclEn: [
    "The subsequent events procedures extend to the date of the auditor's report and every event identified has been adjusted or disclosed as required.",
    "The conclusions on going concern and their effect on the auditor's report have been determined and carried to C5.1.",
  ],
  conclFr: [
    "Les procédures sur les événements postérieurs couvrent la période jusqu'à la date du rapport et chaque événement relevé a été ajusté ou mentionné.",
    "Les conclusions sur la continuité et leur effet sur le rapport ont été déterminés et reportés en C5.1.",
  ],
});

/* ================================ representations & confirmations (C4) === */

const C3_1 = mk({
  std: "ISA 580 ¶6–20 · ISA 450 ¶14 · ISA 260 ¶16(c)(ii)",
  ownsEn: "the written representations obtained",
  ownsFr: "les déclarations écrites obtenues",
  reqEn: [
    "We request written representations that management has fulfilled its responsibilities: the preparation of the financial statements in accordance with the framework, the internal control it determined necessary, and the completeness of the transactions recorded and of the information and access provided (ISA 580 ¶10–11). These responsibility acknowledgements are never qualified by knowledge and belief; a qualifier of that kind is acceptable only on factual representations, and only from signatories with appropriate responsibility and knowledge (ISA 580 ¶13, A26).",
    "The letter also carries the representations required by the other ISAs applicable to the engagement — fraud (ISA 240 ¶39), laws and regulations (ISA 250 ¶16), related parties (ISA 550 ¶26), going concern (ISA 570 ¶16(e)), estimates (ISA 540 ¶37), litigation, subsequent events (ISA 560 ¶9) — and the representation that uncorrected misstatements are immaterial, with the summary of audit differences attached or included (ISA 450 ¶14, ISA 580 A10).",
    "Written representations are necessary evidence but never sufficient on their own; where they are inconsistent with other evidence we investigate, and where doubt about management's integrity remains unresolved we reconsider the risk assessments and the reliability of every representation, written and oral (ISA 580 ¶4, ¶16–17). A refused representation is discussed with those charged with governance, management's integrity re-evaluated, and the effect on the opinion determined — a refusal on the ISA 580 ¶10–11 responsibilities compels a disclaimer (ISA 580 ¶19–20).",
    "The letter covers every period referred to in the report, including periods before current management took office — being absent then does not reduce their responsibility now (ISA 580 ¶14, A15). It is dated as near as practicable to, but not after, the auditor's report; a delayed approval of the financial statements or a reissued report calls for an updated letter (ISA 580 ¶14, ISA 560 ¶13).",
  ],
  reqFr: [
    "Nous demandons des déclarations écrites attestant que la direction a rempli ses responsabilités : l'établissement des états financiers conformément au référentiel, le contrôle interne qu'elle a jugé nécessaire, et l'exhaustivité des opérations comptabilisées et des informations et accès fournis (ISA 580 ¶10–11). Ces reconnaissances de responsabilité ne se limitent jamais « à la connaissance » de la direction ; une telle réserve n'est admissible que sur des déclarations factuelles, et seulement de signataires ayant la responsabilité et la connaissance appropriées (ISA 580 ¶13, A26).",
    "La lettre porte aussi les déclarations requises par les autres normes applicables — fraude (ISA 240 ¶39), textes légaux (ISA 250 ¶16), parties liées (ISA 550 ¶26), continuité (ISA 570 ¶16(e)), estimations (ISA 540 ¶37), litiges, événements postérieurs (ISA 560 ¶9) — et la déclaration que les anomalies non corrigées sont non significatives, avec le récapitulatif des écarts d'audit joint ou repris (ISA 450 ¶14, ISA 580 A10).",
    "Les déclarations écrites sont nécessaires mais jamais suffisantes à elles seules ; toute incohérence avec d'autres éléments est investiguée, et si un doute sur l'intégrité de la direction subsiste, nous réexaminons l'évaluation des risques et la fiabilité de toutes les déclarations, écrites et orales (ISA 580 ¶4, ¶16–17). Un refus est discuté avec la gouvernance, l'intégrité réévaluée et l'effet sur l'opinion déterminé — un refus sur les responsabilités de l'ISA 580 ¶10–11 impose une impossibilité d'exprimer une opinion (ISA 580 ¶19–20).",
    "La lettre couvre chaque période visée par le rapport, y compris celles antérieures à la prise de fonction de la direction actuelle — son absence alors ne réduit pas sa responsabilité aujourd'hui (ISA 580 ¶14, A15). Elle est datée aussi près que possible du rapport, sans lui être postérieure ; une approbation tardive des comptes ou un rapport réémis appelle une lettre actualisée (ISA 580 ¶14, ISA 560 ¶13).",
  ],
  procs: [
    P("schedule", "List the representations required: the ISA 580 responsibility acknowledgements plus those required by each other ISA applicable to this engagement.", "Recenser les déclarations requises : les reconnaissances de responsabilité de l'ISA 580 et celles imposées par chaque autre norme applicable.", "ISA 580 ¶10–11 · ISA-by-ISA checklist", "ISA 580 ¶10–11 · liste par norme"),
    P("specific", "Add the representations specific to this engagement — uncorrected misstatements with the SAD attached, litigation and claims, related parties, going concern, estimates and subsequent events — and any judged necessary to support other evidence.", "Ajouter les déclarations propres à la mission — anomalies non corrigées avec le SAD joint, litiges, parties liées, continuité, estimations et événements postérieurs — et toute autre jugée nécessaire.", "SAD tool · C1.1 · E4.15 · E6.2 · E6.3 · C2.2", "Outil SAD · C1.1 · E4.15 · E6.2 · E6.3 · C2.2"),
    P("materiality", "Where representations are limited to material matters, agree the threshold with management and state it in the letter — never on the responsibility acknowledgements.", "Lorsque des déclarations sont limitées aux éléments significatifs, convenir du seuil avec la direction et l'indiquer dans la lettre — jamais sur les reconnaissances de responsabilité.", "P6.1 materiality · ISA 580 A14", "Seuil P6.1 · ISA 580 A14"),
    P("signatories", "Identify the signatories: those responsible for the financial statements with appropriate knowledge — normally the general manager and the finance director; add signers or a separate letter for matters known only to others.", "Identifier les signataires : les responsables des états financiers disposant de la connaissance appropriée — en principe le dirigeant et le directeur financier ; ajouter des signataires ou une lettre séparée pour les questions connues d'autres personnes.", "Statutes · delegation of authority · minutes", "Statuts · délégations de pouvoirs · procès-verbaux"),
    P("draft", "Have the engagement partner review the draft letter before it goes to management — all required representations present, correct signatories, correct dating — and again if management changes the wording.", "Faire revoir le projet de lettre par l'associé avant envoi à la direction — déclarations requises présentes, signataires et datation corrects — et de nouveau si la direction en modifie la rédaction.", "Draft letter · partner review evidence", "Projet de lettre · trace de revue de l'associé"),
    P("date", "Obtain the signed letter dated as near as practicable to, and not after, the date of the auditor's report; compare the signed letter against the approved draft.", "Obtenir la lettre signée à une date aussi proche que possible de celle du rapport, sans lui être postérieure ; comparer la lettre signée au projet approuvé.", "Signed representation letter", "Lettre d'affirmation signée"),
    P("periods", "Confirm the letter covers every period referred to in the report; where management took office during the period, still obtain representations for the whole of it.", "Vérifier que la lettre couvre chaque période visée par le rapport ; si la direction a pris ses fonctions en cours de période, obtenir néanmoins des déclarations sur toute la période.", "ISA 580 ¶14 · prior-period file", "ISA 580 ¶14 · dossier N-1"),
    P("consistency", "Compare the representations with the other evidence obtained; investigate and resolve any inconsistency, and reassess the affected risks where the explanation fails.", "Comparer les déclarations aux autres éléments obtenus ; investiguer toute incohérence et réévaluer les risques concernés si l'explication ne tient pas.", "Working papers · ISA 580 ¶17 · S3.1", "Feuilles de travail · ISA 580 ¶17 · S3.1"),
    P("refusal", "Where a requested representation is refused or unreliable, discuss with those charged with governance, re-evaluate management's integrity and the reliability of all representations, and determine the effect on the opinion.", "En cas de refus ou de doute sur une déclaration, en discuter avec la gouvernance, réévaluer l'intégrité de la direction et la fiabilité de toutes les déclarations, et déterminer l'effet sur l'opinion.", "ISA 580 ¶19–20 · C5.1", "ISA 580 ¶19–20 · C5.1"),
    P("update", "Where the financial statements' approval is delayed or the report is reissued, obtain an updated letter stating whether any representation needs modification and whether subsequent events require adjustment or disclosure.", "En cas d'approbation tardive des comptes ou de réémission du rapport, obtenir une lettre actualisée précisant si une déclaration doit être modifiée et si des événements postérieurs appellent ajustement ou information.", "ISA 580 ¶14 · ISA 560 ¶13 · C2.2", "ISA 580 ¶14 · ISA 560 ¶13 · C2.2"),
  ],
  items: [
    Q("complete", "Every representation required by the ISAs applicable to this engagement has been requested, including the uncorrected-misstatements representation with the SAD attached (procedures 1, 2).", "Chaque déclaration requise par les normes applicables a été demandée, dont celle sur les anomalies non corrigées avec le SAD joint (procédures 1, 2)."),
    Q("unqualified", "No responsibility acknowledgement is qualified by knowledge and belief (procedure 3).", "Aucune reconnaissance de responsabilité n'est limitée « à la connaissance » de la direction (procédure 3)."),
    Q("signed", "The letter is signed by the persons with responsibility and appropriate knowledge (procedure 4).", "La lettre est signée par les personnes responsables et disposant de la connaissance appropriée (procédure 4)."),
    Q("reviewed", "The engagement partner reviewed the draft before it went to management, and any change management made to it (procedure 5).", "L'associé a revu le projet avant envoi à la direction, ainsi que toute modification apportée par elle (procédure 5)."),
    Q("dated", "The letter is dated no later than the date of the auditor's report and covers every period the report refers to (procedures 6, 7).", "La lettre n'est pas datée postérieurement au rapport et couvre chaque période visée (procédures 6, 7)."),
    Q("consistent", "The representations are consistent with the other evidence obtained (procedure 8).", "Les déclarations concordent avec les autres éléments obtenus (procédure 8)."),
    Q("updated", "Where approval was delayed or the report reissued, an updated letter was obtained (procedure 10).", "En cas d'approbation tardive ou de réémission, une lettre actualisée a été obtenue (procédure 10).", true),
  ],
  conclEn: [
    "The written representations required have been obtained, are appropriately dated and signed by the right persons, carry the summary of audit differences, and are consistent with the other audit evidence.",
  ],
  conclFr: [
    "Les déclarations écrites requises ont été obtenues, correctement datées et signées par les bonnes personnes, portent le récapitulatif des écarts d'audit et concordent avec les autres éléments probants.",
  ],
});

const C4_2 = mk({
  std: "ISQM 2 ¶19–26 · ISA 220 (Revised) ¶36 · ISA 260 (Revised) · ISA 265",
  ownsEn: "the engagement quality review and the communications to those charged with governance",
  ownsFr: "la revue de qualité de la mission et les communications à la gouvernance",
  reqEn: [
    "The engagement quality reviewer performs an objective evaluation of the significant judgements made by the engagement team and the conclusions reached. The auditor's report is not dated until the review is complete (ISQM 2 ¶25–26).",
    "We communicate to those charged with governance our responsibilities, the planned scope and timing, the significant findings, and our independence, on a timely basis (ISA 260 (Revised) ¶14–17). Significant deficiencies in internal control are communicated in writing (ISA 265 ¶9).",
  ],
  reqFr: [
    "Le responsable de la revue de qualité procède à une évaluation objective des jugements importants et des conclusions retenues. Le rapport n'est pas daté avant l'achèvement de la revue (ISQM 2 ¶25–26).",
    "Nous communiquons à la gouvernance nos responsabilités, l'étendue et le calendrier prévus, les constats significatifs et notre indépendance (ISA 260 révisée ¶14–17). Les déficiences significatives du contrôle interne sont communiquées par écrit (ISA 265 ¶9).",
  ],
  procs: [
    P("required", "Confirm from P1.5 whether an engagement quality review is required, and the identity of the reviewer appointed.", "Confirmer à partir de P1.5 si une revue de qualité est requise et l'identité du responsable désigné.", "P1.5 · firm records", "P1.5 · dossiers du cabinet"),
    P("scope", "Provide the reviewer with the significant judgements, the significant risks and the conclusions reached, and record what was provided.", "Mettre à disposition du responsable les jugements importants, les risques importants et les conclusions retenues, et consigner ce qui a été fourni.", "C1.2 · S3.1 · working papers", "C1.2 · S3.1 · feuilles de travail"),
    P("review", "Record the reviewer's evaluation, the matters raised, the responses given, and confirm each has been resolved.", "Consigner l'évaluation du responsable, les points soulevés, les réponses apportées et vérifier leur résolution.", "Reviewer's notes · our responses", "Notes du responsable · nos réponses"),
    P("completion", "Confirm the review is complete and record its date, which must not be later than the date of the auditor's report.", "Confirmer l'achèvement de la revue et consigner sa date, qui ne peut être postérieure à celle du rapport.", "ISQM 2 ¶25 · reviewer's confirmation", "ISQM 2 ¶25 · confirmation du responsable"),
    P("planning_comm", "Confirm the planning communication to those charged with governance was made, covering our responsibilities and the planned scope and timing.", "Vérifier que la communication de planification à la gouvernance a été faite, couvrant nos responsabilités et l'étendue et le calendrier prévus.", "ISA 260 (Revised) ¶14–15 · correspondence", "ISA 260 révisée ¶14–15 · correspondance"),
    P("findings_comm", "Communicate the significant findings, including our views on the qualitative aspects of the accounting practices and any significant difficulty encountered.", "Communiquer les constats significatifs, y compris notre appréciation des aspects qualitatifs des pratiques comptables et toute difficulté importante rencontrée.", "ISA 260 ¶16 · C1.2 · governance letter", "ISA 260 ¶16 · C1.2 · lettre à la gouvernance"),
    P("independence", "Confirm our independence to those charged with governance in writing, listing the relationships and the safeguards applied.", "Confirmer par écrit notre indépendance à la gouvernance, en listant les relations et les sauvegardes appliquées.", "P2.1 · ISA 260 ¶17 · independence letter", "P2.1 · ISA 260 ¶17 · lettre d'indépendance"),
    P("deficiencies", "Communicate the significant deficiencies in internal control in writing, describing each and explaining its potential effect.", "Communiquer par écrit les déficiences significatives du contrôle interne, en décrivant chacune et son effet potentiel.", "ISA 265 ¶9 · P4.1 · management letter", "ISA 265 ¶9 · P4.1 · lettre de recommandations"),
  ],
  items: [
    Q("complete", "Where required, the engagement quality review is complete and dated no later than the auditor's report (procedures 3, 4).", "Lorsqu'elle est requise, la revue de qualité est achevée et datée au plus tard à la date du rapport (procédures 3, 4).", true),
    Q("resolved", "Every matter raised by the reviewer has been resolved (procedure 3).", "Chaque point soulevé par le responsable de la revue a été résolu (procédure 3).", true),
    Q("planning", "The planning communication to those charged with governance was made (procedure 5).", "La communication de planification à la gouvernance a été faite (procédure 5)."),
    Q("findings", "The significant findings and our independence have been communicated (procedures 6, 7).", "Les constats significatifs et notre indépendance ont été communiqués (procédures 6, 7)."),
    Q("deficiencies", "Every significant deficiency in internal control has been communicated in writing (procedure 8).", "Chaque déficience significative du contrôle interne a été communiquée par écrit (procédure 8).", true),
  ],
  conclEn: [
    "Where required, the engagement quality review is complete and no matter remains unresolved.",
    "The communications to those charged with governance required by the ISAs have been made.",
  ],
  conclFr: [
    "Lorsqu'elle est requise, la revue de qualité est achevée et aucun point ne reste non résolu.",
    "Les communications à la gouvernance requises par les normes ont été effectuées.",
  ],
  outcome: false,
});

const C5_1 = mk({
  std: "ISA 700 (Revised) · ISA 701 · ISA 705 (Revised) · ISA 706 (Revised) · ISA 710 · ISA 720 (Revised)",
  ownsEn: "the opinion and the auditor's report",
  ownsFr: "l'opinion et le rapport de l'auditeur",
  reqEn: [
    "We form an opinion on whether the financial statements are prepared, in all material respects, in accordance with the applicable financial reporting framework, and evaluate whether sufficient appropriate audit evidence has been obtained (ISA 700 (Revised) ¶10–15).",
    "Where the financial statements are materially misstated, or we are unable to obtain sufficient appropriate evidence, we modify the opinion, choosing between a qualified opinion, an adverse opinion and a disclaimer according to the pervasiveness of the matter (ISA 705 (Revised) ¶7–10).",
  ],
  reqFr: [
    "Nous formons une opinion sur la conformité des états financiers, dans tous leurs aspects significatifs, au référentiel applicable, et apprécions si des éléments probants suffisants et appropriés ont été obtenus (ISA 700 révisée ¶10–15).",
    "En cas d'anomalie significative ou d'impossibilité d'obtenir des éléments suffisants, nous modifions l'opinion, entre opinion avec réserve, défavorable ou impossibilité d'exprimer une opinion, selon le caractère diffus du point (ISA 705 révisée ¶7–10).",
  ],
  procs: [
    P("evidence", "Confirm from C4.1 that sufficient appropriate audit evidence has been obtained and that the file supports every conclusion.", "Confirmer à partir de C4.1 que des éléments probants suffisants et appropriés ont été obtenus et que le dossier étaye chaque conclusion.", "C4.1 · partner review", "C4.1 · revue de l'associé"),
    P("misstatements", "Determine the effect of the uncorrected misstatements in C1.1 on the opinion, individually and in aggregate.", "Déterminer l'effet des anomalies non corrigées de C1.1 sur l'opinion, isolément et cumulées.", "C1.1 · P6.1 materiality", "C1.1 · seuil P6.1"),
    P("opinion", "Determine the opinion. Where it is modified, establish whether the matter is material but not pervasive, or material and pervasive, and select the form of modification accordingly.", "Déterminer l'opinion. En cas de modification, établir si le point est significatif sans être diffus, ou significatif et diffus, et retenir la forme correspondante.", "ISA 705 (Revised) ¶7–10 · C1.1 · C1.2", "ISA 705 révisée ¶7–10 · C1.1 · C1.2"),
    P("components", "Confirm each component required by ISA 700 (Revised) is present in the drafted report, in the order and with the headings the standard requires.", "Vérifier la présence de chaque composante requise par l'ISA 700 révisée dans le projet de rapport, dans l'ordre et avec les intitulés prescrits.", "ISA 700 (Revised) ¶21–49 · report component checklist", "ISA 700 révisée ¶21–49 · liste des composantes"),
    P("going_concern", "Where a material uncertainty related to going concern exists, include the separate section required and confirm it refers to the note in the financial statements.", "En cas d'incertitude significative liée à la continuité, inclure la section distincte requise et vérifier son renvoi à la note des états financiers.", "C2.2 · E6.3 · ISA 570 (Revised) ¶22", "C2.2 · E6.3 · ISA 570 révisée ¶22"),
    P("kam", "Where key audit matters apply, include the description of each drafted in C1.2, explaining why the matter was of most significance and how it was addressed.", "Lorsque des questions clés s'appliquent, inclure la description rédigée en C1.2, en expliquant l'importance du point et la façon dont il a été traité.", "C1.2 · ISA 701 ¶13", "C1.2 · ISA 701 ¶13"),
    P("emphasis", "Determine whether an emphasis of matter or other matter paragraph is required, and confirm it does not substitute for a modification or a required disclosure.", "Déterminer si un paragraphe d'observation ou sur d'autres points est requis et vérifier qu'il ne se substitue pas à une modification ou à une information requise.", "ISA 706 (Revised) ¶8–10", "ISA 706 révisée ¶8–10"),
    P("other_info", "Include the other information section, stating what was read and whether a material inconsistency was identified.", "Inclure la section sur les autres informations, en indiquant ce qui a été examiné et si une incohérence significative a été relevée.", "C2.1 · ISA 720 (Revised) ¶21–24", "C2.1 · ISA 720 révisée ¶21–24"),
    P("statutory", "Include the report on other legal and regulatory requirements required of a commissaire aux comptes, and cross-refer to the statutory papers C5.2 to C5.9.", "Inclure le rapport sur les autres obligations légales et réglementaires incombant au commissaire aux comptes et renvoyer aux feuilles statutaires C5.2 à C5.9.", "OHADA Uniform Act · C5.2–C5.9", "Acte uniforme OHADA · C5.2–C5.9"),
    P("date", "Date the report no earlier than the date on which sufficient appropriate evidence was obtained, including the approval of the financial statements by those with authority.", "Dater le rapport au plus tôt à la date d'obtention des éléments suffisants, y compris l'approbation des états financiers par l'organe compétent.", "ISA 700 (Revised) ¶49 · approval minutes · C3.1", "ISA 700 révisée ¶49 · procès-verbal d'approbation · C3.1"),
  ],
  items: [
    Q("sufficient", "Sufficient appropriate audit evidence has been obtained to support the opinion (procedure 1).", "Des éléments probants suffisants et appropriés ont été obtenus pour étayer l'opinion (procédure 1)."),
    Q("unmodified", "The opinion is unmodified (procedures 2, 3). A “No” requires the basis for modification to be drafted and the form justified.", "L'opinion n'est pas modifiée (procédures 2, 3). Un « Non » impose de rédiger le fondement de la modification et d'en justifier la forme."),
    Q("components", "Every component required by ISA 700 (Revised) is present (procedure 4).", "Chaque composante requise par l'ISA 700 révisée est présente (procédure 4)."),
    Q("dated", "The report is dated no earlier than the date the financial statements were approved by those with authority (procedure 10).", "Le rapport n'est pas daté antérieurement à l'approbation des états financiers par l'organe compétent (procédure 10)."),
    Q("eqr", "Where an engagement quality review is required, it was complete before the report was dated (C4.2).", "Lorsqu'une revue de qualité est requise, elle était achevée avant la date du rapport (C4.2).", true),
  ],
  conclEn: [
    "The opinion recorded here is supported by the evidence in the file, and the report as drafted complies with the ISAs and with the requirements applicable to a statutory appointment.",
  ],
  conclFr: [
    "L'opinion consignée est étayée par les éléments du dossier, et le rapport tel que rédigé est conforme aux normes et aux obligations du mandat légal.",
  ],
});

/* ================================ legal & statutory, OHADA (C6) ========== */

const C5_2 = mk({
  std: "OHADA — Acte uniforme relatif au droit des sociétés commerciales et du GIE",
  ownsEn: "the statutory deadlines and whether each was met",
  ownsFr: "les échéances légales et leur respect",
  reqEn: [
    "The Uniform Act fixes the dates by which the accounts must be drawn up, the general meeting held, the accounts approved and the filing made. A missed deadline is a matter to report, and may engage the liability of the directors.",
    "The calendar is maintained through the engagement so that the reporting obligations of the commissaire aux comptes are met on time.",
  ],
  reqFr: [
    "L'Acte uniforme fixe les dates d'arrêté des comptes, de tenue de l'assemblée, d'approbation et de dépôt. Une échéance manquée est un point à signaler et peut engager la responsabilité des dirigeants.",
    "Le calendrier est tenu tout au long de la mission afin que les obligations du commissaire aux comptes soient remplies dans les délais.",
  ],
  procs: [
    P("calendar", "Establish the statutory calendar for the period: the date the accounts must be drawn up, the date of the general meeting, and the filing deadline.", "Établir le calendrier légal de l'exercice : date d'arrêté des comptes, date de l'assemblée générale et échéance de dépôt.", "Uniform Act · statutes · financial year end", "Acte uniforme · statuts · date de clôture"),
    P("board", "Confirm the date the board drew up the accounts, and compare it with the deadline.", "Confirmer la date d'arrêté des comptes par le conseil et la comparer à l'échéance.", "Board minutes (E6.4) · signed accounts", "Procès-verbal du conseil (E6.4) · comptes signés"),
    P("notice", "Confirm the notice period given for the general meeting and that the documents required were made available to the shareholders.", "Vérifier le délai de convocation de l'assemblée et la mise à disposition des documents requis aux associés.", "Convening notice · shareholder correspondence", "Avis de convocation · correspondance aux associés"),
    P("report_dates", "Record the dates by which our own reports are due, including the general report and the special report on conventions réglementées.", "Consigner les dates auxquelles nos propres rapports sont dus, dont le rapport général et le rapport spécial sur les conventions réglementées.", "Uniform Act · C5.3 · engagement timetable", "Acte uniforme · C5.3 · calendrier de mission"),
    P("filing", "Confirm the prior period accounts were filed with the RCCM within the deadline, and obtain the filing receipt.", "Vérifier le dépôt des comptes de l'exercice précédent au RCCM dans le délai et obtenir le récépissé.", "RCCM filing receipt · prior period accounts", "Récépissé de dépôt RCCM · comptes antérieurs"),
    P("breaches", "Record each deadline missed, the reason, and whether it is to be reported to the general meeting.", "Consigner chaque échéance manquée, son motif et son éventuel signalement à l'assemblée.", "Our observation schedule · C5.1", "Notre relevé d'observations · C5.1"),
  ],
  items: [
    Q("drawn_up", "The accounts were drawn up by the board within the statutory deadline (procedure 2).", "Les comptes ont été arrêtés par le conseil dans le délai légal (procédure 2)."),
    Q("notice", "The general meeting was convened with the notice the statutes and the Uniform Act require (procedure 3).", "L'assemblée a été convoquée dans les formes et délais requis par les statuts et l'Acte uniforme (procédure 3)."),
    Q("filed", "The prior period accounts were filed with the RCCM within the deadline (procedure 5).", "Les comptes de l'exercice précédent ont été déposés au RCCM dans le délai (procédure 5)."),
  ],
  conclEn: [
    "The statutory deadlines applicable to the entity have been identified and the position on each is recorded, and any breach has been carried into our report.",
  ],
  conclFr: [
    "Les échéances légales applicables ont été identifiées et leur situation consignée, et tout manquement est repris dans notre rapport.",
  ],
});

const C5_3 = mk({
  std: "OHADA — Acte uniforme sociétés commerciales, conventions réglementées · ISA 550",
  ownsEn: "the register of regulated agreements and the special report",
  ownsFr: "le registre des conventions réglementées et le rapport spécial",
  reqEn: [
    "An agreement between the company and one of its directors or a significant shareholder, entered into other than on normal terms in the ordinary course of business, requires prior authorisation and must be reported on separately by the commissaire aux comptes.",
    "The special report describes each agreement, the persons concerned, the terms and the reason it was entered into, so that the general meeting can decide on it with the facts before it.",
  ],
  reqFr: [
    "Une convention entre la société et l'un de ses dirigeants ou un actionnaire significatif, conclue hors des conditions normales et de l'activité courante, requiert une autorisation préalable et fait l'objet d'un rapport spécial du commissaire aux comptes.",
    "Le rapport spécial décrit chaque convention, les personnes concernées, les conditions et le motif de sa conclusion, afin que l'assemblée statue en connaissance de cause.",
  ],
  procs: [
    P("notify", "Obtain from the directors the list of agreements they are required to notify, and the date of each notification.", "Obtenir des dirigeants la liste des conventions qu'ils sont tenus de communiquer et la date de chaque communication.", "Directors' notifications · board minutes", "Communications des dirigeants · procès-verbaux du conseil"),
    P("search", "Search independently for agreements not notified, using the related party register, the minutes and the ledger.", "Rechercher de façon indépendante les conventions non communiquées, à partir du registre des parties liées, des procès-verbaux et du grand livre.", "S4.3 · E6.2 · minutes (E6.4) · general ledger", "S4.3 · E6.2 · procès-verbaux (E6.4) · grand livre"),
    P("authorisation", "For each agreement, confirm the prior authorisation of the board and that the interested person did not take part in the vote.", "Pour chaque convention, vérifier l'autorisation préalable du conseil et l'abstention de la personne intéressée lors du vote.", "Board minutes · attendance register", "Procès-verbaux du conseil · feuille de présence"),
    P("terms", "Obtain the terms of each agreement: the parties, the object, the price, the duration, and the amounts recorded in the period.", "Obtenir les conditions de chaque convention : parties, objet, prix, durée et montants comptabilisés sur l'exercice.", "Agreements · general ledger · E6.2", "Conventions · grand livre · E6.2"),
    P("continuing", "Identify the agreements authorised in prior periods that continued in force during this one, and confirm each is included in the report.", "Identifier les conventions autorisées lors d'exercices antérieurs et poursuivies sur celui-ci, et vérifier leur inclusion dans le rapport.", "Prior special reports · agreements", "Rapports spéciaux antérieurs · conventions"),
    P("draft", "Draft the special report describing each agreement, the persons concerned, the terms and the reason it was entered into.", "Rédiger le rapport spécial décrivant chaque convention, les personnes concernées, les conditions et le motif de sa conclusion.", "Our special report · Uniform Act", "Notre rapport spécial · Acte uniforme"),
    P("unauthorised", "Where an agreement was entered into without the prior authorisation required, record it and report it to the general meeting.", "Lorsqu'une convention a été conclue sans l'autorisation préalable requise, la consigner et la signaler à l'assemblée.", "Uniform Act · our special report", "Acte uniforme · notre rapport spécial"),
  ],
  items: [
    Q("notified", "Every agreement identified was notified by the directors as required (procedures 1, 2).", "Chaque convention identifiée a été communiquée par les dirigeants comme requis (procédures 1, 2)."),
    Q("authorised", "Every agreement received the prior authorisation of the board (procedure 3).", "Chaque convention a reçu l'autorisation préalable du conseil (procédure 3)."),
    Q("abstained", "The interested person abstained from the vote on each agreement (procedure 3).", "La personne intéressée s'est abstenue lors du vote sur chaque convention (procédure 3).", true),
    Q("complete", "The special report covers every agreement in force during the period, including those authorised in prior periods (procedures 5, 6).", "Le rapport spécial couvre chaque convention en vigueur sur l'exercice, y compris celles autorisées antérieurement (procédures 5, 6)."),
  ],
  conclEn: [
    "The regulated agreements have been identified and the special report covers each of them, including any entered into without the prior authorisation required.",
  ],
  conclFr: [
    "Les conventions réglementées ont été identifiées et le rapport spécial couvre chacune d'elles, y compris celles conclues sans l'autorisation préalable requise.",
  ],
});

const C5_4 = mk({
  std: "OHADA — Acte uniforme sociétés commerciales, article 715",
  ownsEn: "the report of our observations to the board",
  ownsFr: "le rapport de nos observations au conseil",
  reqEn: [
    "The commissaire aux comptes reports to the board on the verifications carried out, the items examined, the irregularities and inaccuracies identified, and the conclusions drawn from those observations on the results of the period compared with the prior period.",
    "The report is made in writing so that the board has the matters before it before the accounts are put to the general meeting.",
  ],
  reqFr: [
    "Le commissaire aux comptes rend compte au conseil des contrôles effectués, des postes examinés, des irrégularités et inexactitudes relevées, et des conclusions tirées de ces observations sur les résultats de l'exercice comparés au précédent.",
    "Ce rapport est écrit, afin que le conseil dispose de ces éléments avant la présentation des comptes à l'assemblée.",
  ],
  procs: [
    P("verifications", "Record the verifications carried out and the items of the financial statements examined.", "Consigner les contrôles effectués et les postes des états financiers examinés.", "Audit programme · working papers · C4.1", "Programme de travail · feuilles de travail · C4.1"),
    P("irregularities", "List the irregularities and inaccuracies identified, and cross-refer each to the working paper that records it.", "Recenser les irrégularités et inexactitudes relevées et les renvoyer à la feuille de travail correspondante.", "C1.1 · C1.2 · E6.1 · working papers", "C1.1 · C1.2 · E6.1 · feuilles de travail"),
    P("comparison", "Set out the conclusions drawn from the observations on the results of the period compared with the prior period.", "Exposer les conclusions tirées des observations sur les résultats de l'exercice comparés au précédent.", "C2.1 · analytical review · prior financial statements", "C2.1 · revue analytique · états financiers antérieurs"),
    P("changes", "Record any change in presentation or in accounting method, and its effect.", "Consigner tout changement de présentation ou de méthode comptable et son incidence.", "P3.1 · C2.1 · policy note", "P3.1 · C2.1 · note de méthodes"),
    P("send", "Send the report to the board and record the date it was sent and the meeting at which it was considered.", "Adresser le rapport au conseil et consigner sa date d'envoi et la réunion au cours de laquelle il a été examiné.", "Our report · board minutes (E6.4)", "Notre rapport · procès-verbal du conseil (E6.4)"),
  ],
  items: [
    Q("complete", "The report covers the verifications carried out and every irregularity and inaccuracy identified (procedures 1, 2).", "Le rapport couvre les contrôles effectués et chaque irrégularité et inexactitude relevée (procédures 1, 2)."),
    Q("comparison", "The conclusions on the results compared with the prior period are included (procedure 3).", "Les conclusions sur les résultats comparés à l'exercice précédent y figurent (procédure 3)."),
    Q("sent", "The report was sent to the board before the accounts were put to the general meeting (procedure 5).", "Le rapport a été adressé au conseil avant la présentation des comptes à l'assemblée (procédure 5)."),
  ],
  conclEn: [
    "Our observations have been reported to the board as the Uniform Act requires, before the accounts were put to the general meeting.",
  ],
  conclFr: [
    "Nos observations ont été portées à la connaissance du conseil comme l'exige l'Acte uniforme, avant la présentation des comptes à l'assemblée.",
  ],
});

const C5_5 = mk({
  std: "OHADA — Acte uniforme sociétés commerciales, procédure d'alerte",
  ownsEn: "the alert procedure file and the position at each stage",
  ownsFr: "le dossier de la procédure d'alerte et la situation à chaque étape",
  reqEn: [
    "Where the commissaire aux comptes identifies facts of a nature to compromise the continuity of the undertaking, the alert procedure is engaged. The procedure runs in defined stages, each with its own deadline for a response.",
    "The file records what was identified, when each stage was engaged, what response was received, and the decision taken at the end of each stage.",
  ],
  reqFr: [
    "Lorsque le commissaire aux comptes relève des faits de nature à compromettre la continuité de l'exploitation, la procédure d'alerte est engagée. Elle se déroule par étapes, chacune assortie d'un délai de réponse.",
    "Le dossier consigne les faits relevés, la date d'engagement de chaque étape, la réponse reçue et la décision prise à l'issue de chacune.",
  ],
  procs: [
    P("facts", "Record the facts identified that are of a nature to compromise the continuity of the undertaking, and the evidence for each.", "Consigner les faits relevés de nature à compromettre la continuité de l'exploitation et les éléments qui les établissent.", "E6.3 · S4.2 · C5.8 · working papers", "E6.3 · S4.2 · C5.8 · feuilles de travail"),
    P("assess", "Assess whether the facts require the procedure to be engaged, and record the basis for that decision.", "Apprécier si ces faits imposent l'engagement de la procédure et consigner le fondement de cette décision.", "Uniform Act · consultation record C1.3", "Acte uniforme · registre des consultations C1.3"),
    P("stage1", "Where the procedure is engaged, write to the chief executive requesting an explanation, and record the date sent and the deadline for reply.", "Lorsque la procédure est engagée, écrire au dirigeant pour demander des explications et consigner la date d'envoi et le délai de réponse.", "Our letter · acknowledgement of receipt", "Notre lettre · accusé de réception"),
    P("response", "Record the response received, evaluate whether it addresses the facts, and record the decision to close the procedure or to move to the next stage.", "Consigner la réponse reçue, apprécier si elle traite les faits relevés et consigner la décision de clore la procédure ou de passer à l'étape suivante.", "Response received · our evaluation", "Réponse reçue · notre appréciation"),
    P("stage2", "Where the response is not satisfactory or is not received, invite the board to deliberate on the facts and record the outcome.", "Si la réponse est insatisfaisante ou absente, inviter le conseil à délibérer sur les faits et consigner l'issue.", "Our letter to the board · board minutes", "Notre lettre au conseil · procès-verbal du conseil"),
    P("stage3", "Where the matter remains unresolved, prepare the report to the general meeting and record the date it is to be presented.", "Si la situation demeure non résolue, préparer le rapport à l'assemblée générale et consigner la date de sa présentation.", "Our report · convening notice", "Notre rapport · avis de convocation"),
    P("interaction", "Record the interaction between the procedure and our audit report, including the effect on the going concern section.", "Consigner l'articulation entre la procédure et notre rapport d'audit, dont l'effet sur la section relative à la continuité.", "E6.3 · C2.2 · C5.1", "E6.3 · C2.2 · C5.1"),
  ],
  items: [
    Q("not_engaged", "No fact of a nature to compromise the continuity of the undertaking was identified, so the procedure is not engaged (procedures 1, 2).", "Aucun fait de nature à compromettre la continuité n'a été relevé ; la procédure n'est pas engagée (procédures 1, 2)."),
    Q("deadlines", "Where engaged, each stage was carried out within the deadline the Uniform Act sets (procedures 3 to 6).", "Lorsqu'elle est engagée, chaque étape a été menée dans le délai fixé par l'Acte uniforme (procédures 3 à 6).", true),
    Q("consistent", "The position taken in the procedure is consistent with the going concern conclusion in C2.2 (procedure 7).", "La position retenue dans la procédure concorde avec la conclusion sur la continuité en C2.2 (procédure 7).", true),
  ],
  conclEn: [
    "The facts identified have been assessed against the requirement to engage the alert procedure, and the position at each stage engaged is recorded.",
  ],
  conclFr: [
    "Les faits relevés ont été appréciés au regard de l'obligation d'engager la procédure d'alerte, et la situation à chaque étape engagée est consignée.",
  ],
});

const C5_6 = mk({
  std: "OHADA — révélation des faits délictueux · ISA 250 (Revised) ¶28–29",
  ownsEn: "the assessment of whether facts require disclosure to the public prosecutor",
  ownsFr: "l'appréciation de l'obligation de révélation des faits délictueux",
  reqEn: [
    "The commissaire aux comptes is required to disclose to the public prosecutor the criminal offences of which they become aware in the course of the engagement. The obligation is personal and is not discharged by reporting the matter to management.",
    "The assessment records the facts, why they are or are not characterised as an offence, the advice obtained, and the decision taken with its date.",
  ],
  reqFr: [
    "Le commissaire aux comptes est tenu de révéler au procureur de la République les faits délictueux dont il a connaissance dans l'exercice de sa mission. Cette obligation est personnelle et n'est pas satisfaite par une information de la direction.",
    "L'appréciation consigne les faits, leur qualification ou non en infraction, les avis obtenus, et la décision prise avec sa date.",
  ],
  procs: [
    P("facts", "Record the facts identified during the engagement that may constitute a criminal offence, and the evidence for each.", "Consigner les faits relevés au cours de la mission susceptibles de constituer une infraction et les éléments qui les établissent.", "E6.1 · E3.1 · C1.2 · working papers", "E6.1 · E3.1 · C1.2 · feuilles de travail"),
    P("characterise", "Assess whether the facts are capable of being characterised as an offence, distinguishing an irregularity from a criminal act.", "Apprécier si les faits sont susceptibles de recevoir une qualification pénale, en distinguant l'irrégularité de l'acte délictueux.", "Applicable criminal law · legal advice", "Textes pénaux applicables · avis juridique"),
    P("advice", "Obtain legal advice where the characterisation is not clear, and record the advice and its author.", "Obtenir un avis juridique lorsque la qualification n'est pas évidente et consigner cet avis et son auteur.", "Legal opinion · C1.3 consultation record", "Avis juridique · registre des consultations C1.3"),
    P("materiality", "Record that the obligation does not depend on the amount involved being material to the financial statements.", "Consigner que l'obligation ne dépend pas du caractère significatif du montant en cause pour les états financiers.", "Professional obligations · Uniform Act", "Obligations professionnelles · Acte uniforme"),
    P("decision", "Record the decision to disclose or not to disclose, the reasons, the date, and the partner who took it.", "Consigner la décision de révéler ou non, ses motifs, sa date et l'associé qui l'a prise.", "Partner decision note", "Note de décision de l'associé"),
    P("disclosure", "Where disclosure is required, make it to the public prosecutor and retain the evidence of the filing.", "Lorsque la révélation est requise, l'adresser au procureur de la République et conserver la preuve de l'envoi.", "Our letter · proof of filing", "Notre lettre · preuve de dépôt"),
    P("confidentiality", "Record that professional secrecy does not prevent the disclosure required by law, and that the disclosure was limited to what the obligation requires.", "Consigner que le secret professionnel ne fait pas obstacle à la révélation imposée par la loi et que celle-ci s'est limitée à ce qu'exige l'obligation.", "Professional obligations · our letter", "Obligations professionnelles · notre lettre"),
  ],
  items: [
    Q("none", "No fact capable of being characterised as a criminal offence came to our attention (procedures 1, 2).", "Aucun fait susceptible d'une qualification pénale n'est venu à notre connaissance (procédures 1, 2)."),
    Q("advice", "Where the characterisation was not clear, legal advice was obtained (procedure 3).", "Lorsque la qualification n'était pas évidente, un avis juridique a été obtenu (procédure 3).", true),
    Q("decided", "The decision to disclose or not to disclose is recorded, with its reasons and its date (procedure 5).", "La décision de révéler ou non est consignée, avec ses motifs et sa date (procédure 5)."),
    Q("filed", "Where disclosure was required, it was made and the evidence of filing is on the file (procedure 6).", "Lorsque la révélation était requise, elle a été faite et la preuve d'envoi figure au dossier (procédure 6).", true),
  ],
  conclEn: [
    "The facts identified during the engagement have been assessed against the obligation to disclose criminal offences, and the decision taken is recorded with its reasons.",
  ],
  conclFr: [
    "Les faits relevés au cours de la mission ont été appréciés au regard de l'obligation de révélation, et la décision prise est consignée avec ses motifs.",
  ],
});

const C5_7 = mk({
  std: "OHADA — Acte uniforme sociétés commerciales, registre des titres nominatifs",
  ownsEn: "the attestation on the register of registered securities",
  ownsFr: "l'attestation sur le registre des titres nominatifs",
  reqEn: [
    "The commissaire aux comptes verifies that the register of registered securities is kept, that it records the transfers made, and that it agrees with the share capital shown in the financial statements.",
    "The register evidences who owns the company. An entry not made, or made without the transfer document behind it, undermines the ownership disclosed in the accounts and the identification of related parties.",
  ],
  reqFr: [
    "Le commissaire aux comptes vérifie que le registre des titres nominatifs est tenu, qu'il retrace les mouvements intervenus et qu'il concorde avec le capital figurant dans les états financiers.",
    "Le registre établit la propriété de la société. Une inscription omise, ou effectuée sans l'ordre de mouvement correspondant, fragilise l'information sur l'actionnariat et l'identification des parties liées.",
  ],
  procs: [
    P("exists", "Inspect the register and confirm it is kept in the form the Uniform Act requires, and that its pages are numbered and unbroken.", "Examiner le registre et vérifier sa tenue dans la forme requise par l'Acte uniforme, avec une pagination continue.", "Register of registered securities", "Registre des titres nominatifs"),
    P("agree", "Agree the total number of securities recorded to the share capital in the financial statements and to the statutes.", "Rapprocher le nombre total de titres inscrits du capital figurant dans les états financiers et des statuts.", "Register · statutes · E4.16", "Registre · statuts · E4.16"),
    P("movements", "Test the transfers recorded in the period to the transfer documents and to the board approval where the statutes require it.", "Tester les mouvements de l'exercice au regard des ordres de mouvement et de l'agrément du conseil lorsque les statuts l'exigent.", "Transfer orders · board minutes", "Ordres de mouvement · procès-verbaux du conseil"),
    P("holders", "Agree the holders recorded to the list used to convene the general meeting, and to the related party register.", "Rapprocher les titulaires inscrits de la liste ayant servi à convoquer l'assemblée et du registre des parties liées.", "Convening list · S4.3 · E6.2", "Liste de convocation · S4.3 · E6.2"),
    P("pledges", "Identify any pledge or restriction recorded against the securities, and confirm it is disclosed.", "Identifier tout nantissement ou restriction inscrit sur les titres et vérifier sa mention.", "Register · loan agreements · E4.8", "Registre · contrats de prêt · E4.8"),
    P("attest", "Issue the attestation, and record its date and the person to whom it was given.", "Établir l'attestation et consigner sa date et son destinataire.", "Our attestation", "Notre attestation"),
  ],
  items: [
    Q("kept", "The register is kept in the form the Uniform Act requires (procedure 1).", "Le registre est tenu dans la forme requise par l'Acte uniforme (procédure 1)."),
    Q("agrees", "The register agrees to the share capital in the financial statements and to the statutes (procedure 2).", "Le registre concorde avec le capital des états financiers et avec les statuts (procédure 2)."),
    Q("supported", "Every transfer recorded is supported by a transfer document and, where required, by the board's approval (procedure 3).", "Chaque mouvement inscrit est justifié par un ordre de mouvement et, si requis, par l'agrément du conseil (procédure 3)."),
  ],
  conclEn: [
    "The register of registered securities is kept as the Uniform Act requires and agrees with the share capital shown in the financial statements.",
  ],
  conclFr: [
    "Le registre des titres nominatifs est tenu conformément à l'Acte uniforme et concorde avec le capital figurant dans les états financiers.",
  ],
});

const C5_8 = mk({
  std: "OHADA — Acte uniforme sociétés commerciales, article 664 · ISA 570 (Revised)",
  ownsEn: "the monitoring of net equity against half of the share capital",
  ownsFr: "le suivi des capitaux propres au regard de la moitié du capital social",
  reqEn: [
    "Where the net equity of the company falls below half of its share capital as a result of losses, the directors must convene an extraordinary general meeting to decide whether to dissolve the company or to continue, and to regularise the position within the period the Uniform Act allows.",
    "The position is a matter for our report, and bears on the going concern assessment in E6.3 and on whether the alert procedure in C5.5 is engaged.",
  ],
  reqFr: [
    "Lorsque les capitaux propres deviennent inférieurs à la moitié du capital social du fait de pertes, les dirigeants doivent convoquer une assemblée générale extraordinaire pour décider de la dissolution ou de la poursuite de l'activité, et régulariser dans le délai prévu par l'Acte uniforme.",
    "Cette situation relève de notre rapport et influe sur l'appréciation de la continuité en E6.3 et sur l'engagement éventuel de la procédure d'alerte en C5.5.",
  ],
  procs: [
    P("compute", "Compute net equity from the audited balance sheet and compare it with half of the share capital.", "Calculer les capitaux propres à partir du bilan audité et les comparer à la moitié du capital social.", "C2.1 · E4.16 · statutes", "C2.1 · E4.16 · statuts"),
    P("prior", "Establish whether the threshold was already breached at the prior period end, and what was decided then.", "Établir si le seuil était déjà franchi à la clôture précédente et la décision alors prise.", "Prior financial statements · prior AGE minutes", "États financiers antérieurs · procès-verbal d'AGE antérieur"),
    P("meeting", "Where the threshold is breached, confirm the extraordinary general meeting was convened within the period the Uniform Act allows, and obtain the resolution.", "En cas de franchissement, vérifier la convocation de l'assemblée générale extraordinaire dans le délai prévu et obtenir la résolution.", "AGE minutes · convening notice · Uniform Act", "Procès-verbal d'AGE · avis de convocation · Acte uniforme"),
    P("publication", "Confirm the decision was published and filed with the RCCM as required.", "Vérifier la publication et le dépôt de la décision au RCCM comme requis.", "Publication evidence · RCCM filing receipt", "Preuve de publication · récépissé RCCM"),
    P("regularisation", "Where continuation was decided, establish the deadline for regularising the position and the plan to reach it.", "Lorsque la poursuite a été décidée, établir l'échéance de régularisation et le plan pour y parvenir.", "AGE resolution · management's plan · E6.3", "Résolution d'AGE · plan de la direction · E6.3"),
    P("effect", "Record the effect on the going concern assessment and on our report, and whether the alert procedure is engaged.", "Consigner l'effet sur l'appréciation de la continuité et sur notre rapport, et l'engagement éventuel de la procédure d'alerte.", "E6.3 · C2.2 · C5.5 · C5.1", "E6.3 · C2.2 · C5.5 · C5.1"),
  ],
  items: [
    Q("above", "Net equity exceeds half of the share capital, so article 664 is not engaged (procedure 1).", "Les capitaux propres excèdent la moitié du capital social ; l'article 664 n'est pas applicable (procédure 1)."),
    Q("convened", "Where the threshold is breached, the extraordinary general meeting was convened within the period allowed (procedure 3).", "En cas de franchissement, l'assemblée générale extraordinaire a été convoquée dans le délai prévu (procédure 3).", true),
    Q("published", "The decision was published and filed as required (procedure 4).", "La décision a été publiée et déposée comme requis (procédure 4).", true),
    Q("regularised", "The position has been regularised, or the deadline for regularisation has not yet expired (procedure 5).", "La situation a été régularisée, ou le délai de régularisation n'est pas encore expiré (procédure 5).", true),
  ],
  conclEn: [
    "The position of net equity against half of the share capital has been established, and any obligation arising under article 664 is recorded together with its effect on our report.",
  ],
  conclFr: [
    "La situation des capitaux propres au regard de la moitié du capital social a été établie, et toute obligation résultant de l'article 664 est consignée avec son effet sur notre rapport.",
  ],
});

const C5_9 = mk({
  std: "OHADA — Acte uniforme sociétés commerciales, co-commissariat · ISA 220 (Revised)",
  ownsEn: "the coordination with the joint auditor and the division of the work",
  ownsFr: "la coordination avec le co-commissaire aux comptes et la répartition des travaux",
  reqEn: [
    "Where two commissaires aux comptes are appointed, they carry out a joint audit and sign a single report. Each remains responsible for the opinion expressed, so each satisfies itself on the work performed by the other.",
    "The division of the work is agreed at planning, and the cross-review is performed before the report is signed so that both auditors have a basis for the opinion.",
  ],
  reqFr: [
    "Lorsque deux commissaires aux comptes sont nommés, ils mènent un audit conjoint et signent un rapport unique. Chacun demeure responsable de l'opinion exprimée et s'assure donc des travaux réalisés par l'autre.",
    "La répartition des travaux est convenue lors de la planification, et la revue croisée est effectuée avant la signature du rapport.",
  ],
  procs: [
    P("appointment", "Confirm the appointment of both auditors, the term of each mandate, and that both are eligible and independent.", "Vérifier la nomination des deux commissaires, la durée de chaque mandat et l'éligibilité et l'indépendance de chacun.", "AGO minutes · statutes · P2.1", "Procès-verbal d'AGO · statuts · P2.1"),
    P("division", "Agree the division of the work in writing, by cycle and by location, and record what each auditor will perform.", "Convenir par écrit de la répartition des travaux, par cycle et par implantation, et consigner les travaux de chacun.", "Signed division of work · engagement timetable", "Répartition signée · calendrier de mission"),
    P("common", "Agree the matters to be performed jointly, including materiality, the risk assessment and the conclusion on the opinion.", "Convenir des travaux menés conjointement : seuil de signification, évaluation des risques et conclusion sur l'opinion.", "Joint planning memorandum · P6.1 · S3.1", "Note de planification conjointe · P6.1 · S3.1"),
    P("cross_review", "Perform the cross-review of the other auditor's work on the cycles they covered, and record the extent of the review and the matters raised.", "Effectuer la revue croisée des travaux de l'autre commissaire sur les cycles qu'il a couverts et consigner l'étendue de la revue et les points soulevés.", "Other auditor's working papers · our review notes", "Feuilles de travail de l'autre commissaire · nos notes de revue"),
    P("differences", "Record any difference of view on a significant matter and how it was resolved before the report was signed.", "Consigner toute divergence d'appréciation sur un point significatif et sa résolution avant la signature du rapport.", "Joint meeting minutes · C1.3 · C1.2", "Comptes rendus de réunion conjointe · C1.3 · C1.2"),
    P("report", "Agree the terms of the single report, including any modification, and confirm both auditors sign it.", "Convenir des termes du rapport unique, y compris toute modification, et vérifier la signature des deux commissaires.", "Draft report · C5.1", "Projet de rapport · C5.1"),
  ],
  items: [
    Q("written", "The division of the work was agreed in writing before the work began (procedure 2).", "La répartition des travaux a été convenue par écrit avant le début des travaux (procédure 2)."),
    Q("joint", "Materiality, the risk assessment and the conclusion on the opinion were determined jointly (procedure 3).", "Le seuil, l'évaluation des risques et la conclusion sur l'opinion ont été arrêtés conjointement (procédure 3)."),
    Q("cross", "The cross-review of the other auditor's work has been performed (procedure 4).", "La revue croisée des travaux de l'autre commissaire a été effectuée (procédure 4)."),
    Q("agreed", "No difference of view remains unresolved (procedure 5).", "Aucune divergence d'appréciation ne demeure non résolue (procédure 5)."),
  ],
  conclEn: [
    "The work has been divided and cross-reviewed as a joint appointment requires, and both auditors have a basis for the opinion expressed in the single report.",
  ],
  conclFr: [
    "Les travaux ont été répartis et revus de façon croisée comme l'exige un co-commissariat, et les deux commissaires disposent d'un fondement pour l'opinion exprimée dans le rapport unique.",
  ],
});

/* ---------------------------------------------------------------- C6.2 --- */
const C6_2 = mk({
  std: "ISA 230 ¶14–16 · ISQM 1 ¶31(f) · ISA 220 (Revised) ¶31",
  ownsEn: "the assembly of the final file and its archive",
  ownsFr: "l'assemblage du dossier définitif et son archivage",
  reqEn: [
    "The documentation must let an experienced auditor with no previous connection to the audit understand the nature, timing and extent of the procedures, their results and the evidence obtained, the significant matters, the conclusions reached and the significant judgements made (ISA 230 ¶8). A bare sign-off documents nothing; oral explanation is not evidence; work not documented is work without evidence.",
    "Two dates govern the close. The report is dated only when sufficient appropriate evidence exists, the financial statements are prepared and management has accepted responsibility for them (ISA 700 ¶49) — every paper is complete, reviewed, signed off, and every review note bearing on the work or the conclusions is cleared by then. Assembly after that date is administrative only — deleting superseded drafts, sorting, cross-referencing — and never new procedures or new conclusions (ISA 230 ¶14–16, A21–A24).",
    "The final file is assembled within 60 days of the report date (ISA 230 A21). After assembly nothing is deleted before the retention period expires; any addition records what was added and when, by whom, the reasons, and its effect on the report, and carries the engagement partner's approval (ISA 230 ¶16, A20).",
    "Sign-offs carry the actual date — never backdated. Work signed later than performed states when it was actually done. Retention follows the firm's policy under ISQM 1 ¶31(f) and any longer statutory period (OHADA: ten years for accounting records).",
  ],
  reqFr: [
    "La documentation doit permettre à un auditeur expérimenté, sans lien antérieur avec la mission, de comprendre la nature, le calendrier et l'étendue des procédures, leurs résultats et les éléments obtenus, les questions importantes, les conclusions et les jugements significatifs (ISA 230 ¶8). Une signature seule ne documente rien ; une explication orale n'est pas un élément probant ; un travail non documenté est un travail sans preuve.",
    "Deux dates gouvernent la clôture. Le rapport n'est daté que lorsque des éléments suffisants et appropriés existent, que les états financiers sont établis et que la direction en a accepté la responsabilité (ISA 700 ¶49) — chaque papier est alors complet, revu, signé, et chaque note de revue portant sur les travaux ou les conclusions est levée. L'assemblage postérieur est purement administratif — suppression des brouillons périmés, classement, référencement croisé — jamais de nouvelles procédures ni de nouvelles conclusions (ISA 230 ¶14–16, A21–A24).",
    "Le dossier définitif est assemblé dans les 60 jours de la date du rapport (ISA 230 A21). Après l'assemblage, rien n'est supprimé avant l'expiration du délai de conservation ; tout ajout consigne ce qui a été ajouté, quand, par qui, les motifs et l'effet sur le rapport, avec l'approbation de l'associé (ISA 230 ¶16, A20).",
    "Les signatures portent la date réelle — jamais antidatées. Un travail signé après coup précise quand il a réellement été fait. La conservation suit la politique du cabinet (ISQM 1 ¶31(f)) et tout délai légal plus long (OHADA : dix ans pour les documents comptables).",
  ],
  procs: [
    P("complete", "Verify every working paper is complete and signed off — preparer and reviewer, actual dates — and that no programme step or conclusion is left open.", "Vérifier que chaque papier est complet et signé — préparateur et réviseur, dates réelles — et qu'aucune diligence ni conclusion ne reste ouverte.", "Task list · sign-off registers · archive gates", "Liste des tâches · registres de signature · contrôles d'archivage"),
    P("notes", "Clear every open review note; a note touching the extent of work, the documentation or a conclusion is resolved before the report is dated.", "Lever chaque note de revue ouverte ; une note touchant l'étendue des travaux, la documentation ou une conclusion est résolue avant la date du rapport.", "Review-notes tool", "Outil notes de revue"),
    P("purge", "Purge what the file must not retain: superseded drafts, duplicates, to-do lists, correspondence without conclusions — and keep every paper that contradicts a final conclusion together with how the contradiction was resolved.", "Purger ce que le dossier ne doit pas conserver : brouillons périmés, doublons, listes de tâches, correspondance sans conclusion — et conserver tout papier contredisant une conclusion finale avec la résolution de la contradiction.", "ISA 230 A5 · file review", "ISA 230 A5 · revue du dossier"),
    P("evidence", "Confirm the experienced-auditor test: procedures, results, evidence, conclusions and judgements are readable from the file alone, with the accounting records agreed to the financial statements.", "Vérifier le critère de l'auditeur expérimenté : procédures, résultats, éléments, conclusions et jugements se lisent du dossier seul, la comptabilité étant rapprochée des états financiers.", "ISA 230 ¶8 · C2.1 tie-out", "ISA 230 ¶8 · rapprochement C2.1"),
    P("deliverables", "Retain a copy of every deliverable issued — the report, the management letter, the statutory communications — in the file.", "Conserver au dossier copie de chaque livrable émis — rapport, lettre de recommandations, communications légales.", "C5 papers · correspondence", "Papiers C5 · correspondance"),
    P("assemble", "Assemble and lock the final file within 60 days of the report date; record the archive date.", "Assembler et verrouiller le dossier définitif dans les 60 jours de la date du rapport ; consigner la date d'archivage.", "ISA 230 A21 · archive function", "ISA 230 A21 · fonction d'archivage"),
    P("post", "After the archive date, add nothing without recording what, when, by whom, why and the effect on the report, with the engagement partner's approval; delete nothing before retention expires.", "Après l'archivage, n'ajouter rien sans consigner quoi, quand, par qui, pourquoi et l'effet sur le rapport, avec l'approbation de l'associé ; ne rien supprimer avant l'expiration du délai de conservation.", "ISA 230 ¶15–16", "ISA 230 ¶15–16"),
  ],
  items: [
    Q("signoffs", "Every working paper carries preparer and reviewer sign-off at actual dates, none later than the report date (procedure 1).", "Chaque papier porte les signatures du préparateur et du réviseur à dates réelles, aucune postérieure au rapport (procédure 1)."),
    Q("notes", "Every review note bearing on the work or the conclusions is cleared (procedure 2).", "Chaque note de revue portant sur les travaux ou les conclusions est levée (procédure 2)."),
    Q("purged", "The file retains what it must and nothing it must not; contradictory evidence is kept with its resolution (procedure 3).", "Le dossier conserve ce qu'il doit et rien de ce qu'il ne doit pas ; les éléments contradictoires sont conservés avec leur résolution (procédure 3)."),
    Q("readable", "The file passes the experienced-auditor test (procedure 4).", "Le dossier satisfait le critère de l'auditeur expérimenté (procédure 4)."),
    Q("window", "The archive is completed within 60 days of the report date (procedure 6).", "L'archivage est réalisé dans les 60 jours de la date du rapport (procédure 6)."),
  ],
  conclEn: [
    "The final file is complete, reviewed and signed off, review notes are cleared, the assembly was administrative only, and the file is locked within the assembly window.",
  ],
  conclFr: [
    "Le dossier définitif est complet, revu et signé, les notes de revue levées, l'assemblage purement administratif, et le dossier verrouillé dans le délai imparti.",
  ],
});

export const CONCLUSION_PAPERS: Record<string, PaperDef> = {
  "C2.1": C2_1,
  "C6.2": C6_2,
  "C4.1": C4_1,
  "C4.3": C4_3,
  "C6.1": C6_1,
  "C1.1": C1_1,
  "C1.2": C1_2,
  "C1.3": C1_3,
  "C2.2": C2_2,
  "C3.1": C3_1,
  "C4.2": C4_2,
  "C5.1": C5_1,
  "C5.2": C5_2,
  "C5.3": C5_3,
  "C5.4": C5_4,
  "C5.5": C5_5,
  "C5.6": C5_6,
  "C5.7": C5_7,
  "C5.8": C5_8,
  "C5.9": C5_9,
};
