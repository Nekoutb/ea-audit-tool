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

export const PROC_INTRO_EN =
  "Perform each procedure and record the result, stating what was obtained, from whom or from which source, and the reference of the evidence filed.";
export const PROC_INTRO_FR =
  "Mettre en œuvre chaque procédure et consigner le résultat : ce qui a été obtenu, auprès de qui ou de quelle source, et la référence du dossier.";
export const YN_INTRO_EN =
  "Evaluate the results of the Part A procedures against each statement. Explain each “No” in the box beneath it.";
export const YN_INTRO_FR =
  "Évaluer les résultats de la partie A au regard de chaque affirmation. Expliquer chaque « Non » dans la zone prévue.";

/* ------------------------------------------------------------------ S6.1 --- */
const S5_1: PaperDef = {
  std: "ISA 300 ¶7–9 · ISA 320 ¶10",
  tools: ["materiality", "strategy"],
  ownsEn: "the engagement strategy and the scale of the work",
  ownsFr: "la stratégie de mission et le dimensionnement des travaux",
  reqEn: [
    "The overall audit strategy sets the scope, timing and direction of the audit, and guides the development of the audit plan (ISA 300 ¶7). It records the characteristics that define the scope, the reporting objectives and the timing of communications, and the factors that in our professional judgement are significant in directing the team.",
    "The strategy also records the resources to deploy, including which team members are assigned to which areas and how much time is budgeted for the areas of higher assessed risk (ISA 300 ¶8).",
    "The memorandum is where scope, timing and direction meet the numbers: it carries materiality for the financial statements as a whole and performance materiality (ISA 320 ¶10-11), the significant risks the plan must answer, the areas where the strategy relies on controls and those that stay wholly substantive, and the preliminary view of the nature, timing and extent of resources (ISA 300 ¶7-8). It also names the others whose work the audit will use — an auditor's expert, internal audit, component auditors, a service organisation's report — so their timing enters the timetable rather than the contingency.",
    "The strategy commissions the audit plan: the plan converts it into the nature, timing and extent of the planned risk assessment procedures and of the further audit procedures at assertion level, including the general programme of substantive procedures the execution sections will carry out (ISA 300 ¶9). Neither document is frozen at planning — update both when a revised risk assessment or an unexpected result changes the approach, and record the significant changes with their reasons (ISA 300 ¶10 and ¶12). The direction, supervision and review the strategy implies are planned alongside it in S6.2 (ISA 300 ¶11).",
  ],
  reqFr: [
    "La stratégie générale d'audit définit l'étendue, le calendrier et l'orientation de la mission (ISA 300 ¶7).",
    "Elle consigne aussi les ressources à déployer, l'affectation des membres de l'équipe et le temps budgété sur les zones de risque élevé (ISA 300 ¶8).",
    "Le mémorandum est le lieu où l'étendue, le calendrier et la direction rencontrent les chiffres : il porte le seuil de signification pour les états financiers pris dans leur ensemble et le seuil applicable à la réalisation des travaux (ISA 320 ¶10-11), les risques significatifs auxquels le plan devra répondre, les zones où la stratégie s'appuie sur les contrôles et celles qui restent entièrement corroboratives, ainsi que la vue préliminaire de la nature, du calendrier et de l'étendue des ressources (ISA 300 ¶7-8). Il nomme aussi les tiers dont les travaux seront utilisés — expert désigné par l'auditeur, audit interne, auditeurs de composants, rapport d'une société de services — afin que leurs délais entrent dans le calendrier plutôt que dans les imprévus.",
    "La stratégie générale commande le plan de mission : celui-ci la traduit en nature, calendrier et étendue des procédures d'évaluation des risques et des procédures d'audit complémentaires au niveau des assertions, y compris le programme général de procédures de corroboration que les sections d'exécution dérouleront (ISA 300 ¶9). Aucun des deux documents n'est figé à la planification — mettre à jour l'un et l'autre quand une évaluation des risques révisée ou un résultat inattendu change l'approche, et consigner les modifications importantes avec leurs raisons (ISA 300 ¶10 et ¶12). La direction, la supervision et la revue qu'implique la stratégie se planifient à ses côtés en S6.2 (ISA 300 ¶11).",
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
        P("scope", "Establish the characteristics that define the scope: the financial reporting framework, the reporting entity, the locations and any component to be covered.", "Établir les caractéristiques définissant l'étendue : référentiel comptable, entité présentant les comptes, implantations et composants à couvrir.", "Engagement letter (P1.4) · statutes · prior file", "Lettre de mission (P1.4) · statuts · dossier antérieur", "Open the statuts, the RCCM extract and the P1.4 engagement letter side by side and fix the basics in writing: SYSCOHADA révisé as the framework, the legal entity, every agency or depot it operates, and any subsidiary that turns this into a group file. A scope surprise found in March costs the deadline; found now, it costs a paragraph.", "Ouvrir côte à côte les statuts, l'extrait RCCM et la lettre de mission P1.4 et fixer les bases par écrit : le SYSCOHADA révisé comme référentiel, l'entité juridique, chaque agence ou dépôt exploité, et toute filiale qui transforme le dossier en dossier de groupe. Une surprise de périmètre découverte en mars coûte l'échéance ; découverte maintenant, elle coûte un paragraphe."),
        P("reporting", "Establish the reporting objectives and the deadlines, including the statutory report, the general meeting date and any regulator filing.", "Établir les objectifs de reporting et les échéances, y compris le rapport statutaire, la date d'assemblée générale et tout dépôt réglementaire.", "Statutes · OHADA Uniform Act · client timetable", "Statuts · Acte uniforme OHADA · calendrier du client", "Count backwards from the assemblée générale ordinaire — the Uniform Act requires it within six months of year-end — and from the DSF filing date with the tax administration. Fix three dates in the timetable: report signature, file closure, end of fieldwork; when one slips, the other two must move with it.", "Compter à rebours depuis l'assemblée générale ordinaire — l'Acte uniforme l'exige dans les six mois de la clôture — et depuis la date de dépôt de la DSF auprès de l'administration fiscale. Fixer trois dates au calendrier : signature du rapport, clôture du dossier, fin des travaux sur place ; si l'une glisse, les deux autres bougent avec elle."),
        P("comms", "Agree the timing and form of communications with management and those charged with governance.", "Convenir du calendrier et de la forme des communications avec la direction et les responsables de la gouvernance.", "Engagement letter · discussion with the entity", "Lettre de mission · échange avec l'entité", "Book dates, not intentions: the planning meeting with the directeur général, the planning communication to those charged with governance, and the closing meeting where findings are tabled. Agree the form as well — a conseil d'administration expects a letter; a single gérant may only need a documented meeting note.", "Fixer des dates, pas des intentions : la réunion de planification avec le directeur général, la communication de planification aux personnes constituant le gouvernement d'entreprise, et la réunion de clôture où les constats sont présentés. Convenir aussi de la forme — un conseil d'administration attend une lettre ; un gérant unique peut se contenter d'un compte rendu de réunion documenté."),
        P("factors", "Identify the factors that in our judgement are significant in directing the team's effort, including the preliminary materiality and the areas of expected higher risk.", "Identifier les facteurs qui, selon notre jugement, orientent l'effort de l'équipe, dont le seuil préliminaire et les zones de risque attendu élevé.", "Prior file · P6.1 · preliminary analytics (P3.2)", "Dossier antérieur · P6.1 · analyse préliminaire (P3.2)", "Run the P3.2 preliminary analytics against last year's balance and list what moved: a new bank loan, a margin that jumped, a stock figure that doubled. Add the entity-level facts — a change of chef comptable, a vérification fiscale in progress, a major customer lost — and let those, with preliminary materiality, name the areas the memorandum sends the team to first.", "Passer les procédures analytiques préliminaires P3.2 sur la balance de l'exercice précédent et lister ce qui a bougé : un nouvel emprunt bancaire, une marge qui saute, un stock qui double. Ajouter les faits propres à l'entité — changement de chef comptable, vérification fiscale en cours, perte d'un client majeur — et laisser ces éléments, avec le seuil de signification préliminaire, désigner les zones où le mémorandum envoie l'équipe en premier."),
        P("resources", "Allocate the team to areas and set the time budget, weighting the areas of higher assessed risk.", "Affecter l'équipe aux différentes zones et arrêter le budget-temps, en pondérant les zones de risque évalué élevé.", "Team page · budget · P2.2", "Page Équipe · budget · P2.2", "Budget in hours per area, not days per person: give the risk-heavy sections — revenue, inventory, the accounts flagged in P6.1 — the senior's hours and push routine sections to assistants. Compare the total with last year's actual time before committing; a budget copied from a year that overran is planning to overrun again.", "Budgéter en heures par section, pas en jours par personne : donner aux zones à risque — ventes, stocks, comptes signalés en P6.1 — les heures du chef de mission et confier les sections routinières aux assistants. Comparer le total au temps réel de l'exercice précédent avant de s'engager ; un budget copié d'un exercice dépassé programme un nouveau dépassement."),
        P("prior", "Read the prior period file for matters carried forward, including points forward, unadjusted misstatements and any modification to the report.", "Examiner le dossier de l'exercice précédent : points reportés, anomalies non corrigées et toute modification du rapport.", "Prior file · C6.1 points forward · prior auditor's report", "Dossier antérieur · C6.1 points reportés · rapport antérieur", "Read three things in the prior file before drafting: the C6.1 points forward, the summary of unadjusted misstatements, and the prior auditor's report for any modification or emphasis. Whatever qualified last year's opinion is a scoped and budgeted area this year, not a discovery waiting to be repeated at final.", "Lire trois choses dans le dossier de l'exercice précédent avant de rédiger : les points reportés C6.1, l'état des anomalies non corrigées et le rapport du commissaire aux comptes pour toute réserve ou observation. Ce qui a motivé une réserve l'an dernier est cette année une zone cadrée et budgétée, pas une découverte à refaire au final."),
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
        { key: "context", kind: "auto", source: "materiality", labelEn: "From the tools: approved materiality and the live risk register", labelFr: "Depuis les outils : seuil approuvé et registre des risques" },
        { key: "direction", kind: "input", labelEn: "The direction set for the team, in short: what this audit turns on", labelFr: "Orientation donnée à l'équipe : ce sur quoi repose cette mission" },
        { key: "changes", kind: "input", labelEn: "Changes to the strategy during the engagement, and what prompted each", labelFr: "Modifications de la stratégie en cours de mission et leur motif" },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- S6.2 --- */
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
        P("brief", "Hold the engagement partner's briefing with the team. Record the date, who attended and the direction given.", "Tenir la réunion de cadrage de l'associé avec l'équipe. Consigner la date, les participants et les instructions données.", "Meeting note · team page", "Note de réunion · page Équipe", "Hold the briefing once the risk material is on the table, so the partner directs on real risks rather than generalities. Keep the note short but named: date, attendees, and the two or three messages the partner insisted on — sensitive estimates, scepticism points, dates that will not move.", "Tenir le briefing une fois les éléments de risque sur la table, pour que l'associé oriente sur des risques réels et non des généralités. Garder une note courte mais nominative : date, participants, et les deux ou trois messages sur lesquels l'associé a insisté — estimations sensibles, points d'esprit critique, dates non négociables."),
        P("areas", "Identify the areas the engagement partner will review personally, including every significant judgement and every significant risk.", "Identifier les zones que l'associé revoira personnellement, dont chaque jugement important et chaque risque important.", "S3.1 risk register · P5.1 · S4.4", "Registre des risques S3.1 · P5.1 · S4.4", "Build the list from the S3.1 risk register and P5.1, not from memory: every significant risk and every significant judgement — going concern, provisions, revenue estimates — plus the sections the fraud response touches. Put the working-paper reference beside each item so the partner's review is a checklist, not an ambition.", "Construire la liste depuis le registre des risques S3.1 et P5.1, pas de mémoire : chaque risque significatif et chaque jugement significatif — continuité d'exploitation, provisions, estimations de revenus — plus les sections touchées par la réponse au risque de fraude. Mettre la référence de feuille de travail en face de chaque point pour que la revue de l'associé soit une liste de contrôle, pas une ambition."),
        P("supervision", "Set the level of supervision for each team member against their competence and the difficulty of the work assigned.", "Fixer le niveau de supervision de chaque membre au regard de sa compétence et de la difficulté des travaux confiés.", "Team page grades · P2.2", "Grades de la page Équipe · P2.2", "Grade supervision by the pairing of task and person, not the person alone: a first-year assistant on bank confirmations needs a day-end debrief; the same assistant attending a stock count at a remote depot needs the senior reachable during the count. Write the review frequency next to each name on the P2.2 team plan.", "Doser la supervision selon le binôme tâche-personne, pas la personne seule : un assistant de première année sur les confirmations bancaires a besoin d'un point en fin de journée ; le même assistant à un inventaire physique dans un dépôt éloigné doit pouvoir joindre le chef de mission pendant le comptage. Écrire la fréquence de revue à côté de chaque nom sur le plan d'équipe P2.2."),
        P("consult", "Identify the matters on which consultation is expected, and who will be consulted.", "Identifier les points appelant une consultation et les personnes à consulter.", "Firm consultation policy · C1.3", "Politique de consultation du cabinet · C1.3", "Flag now the questions the firm's policy says must leave the engagement team: a going-concern doubt, a suspected fraud, a contested tax reassessment, a possible modification of the opinion. Name the person or technical desk to consult and open the C1.3 record before the issue turns hot, not after.", "Repérer dès maintenant les questions que la politique du cabinet fait sortir de l'équipe : un doute sur la continuité d'exploitation, un soupçon de fraude, un redressement fiscal contesté, une possible modification de l'opinion. Nommer la personne ou le service technique à consulter et ouvrir la fiche C1.3 avant que le sujet ne devienne brûlant, pas après."),
        P("review", "Record the review points during the engagement, and confirm the report will not be dated before the partner's review is complete.", "Consigner les points de revue prévus et confirmer que le rapport ne sera pas daté avant l'achèvement de la revue de l'associé.", "Timetable · ISA 220 (Revised) ¶31", "Calendrier · ISA 220 révisée ¶31", "Enter the partner's review dates in the timetable as milestones with the same weight as fieldwork: interim review, pre-final review of the significant areas, final review before the report date. Check the report date falls after the last sign-off and, where P1.5 requires an engagement quality review, after that reviewer's completion too.", "Inscrire les dates de revue de l'associé au calendrier comme des jalons du même poids que les travaux sur place : revue intérimaire, revue pré-finale des zones significatives, revue finale avant la date du rapport. Vérifier que la date du rapport tombe après la dernière signature et, quand P1.5 impose une revue de la qualité de la mission, après l'achèvement de cette revue également."),
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
        { key: "eqr", en: "Where an engagement quality review is required under P1.5, its timing is built into the review plan (procedure 5).", fr: "Lorsqu'une revue de qualité est requise (P1.5), son calendrier est intégré au plan de revue (procédure 5).", na: true },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- P5.2 --- */
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
        P("framework", "Discuss how the applicable financial reporting framework applies to the entity's facts, and where its application calls for judgement.", "Examiner l'application du référentiel comptable aux faits de l'entité et les points appelant un jugement.", "P3.1 · accounting policies · prior file", "P3.1 · méthodes comptables · dossier antérieur"),
        P("fraud", "Exchange ideas on how and where the financial statements may be susceptible to material misstatement due to fraud, including the manner in which assets could be misappropriated.", "Échanger sur les modalités et les zones possibles d'anomalies résultant de fraude, y compris le détournement d'actifs.", "ISA 240 ¶16 · P5.1 · prior findings", "ISA 240 ¶16 · P5.1 · constats antérieurs"),
        P("override", "Discuss how management could override controls, and the accounting entries that would be used.", "Examiner comment la direction pourrait contourner les contrôles et les écritures qui seraient utilisées.", "ISA 240 ¶31 · E3.1", "ISA 240 ¶31 · E3.1"),
        P("absent", "Determine what is to be communicated to team members who did not attend, and record that it was done.", "Déterminer ce qui doit être communiqué aux membres absents et consigner que cela a été fait.", "Team page · circulated note", "Page Équipe · note diffusée"),
        P("carry", "Carry each matter raised into the risk register, or record why it does not give rise to an assessed risk.", "Reporter chaque point soulevé dans le registre des risques, ou consigner pourquoi il ne donne pas lieu à un risque évalué.", "S3.1 risk register", "Registre des risques S3.1"),
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

/* ---------------------------------------------------------------- P3.2 --- */
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
        P("carry", "Carry each indicator into the risk register, identifying the account and the assertion affected.", "Reporter chaque indice au registre des risques, en identifiant le compte et l'assertion concernés.", "S3.1 risk register", "Registre des risques S3.1"),
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

/* ---------------------------------------------------------------- P4.1 --- */
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
        P("monitoring", "Obtain the process the entity uses to monitor the system of internal control, including any internal audit function and how deficiencies are remediated.", "Obtenir le processus de suivi du contrôle interne, y compris l'audit interne le cas échéant et le traitement des déficiences.", "Inquiry · internal audit reports (S5.3) · remediation log", "Entretien · rapports d'audit interne (S5.3) · suivi des corrections"),
        P("info_system", "Obtain the information system relevant to financial reporting: how transactions are initiated, recorded, processed and reported, and how the financial statements are prepared including consolidation and closing entries.", "Obtenir le système d'information pertinent : initiation, enregistrement, traitement et restitution des opérations, et établissement des états financiers y compris consolidation et écritures de clôture.", "Process narratives · chart of accounts · closing timetable", "Descriptifs de processus · plan de comptes · calendrier de clôture"),
        P("activities", "Identify the control activities that address the risks of material misstatement at assertion level, including the controls over journal entries.", "Identifier les activités de contrôle répondant aux risques au niveau des assertions, y compris les contrôles sur les écritures.", "Process narratives · control matrix · E3.1", "Descriptifs de processus · matrice de contrôles · E3.1"),
        P("design", "Evaluate whether each identified control is designed to prevent, or to detect and correct, the misstatement it addresses.", "Apprécier si chaque contrôle identifié est conçu pour prévenir, ou détecter et corriger, l'anomalie visée.", "Control descriptions · inquiry of the control owner", "Descriptions des contrôles · entretien avec le responsable du contrôle"),
        P("implemented", "Determine whether each identified control has been implemented, using observation, inspection of evidence of its operation, or a walkthrough. Inquiry alone is not sufficient.", "Déterminer si chaque contrôle identifié est mis en œuvre, par observation, examen de preuves de son fonctionnement ou test de cheminement. L'entretien seul ne suffit pas.", "Observation · inspection of a sample document · walkthrough note", "Observation · examen d'un document · note de cheminement"),
        P("deficiencies", "Record each deficiency identified, and evaluate whether alone or with others it is a significant deficiency to be communicated.", "Consigner chaque déficience relevée et apprécier si, seule ou combinée, elle constitue une déficience significative à communiquer.", "ISA 265 ¶8–9 · C4.2 · management letter", "ISA 265 ¶8–9 · C4.2 · lettre de recommandations"),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "all_components", en: "Each of the five components has been understood and recorded (procedures 1 to 4, with the control environment in P4.2).", fr: "Chacune des cinq composantes a été comprise et consignée (procédures 1 à 4, l'environnement de contrôle en P4.2)." },
        { key: "not_inquiry", en: "Implementation was determined by procedures other than inquiry alone (procedure 6).", fr: "La mise en œuvre a été déterminée par des procédures ne se limitant pas à l'entretien (procédure 6)." },
        { key: "journals", en: "The controls over journal entries and other adjustments have been identified (procedure 4).", fr: "Les contrôles sur les écritures et autres ajustements ont été identifiés (procédure 4)." },
        { key: "communicated", en: "Each significant deficiency has been recorded for communication to those charged with governance (procedure 7).", fr: "Chaque déficience significative est consignée en vue de sa communication au gouvernement d'entreprise (procédure 7).", na: true },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- P4.2 --- */
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
    "The conclusion above has been reflected in the overall responses at financial statement level recorded in S3.1.",
  ],
  conclFr: [
    "L'environnement de contrôle constitue un socle approprié pour les autres composantes du contrôle interne.",
    "Cette conclusion est reprise dans les réponses globales au niveau des états financiers consignées en S3.1.",
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
        P("oversight", "Evaluate the oversight exercised by those charged with governance: how often they meet, what they examine and whether they are independent of management.", "Apprécier la surveillance exercée par les responsables de la gouvernance : fréquence des réunions, sujets examinés et indépendance vis-à-vis de la direction.", "Board and committee minutes (E6.4) · statutes", "Procès-verbaux du conseil et des comités (E6.4) · statuts"),
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

/* ---------------------------------------------------------------- P4.3 --- */
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
        P("outsourced", "Identify the parts of the IT environment operated by a third party, and cross-refer to S5.2 for the service organisation.", "Identifier les parties de l'environnement informatique exploitées par un tiers et renvoyer à S5.2 pour l'organisme de services.", "Contracts · S5.2 · inquiry of IT", "Contrats · S5.2 · entretien informatique"),
        P("risks", "Identify the risks arising from the use of IT for each in-scope application: unauthorised access, unauthorised change, inappropriate direct data change, and reliance on inaccurate processing.", "Identifier les risques liés à l'informatique pour chaque application du périmètre : accès non autorisé, modification non autorisée, modification directe des données et traitement inexact.", "Inquiry of IT · incident log · prior file", "Entretien informatique · journal des incidents · dossier antérieur"),
        P("itgc", "Identify the general IT controls that address each risk: access management, change management, and IT operations.", "Identifier les contrôles informatiques généraux répondant à chaque risque : gestion des accès, gestion des changements et exploitation.", "IT policies · access lists · change log", "Politiques informatiques · listes d'accès · journal des changements"),
        P("ipe", "Identify the reports produced by the system that we intend to use as audit evidence, and record how their accuracy and completeness will be established.", "Identifier les états produits par le système que nous entendons utiliser comme éléments probants et consigner comment leur exactitude et exhaustivité seront établies.", "Report inventory · ISA 500 ¶9 · E1.2", "Inventaire des états · ISA 500 ¶9 · E1.2"),
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

/* ---------------------------------------------------------------- S5.1 --- */
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
        P("need", "Record the matter requiring expertise, and why the engagement team cannot address it alone.", "Consigner la question requérant une expertise et la raison pour laquelle l'équipe ne peut la traiter seule.", "P2.2 · risk register S3.1", "P2.2 · registre des risques S3.1", "Common triggers in the zone: a revaluation of land and buildings, the actuarial provision for retirement gratuities (indemnités de fin de carrière), the valuation of a plantation or of mineral reserves. State the account and assertion affected, then one line on what the team cannot do itself — for the retirement provision, projecting salaries and discounting. That line is also what justifies the expert's cost to the client.", "Cas fréquents dans la zone : réévaluation des terrains et constructions, provision actuarielle pour indemnités de fin de carrière, évaluation d'une plantation ou de réserves minières. Indiquer le compte et l'assertion concernés, puis en une ligne ce que l'équipe ne sait pas faire seule — pour la provision de retraite, projeter les salaires et actualiser. Cette ligne justifie aussi le coût de l'expert auprès du client."),
        P("competence", "Obtain evidence of the expert's competence and capabilities: qualifications, membership of a professional body, and experience of comparable work.", "Obtenir les éléments attestant de la compétence et des capacités de l'expert : qualifications, appartenance à un organisme professionnel et expérience de travaux comparables.", "Curriculum vitae · professional credentials · references", "Curriculum vitae · titres professionnels · références", "Ask for the CV, the registration number and the professional body: an expert immobilier should hold the MINDCAF agrément, an actuary should belong to a recognised institute. Ask for two recent reports of comparable work and skim them for method and depth. A phone call to the professional body confirms the registration in minutes.", "Demander le CV, le numéro d'agrément et l'ordre de rattachement : un expert immobilier doit détenir l'agrément du MINDCAF, un actuaire relever d'un institut reconnu. Demander deux rapports récents de travaux comparables et les parcourir pour juger la méthode et la profondeur. Un appel à l'ordre professionnel confirme l'inscription en quelques minutes."),
        P("objectivity", "Inquire into the expert's relationships with the entity, including any financial interest and any prior engagement, and evaluate the threats to objectivity.", "S'enquérir des liens de l'expert avec l'entité, y compris tout intérêt financier et toute mission antérieure, et apprécier les risques pesant sur son objectivité.", "Expert's declaration · P2.1 · inquiry of the entity", "Déclaration de l'expert · P2.1 · entretien avec l'entité", "Have the expert sign a short declaration listing fees received from the entity, shareholdings and family ties, and put the same question to the DAF the other way round. The classic trap: the valuer who produced the entity's own revaluation cannot also be our expert on it — that is management's expert, to be evaluated separately. Note any threat found and the safeguard applied.", "Faire signer à l'expert une courte déclaration listant honoraires perçus de l'entité, participations et liens familiaux, et poser la même question au DAF en sens inverse. Piège classique : l'évaluateur qui a produit la réévaluation de l'entité ne peut pas être aussi notre expert sur ce point — c'est un expert de la direction, à évaluer séparément. Noter toute menace relevée et la sauvegarde appliquée."),
        P("agree", "Agree in writing the nature, scope and objectives of the work, our respective roles, the form of the report, and confidentiality.", "Convenir par écrit de la nature, de l'étendue et des objectifs des travaux, des rôles respectifs, de la forme du rapport et de la confidentialité.", "Written terms with the expert · ISA 620 ¶11", "Termes écrits convenus · ISA 620 ¶11", "Use a short engagement letter or an annex to ours: which assets or liabilities, at what date, which method, the form and deadline of the report, confidentiality, and who pays. Be precise on scope — \"value the Bonaberi factory buildings at 31 December\" beats \"assist with fixed assets\". File the signed copy before the work starts.", "Utiliser une courte lettre de mission ou une annexe à la nôtre : quels actifs ou passifs, à quelle date, quelle méthode, la forme et le délai du rapport, la confidentialité et qui paie. Être précis sur le périmètre — « évaluer les bâtiments de l'usine de Bonabéri au 31 décembre » vaut mieux que « assister sur les immobilisations ». Classer l'exemplaire signé avant le début des travaux."),
        P("field", "Obtain sufficient understanding of the expert's field to evaluate the work, including the methods generally used and their limitations.", "Acquérir une connaissance suffisante du domaine de l'expert pour apprécier les travaux, y compris les méthodes usuelles et leurs limites.", "Technical literature · discussion with the expert", "Documentation technique · échange avec l'expert", "Ask the expert to walk you through the method in plain words and to name its two or three sensitive inputs — for an actuary, the discount rate and salary growth; for a valuer, the price per square metre and the comparables used. Read one short technical reference so you can challenge those inputs. You need enough to question the work, not to redo it.", "Demander à l'expert d'expliquer la méthode en termes simples et de nommer ses deux ou trois paramètres sensibles — pour un actuaire, le taux d'actualisation et la progression des salaires ; pour un évaluateur, le prix au mètre carré et les comparables retenus. Lire une courte référence technique pour pouvoir remettre en cause ces paramètres. Il faut de quoi questionner le travail, pas le refaire."),
        P("evaluate", "Evaluate the expert's findings: the relevance and reasonableness of the conclusions, the source data used, and the significant assumptions and methods.", "Apprécier les conclusions de l'expert : pertinence et caractère raisonnable, données sources utilisées, hypothèses et méthodes importantes.", "Expert's report · underlying data · ISA 620 ¶12", "Rapport de l'expert · données sous-jacentes · ISA 620 ¶12", "Recompute one item end to end and compare the sensitive assumptions to something observable: the discount rate to BEAC bond yields, salary growth to the last three years of payroll, the price per square metre to recent sales in the neighbourhood. Check that the report actually answers the question in the terms of engagement and carries no unexpected caveat. Record your conclusion on reasonableness in the file.", "Recalculer un élément de bout en bout et comparer les hypothèses sensibles à des données observables : le taux d'actualisation aux rendements obligataires BEAC, la progression des salaires aux trois derniers exercices de paie, le prix au mètre carré aux ventes récentes du quartier. Vérifier que le rapport répond bien à la question posée dans la lettre de mission et ne comporte pas de réserve inattendue. Consigner au dossier la conclusion sur le caractère raisonnable."),
        P("data", "Agree the source data the expert used to the entity's accounting records, and test its accuracy and completeness.", "Rapprocher les données sources utilisées par l'expert de la comptabilité de l'entité et en tester l'exactitude et l'exhaustivité.", "Accounting records · expert's working data", "Comptabilité · données de travail de l'expert", "Trace the file the entity gave the expert back to its source: the staff list to the payroll register and a sample of fiches de paie, the asset list to the fichier des immobilisations and the grand livre. Test completeness the other way too — pick employees or assets from the records and confirm they reached the expert's file. Wrong input data invalidates the best actuarial model.", "Rapprocher le fichier remis à l'expert de sa source : la liste du personnel du registre de paie et d'un échantillon de fiches de paie, la liste des actifs du fichier des immobilisations et du grand livre. Tester aussi l'exhaustivité en sens inverse — choisir des salariés ou des actifs dans les registres et vérifier qu'ils figurent dans le fichier de l'expert. Des données d'entrée fausses invalident le meilleur modèle actuariel."),
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

/* ---------------------------------------------------------------- S5.2 --- */
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
        P("identify", "Identify each service organisation used, the services provided, and the transactions and accounts affected.", "Identifier chaque organisme de services utilisé, les prestations fournies et les opérations et comptes concernés.", "Contracts · inquiry of management · payments ledger", "Contrats · entretien avec la direction · journal des paiements", "Scan the suppliers balance and the relevés bancaires for recurring service fees: a payroll bureau or fiduciaire, an IT host, a mobile money aggregator, a customs broker handling the entity's declarations. Ask the chief accountant which processing happens outside the entity's own Sage. For each one, list the accounts fed by its output — payroll, cash, sales collected by mobile money.", "Parcourir la balance fournisseurs et les relevés bancaires à la recherche d'honoraires récurrents : cabinet de paie ou fiduciaire, hébergeur informatique, agrégateur mobile money, transitaire qui traite les déclarations en douane. Demander au chef comptable quels traitements se font hors du Sage de l'entité. Pour chacun, lister les comptes alimentés par ses sorties — paie, trésorerie, ventes encaissées par mobile money."),
        P("contract", "Read the contract and the service level terms to establish what the service organisation does and what the entity retains.", "Examiner le contrat et les niveaux de service pour établir ce qui relève de l'organisme et ce qui reste chez l'entité.", "Service contract · service level agreement", "Contrat de prestation · convention de niveau de service", "Read the contract with a pen: underline who initiates, authorises and records each step, and what the entity keeps — typically approval of the payroll variables and the bank signature. Note the service levels, any right to audit and the notice period. What the entity retains is where your user controls will sit.", "Lire le contrat crayon en main : souligner qui initie, autorise et enregistre chaque étape, et ce que l'entité conserve — en général la validation des variables de paie et la signature bancaire. Noter les niveaux de service, l'éventuel droit d'audit et le préavis. Ce que l'entité conserve, c'est là que se logeront vos contrôles utilisateur."),
        P("user_controls", "Identify the controls the entity itself operates over the service, including the reconciliation of its own records to the service organisation's reports.", "Identifier les contrôles exercés par l'entité elle-même sur la prestation, dont le rapprochement de ses propres données avec les états de l'organisme.", "Process narratives · reconciliations · inquiry", "Descriptifs de processus · rapprochements · entretien", "The reconciliation is usually the whole story: the entity should tie the bureau's payroll journal to its headcount and the bank payments each month, or the aggregator's mobile money statement to its own sales records. Obtain the reconciliations for the year and re-perform one month yourself. If nobody at the entity checks the provider's output, say so now — it changes the audit approach.", "Le rapprochement est souvent l'essentiel : l'entité doit rapprocher chaque mois le journal de paie du cabinet de ses effectifs et des paiements bancaires, ou le relevé de l'agrégateur mobile money de ses propres ventes. Obtenir les rapprochements de l'exercice et en refaire un mois soi-même. Si personne à l'entité ne contrôle les sorties du prestataire, le dire maintenant — cela change l'approche d'audit."),
        P("report", "Obtain the type 1 or type 2 report where one exists. Record the period it covers, the auditor who issued it and any modification.", "Obtenir le rapport de type 1 ou 2 lorsqu'il existe. Consigner la période couverte, l'auditeur émetteur et toute modification.", "Type 1 or type 2 report (ISAE 3402)", "Rapport de type 1 ou 2 (ISAE 3402)", "ISAE 3402 reports are rare in the zone outside banks and international payroll or IT providers — ask for one anyway, in writing. If a report arrives, record the period covered, the auditor who signed it and the type, then read the opinion and the exceptions before anything else. A type 1 report describes controls at a date; it proves nothing about how they operated.", "Les rapports ISAE 3402 sont rares dans la zone hors banques et prestataires internationaux de paie ou d'informatique — en demander un quand même, par écrit. Si un rapport arrive, noter la période couverte, l'auditeur signataire et le type, puis lire d'abord l'opinion et les exceptions. Un rapport de type 1 décrit des contrôles à une date ; il ne prouve rien sur leur fonctionnement."),
        P("gap", "Where the report period does not cover our period, determine the additional procedures for the uncovered months.", "Lorsque la période du rapport ne couvre pas notre exercice, déterminer les procédures complémentaires pour les mois non couverts.", "Report period · our reporting period", "Période du rapport · notre exercice", "For the uncovered months, write to the service organisation asking whether the system or the key controls changed since the report period, and corroborate with the entity's reconciliations for those months. If the gap is long or the answer vague, extend substantive work over the period — for payroll, recompute a month that falls inside the gap.", "Pour les mois non couverts, écrire au prestataire pour savoir si le système ou les contrôles clés ont changé depuis la période du rapport, et corroborer avec les rapprochements de l'entité sur ces mois. Si l'écart est long ou la réponse vague, étendre les travaux substantifs sur la période — pour la paie, recalculer un mois situé dans l'écart."),
        P("cucs", "Identify the complementary user entity controls the report assumes, and test that the entity operates each one.", "Identifier les contrôles complémentaires attendus de l'entité utilisatrice et tester que l'entité les met en œuvre.", "Type 2 report appendix · entity's controls", "Annexe du rapport de type 2 · contrôles de l'entité", "Open the appendix of the type 2 report and list every complementary user entity control — usually a dozen lines: approve inputs before submission, review the output report, restrict access. For each one, name the person at the entity who performs it and get one month's evidence — the signed variables sheet, the reviewed report. One untested control quietly breaks the reliance the report gives you.", "Ouvrir l'annexe du rapport de type 2 et lister chaque contrôle complémentaire de l'entité utilisatrice — souvent une douzaine de lignes : valider les données avant envoi, revoir l'état de sortie, restreindre les accès. Pour chacun, nommer la personne qui l'exécute chez l'entité et obtenir la preuve d'un mois — la fiche de variables signée, l'état revu. Un seul contrôle non testé ruine en silence l'appui que donne le rapport."),
        P("alternative", "Where no report is available and we intend to rely on the service organisation's controls, contact or visit it, or arrange for another auditor to perform procedures.", "En l'absence de rapport et si nous entendons nous appuyer sur les contrôles de l'organisme, le contacter ou le visiter, ou faire intervenir un autre auditeur.", "ISA 402 ¶12(b)–(d) · correspondence", "ISA 402 ¶12(b)–(d) · correspondance", "A local payroll bureau or fiduciaire in Douala or Yaoundé can simply be visited: an afternoon on site with a short questionnaire — access, backups, segregation of duties, how corrections are handled — often settles it. Where a visit is impossible, decide instead not to rely on their controls and cover the balances substantively. Do not let the reliance decision drift: pick one route and document it.", "Un cabinet de paie ou une fiduciaire à Douala ou Yaoundé se visite tout simplement : une après-midi sur place avec un court questionnaire — accès, sauvegardes, séparation des tâches, traitement des corrections — suffit souvent. Si la visite est impossible, choisir plutôt de ne pas s'appuyer sur leurs contrôles et couvrir les soldes par des travaux substantifs. Ne pas laisser la décision d'appui en suspens : choisir une voie et la documenter."),
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

/* ---------------------------------------------------------------- S5.3 --- */
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
        P("status", "Establish to whom the internal audit function reports, who appoints and removes its head, and who sets its budget and its plan.", "Établir à qui l'audit interne rend compte, qui nomme et révoque son responsable, et qui arrête son budget et son plan.", "Internal audit charter · organisation chart · minutes", "Charte d'audit interne · organigramme · procès-verbaux", "Read the internal audit charter and the board minutes side by side: the head should report to the board or audit committee, not only to the DG or DAF — in banks and microfinance, COBAC rules require it. Check who signed the head's appointment and who approves the plan and the budget. If findings never reach the conseil d'administration, objectivity is compromised whatever the charter says.", "Lire la charte d'audit interne et les procès-verbaux du conseil en parallèle : le responsable doit rendre compte au conseil ou au comité d'audit, pas seulement au DG ou au DAF — dans les banques et la microfinance, la réglementation COBAC l'exige. Vérifier qui a signé la nomination du responsable et qui approuve le plan et le budget. Si les constats n'atteignent jamais le conseil d'administration, l'objectivité est compromise quoi qu'en dise la charte."),
        P("competence", "Evaluate the competence of the function: the qualifications and experience of its staff, and its training and resources.", "Apprécier la compétence de la fonction : qualifications et expérience du personnel, formation et moyens.", "Staff records · training log · inquiry", "Dossiers du personnel · registre de formation · entretien", "Get the team list with qualifications and years in post: look for a DSCG, a CIA or an expertise comptable in progress, and experience beyond cash counts. Ask for the year's training log and the tools they use. Two juniors doing only branch inventories is a different function from a staffed department with a methodology.", "Obtenir la liste de l'équipe avec diplômes et ancienneté : chercher un DSCG, un CIA ou une expertise comptable en cours, et une expérience au-delà des comptages de caisse. Demander le plan de formation de l'exercice et les outils utilisés. Deux juniors qui ne font que des inventaires d'agences, ce n'est pas la même fonction qu'un service étoffé doté d'une méthodologie."),
        P("approach", "Evaluate whether the function applies a systematic and disciplined approach, including documented methodology and quality control over its work.", "Apprécier si la fonction applique une approche méthodique et rigoureuse, avec une méthodologie documentée et un contrôle qualité de ses travaux.", "Internal audit manual · working papers · quality reviews", "Manuel d'audit interne · feuilles de travail · revues qualité", "Take one recent internal audit report and ask for its working papers: a real methodology shows a work programme, evidence referenced to each finding, and a supervisor's review note. Check the manual exists and is actually followed — the dates on the papers tell you. Findings written from memory, with no file behind them, fail the systematic-and-disciplined test.", "Prendre un rapport d'audit interne récent et demander ses papiers de travail : une vraie méthodologie montre un programme de travail, des preuves référencées à chaque constat et une note de revue du superviseur. Vérifier que le manuel existe et est réellement appliqué — les dates sur les papiers le disent. Des constats écrits de mémoire, sans dossier derrière, échouent au test de l'approche systématique et disciplinée."),
        P("plan", "Read the internal audit plan and reports for the period, and identify the work that bears on the risks we have assessed.", "Examiner le plan et les rapports d'audit interne de l'exercice et identifier les travaux touchant aux risques évalués.", "Internal audit plan and reports · S3.1", "Plan et rapports d'audit interne · S3.1", "Get the annual plan and every report issued in the period, then map each against the risk register in S3.1: branch cash counts bear on cash existence, revolving stock counts on inventory, credit file reviews on loan provisioning. Mark what is usable, what is stale and what was planned but never done. A report issued after year-end can still tell you about conditions during the period.", "Obtenir le plan annuel et tous les rapports émis dans la période, puis les rapprocher du registre des risques en S3.1 : les comptages de caisse en agence touchent l'existence de la trésorerie, les inventaires tournants les stocks, les revues de dossiers de crédit le provisionnement. Marquer ce qui est utilisable, ce qui est périmé et ce qui était prévu mais jamais réalisé. Un rapport émis après la clôture peut encore renseigner sur la période auditée."),
        P("determine", "Determine the areas and the extent of work to be used, giving less weight where more judgement is involved or the assessed risk is higher.", "Déterminer les domaines et l'étendue des travaux utilisés, en réduisant le recours lorsque le jugement requis ou le risque évalué est plus élevé.", "ISA 610 ¶18–19 · S3.1", "ISA 610 ¶18–19 · S3.1", "Keep the judgement-heavy areas for the team — estimates, provisions, going concern, anything touching fraud — and use internal audit where the work is mechanical: branch cash counts, fixed asset verification, compliance testing. Write the split into the audit strategy with one sentence of reasoning per area. Where a significant risk is involved, plan to do the work yourself and take theirs only as corroboration.", "Garder pour l'équipe les zones de jugement — estimations, provisions, continuité d'exploitation, tout ce qui touche à la fraude — et utiliser l'audit interne là où le travail est mécanique : comptages de caisse en agence, vérification des immobilisations, tests de conformité. Inscrire cette répartition dans la stratégie d'audit avec une phrase de justification par zone. En présence d'un risque important, prévoir de faire le travail soi-même et ne prendre le leur qu'en corroboration."),
        P("reperform", "Re-perform a portion of the work to be used, and evaluate whether it was properly planned, performed, supervised, reviewed and documented.", "Réexécuter une partie des travaux utilisés et apprécier s'ils ont été correctement planifiés, réalisés, supervisés, revus et documentés.", "Internal audit working papers · our re-performance note", "Feuilles de travail de l'audit interne · notre note de réexécution", "Pick a slice of the work you plan to use and redo it cold: recount a branch's cash against their count sheet, retrace ten of their sampled items to the supporting documents. Compare your results to theirs and clear any difference before relying on the rest. While you are in their papers, check the planning, supervision and review sign-offs — the how matters as much as the result.", "Choisir une tranche des travaux à utiliser et la refaire à froid : recompter la caisse d'une agence contre leur feuille de comptage, retracer dix éléments de leur échantillon jusqu'aux pièces justificatives. Comparer vos résultats aux leurs et éclaircir tout écart avant de s'appuyer sur le reste. Pendant qu'on est dans leurs dossiers, vérifier les visas de planification, de supervision et de revue — la manière compte autant que le résultat."),
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

/* ---------------------------------------------------------------- P6.1 --- */
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
        P("pm", "Set performance materiality, taking account of the assessed risks, the misstatements found in prior periods, and the number and size of misstatements expected.", "Fixer le seuil de travail en tenant compte des risques évalués, des anomalies des exercices antérieurs et du nombre et de la taille des anomalies attendues.", "Prior year C1.1 · S3.1 · firm policy", "C1.1 de l'exercice précédent · S3.1 · politique du cabinet",
          "Open last year's Summary of Audit Differences (C1.1): many or large misstatements push performance materiality toward 60% of PM; a clean prior file with low assessed risks supports 75%. Performance materiality is the buffer that keeps undetected misstatements from breaching materiality in aggregate — the riskier the file, the bigger the buffer, so the lower the percentage.",
          "Ouvrir le récapitulatif des écarts de l'exercice précédent (C1.1) : des anomalies nombreuses ou importantes poussent le seuil de travail vers 60 % du seuil global ; un dossier antérieur propre avec des risques faibles justifie 75 %. Le seuil de travail est la marge qui empêche les anomalies non détectées de dépasser le seuil en cumul — plus le dossier est risqué, plus la marge doit être grande, donc plus le pourcentage baisse."),
        P("specific", "Determine whether a class of transactions, balance or disclosure exists for which a lower amount would influence users, and set a specific materiality for it.", "Déterminer s'il existe un flux, un solde ou une note pour lequel un montant plus faible influencerait les utilisateurs, et fixer un seuil spécifique.", "ISA 320 ¶10 · statutes · loan covenants", "ISA 320 ¶10 · statuts · covenants bancaires",
          "Scan the loan agreements for covenant ratios (a small error in EBITDA can flip a covenant), the statutes for regulated thresholds, and the notes for sensitive disclosures — related-party transactions and management remuneration are the classic cases where users care about amounts far below overall materiality.",
          "Balayer les contrats de prêt pour les ratios de covenant (une petite erreur d'EBITDA peut faire basculer un covenant), les statuts pour les seuils réglementés, et l'annexe pour les informations sensibles — conventions avec les parties liées et rémunération des dirigeants sont les cas classiques où les utilisateurs s'intéressent à des montants bien inférieurs au seuil global."),
        P("trivial", "Set the clearly trivial threshold below which misstatements need not be accumulated.", "Fixer le seuil négligeable en deçà duquel les anomalies ne sont pas cumulées.", "ISA 450 ¶5 · firm policy", "ISA 450 ¶5 · politique du cabinet",
          "Set it at 3–5% of overall materiality (the tool defaults to 5%). Below this line misstatements are not even accumulated in C1.1 — so if the entity's users are unusually sensitive, or you expect many small errors that could add up, choose the lower end.",
          "Le fixer à 3–5 % du seuil global (l'outil propose 5 %). Sous cette ligne, les anomalies ne sont même pas cumulées en C1.1 — si les utilisateurs sont particulièrement sensibles, ou si de nombreuses petites erreurs risquent de s'additionner, retenir le bas de fourchette."),
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

/* ---------------------------------------------------------------- S4.1 --- */
// Titled "Commitments & Contingencies" in the file index. The planning paper
// scopes them and sets the strategy; the evidence is obtained in E4.15.
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
        P("inquire", "Inquire of management and of those responsible for legal matters about litigation, claims and assessments, whether or not recorded.", "S'enquérir auprès de la direction et des responsables juridiques des litiges, réclamations et redressements, comptabilisés ou non.", "Inquiry of management · in-house counsel", "Entretien avec la direction · service juridique", "Put the question to the managing director and the finance director separately, then to whoever handles legal matters — often the finance director or an external avocat. Ask for disputes whether or not a provision was booked, and for anything served by or sent to a huissier during the year. Record each answer with the name and the date; a bare 'management confirmed none' is not evidence.", "Poser la question au dirigeant et au directeur financier séparément, puis à la personne qui suit les affaires juridiques — souvent le directeur financier ou un avocat externe. Demander les litiges, qu'une provision ait été comptabilisée ou non, et tout acte signifié par ou adressé à un huissier pendant l'exercice. Consigner chaque réponse avec le nom et la date ; un simple 'la direction confirme néant' n'est pas un élément probant."),
        P("minutes", "Read the minutes of the general meetings and of the board for commitments given, guarantees granted and disputes reported.", "Examiner les procès-verbaux d'assemblée et du conseil : engagements donnés, garanties accordées et litiges signalés.", "Minutes (E6.4) · resolutions", "Procès-verbaux (E6.4) · résolutions", "Read the minutes of the general meetings and the board for the whole period and the months up to your date, hunting for the words caution, aval, garantie, litige and engagement. Guarantees to third parties or affiliates are typically decided in a resolution and never touch the ledger. List each resolution with its date and subject so the reviewer can trace what was read.", "Lire les procès-verbaux des assemblées et du conseil sur tout l'exercice et jusqu'à votre date d'intervention, en traquant les mots caution, aval, garantie, litige et engagement. Les garanties données à des tiers ou à des sociétés liées se décident généralement par résolution et ne passent jamais par le grand livre. Lister chaque résolution avec sa date et son objet pour que le réviseur retrouve ce qui a été lu."),
        P("legal_fees", "Review the legal and professional fees account for the period, and identify the matter behind each significant payment.", "Examiner le compte d'honoraires juridiques de l'exercice et identifier l'affaire à l'origine de chaque paiement significatif.", "General ledger · invoices from advisers", "Grand livre · factures des conseils", "Pull the professional fees accounts (632x, honoraires) from the general ledger and sort by supplier: each avocat, notaire or adviser is a thread to pull. For every significant invoice, read the narrative on the invoice itself — 'defence in case X' names the dispute for you. A lawyer paid regularly with no matter identified is exactly what this procedure exists to find.", "Extraire les comptes d'honoraires (632x) du grand livre et trier par fournisseur : chaque avocat, notaire ou conseil est un fil à tirer. Pour chaque facture significative, lire le libellé sur la facture elle-même — 'défense dossier X' vous nomme le litige. Un avocat payé régulièrement sans dossier identifié est exactement ce que cette procédure sert à trouver."),
        P("contracts", "Read the significant contracts for guarantees, penalty clauses, capital commitments and take-or-pay obligations.", "Examiner les contrats significatifs : garanties, clauses pénales, engagements d'investissement et obligations d'enlèvement.", "Contract file · loan agreements · leases", "Chrono des contrats · contrats de prêt · baux", "Ask for the loan agreements, the leases and the largest customer and supplier contracts, and read the clauses at the back: penalties, guarantees given, firm purchase commitments, options. Copy the clause and record counterparty and amount in the schedule. Capital commitments signed but not yet delivered — equipment on order — belong here too; ask the technical or operations manager, not just the accountant.", "Demander les contrats de prêt, les baux et les plus gros contrats clients et fournisseurs, et lire les clauses jusqu'à la dernière page : pénalités, garanties données, engagements d'achat ferme, options. Copier la clause et consigner la contrepartie et le montant dans le tableau. Les engagements d'investissement signés mais non encore livrés — matériel en commande — relèvent aussi de ce papier ; interroger le directeur technique ou d'exploitation, pas seulement le comptable."),
        P("bank", "Identify from the bank documentation the guarantees, sureties and pledges given or received.", "Identifier dans la documentation bancaire les garanties, cautions et nantissements donnés ou reçus.", "Bank confirmations · loan agreements · pledge register", "Confirmations bancaires · contrats de prêt · registre des nantissements", "Read the bank confirmation replies past the balances: banks list avals, sureties, pledges and discounted bills not yet due in the lower half, and that is where the unrecorded items live. Compare every guarantee a bank names against the off-balance-sheet commitments note in the DSF. A pledge over stock or receivables also feeds the covenant picture in S4.2.", "Lire les réponses de circularisation bancaire au-delà des soldes : les banques listent avals, cautions, nantissements et effets escomptés non échus dans la partie basse, et c'est là que se cachent les éléments non comptabilisés. Rapprocher chaque garantie citée par une banque de la note des engagements hors bilan de la DSF. Un nantissement sur stocks ou créances alimente aussi l'analyse des covenants en S4.2."),
        P("tax_social", "Inquire into open tax and social security assessments and inspections, and obtain the position on each.", "S'enquérir des contrôles et redressements fiscaux et sociaux en cours et obtenir la position sur chacun.", "Correspondence with the tax and social administrations", "Correspondance avec les administrations fiscale et sociale", "Ask for the correspondence file with the tax administration and the CNPS: notifications de redressement, avis de mise en recouvrement, and any inspection in progress. For each open assessment record the amounts notified, the stage reached (observations, contentieux, appeal) and management's position supported by its adviser's view. A verification notice received but not yet quantified is still a contingency to carry forward.", "Demander le dossier de correspondance avec l'administration fiscale et la CNPS : notifications de redressement, avis de mise en recouvrement et tout contrôle en cours. Pour chaque redressement ouvert, consigner les montants notifiés, le stade atteint (observations, contentieux, recours) et la position de la direction appuyée de l'avis de son conseil. Un avis de vérification reçu mais non encore chiffré reste une éventualité à reporter."),
        P("strategy", "For each item identified, record whether it is recognised, disclosed or neither, and set the evidence to be obtained in E4.15.", "Pour chaque élément identifié, consigner s'il est comptabilisé, mentionné ou ni l'un ni l'autre, et arrêter les éléments à obtenir en E4.15.", "IAS 37 / SYSCOHADA · E4.15", "IAS 37 / SYSCOHADA · E4.15", "Rule on each line: recognised as a provision, disclosed among the off-balance-sheet commitments of the DSF, or neither — with the reason in one sentence against the IAS 37/SYSCOHADA criteria. Then set the evidence E4.15 must obtain: the avocat's letter, the administration's latest notice, the bank confirmation. An item identified here with no execution step planned is the loose end a reviewer will find.", "Trancher pour chaque ligne : provisionnée, mentionnée dans les engagements hors bilan de la DSF, ou ni l'un ni l'autre — avec la raison en une phrase au regard des critères IAS 37/SYSCOHADA. Fixer ensuite les éléments probants que E4.15 devra obtenir : la lettre de l'avocat, la dernière notification de l'administration, la confirmation bancaire. Un élément identifié ici sans étape d'exécution prévue est le fil que le réviseur tirera."),
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
        { key: "carried", en: "Each item identified has been carried into E4.15 with the evidence to be obtained (procedure 7).", fr: "Chaque élément identifié est repris en E4.15 avec les éléments probants à obtenir (procédure 7)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- P5.1 --- */
const D5_4: PaperDef = {
  std: "ISA 240 ¶12–27, ¶31–33",
  ownsEn: "the fraud risk assessment and the presumed risks",
  ownsFr: "l'évaluation du risque de fraude et les risques présumés",
  reqEn: [
    "We identify and assess the risks of material misstatement due to fraud at the financial statement level and at the assertion level (ISA 240 ¶25). There is a rebuttable presumption that revenue recognition gives rise to a risk of fraud; where that presumption is rebutted, the reasons are documented (ISA 240 ¶26, ¶47).",
    "Management is in a unique position to perpetrate fraud by overriding controls. That risk is present in every entity and is treated as a significant risk, whatever our assessment of management's integrity (ISA 240 ¶31). The responses are performed in E3.1.",
  ],
  reqFr: [
    "Nous identifions et évaluons les risques d'anomalies significatives résultant de fraudes, au niveau des états financiers et des assertions (ISA 240 ¶25). La présomption de risque sur la comptabilisation des produits est réfragable et toute réfutation est documentée (ISA 240 ¶26, ¶47).",
    "La direction est en mesure de contourner les contrôles. Ce risque existe dans toute entité et est traité comme un risque important (ISA 240 ¶31). Les réponses sont mises en œuvre en E3.1.",
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
        P("factors", "Identify the fraud risk factors present: incentives and pressures, opportunities, and attitudes or rationalisations.", "Identifier les facteurs de risque présents : incitations et pressions, opportunités, attitudes ou justifications.", "ISA 240 Appendix 1 · P4.2 · analytics P3.2", "ISA 240 annexe 1 · P4.2 · analyses P3.2"),
        P("analytics", "Evaluate whether the unusual or unexpected relationships identified in the preliminary analytics indicate a risk of fraud.", "Apprécier si les relations inhabituelles relevées en analyse préliminaire révèlent un risque de fraude.", "P3.2 preliminary analytics", "Analyses préliminaires P3.2"),
        P("reliability", "Investigate any condition identified that causes us to question the reliability of the records and documents to be used as audit evidence: missing or altered documents, unexplained differences between records, or evasive responses.", "Examiner toute circonstance relevée conduisant à douter de la fiabilité des livres et documents devant servir d'éléments probants : documents manquants ou altérés, écarts inexpliqués entre les enregistrements, ou réponses évasives.", "ISA 240 ¶13 · document inspection · reconciliations", "ISA 240 ¶13 · inspection des documents · rapprochements"),
        P("revenue", "Apply the presumption that revenue recognition gives rise to a fraud risk. Identify the revenue assertions affected, or record the reasons for rebutting the presumption.", "Appliquer la présomption de risque de fraude sur la comptabilisation des produits. Identifier les assertions concernées ou consigner les motifs de la réfutation.", "ISA 240 ¶26, ¶47 · E4.1", "ISA 240 ¶26, ¶47 · E4.1"),
        P("override", "Record the risk of management override as a significant risk, and set the responses to be performed in E3.1: journal entry testing, review of estimates for bias, and evaluation of significant unusual transactions.", "Consigner le risque de contournement des contrôles comme risque important et arrêter les réponses à mettre en œuvre en E3.1 : test des écritures, revue des estimations et examen des opérations inhabituelles significatives.", "ISA 240 ¶31–33 · E3.1", "ISA 240 ¶31–33 · E3.1"),
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
        { key: "override", en: "Management override is recorded as a significant risk with responses planned in E3.1 (procedure 7).", fr: "Le contournement des contrôles est consigné comme risque important avec des réponses prévues en E3.1 (procédure 7)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- S4.2 --- */
const D5_5: PaperDef = {
  std: "ISA 570 (Revised) ¶10–12",
  ownsEn: "the preliminary going concern assessment",
  ownsFr: "l'appréciation préliminaire de la continuité d'exploitation",
  reqEn: [
    "When performing risk assessment procedures we consider whether events or conditions exist that may cast significant doubt on the entity's ability to continue as a going concern, and determine whether management has already performed a preliminary assessment (ISA 570 (Revised) ¶10–11).",
    "The preliminary view sets the work to be done at completion in E6.3 and C2.2. It does not conclude on the matter.",
    "ISA 570 (Revised) ¶A3 groups the events or conditions into three families: financial (a net liability or net current liability position, borrowings approaching maturity without realistic prospect of renewal, negative operating cash flows, arrears of payments), operating (management intentions to liquidate or cease, loss of key management, of a principal market, franchise or supplier, labour difficulties) and other (non-compliance with capital or other statutory requirements, pending legal or regulatory proceedings the entity could not satisfy). One indicator alone is rarely decisive; it is the combination, and management's capacity to respond, that matters — the significance of such events or conditions can often be mitigated by other factors (ISA 570 ¶A4).",
    "In the OHADA zone the loss of half the share capital is also a legal event: where the capitaux propres fall below half of the capital social, articles 664–665 of the AUSCGIE (371–372 for a SARL) require an extraordinary general meeting to be convened within four months of the approval of the accounts showing the loss, to decide on early dissolution. If continuation is decided, equity must be restored to at least half of the capital by the end of the second following financial year, failing which the capital must be reduced. Non-compliance with a statutory requirement of this kind is itself an 'other' indicator under ISA 570 ¶A3, and the state of the procedure is documented in C5.8.",
  ],
  reqFr: [
    "Lors des procédures d'évaluation des risques, nous examinons l'existence d'événements ou de conditions susceptibles de jeter un doute important sur la continuité d'exploitation (ISA 570 révisée ¶10–11).",
    "L'appréciation préliminaire détermine les travaux à réaliser à l'achèvement en E6.3 et C2.2 ; elle ne conclut pas sur la question.",
    "ISA 570 (Révisée) ¶A3 regroupe les événements ou conditions en trois familles : financiers (situation nette négative ou passif courant net, emprunts arrivant à échéance sans perspective réaliste de renouvellement, flux de trésorerie d'exploitation négatifs, arriérés de paiement), opérationnels (intention de la direction de liquider ou de cesser l'activité, perte de dirigeants clés, d'un marché principal, d'une franchise ou d'un fournisseur, conflits sociaux) et autres (non-respect d'exigences de capital ou d'autres exigences légales, procédures judiciaires ou réglementaires en cours que l'entité ne pourrait pas supporter). Un indicateur isolé est rarement décisif ; c'est la combinaison, et la capacité de la direction à y répondre, qui compte — la portée de tels événements ou conditions peut souvent être atténuée par d'autres facteurs (ISA 570 ¶A4).",
    "Dans l'espace OHADA, la perte de la moitié du capital est aussi un événement juridique : lorsque les capitaux propres deviennent inférieurs à la moitié du capital social, les articles 664 et 665 de l'AUSCGIE (371 et 372 pour la SARL) imposent de convoquer l'assemblée générale extraordinaire dans les quatre mois suivant l'approbation des comptes ayant fait apparaître la perte, pour statuer sur la dissolution anticipée. Si la continuation est décidée, les capitaux propres doivent être reconstitués à hauteur d'au moins la moitié du capital au plus tard à la clôture du deuxième exercice suivant, faute de quoi le capital doit être réduit. Le non-respect d'une telle exigence légale est en soi un indicateur de la famille 'autres' au sens d'ISA 570 ¶A3, et l'état de la procédure se documente en C5.8.",
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
        P("indicators", "Review the financial indicators: net liability position, recurring losses, negative operating cash flow, adverse key ratios and arrears.", "Examiner les indicateurs financiers : situation nette négative, pertes récurrentes, flux de trésorerie d'exploitation négatifs, ratios défavorables et arriérés.", "Trial balance · prior financial statements · P3.2", "Balance · états financiers antérieurs · P3.2", "Compute the ratios yourself from the trial balance: equity against capital, working capital, operating cash flow from the TAFIRE or cash flow statement, and days of arrears from the aged supplier balance. Set each against the prior DSF to see the direction of travel, not just the level. Flag arrears to the CNPS and the tax administration specifically — they are a cash symptom and a penalties risk at once.", "Calculer soi-même les ratios à partir de la balance : capitaux propres contre capital, fonds de roulement, flux de trésorerie d'exploitation d'après le TAFIRE ou le tableau des flux, et jours de retard sur la balance âgée fournisseurs. Comparer chaque ratio à la DSF de l'exercice précédent pour voir la tendance, pas seulement le niveau. Signaler expressément les arriérés envers la CNPS et l'administration fiscale — à la fois symptôme de trésorerie et risque de pénalités."),
        P("operating", "Review the operating and other indicators: loss of a principal market or supplier, key personnel departures, labour difficulties and pending legal proceedings.", "Examiner les indicateurs opérationnels et autres : perte d'un marché ou d'un fournisseur majeur, départs de personnel clé, conflits sociaux et procédures en cours.", "Inquiry of management · minutes · S4.1", "Entretien avec la direction · procès-verbaux · S4.1", "Ask the managing director which customers or contracts carry the business and what happens if the largest walks — one buyer above 30% of turnover is an indicator on its own. Probe departures of key people, strikes or social unrest, and licences or agréments coming up for renewal. Cross-check against the disputes found in S4.1; a case big enough to sink the entity belongs on both papers.", "Demander au dirigeant quels clients ou contrats font vivre l'affaire et ce qui arrive si le plus gros s'en va — un acheteur au-delà de 30 % du chiffre d'affaires est un indicateur à lui seul. Sonder les départs de personnes clés, les grèves ou tensions sociales, et les licences ou agréments à renouveler. Recouper avec les litiges relevés en S4.1 ; une affaire capable de couler l'entité figure sur les deux papiers."),
        P("borrowings", "Identify the borrowings falling due within twelve months, and the covenants attached to them.", "Identifier les emprunts échéant dans les douze mois et les covenants qui y sont attachés.", "Loan agreements · bank confirmations · maturity schedule", "Contrats de prêt · confirmations bancaires · échéancier", "Build a maturity table from the loan agreements and bank confirmations: each facility, its due date, and any covenant (ratio, minimum equity) with the headroom computed. Ask the finance director whether the overdrafts and short-term lines are committed in writing or repayable on demand — most OHADA overdrafts are on demand and should be treated as current. A facility maturing within twelve months with no renewal letter is the classic indicator.", "Construire un échéancier à partir des contrats de prêt et des confirmations bancaires : chaque concours, son échéance, et tout covenant (ratio, capitaux propres minimum) avec la marge calculée. Demander au directeur financier si les découverts et lignes courtes sont confirmés par écrit ou remboursables à vue — la plupart des découverts OHADA sont à vue et doivent être traités comme exigibles. Un concours arrivant à échéance sous douze mois sans lettre de renouvellement est l'indicateur classique."),
        P("capital", "For a SYSCOHADA entity, compare net equity against half of the share capital and record whether the article 664 procedure is engaged.", "Pour une entité SYSCOHADA, comparer les capitaux propres à la moitié du capital social et indiquer si la procédure de l'article 664 est engagée.", "Trial balance · statutes · C5.8", "Balance · statuts · C5.8", "Take equity straight from the trial balance, result for the period included, and set it against half of the share capital per the statutes and the RCCM extract. If it falls short, ask for the minutes of the extraordinary general meeting deciding on continuation — article 664 AUSCGIE allows four months from the meeting that approved the loss-making accounts. Record the position in C5.8 as well; for the statutory auditor this is a legal trigger, not just an audit indicator.", "Prendre les capitaux propres directement dans la balance, résultat de l'exercice compris, et les rapporter à la moitié du capital social selon les statuts et l'extrait RCCM. S'ils sont inférieurs, demander le procès-verbal de l'assemblée générale extraordinaire statuant sur la continuation — l'article 664 de l'AUSCGIE laisse quatre mois à compter de l'assemblée ayant approuvé les comptes déficitaires. Consigner aussi la situation en C5.8 ; pour le commissaire aux comptes c'est un déclencheur légal, pas seulement un indicateur d'audit."),
        P("mgmt_assess", "Establish whether management has made its preliminary assessment, the period it covers, and the support behind it.", "Établir si la direction a réalisé son appréciation préliminaire, la période couverte et les éléments qui l'étayent.", "Inquiry of management · cash flow forecast · budget", "Entretien avec la direction · prévisions de trésorerie · budget", "Ask the finance director for the cash flow forecast or budget behind management's view, and check the period runs at least twelve months from the date the financial statements will be authorised for issue. Test the arithmetic and tie the opening cash to the latest bank statement, then ask what the forecast assumes about the biggest customer and the bank lines. If nothing written exists, say so plainly — that fact alone shapes the E6.3 work.", "Demander au directeur financier la prévision de trésorerie ou le budget qui fonde la position de la direction, et vérifier que la période couvre au moins douze mois à compter de la date prévue d'autorisation de publication des états financiers. Tester les calculs et rattacher la trésorerie d'ouverture au dernier relevé bancaire, puis demander ce que la prévision suppose du plus gros client et des lignes bancaires. S'il n'existe rien d'écrit, le dire clairement — ce constat suffit à orienter les travaux d'E6.3."),
        P("plan", "Set the work required at completion, including the period the assessment must cover and the evidence to obtain on any mitigating plan.", "Arrêter les travaux requis à l'achèvement, dont la période à couvrir et les éléments à obtenir sur tout plan d'atténuation.", "E6.3 · C2.2 · ISA 570 (Revised) ¶13", "E6.3 · C2.2 · ISA 570 révisée ¶13", "Write down now what E6.3 and C2.2 must obtain at completion: the period the assessment must reach, the mitigating plan to evidence — a shareholder support letter, a signed renewal, a planned disposal — and who will provide it. Ask the parent for a lettre de soutien early; obtaining one at signature date is always harder. If the article 664 procedure is engaged, add the AGE documents to the completion list.", "Écrire dès maintenant ce que E6.3 et C2.2 devront obtenir à l'achèvement : la période que l'évaluation doit couvrir, le plan d'atténuation à documenter — lettre de soutien de l'actionnaire, renouvellement signé, cession projetée — et qui le fournira. Demander tôt la lettre de soutien à la maison mère ; l'obtenir à la date de signature est toujours plus difficile. Si la procédure de l'article 664 est engagée, ajouter les documents de l'AGE à la liste d'achèvement."),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation",
      titleFr: "Partie B — Évaluation",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "none", en: "No event or condition was identified that may cast significant doubt on the entity's ability to continue as a going concern (procedures 1 to 4). A “No” sets the extended work in E6.3.", fr: "Aucun événement ou condition susceptible de jeter un doute important n'a été identifié (procédures 1 à 4). Un « Non » déclenche les travaux étendus en E6.3." },
        { key: "assessment", en: "Management's assessment covers at least twelve months from the date the financial statements will be authorised for issue (procedure 5).", fr: "L'appréciation de la direction couvre au moins douze mois à compter de la date d'arrêté des comptes (procédure 5)." },
        { key: "capital", en: "Net equity exceeds half of the share capital, so the article 664 procedure is not engaged (procedure 4).", fr: "Les capitaux propres excèdent la moitié du capital social ; la procédure de l'article 664 n'est pas engagée (procédure 4).", na: true },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- S4.3 --- */
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
        P("identity", "Inquire of management about the identity of the entity's related parties, including changes from the prior period, and the nature of each relationship.", "S'enquérir auprès de la direction de l'identité des parties liées, des changements par rapport à l'exercice précédent et de la nature de chaque relation.", "Inquiry of management · prior year register · statutes", "Entretien avec la direction · registre de l'exercice précédent · statuts", "Sit with the managing director and list the parties by family: shareholders and their other companies, directors and their businesses, relatives in key posts, and the group entities above and below. Compare against last year's register and ask specifically what changed — a new shareholder, a company created by a director during the year. Names, not categories: 'the DG's transport company' must become a named entity with its RCCM number.", "S'asseoir avec le dirigeant et lister les parties par famille : actionnaires et leurs autres sociétés, administrateurs et leurs affaires, proches occupant des postes clés, et les entités du groupe en amont et en aval. Comparer avec le registre de l'an dernier et demander précisément ce qui a changé — un nouvel actionnaire, une société créée par un administrateur en cours d'exercice. Des noms, pas des catégories : 'la société de transport du DG' doit devenir une entité nommée avec son numéro RCCM."),
        P("controls", "Inquire about the controls management has established to identify, account for and disclose related party relationships and transactions, and to authorise transactions outside the normal course of business.", "S'enquérir des contrôles établis par la direction pour identifier, comptabiliser et mentionner les relations et opérations avec les parties liées et pour autoriser celles hors du cours normal des affaires.", "Inquiry · delegation of authority · P4.1", "Entretien · délégations de pouvoirs · P4.1", "Ask who in the entity is supposed to spot a related party deal before it is signed — in most OHADA companies the honest answer is nobody, and that answer is itself a finding for P4.1. Check whether the conventions réglementées procedure actually operates: prior board authorisation and the statutory auditor's special report. Read the delegation of authority for any different signature rule on transactions with affiliates.", "Demander qui, dans l'entité, est censé repérer une opération avec une partie liée avant sa signature — dans la plupart des sociétés OHADA la réponse honnête est personne, et cette réponse est en soi un constat pour P4.1. Vérifier si la procédure des conventions réglementées fonctionne réellement : autorisation préalable du conseil et rapport spécial du commissaire aux comptes. Lire la délégation de pouvoirs pour repérer une règle de signature différente sur les opérations avec les sociétés liées."),
        P("registers", "Inspect the share register, the register of directors' interests and the group structure for parties not named by management.", "Examiner le registre des titres, le registre des intérêts des dirigeants et l'organigramme du groupe à la recherche de parties non citées.", "Share register (C5.7) · RCCM extract · group chart", "Registre des titres (C5.7) · extrait RCCM · organigramme du groupe", "Pull the share register or the statutes for the shareholders, the RCCM extract for the directors and managers, and the group chart for sisters and sub-subsidiaries. Where a director is also gérant of another company, that company's own RCCM entry confirms it. Every name found here that management did not volunteer goes back to management as a question.", "Consulter le registre des actions ou les statuts pour les actionnaires, l'extrait RCCM pour les administrateurs et dirigeants, et l'organigramme du groupe pour les sociétés sœurs et les sous-filiales. Quand un administrateur est aussi gérant d'une autre société, l'extrait RCCM de cette société le confirme. Chaque nom trouvé ici que la direction n'a pas cité spontanément retourne à la direction sous forme de question."),
        P("records", "Review the bank confirmations, the minutes and the significant contracts for names not on the register.", "Examiner les confirmations bancaires, les procès-verbaux et les contrats significatifs à la recherche de noms absents du registre.", "Bank confirmations · minutes (E6.4) · contract file", "Confirmations bancaires · procès-verbaux (E6.4) · chrono des contrats", "Re-read the bank confirmations for guarantees given to or received from group companies, the minutes for conventions réglementées authorised, and the biggest contracts for counterparties sharing an address, a signatory or a phone number with the entity. Run the register names through the customer and supplier masters in the accounting software (Sage/SAARI) to catch trading relationships. A counterparty with no visible business rationale earns a line of its own.", "Relire les confirmations bancaires pour les garanties données à ou reçues de sociétés du groupe, les procès-verbaux pour les conventions réglementées autorisées, et les plus gros contrats pour des contreparties partageant une adresse, un signataire ou un numéro de téléphone avec l'entité. Passer les noms du registre dans les fichiers clients et fournisseurs du logiciel comptable (Sage/SAARI) pour détecter les relations commerciales. Une contrepartie sans logique économique visible mérite sa propre ligne."),
        P("transactions", "Obtain the transactions with each related party for the period, with the amounts, the balances outstanding and the terms.", "Obtenir les opérations réalisées avec chaque partie liée sur l'exercice, avec les montants, les soldes et les conditions.", "General ledger · related party schedule · contracts", "Grand livre · état des parties liées · contrats", "For each name on the register, extract from the general ledger the shareholder and group current accounts (46x), the sales and purchases with that party, and the closing balance with its terms — interest rate, security, repayment date. Ask for the written agreement behind each material balance; an undocumented compte courant d'associé is common and still has to be evidenced. Note terms no independent party would accept — zero interest, no due date — for the fair presentation view.", "Pour chaque nom du registre, extraire du grand livre les comptes courants d'associés et de groupe (comptes 46), les ventes et achats avec la partie, et le solde de clôture avec ses conditions — taux d'intérêt, sûreté, date de remboursement. Demander la convention écrite derrière chaque solde significatif ; un compte courant d'associé sans écrit est courant et doit néanmoins être documenté. Relever les conditions qu'aucun tiers indépendant n'accepterait — intérêt nul, aucune échéance — pour le jugement sur l'image fidèle."),
        P("outside", "Identify the transactions outside the normal course of business, and record each as a significant risk.", "Identifier les opérations hors du cours normal des affaires et consigner chacune comme risque important.", "ISA 550 ¶18 · S3.1", "ISA 550 ¶18 · S3.1", "Screen the schedule against normal course: sales of assets to a director, loans to shareholders at no interest, management fees with no service behind them, prices far from the market. Enter each such transaction on S3.1 as a significant risk, with the business rationale management gives — or the absence of one. The rationale question, 'why route this through the shareholder's company?', is the fraud test; record the answer verbatim.", "Passer le tableau au crible du cours normal des affaires : cessions d'actifs à un administrateur, prêts aux actionnaires sans intérêt, management fees sans prestation derrière, prix éloignés du marché. Inscrire chaque opération de ce type dans S3.1 comme risque important, avec la justification économique donnée par la direction — ou son absence. La question de la justification, 'pourquoi faire passer ceci par la société de l'actionnaire ?', est le test de fraude ; consigner la réponse mot pour mot."),
        P("team", "Communicate the related party names to the engagement team so that members remain alert to them during execution.", "Communiquer les noms des parties liées à l'équipe afin qu'elle y reste attentive pendant l'exécution.", "ISA 550 ¶17 · team briefing (P5.2)", "ISA 550 ¶17 · réunion d'équipe (P5.2)", "Put the register names on a single page and hand it out at the team briefing in P5.2, with the instruction to flag any of those names seen on an invoice, contract or payment during execution. Tell juniors what to do on a hit: note the document reference and bring it to the senior, not resolve it themselves. Recirculate the page if a new party surfaces mid-audit.", "Tenir les noms du registre sur une seule page et la distribuer au briefing d'équipe de P5.2, avec la consigne de signaler tout nom aperçu sur une facture, un contrat ou un paiement pendant l'exécution. Dire aux assistants quoi faire en cas de détection : noter la référence du document et la remonter au chef de mission, sans trancher eux-mêmes. Rediffuser la page si une nouvelle partie apparaît en cours de mission."),
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

/* ---------------------------------------------------------------- S4.4 --- */
const D5_7: PaperDef = {
  std: "ISA 540 (Revised) ¶13–17, ¶19–20",
  ownsEn: "the inventory of accounting estimates and the planned approach to each",
  ownsFr: "l'inventaire des estimations comptables et l'approche retenue pour chacune",
  reqEn: [
    "We obtain an understanding of the entity's accounting estimates: how management identifies the need for them, the method, assumptions and data used, and the controls over the process (ISA 540 (Revised) ¶13). We evaluate the degree of estimation uncertainty and the degree to which the estimate is subject to complexity, subjectivity or other inherent risk factors (ISA 540 ¶16).",
    "The assessment separates inherent risk from control risk and drives the choice of approach in execution: testing management's process, developing our own point estimate or range, or obtaining evidence from events occurring up to the date of the report (ISA 540 ¶21–29). The work is performed in E6.7.",
  ],
  reqFr: [
    "Nous prenons connaissance des estimations comptables : identification du besoin, méthode, hypothèses et données utilisées, et contrôles du processus (ISA 540 révisée ¶13). Nous apprécions le degré d'incertitude d'estimation et les facteurs de risque inhérent (ISA 540 ¶16).",
    "L'évaluation sépare le risque inhérent du risque lié au contrôle et détermine l'approche en exécution (ISA 540 ¶21–29). Les travaux sont réalisés en E6.7.",
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
        P("inventory", "List the accounting estimates in the financial statements, including impairment, provisions, depreciation lives, receivable allowances, employee benefits and any fair value.", "Recenser les estimations comptables : dépréciations, provisions, durées d'amortissement, dépréciation des créances, avantages du personnel et justes valeurs.", "Prior financial statements · trial balance · accounting policies", "États financiers antérieurs · balance · méthodes comptables", "Walk the DSF line by line — balance sheet first, then the notes — and list every figure resting on judgement: depreciation lives, allowances on receivables and inventory, provisions for litigation and retirement benefits (indemnités de fin de carrière), any fair value. The notes catch the estimates the balance sheet hides. Tie each estimate to its trial balance accounts (29x, 39x, 49x, 19x) so the inventory does not depend on memory.", "Parcourir la DSF ligne à ligne — le bilan d'abord, puis les notes annexes — et lister chaque chiffre reposant sur un jugement : durées d'amortissement, dépréciations des créances et des stocks, provisions pour litiges et indemnités de fin de carrière, toute juste valeur. Les notes annexes révèlent les estimations que le bilan cache. Rattacher chaque estimation à ses comptes de la balance (29x, 39x, 49x, 19x) pour que l'inventaire ne repose pas sur la mémoire."),
        P("method", "For each estimate obtain the method, the model where one is used, the significant assumptions, and the data on which it draws.", "Pour chaque estimation, obtenir la méthode, le modèle éventuel, les hypothèses importantes et les données utilisées.", "Management's calculation · policy note · inquiry", "Calcul de la direction · note de méthode · entretien", "For each estimate, have the finance director hand over the actual calculation — the spreadsheet, not a description of it. Record the method (formula, ageing grid, actuarial factors), the assumptions you can point at (discount rate, recovery rate, staff turnover) and the data feeding it (aged balance from Sage, payroll file). If the answer is 'the same percentage as every year', write that down — that is an assumption too, and often the weakest one.", "Pour chaque estimation, se faire remettre le calcul lui-même par le directeur financier — le fichier Excel, pas sa description. Consigner la méthode (formule, grille d'ancienneté, facteurs actuariels), les hypothèses désignables (taux d'actualisation, taux de récupération, rotation du personnel) et les données utilisées (balance âgée tirée de Sage, fichier de paie). Si la réponse est 'le même pourcentage que chaque année', l'écrire — c'est aussi une hypothèse, et souvent la plus fragile."),
        P("controls", "Obtain the controls over the estimation process, including who reviews and approves the assumptions.", "Obtenir les contrôles du processus d'estimation, notamment qui revoit et approuve les hypothèses.", "Process narrative · approval evidence · P4.1", "Descriptif de processus · preuves d'approbation · P4.1", "Establish who prepares each calculation, who reviews it, and what trace the review leaves — a visa on the printout, an email, a board minute for the large provisions. In a small entity the preparer and the approver are often the same finance director; note it and set control risk accordingly. Ask whether the assumptions were re-examined this year or simply rolled forward.", "Établir qui prépare chaque calcul, qui le revoit, et quelle trace laisse la revue — un visa sur l'état imprimé, un courriel, un procès-verbal du conseil pour les grosses provisions. Dans une petite entité, le préparateur et l'approbateur sont souvent le même directeur financier ; le noter et coter le risque lié au contrôle en conséquence. Demander si les hypothèses ont été réexaminées cette année ou simplement reconduites."),
        P("outcome", "Compare the prior period estimates with their subsequent outcome, and evaluate whether the difference indicates bias or a weakness in the method.", "Comparer les estimations de l'exercice précédent à leur dénouement et apprécier si l'écart révèle un biais ou une faiblesse de méthode.", "Prior financial statements · current period actuals · ISA 540 ¶14", "États financiers antérieurs · réalisations de l'exercice · ISA 540 ¶14", "Take last year's closing estimates and compare each against what actually happened: provisions against amounts finally paid, allowances against amounts recovered, useful lives against assets still running at nil book value. Compute the difference and its direction — errors always falling in the entity's favour point to bias, not imprecision. Feed a one-sided pattern back into P5.1 and into the significant-risk call in procedure 5.", "Reprendre les estimations de clôture de l'an dernier et comparer chacune à ce qui s'est réellement produit : provisions contre sommes finalement payées, dépréciations contre montants recouvrés, durées d'utilité contre immobilisations encore en service à valeur nette nulle. Calculer l'écart et son sens — des erreurs toujours favorables à l'entité signalent un biais, pas une imprécision. Répercuter un profil à sens unique dans P5.1 et dans la décision de risque important de la procédure 5."),
        P("uncertainty", "Evaluate for each estimate the degree of estimation uncertainty, and whether complexity, subjectivity or other inherent risk factors are present.", "Apprécier pour chaque estimation le degré d'incertitude et la présence de complexité, de subjectivité ou d'autres facteurs de risque inhérent.", "ISA 540 ¶16 · management's sensitivity analysis", "ISA 540 ¶16 · analyse de sensibilité de la direction", "For each estimate, ask how different the figure could reasonably be: move the key assumption within a plausible range and see whether the swing crosses materiality. Use management's sensitivity analysis where one exists; where none does, a rough recalculation at a high and a low assumption on your own spreadsheet does the job. High uncertainty plus a subjective assumption puts the estimate at the top of the spectrum — carry it to S3.1 as a significant risk.", "Pour chaque estimation, se demander à quel point le chiffre pourrait raisonnablement différer : faire varier l'hypothèse clé dans une fourchette plausible et voir si l'écart franchit le seuil de signification. Utiliser l'analyse de sensibilité de la direction quand elle existe ; à défaut, un recalcul sommaire à hypothèse haute et basse sur votre propre tableur suffit. Forte incertitude plus hypothèse subjective placent l'estimation en haut du spectre — la reporter dans S3.1 comme risque important."),
        P("approach", "Set the approach for each estimate: test management's process, develop our own point estimate or range, or use events up to the date of the report. Record which and why.", "Arrêter l'approche pour chaque estimation : tester le processus de la direction, développer notre propre estimation ou fourchette, ou utiliser les événements jusqu'à la date du rapport. Consigner le choix et son motif.", "ISA 540 ¶21–29 · E6.7", "ISA 540 ¶21–29 · E6.7", "Match the approach to what the retrospective review and the uncertainty assessment showed: a stable, well-controlled ageing calculation can be tested as management's process; a litigation provision resting on one assumption is often better audited through your own range built from the avocat's letter; a receivable allowance can be tested against cash received after year end. Write one line per estimate saying which route and why, and carry it into E6.7.", "Adapter l'approche à ce qu'ont montré la revue rétrospective et l'évaluation de l'incertitude : un calcul d'ancienneté stable et bien contrôlé se teste comme processus de la direction ; une provision pour litige reposant sur une seule hypothèse s'audite souvent mieux par votre propre fourchette bâtie sur la lettre de l'avocat ; une dépréciation de créances se teste par les encaissements après la clôture. Écrire une ligne par estimation disant quelle voie et pourquoi, et la reporter dans E6.7."),
        P("expert", "Identify the estimates requiring an auditor's expert, and cross-refer to S5.1.", "Identifier les estimations requérant un expert de l'auditeur et renvoyer à S5.1.", "S5.1 · P2.2", "S5.1 · P2.2", "Flag the estimates beyond the team's competence — actuarial retirement benefits, property valuations, complex financial instruments — and open S5.1 for each with the expert's name and scope. Decide now: engaging an actuary in the OHADA market takes weeks, not days. Put the cost into the budget in P2.2 before execution starts.", "Repérer les estimations dépassant la compétence de l'équipe — indemnités de fin de carrière actuarielles, évaluations immobilières, instruments financiers complexes — et ouvrir S5.1 pour chacune avec le nom et l'étendue de la mission de l'expert. Décider maintenant : engager un actuaire sur le marché OHADA prend des semaines, pas des jours. Inscrire le coût au budget de P2.2 avant le début de l'exécution."),
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

/* ---------------------------------------------------------------- S3.1 --- */
const D7_2: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶28–34 · ISA 330 ¶5–15 · ISA 240",
  ownsEn: "the assessed risks and the planned response to each",
  ownsFr: "les risques évalués et la réponse prévue pour chacun",
  tools: ["what-can-go-wrong", "strategy"],
  reqEn: [
    "We identify and assess the risks of material misstatement at the financial statement level and at the assertion level for classes of transactions, account balances and disclosures (ISA 315 (Revised 2019) ¶28). Inherent risk and control risk are assessed separately (ISA 315 ¶34).",
    "We design and implement overall responses to the assessed risks at financial statement level, and further audit procedures whose nature, timing and extent are based on and responsive to the assessed risks at assertion level (ISA 330 ¶5–6). For every significant risk, substantive procedures include tests of details (ISA 330 ¶21).",
    "Inherent risk is assessed on a spectrum, by weighing together the likelihood that a misstatement occurs and the magnitude it would have if it did (ISA 315 (Revised 2019) ¶31, A208). The inherent risk factors — complexity, subjectivity, change, uncertainty and susceptibility to management bias or fraud — determine where on that spectrum each risk sits. A risk assessed close to the upper end of the spectrum is a significant risk by definition (ISA 315 ¶12(l), ¶32), and that classification carries mandatory consequences: substantive procedures that include tests of details (ISA 330 ¶21) and, where reliance on controls is planned, tests of operating effectiveness in the current period (ISA 330 ¶15).",
    "Inherent risk and control risk are assessed separately (ISA 315 (Revised 2019) ¶34). Control risk may be assessed below the maximum only where we plan to test the operating effectiveness of controls; where no such reliance is planned, the assessment of control risk is such that the assessment of the risk of material misstatement is the same as the assessment of inherent risk (ISA 315 ¶34). The combined assessment then drives the mix of further procedures under ISA 330 ¶7: the higher the assessed risk, the more persuasive the evidence required — larger samples, more reliable externally sourced evidence, and work moved to or after the period end rather than an interim date.",
  ],
  reqFr: [
    "Nous identifions et évaluons les risques d'anomalies significatives au niveau des états financiers et des assertions (ISA 315 révisée ¶28). Le risque inhérent et le risque lié au contrôle sont évalués séparément (ISA 315 ¶34).",
    "Nous concevons des réponses globales et des procédures complémentaires dont la nature, le calendrier et l'étendue répondent aux risques évalués (ISA 330 ¶5–6). Pour chaque risque important, les procédures de substance comprennent des tests de détail (ISA 330 ¶21).",
    "Le risque inhérent s'apprécie sur un spectre, en pesant ensemble la probabilité qu'une anomalie survienne et son ampleur si elle survenait (ISA 315 (Révisée 2019) ¶31, A208). Les facteurs de risque inhérent — complexité, subjectivité, changement, incertitude et propension au biais de la direction ou à la fraude — déterminent où chaque risque se situe sur ce spectre. Un risque évalué près du haut du spectre est par définition un risque important (ISA 315 ¶12(l), ¶32), et cette qualification emporte des conséquences obligatoires : des procédures substantives comportant des tests de détail (ISA 330 ¶21) et, si un appui sur les contrôles est prévu, des tests d'efficacité du fonctionnement sur la période en cours (ISA 330 ¶15).",
    "Le risque inhérent et le risque lié au contrôle sont évalués séparément (ISA 315 (Révisée 2019) ¶34). Le risque lié au contrôle ne peut être évalué en dessous du maximum que si nous prévoyons de tester l'efficacité du fonctionnement des contrôles ; à défaut, l'évaluation du risque d'anomalies significatives est la même que celle du risque inhérent (ISA 315 ¶34). L'évaluation combinée commande ensuite le dosage des procédures complémentaires selon ISA 330 ¶7 : plus le risque évalué est élevé, plus les éléments probants doivent être convaincants — échantillons plus larges, éléments d'origine externe plus fiables, travaux déplacés à la clôture ou après plutôt qu'à une date intercalaire.",
  ],
  conclEn: [
    "Every assessed risk has a planned response recorded against it, and every significant risk has a test of details among its responses.",
    "The overall responses at financial statement level reflect the control environment conclusion in P4.2 and include an element of unpredictability.",
  ],
  conclFr: [
    "Chaque risque évalué dispose d'une réponse prévue, et chaque risque important comporte un test de détail parmi ses réponses.",
    "Les réponses globales reflètent la conclusion de P4.2 sur l'environnement de contrôle et comportent une part d'imprévisibilité.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        P("gather", "Bring together the risks identified in the earlier papers: the team discussion, the preliminary analytics, internal control, fraud, going concern, related parties and estimates.", "Rassembler les risques identifiés dans les feuilles précédentes : réunion d'équipe, analyses préliminaires, contrôle interne, fraude, continuité, parties liées et estimations.", "P5.2 · P3.2 · P4.1 · P5.1 · S4.2 · S4.3 · S4.4", "P5.2 · P3.2 · P4.1 · P5.1 · S4.2 · S4.3 · S4.4", "Open the risk register beside P5.2, P3.2, P4.1, P5.1 and S4.2 to S4.4 and copy each risk across with the reference of the paper it came from, so one register carries everything. Where two papers describe the same exposure — the fraud discussion and the preliminary analytics both pointing at revenue cut-off, say — merge them into one line and keep both source references. A risk with no source paper behind it was invented at this stage; go back and anchor it to the work that supports it.", "Ouvrir le registre des risques à côté de P5.2, P3.2, P4.1, P5.1 et S4.2 à S4.4 et y reporter chaque risque avec la référence du papier de travail d'origine, pour que tout tienne dans un seul registre. Quand deux papiers décrivent la même exposition — la discussion fraude et l'examen analytique préliminaire visant tous deux la séparation des exercices sur les ventes — fusionner en une seule ligne en conservant les deux références. Un risque sans papier de travail d'origine a été inventé à ce stade ; retourner l'ancrer aux travaux qui le fondent."),
        P("assertion", "For each significant class of transactions, balance and disclosure, identify what can go wrong and state the assertion affected.", "Pour chaque flux, solde et note significatifs, identifier ce qui peut mal tourner et préciser l'assertion concernée.", "Significant account analysis · what-can-go-wrong tool", "Analyse des comptes significatifs · outil des risques d'erreur", "Work down the trial balance account by account: for each significant line, write what can go wrong in one plain sentence — 'sales invoiced before delivery' — then name the single assertion it hits: cut-off, existence, valuation. Resist ticking every assertion; a risk said to affect everything has not been thought through. The mapping decides which execution programme picks the risk up, so be precise.", "Descendre la balance générale compte par compte : pour chaque ligne significative, écrire ce qui peut mal tourner en une phrase simple — 'ventes facturées avant livraison' — puis nommer l'assertion touchée : séparation des exercices, existence, évaluation. Résister à la tentation de cocher toutes les assertions ; un risque censé tout affecter n'a pas été analysé. Ce rattachement détermine quel programme d'exécution reprendra le risque, donc être précis."),
        P("separate", "Assess inherent risk and control risk separately for each risk identified, and record the basis for each assessment.", "Évaluer séparément le risque inhérent et le risque lié au contrôle pour chaque risque identifié et consigner le fondement de chaque appréciation.", "ISA 315 (Revised 2019) ¶34 · P4.1 · P4.2", "ISA 315 révisée ¶34 · P4.1 · P4.2", "Rate inherent risk first, on the facts from the entity understanding and P5.1, before looking at any control. Then rate control risk from P4.1 and P4.2: it stays at maximum unless the control has been identified and you plan to test it. Write one sentence of basis for each rating — 'cash sales, no independent reconciliation' — not just an H, M or L.", "Coter d'abord le risque inhérent, sur les faits tirés de la connaissance de l'entité et de P5.1, avant de regarder le moindre contrôle. Coter ensuite le risque lié au contrôle à partir de P4.1 et P4.2 : il reste au maximum tant que le contrôle n'a pas été identifié et que son test n'est pas prévu. Écrire une phrase de justification pour chaque cotation — 'ventes au comptant, aucun rapprochement indépendant' — pas seulement une lettre E, M ou F."),
        P("significant", "Determine which risks are significant risks, having regard to the inherent risk factors and where the risk sits on the spectrum of inherent risk.", "Déterminer quels risques sont des risques importants, au regard des facteurs de risque inhérent et de leur position sur le spectre.", "ISA 315 (Revised 2019) ¶32 · P5.1 · S4.3 · S4.4", "ISA 315 révisée ¶32 · P5.1 · S4.3 · S4.4", "For each risk, ask how likely the misstatement is and how large it would be if it happened; a risk near the top on both counts is a significant risk. Test it against the inherent risk factors — complexity, subjectivity, change, uncertainty, susceptibility to bias: revenue split across cash and mobile money, or a provision built on management's own assumptions, will usually qualify. Remember the presumed fraud risk in revenue recognition from P5.1 is significant without further debate.", "Pour chaque risque, se demander quelle est la probabilité de l'anomalie et quelle serait son ampleur si elle survenait ; un risque haut sur les deux échelles est un risque important. Le confronter aux facteurs de risque inhérent — complexité, subjectivité, changement, incertitude, propension au biais : un chiffre d'affaires réparti entre espèces et mobile money, ou une provision assise sur les seules hypothèses de la direction, se qualifieront le plus souvent. Se rappeler que le risque de fraude présumé sur la comptabilisation des produits, issu de P5.1, est important sans autre débat."),
        P("fs_level", "Identify the risks at financial statement level and set the overall responses, including team composition, supervision, and an element of unpredictability.", "Identifier les risques au niveau des états financiers et arrêter les réponses globales : composition de l'équipe, supervision et part d'imprévisibilité.", "ISA 330 ¶5 · ISA 240 ¶29 · P4.2", "ISA 330 ¶5 · ISA 240 ¶29 · P4.2", "Pervasive exposures — management override, going concern doubt, a weak control environment — belong here rather than against a single account. Respond with the make-up of the team (a more experienced senior, EQR involvement), closer supervision and review, and something the client cannot predict: an unannounced cash count, a site visit off the usual list, journal entries drawn from an odd period. Write the unpredictable element down now; it is the first thing dropped in execution.", "Les expositions transversales — contournement des contrôles par la direction, doute sur la continuité, environnement de contrôle faible — se traitent ici plutôt que sur un compte isolé. Répondre par la composition de l'équipe (un chef de mission plus expérimenté, revue EQR), une supervision et une revue resserrées, et un élément que le client ne peut pas prévoir : un comptage de caisse inopiné, une visite de site hors liste habituelle, des écritures de journal tirées d'une période inhabituelle. Consigner l'élément d'imprévisibilité dès maintenant ; c'est le premier abandonné en exécution."),
        P("strategy", "Set the strategy for each assertion-level risk: controls reliance or fully substantive, and record why. A controls-reliance strategy requires tests of operating effectiveness.", "Arrêter la stratégie pour chaque risque au niveau des assertions : appui sur les contrôles ou approche substantive, avec les motifs. L'appui sur les contrôles impose des tests d'efficacité.", "ISA 330 ¶8 · P4.1 · E1.1/E1.2", "ISA 330 ¶8 · P4.1 · E1.1/E1.2", "Choose reliance only where P4.1 shows the control exists and was implemented, and where testing it costs less than the substantive work it would save — rare with the manual controls of a small OHADA entity. Record the why in one line per assertion: 'automated three-way match in Sage, operating effectiveness tested in E1.1'. Where no test of controls is planned, hold control risk at maximum and let the substantive procedures carry the assertion alone.", "Ne retenir une stratégie d'appui sur les contrôles que là où P4.1 montre que le contrôle existe et a été mis en oeuvre, et où son test coûte moins que le travail substantif qu'il éviterait — rare avec les contrôles manuels d'une petite entité OHADA. Consigner le pourquoi en une ligne par assertion : 'rapprochement automatique commande-livraison-facture dans Sage, efficacité testée en E1.1'. Si aucun test de contrôles n'est prévu, maintenir le risque lié au contrôle au maximum et laisser les procédures substantives porter seules l'assertion."),
        P("details", "For every significant risk, plan substantive procedures that include tests of details.", "Pour chaque risque important, prévoir des procédures de substance comprenant des tests de détail.", "ISA 330 ¶21 · execution programme", "ISA 330 ¶21 · programme d'exécution", "For every significant risk, name the actual test of details in the execution programme now: the population, the documents (invoices, delivery notes, bank statements), the direction of testing. Analytical procedures alone cannot carry a significant risk, however persuasive they look. Cross-refer the register line to the programme step so a reviewer can walk from risk to response without asking.", "Pour chaque risque important, nommer dès maintenant le test de détail dans le programme d'exécution : la population, les documents (factures, bons de livraison, relevés bancaires), le sens du test. Les procédures analytiques seules ne peuvent pas porter un risque important, si convaincantes soient-elles. Renvoyer la ligne du registre vers l'étape du programme pour qu'un réviseur passe du risque à la réponse sans poser de question."),
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

/* -------------------------------------------------------------- P3.1 ----- */
const D4_2: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶19(a)–(c), ¶22",
  ownsEn: "the understanding of the entity, its environment and the framework",
  ownsFr: "la connaissance de l'entité, de son environnement et du référentiel",
  reqEn: [
    "We obtain an understanding of the entity's organisational structure, ownership and governance, its business model, the industry, regulatory and other external factors, and the applicable financial reporting framework and the entity's accounting policies (ISA 315 (Revised 2019) ¶19).",
    "The understanding is obtained to identify risks, not for its own sake. Each matter recorded is either carried into the risk assessment or noted as giving rise to no risk (ISA 315 ¶31: the evaluation of whether the understanding provides an appropriate basis).",
    "Risk assessment procedures combine inquiries of management and others, analytical procedures, and observation and inspection — inquiry alone is not enough (ISA 315 ¶14). The engagement team discussion (P5.2) shares what each member knows about the entity.",
    "The business model and the measures management uses to assess performance deserve particular attention: they show where the pressure to misstate can arise and which balances carry estimation or judgement (ISA 315 ¶A62–A67).",
  ],
  reqFr: [
    "Nous prenons connaissance de la structure, de l'actionnariat et de la gouvernance de l'entité, de son modèle économique, des facteurs externes, du référentiel applicable et de ses méthodes comptables (ISA 315 révisée ¶19).",
    "Cette connaissance sert à identifier des risques. Chaque élément consigné est soit repris dans l'évaluation des risques, soit noté comme n'en générant aucun (ISA 315 ¶31).",
    "Les procédures d'évaluation des risques combinent entretiens, procédures analytiques, observation et inspection — l'entretien seul ne suffit pas (ISA 315 ¶14). La discussion d'équipe (P5.2) partage la connaissance de chacun.",
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
        P("related", "Obtain the list of related parties and the nature of the relationships and transactions with each, and carry it forward to S4.4.", "Obtenir la liste des parties liées, la nature des relations et des opérations avec chacune, et la reporter en S4.4.", "Inquiry of management · share register · board minutes · S4.4", "Entretien avec la direction · registre des titres · procès-verbaux · S4.4",
          "Build the list while you are already holding the share register and the minutes from procedure 2: shareholders and their other companies, directors and their businesses, family members in the entity, group companies. Ask management to confirm it is complete and to describe the transactions with each — loans to shareholders and management fees are where OHADA audits find them.",
          "Établir la liste pendant que le registre des titres et les procès-verbaux de la procédure 2 sont encore sous la main : actionnaires et leurs autres sociétés, dirigeants et leurs affaires, membres de la famille dans l'entité, sociétés du groupe. Faire confirmer par la direction que la liste est complète et décrire les opérations avec chacune — comptes courants d'associés et frais de gestion sont là où les audits OHADA les trouvent."),
        P("gc_status", "Obtain the status of management's assessment of the entity's ability to continue as a going concern, and note the events or conditions already known.", "Obtenir l'état de l'évaluation par la direction de la capacité de l'entité à poursuivre son exploitation, et relever les événements ou circonstances déjà connus.", "Inquiry of management · cash-flow forecast · S4.2", "Entretien avec la direction · prévision de trésorerie · S4.2",
          "Ask management whether they have assessed going concern and over what period, and whether a forecast exists. Note what is already visible: negative equity (and any AGM decision under the OHADA net-asset rule), overdue tax or social liabilities, a lost customer or financing due for renewal. The full assessment is S4.2's work — here you record its status and the known warning signs.",
          "Demander à la direction si elle a évalué la continuité d'exploitation, sur quelle période, et si une prévision existe. Relever ce qui est déjà visible : capitaux propres négatifs (et toute décision d'AG au titre de la règle OHADA de l'actif net), dettes fiscales ou sociales en retard, client perdu ou financement à renouveler. L'évaluation complète relève de S4.2 — ici on consigne son état et les signaux connus."),
        P("carry", "Carry each matter identified into the risk register, or record why it gives rise to no risk of material misstatement.", "Reporter chaque élément relevé au registre des risques ou consigner pourquoi il ne génère aucun risque d'anomalie significative.", "S3.1 risk register", "Registre des risques S3.1",
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
        { key: "related_gc", en: "The related-party list has been carried to S4.4, and the status of management's going-concern assessment recorded for S4.2 (procedures 8, 9).", fr: "La liste des parties liées a été reportée en S4.4, et l'état de l'évaluation de la continuité d'exploitation consigné pour S4.2 (procédures 8, 9)." },
        { key: "changes", en: "Each change since the prior period has been understood and its accounting effect identified (procedure 5).", fr: "Chaque changement depuis l'exercice précédent est compris et son effet comptable identifié (procédure 5)." },
        { key: "carried", en: "Each matter identified has been carried into the risk register or explained (procedure 7).", fr: "Chaque élément relevé est repris au registre des risques ou justifié (procédure 7)." },
      ],
    },
  ],
};

export const STRATEGY_PAPERS: Record<string, PaperDef> = {
  "S6.1": S5_1,
  "S6.2": D4_1,
  "P5.2": D7_1,
  "P3.1": D4_2,
  "P3.2": D4_3,
  "P4.1": D4_4,
  "P4.2": D4_5,
  "P4.3": D4_6,
  "S5.1": D4_7,
  "S5.2": D4_8,
  "S5.3": D4_9,
  "P6.1": D5_1,
  "S4.1": D5_2,
  "P5.1": D5_4,
  "S4.2": D5_5,
  "S4.3": D5_6,
  "S4.4": D5_7,
  "S3.1": D7_2,
};
