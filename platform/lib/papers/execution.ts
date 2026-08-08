// The Execution working papers. Same structure as the acceptance and strategy
// sets: numbered procedures that say what to do and where the information comes
// from, an evaluation of what those procedures produced, and a conclusion the
// preparer answers.

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
  "Evaluate the results of the Part A procedures against each statement. Explain each “No” in the box beneath it, including the misstatement raised in B5.";
const YN_INTRO_FR =
  "Évaluer les résultats de la partie A au regard de chaque affirmation. Expliquer chaque « Non », y compris l'anomalie portée en B5.";

/** One execution paper, in the shape every task on this phase shares. */
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
  extraEn?: string;
  extraFr?: string;
}): PaperDef {
  return {
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
        introEn: args.extraEn ? `${PROC_INTRO_EN} ${args.extraEn}` : PROC_INTRO_EN,
        introFr: args.extraFr ? `${PROC_INTRO_FR} ${args.extraFr}` : PROC_INTRO_FR,
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
      {
        kind: "fields",
        titleEn: "Part C — Outcome",
        titleFr: "Partie C — Résultat",
        fields: [
          { key: "exceptions", kind: "input", labelEn: "Exceptions identified, the misstatement raised in B5 for each, and how each was resolved", labelFr: "Exceptions relevées, anomalie portée en B5 pour chacune, et leur résolution" },
          { key: "carried", kind: "input", labelEn: "Matters carried to B4 significant matters, or to B10 points forward", labelFr: "Points reportés en B4 (points significatifs) ou en B10 (points reportés)" },
        ],
      },
    ],
  };
}

/* ============================ significant transaction classes (E1) ======= */

const E100 = mk({
  std: "ISA 315 (Revised 2019) ¶25–26 · ISA 330 ¶18–23 · ISA 505 · ISA 240 ¶26",
  ownsEn: "the revenue and receivables flow, and the evidence obtained on it",
  ownsFr: "le flux ventes et créances et les éléments probants obtenus",
  tools: ["what-can-go-wrong", "sampling", "confirmations"],
  reqEn: [
    "We obtain an understanding of the flow of transactions from initiation through to inclusion in the financial statements, and identify the points at which a misstatement could arise (ISA 315 (Revised 2019) ¶25). The walkthrough confirms that the flow operates as described.",
    "Revenue recognition carries a presumed fraud risk unless that presumption was rebutted in D5.4 (ISA 240 ¶26). Cut-off and occurrence are the assertions most often affected.",
  ],
  reqFr: [
    "Nous prenons connaissance du flux des opérations, de leur initiation jusqu'à leur inclusion dans les états financiers, et identifions les points où une anomalie pourrait survenir (ISA 315 révisée ¶25).",
    "La comptabilisation des produits porte une présomption de risque de fraude sauf réfutation en D5.4 (ISA 240 ¶26).",
  ],
  procs: [
    P("flow", "Record the critical path: how a sale is initiated, recorded, processed and reported, naming the actors, the documents, the applications and the control points.", "Consigner le chemin critique : initiation, enregistrement, traitement et restitution d'une vente, en nommant les acteurs, documents, applications et points de contrôle.", "Process narrative · inquiry of the cycle owner · D4.6", "Descriptif de processus · entretien avec le responsable du cycle · D4.6"),
    P("walkthrough", "Walk one transaction through the whole flow. Inspect the evidence at each step and record any deviation from the description obtained.", "Dérouler une opération sur l'ensemble du flux. Examiner les preuves à chaque étape et consigner tout écart avec la description obtenue.", "Order · dispatch note · invoice · ledger entry · receipt", "Commande · bon de livraison · facture · écriture · encaissement"),
    P("controls", "Where a controls-reliance strategy was set in D7.2, test the operating effectiveness of the identified controls over the period of reliance.", "Lorsque D7.2 retient l'appui sur les contrôles, tester l'efficacité du fonctionnement des contrôles identifiés sur la période concernée.", "D7.2 · control evidence · E510 for IT-dependent controls", "D7.2 · preuves de contrôle · E510 pour les contrôles dépendants de l'informatique"),
    P("confirm", "Circularise the receivable balances selected. Follow up non-replies with a second request, and perform alternative procedures where no reply is obtained.", "Circulariser les soldes clients sélectionnés. Relancer les non-réponses et mettre en œuvre des procédures alternatives à défaut de réponse.", "Confirmation replies · ISA 505 ¶12 · subsequent receipts", "Réponses de circularisation · ISA 505 ¶12 · encaissements postérieurs"),
    P("cutoff", "Test cut-off across the year end: trace dispatches either side of the year end to the invoice and to the period in which the revenue was recognised.", "Tester la césure autour de la clôture : rapprocher les livraisons de part et d'autre de la clôture de la facture et de la période de comptabilisation.", "Dispatch register · invoices · goods returned notes", "Registre des livraisons · factures · avoirs"),
    P("substantive", "Test the recorded revenue for occurrence and accuracy on the sample selected, agreeing each item to the contract, the dispatch evidence and the cash received.", "Tester la réalité et l'exactitude des produits comptabilisés sur l'échantillon retenu, en rapprochant chaque élément du contrat, de la preuve de livraison et de l'encaissement.", "Sampling tool · contracts · dispatch evidence · bank statements", "Outil d'échantillonnage · contrats · preuves de livraison · relevés bancaires"),
    P("allowance", "Test the allowance for doubtful receivables: age the balance, and challenge the assumptions against subsequent receipts and the customer's circumstances.", "Tester la dépréciation des créances : établir la balance âgée et confronter les hypothèses aux encaissements postérieurs et à la situation du client.", "Aged receivables · subsequent receipts · E390", "Balance âgée · encaissements postérieurs · E390"),
    P("credit_notes", "Review the credit notes issued after the year end for revenue recognised before it.", "Examiner les avoirs émis après la clôture au regard des produits comptabilisés avant celle-ci.", "Post year-end credit notes · sales ledger", "Avoirs postérieurs à la clôture · journal des ventes"),
  ],
  items: [
    Q("walkthrough", "The walkthrough confirmed the flow operates as described (procedure 2)."   , "Le test de cheminement confirme que le flux fonctionne comme décrit (procédure 2)."),
    Q("controls", "Where reliance was planned, the controls tested operated effectively throughout the period of reliance (procedure 3).", "Lorsque l'appui était prévu, les contrôles testés ont fonctionné efficacement sur toute la période (procédure 3).", true),
    Q("confirmations", "The confirmation responses, together with the alternative procedures, cover the balance selected (procedure 4).", "Les réponses de circularisation et les procédures alternatives couvrent le solde sélectionné (procédure 4)."),
    Q("cutoff", "Revenue is recorded in the period in which the performance obligation was satisfied (procedures 5, 8).", "Les produits sont comptabilisés dans la période où l'obligation de prestation a été remplie (procédures 5, 8)."),
    Q("allowance", "The allowance for doubtful receivables is supported by the evidence obtained (procedure 7).", "La dépréciation des créances est étayée par les éléments obtenus (procédure 7)."),
    Q("fraud", "Nothing found indicates the fraud risk in revenue recognition identified in D5.4 has materialised (procedures 5, 6, 8).", "Rien ne montre que le risque de fraude sur les produits identifié en D5.4 s'est matérialisé (procédures 5, 6, 8)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over the revenue and receivables flow for the assertions identified as relevant in D7.2.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur le flux ventes et créances pour les assertions retenues en D7.2.",
  ],
});

const E110 = mk({
  std: "ISA 315 (Revised 2019) ¶25–26 · ISA 330 ¶18–23 · ISA 505",
  ownsEn: "the purchases and payables flow, and the evidence obtained on it",
  ownsFr: "le flux achats et fournisseurs et les éléments probants obtenus",
  tools: ["what-can-go-wrong", "sampling", "confirmations"],
  reqEn: [
    "The risk in this cycle is predominantly one of completeness: a liability that has been incurred but not recorded. Procedures are therefore directed at sources outside the purchase ledger as well as at the recorded population.",
    "We obtain an understanding of the flow from the raising of the order through to payment, and identify the points at which a misstatement could arise (ISA 315 (Revised 2019) ¶25).",
  ],
  reqFr: [
    "Le risque de ce cycle porte surtout sur l'exhaustivité : une dette engagée mais non comptabilisée. Les procédures visent donc aussi des sources extérieures au journal des achats.",
    "Nous prenons connaissance du flux, de la commande au paiement, et identifions les points où une anomalie pourrait survenir (ISA 315 révisée ¶25).",
  ],
  procs: [
    P("flow", "Record the critical path: how a purchase is ordered, received, recorded, approved and paid, naming the actors, the documents and the control points.", "Consigner le chemin critique : commande, réception, enregistrement, approbation et paiement, en nommant les acteurs, documents et points de contrôle.", "Process narrative · inquiry of the cycle owner", "Descriptif de processus · entretien avec le responsable du cycle"),
    P("walkthrough", "Walk one transaction through the whole flow, inspecting the evidence at each step.", "Dérouler une opération sur l'ensemble du flux en examinant les preuves à chaque étape.", "Purchase order · goods received note · invoice · payment", "Bon de commande · bon de réception · facture · paiement"),
    P("controls", "Where a controls-reliance strategy was set in D7.2, test the operating effectiveness of the identified controls, including the three-way match and payment authorisation.", "Lorsque D7.2 retient l'appui sur les contrôles, tester leur efficacité, dont le rapprochement à trois documents et l'autorisation des paiements.", "D7.2 · control evidence · delegation of authority", "D7.2 · preuves de contrôle · délégations de pouvoirs"),
    P("unrecorded", "Search for unrecorded liabilities: examine the payments made after the year end, the invoices received after it, and the goods received notes not yet matched to an invoice.", "Rechercher les dettes non comptabilisées : examiner les paiements postérieurs à la clôture, les factures reçues après celle-ci et les bons de réception non encore rapprochés d'une facture.", "Post year-end cash book · unmatched GRN report · supplier statements", "Journal de trésorerie postérieur · état des réceptions non rapprochées · relevés fournisseurs"),
    P("statements", "Reconcile the supplier statements to the recorded balances for the suppliers selected, and investigate every reconciling item.", "Rapprocher les relevés fournisseurs des soldes comptabilisés pour les fournisseurs sélectionnés et examiner chaque écart.", "Supplier statements · purchase ledger", "Relevés fournisseurs · journal des achats"),
    P("confirm", "Where statements are not available for a significant supplier, circularise the balance, including suppliers with a nil or debit balance.", "À défaut de relevé pour un fournisseur significatif, circulariser le solde, y compris les soldes nuls ou débiteurs.", "Confirmation replies · ISA 505", "Réponses de circularisation · ISA 505"),
    P("cutoff", "Test cut-off: trace goods received either side of the year end to the period in which the liability and the expense were recorded.", "Tester la césure : rapprocher les réceptions de part et d'autre de la clôture de la période d'enregistrement de la dette et de la charge.", "Goods received register · invoices · accruals listing", "Registre des réceptions · factures · état des charges à payer"),
    P("substantive", "Test the recorded purchases for occurrence and accuracy on the sample selected, agreeing each to the order, the receipt evidence and the invoice.", "Tester la réalité et l'exactitude des achats comptabilisés sur l'échantillon retenu, par rapprochement de la commande, de la preuve de réception et de la facture.", "Sampling tool · purchase documentation", "Outil d'échantillonnage · documentation achats"),
  ],
  items: [
    Q("walkthrough", "The walkthrough confirmed the flow operates as described (procedure 2).", "Le test de cheminement confirme que le flux fonctionne comme décrit (procédure 2)."),
    Q("controls", "Where reliance was planned, the controls tested operated effectively throughout the period of reliance (procedure 3).", "Lorsque l'appui était prévu, les contrôles testés ont fonctionné efficacement sur toute la période (procédure 3).", true),
    Q("completeness", "The search for unrecorded liabilities identified no material liability omitted from the balance sheet (procedures 4, 5).", "La recherche de dettes non comptabilisées n'a révélé aucune dette significative omise (procédures 4, 5)."),
    Q("cutoff", "Purchases and the related liabilities are recorded in the period in which the goods or services were received (procedure 7).", "Les achats et dettes correspondantes sont comptabilisés dans la période de réception des biens ou services (procédure 7)."),
    Q("reconciled", "Every reconciling item between the supplier statements and the ledger has been explained (procedure 5).", "Chaque écart entre les relevés fournisseurs et le journal a été expliqué (procédure 5)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over the purchases and payables flow for the assertions identified as relevant in D7.2, including completeness.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur le flux achats et fournisseurs pour les assertions retenues en D7.2, dont l'exhaustivité.",
  ],
});

const E120 = mk({
  std: "ISA 315 (Revised 2019) ¶25–26 · ISA 330 ¶18–23 · SYSCOHADA classes 42 / 66",
  ownsEn: "the payroll flow and the evidence obtained on personnel costs",
  ownsFr: "le flux paie et les éléments probants sur les charges de personnel",
  tools: ["what-can-go-wrong", "sampling", "analytics"],
  reqEn: [
    "Payroll is high in volume and low in individual value, and is usually processed by a system. A predictive analytical procedure is often the most efficient primary test, supported by tests of the reconciling items and of the statutory deductions.",
    "The completeness of the related social and tax liabilities at the year end is tested separately, because an unpaid declaration is a liability whether or not it has been recorded.",
  ],
  reqFr: [
    "La paie présente un volume élevé et des valeurs unitaires faibles, et est généralement traitée par un système. Une procédure analytique prédictive constitue souvent le test principal le plus efficace.",
    "L'exhaustivité des dettes sociales et fiscales à la clôture est testée séparément, une déclaration impayée constituant une dette qu'elle soit ou non comptabilisée.",
  ],
  procs: [
    P("flow", "Record how an employee is engaged, how changes to pay are authorised, how the payroll is prepared and approved, and how payment is released.", "Consigner l'embauche d'un salarié, l'autorisation des changements de rémunération, la préparation et l'approbation de la paie et la mise en paiement.", "Process narrative · inquiry of human resources and payroll", "Descriptif de processus · entretiens RH et paie"),
    P("starters", "Test the starters and leavers in the period to the supporting authorisation, and confirm that leavers ceased to be paid from the correct date.", "Tester les entrées et sorties de l'exercice au regard des autorisations, et vérifier l'arrêt de la paie des sortants à la bonne date.", "Contracts · termination letters · payroll journal", "Contrats · lettres de rupture · journal de paie"),
    P("predictive", "Build an expectation of the total payroll charge from the opening headcount, the pay awards, the joiners and the leavers, and compare it with the recorded charge. Investigate the difference.", "Construire une attente de la charge totale à partir de l'effectif d'ouverture, des augmentations, des entrées et sorties, et la comparer à la charge comptabilisée. Investiguer l'écart.", "Payroll reports · HR records · prior period charge", "États de paie · données RH · charge de l'exercice précédent"),
    P("recalculate", "Recalculate the gross-to-net for the sample selected, including the statutory deductions and the employer contributions.", "Recalculer le brut au net pour l'échantillon retenu, y compris les retenues légales et les cotisations patronales.", "Payslips · CNPS and tax rate tables · contracts", "Bulletins de paie · barèmes CNPS et fiscaux · contrats"),
    P("existence", "Test the existence of the employees selected by agreeing to personnel files and to evidence of payment into a bank account in the employee's name.", "Tester l'existence des salariés sélectionnés par rapprochement des dossiers du personnel et des preuves de virement sur un compte à leur nom.", "Personnel files · bank payment listing", "Dossiers du personnel · état des virements"),
    P("liabilities", "Agree the social and tax liabilities at the year end to the declarations filed, and confirm the payment made after the year end.", "Rapprocher les dettes sociales et fiscales de clôture des déclarations déposées et vérifier le paiement postérieur.", "CNPS and tax declarations · post year-end payments", "Déclarations CNPS et fiscales · paiements postérieurs"),
    P("directors", "Test the remuneration of the directors and of key management separately, and agree it to the authorisation and to the related party disclosure.", "Tester séparément la rémunération des dirigeants et des cadres dirigeants, et la rapprocher de l'autorisation et de l'information sur les parties liées.", "Minutes · contracts · E320", "Procès-verbaux · contrats · E320"),
  ],
  items: [
    Q("expectation", "The recorded charge agrees with the expectation built, or the difference is explained and corroborated (procedure 3).", "La charge comptabilisée concorde avec l'attente construite, ou l'écart est expliqué et corroboré (procédure 3)."),
    Q("authorised", "Every change in pay tested was authorised by a person with the authority to approve it (procedures 2, 4).", "Chaque changement de rémunération testé a été autorisé par une personne habilitée (procédures 2, 4)."),
    Q("existence", "The employees tested exist and were employed in the period (procedure 5).", "Les salariés testés existent et étaient employés sur la période (procédure 5)."),
    Q("liabilities", "The social and tax liabilities at the year end are complete and agree to the declarations filed (procedure 6).", "Les dettes sociales et fiscales de clôture sont exhaustives et concordent avec les déclarations déposées (procédure 6)."),
    Q("directors", "Directors' remuneration is authorised and is disclosed as a related party transaction (procedure 7).", "La rémunération des dirigeants est autorisée et présentée comme opération avec une partie liée (procédure 7)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over payroll and personnel costs for the assertions identified as relevant in D7.2.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur la paie et les charges de personnel pour les assertions retenues en D7.2.",
  ],
});

/* ================================================= IT (E2) =============== */

const E500 = mk({
  std: "ISA 315 (Revised 2019) ¶26(b)–(c) · ISA 330 ¶8–17",
  ownsEn: "the testing of the general IT controls",
  ownsFr: "les tests des contrôles informatiques généraux",
  reqEn: [
    "General IT controls support the continued effective operation of the automated controls and of the reports the entity produces. Where they do not operate effectively, an automated control cannot be relied on for the period affected, however well it is designed.",
    "The controls tested are those identified in D4.6 as addressing the risks arising from the use of IT: access management, change management, and IT operations.",
  ],
  reqFr: [
    "Les contrôles informatiques généraux soutiennent le fonctionnement continu des contrôles automatisés et des états produits. Sans leur efficacité, un contrôle automatisé ne peut être utilisé sur la période concernée.",
    "Les contrôles testés sont ceux identifiés en D4.6 : gestion des accès, gestion des changements et exploitation.",
  ],
  procs: [
    P("scope", "Confirm the applications and infrastructure in scope from D4.6, and the general IT controls identified against each risk.", "Confirmer les applications et l'infrastructure du périmètre issus de D4.6 et les contrôles généraux identifiés pour chaque risque.", "D4.6 · IT inventory", "D4.6 · inventaire informatique"),
    P("access_new", "Test the granting of access: for the users added in the period, inspect the approval and confirm the access granted matches what was approved.", "Tester l'attribution des accès : pour les utilisateurs créés sur l'exercice, examiner l'approbation et vérifier la conformité des droits accordés.", "Access request forms · user listing · approval evidence", "Demandes d'accès · liste des utilisateurs · preuves d'approbation"),
    P("access_leavers", "Test the removal of access: agree the leavers in the period to the date their access was disabled.", "Tester la suppression des accès : rapprocher les sorties de l'exercice de la date de désactivation des droits.", "HR leavers list · access logs · user listing", "Liste des sortants RH · journaux d'accès · liste des utilisateurs"),
    P("privileged", "Obtain the list of users with privileged or administrator access, and evaluate whether each is appropriate to that person's role.", "Obtenir la liste des utilisateurs disposant d'accès privilégiés ou administrateur et apprécier leur adéquation à la fonction exercée.", "Privileged user report · organisation chart", "État des comptes à privilèges · organigramme"),
    P("review", "Test the periodic review of user access: inspect the evidence that it was performed and that the exceptions it raised were actioned.", "Tester la revue périodique des accès : examiner la preuve de sa réalisation et du traitement des exceptions relevées.", "Access review evidence · remediation log", "Preuves de revue des accès · suivi des corrections"),
    P("change", "Test change management: for the changes selected, inspect the request, the testing performed, the approval, and confirm the person who moved the change into production is not the person who wrote it.", "Tester la gestion des changements : pour les changements retenus, examiner la demande, les tests, l'approbation et vérifier que le déployeur n'est pas le développeur.", "Change log · test evidence · approval records", "Journal des changements · preuves de tests · approbations"),
    P("operations", "Test IT operations: the scheduling and monitoring of jobs, the backup and its restoration testing, and the handling of incidents.", "Tester l'exploitation : planification et surveillance des traitements, sauvegardes et tests de restauration, et gestion des incidents.", "Job logs · backup reports · incident log", "Journaux des traitements · rapports de sauvegarde · journal des incidents"),
  ],
  items: [
    Q("access", "Access is granted only on approval, and is removed when a person leaves (procedures 2, 3).", "Les accès ne sont accordés que sur approbation et sont retirés au départ des personnes (procédures 2, 3)."),
    Q("privileged", "Privileged access is limited to those whose role requires it (procedure 4).", "Les accès privilégiés sont limités aux personnes dont la fonction l'exige (procédure 4)."),
    Q("segregation", "The person who develops a change is not the person who moves it into production (procedure 6).", "Le développeur d'un changement n'est pas celui qui le met en production (procédure 6)."),
    Q("effective", "The general IT controls operated effectively throughout the period of intended reliance (procedures 2 to 7).", "Les contrôles informatiques généraux ont fonctionné efficacement sur toute la période d'appui envisagée (procédures 2 à 7)."),
  ],
  conclEn: [
    "The general IT controls operated effectively throughout the period, and the automated controls and system-generated reports identified in D4.6 may be relied on.",
    "Where a deficiency was found, its effect on the reliance placed in E510 and on the substantive procedures has been recorded and the programme revised.",
  ],
  conclFr: [
    "Les contrôles informatiques généraux ont fonctionné efficacement sur l'exercice, et les contrôles automatisés et états produits identifiés en D4.6 peuvent être utilisés.",
    "Toute déficience relevée, son effet sur l'appui pris en E510 et sur les procédures de substance a été consigné et le programme révisé.",
  ],
});

const E510 = mk({
  std: "ISA 315 (Revised 2019) ¶26 · ISA 330 ¶8–17 · ISA 500 ¶9",
  ownsEn: "the testing of application controls and of information produced by the entity",
  ownsFr: "les tests des contrôles applicatifs et de l'information produite par l'entité",
  reqEn: [
    "An automated control operates the same way on every transaction, so testing one operation establishes how it operated throughout — provided the general IT controls in E500 supported it for the whole period.",
    "Where we use information produced by the entity as audit evidence, we obtain evidence of its accuracy and completeness, and evaluate whether it is sufficiently precise and detailed for our purpose (ISA 500 ¶9).",
  ],
  reqFr: [
    "Un contrôle automatisé s'applique de façon identique à chaque opération : tester une exécution établit son fonctionnement sur la période, sous réserve des contrôles généraux testés en E500.",
    "Lorsque nous utilisons une information produite par l'entité, nous obtenons des éléments sur son exactitude et son exhaustivité et apprécions sa précision (ISA 500 ¶9).",
  ],
  procs: [
    P("identify", "Confirm from D7.2 the automated and IT-dependent controls on which reliance is planned, and the assertion each addresses.", "Confirmer à partir de D7.2 les contrôles automatisés et dépendants de l'informatique sur lesquels l'appui est prévu et l'assertion visée par chacun.", "D7.2 · D4.4 · process narratives", "D7.2 · D4.4 · descriptifs de processus"),
    P("gitc", "Confirm that the general IT controls tested in E500 operated effectively for the whole period of reliance on each application.", "Confirmer que les contrôles généraux testés en E500 ont fonctionné efficacement sur toute la période d'appui pour chaque application.", "E500 conclusion", "Conclusion E500"),
    P("configuration", "Test each automated control by inspecting its configuration and by processing a transaction that should be accepted and one that should be rejected.", "Tester chaque contrôle automatisé par examen de son paramétrage et par le traitement d'une opération devant être acceptée et d'une devant être rejetée.", "System configuration · test transactions · screen evidence", "Paramétrage du système · opérations de test · copies d'écran"),
    P("manual_part", "For an IT-dependent manual control, test the manual element as well: who reviews the exception report, what they do with it, and the evidence they leave.", "Pour un contrôle manuel dépendant de l'informatique, tester aussi la partie manuelle : qui examine l'état d'exceptions, la suite donnée et la trace laissée.", "Exception reports · reviewer's evidence · inquiry", "États d'exceptions · trace de la revue · entretien"),
    P("ipe_source", "For each report used as audit evidence, establish the source of the data and the parameters used to produce it.", "Pour chaque état utilisé comme élément probant, établir la source des données et les paramètres de génération.", "Report parameters · screen evidence · IT inquiry", "Paramètres de l'état · copies d'écran · entretien informatique"),
    P("ipe_test", "Test the accuracy and completeness of each such report: agree its total to the general ledger, and re-perform a sample of the items in it.", "Tester l'exactitude et l'exhaustivité de chaque état : rapprocher son total du grand livre et réexécuter un échantillon d'éléments.", "General ledger · underlying documents · report output", "Grand livre · pièces justificatives · état produit"),
  ],
  items: [
    Q("gitc", "The general IT controls supported each application for the whole period of reliance (procedure 2).", "Les contrôles généraux ont soutenu chaque application sur toute la période d'appui (procédure 2)."),
    Q("configured", "Each automated control tested rejected the transaction it was designed to reject (procedure 3).", "Chaque contrôle automatisé testé a rejeté l'opération qu'il devait rejeter (procédure 3)."),
    Q("manual", "The manual element of each IT-dependent control was performed and evidenced (procedure 4).", "La partie manuelle de chaque contrôle dépendant de l'informatique a été exécutée et tracée (procédure 4).", true),
    Q("ipe", "Every report used as audit evidence has been tested for accuracy and completeness (procedures 5, 6).", "Chaque état utilisé comme élément probant a été testé quant à son exactitude et son exhaustivité (procédures 5, 6)."),
  ],
  conclEn: [
    "The application and IT-dependent controls on which reliance is placed operated effectively, and the information produced by the entity that we have used as audit evidence is accurate and complete.",
  ],
  conclFr: [
    "Les contrôles applicatifs et dépendants de l'informatique utilisés ont fonctionné efficacement, et l'information produite par l'entité que nous avons utilisée est exacte et exhaustive.",
  ],
});

/* ================================================= accounts (E3) ========= */

const E130 = mk({
  std: "ISA 501 ¶4–8 · ISA 330 ¶18–23",
  ownsEn: "the evidence obtained on inventories",
  ownsFr: "les éléments probants obtenus sur les stocks",
  tools: ["sampling"],
  reqEn: [
    "Where inventory is material, we attend the physical count unless it is impracticable, to evaluate management's instructions, observe the count, inspect the inventory and perform test counts (ISA 501 ¶4).",
    "Attendance provides evidence of existence and condition. Completeness and cut-off are established by the control the entity exercises over the movement of goods around the count.",
  ],
  reqFr: [
    "Lorsque les stocks sont significatifs, nous assistons à l'inventaire physique sauf impossibilité, afin d'apprécier les instructions, d'observer le comptage, d'examiner les stocks et d'effectuer des comptages de contrôle (ISA 501 ¶4).",
    "L'assistance fournit des éléments sur l'existence et l'état. L'exhaustivité et la césure reposent sur le contrôle des mouvements autour du comptage.",
  ],
  procs: [
    P("instructions", "Obtain and evaluate management's count instructions before the count: the cut-off arrangements, the treatment of goods in transit and of third-party stock, and the recording of the counts.", "Obtenir et apprécier les instructions d'inventaire avant le comptage : césure, traitement des biens en transit et des stocks de tiers, et enregistrement des comptages.", "Count instructions · inquiry of the stock controller", "Instructions d'inventaire · entretien avec le responsable des stocks"),
    P("observe", "Attend the count. Observe whether the instructions are followed, and record any departure and its effect.", "Assister au comptage. Observer le respect des instructions et consigner tout écart et son incidence.", "Attendance note · count sheets", "Note d'assistance · feuilles de comptage"),
    P("test_counts", "Perform test counts in both directions: from the count sheets to the goods, and from the goods to the count sheets.", "Effectuer des comptages de contrôle dans les deux sens : des feuilles vers les biens et des biens vers les feuilles.", "Count sheets · physical inspection", "Feuilles de comptage · examen physique"),
    P("cutoff", "Record the last receipt and the last dispatch reference before the count, and trace both into the correct period.", "Relever les références de la dernière réception et de la dernière livraison avant le comptage et les rattacher à la bonne période.", "Goods received and dispatch registers", "Registres des réceptions et des livraisons"),
    P("condition", "Identify damaged, obsolete and slow-moving items during the count, and follow each through to the provision recorded.", "Identifier lors du comptage les articles endommagés, obsolètes ou à rotation lente et suivre chacun jusqu'à la provision comptabilisée.", "Observation · ageing report · provision calculation", "Observation · état de rotation · calcul de la provision"),
    P("valuation", "Test the valuation: agree the cost of the items selected to the supporting invoices, and compare cost with net realisable value.", "Tester la valorisation : rapprocher le coût des articles retenus des factures et comparer le coût à la valeur nette de réalisation.", "Purchase invoices · post year-end selling prices", "Factures d'achat · prix de vente postérieurs"),
    P("third_party", "Where inventory is held by a third party, obtain confirmation from that party of the quantities and condition held.", "Lorsque des stocks sont détenus par un tiers, obtenir sa confirmation des quantités et de leur état.", "Third-party confirmation · ISA 501 ¶8", "Confirmation du tiers · ISA 501 ¶8"),
    P("rollforward", "Where the count was not at the year end, test the movements between the count date and the year end.", "Lorsque le comptage n'a pas eu lieu à la clôture, tester les mouvements entre la date de comptage et la clôture.", "Movement records · ISA 501 ¶5", "État des mouvements · ISA 501 ¶5", ),
  ],
  items: [
    Q("attended", "We attended the count, or the reason attendance was impracticable and the alternative procedures performed are recorded (procedure 2).", "Nous avons assisté au comptage, ou le motif d'impossibilité et les procédures alternatives sont consignés (procédure 2)."),
    Q("counts", "The test counts agreed to the count records in both directions (procedure 3).", "Les comptages de contrôle concordent avec les relevés dans les deux sens (procédure 3)."),
    Q("cutoff", "Inventory movements are recorded in the correct period (procedures 4, 8).", "Les mouvements de stocks sont enregistrés dans la bonne période (procédures 4, 8)."),
    Q("nrv", "Inventory is stated at the lower of cost and net realisable value (procedures 5, 6).", "Les stocks sont évalués au plus faible du coût et de la valeur nette de réalisation (procédures 5, 6)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over the existence, completeness, condition and valuation of inventories.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur l'existence, l'exhaustivité, l'état et la valorisation des stocks.",
  ],
});

const E140 = mk({
  std: "ISA 330 ¶18–23 · ISA 540 (Revised) · SYSCOHADA class 2",
  ownsEn: "the evidence obtained on property, plant and equipment",
  ownsFr: "les éléments probants obtenus sur les immobilisations corporelles",
  reqEn: [
    "The balance is tested through its movements: the opening position carried forward, the additions and disposals of the period, and the depreciation charge. A movement schedule that agrees to the ledger is the starting point.",
    "Ownership and the absence of an unrecorded charge over the asset are tested separately from existence.",
  ],
  reqFr: [
    "Le solde est testé par ses mouvements : report de l'ouverture, acquisitions et cessions de l'exercice, et dotation aux amortissements. Un tableau de mouvements rapproché du grand livre en constitue le point de départ.",
    "La propriété et l'absence de sûreté non comptabilisée sont testées séparément de l'existence.",
  ],
  procs: [
    P("schedule", "Obtain the movement schedule by class, showing gross value and accumulated depreciation. Agree the opening balances to the prior period file and the closing totals to the general ledger.", "Obtenir le tableau de mouvements par catégorie, en valeur brute et amortissements cumulés. Rapprocher les ouvertures du dossier antérieur et les clôtures du grand livre.", "Fixed asset register · general ledger · prior file", "Registre des immobilisations · grand livre · dossier antérieur"),
    P("additions", "Test the additions selected to the supplier invoice and to evidence of receipt, and confirm that the amount capitalised meets the recognition criteria.", "Tester les acquisitions retenues au regard de la facture et de la preuve de réception, et vérifier que le montant immobilisé satisfait aux critères de comptabilisation.", "Invoices · goods received notes · board approval", "Factures · bons de réception · approbation du conseil"),
    P("disposals", "Test the disposals selected: agree the proceeds to the bank, recalculate the gain or loss, and confirm the asset was removed from the register.", "Tester les cessions retenues : rapprocher le prix de la banque, recalculer la plus ou moins-value et vérifier la sortie du registre.", "Sale invoices · bank statements · register", "Factures de cession · relevés bancaires · registre"),
    P("existence", "Physically inspect a sample of assets from the register, and select a sample from the floor back to the register.", "Examiner physiquement un échantillon d'actifs du registre et sélectionner un échantillon sur site à rapprocher du registre.", "Physical inspection · fixed asset register", "Examen physique · registre des immobilisations"),
    P("ownership", "Test ownership of the significant assets: inspect the title deeds for land and buildings and the registration documents for vehicles.", "Tester la propriété des actifs significatifs : titres fonciers pour les terrains et constructions, cartes grises pour les véhicules.", "Title deeds · vehicle registration · lease contracts", "Titres fonciers · cartes grises · contrats de location"),
    P("charges", "Identify any charge, pledge or mortgage over the assets, and confirm it is disclosed.", "Identifier toute sûreté, nantissement ou hypothèque grevant les actifs et vérifier sa mention en annexe.", "Bank confirmations · loan agreements · RCCM charges register", "Confirmations bancaires · contrats de prêt · registre des sûretés RCCM"),
    P("depreciation", "Recalculate the depreciation charge, and evaluate whether the rates and useful lives remain appropriate against the condition and expected use of the assets.", "Recalculer la dotation aux amortissements et apprécier si les taux et durées d'utilité restent appropriés au regard de l'état et de l'usage attendu.", "Register · policy note · physical inspection", "Registre · note de méthode · examen physique"),
    P("impairment", "Identify indicators of impairment, including idle assets and assets whose output has fallen, and test any impairment recorded.", "Identifier les indices de dépréciation, dont les actifs inutilisés ou en sous-régime, et tester toute dépréciation comptabilisée.", "Inspection · management reports · E390", "Examen · rapports de gestion · E390"),
  ],
  items: [
    Q("agreed", "The movement schedule agrees to the general ledger and to the prior period file (procedure 1).", "Le tableau de mouvements concorde avec le grand livre et le dossier antérieur (procédure 1)."),
    Q("capitalised", "The amounts capitalised meet the recognition criteria and contain no item that should have been expensed (procedure 2).", "Les montants immobilisés satisfont aux critères de comptabilisation et ne contiennent aucun élément relevant des charges (procédure 2)."),
    Q("ownership", "The entity owns the assets recorded, and every charge over them is disclosed (procedures 5, 6).", "L'entité est propriétaire des actifs comptabilisés et toute sûreté est mentionnée (procédures 5, 6)."),
    Q("depreciation", "The depreciation rates and useful lives remain appropriate (procedure 7).", "Les taux et durées d'amortissement restent appropriés (procédure 7)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over property, plant and equipment for the assertions identified as relevant in D7.2.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les immobilisations corporelles pour les assertions retenues en D7.2.",
  ],
});

const E150 = mk({
  std: "ISA 540 (Revised) · ISA 330 ¶18–23 · IAS 36 / IAS 38 · SYSCOHADA class 21",
  ownsEn: "the evidence obtained on intangible assets and goodwill",
  ownsFr: "les éléments probants obtenus sur les immobilisations incorporelles et le goodwill",
  reqEn: [
    "Recognition is the first question: an intangible is capitalised only where it meets the criteria in the applicable framework. Development costs and internally generated items require particular attention.",
    "Goodwill and any intangible not yet available for use are tested for impairment at least annually. The impairment test is an accounting estimate, and the requirements of ISA 540 (Revised) apply to it.",
  ],
  reqFr: [
    "La comptabilisation est la première question : une immobilisation incorporelle n'est activée que si elle satisfait aux critères du référentiel. Les frais de développement et les éléments générés en interne appellent une attention particulière.",
    "Le goodwill et les incorporels non encore prêts à être mis en service font l'objet d'un test de dépréciation au moins annuel, qui constitue une estimation comptable (ISA 540 révisée).",
  ],
  procs: [
    P("schedule", "Obtain the movement schedule by class and agree the opening balances to the prior period file and the closing totals to the general ledger.", "Obtenir le tableau de mouvements par catégorie et rapprocher les ouvertures du dossier antérieur et les clôtures du grand livre.", "Intangibles register · general ledger · prior file", "Registre des incorporels · grand livre · dossier antérieur"),
    P("recognition", "For each addition, test that the recognition criteria are met, and confirm that no expenditure has been capitalised that the framework requires to be expensed.", "Pour chaque acquisition, vérifier le respect des critères de comptabilisation et l'absence d'activation de dépenses devant être comptabilisées en charges.", "Invoices · project documentation · accounting framework", "Factures · documentation de projet · référentiel comptable"),
    P("internally", "For internally generated intangibles, test the costs capitalised to the underlying records, and confirm that only costs incurred after the criteria were met are included.", "Pour les incorporels générés en interne, tester les coûts activés au regard des justificatifs et vérifier que seuls les coûts postérieurs au respect des critères sont inclus.", "Timesheets · project records · development plan", "Feuilles de temps · dossiers de projet · plan de développement"),
    P("amortisation", "Recalculate the amortisation charge and evaluate whether the useful lives remain appropriate.", "Recalculer la dotation aux amortissements et apprécier si les durées d'utilité restent appropriées.", "Register · policy note", "Registre · note de méthode"),
    P("cgu", "For goodwill, confirm the cash-generating units to which it has been allocated and that the allocation is consistent with the prior period.", "Pour le goodwill, confirmer les unités génératrices de trésorerie d'affectation et la cohérence de l'affectation avec l'exercice précédent.", "Management's impairment memorandum · prior file", "Note de dépréciation de la direction · dossier antérieur"),
    P("impairment", "Test the impairment calculation: the cash flows projected, the growth rate, the discount rate, and the period covered. Compare the prior period projections against what actually happened.", "Tester le calcul de dépréciation : flux projetés, taux de croissance, taux d'actualisation et horizon. Comparer les projections antérieures aux réalisations.", "Impairment model · board-approved budget · E390", "Modèle de dépréciation · budget approuvé · E390"),
    P("sensitivity", "Perform a sensitivity analysis on the significant assumptions, and evaluate whether a reasonably possible change would give rise to an impairment.", "Réaliser une analyse de sensibilité sur les hypothèses importantes et apprécier si une variation raisonnablement possible entraînerait une dépréciation.", "Impairment model · our recalculation", "Modèle de dépréciation · notre recalcul"),
  ],
  items: [
    Q("criteria", "Every amount capitalised meets the recognition criteria in the applicable framework (procedures 2, 3).", "Chaque montant activé satisfait aux critères de comptabilisation du référentiel (procédures 2, 3)."),
    Q("assumptions", "The assumptions in the impairment calculation are reasonable and consistent with the evidence obtained elsewhere in the file (procedure 6).", "Les hypothèses du calcul de dépréciation sont raisonnables et cohérentes avec les autres éléments du dossier (procédure 6).", true),
    Q("retrospective", "The prior period projections compared with what actually happened give no indication of management bias (procedure 6).", "La comparaison des projections antérieures aux réalisations ne révèle aucun biais de la direction (procédure 6).", true),
    Q("sensitivity", "A reasonably possible change in the significant assumptions would not give rise to an impairment (procedure 7).", "Une variation raisonnablement possible des hypothèses importantes n'entraînerait pas de dépréciation (procédure 7).", true),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over intangible assets and goodwill, including the impairment assessment.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les immobilisations incorporelles et le goodwill, y compris le test de dépréciation.",
  ],
});

const E160 = mk({
  std: "ISA 330 ¶18–23 · ISA 501 ¶10 · ISA 540 (Revised)",
  ownsEn: "the evidence obtained on investments and financial assets",
  ownsFr: "les éléments probants obtenus sur les titres et actifs financiers",
  reqEn: [
    "Existence is established by confirmation from the custodian or the issuer, or by inspection of the certificates. Classification determines the measurement basis, so it is tested before valuation.",
    "Where an investment is measured at fair value and no quoted price is available, the measurement is an accounting estimate and the requirements of ISA 540 (Revised) apply.",
  ],
  reqFr: [
    "L'existence est établie par confirmation du dépositaire ou de l'émetteur, ou par examen des titres. Le classement détermine la base d'évaluation et est testé avant la valorisation.",
    "Lorsqu'un titre est évalué à la juste valeur sans prix coté, l'évaluation constitue une estimation comptable (ISA 540 révisée).",
  ],
  procs: [
    P("schedule", "Obtain the schedule of investments and agree the total to the general ledger and the opening balances to the prior period file.", "Obtenir l'état des titres et rapprocher le total du grand livre et les ouvertures du dossier antérieur.", "Investment schedule · general ledger · prior file", "État des titres · grand livre · dossier antérieur"),
    P("confirm", "Confirm the holdings directly with the custodian, the registrar or the investee, and reconcile the reply to the schedule.", "Confirmer les détentions directement auprès du dépositaire, du teneur de registre ou de l'émetteur et rapprocher la réponse de l'état.", "Confirmation replies · ISA 505", "Réponses de circularisation · ISA 505"),
    P("inspect", "Where the entity holds the certificates itself, inspect them and confirm they are in the entity's name.", "Lorsque l'entité détient elle-même les titres, les examiner et vérifier qu'ils sont à son nom.", "Share certificates · custody records", "Certificats de titres · registre de dépôt"),
    P("additions", "Test the acquisitions and disposals of the period to the contract note and to the bank, and recalculate the gain or loss on disposal.", "Tester les acquisitions et cessions de l'exercice au regard de l'avis d'opéré et de la banque, et recalculer le résultat de cession.", "Contract notes · bank statements · board minutes", "Avis d'opéré · relevés bancaires · procès-verbaux"),
    P("classification", "Test the classification of each holding against the framework, and confirm the measurement basis applied follows from it.", "Tester le classement de chaque ligne au regard du référentiel et vérifier que la base d'évaluation en découle.", "Accounting policy · investment terms · framework", "Méthode comptable · caractéristiques des titres · référentiel"),
    P("valuation", "Test the valuation: agree the quoted holdings to the market price at the year end, and test the basis of any unquoted valuation.", "Tester la valorisation : rapprocher les titres cotés du cours de clôture et tester la base de toute valorisation non cotée.", "Market data at the year end · valuation model · E390", "Cours de clôture · modèle de valorisation · E390"),
    P("income", "Test the investment income recognised in the period, and confirm the receivable at the year end.", "Tester les produits financiers de l'exercice et vérifier la créance à la clôture.", "Dividend advices · interest calculations · bank", "Avis de dividende · calculs d'intérêts · banque"),
  ],
  items: [
    Q("existence", "The holdings recorded were confirmed by a third party or inspected (procedures 2, 3).", "Les détentions comptabilisées ont été confirmées par un tiers ou examinées (procédures 2, 3)."),
    Q("classification", "Each holding is classified in accordance with the framework, and measured on the basis that follows (procedure 5).", "Chaque ligne est classée conformément au référentiel et évaluée sur la base qui en découle (procédure 5)."),
    Q("valuation", "The carrying amount at the year end is supported by the evidence obtained (procedure 6).", "La valeur comptable à la clôture est étayée par les éléments obtenus (procédure 6)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over investments and financial assets for the assertions identified as relevant in D7.2.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les titres et actifs financiers pour les assertions retenues en D7.2.",
  ],
});

const E170 = mk({
  std: "ISA 330 ¶18–23 · ISA 505 · SYSCOHADA classes 5 / 16",
  ownsEn: "the evidence obtained on cash, bank balances, loans and borrowings",
  ownsFr: "les éléments probants obtenus sur la trésorerie, les emprunts et dettes financières",
  tools: ["confirmations", "reconciliation"],
  reqEn: [
    "Bank confirmation is obtained for every account the entity held during the period, including accounts closed during it, because a closed account may still carry a balance or a guarantee.",
    "The bank reconciliation is the control that links the confirmed balance to the ledger. Every reconciling item is tested, and outstanding items are traced into the period after the year end.",
  ],
  reqFr: [
    "Une confirmation bancaire est obtenue pour chaque compte détenu au cours de l'exercice, y compris les comptes clôturés, un compte clos pouvant encore porter un solde ou une garantie.",
    "Le rapprochement bancaire relie le solde confirmé au grand livre. Chaque élément en rapprochement est testé et suivi sur la période postérieure.",
  ],
  procs: [
    P("accounts", "Establish the complete list of bank accounts held during the period, from the ledger, the prior period file and inquiry of management.", "Établir la liste complète des comptes bancaires détenus sur l'exercice, à partir du grand livre, du dossier antérieur et d'un entretien avec la direction.", "General ledger · prior file · inquiry of management", "Grand livre · dossier antérieur · entretien avec la direction"),
    P("confirm", "Send a bank confirmation request for each account, covering the balance, the facilities, the security given and the guarantees.", "Adresser une demande de confirmation pour chaque compte, portant sur le solde, les concours, les sûretés données et les garanties.", "Bank confirmation replies · ISA 505", "Réponses des banques · ISA 505"),
    P("reconcile", "Obtain the bank reconciliation for each account. Agree the bank figure to the confirmation and the book figure to the ledger.", "Obtenir le rapprochement bancaire de chaque compte. Rapprocher le solde bancaire de la confirmation et le solde comptable du grand livre.", "Bank reconciliations · confirmations · general ledger", "Rapprochements bancaires · confirmations · grand livre"),
    P("items", "Test the reconciling items: trace the outstanding cheques and the deposits in transit into the bank statements after the year end, and investigate any item that has not cleared.", "Tester les éléments en rapprochement : suivre les chèques en circulation et les remises en cours sur les relevés postérieurs et investiguer tout élément non dénoué.", "Post year-end bank statements · cash book", "Relevés bancaires postérieurs · journal de trésorerie"),
    P("cash", "Count the cash held on hand at the year end, or reconcile a count performed at another date to the year-end balance.", "Compter les espèces en caisse à la clôture, ou rapprocher un comptage effectué à une autre date du solde de clôture.", "Cash count sheet · cash book", "Feuille de comptage · journal de caisse"),
    P("borrowings", "Agree each borrowing to the loan agreement and to the bank confirmation, and recalculate the interest charge and the accrual at the year end.", "Rapprocher chaque emprunt du contrat et de la confirmation bancaire, et recalculer la charge d'intérêts et les intérêts courus à la clôture.", "Loan agreements · bank confirmations · amortisation schedule", "Contrats de prêt · confirmations bancaires · tableau d'amortissement"),
    P("covenants", "Test compliance with the loan covenants at the year end, and evaluate the effect of any breach on the classification of the borrowing.", "Tester le respect des covenants à la clôture et apprécier l'effet de tout manquement sur le classement de l'emprunt.", "Loan agreements · covenant calculation · waiver letters", "Contrats de prêt · calcul des covenants · lettres de renonciation"),
    P("classification", "Test the split between amounts falling due within and after one year, using the repayment schedule.", "Tester la ventilation entre les montants exigibles à moins et à plus d'un an, à partir de l'échéancier.", "Repayment schedules · loan agreements", "Échéanciers · contrats de prêt"),
  ],
  items: [
    Q("all_accounts", "A confirmation was obtained for every account held during the period, including those closed during it (procedures 1, 2).", "Une confirmation a été obtenue pour chaque compte détenu sur l'exercice, y compris ceux clôturés (procédures 1, 2)."),
    Q("cleared", "Every reconciling item cleared in the period after the year end, or has been explained (procedure 4).", "Chaque élément en rapprochement s'est dénoué après la clôture, ou a été expliqué (procédure 4)."),
    Q("covenants", "The entity complied with its loan covenants at the year end (procedure 7).", "L'entité a respecté ses covenants à la clôture (procédure 7).", true),
    Q("classification", "Borrowings are correctly split between current and non-current (procedure 8).", "Les emprunts sont correctement ventilés entre court et long terme (procédure 8)."),
    Q("security", "Every security and guarantee disclosed in the bank confirmations is reflected in the financial statements (procedure 2).", "Chaque sûreté et garantie mentionnée dans les confirmations bancaires figure dans les états financiers (procédure 2)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over cash, bank balances, loans and borrowings, including the security given and the covenant position.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur la trésorerie, les emprunts et dettes financières, y compris les sûretés données et le respect des covenants.",
  ],
});

const E180 = mk({
  std: "ISA 330 ¶18–23 · ISA 540 (Revised) · SYSCOHADA classes 44 / 89",
  ownsEn: "the evidence obtained on current and deferred taxation",
  ownsFr: "les éléments probants obtenus sur l'impôt exigible et différé",
  reqEn: [
    "The current tax charge is tested by reconciling the accounting result to the taxable result, so that every reconciling item is identified and supported.",
    "An uncertain tax position is an accounting estimate. The provision recorded, or the decision not to record one, is tested against the correspondence with the administration and the advice obtained.",
  ],
  reqFr: [
    "La charge d'impôt exigible est testée par le passage du résultat comptable au résultat fiscal, chaque retraitement étant identifié et justifié.",
    "Une position fiscale incertaine constitue une estimation comptable. La provision comptabilisée, ou son absence, est testée au regard de la correspondance avec l'administration et des conseils obtenus.",
  ],
  procs: [
    P("reconcile", "Obtain the reconciliation from the accounting result to the taxable result, and test each reconciling item to its support.", "Obtenir le passage du résultat comptable au résultat fiscal et tester chaque retraitement au regard de ses justificatifs.", "Tax computation · general ledger · tax code", "Liasse fiscale · grand livre · code général des impôts"),
    P("rate", "Recalculate the tax charge using the rate in force, and confirm the treatment of the minimum tax where it applies.", "Recalculer la charge d'impôt au taux en vigueur et vérifier le traitement de l'impôt minimum forfaitaire le cas échéant.", "Tax rates in force · computation", "Taux en vigueur · calcul"),
    P("payments", "Agree the instalments paid and the withholding tax suffered to the receipts, and reconcile the balance payable at the year end.", "Rapprocher les acomptes versés et les retenues à la source des quittances et rapprocher le solde dû à la clôture.", "Payment receipts · tax account statement", "Quittances de paiement · état de compte fiscal"),
    P("returns", "Agree the prior period charge to the return as filed, and record the effect of any assessment received since.", "Rapprocher la charge de l'exercice précédent de la déclaration déposée et consigner l'effet de tout redressement notifié depuis.", "Filed returns · assessments · correspondence", "Déclarations déposées · notifications · correspondance"),
    P("uncertain", "Identify the uncertain tax positions, and test the provision recorded against the correspondence with the administration and any advice obtained.", "Identifier les positions fiscales incertaines et tester la provision comptabilisée au regard de la correspondance avec l'administration et des conseils obtenus.", "Tax correspondence · adviser's opinion · D5.2", "Correspondance fiscale · avis du conseil · D5.2"),
    P("deferred", "Test the deferred tax: the temporary differences identified, the rate applied, and the recoverability of any deferred tax asset.", "Tester l'impôt différé : différences temporelles identifiées, taux appliqué et recouvrabilité de tout actif d'impôt différé.", "Deferred tax computation · forecasts · framework", "Calcul d'impôt différé · prévisions · référentiel"),
  ],
  items: [
    Q("supported", "Every reconciling item between the accounting and taxable result is supported (procedure 1).", "Chaque retraitement entre le résultat comptable et fiscal est justifié (procédure 1)."),
    Q("balance", "The tax balance at the year end agrees to the tax account statement (procedure 3).", "Le solde d'impôt à la clôture concorde avec l'état de compte fiscal (procédure 3)."),
    Q("uncertain", "Every uncertain tax position identified is either provided for or disclosed (procedure 5).", "Chaque position fiscale incertaine identifiée fait l'objet d'une provision ou d'une mention (procédure 5).", true),
    Q("deferred_asset", "Any deferred tax asset recognised is supported by evidence that sufficient taxable profit will be available (procedure 6).", "Tout actif d'impôt différé comptabilisé est étayé par la perspective de bénéfices imposables suffisants (procédure 6).", true),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over the current and deferred tax balances and the charge for the period.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les soldes d'impôt exigible et différé et sur la charge de l'exercice.",
  ],
});

const E190 = mk({
  std: "ISA 330 ¶18–23 · ISA 250 (Revised) · SYSCOHADA class 443/445",
  ownsEn: "the evidence obtained on value added tax and other sales taxes",
  ownsFr: "les éléments probants obtenus sur la TVA et autres taxes sur les ventes",
  reqEn: [
    "The balance is tested by reconciling the tax declared across the period's returns to the revenue and purchases recorded in the ledger, and by agreeing the closing balance to the return for the final period.",
    "Non-compliance with the tax law may give rise to penalties that are themselves a liability. The requirements of ISA 250 (Revised) apply where non-compliance is identified.",
  ],
  reqFr: [
    "Le solde est testé par rapprochement de la taxe déclarée sur l'exercice avec les produits et achats comptabilisés, et par rapprochement du solde de clôture avec la dernière déclaration.",
    "Une non-conformité à la loi fiscale peut engendrer des pénalités constituant elles-mêmes une dette (ISA 250 révisée).",
  ],
  procs: [
    P("reconcile", "Reconcile the output tax declared across the period's returns to the revenue recorded in the ledger, and investigate the difference.", "Rapprocher la TVA collectée déclarée sur l'exercice des produits comptabilisés et investiguer l'écart.", "VAT returns · general ledger · revenue analysis", "Déclarations de TVA · grand livre · analyse des produits"),
    P("input", "Reconcile the input tax reclaimed to the purchases recorded, and test a sample of the reclaims to the supplier invoices.", "Rapprocher la TVA déductible des achats comptabilisés et tester un échantillon de déductions au regard des factures fournisseurs.", "VAT returns · purchase invoices", "Déclarations de TVA · factures d'achat"),
    P("balance", "Agree the balance at the year end to the return for the final period, and confirm the payment or repayment after the year end.", "Rapprocher le solde de clôture de la déclaration de la dernière période et vérifier le paiement ou le remboursement postérieur.", "Final return · post year-end bank statements", "Dernière déclaration · relevés bancaires postérieurs"),
    P("rates", "Test that the correct rate has been applied to each category of supply, including exempt and zero-rated supplies.", "Vérifier l'application du taux correct à chaque catégorie d'opérations, y compris exonérées et à taux zéro.", "Tax code · invoices · product listing", "Code général des impôts · factures · liste des produits"),
    P("filings", "Confirm that every return due in the period was filed, and identify any filed late together with the penalty arising.", "Vérifier le dépôt de chaque déclaration due sur l'exercice et identifier les dépôts tardifs et les pénalités correspondantes.", "Filing receipts · tax account statement · F1", "Récépissés de dépôt · état de compte fiscal · F1"),
  ],
  items: [
    Q("reconciled", "The tax declared reconciles to the revenue and purchases recorded (procedures 1, 2).", "La taxe déclarée se rapproche des produits et achats comptabilisés (procédures 1, 2)."),
    Q("balance", "The balance at the year end agrees to the final return and cleared after it (procedure 3).", "Le solde de clôture concorde avec la dernière déclaration et s'est dénoué après celle-ci (procédure 3)."),
    Q("filed", "Every return due in the period was filed on time (procedure 5). A “No” requires the penalty to be recorded.", "Chaque déclaration due a été déposée dans les délais (procédure 5). Un « Non » impose la comptabilisation de la pénalité."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over value added tax and other sales taxes, and any non-compliance identified has been carried to E310.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur la TVA et taxes assimilées, et toute non-conformité relevée est reportée en E310.",
  ],
});

const E200 = mk({
  std: "ISA 540 (Revised) · ISA 501 ¶9–12 · IAS 19 / IAS 37 · SYSCOHADA classes 15 / 19",
  ownsEn: "the evidence obtained on provisions and employee benefits",
  ownsFr: "les éléments probants obtenus sur les provisions et avantages du personnel",
  reqEn: [
    "A provision is recognised only where a present obligation exists as a result of a past event, an outflow is probable, and the amount can be estimated reliably. Each of those three conditions is tested, not assumed from the prior period.",
    "The measurement of a provision is an accounting estimate, and the requirements of ISA 540 (Revised) apply to it.",
  ],
  reqFr: [
    "Une provision n'est comptabilisée que s'il existe une obligation actuelle résultant d'un événement passé, qu'une sortie de ressources est probable et que le montant peut être estimé de façon fiable. Ces trois conditions sont testées.",
    "L'évaluation d'une provision constitue une estimation comptable (ISA 540 révisée).",
  ],
  procs: [
    P("schedule", "Obtain the movement schedule for each provision, showing the opening balance, additions, utilisations, releases and the closing balance.", "Obtenir le tableau de mouvements de chaque provision : ouverture, dotations, utilisations, reprises et clôture.", "Provision schedule · general ledger · prior file", "État des provisions · grand livre · dossier antérieur"),
    P("obligation", "For each provision, test that a present obligation exists at the year end as a result of a past event.", "Pour chaque provision, vérifier l'existence d'une obligation actuelle à la clôture résultant d'un événement passé.", "Contracts · correspondence · legal advice · minutes", "Contrats · correspondance · avis juridique · procès-verbaux"),
    P("measurement", "Test the measurement: the assumptions used, the discount rate where the effect is material, and the arithmetic.", "Tester l'évaluation : hypothèses retenues, taux d'actualisation lorsque l'effet est significatif, et exactitude arithmétique.", "Management's calculation · E390 · actuarial report", "Calcul de la direction · E390 · rapport actuariel"),
    P("releases", "Test the releases in the period, and confirm that each provision released is no longer required.", "Tester les reprises de l'exercice et vérifier que chaque provision reprise n'est plus nécessaire.", "Provision schedule · supporting correspondence", "État des provisions · correspondance justificative"),
    P("benefits", "Test the employee benefit obligation: agree the census data given to the actuary to the payroll, and evaluate the significant actuarial assumptions.", "Tester l'engagement au titre des avantages du personnel : rapprocher les données transmises à l'actuaire de la paie et apprécier les hypothèses actuarielles importantes.", "Actuarial report · payroll data · E120", "Rapport actuariel · données de paie · E120"),
    P("legal", "Where the provision relates to litigation, obtain the letter of inquiry response from the entity's legal advisers.", "Lorsque la provision porte sur un litige, obtenir la réponse des conseils juridiques de l'entité.", "Legal confirmation · ISA 501 ¶10 · D5.2", "Réponse du conseil juridique · ISA 501 ¶10 · D5.2"),
    P("completeness", "Test completeness: review the minutes, the correspondence and the post year-end payments for obligations not provided for.", "Tester l'exhaustivité : examiner les procès-verbaux, la correspondance et les paiements postérieurs à la recherche d'obligations non provisionnées.", "Minutes (E360) · post year-end payments · E270", "Procès-verbaux (E360) · paiements postérieurs · E270"),
  ],
  items: [
    Q("obligation", "A present obligation exists at the year end for every provision recorded (procedure 2).", "Une obligation actuelle existe à la clôture pour chaque provision comptabilisée (procédure 2)."),
    Q("measurement", "The measurement of each provision is supported by the evidence obtained (procedures 3, 5).", "L'évaluation de chaque provision est étayée par les éléments obtenus (procédures 3, 5)."),
    Q("completeness", "No obligation requiring a provision has been omitted (procedures 6, 7).", "Aucune obligation appelant une provision n'a été omise (procédures 6, 7)."),
    Q("actuarial", "The census data given to the actuary agrees to the payroll records (procedure 5).", "Les données transmises à l'actuaire concordent avec les données de paie (procédure 5).", true),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over provisions and employee benefits, including their completeness.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les provisions et avantages du personnel, y compris leur exhaustivité.",
  ],
});

const E210 = mk({
  std: "ISA 330 ¶18–23 · IFRS 16 / SYSCOHADA — crédit-bail",
  ownsEn: "the evidence obtained on leases and lease-acquisition arrangements",
  ownsFr: "les éléments probants obtenus sur les contrats de location et de crédit-bail",
  reqEn: [
    "Classification determines the accounting, so each contract is read rather than relying on how it has been described. A contract that transfers substantially all the risks and rewards of ownership is accounted for accordingly, whatever it is called.",
    "Completeness is tested from sources other than the lease register, because an unrecorded lease produces both a missing asset and a missing liability.",
  ],
  reqFr: [
    "Le classement détermine le traitement comptable : chaque contrat est lu plutôt que retenu sur sa dénomination. Un contrat transférant l'essentiel des risques et avantages est traité en conséquence.",
    "L'exhaustivité est testée à partir de sources autres que le registre des contrats, un contrat non comptabilisé générant à la fois un actif et une dette manquants.",
  ],
  procs: [
    P("register", "Obtain the register of lease contracts and agree the totals to the general ledger.", "Obtenir le registre des contrats de location et rapprocher les totaux du grand livre.", "Lease register · general ledger", "Registre des contrats · grand livre"),
    P("read", "Read the significant contracts and test the classification applied against the terms: the lease term, the transfer of title, the purchase option and the present value of the payments.", "Lire les contrats significatifs et tester le classement au regard des termes : durée, transfert de propriété, option d'achat et valeur actualisée des loyers.", "Lease contracts · accounting framework", "Contrats de location · référentiel comptable"),
    P("measure", "Recalculate the asset and the liability at inception for the contracts selected, and the charge for the period.", "Recalculer l'actif et la dette à l'origine pour les contrats retenus, ainsi que la charge de l'exercice.", "Contracts · amortisation schedule · discount rate", "Contrats · tableau d'amortissement · taux d'actualisation"),
    P("payments", "Agree the payments made in the period to the bank, and reconcile the liability movement.", "Rapprocher les loyers versés de la banque et justifier la variation de la dette.", "Bank statements · lease schedule", "Relevés bancaires · échéancier"),
    P("completeness", "Test completeness: review the rent and hire expense accounts, the minutes and the insurance schedule for arrangements not in the register.", "Tester l'exhaustivité : examiner les comptes de loyers et locations, les procès-verbaux et les polices d'assurance à la recherche de contrats absents du registre.", "General ledger · minutes (E360) · insurance policies", "Grand livre · procès-verbaux (E360) · polices d'assurance"),
    P("disclosure", "Test the maturity analysis of the lease liabilities disclosed.", "Tester l'échéancier des dettes de location présenté en annexe.", "Lease schedules · draft financial statements", "Échéanciers · projet d'états financiers"),
  ],
  items: [
    Q("classification", "The classification applied to each contract follows from its terms (procedure 2).", "Le classement appliqué à chaque contrat découle de ses termes (procédure 2)."),
    Q("completeness", "No lease arrangement has been omitted from the register (procedure 5).", "Aucun contrat de location n'a été omis du registre (procédure 5)."),
    Q("maturity", "The maturity analysis disclosed agrees to the underlying schedules (procedure 6).", "L'échéancier présenté concorde avec les tableaux sous-jacents (procédure 6)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over the lease arrangements, their classification, measurement and disclosure.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les contrats de location, leur classement, leur évaluation et leur présentation.",
  ],
});

const E220 = mk({
  std: "ISA 330 ¶18–23 · SYSCOHADA classes 8 / 48",
  ownsEn: "the evidence obtained on items outside ordinary activities (HAO)",
  ownsFr: "les éléments probants obtenus sur les éléments hors activités ordinaires (HAO)",
  reqEn: [
    "SYSCOHADA requires income and expenses outside ordinary activities to be presented separately. Classification as HAO is a matter of substance: an item that recurs, or that arises from the entity's ordinary operations, is not HAO however it is labelled.",
    "Misclassification moves an amount out of the operating result, so the classification is tested in both directions: what has been recorded as HAO, and what should have been.",
  ],
  reqFr: [
    "Le SYSCOHADA impose une présentation distincte des produits et charges hors activités ordinaires. Le classement en HAO relève de la substance : un élément récurrent ou issu de l'exploitation courante n'est pas HAO quelle que soit son intitulé.",
    "Un classement erroné déplace un montant hors du résultat d'exploitation : le classement est donc testé dans les deux sens.",
  ],
  procs: [
    P("listing", "Obtain the listing of items recorded in classes 8 and 48, and agree the total to the general ledger.", "Obtenir la liste des éléments enregistrés en classes 8 et 48 et rapprocher le total du grand livre.", "General ledger · trial balance", "Grand livre · balance"),
    P("nature", "For each item, establish its nature and test whether it falls outside the entity's ordinary activities.", "Pour chaque élément, établir sa nature et vérifier s'il se situe hors des activités ordinaires de l'entité.", "Supporting documents · inquiry of management · SYSCOHADA", "Pièces justificatives · entretien avec la direction · SYSCOHADA"),
    P("recurring", "Compare the items with those recorded as HAO in the prior periods, and challenge any that recurs.", "Comparer ces éléments à ceux classés en HAO les exercices précédents et remettre en cause tout élément récurrent.", "Prior financial statements · prior file", "États financiers antérieurs · dossier antérieur"),
    P("reverse", "Review the operating result for items that should have been classified as HAO but were not.", "Examiner le résultat d'exploitation à la recherche d'éléments qui auraient dû être classés en HAO.", "General ledger · analytical review D4.3", "Grand livre · revue analytique D4.3"),
    P("support", "Test each significant item to its supporting documentation, and confirm the amount and the period.", "Tester chaque élément significatif au regard de ses justificatifs et confirmer le montant et la période.", "Invoices · contracts · board approvals", "Factures · contrats · approbations du conseil"),
  ],
  items: [
    Q("substance", "Every item classified as HAO falls outside the entity's ordinary activities in substance (procedures 2, 3).", "Chaque élément classé en HAO se situe en substance hors des activités ordinaires (procédures 2, 3)."),
    Q("recurring", "No item classified as HAO recurs from period to period (procedure 3).", "Aucun élément classé en HAO ne se répète d'un exercice à l'autre (procédure 3)."),
    Q("complete", "No item in the operating result should have been classified as HAO (procedure 4).", "Aucun élément du résultat d'exploitation n'aurait dû être classé en HAO (procédure 4)."),
  ],
  conclEn: [
    "The items presented outside ordinary activities are correctly classified, and the operating result contains no item that should have been presented as HAO.",
  ],
  conclFr: [
    "Les éléments présentés hors activités ordinaires sont correctement classés, et le résultat d'exploitation ne contient aucun élément relevant du HAO.",
  ],
});

const E230 = mk({
  std: "ISA 330 ¶18–23 · SYSCOHADA — tableau des flux de trésorerie",
  ownsEn: "the tie-out of the cash flow statement",
  ownsFr: "le rapprochement du tableau des flux de trésorerie",
  reqEn: [
    "The cash flow statement is derived from the other primary statements. It is tested by agreeing its components back to those statements and to the movement schedules, so that the derivation itself is the evidence.",
    "Non-cash transactions are the usual source of error: an acquisition settled other than in cash, or a movement arising on translation, does not belong in a cash flow.",
  ],
  reqFr: [
    "Le tableau des flux découle des autres états de synthèse. Il est testé par rapprochement de ses composantes avec ces états et les tableaux de mouvements.",
    "Les opérations sans effet de trésorerie sont la source d'erreur habituelle : une acquisition réglée autrement qu'en numéraire ou un écart de conversion n'a pas sa place dans un flux.",
  ],
  procs: [
    P("opening_closing", "Agree the opening and closing cash and cash equivalents to the balance sheet and to E170.", "Rapprocher la trésorerie d'ouverture et de clôture du bilan et de E170.", "Balance sheet · E170 · general ledger", "Bilan · E170 · grand livre"),
    P("components", "Agree each line of the statement to the underlying movement schedule, and confirm the totals cast and cross-cast.", "Rapprocher chaque ligne du tableau du tableau de mouvements correspondant et vérifier les totaux en lignes et en colonnes.", "Movement schedules E140/E150/E170/E280 · working papers", "Tableaux de mouvements E140/E150/E170/E280 · feuilles de travail"),
    P("noncash", "Identify the non-cash transactions in the period and confirm that each has been excluded from the statement and disclosed where required.", "Identifier les opérations sans effet de trésorerie de l'exercice et vérifier leur exclusion du tableau et leur mention le cas échéant.", "General ledger · minutes · movement schedules", "Grand livre · procès-verbaux · tableaux de mouvements"),
    P("classification", "Test the classification of each flow between operating, investing and financing.", "Tester le classement de chaque flux entre exploitation, investissement et financement.", "SYSCOHADA presentation rules · draft statement", "Règles de présentation SYSCOHADA · projet de tableau"),
    P("recompute", "Recompute the statement independently from the movement schedules, and reconcile any difference to the version presented.", "Recalculer le tableau de façon indépendante à partir des tableaux de mouvements et justifier tout écart avec la version présentée.", "Our recomputation · draft financial statements", "Notre recalcul · projet d'états financiers"),
  ],
  items: [
    Q("ties", "The statement ties to the balance sheet and to the profit and loss account (procedures 1, 2).", "Le tableau se rapproche du bilan et du compte de résultat (procédures 1, 2)."),
    Q("noncash", "No non-cash transaction is presented as a cash flow (procedure 3).", "Aucune opération sans effet de trésorerie n'est présentée comme un flux (procédure 3)."),
    Q("classified", "Each flow is classified in the correct category (procedure 4).", "Chaque flux est classé dans la catégorie correcte (procédure 4)."),
  ],
  conclEn: [
    "The cash flow statement is derived correctly from the other primary statements and is presented in accordance with the applicable framework.",
  ],
  conclFr: [
    "Le tableau des flux de trésorerie découle correctement des autres états de synthèse et est présenté conformément au référentiel applicable.",
  ],
});

const E270 = mk({
  std: "ISA 501 ¶9–12 · ISA 505 · IAS 37 / SYSCOHADA — engagements hors bilan",
  ownsEn: "the evidence obtained on commitments and contingencies",
  ownsFr: "les éléments probants obtenus sur les engagements et passifs éventuels",
  reqEn: [
    "We design and perform procedures to identify litigation and claims that may give rise to a risk of material misstatement, and where such matters are identified we seek direct communication with the entity's external legal advisers (ISA 501 ¶9–10).",
    "The risk is one of completeness. The items identified in D5.2 at the planning stage are the starting point, not the population.",
  ],
  reqFr: [
    "Nous mettons en œuvre des procédures pour identifier les litiges et réclamations pouvant engendrer un risque d'anomalie significative et, le cas échéant, cherchons à communiquer directement avec les conseils juridiques externes (ISA 501 ¶9–10).",
    "Le risque porte sur l'exhaustivité. Les éléments identifiés en D5.2 constituent le point de départ, non la population.",
  ],
  procs: [
    P("carry", "Bring forward the items identified in D5.2 and confirm the position on each at the year end.", "Reprendre les éléments identifiés en D5.2 et confirmer leur situation à la clôture.", "D5.2 · inquiry of management", "D5.2 · entretien avec la direction"),
    P("legal_letter", "Send the letter of inquiry to each of the entity's external legal advisers, asking for the matters they are handling, their status and their estimate of the outcome.", "Adresser la lettre de demande à chaque conseil juridique externe : affaires traitées, état d'avancement et estimation de l'issue.", "Our letter of inquiry · ISA 501 ¶10", "Notre lettre de demande · ISA 501 ¶10"),
    P("followup", "Where a reply is not received or is qualified, follow up and, where necessary, meet the adviser with management's permission.", "En cas de réponse absente ou réservée, relancer et, si nécessaire, rencontrer le conseil avec l'accord de la direction.", "Correspondence · ISA 501 ¶11", "Correspondance · ISA 501 ¶11"),
    P("minutes", "Read the minutes of the general meetings and of the board up to the date of our report for commitments and disputes.", "Examiner les procès-verbaux d'assemblée et du conseil jusqu'à la date de notre rapport : engagements et litiges.", "Minutes (E360)", "Procès-verbaux (E360)"),
    P("bank", "Identify from the bank confirmations the guarantees, sureties and pledges given, and agree each to the disclosure.", "Identifier dans les confirmations bancaires les garanties, cautions et nantissements donnés et les rapprocher de l'annexe.", "Bank confirmations (E170) · draft disclosures", "Confirmations bancaires (E170) · projet d'annexe"),
    P("contracts", "Read the significant contracts entered into in the period for capital commitments, penalty clauses and take-or-pay obligations.", "Examiner les contrats significatifs conclus sur l'exercice : engagements d'investissement, clauses pénales et obligations d'enlèvement.", "Contract file · board approvals", "Chrono des contrats · approbations du conseil"),
    P("representation", "Obtain management's written representation that all known actual or possible litigation and claims have been disclosed to us.", "Obtenir la déclaration écrite de la direction attestant que tous les litiges connus, réels ou possibles, nous ont été communiqués.", "Representation letter (B8) · ISA 501 ¶12", "Lettre d'affirmation (B8) · ISA 501 ¶12"),
  ],
  items: [
    Q("legal_reply", "A reply was received from each legal adviser to whom an inquiry was sent (procedures 2, 3).", "Une réponse a été reçue de chaque conseil juridique interrogé (procédures 2, 3).", true),
    Q("recognised", "Each matter is recognised, disclosed or neither, consistently with the framework (procedures 1 to 6).", "Chaque élément est comptabilisé, mentionné ou ni l'un ni l'autre, conformément au référentiel (procédures 1 à 6)."),
    Q("guarantees", "Every guarantee and security identified is disclosed (procedure 5).", "Chaque garantie et sûreté identifiée est mentionnée (procédure 5)."),
    Q("representation", "The written representation on litigation and claims has been obtained (procedure 7).", "La déclaration écrite sur les litiges et réclamations a été obtenue (procédure 7)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over commitments and contingencies, and each is recognised or disclosed as the framework requires.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les engagements et passifs éventuels, chacun étant comptabilisé ou mentionné conformément au référentiel.",
  ],
});

const E280 = mk({
  std: "ISA 330 ¶18–23 · OHADA — Acte uniforme sociétés commerciales · SYSCOHADA class 1",
  ownsEn: "the evidence obtained on equity and reserves",
  ownsFr: "les éléments probants obtenus sur les capitaux propres et réserves",
  reqEn: [
    "Movements in equity are authorised by the shareholders or the board, so the authorisation is the primary evidence. Each movement is agreed to the resolution that permitted it and to the filing that made it effective.",
    "The statutory appropriation of the result, including the legal reserve, follows the Uniform Act and the entity's statutes rather than management's preference.",
  ],
  reqFr: [
    "Les mouvements de capitaux propres sont autorisés par les associés ou le conseil : l'autorisation constitue l'élément probant premier. Chaque mouvement est rapproché de la résolution et du dépôt qui l'a rendu opposable.",
    "L'affectation statutaire du résultat, dont la réserve légale, suit l'Acte uniforme et les statuts.",
  ],
  procs: [
    P("schedule", "Obtain the statement of changes in equity and agree the opening balances to the prior period financial statements and the closing balances to the general ledger.", "Obtenir le tableau de variation des capitaux propres et rapprocher les ouvertures des états financiers antérieurs et les clôtures du grand livre.", "Prior financial statements · general ledger", "États financiers antérieurs · grand livre"),
    P("capital", "Agree the share capital to the statutes and to the RCCM filing, and test any change in the period to the extraordinary general meeting resolution.", "Rapprocher le capital social des statuts et du dépôt RCCM, et tester toute variation de l'exercice au regard de la résolution d'assemblée générale extraordinaire.", "Statutes · RCCM extract · AGE minutes", "Statuts · extrait RCCM · procès-verbal d'AGE"),
    P("register", "Agree the shareholdings to the register of registered securities, and cross-refer to F6.", "Rapprocher la répartition du capital du registre des titres nominatifs et renvoyer à F6.", "Share register · F6 · statutes", "Registre des titres · F6 · statuts"),
    P("appropriation", "Test the appropriation of the prior period result to the ordinary general meeting resolution, including the transfer to the legal reserve.", "Tester l'affectation du résultat de l'exercice précédent au regard de la résolution d'assemblée générale ordinaire, y compris la dotation à la réserve légale.", "AGO minutes · statutes · Uniform Act", "Procès-verbal d'AGO · statuts · Acte uniforme"),
    P("legal_reserve", "Recalculate the legal reserve and confirm it has reached the level the Uniform Act and the statutes require.", "Recalculer la réserve légale et vérifier qu'elle atteint le niveau requis par l'Acte uniforme et les statuts.", "Uniform Act · statutes · general ledger", "Acte uniforme · statuts · grand livre"),
    P("dividends", "Test the dividends declared and paid to the resolution and to the bank, and confirm the withholding tax applied.", "Tester les dividendes décidés et versés au regard de la résolution et de la banque, et vérifier la retenue à la source appliquée.", "AGO minutes · bank statements · tax returns", "Procès-verbal d'AGO · relevés bancaires · déclarations fiscales"),
    P("half_capital", "Compare net equity with half of the share capital, and cross-refer to F7 where the threshold is breached.", "Comparer les capitaux propres à la moitié du capital social et renvoyer à F7 en cas de franchissement du seuil.", "Trial balance · statutes · F7", "Balance · statuts · F7"),
  ],
  items: [
    Q("authorised", "Every movement in equity is supported by the resolution that authorised it (procedures 2, 4, 6).", "Chaque mouvement de capitaux propres est étayé par la résolution qui l'a autorisé (procédures 2, 4, 6)."),
    Q("register", "The share capital agrees to the statutes, the RCCM filing and the share register (procedures 2, 3).", "Le capital social concorde avec les statuts, le dépôt RCCM et le registre des titres (procédures 2, 3)."),
    Q("legal_reserve", "The legal reserve has been appropriated as the Uniform Act and the statutes require (procedures 4, 5).", "La réserve légale a été dotée conformément à l'Acte uniforme et aux statuts (procédures 4, 5)."),
    Q("half_capital", "Net equity exceeds half of the share capital (procedure 7).", "Les capitaux propres excèdent la moitié du capital social (procédure 7).", true),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over equity and reserves, and the movements in the period were properly authorised and recorded.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les capitaux propres et réserves, et les mouvements de l'exercice ont été dûment autorisés et enregistrés.",
  ],
});

/* ================================================= general (E4) ========== */

const E310 = mk({
  std: "ISA 250 (Revised) ¶13–29",
  ownsEn: "the consideration of laws and regulations and of any non-compliance identified",
  ownsFr: "la prise en compte des textes légaux et réglementaires et des non-conformités relevées",
  reqEn: [
    "For the laws and regulations that have a direct effect on the determination of material amounts and disclosures, we obtain sufficient appropriate evidence of compliance. For other laws and regulations that may have a material effect, we perform specified procedures to help identify non-compliance (ISA 250 (Revised) ¶14–15).",
    "Where non-compliance is identified or suspected, we obtain an understanding of the act and the circumstances, evaluate the effect on the financial statements, and communicate it to those charged with governance unless prohibited by law (ISA 250 ¶19–24). Reporting obligations to an authority may also arise.",
  ],
  reqFr: [
    "Pour les textes ayant une incidence directe sur la détermination de montants et informations significatifs, nous obtenons des éléments suffisants sur leur respect. Pour les autres, nous mettons en œuvre des procédures spécifiques (ISA 250 révisée ¶14–15).",
    "En cas de non-conformité relevée ou suspectée, nous en comprenons la nature et les circonstances, en évaluons l'effet et la communiquons aux responsables de la gouvernance sauf interdiction légale (ISA 250 ¶19–24).",
  ],
  procs: [
    P("framework", "Establish the legal and regulatory framework applicable to the entity and its sector, and identify the texts with a direct effect on the financial statements.", "Établir le cadre légal et réglementaire applicable à l'entité et à son secteur et identifier les textes ayant une incidence directe sur les comptes.", "Statutes · sector regulation · OHADA Uniform Acts · D4.2", "Statuts · réglementation sectorielle · Actes uniformes OHADA · D4.2"),
    P("compliance", "For each such text, obtain evidence of compliance, including the licences held and the returns filed.", "Pour chacun de ces textes, obtenir les éléments attestant du respect : agréments détenus et déclarations déposées.", "Licences · filed returns · regulator correspondence", "Agréments · déclarations déposées · correspondance du régulateur"),
    P("inquire", "Inquire of management and of those charged with governance about compliance, and about any investigation, inspection or penalty.", "S'enquérir auprès de la direction et des responsables de la gouvernance du respect des textes et de toute enquête, inspection ou sanction.", "Inquiry · minutes · correspondence", "Entretien · procès-verbaux · correspondance"),
    P("inspect", "Inspect the correspondence with the licensing and regulatory authorities.", "Examiner la correspondance avec les autorités de tutelle et de régulation.", "Regulator correspondence file", "Chrono de correspondance avec les régulateurs"),
    P("indicators", "Remain alert to indicators of non-compliance: unexplained payments, payments to unusual destinations, unauthorised transactions and adverse media.", "Rester attentif aux indices de non-conformité : paiements inexpliqués, versements vers des destinations inhabituelles, opérations non autorisées et presse défavorable.", "General ledger · E350 · D3.1 screening", "Grand livre · E350 · criblage D3.1"),
    P("evaluate", "Where non-compliance is identified or suspected, obtain an understanding of the act and evaluate the effect on the financial statements, including any provision or disclosure required.", "En cas de non-conformité relevée ou suspectée, en comprendre la nature et évaluer l'effet sur les comptes, y compris toute provision ou mention requise.", "Legal advice · management explanation · E200 · E270", "Avis juridique · explications de la direction · E200 · E270"),
    P("report", "Determine whether a duty to report to an authority arises, including the révélation des faits délictueux, and cross-refer to F5.", "Déterminer s'il existe une obligation de signalement à une autorité, dont la révélation des faits délictueux, et renvoyer à F5.", "OHADA Uniform Act · professional obligations · F5", "Acte uniforme OHADA · obligations professionnelles · F5"),
  ],
  items: [
    Q("direct", "Evidence of compliance has been obtained for every law with a direct effect on material amounts and disclosures (procedure 2).", "Des éléments de conformité ont été obtenus pour chaque texte ayant une incidence directe sur des montants et informations significatifs (procédure 2)."),
    Q("none", "No instance of non-compliance was identified or suspected (procedures 3 to 5).", "Aucune non-conformité n'a été relevée ni suspectée (procédures 3 à 5)."),
    Q("communicated", "Each instance identified has been communicated to those charged with governance (procedure 6).", "Chaque cas relevé a été communiqué aux responsables de la gouvernance (procédure 6).", true),
    Q("reporting", "The duty to report to an authority has been considered and the conclusion recorded (procedure 7).", "L'obligation de signalement à une autorité a été examinée et la conclusion consignée (procédure 7)."),
  ],
  conclEn: [
    "The laws and regulations relevant to the financial statements have been considered, and any non-compliance identified has been evaluated, communicated and reflected in the financial statements.",
  ],
  conclFr: [
    "Les textes légaux et réglementaires pertinents ont été pris en compte, et toute non-conformité relevée a été évaluée, communiquée et traduite dans les comptes.",
  ],
});

const E320 = mk({
  std: "ISA 550 ¶18–26",
  ownsEn: "the testing of related party relationships and transactions",
  ownsFr: "les tests des relations et opérations avec les parties liées",
  reqEn: [
    "For an identified significant related party transaction outside the entity's normal course of business, we inspect the underlying contracts and evaluate whether the business rationale suggests fraudulent financial reporting or the concealment of misappropriation (ISA 550 ¶23).",
    "Where management asserts that a related party transaction was conducted on terms equivalent to an arm's length transaction, we obtain sufficient appropriate evidence for that assertion (ISA 550 ¶24).",
  ],
  reqFr: [
    "Pour une opération significative hors du cours normal des affaires avec une partie liée, nous examinons les contrats sous-jacents et apprécions si la justification économique suggère une information financière frauduleuse ou la dissimulation d'un détournement (ISA 550 ¶23).",
    "Lorsque la direction affirme qu'une opération a été conclue à des conditions de marché, nous obtenons des éléments suffisants à l'appui (ISA 550 ¶24).",
  ],
  procs: [
    P("register", "Bring forward the related party register from D5.6 and confirm it remains complete at the year end.", "Reprendre le registre des parties liées de D5.6 et confirmer son exhaustivité à la clôture.", "D5.6 · inquiry of management", "D5.6 · entretien avec la direction"),
    P("search", "Search the ledger, the bank statements and the minutes for transactions with the parties on the register, and for names not on it.", "Rechercher dans le grand livre, les relevés bancaires et les procès-verbaux les opérations avec les parties du registre et les noms absents de celui-ci.", "General ledger · bank statements · minutes (E360)", "Grand livre · relevés bancaires · procès-verbaux (E360)"),
    P("contracts", "For each significant transaction, inspect the contract and test the amount, the terms and the authorisation.", "Pour chaque opération significative, examiner le contrat et tester le montant, les conditions et l'autorisation.", "Contracts · board minutes · invoices", "Contrats · procès-verbaux du conseil · factures"),
    P("outside", "For each transaction outside the normal course of business, evaluate whether the business rationale suggests fraudulent reporting or concealment.", "Pour chaque opération hors du cours normal des affaires, apprécier si la justification économique suggère une fraude ou une dissimulation.", "ISA 550 ¶23 · contracts · inquiry", "ISA 550 ¶23 · contrats · entretien"),
    P("arms_length", "Where management asserts arm's length terms, obtain evidence for that assertion by comparing with transactions with unrelated parties or with independent market data.", "Lorsque la direction invoque des conditions de marché, obtenir les éléments correspondants par comparaison avec des opérations avec des tiers ou des données de marché indépendantes.", "Comparable transactions · market data · ISA 550 ¶24", "Opérations comparables · données de marché · ISA 550 ¶24"),
    P("balances", "Confirm the balances outstanding with each related party at the year end, and test their recoverability.", "Confirmer les soldes réciproques avec chaque partie liée à la clôture et tester leur recouvrabilité.", "Confirmations · post year-end settlements", "Confirmations · règlements postérieurs"),
    P("disclosure", "Test the related party disclosure in the draft financial statements against the register and the transactions tested, and against the conventions réglementées in F2.", "Tester l'information sur les parties liées du projet d'états financiers au regard du registre, des opérations testées et des conventions réglementées de F2.", "Draft financial statements · F2 · framework", "Projet d'états financiers · F2 · référentiel"),
  ],
  items: [
    Q("complete", "The search identified no related party or transaction that management had not disclosed (procedure 2).", "La recherche n'a révélé aucune partie liée ni opération non communiquée par la direction (procédure 2)."),
    Q("authorised", "Every significant related party transaction was authorised in accordance with the entity's procedures (procedure 3).", "Chaque opération significative avec une partie liée a été autorisée conformément aux procédures de l'entité (procédure 3)."),
    Q("rationale", "The business rationale for each transaction outside the normal course of business is consistent with the evidence obtained (procedure 4).", "La justification économique de chaque opération hors du cours normal des affaires concorde avec les éléments obtenus (procédure 4).", true),
    Q("arms_length", "Where arm's length terms are asserted, the evidence supports that assertion (procedure 5).", "Lorsque des conditions de marché sont invoquées, les éléments obtenus étayent cette affirmation (procédure 5).", true),
    Q("disclosed", "The disclosure agrees to the register and to the transactions tested (procedure 7).", "L'information présentée concorde avec le registre et les opérations testées (procédure 7)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over the related party relationships and transactions, and the disclosure in the financial statements is complete.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les relations et opérations avec les parties liées, et l'information en annexe est exhaustive.",
  ],
});

const E330 = mk({
  std: "ISA 570 (Revised) ¶12–20",
  ownsEn: "the going concern evaluation and the evidence obtained on it",
  ownsFr: "l'appréciation de la continuité d'exploitation et les éléments probants obtenus",
  reqEn: [
    "We evaluate management's assessment of the entity's ability to continue as a going concern, covering the same period as management's assessment and at least twelve months from the date of the financial statements (ISA 570 (Revised) ¶13, ¶15).",
    "Where events or conditions are identified that may cast significant doubt, we obtain sufficient appropriate evidence to determine whether a material uncertainty exists, including evaluating management's plans and the feasibility of those plans (ISA 570 ¶16).",
  ],
  reqFr: [
    "Nous apprécions l'évaluation faite par la direction de la capacité de l'entité à poursuivre son exploitation, sur la même période et au moins douze mois à compter de la date des états financiers (ISA 570 révisée ¶13, ¶15).",
    "Lorsque des événements ou conditions peuvent jeter un doute important, nous obtenons des éléments suffisants pour déterminer s'il existe une incertitude significative, y compris la faisabilité des plans de la direction (ISA 570 ¶16).",
  ],
  procs: [
    P("carry", "Bring forward the events and conditions identified in D5.5 and confirm the position on each.", "Reprendre les événements et conditions identifiés en D5.5 et confirmer leur situation.", "D5.5 · inquiry of management", "D5.5 · entretien avec la direction"),
    P("assessment", "Obtain management's assessment. Confirm the period it covers extends at least twelve months from the date of the financial statements.", "Obtenir l'évaluation de la direction et vérifier qu'elle couvre au moins douze mois à compter de la date des états financiers.", "Management's assessment · board approval", "Évaluation de la direction · approbation du conseil"),
    P("forecast", "Test the cash flow forecast underlying the assessment: the reliability of the data, the assumptions applied, and the arithmetic.", "Tester les prévisions de trésorerie sous-jacentes : fiabilité des données, hypothèses retenues et exactitude arithmétique.", "Cash flow forecast · budget · management accounts", "Prévisions de trésorerie · budget · situations intermédiaires"),
    P("history", "Compare the prior period forecasts with what actually happened, and evaluate the reliability of management's forecasting.", "Comparer les prévisions de l'exercice précédent aux réalisations et apprécier la fiabilité des prévisions de la direction.", "Prior forecasts · actual results", "Prévisions antérieures · réalisations"),
    P("facilities", "Confirm the borrowing facilities available: the amount, the expiry, the covenants and whether they are committed.", "Confirmer les concours bancaires disponibles : montant, échéance, covenants et caractère confirmé.", "Bank confirmations (E170) · facility letters", "Confirmations bancaires (E170) · lettres d'autorisation"),
    P("plans", "Evaluate management's plans for future action, and obtain evidence that each plan is feasible and that the outcome improves the situation.", "Apprécier les plans d'action de la direction et obtenir les éléments attestant de leur faisabilité et de leur effet favorable.", "Board minutes · signed agreements · shareholder support", "Procès-verbaux · accords signés · soutien des actionnaires"),
    P("support", "Where the entity relies on support from a shareholder or a group company, obtain written confirmation of that support and evaluate the supporter's ability to provide it.", "Lorsque l'entité s'appuie sur le soutien d'un actionnaire ou d'une société du groupe, obtenir la confirmation écrite de ce soutien et apprécier la capacité du garant à l'apporter.", "Letter of support · supporter's financial statements", "Lettre de soutien · états financiers du garant"),
    P("disclosure", "Where a material uncertainty exists, test the adequacy of the disclosure of the events and conditions and of management's plans.", "En cas d'incertitude significative, tester le caractère approprié de l'information relative aux événements, conditions et plans de la direction.", "Draft financial statements · ISA 570 ¶19", "Projet d'états financiers · ISA 570 ¶19"),
  ],
  items: [
    Q("period", "Management's assessment covers at least twelve months from the date of the financial statements (procedure 2).", "L'évaluation de la direction couvre au moins douze mois à compter de la date des états financiers (procédure 2)."),
    Q("forecast", "The cash flow forecast is supported by the evidence obtained and its assumptions are consistent with the rest of the file (procedure 3).", "Les prévisions de trésorerie sont étayées par les éléments obtenus et leurs hypothèses concordent avec le reste du dossier (procédure 3)."),
    Q("reliable", "Management's forecasting has proved reliable in the prior periods (procedure 4).", "Les prévisions de la direction se sont révélées fiables lors des exercices précédents (procédure 4)."),
    Q("no_uncertainty", "No material uncertainty related to going concern exists (procedures 1 to 7). A “No” requires the disclosure to be tested and the report paragraph to be prepared.", "Aucune incertitude significative liée à la continuité n'existe (procédures 1 à 7). Un « Non » impose de tester l'annexe et de préparer le paragraphe du rapport."),
    Q("disclosure", "Where a material uncertainty exists, the disclosure is adequate (procedure 8).", "En cas d'incertitude significative, l'information fournie est appropriée (procédure 8).", true),
  ],
  conclEn: [
    "The use of the going concern basis of accounting is appropriate.",
    "The effect of our conclusion on the auditor's report has been determined and recorded in C1.",
  ],
  conclFr: [
    "L'application du principe de continuité d'exploitation est appropriée.",
    "L'effet de notre conclusion sur le rapport a été déterminé et consigné en C1.",
  ],
});

const E360 = mk({
  std: "ISA 250 (Revised) ¶15 · ISA 500 · OHADA — Acte uniforme sociétés commerciales",
  ownsEn: "the reading of the minutes and the statutory records",
  ownsFr: "l'examen des procès-verbaux et des registres statutaires",
  reqEn: [
    "The minutes record the decisions that give rise to accounting consequences. They are read for the whole period and up to the date of our report, because a decision taken after the year end may be an adjusting event or a disclosure.",
    "The statutory records evidence that the entity has complied with the Uniform Act on the holding of meetings, the keeping of registers and the filing of accounts.",
  ],
  reqFr: [
    "Les procès-verbaux consignent les décisions ayant des conséquences comptables. Ils sont examinés sur l'ensemble de l'exercice et jusqu'à la date de notre rapport.",
    "Les registres statutaires attestent du respect de l'Acte uniforme quant à la tenue des assemblées, des registres et au dépôt des comptes.",
  ],
  procs: [
    P("completeness", "Establish that the minutes obtained are complete: compare the meetings held with the requirements of the statutes and confirm the numbering of the minutes is unbroken.", "Établir l'exhaustivité des procès-verbaux : comparer les réunions tenues aux exigences statutaires et vérifier la continuité de leur numérotation.", "Statutes · minute book · inquiry of the secretary", "Statuts · registre des procès-verbaux · entretien avec le secrétaire"),
    P("read", "Read the minutes of the general meetings, the board and any committee for the period and up to the date of our report.", "Examiner les procès-verbaux des assemblées, du conseil et des comités sur l'exercice et jusqu'à la date de notre rapport.", "Minute book · committee papers", "Registre des procès-verbaux · dossiers des comités"),
    P("extract", "Extract every decision with an accounting or disclosure consequence, and cross-refer each to the working paper that deals with it.", "Relever chaque décision ayant une conséquence comptable ou d'information et la renvoyer à la feuille de travail concernée.", "Our extract schedule · related working papers", "Notre relevé · feuilles de travail concernées"),
    P("registers", "Inspect the statutory registers: the register of registered securities, the register of attendance and the register of the board's deliberations.", "Examiner les registres statutaires : registre des titres nominatifs, feuille de présence et registre des délibérations.", "Statutory registers · F6", "Registres statutaires · F6"),
    P("filings", "Confirm that the prior period accounts were approved within the statutory deadline and filed with the RCCM.", "Vérifier que les comptes de l'exercice précédent ont été approuvés dans le délai légal et déposés au RCCM.", "AGO minutes · RCCM filing receipt · F1", "Procès-verbal d'AGO · récépissé de dépôt RCCM · F1"),
    P("subsequent", "Read the minutes of the meetings held after the year end for events requiring adjustment or disclosure, and carry each to E380.", "Examiner les procès-verbaux des réunions postérieures à la clôture à la recherche d'événements à ajuster ou à mentionner et les reporter en E380.", "Post year-end minutes · E380", "Procès-verbaux postérieurs · E380"),
  ],
  items: [
    Q("complete", "The minutes obtained cover every meeting held in the period and up to the date of our report (procedures 1, 2).", "Les procès-verbaux obtenus couvrent chaque réunion tenue sur l'exercice et jusqu'à la date de notre rapport (procédures 1, 2)."),
    Q("extracted", "Every decision with an accounting consequence has been cross-referred to the working paper that deals with it (procedure 3).", "Chaque décision à conséquence comptable est renvoyée à la feuille de travail concernée (procédure 3)."),
    Q("registers", "The statutory registers are kept and up to date (procedure 4).", "Les registres statutaires sont tenus et à jour (procédure 4)."),
    Q("filed", "The prior period accounts were approved and filed within the statutory deadline (procedure 5).", "Les comptes de l'exercice précédent ont été approuvés et déposés dans le délai légal (procédure 5)."),
  ],
  conclEn: [
    "The minutes and statutory records have been read for the period and up to the date of our report, and every matter with an accounting or reporting consequence has been reflected in the file.",
  ],
  conclFr: [
    "Les procès-verbaux et registres statutaires ont été examinés sur l'exercice et jusqu'à la date de notre rapport, et chaque point à conséquence comptable ou d'information est repris au dossier.",
  ],
});

const E370 = mk({
  std: "ISA 510 ¶5–10 · ISA 710 ¶7–9",
  ownsEn: "the evidence obtained on opening balances and comparatives",
  ownsFr: "les éléments probants obtenus sur les soldes d'ouverture et les comparatifs",
  reqEn: [
    "For an initial engagement we obtain sufficient appropriate evidence about whether the opening balances contain misstatements that materially affect the current period, and whether the accounting policies have been consistently applied (ISA 510 ¶6).",
    "Comparative information is presented in accordance with the framework. Where we become aware that a material misstatement exists in the comparatives on which a prior report was issued, we follow ISA 560 in respect of that prior period (ISA 710 ¶8).",
  ],
  reqFr: [
    "Pour une mission initiale, nous obtenons des éléments suffisants sur l'absence, dans les soldes d'ouverture, d'anomalies affectant significativement l'exercice, et sur la permanence des méthodes (ISA 510 ¶6).",
    "L'information comparative est présentée conformément au référentiel. Si une anomalie significative y est décelée, nous appliquons l'ISA 560 pour l'exercice antérieur (ISA 710 ¶8).",
  ],
  procs: [
    P("agree", "Agree the opening balances to the prior period financial statements, and confirm they reflect any adjustment made after those statements were approved.", "Rapprocher les soldes d'ouverture des états financiers antérieurs et vérifier la prise en compte de tout ajustement postérieur à leur approbation.", "Prior financial statements · prior file · general ledger", "États financiers antérieurs · dossier antérieur · grand livre"),
    P("predecessor", "Where a predecessor auditor acted, review their file for the opening position, or perform the alternative procedures planned in D3.4.", "Lorsqu'un auditeur précédent est intervenu, examiner son dossier pour la position d'ouverture ou mettre en œuvre les procédures alternatives prévues en D3.4.", "Predecessor's working papers · D3.4", "Feuilles de travail du prédécesseur · D3.4"),
    P("current", "Determine whether the current period procedures already provide evidence over the opening balances, such as the collection of opening receivables or the sale of opening inventory.", "Déterminer si les procédures de l'exercice fournissent déjà des éléments sur les soldes d'ouverture : encaissement des créances d'ouverture, écoulement des stocks d'ouverture.", "E100 · E130 · current period testing", "E100 · E130 · tests de l'exercice"),
    P("specific", "For the balances not covered, perform specific procedures on the opening position, including the physical existence of assets and the confirmation of liabilities.", "Pour les soldes non couverts, mettre en œuvre des procédures spécifiques sur la position d'ouverture : existence physique des actifs et confirmation des dettes.", "Confirmations · inspection · supporting documents", "Confirmations · examen physique · pièces justificatives"),
    P("policies", "Test that the accounting policies applied to the opening balances are consistent with those applied in the current period, and that any change has been accounted for and disclosed.", "Vérifier la permanence des méthodes appliquées aux soldes d'ouverture et le traitement et la mention de tout changement.", "Prior policy note · current policy note", "Note de méthodes antérieure · note de méthodes actuelle"),
    P("comparatives", "Agree the comparative figures to the prior period financial statements, and test any restatement to its supporting analysis.", "Rapprocher les chiffres comparatifs des états financiers antérieurs et tester tout retraitement au regard de son analyse justificative.", "Prior financial statements · restatement analysis", "États financiers antérieurs · analyse du retraitement"),
  ],
  items: [
    Q("agreed", "The opening balances agree to the prior period financial statements as approved (procedure 1).", "Les soldes d'ouverture concordent avec les états financiers antérieurs approuvés (procédure 1)."),
    Q("no_misstatement", "The opening balances contain no misstatement that materially affects the current period (procedures 2 to 4).", "Les soldes d'ouverture ne contiennent aucune anomalie affectant significativement l'exercice (procédures 2 à 4)."),
    Q("consistent", "The accounting policies have been applied consistently, or a change has been properly accounted for and disclosed (procedure 5).", "Les méthodes comptables ont été appliquées de façon permanente, ou tout changement a été correctement traité et mentionné (procédure 5)."),
    Q("comparatives", "The comparative figures agree to the prior period financial statements (procedure 6).", "Les chiffres comparatifs concordent avec les états financiers antérieurs (procédure 6)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over the opening balances and the comparative information, and the effect on the auditor's report has been determined.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les soldes d'ouverture et l'information comparative, et l'effet sur le rapport a été déterminé.",
  ],
});

const E380 = mk({
  std: "ISA 560 ¶6–9",
  ownsEn: "the subsequent events procedures performed during execution",
  ownsFr: "les procédures sur les événements postérieurs mises en œuvre en exécution",
  reqEn: [
    "We perform procedures designed to obtain sufficient appropriate evidence that all events occurring between the date of the financial statements and the date of the auditor's report that require adjustment or disclosure have been identified (ISA 560 ¶6).",
    "The procedures cover the whole period up to the date of the report. B7 records the final position at completion; this paper records the work performed during execution.",
  ],
  reqFr: [
    "Nous mettons en œuvre des procédures visant à obtenir des éléments suffisants attestant que tous les événements survenus entre la date des états financiers et celle du rapport et appelant un ajustement ou une mention ont été identifiés (ISA 560 ¶6).",
    "Les procédures couvrent la période jusqu'à la date du rapport. B7 consigne la position finale à l'achèvement.",
  ],
  procs: [
    P("understand", "Obtain an understanding of the procedures management has established to identify subsequent events.", "Prendre connaissance des procédures mises en place par la direction pour identifier les événements postérieurs.", "Inquiry of management · closing procedures", "Entretien avec la direction · procédures de clôture"),
    P("inquire", "Inquire of management and of those charged with governance about new commitments, borrowings, guarantees, disposals, litigation and any event affecting the assumptions used in the financial statements.", "S'enquérir auprès de la direction et des responsables de la gouvernance des nouveaux engagements, emprunts, garanties, cessions, litiges et de tout événement affectant les hypothèses retenues.", "Inquiry · ISA 560 ¶7(b)", "Entretien · ISA 560 ¶7(b)"),
    P("minutes", "Read the minutes of the meetings held after the date of the financial statements.", "Examiner les procès-verbaux des réunions tenues après la date des états financiers.", "Post year-end minutes (E360)", "Procès-verbaux postérieurs (E360)"),
    P("interim", "Read the entity's latest interim financial information and management accounts.", "Examiner la dernière situation intermédiaire et les états de gestion de l'entité.", "Interim accounts · management reports", "Situation intermédiaire · états de gestion"),
    P("transactions", "Review the transactions recorded after the year end for items indicating a condition that existed at the year end, including receipts, payments, credit notes and journal entries.", "Examiner les opérations enregistrées après la clôture révélant une situation existant à la clôture : encaissements, paiements, avoirs et écritures.", "Post year-end ledger · bank statements", "Grand livre postérieur · relevés bancaires"),
    P("classify", "Classify each event identified as adjusting or non-adjusting, and confirm the treatment applied in the financial statements.", "Classer chaque événement identifié en ajustant ou non ajustant et vérifier le traitement retenu dans les comptes.", "IAS 10 / SYSCOHADA · draft financial statements", "IAS 10 / SYSCOHADA · projet d'états financiers"),
  ],
  items: [
    Q("period", "The procedures cover the whole period from the date of the financial statements to the date of this work (procedures 2 to 5).", "Les procédures couvrent toute la période depuis la date des états financiers jusqu'à la date de ces travaux (procédures 2 à 5)."),
    Q("classified", "Each event identified is classified as adjusting or non-adjusting and treated accordingly (procedure 6).", "Chaque événement identifié est classé en ajustant ou non ajustant et traité en conséquence (procédure 6).", true),
    Q("carried", "Each event identified has been carried to B7 for the position at the date of the report (procedure 6).", "Chaque événement identifié est reporté en B7 pour la position à la date du rapport (procédure 6)."),
  ],
  conclEn: [
    "The subsequent events procedures performed during execution identified every event requiring adjustment or disclosure up to the date of this work, and the position is carried to B7.",
  ],
  conclFr: [
    "Les procédures sur les événements postérieurs mises en œuvre en exécution ont identifié tout événement à ajuster ou à mentionner jusqu'à la date de ces travaux, et la position est reportée en B7.",
  ],
});

const E390 = mk({
  std: "ISA 540 (Revised) ¶21–33",
  ownsEn: "the testing of the accounting estimates",
  ownsFr: "les tests des estimations comptables",
  reqEn: [
    "For each accounting estimate we obtain evidence on whether the method, the significant assumptions and the data are appropriate, and whether management has applied them consistently (ISA 540 (Revised) ¶23–26). One or more of three approaches is used: testing how management made the estimate, testing events occurring up to the date of the report, or developing our own point estimate or range.",
    "We review the judgements and decisions made by management for indicators of possible management bias, and evaluate whether those indicators taken together represent a risk of material misstatement due to fraud (ISA 540 ¶32).",
  ],
  reqFr: [
    "Pour chaque estimation, nous obtenons des éléments sur le caractère approprié de la méthode, des hypothèses importantes et des données, et sur leur application cohérente (ISA 540 révisée ¶23–26).",
    "Nous examinons les jugements de la direction à la recherche d'indices de biais et apprécions si, pris ensemble, ils constituent un risque d'anomalie résultant de fraude (ISA 540 ¶32).",
  ],
  procs: [
    P("inventory", "Bring forward the inventory of estimates and the approach set for each in D5.7.", "Reprendre l'inventaire des estimations et l'approche arrêtée pour chacune en D5.7.", "D5.7 · draft financial statements", "D5.7 · projet d'états financiers"),
    P("method", "Test the method applied: whether it is appropriate in the circumstances and applied consistently with the prior period, and that any change is justified.", "Tester la méthode appliquée : caractère approprié, permanence par rapport à l'exercice précédent et justification de tout changement.", "Management's calculation · policy note · prior file", "Calcul de la direction · note de méthode · dossier antérieur"),
    P("assumptions", "Test each significant assumption for reasonableness, and for consistency with the assumptions used elsewhere in the financial statements and with the evidence obtained in the rest of the file.", "Tester le caractère raisonnable de chaque hypothèse importante et sa cohérence avec les autres hypothèses des comptes et les éléments du dossier.", "Management's support · market data · E330 · E150", "Justificatifs de la direction · données de marché · E330 · E150"),
    P("data", "Test the data used: its relevance and reliability, and agree it to the underlying records.", "Tester les données utilisées : pertinence et fiabilité, et rapprochement des enregistrements sous-jacents.", "Source records · E510 for system reports", "Enregistrements sources · E510 pour les états système"),
    P("approach", "Apply the approach set in D5.7: test how management made the estimate, test events up to the date of the report, or develop our own point estimate or range.", "Appliquer l'approche arrêtée en D5.7 : tester le processus de la direction, utiliser les événements jusqu'à la date du rapport, ou développer notre propre estimation ou fourchette.", "ISA 540 ¶23–29 · our independent estimate", "ISA 540 ¶23–29 · notre estimation indépendante"),
    P("range", "Where the estimate falls outside our range, or the point estimate differs materially from management's, raise the difference as a misstatement in B5.", "Lorsque l'estimation sort de notre fourchette ou diffère significativement de la nôtre, porter l'écart en anomalie en B5.", "Our range · B5", "Notre fourchette · B5"),
    P("bias", "Review the judgements and decisions made across the estimates for indicators of management bias, including a pattern of estimates falling at the favourable end of the range.", "Examiner les jugements portés sur l'ensemble des estimations à la recherche d'indices de biais, dont une tendance systématique vers l'extrémité favorable de la fourchette.", "ISA 540 ¶32 · all estimates tested · E350", "ISA 540 ¶32 · ensemble des estimations testées · E350"),
    P("disclosure", "Test the disclosure of the estimation uncertainty, and whether it conveys the range of possible outcomes.", "Tester l'information relative à l'incertitude d'estimation et sa capacité à traduire l'éventail des issues possibles.", "Draft financial statements · ISA 540 ¶31", "Projet d'états financiers · ISA 540 ¶31"),
  ],
  items: [
    Q("method", "The method applied to each estimate is appropriate and has been applied consistently (procedure 2).", "La méthode appliquée à chaque estimation est appropriée et appliquée de façon permanente (procédure 2)."),
    Q("assumptions", "The significant assumptions are reasonable and consistent with the rest of the file (procedure 3).", "Les hypothèses importantes sont raisonnables et cohérentes avec le reste du dossier (procédure 3)."),
    Q("within", "Each estimate falls within the range we consider reasonable (procedures 5, 6).", "Chaque estimation se situe dans la fourchette que nous jugeons raisonnable (procédures 5, 6)."),
    Q("bias", "The judgements made across the estimates show no indicator of management bias (procedure 7).", "Les jugements portés sur l'ensemble des estimations ne révèlent aucun indice de biais de la direction (procédure 7)."),
    Q("disclosure", "The disclosure of estimation uncertainty is adequate (procedure 8).", "L'information sur l'incertitude d'estimation est appropriée (procédure 8)."),
  ],
  conclEn: [
    "Sufficient appropriate audit evidence has been obtained over the accounting estimates, and each is reasonable in the context of the applicable financial reporting framework.",
  ],
  conclFr: [
    "Des éléments probants suffisants et appropriés ont été obtenus sur les estimations comptables, chacune étant raisonnable au regard du référentiel applicable.",
  ],
});

/* ================================================= response tasks (E5) === */

const E350 = mk({
  std: "ISA 240 ¶31–34, ¶36–37",
  ownsEn: "the responses to the risk of management override of controls",
  ownsFr: "les réponses au risque de contournement des contrôles par la direction",
  tools: ["journal-entry-testing"],
  reqEn: [
    "Irrespective of our assessment of the risk of management override, we design and perform procedures to test the appropriateness of journal entries and other adjustments, to review accounting estimates for bias, and to evaluate the business rationale of significant transactions outside the normal course of business (ISA 240 ¶31).",
    "These procedures are performed on every engagement. They are not conditional on a fraud risk having been identified elsewhere.",
  ],
  reqFr: [
    "Quelle que soit notre évaluation du risque de contournement, nous concevons et mettons en œuvre des procédures pour tester les écritures et ajustements, examiner les estimations à la recherche de biais et apprécier la justification économique des opérations significatives inhabituelles (ISA 240 ¶31).",
    "Ces procédures sont mises en œuvre sur toute mission, indépendamment de l'identification d'un risque de fraude par ailleurs.",
  ],
  procs: [
    P("population", "Obtain the complete population of journal entries for the period, and reconcile its total movement to the general ledger to establish completeness.", "Obtenir la population complète des écritures de l'exercice et rapprocher le total de ses mouvements du grand livre pour en établir l'exhaustivité.", "Journal entry extract · general ledger · E510", "Extraction des écritures · grand livre · E510"),
    P("criteria", "Set the criteria for selecting entries to test: entries posted at unusual times, by unexpected users, to unrelated accounts, with round amounts, with no narrative, or posted at or after the period end.", "Définir les critères de sélection des écritures à tester : heures inhabituelles, utilisateurs inattendus, comptes sans lien, montants ronds, absence de libellé, ou postérieures à la clôture.", "ISA 240 ¶32(a) · journal entry testing tool", "ISA 240 ¶32(a) · outil de test des écritures"),
    P("test", "Test the entries selected to the supporting documentation, and establish the business reason for each.", "Tester les écritures sélectionnées au regard des justificatifs et établir la raison économique de chacune.", "Supporting documents · inquiry of the preparer", "Pièces justificatives · entretien avec l'auteur de l'écriture"),
    P("estimates", "Review the accounting estimates for bias, and perform a retrospective review of the significant estimates of the prior period.", "Examiner les estimations comptables à la recherche de biais et procéder à une revue rétrospective des estimations importantes de l'exercice précédent.", "E390 · D5.7 · prior financial statements", "E390 · D5.7 · états financiers antérieurs"),
    P("unusual", "Identify the significant transactions outside the normal course of business, and evaluate whether the business rationale suggests they were entered into to misstate the financial statements or to conceal misappropriation.", "Identifier les opérations significatives hors du cours normal des affaires et apprécier si leur justification économique suggère une volonté de fausser les comptes ou de dissimuler un détournement.", "ISA 240 ¶32(c) · E320 · contracts · minutes", "ISA 240 ¶32(c) · E320 · contrats · procès-verbaux"),
    P("consolidation", "Test the consolidation and closing adjustments, including any entry made outside the accounting system.", "Tester les écritures de consolidation et de clôture, y compris celles passées hors du système comptable.", "Closing entry schedule · spreadsheets · D4.6", "État des écritures de clôture · tableurs · D4.6"),
  ],
  items: [
    Q("complete", "The journal entry population reconciles to the general ledger (procedure 1).", "La population des écritures se rapproche du grand livre (procédure 1)."),
    Q("supported", "Every entry tested is supported and has a business reason (procedure 3).", "Chaque écriture testée est justifiée et repose sur une raison économique (procédure 3)."),
    Q("no_bias", "The review of estimates shows no indicator of management bias (procedure 4).", "L'examen des estimations ne révèle aucun indice de biais de la direction (procédure 4)."),
    Q("rationale", "The business rationale for each significant unusual transaction is consistent with the evidence obtained (procedure 5).", "La justification économique de chaque opération significative inhabituelle concorde avec les éléments obtenus (procédure 5).", true),
    Q("outside_system", "No material entry was made outside the accounting system without approval (procedure 6).", "Aucune écriture significative n'a été passée hors du système comptable sans approbation (procédure 6)."),
  ],
  conclEn: [
    "The procedures required by ISA 240 ¶31 in response to the risk of management override have been performed, and nothing has come to our attention indicating that management has overridden controls.",
  ],
  conclFr: [
    "Les procédures requises par l'ISA 240 ¶31 en réponse au risque de contournement ont été mises en œuvre, et rien n'indique que la direction ait contourné les contrôles.",
  ],
});

export const EXECUTION_PAPERS: Record<string, PaperDef> = {
  E100,
  E110,
  E120,
  E500,
  E510,
  E130,
  E140,
  E150,
  E160,
  E170,
  E180,
  E190,
  E200,
  E210,
  E220,
  E230,
  E270,
  E280,
  E310,
  E320,
  E330,
  E360,
  E370,
  E380,
  E390,
  E350,
};
