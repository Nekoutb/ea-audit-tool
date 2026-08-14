// The GAM-alignment papers: the ten tasks added when the file was restructured
// to mirror the roadmap (significant accounts, SCOTs, flows/WCGWs, walkthroughs,
// FSCP, controls strategy, post-interim updates, risk reassessment, archive).
// Wording is original and anchored to the ISAs, not to any firm's material.

import type { PaperDef } from "./types";

/* ---------------------------------------------------------------- D5.8 --- */
const D5_8: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶28–29 · ISA 320 ¶10–11",
  ownsEn: "the scoping matrix: significant accounts, disclosures and their relevant assertions",
  ownsFr: "la matrice de périmètre : comptes significatifs, informations à fournir et assertions pertinentes",
  reqEn: [
    "For each class of transactions, account balance and disclosure, we determine whether it is significant: whether there is a reasonable possibility of a material misstatement, judged before considering controls (ISA 315 ¶28–29). The quantitative screen compares the item to performance materiality from D5.1; the qualitative screen considers susceptibility to fraud, estimation uncertainty, related-party involvement, changes in the business, and complexity of the accounting requirement.",
    "For every significant item we then identify the relevant assertions — those for which a material misstatement is reasonably possible. Assertions for classes of transactions are occurrence, completeness, accuracy, cutoff, classification and presentation; for balances they are existence, rights and obligations, completeness, accuracy-valuation-allocation, classification and presentation (ISA 315 ¶A190).",
    "The matrix recorded here drives everything downstream: each significant account maps to the transaction cycles that feed it (D8.1) and to the execution programs that will address its relevant assertions. An account excluded here is not worked; the exclusion rationale is therefore documented with the same care as an inclusion.",
  ],
  reqFr: [
    "Pour chaque flux, solde et information à fournir, nous déterminons s'il est significatif : existe-t-il une possibilité raisonnable d'anomalie significative, appréciée avant prise en compte des contrôles (ISA 315 ¶28–29) ? Le filtre quantitatif compare l'élément au seuil de planification de D5.1 ; le filtre qualitatif considère la fraude, l'incertitude d'estimation, les parties liées, les évolutions de l'activité et la complexité comptable.",
    "Pour chaque élément significatif, nous identifions les assertions pertinentes — celles pour lesquelles une anomalie significative est raisonnablement possible (ISA 315 ¶A190).",
    "La matrice établie ici pilote la suite : chaque compte significatif est relié aux cycles qui l'alimentent (D8.1) et aux programmes d'exécution qui traiteront ses assertions. Une exclusion est documentée avec le même soin qu'une inclusion.",
  ],
  conclEn: ["Significant accounts, disclosures and their relevant assertions have been identified, and the resulting scope is complete."],
  conclFr: ["Les comptes significatifs, informations à fournir et assertions pertinentes ont été identifiés, et le périmètre qui en résulte est complet."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      procs: [
        { key: "tb", en: "Obtain the trial balance or latest financial statements and list every class of transactions, account balance and disclosure.", fr: "Obtenir la balance ou les derniers états financiers et recenser chaque flux, solde et information à fournir.", srcEn: "Trial balance import · prior-year financial statements", srcFr: "Import de balance · états financiers N-1" },
        { key: "quant", en: "Apply the quantitative screen: flag every item above performance materiality (D5.1), and record the threshold used.", fr: "Appliquer le filtre quantitatif : signaler tout élément supérieur au seuil de planification (D5.1) et consigner le seuil retenu.", srcEn: "D5.1 materiality paper · trial balance", srcFr: "Papier D5.1 · balance" },
        { key: "qual", en: "Apply the qualitative screen to items below the threshold: fraud susceptibility, estimation uncertainty, related parties, business changes, accounting complexity. Add any item flagged.", fr: "Appliquer le filtre qualitatif aux éléments sous le seuil : fraude, incertitude d'estimation, parties liées, évolutions, complexité comptable. Ajouter tout élément signalé.", srcEn: "D5.4 fraud risks · D5.6 related parties · D4.2 understanding", srcFr: "D5.4 · D5.6 · D4.2" },
        { key: "assertions", en: "For each significant item, identify the relevant assertions and record the reason each assertion is (or is not) relevant.", fr: "Pour chaque élément significatif, identifier les assertions pertinentes et le motif de leur pertinence (ou non).", srcEn: "Risk assessment discussions · cycle knowledge", srcFr: "Échanges d'évaluation des risques · connaissance des cycles" },
        { key: "map", en: "Map each significant account to the transaction cycles that feed it, and confirm every one is carried by a SCOT identified in D8.1.", fr: "Relier chaque compte significatif aux cycles qui l'alimentent et vérifier que chacun est porté par une SCOT identifiée en D8.1.", srcEn: "D8.1 SCOT listing", srcFr: "Liste des SCOT (D8.1)" },
        { key: "disclosures", en: "Identify significant disclosures, including those not derived from the trial balance (commitments, related parties, going concern).", fr: "Identifier les informations à fournir significatives, y compris celles hors balance (engagements, parties liées, continuité).", srcEn: "Framework disclosure checklist · prior-year notes", srcFr: "Liste des informations du référentiel · annexe N-1" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Scoping confirmations",
      titleFr: "Partie B — Confirmations de périmètre",
      introEn: "Explain each “No” in the box beneath it.",
      introFr: "Expliquer chaque « Non » dans l'encadré au-dessous.",
      items: [
        { key: "above_pm", en: "Every account and disclosure above performance materiality has been scoped in or its exclusion justified.", fr: "Chaque compte et information au-dessus du seuil de planification est inclus, ou son exclusion est justifiée." },
        { key: "qual_done", en: "Qualitative factors were considered for items below the threshold.", fr: "Les facteurs qualitatifs ont été examinés pour les éléments sous le seuil." },
        { key: "assert_each", en: "Relevant assertions are recorded for every significant account and disclosure.", fr: "Les assertions pertinentes sont consignées pour chaque élément significatif." },
        { key: "linked", en: "Every significant account is linked to at least one execution program that addresses its relevant assertions.", fr: "Chaque compte significatif est relié à au moins un programme d'exécution traitant ses assertions." },
        { key: "partner", en: "The engagement partner has reviewed and agreed the scoping matrix.", fr: "L'associé responsable a revu et approuvé la matrice de périmètre." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D8.1 --- */
const D8_1: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶25(a) · ¶A136–A143",
  ownsEn: "the list of significant classes of transactions and the IT applications that process them",
  ownsFr: "la liste des catégories significatives de transactions et des applications qui les traitent",
  reqEn: [
    "We identify the significant classes of transactions (SCOTs): the transaction streams that feed the significant accounts identified in D5.8. Each is classified as routine (high volume, recurring), non-routine (unusual, period-end) or estimation (judgement-driven), because the classification drives where misstatements are likely to arise and what the audit response looks like.",
    "For each SCOT we identify the IT applications and other technology through which the transactions are initiated, recorded, processed and reported (ISA 315 ¶25(a), ¶26(b)). This list is the bridge to the IT work: the applications named here define the scope of ITGC testing (E500) and application-control work (E510), and connect to the IT environment understanding in D4.6.",
  ],
  reqFr: [
    "Nous identifions les catégories significatives de transactions (SCOT) : les flux qui alimentent les comptes significatifs de D5.8. Chacune est classée routinière, non routinière ou estimation, car cette classification détermine où les anomalies peuvent naître et la réponse d'audit.",
    "Pour chaque SCOT, nous identifions les applications informatiques par lesquelles les transactions sont initiées, enregistrées, traitées et restituées (ISA 315 ¶25(a), ¶26(b)). Cette liste définit le périmètre des travaux ITGC (E500) et des contrôles applicatifs (E510), en lien avec D4.6.",
  ],
  conclEn: ["The significant classes of transactions and their related applications have been identified completely."],
  conclFr: ["Les catégories significatives de transactions et leurs applications associées ont été identifiées de manière exhaustive."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      procs: [
        { key: "streams", en: "From the significant accounts in D5.8, identify every transaction stream that feeds them, and name each SCOT.", fr: "À partir des comptes significatifs de D5.8, identifier chaque flux de transactions qui les alimente et nommer chaque SCOT.", srcEn: "D5.8 scoping matrix · discussion with finance", srcFr: "Matrice D5.8 · échange avec la direction financière" },
        { key: "classify", en: "Classify each SCOT as routine, non-routine or estimation, and record the volume and frequency.", fr: "Classer chaque SCOT (routinière, non routinière, estimation) et consigner volume et fréquence.", srcEn: "Management inquiry · system reports", srcFr: "Entretiens · états systèmes" },
        { key: "apps", en: "For each SCOT, identify the applications and interfaces through which transactions are initiated, recorded, processed and reported.", fr: "Pour chaque SCOT, identifier les applications et interfaces d'initiation, d'enregistrement, de traitement et de restitution.", srcEn: "IT inquiry (D4.6) · system landscape diagram", srcFr: "Entretiens IT (D4.6) · cartographie des systèmes" },
        { key: "accounts", en: "Map each SCOT to the significant accounts it affects, and verify every significant account is reached by at least one SCOT or scoped as a non-transactional balance.", fr: "Relier chaque SCOT aux comptes significatifs concernés et vérifier que chaque compte significatif est couvert.", srcEn: "D5.8 matrix", srcFr: "Matrice D5.8" },
        { key: "itscope", en: "Confirm the applications listed here are inside the ITGC scope (E500), or record why not.", fr: "Vérifier que les applications recensées entrent dans le périmètre ITGC (E500), ou consigner pourquoi non.", srcEn: "E500 scope note", srcFr: "Note de périmètre E500" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      items: [
        { key: "complete", en: "Every significant account from D5.8 is fed by an identified SCOT or documented as non-transactional.", fr: "Chaque compte significatif de D5.8 est alimenté par une SCOT identifiée ou documenté comme non transactionnel." },
        { key: "classified", en: "Each SCOT carries a routine / non-routine / estimation classification.", fr: "Chaque SCOT est classée routinière / non routinière / estimation." },
        { key: "apps_listed", en: "The related applications are identified for every SCOT.", fr: "Les applications associées sont identifiées pour chaque SCOT." },
        { key: "it_aligned", en: "The application list agrees with the IT environment understanding in D4.6.", fr: "La liste des applications concorde avec la connaissance de l'environnement informatique (D4.6)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D8.2 --- */
const D8_2: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶25–26 · ¶A144–A150",
  ownsEn: "the per-cycle flow documentation: transaction flows, what-could-go-wrongs and the controls that address them",
  ownsFr: "la documentation par cycle : flux de transactions, points de risque (WCGW) et contrôles associés",
  reqEn: [
    "For each SCOT we document the flow of transactions from initiation through recording and processing to reporting, including how the flow is corrected and how it reaches the general ledger (ISA 315 ¶25(a)). The documentation names the people, the documents and the systems at each step.",
    "At each step we ask what could go wrong: the specific points where a misstatement could arise in a relevant assertion. For each what-could-go-wrong we identify whether a control exists that addresses it, who performs the control, how often, and whether it is manual, IT-dependent manual, or automated. Automated and IT-dependent controls inherit the reliability of the applications behind them, which is why each is tagged to its application from D8.1.",
    "We evaluate the design of each identified control and determine whether it has been implemented — walkthroughs (D8.3) provide that evidence. Whether the control will be tested for operating effectiveness is a separate decision, made in D8.5.",
  ],
  reqFr: [
    "Pour chaque SCOT, nous documentons le flux de l'initiation à la restitution, y compris les corrections et le déversement en comptabilité générale (ISA 315 ¶25(a)), en nommant acteurs, documents et systèmes à chaque étape.",
    "À chaque étape, nous identifions ce qui pourrait mal tourner (WCGW) : les points précis où une anomalie pourrait naître sur une assertion pertinente, puis le contrôle qui y répond, son exécutant, sa fréquence et sa nature (manuel, manuel dépendant de l'informatique, automatisé).",
    "Nous évaluons la conception de chaque contrôle et sa mise en œuvre — les tests de cheminement (D8.3) en apportent la preuve. La décision de tester l'efficacité opérationnelle relève de D8.5.",
  ],
  conclEn: ["The flows, what-could-go-wrongs and controls of each significant class of transactions are documented and their design evaluated."],
  conclFr: ["Les flux, points de risque et contrôles de chaque catégorie significative de transactions sont documentés et leur conception évaluée."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      procs: [
        { key: "flow", en: "For each SCOT, document the flow initiation → recording → processing → reporting, naming people, documents and systems at each step.", fr: "Pour chaque SCOT, documenter le flux initiation → enregistrement → traitement → restitution, en nommant acteurs, documents et systèmes.", srcEn: "Process inquiry · procedure manuals · system screens", srcFr: "Entretiens · manuels de procédures · écrans systèmes" },
        { key: "wcgw", en: "At each step, record the what-could-go-wrongs: where a misstatement could arise and which relevant assertion it would hit.", fr: "À chaque étape, consigner les WCGW : où une anomalie pourrait naître et quelle assertion serait touchée.", srcEn: "Flow documentation · team discussion (D7.1)", srcFr: "Documentation des flux · discussion d'équipe (D7.1)" },
        { key: "controls", en: "For each what-could-go-wrong, identify the control that addresses it: performer, frequency, and nature (manual / IT-dependent / automated), tagged to its application.", fr: "Pour chaque WCGW, identifier le contrôle qui y répond : exécutant, fréquence, nature (manuel / dépendant IT / automatisé), rattaché à son application.", srcEn: "Control descriptions · D8.1 application list", srcFr: "Descriptions de contrôles · liste d'applications D8.1" },
        { key: "design", en: "Evaluate the design of each control: performed as described, by someone with authority and competence, at a frequency that would catch a material misstatement.", fr: "Évaluer la conception de chaque contrôle : exécution conforme, autorité et compétence de l'exécutant, fréquence adaptée.", srcEn: "Inquiry · inspection of control evidence", srcFr: "Entretiens · inspection des preuves de contrôle" },
        { key: "gaps", en: "Record every what-could-go-wrong with no control or a badly designed one, and carry each to the risk register (D7.2) and to D8.5 as substantive-only.", fr: "Consigner chaque WCGW sans contrôle ou mal conçu, et le reporter au registre des risques (D7.2) et en approche substantive (D8.5).", srcEn: "This paper · D7.2", srcFr: "Ce papier · D7.2" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      items: [
        { key: "each_scot", en: "A flow, its what-could-go-wrongs and its controls are documented for every SCOT in D8.1.", fr: "Flux, WCGW et contrôles sont documentés pour chaque SCOT de D8.1." },
        { key: "assertions", en: "Each what-could-go-wrong names the relevant assertion it threatens.", fr: "Chaque WCGW précise l'assertion pertinente menacée." },
        { key: "design_ok", en: "The design of each identified control has been evaluated.", fr: "La conception de chaque contrôle identifié a été évaluée." },
        { key: "gaps_carried", en: "Control gaps are carried to the risk register and to the controls strategy.", fr: "Les lacunes de contrôle sont reportées au registre des risques et à la stratégie de contrôles." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D8.3 --- */
const D8_3: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶26(a) · ISA 230 ¶8",
  ownsEn: "the walkthrough evidence that the documented flows and controls exist as described",
  ownsFr: "la preuve par cheminement que les flux et contrôles documentés existent tels que décrits",
  reqEn: [
    "A walkthrough traces one transaction of each significant class from origination through the entity's processes to its reporting in the financial statements, using the same documents and IT systems the entity uses. It combines inquiry, observation and inspection: we watch the control performed, inspect the evidence it leaves, and ask the performer what happens when something unusual arrives (ISA 315 ¶26(a), A verification of implementation).",
    "The walkthrough confirms — or corrects — the flow documentation in D8.2. A difference between the documented and the observed process is not a footnote: it updates D8.2, may create a new what-could-go-wrong, and may change the controls strategy in D8.5.",
  ],
  reqFr: [
    "Un test de cheminement suit une transaction de chaque catégorie significative depuis son origine jusqu'aux états financiers, avec les documents et systèmes réels de l'entité. Il combine entretien, observation et inspection (ISA 315 ¶26(a)).",
    "Le cheminement confirme — ou corrige — la documentation de D8.2. Un écart entre le processus documenté et le processus observé met à jour D8.2, peut créer un nouveau WCGW et modifier la stratégie de contrôles (D8.5).",
  ],
  conclEn: ["Walkthroughs confirm that the documented flows and controls are implemented as described."],
  conclFr: ["Les tests de cheminement confirment que les flux et contrôles documentés sont mis en œuvre tels que décrits."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      procs: [
        { key: "select", en: "Select one representative transaction per SCOT (and one non-routine instance where the flow differs at period end).", fr: "Sélectionner une transaction représentative par SCOT (et un cas non routinier lorsque le flux diffère en clôture).", srcEn: "Transaction listings", srcFr: "Journaux de transactions" },
        { key: "trace", en: "Trace it end-to-end through documents and systems, recording each step against the D8.2 flow.", fr: "La suivre de bout en bout à travers documents et systèmes, en rapprochant chaque étape du flux D8.2.", srcEn: "Source documents · system records", srcFr: "Pièces d'origine · enregistrements systèmes" },
        { key: "observe", en: "At each control point, observe or reperform the control and inspect the evidence it leaves.", fr: "À chaque point de contrôle, observer ou refaire le contrôle et inspecter la preuve laissée.", srcEn: "Control evidence (signatures, logs, reports)", srcFr: "Preuves de contrôle (visas, journaux, états)" },
        { key: "exceptions", en: "Ask each performer how exceptions and unusual items are handled, and corroborate with an example where available.", fr: "Demander à chaque exécutant le traitement des exceptions et le corroborer par un exemple si possible.", srcEn: "Inquiry · exception logs", srcFr: "Entretiens · journaux d'exceptions" },
        { key: "update", en: "Record every difference from the documented flow and update D8.2, D7.2 and D8.5 accordingly.", fr: "Consigner tout écart avec le flux documenté et mettre à jour D8.2, D7.2 et D8.5.", srcEn: "This paper", srcFr: "Ce papier" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      items: [
        { key: "all_scots", en: "A walkthrough was performed for every SCOT.", fr: "Un cheminement a été réalisé pour chaque SCOT." },
        { key: "as_described", en: "The observed process matches the D8.2 documentation (differences resolved and documented).", fr: "Le processus observé correspond à la documentation D8.2 (écarts résolus et documentés)." },
        { key: "controls_seen", en: "Each key control was observed or reperformed, not merely described in inquiry.", fr: "Chaque contrôle clé a été observé ou refait, et non simplement décrit en entretien." },
        { key: "updates_done", en: "Differences found have been carried through to D8.2, D7.2 and D8.5.", fr: "Les écarts relevés ont été répercutés dans D8.2, D7.2 et D8.5." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D8.4 --- */
const D8_4: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶25(a)(ii) · ISA 240 ¶32",
  ownsEn: "the understanding and evaluation of the financial statement close process",
  ownsFr: "la compréhension et l'évaluation du processus d'arrêté des comptes (FSCP)",
  reqEn: [
    "The financial statement close process covers how the entity moves from trial balance to financial statements: standard and non-standard journal entries, consolidation adjustments, reconciliations, the selection and application of accounting policies, and the preparation of disclosures (ISA 315 ¶25(a)(ii)). It deserves its own paper because it runs at period end, under time pressure, with pervasive access — the exact conditions under which management override operates (ISA 240 ¶32).",
    "We document who can post entries, who approves non-standard entries, how reconciliations are reviewed, how the statements are compiled and reviewed, and which spreadsheets or tools outside the accounting system intervene. Each manual step outside the system is a what-could-go-wrong of its own.",
  ],
  reqFr: [
    "Le processus d'arrêté couvre le passage de la balance aux états financiers : écritures standards et non standards, retraitements, rapprochements, choix des méthodes comptables et préparation de l'annexe (ISA 315 ¶25(a)(ii)). Il s'exécute en clôture, sous pression, avec des accès étendus — les conditions mêmes du contournement par la direction (ISA 240 ¶32).",
    "Nous documentons qui peut passer des écritures, qui approuve les écritures non standards, comment les rapprochements sont revus, comment les états sont établis et revus, et quels tableurs hors système interviennent. Chaque étape manuelle hors système constitue un WCGW à part entière.",
  ],
  conclEn: ["The financial statement close process is understood, its what-could-go-wrongs identified, and the planned response recorded."],
  conclFr: ["Le processus d'arrêté est compris, ses points de risque identifiés et la réponse prévue consignée."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      procs: [
        { key: "map", en: "Document the close calendar and each step from trial balance to signed financial statements, naming performers and tools.", fr: "Documenter le calendrier de clôture et chaque étape de la balance aux états signés, en nommant exécutants et outils.", srcEn: "Close calendar · finance inquiry", srcFr: "Calendrier de clôture · entretiens finance" },
        { key: "je", en: "Understand journal-entry practices: who can post, approval of non-standard entries, and the population of period-end adjustments.", fr: "Comprendre la pratique des écritures : qui peut saisir, approbation des écritures non standards, population des écritures de clôture.", srcEn: "User-access listing · journal-entry reports", srcFr: "Liste des accès · journaux d'écritures" },
        { key: "recon", en: "Identify the key reconciliations (bank, intercompany, subledger-to-GL) and how each is prepared and reviewed.", fr: "Identifier les rapprochements clés (banque, intragroupe, auxiliaire-général) et leurs modalités de préparation et de revue.", srcEn: "Reconciliation files", srcFr: "Dossiers de rapprochement" },
        { key: "spreadsheets", en: "List the spreadsheets and tools outside the accounting system used in the close, and treat each as a what-could-go-wrong.", fr: "Recenser les tableurs et outils hors système utilisés à l'arrêté, chacun constituant un WCGW.", srcEn: "Finance inquiry · file inspection", srcFr: "Entretiens · inspection des fichiers" },
        { key: "evaluate", en: "Evaluate the design of the controls over the close and decide the response: controls testing (D8.5) and/or the journal-entry testing in E350.", fr: "Évaluer la conception des contrôles de l'arrêté et arrêter la réponse : tests de contrôles (D8.5) et/ou tests d'écritures (E350).", srcEn: "This paper · D8.5 · E350", srcFr: "Ce papier · D8.5 · E350" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      items: [
        { key: "documented", en: "The close process is documented end-to-end, including tools outside the accounting system.", fr: "Le processus d'arrêté est documenté de bout en bout, y compris les outils hors système." },
        { key: "je_pop", en: "The journal-entry population and posting rights are understood.", fr: "La population d'écritures et les droits de saisie sont compris." },
        { key: "override", en: "The management-override points in the close are identified and linked to E350.", fr: "Les points de contournement possibles à l'arrêté sont identifiés et reliés à E350." },
        { key: "response", en: "The planned response to close-process risks is recorded.", fr: "La réponse prévue aux risques de l'arrêté est consignée." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D8.5 --- */
const D8_5: PaperDef = {
  std: "ISA 330 ¶8 · ISA 315 (Revised 2019) ¶33–34",
  ownsEn: "the controls-reliance decision: which controls will be tested for operating effectiveness, and why",
  ownsFr: "la décision d'appui sur les contrôles : lesquels seront testés en efficacité, et pourquoi",
  reqEn: [
    "For each relevant assertion of each significant account we decide the strategy: substantive procedures alone, or a combined approach relying on controls. Controls must be tested when we intend to rely on their operating effectiveness, and whenever substantive procedures alone cannot provide sufficient appropriate evidence — typically highly automated processing with little or no documentation outside the system (ISA 330 ¶8).",
    "Where reliance is planned, we select the controls that address the what-could-go-wrongs of the assertion (from D8.2), preferring controls that cover more than one what-could-go-wrong and automated controls whose consistency ITGCs can carry. The selection names each control, the assertion it supports, and the deviation tolerance the strategy can bear.",
  ],
  reqFr: [
    "Pour chaque assertion pertinente de chaque compte significatif, nous arrêtons la stratégie : substantive seule ou combinée avec appui sur les contrôles. Les contrôles doivent être testés lorsque nous prévoyons de nous appuyer sur leur efficacité, et lorsque les procédures substantives seules ne suffisent pas — traitement fortement automatisé sans documentation hors système (ISA 330 ¶8).",
    "En cas d'appui prévu, nous sélectionnons les contrôles qui répondent aux WCGW de l'assertion (D8.2), en privilégiant les contrôles couvrant plusieurs WCGW et les contrôles automatisés dont les ITGC portent la constance.",
  ],
  conclEn: ["The audit strategy per assertion is decided, and the controls selected for testing address the associated what-could-go-wrongs."],
  conclFr: ["La stratégie par assertion est arrêtée et les contrôles sélectionnés répondent aux WCGW associés."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      procs: [
        { key: "strategy", en: "For each relevant assertion, record the strategy: substantive only, or combined with controls reliance, with the reason.", fr: "Pour chaque assertion pertinente, consigner la stratégie : substantive seule ou combinée, avec le motif.", srcEn: "D5.8 matrix · D8.2 flow papers", srcFr: "Matrice D5.8 · papiers de flux D8.2" },
        { key: "forced", en: "Identify assertions where substantive procedures alone cannot suffice (automated processing, no external evidence) — controls testing is mandatory there.", fr: "Identifier les assertions où la substantive seule ne peut suffire (traitement automatisé, absence de preuve externe) — le test de contrôles y est obligatoire.", srcEn: "D8.1 application list · D8.2", srcFr: "Liste D8.1 · D8.2" },
        { key: "select", en: "Where reliance is planned, select the controls to test, naming the what-could-go-wrongs each addresses.", fr: "En cas d'appui prévu, sélectionner les contrôles à tester en précisant les WCGW couverts.", srcEn: "D8.2 control inventory", srcFr: "Inventaire des contrôles D8.2" },
        { key: "itgc_dep", en: "For each automated or IT-dependent control selected, confirm its application is covered by the ITGC scope (E500).", fr: "Pour chaque contrôle automatisé ou dépendant IT sélectionné, vérifier la couverture ITGC de son application (E500).", srcEn: "E500 scope", srcFr: "Périmètre E500" },
        { key: "substantive", en: "Confirm every assertion keeps a substantive component regardless of reliance (ISA 330 ¶18 for significant risks).", fr: "Vérifier que chaque assertion conserve une composante substantive quel que soit l'appui (ISA 330 ¶18 pour les risques importants).", srcEn: "Execution programs", srcFr: "Programmes d'exécution" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      items: [
        { key: "every_assertion", en: "A strategy is recorded for every relevant assertion.", fr: "Une stratégie est consignée pour chaque assertion pertinente." },
        { key: "forced_found", en: "Assertions where substantive alone cannot suffice are identified and controls selected there.", fr: "Les assertions où la substantive seule ne suffit pas sont identifiées et couvertes par des contrôles sélectionnés." },
        { key: "wcgw_covered", en: "Each selected control is traced to the what-could-go-wrongs it addresses.", fr: "Chaque contrôle sélectionné est relié aux WCGW qu'il couvre." },
        { key: "itgc_ok", en: "ITGC coverage is confirmed for automated and IT-dependent controls.", fr: "La couverture ITGC est confirmée pour les contrôles automatisés et dépendants IT." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D8.6 --- */
const D8_6: PaperDef = {
  std: "ISA 330 ¶8–11 · ISA 530",
  ownsEn: "the design of each test of controls: attribute, population, timing and extent",
  ownsFr: "la conception de chaque test de contrôles : attribut, population, calendrier et étendue",
  reqEn: [
    "For each control selected in D8.5 we design the test: the attribute that shows the control operated (a signature, a system log, a matched document), the population of control occurrences, the period covered, and the sample size. Inquiry alone is never sufficient — the test combines inquiry with inspection, observation or reperformance (ISA 330 ¶10).",
    "Extent follows frequency: a control operating many times daily is tested on a sample sized for its population; monthly, quarterly and annual controls are tested across the instances of the period; an automated control is tested once per configuration provided its ITGCs are effective. Timing decides how much of the period the test covers now and what the post-interim update (E520) must add.",
  ],
  reqFr: [
    "Pour chaque contrôle retenu en D8.5, nous concevons le test : attribut probant (visa, journal système, rapprochement), population des occurrences, période couverte, taille d'échantillon. L'entretien seul ne suffit jamais (ISA 330 ¶10).",
    "L'étendue suit la fréquence : contrôle pluriquotidien testé par sondage, contrôles mensuels/trimestriels/annuels testés sur les occurrences de la période, contrôle automatisé testé une fois par configuration si les ITGC sont efficaces. Le calendrier détermine la part de période couverte maintenant et ce que la mise à jour post-intérim (E520) devra ajouter.",
  ],
  conclEn: ["Each selected control has a designed test whose nature, timing and extent can support the planned reliance."],
  conclFr: ["Chaque contrôle retenu dispose d'un test conçu dont la nature, le calendrier et l'étendue peuvent soutenir l'appui prévu."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      procs: [
        { key: "attribute", en: "Define, per control, the attribute evidencing operation and the documents or records where it lives.", fr: "Définir, par contrôle, l'attribut probant et les documents ou enregistrements où il se trouve.", srcEn: "D8.2 control descriptions", srcFr: "Descriptions D8.2" },
        { key: "population", en: "Define the population of control occurrences for the period and how completeness of that population is established.", fr: "Définir la population des occurrences sur la période et la manière d'en établir l'exhaustivité.", srcEn: "System reports · control logs", srcFr: "États systèmes · journaux de contrôle" },
        { key: "extent", en: "Set the sample size from the control's frequency and the planned reliance; automated controls: one per configuration plus ITGC dependency.", fr: "Fixer la taille d'échantillon selon la fréquence et l'appui prévu ; contrôles automatisés : un par configuration plus dépendance ITGC.", srcEn: "Sampling tool", srcFr: "Outil d'échantillonnage" },
        { key: "timing", en: "Set the timing: period covered by the interim test and the roll-forward the post-interim update (E520) will need.", fr: "Fixer le calendrier : période couverte à l'intérim et complément attendu de la mise à jour post-intérim (E520).", srcEn: "Engagement timetable", srcFr: "Calendrier de la mission" },
        { key: "assign", en: "Assign each designed test to a team member and link it to the execution program that will record the result.", fr: "Affecter chaque test conçu à un membre de l'équipe et le relier au programme d'exécution qui recevra le résultat.", srcEn: "Team plan (D6.1)", srcFr: "Plan d'équipe (D6.1)" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      items: [
        { key: "each_control", en: "Every control selected in D8.5 has a designed test.", fr: "Chaque contrôle retenu en D8.5 dispose d'un test conçu." },
        { key: "beyond_inquiry", en: "No test relies on inquiry alone.", fr: "Aucun test ne repose sur le seul entretien." },
        { key: "extent_ok", en: "Sample sizes follow the frequency of each control and the planned reliance.", fr: "Les tailles d'échantillon suivent la fréquence des contrôles et l'appui prévu." },
        { key: "rollforward", en: "Interim timing and the post-interim update are planned together (link to E520).", fr: "Le calendrier d'intérim et la mise à jour post-intérim sont planifiés ensemble (lien E520)." },
      ],
    },
  ],
};

/* ----------------------------------------------------------------- E300 --- */
const E300: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶37 · ISA 330 ¶25–26",
  ownsEn: "the reassessment of the combined risk assessments in the light of the evidence obtained",
  ownsFr: "la réévaluation de l'évaluation combinée des risques au vu des éléments obtenus",
  reqEn: [
    "The risk assessment is not static. When evidence obtained during execution is inconsistent with the assessment made at planning — control deviations, misstatements, unexpected analytical results, new information about the entity — we revise the assessment and modify the planned procedures accordingly (ISA 315 ¶37, ISA 330 ¶25).",
    "This paper is the formal checkpoint: after controls testing and before concluding the substantive work, each combined risk assessment in the risk register (D7.2) is confronted with what execution actually found. A revision is not a failure of planning; an unrevised assessment contradicted by the evidence is a failure of the audit.",
  ],
  reqFr: [
    "L'évaluation des risques n'est pas figée. Lorsque les éléments obtenus en exécution contredisent l'évaluation initiale — déviations de contrôles, anomalies, résultats analytiques inattendus, informations nouvelles — nous révisons l'évaluation et modifions les procédures prévues (ISA 315 ¶37, ISA 330 ¶25).",
    "Ce papier est le point de contrôle formel : après les tests de contrôles et avant de conclure les travaux substantifs, chaque évaluation combinée du registre (D7.2) est confrontée aux constats de l'exécution.",
  ],
  conclEn: ["The combined risk assessments remain appropriate, or have been revised and the procedures adjusted."],
  conclFr: ["Les évaluations combinées demeurent appropriées, ou ont été révisées avec ajustement des procédures."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      procs: [
        { key: "deviations", en: "List the control deviations found (E500/E510/E520 and cycle tests) and assess the effect of each on the related combined risk assessment.", fr: "Recenser les déviations de contrôles constatées (E500/E510/E520 et tests de cycles) et leur effet sur l'évaluation combinée concernée.", srcEn: "Controls testing papers", srcFr: "Papiers de tests de contrôles" },
        { key: "misstatements", en: "Review the misstatements accumulated to date (B5) for what they say about the assessed risks that should have caught them.", fr: "Analyser les anomalies cumulées (B5) au regard des risques évalués qui auraient dû les prévenir.", srcEn: "B5 summary of audit differences", srcFr: "Récapitulatif B5" },
        { key: "analytics", en: "Consider unexpected relationships from substantive analytics against the risk assessment.", fr: "Confronter les corrélations inattendues des procédures analytiques à l'évaluation des risques.", srcEn: "Cycle analytics", srcFr: "Analytiques de cycles" },
        { key: "register", en: "Update the risk register (D7.2): revise each affected assessment and record the reason.", fr: "Mettre à jour le registre (D7.2) : réviser chaque évaluation touchée en motivant.", srcEn: "D7.2 risk register", srcFr: "Registre D7.2" },
        { key: "procedures", en: "Modify the nature, timing or extent of remaining procedures where an assessment rose, and record what changed.", fr: "Modifier la nature, le calendrier ou l'étendue des procédures restantes lorsque l'évaluation augmente, en consignant les changements.", srcEn: "Execution programs", srcFr: "Programmes d'exécution" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      items: [
        { key: "confronted", en: "Every combined risk assessment was confronted with the execution evidence.", fr: "Chaque évaluation combinée a été confrontée aux constats d'exécution." },
        { key: "deviations_fed", en: "Control deviations are reflected in the affected assessments.", fr: "Les déviations de contrôles sont répercutées dans les évaluations concernées." },
        { key: "procs_adjusted", en: "Procedures were adjusted wherever an assessment was revised upward.", fr: "Les procédures ont été ajustées pour chaque révision à la hausse." },
        { key: "documented", en: "Each revision (or confirmation) is documented with its reason.", fr: "Chaque révision (ou confirmation) est documentée avec son motif." },
      ],
    },
  ],
};

/* ----------------------------------------------------------------- E520 --- */
const E520: PaperDef = {
  std: "ISA 330 ¶12–15",
  ownsEn: "the post-interim update: controls evidence extended from the interim date to the period end",
  ownsFr: "la mise à jour post-intérim : preuve sur les contrôles étendue de l'intérim à la clôture",
  reqEn: [
    "When operating effectiveness was tested at an interim date, we obtain evidence about the remaining period: what changed in the controls since the interim, and whether the interim conclusion can be rolled forward (ISA 330 ¶12). Significant changes to a control, its performer, or its application reset the test.",
    "For ITGCs the same logic applies at the level of change management, access and operations: a period-end reliance on an automated control assumes the application did not change uncontrolled after the interim ITGC work (E500).",
  ],
  reqFr: [
    "Lorsque l'efficacité a été testée à une date intérimaire, nous obtenons des éléments sur la période restante : ce qui a changé depuis l'intérim et si la conclusion intérimaire peut être prolongée (ISA 330 ¶12). Un changement significatif du contrôle, de son exécutant ou de son application remet le test à zéro.",
    "Pour les ITGC, la même logique s'applique à la gestion des changements, aux accès et à l'exploitation : l'appui en clôture sur un contrôle automatisé suppose une application inchangée de façon maîtrisée depuis les travaux ITGC d'intérim (E500).",
  ],
  conclEn: ["The controls evidence covers the full period: interim conclusions were validly rolled forward or the tests extended."],
  conclFr: ["La preuve sur les contrôles couvre toute la période : conclusions intérimaires valablement prolongées ou tests étendus."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      procs: [
        { key: "period", en: "Determine the remaining period for each control tested at interim and the additional evidence it requires.", fr: "Déterminer la période restante pour chaque contrôle testé à l'intérim et la preuve complémentaire requise.", srcEn: "D8.6 timing plan", srcFr: "Plan de calendrier D8.6" },
        { key: "changes", en: "Inquire and inspect for changes since the interim: control redesign, new performers, application changes, organisational moves.", fr: "Rechercher les changements depuis l'intérim : refonte du contrôle, nouveaux exécutants, évolutions applicatives, réorganisations.", srcEn: "Management inquiry · change logs · HR moves", srcFr: "Entretiens · journaux de changements · mouvements RH" },
        { key: "extend", en: "Extend the tests over the remaining period where required — changed controls are retested, unchanged high-frequency controls receive a reduced roll-forward sample.", fr: "Étendre les tests sur la période restante si nécessaire — contrôles modifiés retestés, contrôles inchangés à haute fréquence couverts par un échantillon réduit.", srcEn: "Control evidence of the remaining period", srcFr: "Preuves de contrôle de la période restante" },
        { key: "itgc", en: "Roll forward the ITGC conclusions: review the change-management and access logs for the remaining period for the in-scope applications.", fr: "Prolonger les conclusions ITGC : revue des journaux de changements et d'accès de la période restante pour les applications du périmètre.", srcEn: "E500 papers · system logs", srcFr: "Papiers E500 · journaux systèmes" },
        { key: "conclude", en: "Conclude on operating effectiveness for the full period, and carry any failure to E300 and to the substantive response.", fr: "Conclure sur l'efficacité pour l'ensemble de la période et reporter toute défaillance vers E300 et la réponse substantive.", srcEn: "This paper · E300", srcFr: "Ce papier · E300" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      items: [
        { key: "all_interim", en: "Every control relied upon and tested at interim has a roll-forward conclusion.", fr: "Chaque contrôle d'appui testé à l'intérim dispose d'une conclusion de prolongation." },
        { key: "changes_checked", en: "Changes since the interim were actively searched, not assumed absent.", fr: "Les changements depuis l'intérim ont été recherchés activement, non présumés absents." },
        { key: "itgc_rf", en: "ITGC conclusions cover the full period for every in-scope application.", fr: "Les conclusions ITGC couvrent toute la période pour chaque application du périmètre." },
        { key: "failures_fed", en: "Roll-forward failures are carried to E300 and the substantive response.", fr: "Les échecs de prolongation sont reportés vers E300 et la réponse substantive." },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ B11 --- */
const B11: PaperDef = {
  std: "ISA 230 ¶14–16 · ISQM 1 ¶31(f)",
  ownsEn: "the assembly and archiving of the final engagement file",
  ownsFr: "l'assemblage et l'archivage du dossier définitif de la mission",
  reqEn: [
    "The final engagement file is assembled on a timely basis after the date of the auditor's report — the assembly period is ordinarily no more than 60 days (ISA 230 ¶14, A21). Assembly is administrative: after it, nothing is deleted or discarded before the end of the retention period, and any modification (however administrative) records what was changed, when, by whom, and why (ISA 230 ¶15–16).",
    "The firm's retention period follows ISQM 1 ¶31(f) and local law; within OHADA practice, ten years from the report date is the working rule. Locking the file in the tool is the archive act: sign-offs freeze, papers become read-only, and later changes go through the documented-modification route only.",
  ],
  reqFr: [
    "Le dossier définitif est assemblé dans un délai maximal de 60 jours après la date du rapport (ISA 230 ¶14, A21). L'assemblage est administratif : ensuite, rien n'est supprimé avant la fin de la durée de conservation, et toute modification consigne quoi, quand, qui et pourquoi (ISA 230 ¶15–16).",
    "La durée de conservation suit ISQM 1 ¶31(f) et le droit local ; dans la pratique OHADA, dix ans à compter de la date du rapport. Le verrouillage du dossier dans l'outil vaut archivage : signatures figées, papiers en lecture seule, modifications ultérieures uniquement par la voie documentée.",
  ],
  conclEn: ["The final file is complete, assembled within the assembly period, and archived under the firm's retention policy."],
  conclFr: ["Le dossier définitif est complet, assemblé dans le délai imparti et archivé selon la politique de conservation du cabinet."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      procs: [
        { key: "complete", en: "Confirm every task in the file carries its working paper, evidence and preparer/reviewer sign-offs; clear the points outstanding (B6).", fr: "Vérifier que chaque tâche du dossier porte son papier de travail, ses preuves et ses signatures ; solder les points en suspens (B6).", srcEn: "Dashboard completion counts · B6", srcFr: "Compteurs du tableau de bord · B6" },
        { key: "deadline", en: "Record the report date and the assembly deadline (report date + 60 days); plan the assembly before it.", fr: "Consigner la date du rapport et l'échéance d'assemblage (rapport + 60 jours) ; planifier l'assemblage avant.", srcEn: "Auditor's report · engagement record", srcFr: "Rapport · fiche mission" },
        { key: "assemble", en: "Assemble: file final versions, delete superseded drafts (before lock only), complete cross-references.", fr: "Assembler : classer les versions finales, supprimer les brouillons remplacés (avant verrouillage uniquement), compléter les renvois.", srcEn: "Engagement file", srcFr: "Dossier de mission" },
        { key: "lock", en: "Lock the file and record the archive date and the retention end date under the firm's policy.", fr: "Verrouiller le dossier et consigner la date d'archivage et la fin de conservation selon la politique du cabinet.", srcEn: "This paper", srcFr: "Ce papier" },
        { key: "later", en: "Route any post-assembly modification through the documented-modification record: what, when, who, why.", fr: "Faire passer toute modification post-assemblage par la fiche de modification documentée : quoi, quand, qui, pourquoi.", srcEn: "Modification log", srcFr: "Journal des modifications" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      items: [
        { key: "within_60", en: "The file was (or will be) assembled within 60 days of the report date.", fr: "Le dossier a été (ou sera) assemblé dans les 60 jours du rapport." },
        { key: "signoffs", en: "Every task carries its preparer and reviewer sign-offs.", fr: "Chaque tâche porte ses signatures préparateur et réviseur." },
        { key: "nothing_open", en: "No review note or point outstanding remains open.", fr: "Aucune note de revue ni point en suspens ne reste ouvert." },
        { key: "retention", en: "The archive date and retention end date are recorded.", fr: "La date d'archivage et la fin de conservation sont consignées." },
        { key: "mods_logged", en: "Any post-assembly modification is documented (what, when, who, why).", fr: "Toute modification post-assemblage est documentée (quoi, quand, qui, pourquoi)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D9.2 --- */
// The planning-stage report to those charged with governance: what ISA 260
// requires the auditor to communicate BEFORE fieldwork — scope, timing,
// significant risks, independence — as a deliverable in its own right rather
// than a paragraph inside the strategy memorandum.
const D9_2: PaperDef = {
  std: "ISA 260 (Revised) ¶15–18 · ISA 300 ¶9 · OHADA — AUSCGIE",
  ownsEn: "the planning communication to those charged with governance",
  ownsFr: "la communication de planification aux responsables de la gouvernance",
  reqEn: [
    "Before the detailed fieldwork begins, the auditor communicates with those charged with governance an overview of the planned scope and timing of the audit, including the significant risks identified (ISA 260 (Revised) ¶15). The communication does not compromise the effectiveness of the audit by making the procedures too predictable.",
    "For listed entities, and wherever else it is appropriate, the communication includes a statement on independence: that the firm and the team have complied with the ethical requirements on independence, the relationships that may bear on it, and the related safeguards (ISA 260 (Revised) ¶17).",
    "In the OHADA space the addressees are typically the board of directors or the managing body under the Acte uniforme; where an audit committee exists, it receives the communication. Record who received the report, in what form, and when.",
  ],
  reqFr: [
    "Avant le début des travaux détaillés, l'auditeur communique aux responsables de la gouvernance une vue d'ensemble de l'étendue et du calendrier prévus de l'audit, y compris les risques importants identifiés (ISA 260 (Révisée) ¶15), sans rendre les procédures trop prévisibles.",
    "Pour les entités cotées, et chaque fois que cela est approprié, la communication comporte une déclaration d'indépendance : respect des règles d'éthique, relations susceptibles de l'affecter et sauvegardes (ISA 260 (Révisée) ¶17).",
    "Dans l'espace OHADA, les destinataires sont en principe le conseil d'administration ou l'organe de gestion prévu par l'Acte uniforme ; lorsqu'un comité d'audit existe, il reçoit la communication. Consigner qui a reçu le rapport, sous quelle forme et à quelle date.",
  ],
  conclEn: [
    "The planned scope, timing and significant risks of the audit have been communicated to those charged with governance before fieldwork, together with the matters required by ISA 260.",
  ],
  conclFr: [
    "L'étendue, le calendrier et les risques importants prévus ont été communiqués aux responsables de la gouvernance avant les travaux, avec les points requis par l'ISA 260.",
  ],
  sections: [
    {
      kind: "fields",
      titleEn: "Part A — The report",
      titleFr: "Partie A — Le rapport",
      introEn: "Summarise what the report said. File the report itself as an attachment to this task.",
      introFr: "Résumer le contenu du rapport. Classer le rapport lui-même en pièce jointe de cette tâche.",
      fields: [
        { key: "addressees", kind: "input", labelEn: "Addressees and how governance is structured: board, audit committee, managing body", labelFr: "Destinataires et structure de gouvernance : conseil, comité d'audit, organe de gestion" },
        { key: "scope", kind: "input", labelEn: "Planned scope and timing communicated: phases, locations, use of others' work, the reporting timetable", labelFr: "Étendue et calendrier communiqués : phases, sites, travaux de tiers, calendrier de restitution" },
        { key: "risks", kind: "input", labelEn: "Significant risks communicated, at the level of detail judged appropriate", labelFr: "Risques importants communiqués, au niveau de détail jugé approprié" },
        { key: "independence", kind: "input", labelEn: "Independence statement made, or the reason none was required", labelFr: "Déclaration d'indépendance faite, ou motif de son absence" },
        { key: "delivery", kind: "input", labelEn: "Form and date of the communication, and any response received", labelFr: "Forme et date de la communication, et toute réponse reçue" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      introEn: "Answer each item. Explain a “No” in the field beneath it.",
      introFr: "Répondre à chaque point. Expliquer un « Non » dans le champ situé dessous.",
      items: [
        { key: "before", en: "The communication was made before the detailed fieldwork began.", fr: "La communication est intervenue avant le début des travaux détaillés." },
        { key: "two_way", en: "The form of the communication allows a two-way exchange: governance can raise matters back to the auditor.", fr: "La forme retenue permet un échange dans les deux sens : la gouvernance peut soulever des points auprès de l'auditeur." },
        { key: "predict", en: "The level of detail communicated does not make our procedures predictable enough to compromise their effectiveness.", fr: "Le niveau de détail communiqué ne rend pas nos procédures prévisibles au point d'en compromettre l'efficacité.", na: true },
        { key: "filed", en: "The report as sent, and any minutes of the meeting at which it was discussed, are filed against this task.", fr: "Le rapport tel qu'envoyé, et tout procès-verbal de la réunion où il a été discuté, sont classés dans cette tâche." },
      ],
    },
  ],
};

export const GAM_PAPERS: Record<string, PaperDef> = {
  "D9.2": D9_2,
  "D5.8": D5_8,
  "D8.1": D8_1,
  "D8.2": D8_2,
  "D8.3": D8_3,
  "D8.4": D8_4,
  "D8.5": D8_5,
  "D8.6": D8_6,
  E300,
  E520,
  B11,
};
