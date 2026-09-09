// E3.1 Journal entries and other adjustments — the ISA 240 management-override
// paper, written against the methodology rather than against a memory of it.
//
// It replaces the paper the execution set registered for E3.1 under the
// constant E2_1. That one was right about why the work is done — the risk is
// presumed on every engagement, the procedures are not conditional on a fraud
// risk found elsewhere — and it is kept here word for word where it was right.
// What it lacked is what the methodology is most insistent about: that the
// selection is risk-directed and that a random sample of twenty-five entries is
// not an answer (International Audit Methodology 321.03), that the four
// unpredictability levers are stated rather than gestured at, that the four
// controls which may exist over journal entries are the ones ISA 315 requires
// an understanding of, and that testing at the end of the reporting period is
// required while testing throughout the period is a decision to be recorded.
// Its criteria procedure also promised a test of the hour of posting, which no
// ledger this product imports can support.
//
// The paper and lib/je-selection.ts have to say the same thing, because the
// auditor moves between them: the criteria named in procedure 5 are the
// catalogue keys the engine runs, in the engine's own words, and the four tests
// applied to each selected item are the four columns the workbook opens.

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
  "Perform each procedure and record the result, stating the population, what was tested, the basis of selection, and the working-paper reference of the evidence filed.";
const PROC_INTRO_FR =
  "Mettre en œuvre chaque procédure et consigner le résultat : la population, l'objet du test, la base de sélection et la référence du dossier.";
const YN_INTRO_EN =
  "Evaluate the results of the Part A procedures against each statement. Explain each “No” in the box beneath it, including the misstatement raised in C1.1.";
const YN_INTRO_FR =
  "Évaluer les résultats de la partie A au regard de chaque affirmation. Expliquer chaque « Non », y compris l'anomalie portée en C1.1.";

const PROCS: PaperProc[] = [
  P(
    "inquiry",
    "Make inquiries of the individuals involved in the financial reporting process about inappropriate or unusual activity in the processing of journal entries and other adjustments, and record who was asked and what they said.",
    "S'entretenir avec les personnes intervenant dans le processus d'élaboration de l'information financière au sujet d'activités inappropriées ou inhabituelles dans le traitement des écritures et des ajustements, et consigner qui a été interrogé et ce qui a été dit.",
    "Inquiry memoranda · form 280/281 · ISA 240 ¶33(a)",
    "Comptes rendus d'entretien · formulaire 280/281 · ISA 240 ¶33 a)",
  ),
  P(
    "understanding",
    "Record the types of journal entry the entity uses, where each type comes from, and how the period-end closing process runs, and consider management's incentive and opportunity to override the controls that surround them.",
    "Consigner les types d'écritures utilisés par l'entité, l'origine de chacun et le déroulement du processus de clôture, et apprécier les incitations et les possibilités qu'a la direction de contourner les contrôles qui les encadrent.",
    "FSCP understanding · form 280/281 · closing calendar",
    "Compréhension du FSCP · formulaire 280/281 · calendrier de clôture",
  ),
  P(
    "controls",
    "Identify and record the controls over the preparation and recording of journal entries, covering the four that may be present: segregation of duties over authorising, posting, reviewing and reconciling entries; access rights governing who may record and who may approve an entry in the accounting system; oversight of the posting process by management, internal audit or others, including post-entry review; and regular testing of those controls by the entity's internal auditors, where there are any. Where a control is absent, say so — its absence is part of the answer.",
    "Identifier et consigner les contrôles portant sur la préparation et l'enregistrement des écritures, en couvrant les quatre qui peuvent exister : la séparation des tâches entre l'autorisation, la saisie, la revue et le rapprochement des écritures ; les droits d'accès déterminant qui peut saisir et qui peut approuver une écriture dans le système comptable ; la supervision du processus de saisie par la direction, l'audit interne ou d'autres, y compris la revue a posteriori des écritures ; et le test régulier de ces contrôles par l'audit interne, lorsqu'il existe. Lorsqu'un contrôle est absent, l'écrire : son absence fait partie de la réponse.",
    "Form D4.4 · FSCP walkthrough · S2.2 control design",
    "Formulaire D4.4 · test de cheminement FSCP · S2.2 conception des contrôles",
  ),
  P(
    "population",
    "Obtain the journal entry population as an extract from the general ledger and establish its completeness and accuracy before anything is selected from it. The population is information produced by the entity: agree its total movement and its record count to the ledger, state the parameters the extract was run with, and trace a sample of lines back to the system.",
    "Obtenir la population des écritures par extraction du grand livre et en établir l'exhaustivité et l'exactitude avant toute sélection. Cette population est une information produite par l'entité : rapprocher le total des mouvements et le nombre d'enregistrements du grand livre, énoncer les paramètres d'extraction retenus et rattacher un échantillon de lignes au système.",
    "General ledger extract · GL Analyzer population checks · E1.2 IPE",
    "Extraction du grand livre · contrôles de population du GL Analyzer · IPE de E1.2",
  ),
  P(
    "criteria",
    "Set the criteria the selection is directed by, with the parameters used for each and the reason it was chosen on this engagement: entries posted on a weekend, entries posted on a public holiday of the client's country, entries carrying no description at all, entries whose description is present but uninformative, round-number amounts, unusual account pairings within one entry, the largest entries dated near the year end, entries where the preparer and the reviewer are the same person, and any rule of the auditor's own built from a ledger column, an operator and a value. Record the criteria considered and not applied, and why.",
    "Arrêter les critères qui orientent la sélection, avec pour chacun les paramètres retenus et la raison de son choix sur cette mission : écritures comptabilisées un week-end, écritures comptabilisées un jour férié du pays du client, écritures sans aucun libellé, écritures dont le libellé existe mais n'apprend rien, montants ronds, couples de comptes inhabituels au sein d'une même écriture, écritures les plus volumineuses datées près de la clôture, écritures dont le préparateur et le réviseur sont la même personne, et toute règle propre à l'auditeur construite à partir d'une colonne du grand livre, d'un opérateur et d'une valeur. Consigner les critères examinés et non retenus, et pourquoi.",
    "Journal entry testing tool · ISA 240 ¶33(b) · IAM 321.03",
    "Outil de test des écritures · ISA 240 ¶33 b) · IAM 321.03",
  ),
  P(
    "period_end",
    "Select the entries and other adjustments recorded at the end of the reporting period, including post-closing entries and the top-side adjustments made to the closing trial balance outside the accounting system. This selection is required, whatever the other criteria return.",
    "Sélectionner les écritures et autres ajustements enregistrés en fin de période, y compris les écritures postérieures à la clôture et les ajustements « top-side » passés sur la balance de clôture hors du système comptable. Cette sélection est requise, quels que soient les résultats des autres critères.",
    "General ledger · closing entry schedule · trial balance · P4.3",
    "Grand livre · état des écritures de clôture · balance générale · P4.3",
  ),
  P(
    "throughout",
    "Consider whether entries recorded throughout the period also need to be tested, and record the conclusion reached and the reasoning behind it. A decision not to extend the testing beyond the closing period is a decision, and it is documented here.",
    "Apprécier si les écritures enregistrées tout au long de la période doivent également être testées, et consigner la conclusion retenue ainsi que son raisonnement. La décision de ne pas étendre les tests au-delà de la période de clôture est une décision : elle est documentée ici.",
    "General ledger for the full period · S3.1 strategy",
    "Grand livre de la période entière · S3.1 stratégie",
  ),
  P(
    "unpredictability",
    "Introduce an element of unpredictability, and record which of the four levers was used and how: varying the amounts and the types of entry selected, varying the timing of the testing, varying the locations or organisational units tested, and varying the extent of the procedures according to the assessed risk of material misstatement due to fraud.",
    "Introduire un élément d'imprévisibilité et consigner lequel des quatre leviers a été actionné et comment : faire varier les montants et les types d'écritures retenus, faire varier le moment des tests, faire varier les sites ou les unités organisationnelles testés, et faire varier l'étendue des procédures selon le risque d'anomalies significatives résultant de fraudes évalué.",
    "ISA 240 ¶29(c) · IAM 321.05 · prior-year selection",
    "ISA 240 ¶29 c) · IAM 321.05 · sélection de l'exercice précédent",
  ),
  P(
    "test_items",
    "Test each item selected on the four points: that it is supported by an underlying business rationale, that it was authorised at the correct level, that it is correctly accounted for, and that it is recorded in the correct period. Read the supporting documentation and discuss the purpose of the entry with management. Inquiry on its own is not a test.",
    "Tester chaque élément sélectionné sur quatre points : l'existence d'une justification économique sous-jacente, l'autorisation au niveau hiérarchique approprié, la correcte comptabilisation et le correct rattachement à l'exercice. Lire les pièces justificatives et discuter de l'objet de l'écriture avec la direction. L'entretien seul ne constitue pas un test.",
    "Supporting documents · discussion notes · JE workbook, Selection tab",
    "Pièces justificatives · notes d'entretien · classeur JE, onglet Sélection",
  ),
  P(
    "estimates",
    "Review the accounting estimates for indicators of management bias and perform the retrospective review of the significant estimates of the prior period. The work itself belongs to the estimates paper; cross-reference its conclusion here, because ISA 240 ¶32 treats it as part of the same response.",
    "Examiner les estimations comptables à la recherche d'indices de biais de la direction et procéder à la revue rétrospective des estimations importantes de l'exercice précédent. Ces travaux relèvent du papier sur les estimations ; leur conclusion est référencée ici, l'ISA 240 ¶32 les traitant comme un volet de la même réponse.",
    "E6.7 · S4.4 · prior-period financial statements",
    "E6.7 · S4.4 · états financiers de l'exercice précédent",
  ),
  P(
    "unusual",
    "For the significant transactions outside the normal course of business, or otherwise unusual, identified during the audit, evaluate whether the business rationale — or the absence of one — suggests the transaction was entered into to misstate the financial statements or to conceal a misappropriation of assets.",
    "Pour les opérations significatives hors du cours normal des affaires, ou par ailleurs inhabituelles, relevées au cours de l'audit, apprécier si leur justification économique — ou son absence — suggère qu'elles ont été conclues pour fausser les états financiers ou dissimuler un détournement d'actifs.",
    "ISA 240 ¶33(c) · E6.2 · contracts · board minutes",
    "ISA 240 ¶33 c) · E6.2 · contrats · procès-verbaux du conseil",
  ),
  P(
    "approval",
    "Have the engagement partner approve the strategy adopted to answer the management-override risk before the testing runs, and where the likelihood of override is assessed as higher, have the procedures performed and their conclusion formally reviewed. Where the identified risk is not fully answered by the procedures above, design and perform the additional procedures and cross-reference them.",
    "Faire approuver par l'associé responsable la stratégie retenue pour couvrir le risque de contournement avant la mise en œuvre des tests et, lorsque la probabilité de contournement est évaluée comme élevée, faire formaliser une revue des procédures mises en œuvre et de leur conclusion. Lorsque le risque identifié n'est pas entièrement couvert par les procédures ci-dessus, concevoir et mettre en œuvre les procédures complémentaires et les référencer.",
    "Partner approval on S3.1 · additional OST/OSP work programme",
    "Approbation de l'associé en S3.1 · programme de travail OST/OSP complémentaire",
  ),
];

const ITEMS: PaperItem[] = [
  Q(
    "population_established",
    "The journal entry population was extracted from the system and its completeness and accuracy established before any selection was made (procedure 4).",
    "La population des écritures a été extraite du système et son exhaustivité et son exactitude établies avant toute sélection (procédure 4).",
  ),
  Q(
    "inquiries_made",
    "Inquiries were made of the individuals involved in the financial reporting process about inappropriate or unusual journal entry activity (procedure 1).",
    "Les personnes intervenant dans le processus d'élaboration de l'information financière ont été interrogées sur les activités inappropriées ou inhabituelles en matière d'écritures (procédure 1).",
  ),
  Q(
    "period_end_covered",
    "Entries recorded at or near the end of the reporting period, post-closing entries and top-side adjustments to the closing trial balance are all in the selection (procedure 6).",
    "Les écritures enregistrées à la clôture ou peu avant, les écritures postérieures à la clôture et les ajustements « top-side » sur la balance de clôture figurent tous dans la sélection (procédure 6).",
  ),
  Q(
    "throughout_considered",
    "The need to test entries recorded throughout the period was considered and the conclusion documented (procedure 7).",
    "La nécessité de tester les écritures enregistrées tout au long de la période a été appréciée et la conclusion documentée (procédure 7).",
  ),
  Q(
    "unpredictability_applied",
    "An element of unpredictability was introduced through at least one of the four levers — amount and type, timing, location or organisational unit, extent (procedure 8).",
    "Un élément d'imprévisibilité a été introduit par au moins l'un des quatre leviers : montant et type, moment, site ou unité organisationnelle, étendue (procédure 8).",
  ),
  Q(
    "four_tests_done",
    "For each item selected, the business rationale was corroborated, the level of authorisation checked, the accounting verified and the period of recording verified (procedure 9).",
    "Pour chaque élément sélectionné, la justification économique a été corroborée, le niveau d'autorisation vérifié, la comptabilisation contrôlée et le rattachement à l'exercice vérifié (procédure 9).",
  ),
  Q(
    "not_random",
    "The selection is risk-directed rather than a random sample of a fixed number of entries, and the testing rests on more than inquiry (procedures 5 and 9).",
    "La sélection est orientée par le risque et non constituée d'un échantillon aléatoire d'un nombre fixe d'écritures, et les tests reposent sur autre chose que des entretiens (procédures 5 et 9).",
  ),
  Q(
    "partner_approved",
    "The engagement partner approved the strategy and, where the likelihood of override is higher, formally reviewed the procedures performed and their conclusion (procedure 12).",
    "L'associé responsable a approuvé la stratégie et, lorsque la probabilité de contournement est élevée, a formalisé une revue des procédures mises en œuvre et de leur conclusion (procédure 12).",
  ),
];

/**
 * The Part A / Part B / Part C shape every execution paper shares, with two
 * sections of its own between them. The controls over journal entries and the
 * unpredictability levers are recorded as typed fields rather than as Yes/No
 * questions because neither is answerable that way: what matters is which
 * control exists and what it does, and which lever was actually pulled and how.
 */
export const JOURNAL_ENTRIES_PAPER: PaperDef = {
  std: "ISA 240 ¶31–34, ¶36–37 · ISA 240 ¶29(c) · ISA 315 (Revised 2019) ¶26 · IAM 321",
  ownsEn: "the testing of journal entries and other adjustments, and the responses to the risk of management override of controls",
  ownsFr: "le test des écritures comptables et autres ajustements et les réponses au risque de contournement des contrôles par la direction",
  tools: ["journal-entry-testing"],
  reqEn: [
    "Irrespective of our assessment of the risk of management override, we design and perform procedures to test the appropriateness of journal entries and other adjustments, to review accounting estimates for bias, and to evaluate the business rationale of significant transactions outside the normal course of business (ISA 240 ¶31). These procedures are performed on every engagement. They are not conditional on a fraud risk having been identified elsewhere.",
    "Management is uniquely placed to commit fraud by overriding controls that otherwise appear to operate effectively. The level of that risk varies between entities but it is present in all of them, and because the way an override may occur cannot be predicted, it is treated as a significant risk (ISA 240 ¶31).",
    "The objective is not to conclude that a population is free of material error. It is to test the entries that could carry a material misstatement, which is why the selection is directed by criteria and why a random sample of a fixed number of entries — twenty-five, for instance — is not appropriate for journal entry testing (IAM 321.03). Testing the entries identified by inquiry alone is not appropriate either.",
    "Entries recorded at the end of the reporting period are tested in every case, and the need to test entries recorded throughout the period is considered and the conclusion recorded (ISA 240 ¶33(b); IAM 321.02). An element of unpredictability is introduced in the nature, timing and extent of the procedures (ISA 240 ¶29(c)).",
    "We obtain an understanding of the controls the entity has over the preparation and recording of journal entries, which is where the four controls in Part B come from (ISA 315 (Revised 2019) ¶26; IAM 201.09).",
  ],
  reqFr: [
    "Quelle que soit notre évaluation du risque de contournement, nous concevons et mettons en œuvre des procédures pour tester le caractère approprié des écritures et des autres ajustements, examiner les estimations comptables à la recherche de biais et apprécier la justification économique des opérations significatives hors du cours normal des affaires (ISA 240 ¶31). Ces procédures sont mises en œuvre sur toute mission, indépendamment de l'identification d'un risque de fraude par ailleurs.",
    "La direction est dans une position unique pour commettre une fraude en contournant des contrôles qui paraissent par ailleurs fonctionner efficacement. Le niveau de ce risque varie d'une entité à l'autre mais il reste présent dans toutes, et parce que les modalités d'un contournement ne peuvent être anticipées, il est traité comme un risque important (ISA 240 ¶31).",
    "L'objectif n'est pas de conclure qu'une population est exempte d'erreur significative, mais de tester les écritures susceptibles de contenir une anomalie significative : c'est pourquoi la sélection est orientée par des critères et pourquoi une sélection aléatoire d'un nombre fixe d'écritures — vingt-cinq, par exemple — n'est pas appropriée pour le test des écritures (IAM 321.03). Tester les écritures identifiées par le seul entretien n'est pas davantage approprié.",
    "Les écritures enregistrées en fin de période sont testées dans tous les cas, et la nécessité de tester les écritures enregistrées tout au long de la période est appréciée et la conclusion consignée (ISA 240 ¶33 b) ; IAM 321.02). Un élément d'imprévisibilité est introduit dans la nature, le calendrier et l'étendue des procédures (ISA 240 ¶29 c)).",
    "Nous prenons connaissance des contrôles mis en place par l'entité sur la préparation et l'enregistrement des écritures : c'est de là que proviennent les quatre contrôles de la partie B (ISA 315 révisée 2019, ¶26 ; IAM 201.09).",
  ],
  conclEn: [
    "The journal entries and other adjustments selected are appropriate: each is supported by a business rationale, was authorised at the correct level, is correctly accounted for and is recorded in the correct period.",
    "No indication of management override of controls giving rise to a material misstatement due to fraud was identified. Where misstatements were identified, we have considered whether they may indicate fraud and what they mean for the other aspects of the audit, in particular the reliability of management's representations.",
    "The procedures performed, taken with the review of estimates for bias and the review of significant unusual transactions, respond to the presumed significant risk of management override; any residual specific risk has been answered by the additional procedures cross-referenced above.",
  ],
  conclFr: [
    "Les écritures et autres ajustements sélectionnés sont appropriés : chacun repose sur une justification économique, a été autorisé au niveau approprié, est correctement comptabilisé et correctement rattaché à l'exercice.",
    "Aucun indice de contournement des contrôles par la direction donnant lieu à une anomalie significative résultant de fraudes n'a été relevé. Lorsque des anomalies ont été identifiées, nous avons apprécié si elles pouvaient révéler une fraude et ce qu'elles impliquent pour les autres aspects de l'audit, en particulier la fiabilité des déclarations de la direction.",
    "Les procédures mises en œuvre, avec l'examen des estimations à la recherche de biais et la revue des opérations significatives inhabituelles, répondent au risque important présumé de contournement des contrôles ; tout risque spécifique résiduel a été couvert par les procédures complémentaires référencées ci-dessus.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: `${PROC_INTRO_EN} The selection is risk-directed: state the criteria used and the reason each item was picked, never a sample size on its own.`,
      introFr: `${PROC_INTRO_FR} La sélection est orientée par le risque : énoncer les critères utilisés et le motif de sélection de chaque élément, jamais une taille d'échantillon isolée.`,
      procs: PROCS,
    },
    {
      kind: "fields",
      titleEn: "Part B — Controls over journal entries",
      titleFr: "Partie B — Contrôles sur les écritures comptables",
      introEn:
        "Record what exists for each of the four controls, who performs it and how we know it operates. Where a control is absent, write that down and say what the selection did in answer.",
      introFr:
        "Consigner ce qui existe pour chacun des quatre contrôles, qui l'exécute et comment nous savons qu'il fonctionne. Lorsqu'un contrôle est absent, l'écrire et indiquer ce que la sélection a fait en réponse.",
      fields: [
        {
          key: "ctrl_sod",
          kind: "input",
          labelEn: "Segregation of duties over authorising, posting, reviewing and reconciling journal entries",
          labelFr: "Séparation des tâches entre l'autorisation, la saisie, la revue et le rapprochement des écritures",
        },
        {
          key: "ctrl_access",
          kind: "input",
          labelEn: "Access rights governing who may record and who may approve an entry in the accounting system",
          labelFr: "Droits d'accès déterminant qui peut saisir et qui peut approuver une écriture dans le système comptable",
        },
        {
          key: "ctrl_oversight",
          kind: "input",
          labelEn: "Oversight of the posting process by management, internal audit or others, including post-entry review",
          labelFr: "Supervision du processus de saisie par la direction, l'audit interne ou d'autres, y compris la revue a posteriori des écritures",
        },
        {
          key: "ctrl_ia_testing",
          kind: "input",
          labelEn: "Regular testing of those controls by the entity's internal auditors, where there are any",
          labelFr: "Test régulier de ces contrôles par l'audit interne de l'entité, lorsqu'il existe",
        },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part C — Unpredictability and the extent of the testing",
      titleFr: "Partie C — Imprévisibilité et étendue des tests",
      introEn:
        "Say which levers were pulled this year and how they differ from last year. A lever left alone is recorded as such, with the reason.",
      introFr:
        "Indiquer quels leviers ont été actionnés cette année et en quoi ils diffèrent de l'exercice précédent. Un levier non actionné est consigné comme tel, avec sa raison.",
      fields: [
        {
          key: "unpred_amount_type",
          kind: "input",
          labelEn: "Amounts and types of entry selected — what varied against the prior year",
          labelFr: "Montants et types d'écritures retenus — ce qui a varié par rapport à l'exercice précédent",
        },
        {
          key: "unpred_timing",
          kind: "input",
          labelEn: "Timing of the testing — when the selection was run and why then",
          labelFr: "Moment des tests — quand la sélection a été exécutée et pourquoi à ce moment",
        },
        {
          key: "unpred_location",
          kind: "input",
          labelEn: "Locations or organisational units selected for testing",
          labelFr: "Sites ou unités organisationnelles retenus pour les tests",
        },
        {
          key: "unpred_extent",
          kind: "input",
          labelEn: "Extent of the procedures, and how it follows from the assessed risk of material misstatement due to fraud",
          labelFr: "Étendue des procédures et lien avec le risque d'anomalies significatives résultant de fraudes évalué",
        },
        {
          key: "throughout_decision",
          kind: "input",
          labelEn: "Entries throughout the period — the decision taken, and the reasoning behind it",
          labelFr: "Écritures de l'ensemble de la période — décision prise et raisonnement qui la fonde",
        },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part D — Evaluation",
      titleFr: "Partie D — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: ITEMS,
    },
    {
      kind: "fields",
      titleEn: "Part E — Outcome",
      titleFr: "Partie E — Résultat",
      fields: [
        {
          key: "exceptions",
          kind: "input",
          labelEn: "Exceptions identified, whether each may indicate fraud, the misstatement raised in C1.1 for each, and how each was resolved",
          labelFr: "Exceptions relevées, indication éventuelle d'une fraude, anomalie portée en C1.1 pour chacune, et leur résolution",
        },
        {
          key: "carried",
          kind: "input",
          labelEn: "Matters carried to C1.2 significant matters, or to C6.1 points forward, including any effect on the reliability of management's representations",
          labelFr: "Points reportés en C1.2 (points significatifs) ou en C6.1 (points reportés), y compris l'incidence sur la fiabilité des déclarations de la direction",
        },
      ],
    },
  ],
};

/**
 * Keyed the way the execution set keys its papers, so wiring it in is a change
 * of one entry rather than a change of shape.
 */
export const JOURNAL_ENTRY_PAPERS: Record<string, PaperDef> = {
  "E3.1": JOURNAL_ENTRIES_PAPER,
};
