// E1.1 — the ITGC testing paper.
//
// The E1.1 definition that has been living in lib/papers/execution.ts was
// written from general IT-audit knowledge rather than from the firm's own
// methodology. It ran the whole test off access, change and operations, and the
// template beside it took "program development" for a control domain. The
// handbook does neither. It names four IT process domains — Changes, Accès, IT
// Operations and Support — and it drives every ITGC back to two generic IT
// risks: that the data is not processed correctly by the IT application, and
// that the data is not the right data. Program development appears nowhere in
// the handbook, in the International Audit Methodology or in the OHADA guide,
// so it does not appear here either.
//
// Two things the handbook is explicit about, and the shape of the paper keeps
// them apart rather than collapsing one into the other:
//
//   - an ineffective ITGC does not necessarily make the IT process ineffective.
//     Each domain concludes on its own — Effective, Reliable or Ineffective —
//     and the IT process concludes separately to Support IT or Not support IT.
//     The preparer reaches the second conclusion; nothing here derives it from
//     the first.
//
//   - when the ITGCs are not effective there are three routes, not one: a
//     compensating control at IT-process level, a compensating control inside
//     the SCOT, or substantive procedures inside the SCOT — including direct
//     testing of the application controls, the IT-dependent manual controls and
//     the IPEs the application supports.
//
// The workbook in lib/itgc-workbook.ts is the same paper as a file the auditor
// can fill offline, and it follows the same two rules.

import type { PaperDef, PaperItem, PaperProc } from "@/lib/papers/types";

const P = (
  key: string,
  en: string,
  fr: string,
  srcEn: string,
  srcFr: string,
  tipEn?: string,
  tipFr?: string,
): PaperProc => (tipEn ? { key, en, fr, srcEn, srcFr, tipEn, tipFr } : { key, en, fr, srcEn, srcFr });

const Q = (key: string, en: string, fr: string, na?: boolean): PaperItem =>
  na ? { key, en, fr, na } : { key, en, fr };

// The Part A / Part B / Part C shape is the one every execution paper wears.
// mk() itself is private to lib/papers/execution.ts, so the shape is rebuilt
// here rather than this paper being given a form of its own: swapping the
// definition into the registry changes what E1.1 says, and nothing about how it
// behaves on screen.
const PROC_INTRO_EN =
  "Perform each procedure and record the result, stating the population, what was tested, the basis of selection, and the working-paper reference of the evidence filed.";
const PROC_INTRO_FR =
  "Mettre en œuvre chaque procédure et consigner le résultat : la population, l'objet du test, la base de sélection et la référence du dossier.";
const YN_INTRO_EN =
  "Evaluate the results of the Part A procedures against each statement. Explain each “No” in the box beneath it.";
const YN_INTRO_FR =
  "Évaluer les résultats de la partie A au regard de chaque affirmation. Expliquer chaque « Non » dans la zone prévue.";

/**
 * The eight criteria that reduce the IPE accuracy sample from 25 items to 10.
 * They are carried in full because the reduction turns on all eight holding at
 * once: a summary of them would leave the preparer deciding on a paraphrase.
 * The workbook puts the same eight on its Cover as a Yes/No block.
 */
export const IPE_REDUCTION_CRITERIA: readonly { en: string; fr: string }[] = [
  {
    en: "The control environment supports the prevention, detection and correction of a material misstatement (ELC 5.1).",
    fr: "L'environnement de contrôle soutient la prévention, la détection et la correction d'une anomalie significative (ELC 5.1).",
  },
  {
    en: "There is no significant risk and no fraud risk at the level of the account or the assertion concerned.",
    fr: "Il n'existe ni risque important ni risque de fraude au niveau du compte ou de l'assertion concernés.",
  },
  {
    en: "The account is not a higher-risk accounting estimate.",
    fr: "Le compte n'est pas une estimation comptable à risque élevé.",
  },
  {
    en: "The substantive procedure is not the only substantive procedure performed on that significant account or assertion.",
    fr: "La procédure de substance n'est pas la seule procédure de substance mise en œuvre sur ce compte ou cette assertion significative.",
  },
  {
    en: "The understanding of the IT processes — manage change and manage access — identified nothing that increases the risk.",
    fr: "La prise de connaissance des processus informatiques — gestion des changements et gestion des accès — n'a rien relevé qui augmente le risque.",
  },
  {
    en: "The understanding of the SCOT that produces the IPE, including the understanding of the relevant IT applications, identified nothing that increases the risk.",
    fr: "La prise de connaissance du SCOT qui produit l'IPE, y compris celle des applications informatiques pertinentes, n'a rien relevé qui augmente le risque.",
  },
  {
    en: "The IPE is not itself complex: few formulas, no contra-line items, debits and credits are not in the same listing, and the data points do not come from several source applications.",
    fr: "L'IPE n'est pas lui-même complexe : peu de formules, pas de lignes de contrepassation, débits et crédits ne figurent pas dans la même liste, et les données ne proviennent pas de plusieurs applications sources.",
  },
  {
    en: "The data point is not created solely with an end-user computing tool, and the IPE is not used in a procedure performed at a shared service centre whose component financial statements are audited.",
    fr: "La donnée n'est pas produite uniquement au moyen d'un outil bureautique, et l'IPE n'est pas utilisé dans une procédure exécutée au sein d'un centre de services partagés dont les états financiers de composante sont audités.",
  },
] as const;

const IPE_TIP_EN =
  "The population extracted for the test is itself an IPE, so its reliability is established before anything is selected from it: completeness first, then accuracy. The accuracy sample is 25 items. It falls to 10 — and the completeness procedures are reduced with it — only when all eight of these hold: "
  + IPE_REDUCTION_CRITERIA.map((c, i) => `(${i + 1}) ${c.en}`).join(" ")
  + " It is extended to 60 where the circumstances call for it. The reduction to 10 is not available on a PCAOB engagement.";
const IPE_TIP_FR =
  "La population extraite pour le test est elle-même un IPE : sa fiabilité est établie avant toute sélection — l'exhaustivité d'abord, l'exactitude ensuite. L'échantillon d'exactitude est de 25 éléments. Il est ramené à 10 — et les travaux d'exhaustivité sont réduits en conséquence — uniquement lorsque les huit conditions suivantes sont réunies : "
  + IPE_REDUCTION_CRITERIA.map((c, i) => `(${i + 1}) ${c.fr}`).join(" ")
  + " Il est porté à 60 lorsque les circonstances l'exigent. La réduction à 10 n'est pas ouverte sur une mission PCAOB.";

const DOMAIN_OPTIONS = [
  { value: "effective", en: "Effective", fr: "Effective" },
  { value: "reliable", en: "Reliable", fr: "Reliable" },
  { value: "ineffective", en: "Ineffective", fr: "Ineffective" },
];

/**
 * E1.1 as the firm's methodology has it. Exported on its own so the registry in
 * lib/papers/execution.ts can point "E1.1" here in a single line.
 */
export const E1_1_ITGC: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶26 · ISA 330 ¶13(c), ¶14(b)",
  ownsEn:
    "the ITGC testing over the IT processes supporting the audit-relevant applications — scope, walkthroughs, tests, the deficiency diagnostic, and the per-domain and IT-process conclusions",
  ownsFr:
    "les tests des contrôles informatiques généraux sur les processus informatiques des applications pertinentes pour l'audit — périmètre, tests de cheminement, tests, diagnostic des déficiences, conclusions par domaine et sur le processus informatique",
  tools: ["what-can-go-wrong"],
  reqEn: [
    "General IT controls are the controls over the entity's IT processes that support the continued proper operation of the IT environment, including the continued effective functioning of the information processing controls, and the protection of the completeness, accuracy and validity of the information held in the entity's information system.",
    "All ITGC work answers two generic IT risks: the data is not processed correctly by the IT application, and the data is not the right data. A control is tested here because it addresses one of the two, and the conclusion on it is expressed against them.",
    "Four IT process domains are covered — Changes, Access (Accès), IT Operations and Support. Each concludes on its own as Effective, Reliable or Ineffective. The IT process then concludes to Support IT, and the strategy for the controls that depend on it is to rely on them, or to Not support IT, and it is not.",
    "An ineffective ITGC does not necessarily make the IT process ineffective. The two conclusions are reached separately, on the diagnostic performed for each deficiency across its three axes — nature, timing and extent.",
    "Where the ITGCs are not effective, three routes are open: a compensating control at IT-process level; a compensating control inside the SCOT; or substantive procedures inside the SCOT, including direct testing of the application controls, the IT-dependent manual controls and the IPEs the application supports. The objective of an IT-substantive procedure is to establish that the facts which could result from the uncovered IT risk did not occur.",
    "Where processing is highly automated with little or no manual intervention, and financial information is initiated, recorded, processed or reported electronically in an integrated system, substantive procedures alone are not sufficient: those controls are both evaluated and tested.",
    "The reliability of an IPE is its completeness and its accuracy together. The accuracy sample is 25 items, reduced to 10 when the eight criteria are met, and extended to 60 where the circumstances require it.",
    "Where nothing relevant has changed, a control relied on is tested at least once every three audits and some controls are tested every audit; a control relied on in a significant-risk area is tested in the current period (ISA 330 ¶14(b)).",
  ],
  reqFr: [
    "Les contrôles informatiques généraux sont les contrôles portant sur les processus informatiques de l'entité qui soutiennent le fonctionnement continu et correct de l'environnement informatique, y compris le fonctionnement efficace des contrôles de traitement de l'information, et la protection de l'exhaustivité, de l'exactitude et de la validité des informations du système d'information.",
    "L'ensemble des travaux ITGC répond à deux risques informatiques génériques : les données ne sont pas correctement traitées par l'application, et les données ne sont pas les bonnes données. Un contrôle est testé ici parce qu'il répond à l'un des deux, et la conclusion le concernant s'exprime au regard de ces risques.",
    "Quatre domaines de processus informatiques sont couverts : Changements (Changes), Accès (Access), Exploitation (IT Operations) et Support. Chacun conclut pour lui-même : Effective, Reliable ou Ineffective. Le processus informatique conclut ensuite à Support IT — la stratégie retenue étant l'appui sur le contrôle — ou à Not support IT, auquel cas l'appui n'est pas retenu.",
    "Un ITGC inefficace n'implique pas nécessairement que le processus informatique est inefficace. Les deux conclusions sont prises séparément, sur la base du diagnostic mené pour chaque déficience selon ses trois axes : nature, calendrier et étendue.",
    "Lorsque les ITGC ne sont pas efficaces, trois voies sont ouvertes : un contrôle compensatoire au niveau du processus informatique ; un contrôle compensatoire au sein du SCOT ; ou des procédures de substance au sein du SCOT, incluant le test direct des contrôles applicatifs, des contrôles manuels dépendants de l'informatique et des IPE que l'application supporte. L'objectif d'une procédure de substance informatique est d'établir que les faits susceptibles de résulter du risque informatique non couvert ne se sont pas produits.",
    "Lorsque les traitements sont fortement automatisés, avec peu ou pas d'intervention manuelle, et que l'information financière est initiée, enregistrée, traitée ou restituée sous forme électronique dans un système intégré, les seules procédures de substance ne suffisent pas : ces contrôles sont à la fois évalués et testés.",
    "La fiabilité d'un IPE, c'est son exhaustivité et son exactitude prises ensemble. L'échantillon d'exactitude est de 25 éléments, ramené à 10 lorsque les huit critères sont réunis, et porté à 60 lorsque les circonstances l'exigent.",
    "En l'absence de changement, un contrôle sur lequel l'audit s'appuie est testé au moins une fois tous les trois audits et certains contrôles sont testés à chaque audit ; un contrôle utilisé dans un domaine à risque important est testé sur la période en cours (ISA 330 ¶14(b)).",
  ],
  conclEn: [
    "The IT processes supporting the audit-relevant applications are appropriate to address the two generic IT risks — the data is not processed correctly by the IT application, and the data is not the right data — and the ITGCs tested operated effectively throughout the period.",
    "The IT process supports, or does not support, reliance on the automated application controls, the IT-dependent manual controls and the IPEs listed, and the audit strategy is accordingly to rely, or not to rely, on those controls.",
    "The ITGC deficiencies identified are compensated or not compensated; the residual risk has been answered by the compensating controls or substantive procedures cross-referenced, and each deficiency is reported in the SOCD and communicated to the entity.",
  ],
  conclFr: [
    "Les processus informatiques des applications pertinentes pour l'audit sont adéquats au regard des deux risques informatiques génériques — les données ne sont pas correctement traitées par l'application, et les données ne sont pas les bonnes données — et les ITGC testés ont fonctionné efficacement sur toute la période.",
    "Le processus informatique soutient, ou ne soutient pas, l'appui sur les contrôles applicatifs automatisés, les contrôles manuels dépendants de l'informatique et les IPE recensés ; la stratégie d'audit retient en conséquence l'appui, ou l'absence d'appui, sur ces contrôles.",
    "Les déficiences ITGC relevées sont compensées ou ne le sont pas ; le risque résiduel a été traité par les contrôles compensatoires ou les procédures de substance référencés, et chaque déficience est portée au SOCD et communiquée à l'entité.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: `${PROC_INTRO_EN} The whole programme answers the same two generic IT risks: the data is not processed correctly by the IT application, and the data is not the right data.`,
      introFr: `${PROC_INTRO_FR} L'ensemble du programme répond aux deux mêmes risques informatiques génériques : les données ne sont pas correctement traitées par l'application, et les données ne sont pas les bonnes données.`,
      procs: [
        P(
          "scope",
          "Establish the scope of the audit's IT dependency: the applications involved in the business processes and in the production of the financial statements, with the databases, operating systems and interfaces they rest on.",
          "Délimiter le périmètre de la dépendance informatique de l'audit : les applications intervenant dans les processus opérationnels et dans l'établissement des états financiers, ainsi que les bases de données, systèmes d'exploitation et interfaces qui les supportent.",
          "S1.1 SCOT register · S2.3 IT applications · P4.3 IT environment · IT environment and high-level scoping forms · IT overview",
          "Registre des SCOT S1.1 · applications informatiques S2.3 · environnement informatique P4.3 · formulaires de cadrage de l'environnement informatique · vue d'ensemble IT",
          "Take the applications from the SCOT register rather than from the IT department's inventory: the question is which applications the audit depends on, not which ones exist. Record the layers in scope for each — application, database, operating system, network — because an ITGC is tested at a layer, not at a company.",
          "Prendre les applications dans le registre des SCOT plutôt que dans l'inventaire de la DSI : la question est de savoir de quelles applications l'audit dépend, non lesquelles existent. Consigner pour chacune les couches du périmètre — application, base de données, système d'exploitation, réseau — car un ITGC se teste à une couche, pas à une entité.",
        ),
        P(
          "adequacy",
          "Verify that the IT processes — Changes, Access, IT Operations and Support — are adequate to ensure the correct functioning of each relevant application, against the two generic IT risks.",
          "Vérifier que les processus informatiques — Changements, Accès, Exploitation et Support — sont adéquats pour assurer le bon fonctionnement de chaque application pertinente, au regard des deux risques informatiques génériques.",
          "Understand IT process, IT risk and ITGCs form · the reduced form where the audit is planned as fully substantive",
          "Formulaire de prise de connaissance du processus informatique, du risque informatique et des ITGC · formulaire allégé lorsque l'audit est prévu entièrement substantif",
        ),
        P(
          "di",
          "Where a relevant control — one responding to a significant risk, or to the risks over the recording of journal entries — has an automated part that depends on an application, additionally test that the ITGCs over that application's IT processes are designed and implemented, against the two generic IT risks.",
          "Lorsqu'un contrôle pertinent — répondant à un risque important ou aux risques liés à l'enregistrement des écritures comptables — comporte une partie automatisée dépendant d'une application, tester en outre que les ITGC des processus informatiques de cette application sont correctement conçus et mis en œuvre, au regard des deux risques génériques.",
          "Walkthrough documentation · S2.2 control design · the risk register",
          "Documentation du test de cheminement · conception des contrôles S2.2 · registre des risques",
        ),
        P(
          "walkthrough",
          "Walk each ITGC through and identify its attributes: who performs it, when, on what, how, with what, and why.",
          "Dérouler chaque ITGC en test de cheminement et en identifier les attributs : qui l'exécute, quand, sur quoi, comment, avec quel outil et pourquoi.",
          "Walkthrough working paper · inquiry of the process owner · inspection of one occurrence",
          "Papier de travail du test de cheminement · entretien avec le responsable du processus · examen d'une occurrence",
          "The attributes fixed at the walkthrough are the columns the attribute grid will carry. An attribute nobody can point to a trace for is not testable — settle that at the walkthrough rather than at the sample.",
          "Les attributs arrêtés lors du test de cheminement sont les colonnes que portera la grille d'attributs. Un attribut dont personne ne peut désigner la trace n'est pas testable : le régler au cheminement, pas au moment de l'échantillon.",
        ),
        P(
          "extent",
          "Determine the nature, the timing — the period the test covers, including the update test between the interim and the year end — and the extent of the ITGC testing according to the nature of the control: a test of one, or a wider test where the number of occurrences of the control is high.",
          "Déterminer la nature, le calendrier — la période couverte par le test, y compris le test de mise à jour entre l'intérim et la clôture — et l'étendue des tests ITGC selon la nature du contrôle : test unique, ou test élargi lorsque le nombre d'occurrences du contrôle est élevé.",
          "Test-of-control programme · S3.1 period of reliance",
          "Programme de tests de contrôles · période d'appui S3.1",
        ),
        P(
          "population",
          "Extract the population of control occurrences from the system, confirm it is complete and appropriate, then select the sample — randomly or judgementally — and document the basis of the selection.",
          "Extraire du système la population des occurrences du contrôle, s'assurer qu'elle est complète et appropriée, puis sélectionner l'échantillon — aléatoirement ou par jugement — et documenter la base de sélection.",
          "System extraction · the extraction parameters · the completeness reconciliation",
          "Extraction système · paramètres d'extraction · rapprochement d'exhaustivité",
          IPE_TIP_EN,
          IPE_TIP_FR,
        ),
        P(
          "test",
          "Test the control attributes, analyse each exception — its nature, systematic or exceptional, and its origin — and conclude on the effect for the evaluation of the IT control, or of the IPE it supports.",
          "Tester les attributs du contrôle, analyser chaque exception — sa nature, systématique ou exceptionnelle, et son origine — et conclure sur l'incidence pour l'évaluation du contrôle informatique ou de l'IPE qu'il supporte.",
          "Attribute-testing file · test-of-control form · the evidence for each item examined",
          "Fichier de test des attributs · formulaire de test de contrôle · preuves de chaque élément examiné",
        ),
        P(
          "service_org",
          "For the service organisations in the IT environment, document the nature and materiality of the services, the contractual relationship and the degree of interaction. Where the audit relies on them, obtain a SOC or ISAE 3402 type 1 or type 2 report and validate the issuing firm's competence, the framework used and the scope covered — the right IT environment and the right databases — and ask management whether the service organisation has reported any fraud, non-compliance or uncorrected error.",
          "Pour les prestataires de services intervenant dans l'environnement informatique, documenter la nature et l'importance des services, la relation contractuelle et le degré d'interaction. Lorsque l'audit s'appuie sur eux, obtenir un rapport SOC ou ISAE 3402 de type 1 ou 2 et valider la compétence du cabinet émetteur, le référentiel utilisé et le périmètre couvert — le bon environnement informatique et les bonnes bases de données — et demander à la direction si le prestataire a signalé une fraude, une non-conformité ou une erreur non corrigée.",
          "Service contract · SOC or ISAE 3402 report · service organisation form · management inquiry",
          "Contrat de services · rapport SOC ou ISAE 3402 · formulaire prestataire de services · entretien avec la direction",
          "A type 1 report says the controls were suitably designed at a date; only a type 2 says they operated over a period. Check that the report's period covers the audit period, and read the complementary user entity controls — the ones the report assumes the entity itself performs — because those are tested here, not there.",
          "Un rapport de type 1 atteste de la conception des contrôles à une date ; seul un type 2 atteste de leur fonctionnement sur une période. Vérifier que la période du rapport couvre celle de l'audit et lire les contrôles complémentaires attendus de l'entité utilisatrice — ceux que le rapport suppose exécutés par l'entité elle-même — car ils se testent ici et non chez le prestataire.",
        ),
        P(
          "deficiency",
          "For each ITGC deficiency, perform the diagnostic on its three axes — nature, timing and extent — then take one of the three routes: a compensating control at IT-process level, a compensating control inside the SCOT, or substantive procedures inside the SCOT including direct testing of the application controls, the IT-dependent manual controls and the IPEs supported. Assess the residual risk, record the effect on the control risk assessment, and report the deficiency in the SOCD.",
          "Pour chaque déficience ITGC, poser le diagnostic sur ses trois axes — nature, calendrier et étendue — puis retenir l'une des trois voies : un contrôle compensatoire au niveau du processus informatique, un contrôle compensatoire au sein du SCOT, ou des procédures de substance au sein du SCOT incluant le test direct des contrôles applicatifs, des contrôles manuels dépendants de l'informatique et des IPE supportés. Apprécier le risque résiduel, consigner l'incidence sur l'évaluation du risque lié au contrôle et porter la déficience au SOCD.",
          "Deficiency diagnostic · compensating control evidence · substantive work programme · SOCD and management letter",
          "Diagnostic des déficiences · preuves du contrôle compensatoire · programme de travaux substantifs · SOCD et lettre à la direction",
          "Timing governs the response as much as nature does: a deficiency remediated in March leaves the period before it to be covered, and that period is what the substantive route has to reach. Where developers can move changes into production, the usual answer is the list of program changes for the period and enough work on it to be satisfied that only authorised and tested changes were made.",
          "Le calendrier commande la réponse autant que la nature : une déficience corrigée en mars laisse à couvrir la période antérieure, et c'est cette période que la voie substantive doit atteindre. Lorsque les développeurs peuvent mettre en production, la réponse habituelle est la liste des changements de programme de la période et des travaux suffisants pour s'assurer que seuls des changements autorisés et testés ont été effectués.",
        ),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        Q(
          "scope",
          "All the IT applications relevant to the audit — those involved in the business processes and in producing the financial statements — have been identified and documented (procedure 1).",
          "Toutes les applications informatiques pertinentes pour l'audit — celles intervenant dans les processus opérationnels et dans l'établissement des états financiers — ont été identifiées et documentées (procédure 1).",
        ),
        Q(
          "domains",
          "An ITGC covering each of Changes, Access, IT Operations and Support has been identified, walked through and concluded on for each relevant application (procedures 2, 4, 7).",
          "Un ITGC couvrant chacun des domaines Changements, Accès, Exploitation et Support a été identifié, déroulé en test de cheminement et conclu pour chaque application pertinente (procédures 2, 4, 7).",
        ),
        Q(
          "di",
          "The ITGCs supporting the automated part of each relevant control are designed effectively and implemented (procedure 3).",
          "Les ITGC supportant la partie automatisée de chaque contrôle pertinent sont efficacement conçus et mis en œuvre (procédure 3).",
          true,
        ),
        Q(
          "population",
          "The population used for the ITGC testing was extracted from the system and confirmed complete and appropriate before any selection was made (procedure 6).",
          "La population utilisée pour les tests ITGC a été extraite du système et confirmée complète et appropriée avant toute sélection (procédure 6).",
        ),
        Q(
          "exceptions",
          "Where the tests revealed exceptions, the nature of each — systematic or exceptional — and its origin were investigated (procedure 7).",
          "Lorsque les tests ont révélé des exceptions, la nature de chacune — systématique ou exceptionnelle — et son origine ont été recherchées (procédure 7).",
          true,
        ),
        Q(
          "service_org",
          "For each service organisation relied on, a SOC or ISAE 3402 report covering the right environment and the audit period was obtained and its scope validated (procedure 8).",
          "Pour chaque prestataire de services sur lequel l'audit s'appuie, un rapport SOC ou ISAE 3402 couvrant le bon environnement et la période auditée a été obtenu et son périmètre validé (procédure 8).",
          true,
        ),
        Q(
          "response",
          "Where the ITGCs are ineffective, a compensating control or an IT-substantive procedure has been identified and performed, and the residual risk assessed (procedure 9).",
          "Lorsque les ITGC sont inefficaces, un contrôle compensatoire ou une procédure de substance informatique a été identifié et mis en œuvre, et le risque résiduel apprécié (procédure 9).",
          true,
        ),
        Q(
          "socd",
          "Each IT control deficiency has been recorded in the SOCD and communicated to the entity, and the effect on the reliability of the IPEs used in the substantive procedures has been documented (procedures 7, 9).",
          "Chaque déficience de contrôle informatique a été portée au SOCD et communiquée à l'entité, et l'incidence sur la fiabilité des IPE utilisés dans les procédures de substance a été documentée (procédures 7, 9).",
          true,
        ),
      ],
    },
    {
      kind: "fields",
      titleEn: "Part C — Conclusion by IT process domain",
      titleFr: "Partie C — Conclusion par domaine de processus informatique",
      introEn:
        "Conclude on each domain in its own right: Effective, Reliable or Ineffective. Then conclude on the IT process — Support IT, and the strategy is to rely on the control, or Not support IT, and it is not. An ineffective ITGC does not by itself make the IT process ineffective; say which conclusion the diagnostic supports and why.",
      introFr:
        "Conclure sur chaque domaine pour lui-même : Effective, Reliable ou Ineffective. Conclure ensuite sur le processus informatique : Support IT, la stratégie retenue étant l'appui sur le contrôle, ou Not support IT, l'appui n'étant pas retenu. Un ITGC inefficace ne rend pas à lui seul le processus informatique inefficace ; indiquer la conclusion que soutient le diagnostic et pourquoi.",
      fields: [
        {
          key: "domain_changes",
          kind: "select",
          labelEn: "Changes — conclusion",
          labelFr: "Changements — conclusion",
          options: DOMAIN_OPTIONS,
        },
        {
          key: "domain_access",
          kind: "select",
          labelEn: "Access (Accès) — conclusion",
          labelFr: "Accès (Access) — conclusion",
          options: DOMAIN_OPTIONS,
        },
        {
          key: "domain_operations",
          kind: "select",
          labelEn: "IT Operations — conclusion",
          labelFr: "Exploitation informatique — conclusion",
          options: DOMAIN_OPTIONS,
        },
        {
          key: "domain_support",
          kind: "select",
          labelEn: "Support — conclusion",
          labelFr: "Support — conclusion",
          options: DOMAIN_OPTIONS,
        },
        {
          key: "it_process",
          kind: "select",
          labelEn: "The IT process, taken as a whole",
          labelFr: "Le processus informatique, pris dans son ensemble",
          options: [
            { value: "support", en: "Support IT — rely on control", fr: "Support IT — appui sur le contrôle" },
            { value: "not_support", en: "Not support IT — do not rely on control", fr: "Not support IT — pas d'appui sur le contrôle" },
          ],
        },
        {
          key: "process_basis",
          kind: "input",
          labelEn: "Why the diagnostic supports that conclusion, and — where a domain is ineffective while the IT process is not — what carries the difference",
          labelFr: "En quoi le diagnostic soutient cette conclusion et, lorsqu'un domaine est inefficace sans que le processus informatique le soit, ce qui justifie l'écart",
        },
        {
          key: "dependencies",
          kind: "input",
          labelEn: "The IT dependencies this conclusion carries — application controls, IT-dependent manual controls and IPEs — and the SCOTs affected",
          labelFr: "Les dépendances informatiques portées par cette conclusion — contrôles applicatifs, contrôles manuels dépendants de l'informatique et IPE — et les SCOT concernés",
        },
        {
          key: "response",
          kind: "input",
          labelEn: "For each deficiency: the route taken — compensating control at IT-process level, compensating control inside the SCOT, or substantive procedures inside the SCOT — the residual risk, and the SOCD reference",
          labelFr: "Pour chaque déficience : la voie retenue — contrôle compensatoire au niveau du processus informatique, contrôle compensatoire au sein du SCOT, ou procédures de substance au sein du SCOT —, le risque résiduel et la référence SOCD",
        },
        {
          key: "carried",
          kind: "input",
          labelEn: "Matters carried to C1.2 significant matters, or to C6.1 points forward",
          labelFr: "Points reportés en C1.2 (points significatifs) ou en C6.1 (points reportés)",
        },
      ],
    },
  ],
};

/**
 * Keyed the way the execution set keys its papers, so wiring it in is a change
 * of one entry rather than a change of shape.
 */
export const ITGC_PAPERS: Record<string, PaperDef> = {
  "E1.1": E1_1_ITGC,
};
