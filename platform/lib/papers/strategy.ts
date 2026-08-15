// The Scope & Strategy working papers. Same structure as the acceptance set:
// numbered procedures that say what to do and where the information comes from,
// an evaluation of what those procedures produced, and a conclusion the preparer
// answers. Register: imperative for procedures, first person plural for firm
// positions, one idea per sentence.

import type { PaperDef, PaperProc } from "@/lib/papers/types";

const P = (
  key: string,
  en: string,
  fr: string,
  srcEn: string,
  srcFr: string,
  tipEn?: string,
  tipFr?: string,
): PaperProc => ({ key, en, fr, srcEn, srcFr, tipEn, tipFr });

const PROC_INTRO_EN =
  "Perform each procedure and record the result, stating what was obtained, from whom or from which source, and the reference of the evidence filed.";
const PROC_INTRO_FR =
  "Mettre en œuvre chaque procédure et consigner le résultat : ce qui a été obtenu, auprès de qui ou de quelle source, et la référence du dossier.";
const YN_INTRO_EN =
  "Evaluate the results of the Part A procedures against each statement. Explain each “No” in the box beneath it.";
const YN_INTRO_FR =
  "Évaluer les résultats de la partie A au regard de chaque affirmation. Expliquer chaque « Non » dans la zone prévue.";

/* ------------------------------------------------------------------ D1 --- */
const D1: PaperDef = {
  std: "ISA 300 ¶7–9 · ISA 320 ¶10",
  ownsEn: "the engagement strategy and the scale of the work",
  ownsFr: "la stratégie de mission et le dimensionnement des travaux",
  reqEn: [
    "The overall audit strategy sets the scope, timing and direction of the audit, and guides the development of the audit plan (ISA 300 ¶7). It records the characteristics that define the scope, the reporting objectives and the timing of communications, and the factors that in our professional judgement are significant in directing the team.",
    "The strategy also records the resources to deploy, including which team members are assigned to which areas and how much time is budgeted for the areas of higher assessed risk (ISA 300 ¶8).",
  ],
  reqFr: [
    "La stratégie générale d'audit définit l'étendue, le calendrier et l'orientation de la mission (ISA 300 ¶7).",
    "Elle consigne aussi les ressources à déployer, l'affectation des membres de l'équipe et le temps budgété sur les zones de risque élevé (ISA 300 ¶8).",
  ],
  conclEn: [
    "The strategy recorded here reflects the scope, timing and direction of this engagement, and the resources assigned are consistent with the assessed risks.",
  ],
  conclFr: [
    "La stratégie consignée reflète l'étendue, le calendrier et l'orientation de la mission, et les ressources affectées sont cohérentes avec les risques évalués.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("scope", "Establish the characteristics that define the scope: the financial reporting framework, the reporting entity, the locations and any component to be covered.", "Établir les caractéristiques définissant l'étendue : référentiel comptable, entité présentant les comptes, implantations et composants à couvrir.", "Engagement letter (D3.5) · statutes · prior file", "Lettre de mission (D3.5) · statuts · dossier antérieur"),
        P("reporting", "Establish the reporting objectives and the deadlines, including the statutory report, the general meeting date and any regulator filing.", "Établir les objectifs de reporting et les échéances, y compris le rapport statutaire, la date d'assemblée générale et tout dépôt réglementaire.", "Statutes · OHADA Uniform Act · client timetable", "Statuts · Acte uniforme OHADA · calendrier du client"),
        P("comms", "Agree the timing and form of communications with management and those charged with governance.", "Convenir du calendrier et de la forme des communications avec la direction et les responsables de la gouvernance.", "Engagement letter · discussion with the entity", "Lettre de mission · échange avec l'entité"),
        P("factors", "Identify the factors that in our judgement are significant in directing the team's effort, including the preliminary materiality and the areas of expected higher risk.", "Identifier les facteurs qui, selon notre jugement, orientent l'effort de l'équipe, dont le seuil préliminaire et les zones de risque attendu élevé.", "Prior file · D5.1 · preliminary analytics (D4.3)", "Dossier antérieur · D5.1 · analyse préliminaire (D4.3)"),
        P("resources", "Allocate the team to areas and set the time budget, weighting the areas of higher assessed risk.", "Affecter l'équipe aux différentes zones et arrêter le budget-temps, en pondérant les zones de risque évalué élevé.", "Team page · budget · D6.1", "Page Équipe · budget · D6.1"),
        P("prior", "Read the prior period file for matters carried forward, including points forward, unadjusted misstatements and any modification to the report.", "Examiner le dossier de l'exercice précédent : points reportés, anomalies non corrigées et toute modification du rapport.", "Prior file · B10 points forward · prior auditor's report", "Dossier antérieur · B10 points reportés · rapport antérieur"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "deadline", en: "The reporting deadline can be met with the resources assigned (procedures 2, 5).", fr: "L'échéance de reporting peut être tenue avec les ressources affectées (procédures 2, 5)." },
        { key: "risk_weight", en: "The time budget is weighted towards the areas of higher assessed risk (procedures 4, 5).", fr: "Le budget-temps est pondéré vers les zones de risque évalué élevé (procédures 4, 5)." },
        { key: "carried", en: "Every matter carried forward from the prior period has been reflected in the strategy (procedure 6).", fr: "Chaque point reporté de l'exercice précédent est pris en compte dans la stratégie (procédure 6)." },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part C — Strategy record",
      titleFr: "Partie C — Consignation de la stratégie",
      fields: [
        { key: "direction", kind: "input", labelEn: "The direction set for the team, in short: what this audit turns on", labelFr: "Orientation donnée à l'équipe : ce sur quoi repose cette mission" },
        { key: "changes", kind: "input", labelEn: "Changes to the strategy during the engagement, and what prompted each", labelFr: "Modifications de la stratégie en cours de mission et leur motif" },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D4.1 --- */
const D4_1: PaperDef = {
  std: "ISA 220 (Revised) ¶13–15, ¶29–35 · ISA 300 ¶5",
  ownsEn: "the partner's direction, supervision and review of the engagement",
  ownsFr: "la direction, la supervision et la revue par l'associé",
  reqEn: [
    "The engagement partner takes overall responsibility for managing and achieving quality, and is sufficiently and appropriately involved throughout (ISA 220 (Revised) ¶13). Direction, supervision and review are planned in response to the nature and circumstances of the engagement and the assessed risks, not applied uniformly.",
    "The engagement partner reviews the work on significant judgements, on significant risks, and on other matters that in their judgement are significant, before the auditor's report is dated (ISA 220 (Revised) ¶30–31).",
  ],
  reqFr: [
    "L'associé responsable assume la responsabilité globale de la qualité et s'implique de façon suffisante et appropriée tout au long de la mission (ISA 220 révisée ¶13).",
    "Il revoit les travaux portant sur les jugements importants, les risques importants et les autres points significatifs, avant la date du rapport (ISA 220 révisée ¶30–31).",
  ],
  conclEn: [
    "The nature, timing and extent of direction, supervision and review planned here respond to the assessed risks and to the competence of the team members performing the work.",
  ],
  conclFr: [
    "La nature, le calendrier et l'étendue de la direction, de la supervision et de la revue répondent aux risques évalués et à la compétence des membres de l'équipe.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("brief", "Hold the engagement partner's briefing with the team. Record the date, who attended and the direction given.", "Tenir la réunion de cadrage de l'associé avec l'équipe. Consigner la date, les participants et les instructions données.", "Meeting note · team page", "Note de réunion · page Équipe"),
        P("areas", "Identify the areas the engagement partner will review personally, including every significant judgement and every significant risk.", "Identifier les zones que l'associé revoira personnellement, dont chaque jugement important et chaque risque important.", "D7.2 risk register · D5.4 · D5.7", "Registre des risques D7.2 · D5.4 · D5.7"),
        P("supervision", "Set the level of supervision for each team member against their competence and the difficulty of the work assigned.", "Fixer le niveau de supervision de chaque membre au regard de sa compétence et de la difficulté des travaux confiés.", "Team page grades · D6.1", "Grades de la page Équipe · D6.1"),
        P("consult", "Identify the matters on which consultation is expected, and who will be consulted.", "Identifier les points appelant une consultation et les personnes à consulter.", "Firm consultation policy · B3", "Politique de consultation du cabinet · B3"),
        P("review", "Record the review points during the engagement, and confirm the report will not be dated before the partner's review is complete.", "Consigner les points de revue prévus et confirmer que le rapport ne sera pas daté avant l'achèvement de la revue de l'associé.", "Timetable · ISA 220 (Revised) ¶31", "Calendrier · ISA 220 révisée ¶31"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "attended", en: "The engagement partner attended the team briefing (procedure 1).", fr: "L'associé responsable a participé à la réunion de cadrage (procédure 1)." },
        { key: "judgements", en: "Every significant judgement and significant risk is on the partner's personal review list (procedure 2).", fr: "Chaque jugement important et risque important figure sur la liste de revue personnelle de l'associé (procédure 2)." },
        { key: "eqr", en: "Where an engagement quality review is required under D3.6, its timing is built into the review plan (procedure 5).", fr: "Lorsqu'une revue de qualité est requise (D3.6), son calendrier est intégré au plan de revue (procédure 5).", na: true },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D7.1 --- */
const D7_1: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶17–18 · ISA 240 ¶16",
  ownsEn: "the team discussion and the susceptibility of the statements to material misstatement",
  ownsFr: "la réunion d'équipe et la sensibilité des comptes aux anomalies significatives",
  reqEn: [
    "The engagement partner and other key team members discuss the application of the applicable financial reporting framework and the susceptibility of the entity's financial statements to material misstatement (ISA 315 (Revised 2019) ¶17). The discussion is held even where the team is small, and the partner determines what is communicated to members not involved.",
    "The discussion includes an exchange of ideas about how and where the financial statements may be susceptible to material misstatement due to fraud, including how it might occur. It is held setting aside any belief that management and those charged with governance are honest (ISA 240 ¶16).",
    "The agenda to work through: (1) the business, its industry and what changed this year; (2) how the reporting framework applies and where it calls for judgement; (3) the accounts and disclosures most exposed, and the assertions at stake; (4) fraud — incentives, opportunities and rationalisations, how revenue could be manipulated and how assets could be misappropriated; (5) management override of controls and the entries that would carry it; (6) related parties and unusual or significant transactions outside the ordinary course; (7) going concern indicators; (8) laws and regulations bearing on the statements, including the OHADA statutory obligations.",
    "And the conduct of the audit itself: (9) materiality and what it means for scoping; (10) the planned reliance on controls and on the work of others (internal audit, experts, service organisations); (11) the IT environment and whether an IT specialist is needed; (12) the specialists to involve — tax, valuation, actuarial; (13) the team, its competence and the time each member has; (14) prior-year findings, misstatements and review points that must not repeat; (15) the timetable, the deliverables and who is responsible for what.",
  ],
  reqFr: [
    "L'associé responsable et les membres clés de l'équipe s'entretiennent de l'application du référentiel comptable et de la sensibilité des états financiers aux anomalies significatives (ISA 315 révisée ¶17).",
    "L'échange porte notamment sur les modalités possibles d'une anomalie résultant de fraude, en écartant toute présomption d'honnêteté de la direction (ISA 240 ¶16).",
    "Ordre du jour : (1) l'activité, le secteur et les changements de l'exercice ; (2) l'application du référentiel et les points de jugement ; (3) les comptes et informations les plus exposés et les assertions concernées ; (4) la fraude — incitations, opportunités, rationalisations, manipulation du chiffre d'affaires, détournement d'actifs ; (5) le contournement des contrôles par la direction et les écritures utilisées ; (6) les parties liées et les opérations inhabituelles ; (7) les indices de continuité d'exploitation ; (8) les textes légaux applicables, dont les obligations OHADA.",
    "Et la conduite de la mission : (9) le seuil de signification et son effet sur le périmètre ; (10) l'appui prévu sur les contrôles et les travaux de tiers ; (11) l'environnement informatique et le besoin d'un spécialiste IT ; (12) les spécialistes à impliquer — fiscal, évaluation, actuariel ; (13) l'équipe, ses compétences et le temps disponible ; (14) les constats et notes de revue de l'exercice précédent à ne pas répéter ; (15) le calendrier, les livrables et les responsabilités.",
  ],
  conclEn: [
    "The discussion covered the susceptibility of the financial statements to material misstatement, including from fraud, and the matters raised have been carried into the risk assessment.",
  ],
  conclFr: [
    "L'échange a couvert la sensibilité des états financiers aux anomalies significatives, y compris de fraude, et les points soulevés sont repris dans l'évaluation des risques.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("hold", "Hold the discussion with the engagement partner and the key team members. Record the date, the attendees and the absentees.", "Tenir la réunion avec l'associé responsable et les membres clés. Consigner la date, les présents et les absents.", "Meeting note · team page", "Note de réunion · page Équipe"),
        P("framework", "Discuss how the applicable financial reporting framework applies to the entity's facts, and where its application calls for judgement.", "Examiner l'application du référentiel comptable aux faits de l'entité et les points appelant un jugement.", "D4.2 · accounting policies · prior file", "D4.2 · méthodes comptables · dossier antérieur"),
        P("fraud", "Exchange ideas on how and where the financial statements may be susceptible to material misstatement due to fraud, including the manner in which assets could be misappropriated.", "Échanger sur les modalités et les zones possibles d'anomalies résultant de fraude, y compris le détournement d'actifs.", "ISA 240 ¶16 · D5.4 · prior findings", "ISA 240 ¶16 · D5.4 · constats antérieurs"),
        P("override", "Discuss how management could override controls, and the accounting entries that would be used.", "Examiner comment la direction pourrait contourner les contrôles et les écritures qui seraient utilisées.", "ISA 240 ¶31 · E350", "ISA 240 ¶31 · E350"),
        P("absent", "Determine what is to be communicated to team members who did not attend, and record that it was done.", "Déterminer ce qui doit être communiqué aux membres absents et consigner que cela a été fait.", "Team page · circulated note", "Page Équipe · note diffusée"),
        P("carry", "Carry each matter raised into the risk register, or record why it does not give rise to an assessed risk.", "Reporter chaque point soulevé dans le registre des risques, ou consigner pourquoi il ne donne pas lieu à un risque évalué.", "D7.2 risk register", "Registre des risques D7.2"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "partner", en: "The engagement partner took part in the discussion (procedure 1).", fr: "L'associé responsable a pris part à l'échange (procédure 1)." },
        { key: "fraud_covered", en: "Fraud, including management override, was discussed and not merely noted (procedures 3, 4).", fr: "La fraude, y compris le contournement des contrôles, a été discutée et pas seulement mentionnée (procédures 3, 4)." },
        { key: "registered", en: "Every matter raised is reflected in the risk register or explained (procedure 6).", fr: "Chaque point soulevé figure au registre des risques ou est justifié (procédure 6)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D4.3 --- */
const D4_3: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶14(b) · ISA 520 ¶2",
  ownsEn: "the preliminary analytical procedures and the risk indicators they raise",
  ownsFr: "les procédures analytiques préliminaires et les indices de risque relevés",
  reqEn: [
    "Analytical procedures performed as risk assessment procedures help identify matters of which we were not aware, and assist in assessing the risks of material misstatement (ISA 315 (Revised 2019) ¶14(b)). They are performed on the entity's data before the detailed programme is set.",
    "An expectation is formed before the data is examined. A relationship that does not behave as expected is investigated, and the explanation obtained from management is corroborated against other evidence before it is accepted.",
  ],
  reqFr: [
    "Les procédures analytiques mises en œuvre en évaluation des risques aident à identifier des éléments non encore connus (ISA 315 révisée ¶14(b)).",
    "Une attente est formée avant l'examen des données. Toute relation inattendue est investiguée et l'explication de la direction est corroborée avant d'être retenue.",
  ],
  conclEn: [
    "The preliminary analytical procedures have been performed, every unexpected relationship has been investigated, and the indicators identified are reflected in the risk assessment.",
  ],
  conclFr: [
    "Les procédures analytiques préliminaires ont été mises en œuvre, chaque relation inattendue a été investiguée, et les indices relevés sont repris dans l'évaluation des risques.",
  ],
  tools: ["trial-balance", "analytics"],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("expect", "Form and record the expectation for each relationship to be examined, before looking at the current period figures.", "Former et consigner l'attente pour chaque relation examinée, avant de consulter les chiffres de l'exercice.", "Prior financial statements · budget · sector data", "États financiers antérieurs · budget · données sectorielles"),
        P("compare", "Compare the current period trial balance with the prior period and with the budget, by account and by class.", "Comparer la balance de l'exercice avec l'exercice précédent et le budget, par compte et par classe.", "Trial balance import · prior financial statements", "Import de la balance · états financiers antérieurs"),
        P("ratios", "Calculate the ratios relevant to the entity's sector, including margin, receivable and payable days, inventory turnover and gearing.", "Calculer les ratios pertinents pour le secteur : marge, délais clients et fournisseurs, rotation des stocks et endettement.", "Trial balance · prior financial statements", "Balance · états financiers antérieurs"),
        P("nonfin", "Compare financial data against non-financial data, such as volumes, headcount, floor area or production.", "Comparer les données financières aux données non financières : volumes, effectifs, surfaces ou production.", "Management reports · operational records", "Rapports de gestion · données d'exploitation"),
        P("investigate", "Investigate each relationship that differs from the expectation. Record the explanation obtained and the evidence that corroborates it.", "Investiguer chaque relation s'écartant de l'attente. Consigner l'explication obtenue et l'élément qui la corrobore.", "Inquiry of management · supporting documents", "Entretien avec la direction · pièces justificatives"),
        P("carry", "Carry each indicator into the risk register, identifying the account and the assertion affected.", "Reporter chaque indice au registre des risques, en identifiant le compte et l'assertion concernés.", "D7.2 risk register", "Registre des risques D7.2"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "before", en: "The expectation was formed before the current period figures were examined (procedure 1).", fr: "L'attente a été formée avant l'examen des chiffres de l'exercice (procédure 1)." },
        { key: "corroborated", en: "Every explanation accepted from management is corroborated by other evidence (procedure 5).", fr: "Chaque explication retenue de la direction est corroborée par un autre élément (procédure 5)." },
        { key: "registered", en: "Every indicator identified is reflected in the risk register (procedure 6).", fr: "Chaque indice relevé figure au registre des risques (procédure 6)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D4.4 --- */
const D4_4: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶21–27",
  ownsEn: "the understanding of the components of internal control",
  ownsFr: "la compréhension des composantes du contrôle interne",
  reqEn: [
    "We obtain an understanding of the entity's system of internal control relevant to the preparation of the financial statements: the control environment, the entity's risk assessment process, the process to monitor the system, the information system and communication, and control activities (ISA 315 (Revised 2019) ¶21–26).",
    "For each component we evaluate whether the controls are suitably designed to address the risks of material misstatement, and determine whether they have been implemented. Inquiry alone is not sufficient for that determination (ISA 315 (Revised 2019) ¶26(d)).",
  ],
  reqFr: [
    "Nous prenons connaissance du système de contrôle interne pertinent : environnement de contrôle, processus d'évaluation des risques, suivi du système, système d'information et communication, et activités de contrôle (ISA 315 révisée ¶21–26).",
    "Pour chaque composante, nous apprécions la conception des contrôles et déterminons s'ils sont mis en œuvre. L'entretien seul ne suffit pas (ISA 315 révisée ¶26(d)).",
  ],
  conclEn: [
    "We have obtained an understanding of each component of internal control relevant to the preparation of the financial statements, and have determined by procedures other than inquiry alone which of the identified controls have been implemented.",
  ],
  conclFr: [
    "Nous avons pris connaissance de chaque composante pertinente du contrôle interne et déterminé, par des procédures ne se limitant pas à l'entretien, quels contrôles identifiés sont mis en œuvre.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("risk_process", "Obtain the entity's process for identifying business risks relevant to financial reporting, and how management decides on the action to take.", "Obtenir le processus d'identification par l'entité des risques d'activité pertinents pour l'information financière et les actions décidées.", "Inquiry of management · risk register · board papers", "Entretien avec la direction · cartographie des risques · documents du conseil"),
        P("monitoring", "Obtain the process the entity uses to monitor the system of internal control, including any internal audit function and how deficiencies are remediated.", "Obtenir le processus de suivi du contrôle interne, y compris l'audit interne le cas échéant et le traitement des déficiences.", "Inquiry · internal audit reports (D4.9) · remediation log", "Entretien · rapports d'audit interne (D4.9) · suivi des corrections"),
        P("info_system", "Obtain the information system relevant to financial reporting: how transactions are initiated, recorded, processed and reported, and how the financial statements are prepared including consolidation and closing entries.", "Obtenir le système d'information pertinent : initiation, enregistrement, traitement et restitution des opérations, et établissement des états financiers y compris consolidation et écritures de clôture.", "Process narratives · chart of accounts · closing timetable", "Descriptifs de processus · plan de comptes · calendrier de clôture"),
        P("activities", "Identify the control activities that address the risks of material misstatement at assertion level, including the controls over journal entries.", "Identifier les activités de contrôle répondant aux risques au niveau des assertions, y compris les contrôles sur les écritures.", "Process narratives · control matrix · E350", "Descriptifs de processus · matrice de contrôles · E350"),
        P("design", "Evaluate whether each identified control is designed to prevent, or to detect and correct, the misstatement it addresses.", "Apprécier si chaque contrôle identifié est conçu pour prévenir, ou détecter et corriger, l'anomalie visée.", "Control descriptions · inquiry of the control owner", "Descriptions des contrôles · entretien avec le responsable du contrôle"),
        P("implemented", "Determine whether each identified control has been implemented, using observation, inspection of evidence of its operation, or a walkthrough. Inquiry alone is not sufficient.", "Déterminer si chaque contrôle identifié est mis en œuvre, par observation, examen de preuves de son fonctionnement ou test de cheminement. L'entretien seul ne suffit pas.", "Observation · inspection of a sample document · walkthrough note", "Observation · examen d'un document · note de cheminement"),
        P("deficiencies", "Record each deficiency identified, and evaluate whether alone or with others it is a significant deficiency to be communicated.", "Consigner chaque déficience relevée et apprécier si, seule ou combinée, elle constitue une déficience significative à communiquer.", "ISA 265 ¶8–9 · B2 · management letter", "ISA 265 ¶8–9 · B2 · lettre de recommandations"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "all_components", en: "Each of the five components has been understood and recorded (procedures 1 to 4, with the control environment in D4.5).", fr: "Chacune des cinq composantes a été comprise et consignée (procédures 1 à 4, l'environnement de contrôle en D4.5)." },
        { key: "not_inquiry", en: "Implementation was determined by procedures other than inquiry alone (procedure 6).", fr: "La mise en œuvre a été déterminée par des procédures ne se limitant pas à l'entretien (procédure 6)." },
        { key: "journals", en: "The controls over journal entries and other adjustments have been identified (procedure 4).", fr: "Les contrôles sur les écritures et autres ajustements ont été identifiés (procédure 4)." },
        { key: "communicated", en: "Each significant deficiency has been recorded for communication to those charged with governance (procedure 7).", fr: "Chaque déficience significative est consignée en vue de sa communication au gouvernement d'entreprise (procédure 7).", na: true },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D4.5 --- */
const D4_5: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶21–22, ¶A77–A87",
  ownsEn: "the assessment of the control environment",
  ownsFr: "l'appréciation de l'environnement de contrôle",
  reqEn: [
    "We evaluate whether management has created and maintained a culture of honesty and ethical behaviour, whether the control environment provides an appropriate foundation for the other components, and whether control deficiencies in the control environment undermine the other components (ISA 315 (Revised 2019) ¶22).",
    "A weak control environment affects the audit as a whole. It bears on the overall responses at financial statement level and may make a controls-reliance strategy unavailable regardless of how individual controls are designed.",
  ],
  reqFr: [
    "Nous apprécions si la direction a instauré une culture d'honnêteté et de comportement éthique, si l'environnement de contrôle constitue un socle approprié et si ses déficiences compromettent les autres composantes (ISA 315 révisée ¶22).",
    "Un environnement de contrôle faible affecte l'audit dans son ensemble et peut exclure une stratégie d'appui sur les contrôles.",
  ],
  conclEn: [
    "The control environment provides an appropriate foundation for the other components of internal control.",
    "The conclusion above has been reflected in the overall responses at financial statement level recorded in D7.2.",
  ],
  conclFr: [
    "L'environnement de contrôle constitue un socle approprié pour les autres composantes du contrôle interne.",
    "Cette conclusion est reprise dans les réponses globales au niveau des états financiers consignées en D7.2.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("tone", "Inquire of management and of those charged with governance about the entity's values and ethical standards, and how they are communicated and enforced.", "S'enquérir auprès de la direction et des responsables de la gouvernance des valeurs et normes éthiques, de leur communication et de leur application.", "Code of conduct · inquiry · staff handbook", "Code de conduite · entretien · règlement intérieur"),
        P("corroborate", "Corroborate the answers by observing how the entity operates and by inspecting evidence, rather than accepting the description given.", "Corroborer les réponses par l'observation du fonctionnement de l'entité et l'examen de pièces, plutôt que de retenir la description donnée.", "Observation · disciplinary records · minutes", "Observation · dossiers disciplinaires · procès-verbaux"),
        P("oversight", "Evaluate the oversight exercised by those charged with governance: how often they meet, what they examine and whether they are independent of management.", "Apprécier la surveillance exercée par les responsables de la gouvernance : fréquence des réunions, sujets examinés et indépendance vis-à-vis de la direction.", "Board and committee minutes (E360) · statutes", "Procès-verbaux du conseil et des comités (E360) · statuts"),
        P("structure", "Obtain the organisational structure, the assignment of authority and responsibility, and how segregation of duties is achieved.", "Obtenir l'organigramme, la répartition des pouvoirs et responsabilités et les modalités de séparation des tâches.", "Organisation chart · delegations of authority", "Organigramme · délégations de pouvoirs"),
        P("competence", "Evaluate the entity's commitment to competence: recruitment, training and the retention of finance staff.", "Apprécier l'engagement de l'entité en matière de compétence : recrutement, formation et fidélisation du personnel financier.", "HR records · inquiry · turnover data", "Dossiers RH · entretien · données de rotation"),
        P("pressure", "Identify any pressure on management to meet targets, and any incentive or reward that depends on reported results.", "Identifier toute pression sur la direction pour atteindre des objectifs et toute incitation liée aux résultats publiés.", "Bonus arrangements · covenants · budget targets", "Dispositifs de primes · covenants · objectifs budgétaires"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "culture", en: "Management has created and maintained a culture of honesty and ethical behaviour (procedures 1, 2).", fr: "La direction a instauré et maintenu une culture d'honnêteté et de comportement éthique (procédures 1, 2)." },
        { key: "oversight", en: "Those charged with governance exercise oversight that is more than formal (procedure 3).", fr: "Les responsables de la gouvernance exercent une surveillance qui n'est pas seulement formelle (procédure 3)." },
        { key: "segregation", en: "Authority and responsibility are assigned so that incompatible duties are segregated (procedure 4).", fr: "Les pouvoirs et responsabilités sont répartis de sorte que les tâches incompatibles soient séparées (procédure 4)." },
        { key: "competence", en: "The finance function has the competence for the reporting the entity is required to produce (procedure 5).", fr: "La fonction financière dispose de la compétence requise pour l'information à produire (procédure 5)." },
        { key: "no_pressure", en: "No incentive or pressure identified would motivate management to misstate the financial statements (procedure 6).", fr: "Aucune incitation ou pression identifiée ne pousserait la direction à présenter des comptes inexacts (procédure 6)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D4.6 --- */
const D4_6: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶25–26, ¶A173–A178",
  ownsEn: "the understanding of the IT environment and the risks arising from IT",
  ownsFr: "la connaissance de l'environnement informatique et des risques qui en découlent",
  reqEn: [
    "We identify the applications and supporting IT infrastructure that are subject to risks arising from the use of IT, and identify those risks and the general IT controls that address them (ISA 315 (Revised 2019) ¶26(b)–(c)).",
    "The scope is set by the information the financial statements depend on. An application that produces a figure or a report we intend to rely on is in scope, whether or not it is an accounting package.",
  ],
  reqFr: [
    "Nous identifions les applications et l'infrastructure soumises à des risques liés à l'informatique, ces risques et les contrôles informatiques généraux qui y répondent (ISA 315 révisée ¶26(b)–(c)).",
    "Le périmètre est déterminé par l'information dont dépendent les états financiers.",
  ],
  conclEn: [
    "The applications and infrastructure on which the financial statements depend have been identified, together with the risks arising from IT and the general IT controls that address them.",
  ],
  conclFr: [
    "Les applications et l'infrastructure dont dépendent les états financiers ont été identifiées, ainsi que les risques liés à l'informatique et les contrôles généraux correspondants.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("inventory", "Obtain the inventory of applications used in financial reporting, including spreadsheets relied on for a figure or a disclosure.", "Obtenir l'inventaire des applications utilisées pour l'information financière, y compris les tableurs servant à établir un chiffre ou une note.", "IT inventory · inquiry of finance and IT · process narratives", "Inventaire informatique · entretiens finance et informatique · descriptifs de processus"),
        P("architecture", "Obtain how the applications are hosted and how data moves between them, including any interface and any manual re-keying.", "Obtenir le mode d'hébergement des applications et les flux de données entre elles, y compris les interfaces et les ressaisies manuelles.", "Architecture diagram · interface list · inquiry of IT", "Schéma d'architecture · liste des interfaces · entretien informatique"),
        P("outsourced", "Identify the parts of the IT environment operated by a third party, and cross-refer to D4.8 for the service organisation.", "Identifier les parties de l'environnement informatique exploitées par un tiers et renvoyer à D4.8 pour l'organisme de services.", "Contracts · D4.8 · inquiry of IT", "Contrats · D4.8 · entretien informatique"),
        P("risks", "Identify the risks arising from the use of IT for each in-scope application: unauthorised access, unauthorised change, inappropriate direct data change, and reliance on inaccurate processing.", "Identifier les risques liés à l'informatique pour chaque application du périmètre : accès non autorisé, modification non autorisée, modification directe des données et traitement inexact.", "Inquiry of IT · incident log · prior file", "Entretien informatique · journal des incidents · dossier antérieur"),
        P("itgc", "Identify the general IT controls that address each risk: access management, change management, and IT operations.", "Identifier les contrôles informatiques généraux répondant à chaque risque : gestion des accès, gestion des changements et exploitation.", "IT policies · access lists · change log", "Politiques informatiques · listes d'accès · journal des changements"),
        P("ipe", "Identify the reports produced by the system that we intend to use as audit evidence, and record how their accuracy and completeness will be established.", "Identifier les états produits par le système que nous entendons utiliser comme éléments probants et consigner comment leur exactitude et exhaustivité seront établies.", "Report inventory · ISA 500 ¶9 · E510", "Inventaire des états · ISA 500 ¶9 · E510"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "complete", en: "The application inventory covers every source of a figure or disclosure in the financial statements, including spreadsheets (procedure 1).", fr: "L'inventaire couvre chaque source d'un chiffre ou d'une note des états financiers, y compris les tableurs (procédure 1)." },
        { key: "risks_addressed", en: "Each identified risk arising from IT has a general IT control against it, or is recorded as unaddressed (procedures 4, 5).", fr: "Chaque risque identifié dispose d'un contrôle général en réponse, ou est consigné comme non couvert (procédures 4, 5)." },
        { key: "ipe", en: "For every system report to be used as evidence, the means of establishing its accuracy and completeness is recorded (procedure 6).", fr: "Pour chaque état utilisé comme élément probant, le moyen d'établir son exactitude et son exhaustivité est consigné (procédure 6)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D4.7 --- */
const D4_7: PaperDef = {
  std: "ISA 620 ¶7–13",
  ownsEn: "the use of an auditor's expert and the evaluation of that expert's work",
  ownsFr: "le recours à un expert de l'auditeur et l'appréciation de ses travaux",
  reqEn: [
    "Where expertise in a field other than accounting or auditing is necessary to obtain sufficient appropriate audit evidence, we determine whether to use an auditor's expert (ISA 620 ¶7). We evaluate the expert's competence, capabilities and objectivity, obtain an understanding of the field, and agree the nature, scope and objectives of the work.",
    "We remain responsible for the opinion. The expert's work is evaluated for its adequacy for our purposes, including the relevance and reasonableness of the findings and of the assumptions and methods used (ISA 620 ¶12).",
  ],
  reqFr: [
    "Lorsqu'une expertise dans un domaine autre que la comptabilité ou l'audit est nécessaire, nous déterminons s'il y a lieu de recourir à un expert de l'auditeur (ISA 620 ¶7).",
    "Nous restons responsables de l'opinion. Les travaux de l'expert sont appréciés quant à leur adéquation, y compris la pertinence des hypothèses et méthodes retenues (ISA 620 ¶12).",
  ],
  conclEn: [
    "The expert's work is adequate for our purposes as audit evidence, and the findings are consistent with the other evidence obtained.",
  ],
  conclFr: [
    "Les travaux de l'expert sont adéquats pour nos besoins en tant qu'éléments probants, et les conclusions concordent avec les autres éléments obtenus.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("need", "Record the matter requiring expertise, and why the engagement team cannot address it alone.", "Consigner la question requérant une expertise et la raison pour laquelle l'équipe ne peut la traiter seule.", "D6.1 · risk register D7.2", "D6.1 · registre des risques D7.2"),
        P("competence", "Obtain evidence of the expert's competence and capabilities: qualifications, membership of a professional body, and experience of comparable work.", "Obtenir les éléments attestant de la compétence et des capacités de l'expert : qualifications, appartenance à un organisme professionnel et expérience de travaux comparables.", "Curriculum vitae · professional credentials · references", "Curriculum vitae · titres professionnels · références"),
        P("objectivity", "Inquire into the expert's relationships with the entity, including any financial interest and any prior engagement, and evaluate the threats to objectivity.", "S'enquérir des liens de l'expert avec l'entité, y compris tout intérêt financier et toute mission antérieure, et apprécier les risques pesant sur son objectivité.", "Expert's declaration · D3.2 · inquiry of the entity", "Déclaration de l'expert · D3.2 · entretien avec l'entité"),
        P("agree", "Agree in writing the nature, scope and objectives of the work, our respective roles, the form of the report, and confidentiality.", "Convenir par écrit de la nature, de l'étendue et des objectifs des travaux, des rôles respectifs, de la forme du rapport et de la confidentialité.", "Written terms with the expert · ISA 620 ¶11", "Termes écrits convenus · ISA 620 ¶11"),
        P("field", "Obtain sufficient understanding of the expert's field to evaluate the work, including the methods generally used and their limitations.", "Acquérir une connaissance suffisante du domaine de l'expert pour apprécier les travaux, y compris les méthodes usuelles et leurs limites.", "Technical literature · discussion with the expert", "Documentation technique · échange avec l'expert"),
        P("evaluate", "Evaluate the expert's findings: the relevance and reasonableness of the conclusions, the source data used, and the significant assumptions and methods.", "Apprécier les conclusions de l'expert : pertinence et caractère raisonnable, données sources utilisées, hypothèses et méthodes importantes.", "Expert's report · underlying data · ISA 620 ¶12", "Rapport de l'expert · données sous-jacentes · ISA 620 ¶12"),
        P("data", "Agree the source data the expert used to the entity's accounting records, and test its accuracy and completeness.", "Rapprocher les données sources utilisées par l'expert de la comptabilité de l'entité et en tester l'exactitude et l'exhaustivité.", "Accounting records · expert's working data", "Comptabilité · données de travail de l'expert"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "objective", en: "No threat to the expert's objectivity remains unaddressed (procedure 3).", fr: "Aucun risque pesant sur l'objectivité de l'expert ne demeure sans réponse (procédure 3)." },
        { key: "written", en: "The nature, scope and objectives of the work were agreed in writing before it began (procedure 4).", fr: "La nature, l'étendue et les objectifs des travaux ont été convenus par écrit avant leur début (procédure 4)." },
        { key: "assumptions", en: "The significant assumptions and methods used are reasonable in the circumstances (procedure 6).", fr: "Les hypothèses et méthodes importantes retenues sont raisonnables dans les circonstances (procédure 6)." },
        { key: "data_agreed", en: "The source data used by the expert agrees to the entity's records (procedure 7).", fr: "Les données sources utilisées par l'expert concordent avec la comptabilité de l'entité (procédure 7)." },
        { key: "no_reference", en: "The auditor's report will not refer to the expert's work, unless law requires it and the reference is explained as not reducing our responsibility.", fr: "Le rapport ne fera pas référence aux travaux de l'expert, sauf obligation légale assortie de la précision que notre responsabilité n'en est pas réduite.", na: true },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D4.8 --- */
const D4_8: PaperDef = {
  std: "ISA 402 ¶9–18",
  ownsEn: "the effect of the service organisation on the audit",
  ownsFr: "l'incidence de l'organisme de services sur la mission",
  reqEn: [
    "Where the entity uses a service organisation, we obtain an understanding of how the entity uses its services and of the effect on the entity's system of internal control, sufficient to identify and assess the risks of material misstatement (ISA 402 ¶9).",
    "Where that understanding cannot be obtained from the entity, we obtain it from a type 1 or type 2 report, by contacting the service organisation, by visiting it, or by using another auditor (ISA 402 ¶12). A type 1 report provides no evidence of operating effectiveness.",
  ],
  reqFr: [
    "Lorsque l'entité recourt à un organisme de services, nous prenons connaissance de l'utilisation de ces services et de leur incidence sur le contrôle interne (ISA 402 ¶9).",
    "À défaut de pouvoir l'obtenir auprès de l'entité, nous l'obtenons par un rapport de type 1 ou 2, un contact ou une visite (ISA 402 ¶12). Un rapport de type 1 n'apporte aucun élément sur l'efficacité du fonctionnement.",
  ],
  conclEn: [
    "We have obtained an understanding of the services and their effect on internal control sufficient to assess the risks of material misstatement, and have obtained the evidence needed on the controls at the service organisation on which we intend to rely.",
  ],
  conclFr: [
    "Nous avons acquis une connaissance suffisante des services et de leur incidence sur le contrôle interne, et obtenu les éléments nécessaires sur les contrôles de l'organisme de services sur lesquels nous entendons nous appuyer.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("identify", "Identify each service organisation used, the services provided, and the transactions and accounts affected.", "Identifier chaque organisme de services utilisé, les prestations fournies et les opérations et comptes concernés.", "Contracts · inquiry of management · payments ledger", "Contrats · entretien avec la direction · journal des paiements"),
        P("contract", "Read the contract and the service level terms to establish what the service organisation does and what the entity retains.", "Examiner le contrat et les niveaux de service pour établir ce qui relève de l'organisme et ce qui reste chez l'entité.", "Service contract · service level agreement", "Contrat de prestation · convention de niveau de service"),
        P("user_controls", "Identify the controls the entity itself operates over the service, including the reconciliation of its own records to the service organisation's reports.", "Identifier les contrôles exercés par l'entité elle-même sur la prestation, dont le rapprochement de ses propres données avec les états de l'organisme.", "Process narratives · reconciliations · inquiry", "Descriptifs de processus · rapprochements · entretien"),
        P("report", "Obtain the type 1 or type 2 report where one exists. Record the period it covers, the auditor who issued it and any modification.", "Obtenir le rapport de type 1 ou 2 lorsqu'il existe. Consigner la période couverte, l'auditeur émetteur et toute modification.", "Type 1 or type 2 report (ISAE 3402)", "Rapport de type 1 ou 2 (ISAE 3402)"),
        P("gap", "Where the report period does not cover our period, determine the additional procedures for the uncovered months.", "Lorsque la période du rapport ne couvre pas notre exercice, déterminer les procédures complémentaires pour les mois non couverts.", "Report period · our reporting period", "Période du rapport · notre exercice"),
        P("cucs", "Identify the complementary user entity controls the report assumes, and test that the entity operates each one.", "Identifier les contrôles complémentaires attendus de l'entité utilisatrice et tester que l'entité les met en œuvre.", "Type 2 report appendix · entity's controls", "Annexe du rapport de type 2 · contrôles de l'entité"),
        P("alternative", "Where no report is available and we intend to rely on the service organisation's controls, contact or visit it, or arrange for another auditor to perform procedures.", "En l'absence de rapport et si nous entendons nous appuyer sur les contrôles de l'organisme, le contacter ou le visiter, ou faire intervenir un autre auditeur.", "ISA 402 ¶12(b)–(d) · correspondence", "ISA 402 ¶12(b)–(d) · correspondance"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "understanding", en: "The understanding obtained is sufficient to identify and assess the risks of material misstatement (procedures 1 to 3).", fr: "La connaissance acquise suffit à identifier et évaluer les risques d'anomalies significatives (procédures 1 à 3)." },
        { key: "type2", en: "Where we rely on controls at the service organisation, a type 2 report or equivalent evidence of operating effectiveness has been obtained (procedures 4, 7).", fr: "Lorsque nous nous appuyons sur les contrôles de l'organisme, un rapport de type 2 ou un élément équivalent a été obtenu (procédures 4, 7).", na: true },
        { key: "period", en: "The evidence covers our reporting period, or the gap has been addressed (procedure 5).", fr: "Les éléments couvrent notre exercice, ou l'écart a été traité (procédure 5)." },
        { key: "cucs", en: "Each complementary user entity control assumed by the report has been tested (procedure 6).", fr: "Chaque contrôle complémentaire attendu de l'entité a été testé (procédure 6).", na: true },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D4.9 --- */
const D4_9: PaperDef = {
  std: "ISA 610 (Revised 2013) ¶15–25",
  ownsEn: "the use made of the internal audit function",
  ownsFr: "l'utilisation faite de la fonction d'audit interne",
  reqEn: [
    "Where the entity has an internal audit function, we determine whether its work can be used, by evaluating the extent to which its organisational status supports its objectivity, its level of competence, and whether it applies a systematic and disciplined approach (ISA 610 (Revised 2013) ¶15).",
    "We make all significant judgements ourselves, and plan the use of internal audit work so that we remain sufficiently involved. The more judgement involved and the higher the assessed risk, the less work can be used (ISA 610 ¶18–19).",
  ],
  reqFr: [
    "Lorsque l'entité dispose d'un audit interne, nous déterminons si ses travaux peuvent être utilisés en appréciant son statut organisationnel, sa compétence et le caractère méthodique de son approche (ISA 610 révisée ¶15).",
    "Nous portons nous-mêmes tous les jugements importants. Plus le jugement requis et le risque évalué sont élevés, moins les travaux peuvent être utilisés (ISA 610 ¶18–19).",
  ],
  conclEn: [
    "The internal audit function's objectivity, competence and approach support the use we intend to make of its work, and we remain sufficiently involved in the audit.",
  ],
  conclFr: [
    "L'objectivité, la compétence et l'approche de l'audit interne justifient l'utilisation envisagée de ses travaux, et notre implication demeure suffisante.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("status", "Establish to whom the internal audit function reports, who appoints and removes its head, and who sets its budget and its plan.", "Établir à qui l'audit interne rend compte, qui nomme et révoque son responsable, et qui arrête son budget et son plan.", "Internal audit charter · organisation chart · minutes", "Charte d'audit interne · organigramme · procès-verbaux"),
        P("competence", "Evaluate the competence of the function: the qualifications and experience of its staff, and its training and resources.", "Apprécier la compétence de la fonction : qualifications et expérience du personnel, formation et moyens.", "Staff records · training log · inquiry", "Dossiers du personnel · registre de formation · entretien"),
        P("approach", "Evaluate whether the function applies a systematic and disciplined approach, including documented methodology and quality control over its work.", "Apprécier si la fonction applique une approche méthodique et rigoureuse, avec une méthodologie documentée et un contrôle qualité de ses travaux.", "Internal audit manual · working papers · quality reviews", "Manuel d'audit interne · feuilles de travail · revues qualité"),
        P("plan", "Read the internal audit plan and reports for the period, and identify the work that bears on the risks we have assessed.", "Examiner le plan et les rapports d'audit interne de l'exercice et identifier les travaux touchant aux risques évalués.", "Internal audit plan and reports · D7.2", "Plan et rapports d'audit interne · D7.2"),
        P("determine", "Determine the areas and the extent of work to be used, giving less weight where more judgement is involved or the assessed risk is higher.", "Déterminer les domaines et l'étendue des travaux utilisés, en réduisant le recours lorsque le jugement requis ou le risque évalué est plus élevé.", "ISA 610 ¶18–19 · D7.2", "ISA 610 ¶18–19 · D7.2"),
        P("reperform", "Re-perform a portion of the work to be used, and evaluate whether it was properly planned, performed, supervised, reviewed and documented.", "Réexécuter une partie des travaux utilisés et apprécier s'ils ont été correctement planifiés, réalisés, supervisés, revus et documentés.", "Internal audit working papers · our re-performance note", "Feuilles de travail de l'audit interne · notre note de réexécution"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "objectivity", en: "The organisational status of the function supports its objectivity (procedure 1).", fr: "Le statut organisationnel de la fonction soutient son objectivité (procédure 1)." },
        { key: "systematic", en: "The function applies a systematic and disciplined approach (procedure 3).", fr: "La fonction applique une approche méthodique et rigoureuse (procédure 3)." },
        { key: "judgement", en: "No significant judgement has been delegated to the internal audit function (procedure 5).", fr: "Aucun jugement important n'a été délégué à l'audit interne (procédure 5)." },
        { key: "reperformed", en: "The re-performance supports the adequacy of the work used (procedure 6).", fr: "La réexécution confirme l'adéquation des travaux utilisés (procédure 6)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D5.1 --- */
const D5_1: PaperDef = {
  std: "ISA 320 ¶10–14 · ISA 450 ¶5",
  ownsEn: "materiality, performance materiality and the clearly trivial threshold",
  ownsFr: "le seuil de signification, le seuil de travail et le seuil négligeable",
  tools: ["materiality"],
  reqEn: [
    "Materiality for the financial statements as a whole is determined when the overall strategy is established, using a benchmark and a percentage applied to it, supported by professional judgement about the users of the financial statements (ISA 320 ¶10).",
    "Performance materiality is set below that amount to reduce to an appropriately low level the probability that uncorrected and undetected misstatements together exceed materiality (ISA 320 ¶11). Materiality is revised where we become aware of information that would have caused a different amount to be set initially (ISA 320 ¶12).",
  ],
  reqFr: [
    "Le seuil de signification pour les états financiers pris dans leur ensemble est déterminé lors de l'établissement de la stratégie, à partir d'une référence et d'un pourcentage (ISA 320 ¶10).",
    "Le seuil de travail est fixé en deçà afin de réduire à un niveau suffisamment faible la probabilité que les anomalies non corrigées et non détectées dépassent ensemble le seuil (ISA 320 ¶11).",
  ],
  conclEn: [
    "The amounts recorded here are appropriate for this engagement, having regard to the users of the financial statements and the assessed risks.",
  ],
  conclFr: [
    "Les montants consignés sont appropriés pour cette mission, compte tenu des utilisateurs des états financiers et des risques évalués.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("users", "Identify the users of the financial statements and what they use them for, including any lender, regulator or minority shareholder.", "Identifier les utilisateurs des états financiers et l'usage qu'ils en font : prêteurs, régulateurs, actionnaires minoritaires.", "Statutes · loan agreements · inquiry of management", "Statuts · contrats de prêt · entretien avec la direction",
          "Review the management reports and the last annual general assembly file — the addressees show who actually receives and uses the statements. The OHADA framework prescribes who the statements are addressed to (shareholders in general assembly, with filing to the tax administration and the RCCM); add to that list every lender named in a loan agreement (they read covenants), any sector regulator that requires filings, and minority shareholders who rely on the accounts for dividends.",
          "Revoir les rapports de gestion et le dossier de la dernière assemblée générale — les destinataires montrent qui reçoit et utilise réellement les états. Le référentiel OHADA prescrit leurs destinataires (les associés en assemblée, avec dépôt à l'administration fiscale et au RCCM) ; y ajouter chaque prêteur nommé dans un contrat de prêt (il lit les covenants), tout régulateur sectoriel exigeant des dépôts, et les minoritaires qui s'appuient sur les comptes pour les dividendes."),
        P("benchmark", "Select the benchmark and record why it fits this entity, and why the alternatives were not selected.", "Choisir la référence et consigner pourquoi elle convient à cette entité, et pourquoi les autres ont été écartées.", "Trial balance · prior financial statements · ISA 320 ¶A4–A9", "Balance · états financiers antérieurs · ISA 320 ¶A4–A9",
          "Choose from what the users watch. Profit before tax fits a stable, profit-oriented entity whose owners judge it on earnings — but not one near break-even or with volatile results, where a small profit produces an absurdly small materiality. Revenue fits loss-makers, start-ups and entities judged on activity levels. Total assets fits asset-heavy or holding entities where the balance sheet is what matters; equity where solvency drives the users (lenders, OHADA half-of-capital test); total expenses fits not-for-profits and project entities. Write one sentence for the choice and one for why the nearest alternative was set aside.",
          "Choisir selon ce que regardent les utilisateurs. Le résultat avant impôt convient à une entité rentable et stable jugée sur ses bénéfices — mais pas à une entité proche de l'équilibre ou volatile, où un petit résultat donnerait un seuil absurde. Le chiffre d'affaires convient aux déficitaires, aux jeunes entités et à celles jugées sur l'activité. Le total de l'actif convient aux entités patrimoniales ou holdings ; les capitaux propres quand la solvabilité guide les utilisateurs (prêteurs, test OHADA de la moitié du capital) ; le total des charges aux entités à but non lucratif. Une phrase pour le choix, une pour l'alternative écartée."),
        P("figure", "Establish the benchmark figure, using the latest reliable data and adjusting for any known non-recurring item.", "Établir le montant de la référence à partir des données fiables les plus récentes, en neutralisant tout élément non récurrent connu.", "Trial balance · management accounts · prior audited figures", "Balance · situation intermédiaire · chiffres audités antérieurs",
          "Take the figure from the ingested trial balance (the Materiality tool derives all five bases automatically) or, before year-end, from the latest management accounts annualised. Strip out items that will not recur — a one-off disposal gain, a restructuring charge — because materiality should reflect the normal size of the business, and note each adjustment.",
          "Prendre le montant de la balance ingérée (l'outil Seuil dérive les cinq bases automatiquement) ou, avant la clôture, de la dernière situation intermédiaire annualisée. Neutraliser les éléments non récurrents — plus-value de cession isolée, charge de restructuration — car le seuil doit refléter la taille normale de l'activité, en notant chaque retraitement."),
        P("percentage", "Apply the percentage and record the reasons for the level chosen within the acceptable range.", "Appliquer le pourcentage et consigner les motifs du niveau retenu dans la fourchette acceptable.", "Firm policy · ISA 320 ¶A4–A9", "Politique du cabinet · ISA 320 ¶A4–A9",
          "Stay inside the range the tool shows for the basis (PBT 5–10%, revenue and assets 0.5–2%, equity 1–5%, expenses 0.5–2%). Go to the low end when users are sensitive — a first-year audit, listed or regulated entity, covenant pressure, known misstatement history; the high end suits a stable, owner-managed entity with a clean record. Record the reason in the justification box, not just the number.",
          "Rester dans la fourchette affichée pour la base (RAI 5–10 %, CA et actif 0,5–2 %, capitaux propres 1–5 %, charges 0,5–2 %). Choisir le bas de fourchette quand les utilisateurs sont sensibles — premier mandat, entité réglementée, pression des covenants, antécédents d'anomalies ; le haut convient à une entité stable, familiale, au dossier propre. Consigner le motif dans la justification, pas seulement le chiffre."),
        P("pm", "Set performance materiality, taking account of the assessed risks, the misstatements found in prior periods, and the number and size of misstatements expected.", "Fixer le seuil de travail en tenant compte des risques évalués, des anomalies des exercices antérieurs et du nombre et de la taille des anomalies attendues.", "Prior year B5 · D7.2 · firm policy", "B5 de l'exercice précédent · D7.2 · politique du cabinet",
          "Open last year's Summary of Audit Differences (B5): many or large misstatements push performance materiality toward 60% of PM; a clean prior file with low assessed risks supports 75%. Performance materiality is the buffer that keeps undetected misstatements from breaching materiality in aggregate — the riskier the file, the bigger the buffer, so the lower the percentage.",
          "Ouvrir le récapitulatif des écarts de l'exercice précédent (B5) : des anomalies nombreuses ou importantes poussent le seuil de travail vers 60 % du seuil global ; un dossier antérieur propre avec des risques faibles justifie 75 %. Le seuil de travail est la marge qui empêche les anomalies non détectées de dépasser le seuil en cumul — plus le dossier est risqué, plus la marge doit être grande, donc plus le pourcentage baisse."),
        P("specific", "Determine whether a class of transactions, balance or disclosure exists for which a lower amount would influence users, and set a specific materiality for it.", "Déterminer s'il existe un flux, un solde ou une note pour lequel un montant plus faible influencerait les utilisateurs, et fixer un seuil spécifique.", "ISA 320 ¶10 · statutes · loan covenants", "ISA 320 ¶10 · statuts · covenants bancaires",
          "Scan the loan agreements for covenant ratios (a small error in EBITDA can flip a covenant), the statutes for regulated thresholds, and the notes for sensitive disclosures — related-party transactions and management remuneration are the classic cases where users care about amounts far below overall materiality.",
          "Balayer les contrats de prêt pour les ratios de covenant (une petite erreur d'EBITDA peut faire basculer un covenant), les statuts pour les seuils réglementés, et l'annexe pour les informations sensibles — conventions avec les parties liées et rémunération des dirigeants sont les cas classiques où les utilisateurs s'intéressent à des montants bien inférieurs au seuil global."),
        P("trivial", "Set the clearly trivial threshold below which misstatements need not be accumulated.", "Fixer le seuil négligeable en deçà duquel les anomalies ne sont pas cumulées.", "ISA 450 ¶5 · firm policy", "ISA 450 ¶5 · politique du cabinet",
          "Set it at 3–5% of overall materiality (the tool defaults to 5%). Below this line misstatements are not even accumulated in B5 — so if the entity's users are unusually sensitive, or you expect many small errors that could add up, choose the lower end.",
          "Le fixer à 3–5 % du seuil global (l'outil propose 5 %). Sous cette ligne, les anomalies ne sont même pas cumulées en B5 — si les utilisateurs sont particulièrement sensibles, ou si de nombreuses petites erreurs risquent de s'additionner, retenir le bas de fourchette."),
      ],
    },
    {
      kind: "fields",
      titleEn: "Part B — Amounts",
      titleFr: "Partie B — Montants",
      fields: [
        { key: "benchmark", kind: "auto", labelEn: "Benchmark, percentage and amounts", labelFr: "Référence, pourcentage et montants", source: "materiality" },
        { key: "specific", kind: "input", labelEn: "Specific materiality, where a class or disclosure has a lower threshold", labelFr: "Seuil spécifique, le cas échéant" },
        { key: "revisions", kind: "input", labelEn: "Revisions during the engagement, and their effect on the procedures already performed", labelFr: "Révisions en cours de mission et leur effet sur les procédures déjà réalisées" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part C — Evaluation",
      titleFr: "Partie C — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "stable", en: "The benchmark is stable enough that the amount would not change materially on a small change in the entity's results (procedures 2, 3).", fr: "La référence est assez stable pour que le montant ne varie pas sensiblement sur une faible variation des résultats (procédures 2, 3)." },
        { key: "pm_reasoned", en: "The performance materiality percentage reflects the assessed risks and the prior period experience rather than a default (procedure 5).", fr: "Le pourcentage du seuil de travail reflète les risques évalués et l'expérience antérieure plutôt qu'une valeur par défaut (procédure 5)." },
        { key: "revised", en: "Materiality has been reconsidered against the final results, and revised where required (Part B).", fr: "Le seuil a été réexaminé au regard des résultats définitifs et révisé si nécessaire (partie B)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D5.2 --- */
// Titled "Commitments & Contingencies" in the file index. The planning paper
// scopes them and sets the strategy; the evidence is obtained in E270.
const D5_2: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶19 · ISA 501 ¶9–12 · IAS 37 / SYSCOHADA",
  ownsEn: "the identification of commitments and contingencies, and the strategy for them",
  ownsFr: "l'identification des engagements et passifs éventuels et la stratégie retenue",
  reqEn: [
    "We design and perform procedures to identify litigation and claims involving the entity that may give rise to a risk of material misstatement (ISA 501 ¶9). Identification at the planning stage sets the scope of the evidence to obtain in execution.",
    "Commitments and contingencies are frequently unrecorded. The risk is one of completeness, and the procedures are directed at sources outside the general ledger.",
  ],
  reqFr: [
    "Nous concevons et mettons en œuvre des procédures pour identifier les litiges et réclamations pouvant engendrer un risque d'anomalie significative (ISA 501 ¶9).",
    "Les engagements et passifs éventuels sont souvent non comptabilisés. Le risque porte sur l'exhaustivité et les procédures visent des sources extérieures au grand livre.",
  ],
  conclEn: [
    "The commitments and contingencies affecting the entity have been identified for the purpose of planning, and the strategy for obtaining evidence on each is recorded below.",
  ],
  conclFr: [
    "Les engagements et passifs éventuels affectant l'entité ont été identifiés aux fins de la planification, et la stratégie d'obtention des éléments probants est consignée ci-dessous.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("inquire", "Inquire of management and of those responsible for legal matters about litigation, claims and assessments, whether or not recorded.", "S'enquérir auprès de la direction et des responsables juridiques des litiges, réclamations et redressements, comptabilisés ou non.", "Inquiry of management · in-house counsel", "Entretien avec la direction · service juridique"),
        P("minutes", "Read the minutes of the general meetings and of the board for commitments given, guarantees granted and disputes reported.", "Examiner les procès-verbaux d'assemblée et du conseil : engagements donnés, garanties accordées et litiges signalés.", "Minutes (E360) · resolutions", "Procès-verbaux (E360) · résolutions"),
        P("legal_fees", "Review the legal and professional fees account for the period, and identify the matter behind each significant payment.", "Examiner le compte d'honoraires juridiques de l'exercice et identifier l'affaire à l'origine de chaque paiement significatif.", "General ledger · invoices from advisers", "Grand livre · factures des conseils"),
        P("contracts", "Read the significant contracts for guarantees, penalty clauses, capital commitments and take-or-pay obligations.", "Examiner les contrats significatifs : garanties, clauses pénales, engagements d'investissement et obligations d'enlèvement.", "Contract file · loan agreements · leases", "Chrono des contrats · contrats de prêt · baux"),
        P("bank", "Identify from the bank documentation the guarantees, sureties and pledges given or received.", "Identifier dans la documentation bancaire les garanties, cautions et nantissements donnés ou reçus.", "Bank confirmations · loan agreements · pledge register", "Confirmations bancaires · contrats de prêt · registre des nantissements"),
        P("tax_social", "Inquire into open tax and social security assessments and inspections, and obtain the position on each.", "S'enquérir des contrôles et redressements fiscaux et sociaux en cours et obtenir la position sur chacun.", "Correspondence with the tax and social administrations", "Correspondance avec les administrations fiscale et sociale"),
        P("strategy", "For each item identified, record whether it is recognised, disclosed or neither, and set the evidence to be obtained in E270.", "Pour chaque élément identifié, consigner s'il est comptabilisé, mentionné ou ni l'un ni l'autre, et arrêter les éléments à obtenir en E270.", "IAS 37 / SYSCOHADA · E270", "IAS 37 / SYSCOHADA · E270"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "sources", en: "The identification drew on sources outside the general ledger (procedures 2 to 6).", fr: "L'identification s'est appuyée sur des sources extérieures au grand livre (procédures 2 à 6)." },
        { key: "legal_letter", en: "Where litigation or claims were identified, a letter of inquiry to the entity's legal advisers is planned (procedures 1, 3; ISA 501 ¶10).", fr: "En cas de litiges identifiés, une lettre aux conseils juridiques de l'entité est prévue (procédures 1, 3 ; ISA 501 ¶10).", na: true },
        { key: "carried", en: "Each item identified has been carried into E270 with the evidence to be obtained (procedure 7).", fr: "Chaque élément identifié est repris en E270 avec les éléments probants à obtenir (procédure 7)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D5.4 --- */
const D5_4: PaperDef = {
  std: "ISA 240 ¶12–27, ¶31–33",
  ownsEn: "the fraud risk assessment and the presumed risks",
  ownsFr: "l'évaluation du risque de fraude et les risques présumés",
  reqEn: [
    "We identify and assess the risks of material misstatement due to fraud at the financial statement level and at the assertion level (ISA 240 ¶25). There is a rebuttable presumption that revenue recognition gives rise to a risk of fraud; where that presumption is rebutted, the reasons are documented (ISA 240 ¶26, ¶47).",
    "Management is in a unique position to perpetrate fraud by overriding controls. That risk is present in every entity and is treated as a significant risk, whatever our assessment of management's integrity (ISA 240 ¶31). The responses are performed in E350.",
  ],
  reqFr: [
    "Nous identifions et évaluons les risques d'anomalies significatives résultant de fraudes, au niveau des états financiers et des assertions (ISA 240 ¶25). La présomption de risque sur la comptabilisation des produits est réfragable et toute réfutation est documentée (ISA 240 ¶26, ¶47).",
    "La direction est en mesure de contourner les contrôles. Ce risque existe dans toute entité et est traité comme un risque important (ISA 240 ¶31). Les réponses sont mises en œuvre en E350.",
  ],
  conclEn: [
    "The risks of material misstatement due to fraud have been identified and assessed, and each is carried into the risk register with a planned response.",
    "The presumption of a fraud risk in revenue recognition has been applied, or the reasons for rebutting it are recorded below.",
  ],
  conclFr: [
    "Les risques d'anomalies significatives résultant de fraudes ont été identifiés et évalués, et chacun est repris au registre des risques avec la réponse prévue.",
    "La présomption de risque de fraude sur les produits a été appliquée, ou les motifs de sa réfutation sont consignés ci-dessous.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("mgmt", "Inquire of management about its assessment of the risk of fraud, its process for identifying and responding to that risk, and its communication to employees on conduct.", "S'enquérir auprès de la direction de son évaluation du risque de fraude, de son processus d'identification et de réponse, et de sa communication au personnel sur la conduite à tenir.", "Inquiry of management · fraud policy · code of conduct", "Entretien avec la direction · politique anti-fraude · code de conduite"),
        P("known", "Inquire of management, internal audit and others within the entity about any actual, suspected or alleged fraud.", "S'enquérir auprès de la direction, de l'audit interne et d'autres personnes de toute fraude avérée, suspectée ou alléguée.", "Inquiry beyond the finance function · whistleblowing log", "Entretiens au-delà de la fonction financière · registre des alertes"),
        P("tcwg", "Inquire of those charged with governance how they exercise oversight of management's fraud risk processes, and about any fraud they are aware of.", "S'enquérir auprès des responsables de la gouvernance de leur surveillance des dispositifs anti-fraude et de toute fraude connue d'eux.", "Inquiry of those charged with governance · minutes", "Entretien avec les responsables de la gouvernance · procès-verbaux"),
        P("factors", "Identify the fraud risk factors present: incentives and pressures, opportunities, and attitudes or rationalisations.", "Identifier les facteurs de risque présents : incitations et pressions, opportunités, attitudes ou justifications.", "ISA 240 Appendix 1 · D4.5 · analytics D4.3", "ISA 240 annexe 1 · D4.5 · analyses D4.3"),
        P("analytics", "Evaluate whether the unusual or unexpected relationships identified in the preliminary analytics indicate a risk of fraud.", "Apprécier si les relations inhabituelles relevées en analyse préliminaire révèlent un risque de fraude.", "D4.3 preliminary analytics", "Analyses préliminaires D4.3"),
        P("reliability", "Investigate any condition identified that causes us to question the reliability of the records and documents to be used as audit evidence: missing or altered documents, unexplained differences between records, or evasive responses.", "Examiner toute circonstance relevée conduisant à douter de la fiabilité des livres et documents devant servir d'éléments probants : documents manquants ou altérés, écarts inexpliqués entre les enregistrements, ou réponses évasives.", "ISA 240 ¶13 · document inspection · reconciliations", "ISA 240 ¶13 · inspection des documents · rapprochements"),
        P("revenue", "Apply the presumption that revenue recognition gives rise to a fraud risk. Identify the revenue assertions affected, or record the reasons for rebutting the presumption.", "Appliquer la présomption de risque de fraude sur la comptabilisation des produits. Identifier les assertions concernées ou consigner les motifs de la réfutation.", "ISA 240 ¶26, ¶47 · E100", "ISA 240 ¶26, ¶47 · E100"),
        P("override", "Record the risk of management override as a significant risk, and set the responses to be performed in E350: journal entry testing, review of estimates for bias, and evaluation of significant unusual transactions.", "Consigner le risque de contournement des contrôles comme risque important et arrêter les réponses à mettre en œuvre en E350 : test des écritures, revue des estimations et examen des opérations inhabituelles significatives.", "ISA 240 ¶31–33 · E350", "ISA 240 ¶31–33 · E350"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "beyond_finance", en: "The inquiries extended to people outside the finance function (procedure 2).", fr: "Les entretiens ont dépassé la fonction financière (procédure 2)." },
        { key: "tcwg", en: "Those charged with governance were asked directly about fraud (procedure 3).", fr: "Les responsables de la gouvernance ont été interrogés directement sur la fraude (procédure 3)." },
        { key: "revenue", en: "The revenue recognition presumption has been applied rather than rebutted (procedure 6). A “No” requires the reasons for rebuttal below.", fr: "La présomption sur les produits a été appliquée et non réfutée (procédure 6). Un « Non » appelle les motifs ci-dessous." },
        { key: "override", en: "Management override is recorded as a significant risk with responses planned in E350 (procedure 7).", fr: "Le contournement des contrôles est consigné comme risque important avec des réponses prévues en E350 (procédure 7)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D5.5 --- */
const D5_5: PaperDef = {
  std: "ISA 570 (Revised) ¶10–12",
  ownsEn: "the preliminary going concern assessment",
  ownsFr: "l'appréciation préliminaire de la continuité d'exploitation",
  reqEn: [
    "When performing risk assessment procedures we consider whether events or conditions exist that may cast significant doubt on the entity's ability to continue as a going concern, and determine whether management has already performed a preliminary assessment (ISA 570 (Revised) ¶10–11).",
    "The preliminary view sets the work to be done at completion in E330 and B7. It does not conclude on the matter.",
  ],
  reqFr: [
    "Lors des procédures d'évaluation des risques, nous examinons l'existence d'événements ou de conditions susceptibles de jeter un doute important sur la continuité d'exploitation (ISA 570 révisée ¶10–11).",
    "L'appréciation préliminaire détermine les travaux à réaliser à l'achèvement en E330 et B7 ; elle ne conclut pas sur la question.",
  ],
  conclEn: [
    "The events and conditions that may cast significant doubt on the entity's ability to continue as a going concern have been identified, and the work required at completion is set out below.",
  ],
  conclFr: [
    "Les événements et conditions susceptibles de jeter un doute important sur la continuité ont été identifiés, et les travaux requis à l'achèvement sont définis ci-dessous.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("indicators", "Review the financial indicators: net liability position, recurring losses, negative operating cash flow, adverse key ratios and arrears.", "Examiner les indicateurs financiers : situation nette négative, pertes récurrentes, flux de trésorerie d'exploitation négatifs, ratios défavorables et arriérés.", "Trial balance · prior financial statements · D4.3", "Balance · états financiers antérieurs · D4.3"),
        P("operating", "Review the operating and other indicators: loss of a principal market or supplier, key personnel departures, labour difficulties and pending legal proceedings.", "Examiner les indicateurs opérationnels et autres : perte d'un marché ou d'un fournisseur majeur, départs de personnel clé, conflits sociaux et procédures en cours.", "Inquiry of management · minutes · D5.2", "Entretien avec la direction · procès-verbaux · D5.2"),
        P("borrowings", "Identify the borrowings falling due within twelve months, and the covenants attached to them.", "Identifier les emprunts échéant dans les douze mois et les covenants qui y sont attachés.", "Loan agreements · bank confirmations · maturity schedule", "Contrats de prêt · confirmations bancaires · échéancier"),
        P("capital", "For a SYSCOHADA entity, compare net equity against half of the share capital and record whether the article 664 procedure is engaged.", "Pour une entité SYSCOHADA, comparer les capitaux propres à la moitié du capital social et indiquer si la procédure de l'article 664 est engagée.", "Trial balance · statutes · F7", "Balance · statuts · F7"),
        P("mgmt_assess", "Establish whether management has made its preliminary assessment, the period it covers, and the support behind it.", "Établir si la direction a réalisé son appréciation préliminaire, la période couverte et les éléments qui l'étayent.", "Inquiry of management · cash flow forecast · budget", "Entretien avec la direction · prévisions de trésorerie · budget"),
        P("plan", "Set the work required at completion, including the period the assessment must cover and the evidence to obtain on any mitigating plan.", "Arrêter les travaux requis à l'achèvement, dont la période à couvrir et les éléments à obtenir sur tout plan d'atténuation.", "E330 · B7 · ISA 570 (Revised) ¶13", "E330 · B7 · ISA 570 révisée ¶13"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "none", en: "No event or condition was identified that may cast significant doubt on the entity's ability to continue as a going concern (procedures 1 to 4). A “No” sets the extended work in E330.", fr: "Aucun événement ou condition susceptible de jeter un doute important n'a été identifié (procédures 1 à 4). Un « Non » déclenche les travaux étendus en E330." },
        { key: "assessment", en: "Management's assessment covers at least twelve months from the date the financial statements will be authorised for issue (procedure 5).", fr: "L'appréciation de la direction couvre au moins douze mois à compter de la date d'arrêté des comptes (procédure 5)." },
        { key: "capital", en: "Net equity exceeds half of the share capital, so the article 664 procedure is not engaged (procedure 4).", fr: "Les capitaux propres excèdent la moitié du capital social ; la procédure de l'article 664 n'est pas engagée (procédure 4).", na: true },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D5.6 --- */
const D5_6: PaperDef = {
  std: "ISA 550 ¶11–17",
  ownsEn: "the related party register and the risks arising from those relationships",
  ownsFr: "le registre des parties liées et les risques qui en découlent",
  reqEn: [
    "We obtain an understanding of the entity's related party relationships and transactions sufficient to identify fraud risk factors and to conclude whether the financial statements achieve fair presentation (ISA 550 ¶9). We inquire of management about the identity of related parties, the nature of the relationships, and the transactions entered into (ISA 550 ¶13).",
    "We remain alert throughout for related parties or transactions not previously identified or disclosed by management (ISA 550 ¶15). A transaction outside the normal course of business with a related party is treated as a significant risk (ISA 550 ¶18).",
  ],
  reqFr: [
    "Nous acquérons une connaissance des relations et opérations avec les parties liées suffisante pour identifier les facteurs de risque de fraude (ISA 550 ¶9, ¶13).",
    "Nous restons vigilants à l'égard des parties liées ou opérations non identifiées par la direction (ISA 550 ¶15). Une opération hors du cours normal des affaires avec une partie liée est traitée comme un risque important (ISA 550 ¶18).",
  ],
  conclEn: [
    "The related parties and the transactions with them have been identified for planning purposes, and the risks arising are carried into the risk register.",
  ],
  conclFr: [
    "Les parties liées et les opérations correspondantes ont été identifiées aux fins de la planification, et les risques en découlant sont repris au registre des risques.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("identity", "Inquire of management about the identity of the entity's related parties, including changes from the prior period, and the nature of each relationship.", "S'enquérir auprès de la direction de l'identité des parties liées, des changements par rapport à l'exercice précédent et de la nature de chaque relation.", "Inquiry of management · prior year register · statutes", "Entretien avec la direction · registre de l'exercice précédent · statuts"),
        P("controls", "Inquire about the controls management has established to identify, account for and disclose related party relationships and transactions, and to authorise transactions outside the normal course of business.", "S'enquérir des contrôles établis par la direction pour identifier, comptabiliser et mentionner les relations et opérations avec les parties liées et pour autoriser celles hors du cours normal des affaires.", "Inquiry · delegation of authority · D4.4", "Entretien · délégations de pouvoirs · D4.4"),
        P("registers", "Inspect the share register, the register of directors' interests and the group structure for parties not named by management.", "Examiner le registre des titres, le registre des intérêts des dirigeants et l'organigramme du groupe à la recherche de parties non citées.", "Share register (F6) · RCCM extract · group chart", "Registre des titres (F6) · extrait RCCM · organigramme du groupe"),
        P("records", "Review the bank confirmations, the minutes and the significant contracts for names not on the register.", "Examiner les confirmations bancaires, les procès-verbaux et les contrats significatifs à la recherche de noms absents du registre.", "Bank confirmations · minutes (E360) · contract file", "Confirmations bancaires · procès-verbaux (E360) · chrono des contrats"),
        P("transactions", "Obtain the transactions with each related party for the period, with the amounts, the balances outstanding and the terms.", "Obtenir les opérations réalisées avec chaque partie liée sur l'exercice, avec les montants, les soldes et les conditions.", "General ledger · related party schedule · contracts", "Grand livre · état des parties liées · contrats"),
        P("outside", "Identify the transactions outside the normal course of business, and record each as a significant risk.", "Identifier les opérations hors du cours normal des affaires et consigner chacune comme risque important.", "ISA 550 ¶18 · D7.2", "ISA 550 ¶18 · D7.2"),
        P("team", "Communicate the related party names to the engagement team so that members remain alert to them during execution.", "Communiquer les noms des parties liées à l'équipe afin qu'elle y reste attentive pendant l'exécution.", "ISA 550 ¶17 · team briefing (D7.1)", "ISA 550 ¶17 · réunion d'équipe (D7.1)"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "independent", en: "The register was tested against sources independent of management's list (procedures 3, 4).", fr: "Le registre a été confronté à des sources indépendantes de la liste de la direction (procédures 3, 4)." },
        { key: "outside", en: "Each transaction outside the normal course of business is recorded as a significant risk (procedure 6).", fr: "Chaque opération hors du cours normal des affaires est consignée comme risque important (procédure 6).", na: true },
        { key: "communicated", en: "The related party names have been communicated to the engagement team (procedure 7).", fr: "Les noms des parties liées ont été communiqués à l'équipe (procédure 7)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D5.7 --- */
const D5_7: PaperDef = {
  std: "ISA 540 (Revised) ¶13–17, ¶19–20",
  ownsEn: "the inventory of accounting estimates and the planned approach to each",
  ownsFr: "l'inventaire des estimations comptables et l'approche retenue pour chacune",
  reqEn: [
    "We obtain an understanding of the entity's accounting estimates: how management identifies the need for them, the method, assumptions and data used, and the controls over the process (ISA 540 (Revised) ¶13). We evaluate the degree of estimation uncertainty and the degree to which the estimate is subject to complexity, subjectivity or other inherent risk factors (ISA 540 ¶16).",
    "The assessment separates inherent risk from control risk and drives the choice of approach in execution: testing management's process, developing our own point estimate or range, or obtaining evidence from events occurring up to the date of the report (ISA 540 ¶21–29). The work is performed in E390.",
  ],
  reqFr: [
    "Nous prenons connaissance des estimations comptables : identification du besoin, méthode, hypothèses et données utilisées, et contrôles du processus (ISA 540 révisée ¶13). Nous apprécions le degré d'incertitude d'estimation et les facteurs de risque inhérent (ISA 540 ¶16).",
    "L'évaluation sépare le risque inhérent du risque lié au contrôle et détermine l'approche en exécution (ISA 540 ¶21–29). Les travaux sont réalisés en E390.",
  ],
  conclEn: [
    "The accounting estimates in the financial statements have been identified, the estimation uncertainty of each has been evaluated, and the approach to each is recorded below.",
  ],
  conclFr: [
    "Les estimations comptables figurant dans les états financiers ont été identifiées, leur incertitude appréciée, et l'approche retenue pour chacune est consignée ci-dessous.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("inventory", "List the accounting estimates in the financial statements, including impairment, provisions, depreciation lives, receivable allowances, employee benefits and any fair value.", "Recenser les estimations comptables : dépréciations, provisions, durées d'amortissement, dépréciation des créances, avantages du personnel et justes valeurs.", "Prior financial statements · trial balance · accounting policies", "États financiers antérieurs · balance · méthodes comptables"),
        P("method", "For each estimate obtain the method, the model where one is used, the significant assumptions, and the data on which it draws.", "Pour chaque estimation, obtenir la méthode, le modèle éventuel, les hypothèses importantes et les données utilisées.", "Management's calculation · policy note · inquiry", "Calcul de la direction · note de méthode · entretien"),
        P("controls", "Obtain the controls over the estimation process, including who reviews and approves the assumptions.", "Obtenir les contrôles du processus d'estimation, notamment qui revoit et approuve les hypothèses.", "Process narrative · approval evidence · D4.4", "Descriptif de processus · preuves d'approbation · D4.4"),
        P("outcome", "Compare the prior period estimates with their subsequent outcome, and evaluate whether the difference indicates bias or a weakness in the method.", "Comparer les estimations de l'exercice précédent à leur dénouement et apprécier si l'écart révèle un biais ou une faiblesse de méthode.", "Prior financial statements · current period actuals · ISA 540 ¶14", "États financiers antérieurs · réalisations de l'exercice · ISA 540 ¶14"),
        P("uncertainty", "Evaluate for each estimate the degree of estimation uncertainty, and whether complexity, subjectivity or other inherent risk factors are present.", "Apprécier pour chaque estimation le degré d'incertitude et la présence de complexité, de subjectivité ou d'autres facteurs de risque inhérent.", "ISA 540 ¶16 · management's sensitivity analysis", "ISA 540 ¶16 · analyse de sensibilité de la direction"),
        P("approach", "Set the approach for each estimate: test management's process, develop our own point estimate or range, or use events up to the date of the report. Record which and why.", "Arrêter l'approche pour chaque estimation : tester le processus de la direction, développer notre propre estimation ou fourchette, ou utiliser les événements jusqu'à la date du rapport. Consigner le choix et son motif.", "ISA 540 ¶21–29 · E390", "ISA 540 ¶21–29 · E390"),
        P("expert", "Identify the estimates requiring an auditor's expert, and cross-refer to D4.7.", "Identifier les estimations requérant un expert de l'auditeur et renvoyer à D4.7.", "D4.7 · D6.1", "D4.7 · D6.1"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "complete", en: "The inventory covers every estimate in the financial statements, including those in the notes (procedure 1).", fr: "L'inventaire couvre chaque estimation des états financiers, y compris celles figurant en annexe (procédure 1)." },
        { key: "retrospective", en: "The retrospective review was performed and no indication of management bias was found (procedure 4).", fr: "La revue rétrospective a été effectuée et aucun indice de biais de la direction n'a été relevé (procédure 4)." },
        { key: "significant", en: "Every estimate with high estimation uncertainty has been recorded as a significant risk (procedure 5).", fr: "Chaque estimation à forte incertitude a été consignée comme risque important (procédure 5)." },
        { key: "approach", en: "An approach has been set for every estimate identified (procedure 6).", fr: "Une approche a été arrêtée pour chaque estimation identifiée (procédure 6)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- D7.2 --- */
const D7_2: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶28–34 · ISA 330 ¶5–15 · ISA 240",
  ownsEn: "the assessed risks and the planned response to each",
  ownsFr: "les risques évalués et la réponse prévue pour chacun",
  tools: ["what-can-go-wrong", "strategy"],
  reqEn: [
    "We identify and assess the risks of material misstatement at the financial statement level and at the assertion level for classes of transactions, account balances and disclosures (ISA 315 (Revised 2019) ¶28). Inherent risk and control risk are assessed separately (ISA 315 ¶34).",
    "We design and implement overall responses to the assessed risks at financial statement level, and further audit procedures whose nature, timing and extent are based on and responsive to the assessed risks at assertion level (ISA 330 ¶5–6). For every significant risk, substantive procedures include tests of details (ISA 330 ¶21).",
  ],
  reqFr: [
    "Nous identifions et évaluons les risques d'anomalies significatives au niveau des états financiers et des assertions (ISA 315 révisée ¶28). Le risque inhérent et le risque lié au contrôle sont évalués séparément (ISA 315 ¶34).",
    "Nous concevons des réponses globales et des procédures complémentaires dont la nature, le calendrier et l'étendue répondent aux risques évalués (ISA 330 ¶5–6). Pour chaque risque important, les procédures de substance comprennent des tests de détail (ISA 330 ¶21).",
  ],
  conclEn: [
    "Every assessed risk has a planned response recorded against it, and every significant risk has a test of details among its responses.",
    "The overall responses at financial statement level reflect the control environment conclusion in D4.5 and include an element of unpredictability.",
  ],
  conclFr: [
    "Chaque risque évalué dispose d'une réponse prévue, et chaque risque important comporte un test de détail parmi ses réponses.",
    "Les réponses globales reflètent la conclusion de D4.5 sur l'environnement de contrôle et comportent une part d'imprévisibilité.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("gather", "Bring together the risks identified in the earlier papers: the team discussion, the preliminary analytics, internal control, fraud, going concern, related parties and estimates.", "Rassembler les risques identifiés dans les feuilles précédentes : réunion d'équipe, analyses préliminaires, contrôle interne, fraude, continuité, parties liées et estimations.", "D7.1 · D4.3 · D4.4 · D5.4 · D5.5 · D5.6 · D5.7", "D7.1 · D4.3 · D4.4 · D5.4 · D5.5 · D5.6 · D5.7"),
        P("assertion", "For each significant class of transactions, balance and disclosure, identify what can go wrong and state the assertion affected.", "Pour chaque flux, solde et note significatifs, identifier ce qui peut mal tourner et préciser l'assertion concernée.", "Significant account analysis · what-can-go-wrong tool", "Analyse des comptes significatifs · outil des risques d'erreur"),
        P("separate", "Assess inherent risk and control risk separately for each risk identified, and record the basis for each assessment.", "Évaluer séparément le risque inhérent et le risque lié au contrôle pour chaque risque identifié et consigner le fondement de chaque appréciation.", "ISA 315 (Revised 2019) ¶34 · D4.4 · D4.5", "ISA 315 révisée ¶34 · D4.4 · D4.5"),
        P("significant", "Determine which risks are significant risks, having regard to the inherent risk factors and where the risk sits on the spectrum of inherent risk.", "Déterminer quels risques sont des risques importants, au regard des facteurs de risque inhérent et de leur position sur le spectre.", "ISA 315 (Revised 2019) ¶32 · D5.4 · D5.6 · D5.7", "ISA 315 révisée ¶32 · D5.4 · D5.6 · D5.7"),
        P("fs_level", "Identify the risks at financial statement level and set the overall responses, including team composition, supervision, and an element of unpredictability.", "Identifier les risques au niveau des états financiers et arrêter les réponses globales : composition de l'équipe, supervision et part d'imprévisibilité.", "ISA 330 ¶5 · ISA 240 ¶29 · D4.5", "ISA 330 ¶5 · ISA 240 ¶29 · D4.5"),
        P("strategy", "Set the strategy for each assertion-level risk: controls reliance or fully substantive, and record why. A controls-reliance strategy requires tests of operating effectiveness.", "Arrêter la stratégie pour chaque risque au niveau des assertions : appui sur les contrôles ou approche substantive, avec les motifs. L'appui sur les contrôles impose des tests d'efficacité.", "ISA 330 ¶8 · D4.4 · E500/E510", "ISA 330 ¶8 · D4.4 · E500/E510"),
        P("details", "For every significant risk, plan substantive procedures that include tests of details.", "Pour chaque risque important, prévoir des procédures de substance comprenant des tests de détail.", "ISA 330 ¶21 · execution programme", "ISA 330 ¶21 · programme d'exécution"),
      ],
    },
    {
      kind: "fields",
      titleEn: "Part B — Register",
      titleFr: "Partie B — Registre",
      fields: [
        { key: "register", kind: "auto", labelEn: "Assertion-level risks and the strategy set against each", labelFr: "Risques par assertion et stratégie retenue", source: "strategy" },
        { key: "fs_level", kind: "input", labelEn: "Financial statement level risks and the overall responses, including the unpredictability element", labelFr: "Risques au niveau des états financiers et réponses globales, dont la part d'imprévisibilité" },
        { key: "separate", kind: "input", labelEn: "Where inherent risk and control risk were assessed differently, the reasons", labelFr: "Motifs lorsque le risque inhérent et le risque lié au contrôle diffèrent" },
        { key: "revisions", kind: "input", labelEn: "Revisions to the assessment during execution, and the effect on the procedures already performed", labelFr: "Révisions de l'évaluation en cours d'exécution et effet sur les procédures déjà réalisées" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part C — Evaluation",
      titleFr: "Partie C — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "assertions", en: "Every risk in the register names the account and the assertion it affects (procedure 2).", fr: "Chaque risque du registre nomme le compte et l'assertion concernés (procédure 2)." },
        { key: "separately", en: "Inherent risk and control risk have been assessed separately (procedure 3).", fr: "Le risque inhérent et le risque lié au contrôle ont été évalués séparément (procédure 3)." },
        { key: "reliance", en: "Where a controls-reliance strategy is set, tests of operating effectiveness are planned (procedure 6).", fr: "Lorsqu'une stratégie d'appui sur les contrôles est retenue, des tests d'efficacité sont prévus (procédure 6).", na: true },
        { key: "details", en: "Every significant risk has a test of details among its planned responses (procedure 7).", fr: "Chaque risque important comporte un test de détail parmi les réponses prévues (procédure 7)." },
        { key: "unpredictable", en: "An element of unpredictability is built into the planned procedures (procedure 5).", fr: "Une part d'imprévisibilité est intégrée aux procédures prévues (procédure 5)." },
      ],
    },
  ],
};

/* -------------------------------------------------------------- D4.2 ----- */
const D4_2: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶19(a)–(c), ¶22",
  ownsEn: "the understanding of the entity, its environment and the framework",
  ownsFr: "la connaissance de l'entité, de son environnement et du référentiel",
  reqEn: [
    "We obtain an understanding of the entity's organisational structure, ownership and governance, its business model, the industry, regulatory and other external factors, and the applicable financial reporting framework and the entity's accounting policies (ISA 315 (Revised 2019) ¶19).",
    "The understanding is obtained to identify risks, not for its own sake. Each matter recorded is either carried into the risk assessment or noted as giving rise to no risk (ISA 315 ¶31: the evaluation of whether the understanding provides an appropriate basis).",
    "Risk assessment procedures combine inquiries of management and others, analytical procedures, and observation and inspection — inquiry alone is not enough (ISA 315 ¶14). The engagement team discussion (D7.1) shares what each member knows about the entity.",
    "The business model and the measures management uses to assess performance deserve particular attention: they show where the pressure to misstate can arise and which balances carry estimation or judgement (ISA 315 ¶A62–A67).",
  ],
  reqFr: [
    "Nous prenons connaissance de la structure, de l'actionnariat et de la gouvernance de l'entité, de son modèle économique, des facteurs externes, du référentiel applicable et de ses méthodes comptables (ISA 315 révisée ¶19).",
    "Cette connaissance sert à identifier des risques. Chaque élément consigné est soit repris dans l'évaluation des risques, soit noté comme n'en générant aucun (ISA 315 ¶31).",
    "Les procédures d'évaluation des risques combinent entretiens, procédures analytiques, observation et inspection — l'entretien seul ne suffit pas (ISA 315 ¶14). La discussion d'équipe (D7.1) partage la connaissance de chacun.",
    "Le modèle économique et les indicateurs de performance de la direction méritent une attention particulière : ils révèlent où naît la pression d'altérer les comptes et quels soldes portent estimation ou jugement (ISA 315 ¶A62–A67).",
  ],
  conclEn: [
    "The understanding obtained is sufficient to identify and assess the risks of material misstatement, and each matter identified has been carried into the risk assessment or recorded as giving rise to no risk.",
  ],
  conclFr: [
    "La connaissance acquise suffit à identifier et évaluer les risques d'anomalies significatives, et chaque élément relevé est repris dans l'évaluation des risques ou consigné comme n'en générant aucun.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("model", "Obtain the entity's business model: what it sells, to whom, through which channels, and how it earns and collects.", "Obtenir le modèle économique : ce que l'entité vend, à qui, par quels canaux, et comment elle facture et encaisse.", "Inquiry of management · management reports · site visit", "Entretien avec la direction · rapports de gestion · visite de site",
          "Sit with the general manager or sales director and have them walk you through one sale end-to-end: order, delivery, invoice, collection. Ask for the latest management report and note the main product lines, the five largest customers and how customers pay (cash, credit, mobile money). A short site visit tells you more than an organigram.",
          "S'asseoir avec le dirigeant ou le directeur commercial et suivre une vente de bout en bout : commande, livraison, facture, encaissement. Demander le dernier rapport de gestion, relever les lignes de produits, les cinq plus gros clients et les modes de paiement. Une courte visite de site en dit plus qu'un organigramme."),
        P("structure", "Obtain the ownership, the group structure and the governance arrangements, including the composition of the board.", "Obtenir l'actionnariat, la structure du groupe et les organes de gouvernance, dont la composition du conseil.", "Statutes · share register · RCCM extract · minutes", "Statuts · registre des titres · extrait RCCM · procès-verbaux",
          "Read the minutes of the last board and shareholders' meetings, inspect the share register, and pull a fresh RCCM extract. Meet the entity's legal representative (or counsel) to confirm who actually controls decisions — related parties often surface here first.",
          "Lire les procès-verbaux du dernier conseil et de la dernière assemblée, consulter le registre des titres et un extrait RCCM récent. Rencontrer le représentant légal (ou le conseil juridique) pour confirmer qui contrôle réellement les décisions — les parties liées apparaissent souvent ici en premier."),
        P("external", "Identify the industry, regulatory and other external factors affecting the entity, including the sector's competitive conditions and any recent change in law.", "Identifier les facteurs sectoriels, réglementaires et externes affectant l'entité, dont les conditions de concurrence et les évolutions législatives récentes.", "Sector publications · regulator guidance · firm sector knowledge", "Publications sectorielles · doctrine du régulateur · connaissance sectorielle",
          "Ask management which regulator, tax regime and sector body govern them, and what changed this year (tariffs, exchange controls, minimum wage, sector price rules). Cross-check against the firm's knowledge of other clients in the same sector and any finance-law changes affecting the period.",
          "Demander à la direction quels régulateur, régime fiscal et organismes sectoriels s'appliquent, et ce qui a changé cette année (tarifs, contrôle des changes, SMIG, prix réglementés). Recouper avec la connaissance du cabinet sur le secteur et les changements de loi de finances de l'exercice."),
        P("framework", "Establish the applicable financial reporting framework and the entity's accounting policies, and evaluate whether the policies are appropriate to its business.", "Établir le référentiel comptable applicable et les méthodes comptables, et apprécier leur pertinence au regard de l'activité.", "Prior financial statements · policy note · SYSCOHADA / IFRS", "États financiers antérieurs · note de méthodes · SYSCOHADA / IFRS",
          "Read the notes to the prior financial statements — the accounting-policies note is the quickest map of what the entity applies. Test two or three policies against what the business actually does (revenue timing vs. delivery terms, depreciation lives vs. asset use).",
          "Lire l'annexe des états financiers antérieurs — la note sur les méthodes comptables est la carte la plus rapide. Confronter deux ou trois méthodes à la réalité de l'activité (fait générateur du chiffre d'affaires vs conditions de livraison, durées d'amortissement vs usage des actifs)."),
        P("changes", "Identify the changes in accounting policy, in the business or in the environment since the prior period, and the reason for each.", "Identifier les changements de méthode, d'activité ou d'environnement depuis l'exercice précédent et leur motif.", "Inquiry of management · prior file · minutes", "Entretien avec la direction · dossier antérieur · procès-verbaux",
          "Compare this year's accounting-policies note with last year's, line by line. Ask the finance manager for any accounting memos issued in the year and read board minutes for new activities, financing or restructurings. Every difference needs a reason recorded.",
          "Comparer la note de méthodes de cette année à celle de l'an dernier, ligne à ligne. Demander au responsable financier les mémos comptables émis dans l'année et lire les procès-verbaux pour les nouvelles activités, financements ou restructurations. Chaque écart doit avoir un motif consigné."),
        P("measures", "Obtain the measures management uses to assess performance, and identify the pressure they may create to misstate.", "Obtenir les indicateurs utilisés par la direction pour apprécier la performance et identifier la pression qu'ils peuvent créer.", "Management reports · bonus arrangements · budget", "Rapports de gestion · dispositifs de primes · budget",
          "Get the budget and the monthly reporting pack, and ask what the owners or lenders watch (margin, covenant ratios, dividend capacity). Ask HR or the manager how bonuses are computed — a target tied to a number is pressure on that number.",
          "Obtenir le budget et le reporting mensuel, et demander ce que suivent actionnaires ou prêteurs (marge, covenants, capacité de dividende). Demander aux RH ou au dirigeant comment se calculent les primes — un objectif adossé à un chiffre crée une pression sur ce chiffre."),
        P("objectives", "Obtain the entity's objectives and strategies, and identify the business risks that may result in a risk of material misstatement.", "Obtenir les objectifs et les stratégies de l'entité, et identifier les risques liés à l'activité pouvant engendrer un risque d'anomalie significative.", "Business plan · board minutes · financing agreements", "Plan d'affaires · procès-verbaux du conseil · conventions de financement",
          "Ask the owner or general manager what the entity is trying to achieve over the next two or three years — growth, a new line, new financing, succession — and what could stop it. Each strategy carries risks: expansion strains working capital and cut-off, new financing brings covenants, a planned sale creates pressure on the numbers. Write the objective, the risk it creates, and the account it lands on.",
          "Demander au propriétaire ou au dirigeant ce que l'entité veut atteindre d'ici deux ou trois ans — croissance, nouvelle activité, financement, transmission — et ce qui pourrait l'en empêcher. Chaque stratégie porte ses risques : l'expansion tend le besoin en fonds de roulement et la séparation des exercices, un financement apporte des covenants, une cession en vue crée une pression sur les chiffres. Noter l'objectif, le risque créé et le compte concerné."),
        P("related", "Obtain the list of related parties and the nature of the relationships and transactions with each, and carry it forward to D5.7.", "Obtenir la liste des parties liées, la nature des relations et des opérations avec chacune, et la reporter en D5.7.", "Inquiry of management · share register · board minutes · D5.7", "Entretien avec la direction · registre des titres · procès-verbaux · D5.7",
          "Build the list while you are already holding the share register and the minutes from procedure 2: shareholders and their other companies, directors and their businesses, family members in the entity, group companies. Ask management to confirm it is complete and to describe the transactions with each — loans to shareholders and management fees are where OHADA audits find them.",
          "Établir la liste pendant que le registre des titres et les procès-verbaux de la procédure 2 sont encore sous la main : actionnaires et leurs autres sociétés, dirigeants et leurs affaires, membres de la famille dans l'entité, sociétés du groupe. Faire confirmer par la direction que la liste est complète et décrire les opérations avec chacune — comptes courants d'associés et frais de gestion sont là où les audits OHADA les trouvent."),
        P("gc_status", "Obtain the status of management's assessment of the entity's ability to continue as a going concern, and note the events or conditions already known.", "Obtenir l'état de l'évaluation par la direction de la capacité de l'entité à poursuivre son exploitation, et relever les événements ou circonstances déjà connus.", "Inquiry of management · cash-flow forecast · D5.5", "Entretien avec la direction · prévision de trésorerie · D5.5",
          "Ask management whether they have assessed going concern and over what period, and whether a forecast exists. Note what is already visible: negative equity (and any AGM decision under the OHADA net-asset rule), overdue tax or social liabilities, a lost customer or financing due for renewal. The full assessment is D5.5's work — here you record its status and the known warning signs.",
          "Demander à la direction si elle a évalué la continuité d'exploitation, sur quelle période, et si une prévision existe. Relever ce qui est déjà visible : capitaux propres négatifs (et toute décision d'AG au titre de la règle OHADA de l'actif net), dettes fiscales ou sociales en retard, client perdu ou financement à renouveler. L'évaluation complète relève de D5.5 — ici on consigne son état et les signaux connus."),
        P("carry", "Carry each matter identified into the risk register, or record why it gives rise to no risk of material misstatement.", "Reporter chaque élément relevé au registre des risques ou consigner pourquoi il ne génère aucun risque d'anomalie significative.", "D7.2 risk register", "Registre des risques D7.2",
          "Work through your notes from procedures 1–6 one by one: open the risk register (Tools → Risk Register) and either add a risk with the assertion it threatens, or write one line here explaining why no risk arises. Nothing identified stays unrouted.",
          "Reprendre les notes des procédures 1 à 6 une à une : ouvrir le registre des risques (Outils → Registre) et soit ajouter un risque avec l'assertion menacée, soit consigner ici pourquoi aucun risque n'en découle. Aucun élément relevé ne reste sans suite."),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "policies", en: "The accounting policies are appropriate to the entity's business and consistent with the framework (procedure 4).", fr: "Les méthodes comptables sont appropriées à l'activité et conformes au référentiel (procédure 4)." },
        { key: "objectives", en: "The entity's objectives and strategies have been understood, and the business risks they create have been assessed for their effect on the financial statements (procedure 7).", fr: "Les objectifs et stratégies de l'entité ont été compris, et les risques liés à l'activité qu'ils créent ont été appréciés quant à leur incidence sur les états financiers (procédure 7)." },
        { key: "related_gc", en: "The related-party list has been carried to D5.7, and the status of management's going-concern assessment recorded for D5.5 (procedures 8, 9).", fr: "La liste des parties liées a été reportée en D5.7, et l'état de l'évaluation de la continuité d'exploitation consigné pour D5.5 (procédures 8, 9)." },
        { key: "changes", en: "Each change since the prior period has been understood and its accounting effect identified (procedure 5).", fr: "Chaque changement depuis l'exercice précédent est compris et son effet comptable identifié (procédure 5)." },
        { key: "carried", en: "Each matter identified has been carried into the risk register or explained (procedure 7).", fr: "Chaque élément relevé est repris au registre des risques ou justifié (procédure 7)." },
      ],
    },
  ],
};

export const STRATEGY_PAPERS: Record<string, PaperDef> = {
  D1,
  "D4.1": D4_1,
  "D7.1": D7_1,
  "D4.2": D4_2,
  "D4.3": D4_3,
  "D4.4": D4_4,
  "D4.5": D4_5,
  "D4.6": D4_6,
  "D4.7": D4_7,
  "D4.8": D4_8,
  "D4.9": D4_9,
  "D5.1": D5_1,
  "D5.2": D5_2,
  "D5.4": D5_4,
  "D5.5": D5_5,
  "D5.6": D5_6,
  "D5.7": D5_7,
  "D7.2": D7_2,
};
