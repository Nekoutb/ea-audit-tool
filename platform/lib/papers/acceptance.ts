// The seven acceptance working papers, ported from the console proposal.
// Register: imperative for procedures, first person plural for firm positions,
// one idea per sentence, no rhetorical framing. Every abbreviation used here is
// spelled out on first use in the narrative.

import type { PaperDef } from "@/lib/papers/types";

/* ---------------------------------------------------------------- P1.1 --- */
const D3_1: PaperDef = {
  std: "ISQM 1 ¶30 · ISA 220 (Revised) ¶22–24 · IESBA Code §320",
  ownsEn: "the client risk rating and the integrity conclusion",
  ownsFr: "la notation du risque client et la conclusion sur l'intégrité",
  reqEn: [
    "The firm may accept or continue a client relationship only where it has obtained information about the nature and circumstances of the engagement and about the integrity and ethical values of the client, including its management, its owners and those charged with governance (ISQM 1 ¶30(a)). The engagement partner determines that the firm's acceptance procedures have been followed, and remains alert throughout for information that would have caused the firm to decline (ISA 220 (Revised) ¶22–24).",
    "The IESBA Code treats doubt over a client's integrity as a source of threats to compliance with the fundamental principles, and requires those threats to be identified and evaluated before an appointment is accepted (IESBA Code §320). Part A obtains that information from registry records, screening results, media coverage, third-party references and the predecessor auditor's response.",
    "The reason for the change of auditor is corroborated with the predecessor auditor and is not accepted on management's account alone, particularly where the change follows a disagreement over an accounting or auditing matter or a restriction on the previous auditor's work (ISA 300 ¶13; procedures performed under P1.2).",
    "For each screening performed, record the database searched, the date, the terms used and the disposition of every match. A match dismissed without a recorded reason is an unresolved matter for the purposes of the risk rating.",
  ],
  reqFr: [
    "Le cabinet ne peut accepter ou maintenir une relation client que s'il a obtenu des informations sur la nature et les circonstances de la mission ainsi que sur l'intégrité et les valeurs éthiques du client, y compris sa direction, ses propriétaires et les responsables de la gouvernance (ISQM 1 ¶30(a)).",
    "Le Code IESBA considère un doute sur l'intégrité du client comme une source de risques pour le respect des principes fondamentaux, à identifier et évaluer avant l'acceptation (Code IESBA §320).",
    "Le motif du changement d'auditeur est corroboré auprès du prédécesseur et n'est pas retenu sur la seule déclaration de la direction (ISA 300 ¶13 ; travaux en P1.2).",
    "Pour chaque criblage, consigner la base consultée, la date, les termes utilisés et le traitement de chaque correspondance.",
  ],
  conclEn: [
    "Nothing has come to our attention from the procedures in this paper to indicate that the client lacks integrity, and acceptance of this engagement is appropriate.",
    "The client risk rating recorded below is supported by the evidence in this paper.",
  ],
  conclFr: [
    "Rien dans les travaux consignés ici n'indique un défaut d'intégrité du client, et l'acceptation de la mission est appropriée.",
    "La notation du risque client ci-dessous est étayée par les éléments consignés.",
  ],
  sections: [
    {
      kind: "fields",
      titleEn: "Engagement profile",
      titleFr: "Profil de la mission",
      introEn: "Select what applies before performing the procedures.",
      introFr: "Sélectionner ce qui s'applique avant de mettre en œuvre les procédures.",
      fields: [
        { key: "engagement_type", kind: "select", labelEn: "Engagement type", labelFr: "Type de mission", options: [
          { value: "new", en: "New engagement", fr: "Nouvelle mission" },
          { value: "recurring", en: "Recurring engagement", fr: "Mission récurrente" },
        ] },
        { key: "auditor_change", kind: "select", labelEn: "Change of auditor?", labelFr: "Changement d'auditeur ?", options: [
          { value: "yes", en: "Yes — predecessor communication applies (P1.2)", fr: "Oui — communication avec le prédécesseur (P1.2)" },
          { value: "no", en: "No", fr: "Non" },
        ] },
      ],
    },
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn:
        "Perform each procedure and record the result, stating what was obtained, from whom or from which source, and the reference of the evidence filed. Where an expected source is not available, record the alternative used and why it is sufficient.",
      introFr:
        "Mettre en œuvre chaque procédure et consigner le résultat : ce qui a été obtenu, auprès de qui ou de quelle source, et la référence du dossier.",
      procs: [
        { key: "docs", en: "Obtain and inspect the entity's constitutive and registration documents. Record the legal form, registered office and registration numbers.", fr: "Obtenir et examiner les statuts et documents d'immatriculation. Consigner la forme juridique, le siège et les numéros d'immatriculation.", srcEn: "Statutes · RCCM extract · tax registration certificate", srcFr: "Statuts · extrait RCCM · attestation d'immatriculation fiscale" },
        { key: "owners", en: "Obtain the ownership structure down to the ultimate beneficial owners. Agree it to the share register and the shareholder minutes.", fr: "Obtenir la structure de l'actionnariat jusqu'aux bénéficiaires effectifs. La rapprocher du registre des titres et des procès-verbaux.", srcEn: "Share register · statutes · shareholder minutes · inquiry of management", srcFr: "Registre des titres · statuts · procès-verbaux · entretien avec la direction" },
        { key: "activities", en: "Inquire of management about the entity's activities, operating locations and principal customers and suppliers. Corroborate the responses against independent information.", fr: "S'enquérir auprès de la direction des activités, implantations et principaux clients et fournisseurs. Corroborer par des informations indépendantes.", srcEn: "Interview with management · prior financial statements · entity website · site visit", srcFr: "Entretien · états financiers antérieurs · site internet · visite de site" },
        { key: "licences", en: "Identify the regulators and licences that apply to the entity's sector. Inspect the licences held and the most recent correspondence with each regulator.", fr: "Identifier les régulateurs et agréments applicables au secteur. Examiner les agréments détenus et la correspondance récente.", srcEn: "Licence documents · regulator correspondence · firm sector knowledge", srcFr: "Agréments · correspondance des régulateurs · connaissance sectorielle" },
        { key: "screening", en: "Screen the entity, its principal owners, directors and key management against sanctions lists, politically exposed person lists and adverse media. Record each search, with the database, date and terms used, and the disposition of every match.", fr: "Cribler l'entité, ses propriétaires, dirigeants et cadres dirigeants au regard des listes de sanctions, des listes de personnes politiquement exposées et des médias défavorables. Consigner chaque recherche et le traitement de chaque correspondance.", srcEn: "Sanctions and PEP screening service · adverse media databases", srcFr: "Service de criblage sanctions et PPE · bases de presse défavorable" },
        { key: "media", en: "Search press and internet sources for indications of fraud, litigation, insolvency or regulatory action against the entity or its principals. Record the terms and dates of the searches.", fr: "Rechercher dans la presse et sur internet des indices de fraude, litige, insolvabilité ou action réglementaire. Consigner les termes et dates.", srcEn: "Press archives · internet search", srcFr: "Archives de presse · moteurs de recherche" },
        { key: "predecessor", en: "Communicate with the predecessor auditor on matters bearing on integrity. The communication itself is performed and filed under P1.2. Carry any integrity finding into Part B.", fr: "Communiquer avec l'auditeur précédent sur les questions touchant à l'intégrité. La communication est réalisée et classée en P1.2.", srcEn: "Written response of the predecessor auditor (P1.2)", srcFr: "Réponse écrite de l'auditeur précédent (P1.2)" },
        { key: "refs", en: "Obtain references on the entity and its principals from their bankers or legal advisers where the circumstances warrant it.", fr: "Obtenir des références auprès des banquiers ou conseils juridiques lorsque les circonstances le justifient.", srcEn: "Banker's reference · legal adviser's reference", srcFr: "Référence bancaire · référence du conseil juridique" },
        { key: "priorfs", en: "Inspect the prior period financial statements and auditor's reports. Note any modification, going concern reference, restatement or late filing.", fr: "Examiner les états financiers et rapports d'audit antérieurs. Relever toute modification, mention de continuité, retraitement ou dépôt tardif.", srcEn: "Prior financial statements · prior auditor's reports · filing records", srcFr: "États financiers antérieurs · rapports antérieurs · dépôts" },
        { key: "why", en: "Inquire why the auditor is being changed and what the entity expects as to scope, timing and fees. Compare the answer with the predecessor's account.", fr: "S'enquérir du motif du changement d'auditeur et des attentes en matière d'étendue, de calendrier et d'honoraires. Comparer avec la version du prédécesseur.", srcEn: "Inquiry of management · response obtained under P1.2", srcFr: "Entretien avec la direction · réponse obtenue en P1.2" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Evaluation of integrity",
      titleFr: "Partie B — Évaluation de l'intégrité",
      introEn:
        "Evaluate the results of the Part A procedures against each statement. Explain each “No” in the box beneath it and reflect it in the risk rating.",
      introFr:
        "Évaluer les résultats de la partie A au regard de chaque affirmation. Expliquer chaque « Non » dans la zone prévue et en tenir compte dans la notation.",
      items: [
        { key: "reputation", en: "The identity and business reputation of the principal owners, key management and those charged with governance raise no concern (procedures 2, 5 to 8).", fr: "L'identité et la réputation des propriétaires, cadres dirigeants et responsables de la gouvernance n'appellent pas de réserve (procédures 2, 5 à 8)." },
        { key: "operations", en: "The nature of the entity's operations and its business practices raise no concern (procedures 3, 4, 6).", fr: "La nature des activités et les pratiques commerciales n'appellent pas de réserve (procédures 3, 4, 6)." },
        { key: "attitude", en: "There is no indication of an aggressive attitude towards the application of accounting standards or towards internal control (procedures 7, 9, 10).", fr: "Aucun indice d'une attitude agressive envers l'application des normes comptables ou le contrôle interne (procédures 7, 9, 10)." },
        { key: "fees", en: "There is no undue concern with minimising our fees or with limiting the scope of our work (procedure 10).", fr: "Aucune préoccupation excessive de minimiser nos honoraires ou de limiter l'étendue de nos travaux (procédure 10)." },
        { key: "laundering", en: "There is no indication that the entity or its principals are involved in money laundering or other criminal activity (procedures 5, 6, 8).", fr: "Aucun indice d'implication dans le blanchiment ou une autre activité criminelle (procédures 5, 6, 8)." },
        { key: "change", en: "The reasons given for the change of auditor are consistent with the predecessor's account (procedures 7, 10).", fr: "Les motifs du changement d'auditeur concordent avec la version du prédécesseur (procédures 7, 10)." },
        { key: "scope", en: "Management has suggested no limitation on the scope of our work (procedure 10).", fr: "La direction n'a suggéré aucune limitation de l'étendue de nos travaux (procédure 10)." },
        { key: "related", en: "The reputation of related entities and business associates raises no concern (procedures 2, 6).", fr: "La réputation des entités liées et partenaires n'appelle pas de réserve (procédures 2, 6)." },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part C — Client risk rating",
      titleFr: "Partie C — Notation du risque client",
      introEn:
        "Weigh the Part B evaluation. A “No” answer, an unresolved screening match or an unanswered predecessor inquiry precludes a Low rating. Refer a High rating to the engagement partner before giving the client any commitment.",
      introFr:
        "Peser l'évaluation de la partie B. Un « Non », une correspondance de criblage non résolue ou une demande sans réponse auprès du prédécesseur exclut une notation Faible.",
      fields: [
        { key: "rating", kind: "select", labelEn: "Client risk rating", labelFr: "Notation du risque client", options: [
          { value: "low", en: "Low", fr: "Faible" },
          { value: "moderate", en: "Moderate", fr: "Modérée" },
          { value: "high", en: "High", fr: "Élevée" },
        ] },
        { key: "rating_why", kind: "input", labelEn: "Reasons for the rating, citing the Part A evidence, and its effect on the engagement: the review requirement under P1.5, the fraud risk baseline, staffing and supervision", labelFr: "Motifs de la notation, éléments de la partie A à l'appui, et effet sur la mission : exigence de revue (P1.5), base d'évaluation du risque de fraude, dotation et supervision" },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- P2.2 --- */
const D6_1: PaperDef = {
  std: "ISA 220 (Revised) ¶25–28 · ISQM 1 ¶32 · ISA 620 ¶9–12",
  ownsEn: "the competence, capability and resources conclusion",
  ownsFr: "la conclusion sur la compétence, la capacité et les ressources",
  reqEn: [
    "The firm obtains, develops, uses and maintains sufficient and appropriate resources — human, technological and intellectual — so that engagements are performed in accordance with professional standards (ISQM 1 ¶32). At engagement level the engagement partner determines that the resources assigned are sufficient and appropriate, and available when needed (ISA 220 (Revised) ¶25–28).",
    "Competence is assessed for the team as a whole, including any auditor's expert: its knowledge of the industry, of the applicable financial reporting framework, and of the legal and regulatory environment. A gap in one member is not a deficiency where it is covered elsewhere in the team and the work is directed and reviewed accordingly.",
    "Time forms part of the resources assessed. Where the reporting deadline cannot be met without compromising the quality of the work, the timetable is renegotiated before the engagement is accepted. The engagement partner's own availability forms part of this assessment (ISA 220 (Revised) ¶13).",
    "Where an auditor's expert is required, we must be able to evaluate that expert's competence, capabilities and objectivity, agree the nature, scope and objectives of the work, and evaluate whether the resulting work is adequate for our purposes (ISA 620 ¶9–12).",
  ],
  reqFr: [
    "Le cabinet obtient et maintient des ressources suffisantes et appropriées — humaines, technologiques et intellectuelles — pour que les missions soient réalisées conformément aux normes (ISQM 1 ¶32).",
    "La compétence s'apprécie au niveau de l'équipe dans son ensemble, y compris tout expert de l'auditeur.",
    "Le temps fait partie des ressources évaluées. Si l'échéance ne peut être tenue sans compromettre la qualité, le calendrier est renégocié avant acceptation.",
    "Lorsqu'un expert est requis, nous devons pouvoir évaluer sa compétence, ses capacités et son objectivité (ISA 620 ¶9–12).",
  ],
  conclEn: [
    "The engagement team, together with any auditor's expert, has the competence, capability and time to perform this engagement in accordance with professional standards and applicable legal and regulatory requirements, and the resources required are available.",
  ],
  conclFr: [
    "L'équipe affectée, avec tout expert de l'auditeur, dispose de la compétence, de la capacité et du temps nécessaires, et les ressources requises sont disponibles.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn:
        "Perform each procedure and record the result, stating what was obtained, from whom or from which source, and the reference of the evidence filed.",
      introFr:
        "Mettre en œuvre chaque procédure et consigner le résultat : ce qui a été obtenu, auprès de qui ou de quelle source, et la référence du dossier.",
      procs: [
        { key: "partner", en: "Inquire of the engagement partner about their availability across the reporting period and about competing commitments.", fr: "S'enquérir auprès de l'associé responsable de sa disponibilité sur la période et de ses engagements concurrents.", srcEn: "Inquiry of the engagement partner · firm resource plan", srcFr: "Entretien avec l'associé responsable · plan de charge du cabinet" },
        { key: "sector", en: "Compare the proposed team's sector experience against the entity's sector. Record each member's grade, the relevant engagements performed and the years worked in the sector.", fr: "Comparer l'expérience sectorielle de l'équipe proposée au secteur de l'entité. Consigner le grade de chaque membre, les missions pertinentes réalisées et l'ancienneté dans le secteur.", srcEn: "Team page · staff records · prior engagement files", srcFr: "Page Équipe · dossiers du personnel · dossiers de missions antérieures" },
        { key: "framework", en: "Determine whether the team has applied the entity's financial reporting framework before, and record where that experience was obtained.", fr: "Déterminer si l'équipe a déjà appliqué le référentiel comptable de l'entité et consigner où cette expérience a été acquise.", srcEn: "Staff records · prior files · training records", srcFr: "Dossiers du personnel · dossiers antérieurs · registre de formation" },
        { key: "expert", en: "Identify the specialised areas that require an auditor's expert, such as valuations, actuarial work, tax or information technology. Record the area and why the team cannot cover it.", fr: "Identifier les domaines spécialisés requérant un expert de l'auditeur, tels que les évaluations, l'actuariat, la fiscalité ou l'informatique. Consigner le domaine et la raison pour laquelle l'équipe ne peut le couvrir.", srcEn: "Prior year file · discussion with the engagement partner", srcFr: "Dossier antérieur · échange avec l'associé responsable" },
        { key: "expertev", en: "Where an expert is required, obtain evidence of that expert's competence, capability and objectivity, and agree the nature, scope and objectives of the work in writing.", fr: "Lorsqu'un expert est requis, obtenir les éléments attestant de sa compétence, de sa capacité et de son objectivité, et convenir par écrit de la nature, de l'étendue et des objectifs des travaux.", srcEn: "Expert's professional credentials · written terms with the expert · independence confirmation", srcFr: "Titres professionnels de l'expert · termes écrits convenus · confirmation d'indépendance" },
        { key: "mgmt_expert", en: "Determine whether the entity employs or has engaged its own experts — valuers, actuaries, legal counsel, engineers — whose work feeds the financial statements, and whether we can use that work as audit evidence: evaluate each expert's competence, capability and objectivity (ISA 500 ¶8).", fr: "Déterminer si l'entité emploie ou a mandaté ses propres experts — évaluateurs, actuaires, conseils juridiques, ingénieurs — dont les travaux alimentent les états financiers, et si nous pouvons utiliser ces travaux comme éléments probants : apprécier la compétence, la capacité et l'objectivité de chaque expert (ISA 500 ¶8).", srcEn: "Inquiry of management · expert's report and credentials · engagement terms with the expert", srcFr: "Entretien avec la direction · rapport et titres de l'expert · termes de la mission de l'expert" },
        { key: "hours", en: "Compare the budgeted hours by grade against the reporting deadline and against the prior period outturn. Record the effect of any shortfall.", fr: "Comparer les heures budgétées par grade à l'échéance de reporting et au réalisé de l'exercice précédent. Consigner l'effet de tout écart défavorable.", srcEn: "Budget · prior period time records · agreed timetable", srcFr: "Budget · temps passés de l'exercice précédent · calendrier convenu" },
        { key: "tech", en: "Determine the technology the engagement needs, including audit software, data analysis tools and the confirmation platform, and confirm access is in place before fieldwork begins.", fr: "Déterminer les moyens technologiques nécessaires, y compris le logiciel d'audit, les outils d'analyse de données et la plateforme de circularisation, et confirmer que les accès sont ouverts avant le début des travaux.", srcEn: "Firm IT function · licence records", srcFr: "Service informatique du cabinet · registre des licences" },
        { key: "action", en: "Where the resources required are not available, record the action taken: reallocation, recruitment, use of an expert, or renegotiation of the timetable with the entity.", fr: "Lorsque les ressources requises ne sont pas disponibles, consigner l'action retenue : réaffectation, recrutement, recours à un expert, ou renégociation du calendrier avec l'entité.", srcEn: "Firm resource plan · correspondence with the entity", srcFr: "Plan de charge du cabinet · correspondance avec l'entité" },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part B — Engagement profile",
      titleFr: "Partie B — Profil de la mission",
      introEn: "Record the engagement profile here, from the engagement record, the prior year file and discussion with the engagement partner.",
      introFr: "Consigner ici le profil de la mission, à partir du dossier, du dossier de l'exercice précédent et de l'échange avec l'associé responsable.",
      fields: [
        { key: "sector", kind: "input", labelEn: "Sector and nature of the entity's activities, and whether components or a group are involved", labelFr: "Secteur et nature des activités de l'entité, et existence de composants ou d'un groupe" },
        { key: "framework", kind: "input", labelEn: "Applicable financial reporting framework, and whether the entity is listed", labelFr: "Référentiel comptable applicable, et cotation éventuelle de l'entité" },
        { key: "deadlines", kind: "input", labelEn: "Reporting deadlines and other key dates", labelFr: "Échéances de reporting et autres dates clés" },
        { key: "scope", kind: "input", labelEn: "Locations and components within the scope of the audit", labelFr: "Implantations et composants inclus dans le périmètre" },
        { key: "experts", kind: "input", labelEn: "Need for an auditor's expert identified: information technology, tax, valuation, actuarial, legal", labelFr: "Besoin d'un expert identifié : informatique, fiscal, évaluation, actuariel, juridique" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part C — Evaluation of capability",
      titleFr: "Partie C — Évaluation de la capacité",
      introEn:
        "Set the team up in the engagement's team management before completing this part. Evaluate each statement against the profile in Part B and the team assembled. Explain each “No” in the box beneath it.",
      introFr:
        "Constituer l'équipe dans la gestion d'équipe de la mission avant de compléter cette partie. Évaluer chaque affirmation au regard du profil (partie B) et de l'équipe constituée.",
      items: [
        { key: "industry", en: "The team has appropriate knowledge of the industry and experience of the applicable financial reporting framework.", fr: "L'équipe possède une connaissance appropriée du secteur et l'expérience du référentiel applicable." },
        { key: "partner_time", en: "The engagement partner has sufficient time for appropriate involvement in, and direction of, the engagement.", fr: "L'associé responsable dispose du temps suffisant pour une implication et une direction appropriées." },
        { key: "expert", en: "Any auditor's expert identified in Part A is available, and we are able to direct and evaluate that work.", fr: "Tout expert identifié en partie A est disponible, et nous pouvons diriger et évaluer ses travaux.", na: true },
        { key: "budget", en: "The time budget is consistent with the reporting deadlines, the assessed risk profile and the team assembled.", fr: "Le budget-temps est cohérent avec les échéances, le profil de risque et l'équipe constituée." },
        { key: "eqr", en: "Where P1.5 requires an engagement quality review, an eligible reviewer is available.", fr: "Lorsque P1.5 exige une revue de qualité, un réviseur éligible est disponible.", na: true },
        { key: "jurisdiction", en: "The team covers the language and jurisdiction requirements of the engagement, including OHADA filing obligations.", fr: "L'équipe couvre les exigences linguistiques et juridictionnelles, y compris les obligations de dépôt OHADA." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- P2.1 --- */
const D3_2: PaperDef = {
  std: "IESBA Code Parts 1 and 4A · ISA 220 (Revised) ¶16–21 · ISQM 1 ¶29",
  ownsEn: "the independence conclusion, and the threats and safeguards log",
  ownsFr: "la conclusion d'indépendance et le registre des risques et sauvegardes",
  tools: ["independence"],
  reqEn: [
    "We comply with relevant ethical requirements, including those on independence (ISA 220 (Revised) ¶16). The engagement partner obtains information from the firm and, where relevant, from network firms, and determines that the requirements applicable to the engagement have been fulfilled (ISA 220 (Revised) ¶21; ISQM 1 ¶29).",
    "The International Ethics Standards Board for Accountants (IESBA) Code applies a conceptual framework: identify threats to compliance with the fundamental principles, evaluate whether those threats are at an acceptable level, and address them by eliminating the circumstance, applying a safeguard, or declining the engagement (§120). Threats are classified under five categories: self-interest, self-review, advocacy, familiarity and intimidation.",
    "Part 4A sets out the independence requirements for audit engagements: financial interests (§510), loans and guarantees (§511), business relationships (§520), family and personal relationships (§521), employment (§524), long association (§540), fees (§410), gifts and hospitality (§420) and non-assurance services (§600).",
    "A non-assurance service that involves assuming a management responsibility is not permitted for an audit client, and no safeguard reduces that threat to an acceptable level (§600.7 A3). Where the client is a public interest entity, the range of permitted services is narrower.",
    "Independence is required throughout the engagement, not only at acceptance. Where a breach is identified at any point, we evaluate its significance, take action to address the consequences, and communicate the matter to those charged with governance (§400.80 onwards).",
  ],
  reqFr: [
    "Nous respectons les exigences déontologiques applicables, y compris en matière d'indépendance (ISA 220 (Révisée) ¶16 ; ISQM 1 ¶29).",
    "Le Code de l'International Ethics Standards Board for Accountants (IESBA) applique un cadre conceptuel : identifier les risques, évaluer s'ils sont à un niveau acceptable, et y répondre (§120). Cinq catégories : intérêt personnel, auto-révision, représentation, familiarité, intimidation.",
    "La partie 4A fixe les exigences d'indépendance : intérêts financiers (§510), prêts et garanties (§511), relations d'affaires (§520), liens familiaux et personnels (§521), emploi (§524), association de longue durée (§540), honoraires (§410), cadeaux (§420) et services autres que d'assurance (§600).",
    "Un service impliquant la prise en charge d'une responsabilité de direction n'est jamais autorisé pour un client d'audit (§600.7 A3).",
    "L'indépendance est requise tout au long de la mission, et non à la seule acceptation (§400.80 et suivants).",
  ],
  conclEn: [
    "We are independent of the entity at firm, network and engagement-team level, for the purposes of the IESBA Code and applicable local requirements.",
    "The threats recorded below have been reduced to an acceptable level by the safeguards applied.",
  ],
  conclFr: [
    "Nous sommes indépendants de l'entité au niveau du cabinet, du réseau et de l'équipe affectée.",
    "Les risques consignés ci-dessous ont été ramenés à un niveau acceptable par les sauvegardes appliquées.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn:
        "Perform each procedure and record the result, naming the register searched or the person who responded, and the reference of the evidence filed.",
      introFr:
        "Mettre en œuvre chaque procédure et consigner le résultat, en nommant le registre consulté ou la personne ayant répondu, et la référence du dossier.",
      procs: [
        { key: "declare", en: "Issue the independence declaration to every person assigned to the engagement, including the engagement partner and any auditor's expert. Record the date issued and the responses received.", fr: "Adresser la déclaration d'indépendance à toute personne affectée à la mission, y compris l'associé responsable et tout expert de l'auditeur. Consigner la date d'envoi et les réponses reçues.", srcEn: "Independence inquiry tool · team page", srcFr: "Outil d'enquête d'indépendance · page Équipe" },
        { key: "interests", en: "Search the firm's register of interests for financial interests in the entity or its related entities held by the firm, its partners, or their immediate family.", fr: "Consulter le registre des intérêts du cabinet à la recherche d'intérêts financiers dans l'entité ou ses entités liées détenus par le cabinet, ses associés ou les membres de leur famille proche.", srcEn: "Firm register of interests · partner declarations", srcFr: "Registre des intérêts du cabinet · déclarations des associés" },
        { key: "nas", en: "Identify every non-assurance service provided to the entity by the firm or a network firm in the current and prior period. Record the service, the fee and the period.", fr: "Recenser chaque service autre que d'assurance fourni à l'entité par le cabinet ou un cabinet du réseau sur l'exercice et l'exercice précédent. Consigner la prestation, les honoraires et la période.", srcEn: "Billing records · network firm confirmations · engagement register", srcFr: "Facturation · confirmations des cabinets du réseau · registre des missions" },
        { key: "fees", en: "Obtain the fee history for the entity over the last three periods and calculate the fees as a proportion of the office's and the firm's total fees.", fr: "Obtenir l'historique des honoraires de l'entité sur les trois derniers exercices et calculer leur part dans le total des honoraires du bureau et du cabinet.", srcEn: "Billing records · practice management system", srcFr: "Facturation · système de gestion du cabinet" },
        { key: "rotation", en: "Determine how long the engagement partner and any engagement quality reviewer have served on this engagement, and compare that against the rotation limits applicable to the entity.", fr: "Déterminer depuis combien d'exercices l'associé responsable et tout responsable de la revue de qualité interviennent sur la mission, et comparer aux durées de rotation applicables à l'entité.", srcEn: "Prior engagement files · partner rotation register", srcFr: "Dossiers antérieurs · registre de rotation des associés" },
        { key: "relations", en: "Inquire whether any member of the team has been employed by the entity, seconded to it, or has a close business, family or personal relationship with it.", fr: "S'enquérir de tout membre de l'équipe ayant été employé par l'entité, détaché auprès d'elle, ou entretenant avec elle une relation d'affaires, familiale ou personnelle étroite.", srcEn: "Independence declarations · inquiry of team members", srcFr: "Déclarations d'indépendance · entretiens avec les membres de l'équipe" },
        { key: "loans", en: "Identify any loan, guarantee or overdue fee between the firm and the entity.", fr: "Recenser tout prêt, garantie ou honoraire échu impayé entre le cabinet et l'entité.", srcEn: "Firm accounts · receivables ledger", srcFr: "Comptes du cabinet · grand livre clients" },
        { key: "evaluate", en: "Where a threat is identified, evaluate its significance and record the safeguard applied. Where no safeguard reduces the threat to an acceptable level, record the decision to decline or to withdraw.", fr: "Lorsqu'un risque est identifié, en évaluer l'importance et consigner la mesure de sauvegarde appliquée. Si aucune mesure ne ramène le risque à un niveau acceptable, consigner la décision de refuser la mission ou de s'en démettre.", srcEn: "IESBA Code Part 4A · record of consultation", srcFr: "Code IESBA partie 4A · trace de la consultation" },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part B — Team declarations",
      titleFr: "Partie B — Déclarations de l'équipe",
      introEn:
        "Declarations are requested and collected by the independence inquiry on the Tools page. Issue the inquiry, then confirm that every member has responded before fieldwork begins.",
      introFr:
        "Les déclarations sont demandées et collectées par l'enquête d'indépendance (page Outils). Confirmer que chaque membre a répondu avant le début des travaux.",
      fields: [
        { key: "campaign", kind: "auto", labelEn: "Declarations received, outstanding and exceptions reported", labelFr: "Déclarations reçues, en attente et exceptions signalées", source: "independence inquiry" },
        { key: "outstanding", kind: "input", labelEn: "Where a declaration is outstanding at the date of this paper, the reason and the action taken", labelFr: "Si une déclaration reste en attente à la date de ce document, le motif et les mesures prises" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part C — Evaluation of independence",
      titleFr: "Partie C — Évaluation de l'indépendance",
      introEn:
        "Evaluate each statement at firm, network and engagement-team level. The bracketed references are to the IESBA Code. Explain each “No” in the box beneath it and record the resulting threat in Part C.",
      introFr:
        "Évaluer chaque affirmation au niveau du cabinet, du réseau et de l'équipe. Les références entre parenthèses renvoient au Code IESBA.",
      items: [
        { key: "financial", en: "No member of the team, and no part of the firm, holds a direct financial interest or a material indirect financial interest in the entity (§510).", fr: "Aucun membre de l'équipe ni aucune entité du cabinet ne détient d'intérêt financier direct ou indirect significatif dans l'entité (§510)." },
        { key: "loans", en: "No loan or guarantee exists between the firm and the entity, other than on normal commercial terms with a financial-institution client (§511).", fr: "Aucun prêt ni garantie entre le cabinet et l'entité, hors conditions commerciales normales avec un client établissement financier (§511).", na: true },
        { key: "business", en: "No close business relationship exists between the firm or a team member and the entity (§520).", fr: "Aucune relation d'affaires étroite entre le cabinet ou un membre de l'équipe et l'entité (§520)." },
        { key: "family", en: "No family or close personal relationship exists between a team member and a director, officer or influential employee of the entity (§521).", fr: "Aucun lien familial ou personnel étroit entre un membre de l'équipe et un dirigeant ou salarié influent (§521)." },
        { key: "employment", en: "No team member has recently been employed by the entity or is in employment discussions with it (§524).", fr: "Aucun membre de l'équipe n'a récemment été employé par l'entité ni n'est en pourparlers d'embauche (§524)." },
        { key: "rotation", en: "The long-association and rotation thresholds for senior personnel are not exceeded (§540).", fr: "Les seuils d'association de longue durée et de rotation ne sont pas dépassés (§540)." },
        { key: "overdue", en: "No significant fee is overdue from the entity, and no fee is contingent (§410).", fr: "Aucun honoraire significatif n'est impayé et aucun honoraire n'est conditionnel (§410)." },
        { key: "dependence", en: "The total fees from the entity remain within acceptable dependence thresholds, taking the firm and its network together (§410).", fr: "Le total des honoraires reste dans les seuils de dépendance acceptables, cabinet et réseau réunis (§410)." },
        { key: "nas", en: "Every non-assurance service provided has been evaluated, involves no assumption of a management responsibility, is permitted for this class of client, and is supported by the safeguards recorded in Part C (§600).", fr: "Chaque service autre que d'assurance a été évalué, n'implique aucune responsabilité de direction, est autorisé, et est assorti des sauvegardes consignées en partie C (§600).", na: true },
        { key: "gifts", en: "No gift or hospitality other than trivial and inconsequential has been accepted from the entity (§420).", fr: "Aucun cadeau ni marque d'hospitalité autre que négligeable n'a été accepté (§420)." },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part D — Threats and safeguards",
      titleFr: "Partie D — Risques et sauvegardes",
      introEn:
        "Record each threat identified, its category, the safeguard applied and whether the residual threat is at an acceptable level. Where it is not, the engagement is not accepted.",
      introFr:
        "Consigner chaque risque identifié, sa catégorie, la sauvegarde appliquée et le caractère acceptable du risque résiduel. À défaut, la mission n'est pas acceptée.",
      fields: [
        { key: "threats", kind: "input", labelEn: "Threats identified, with category (self-interest, self-review, advocacy, familiarity, intimidation), the safeguard applied, and whether the residual threat is acceptable", labelFr: "Risques identifiés, catégorie, sauvegarde appliquée, et caractère acceptable du risque résiduel" },
        { key: "nas_list", kind: "input", labelEn: "Non-assurance services provided in the period, with the basis on which each is permitted", labelFr: "Services autres que d'assurance fournis sur la période, et base de leur autorisation" },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- P1.3 --- */
const D3_3: PaperDef = {
  std: "ISA 210 ¶4, ¶6–8",
  ownsEn: "the preconditions conclusion and the framework selection",
  ownsFr: "la conclusion sur les conditions préalables et le choix du référentiel",
  reqEn: [
    "The preconditions for an audit are two: that management uses an acceptable financial reporting framework in preparing the financial statements, and that management agrees to the premise on which an audit is conducted (ISA 210 ¶4, ¶6). Both must be present before the engagement is accepted.",
    "Acceptability of the framework is judged by reference to the nature of the entity, the purpose of the financial statements, the nature of the statements themselves, and whether law or regulation prescribes the framework (ISA 210 ¶A4–A10). A framework prescribed by law for general purpose financial statements, as SYSCOHADA is throughout the OHADA region, is ordinarily acceptable for that purpose. Record the basis even where it is straightforward, because the framework selected here governs the wording of the auditor's report.",
    "The premise is that management, and where appropriate those charged with governance, acknowledges and understands its responsibility for the preparation of the financial statements, for the internal control necessary to enable their preparation free from material misstatement, and for providing the auditor with access to information and to people (ISA 210 ¶6(b)).",
    "If a precondition is absent, we discuss the matter with management. Unless law or regulation requires us to accept, we do not accept the engagement (ISA 210 ¶8). Where management imposes a limitation on scope before acceptance that would require us to disclaim an opinion, we do not accept the engagement, again unless required by law (ISA 210 ¶7).",
  ],
  reqFr: [
    "Les conditions préalables sont au nombre de deux : l'utilisation d'un référentiel comptable acceptable, et l'accord de la direction sur le postulat de l'audit (ISA 210 ¶4, ¶6).",
    "L'acceptabilité du référentiel s'apprécie au regard de la nature de l'entité, de l'objet des états financiers et de leur prescription éventuelle par la loi (ISA 210 ¶A4–A10). Le SYSCOHADA, prescrit par la loi dans l'espace OHADA, est en principe acceptable.",
    "Le postulat est la reconnaissance par la direction de sa responsabilité pour l'établissement des états financiers, pour le contrôle interne nécessaire, et pour l'accès aux informations et aux personnes (ISA 210 ¶6(b)).",
    "En l'absence d'une condition préalable, la mission n'est pas acceptée sauf obligation légale (ISA 210 ¶7–8).",
  ],
  conclEn: ["The preconditions for an audit are present."],
  conclFr: ["Les conditions préalables à l'audit sont réunies."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn:
        "Perform each procedure before accepting the engagement and record the result. An acknowledgement obtained orally is confirmed in the engagement letter.",
      introFr:
        "Mettre en œuvre chaque procédure avant l'acceptation et consigner le résultat. Une reconnaissance obtenue oralement est confirmée dans la lettre de mission.",
      procs: [
        { key: "framework", en: "Determine the financial reporting framework the entity will apply, and whether it is acceptable for the purpose of the financial statements. Record the basis for that determination.", fr: "Déterminer le référentiel comptable que l'entité appliquera et son caractère acceptable au regard de la finalité des états financiers. Consigner le fondement de cette conclusion.", srcEn: "Statutes · OHADA Uniform Act · regulator requirements", srcFr: "Statuts · Acte uniforme OHADA · exigences du régulateur" },
        { key: "law", en: "Inquire whether law or regulation prescribes the framework, the presentation of the financial statements, or the wording of our report.", fr: "Rechercher si la loi ou la réglementation impose le référentiel, la présentation des états financiers ou la formulation de notre rapport.", srcEn: "Applicable law · regulator guidance", srcFr: "Textes applicables · doctrine du régulateur" },
        { key: "prep", en: "Obtain management's acknowledgement of its responsibility for the preparation of the financial statements in accordance with that framework.", fr: "Obtenir de la direction la reconnaissance de sa responsabilité dans l'établissement des états financiers conformément à ce référentiel.", srcEn: "Discussion with management · draft engagement letter", srcFr: "Échange avec la direction · projet de lettre de mission" },
        { key: "control", en: "Obtain management's acknowledgement of its responsibility for the internal control it determines is necessary to prepare financial statements free from material misstatement.", fr: "Obtenir de la direction la reconnaissance de sa responsabilité au titre du contrôle interne qu'elle juge nécessaire pour établir des états financiers exempts d'anomalies significatives.", srcEn: "Discussion with management · draft engagement letter", srcFr: "Échange avec la direction · projet de lettre de mission" },
        { key: "access", en: "Obtain management's agreement to provide access to all information relevant to the financial statements, to any additional information we request, and to unrestricted access to persons within the entity.", fr: "Obtenir l'accord de la direction pour donner accès à toute information utile aux états financiers, à toute information complémentaire demandée, et sans restriction aux personnes au sein de l'entité.", srcEn: "Discussion with management · draft engagement letter", srcFr: "Échange avec la direction · projet de lettre de mission" },
        { key: "limitation", en: "Inquire whether management or those charged with governance intend to impose any limitation on the scope of our work. Record the limitation and whether it would result in a disclaimer of opinion.", fr: "Rechercher si la direction ou les responsables de la gouvernance entendent imposer une limitation à l'étendue de nos travaux. Consigner la limitation et si elle conduirait à une impossibilité d'exprimer une opinion.", srcEn: "Discussion with management and those charged with governance · proposal correspondence", srcFr: "Échanges avec la direction et les responsables de la gouvernance · correspondance de la proposition" },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part B — Applicable financial reporting framework",
      titleFr: "Partie B — Référentiel comptable applicable",
      introEn: "Record the framework and the basis on which it is acceptable. The reporting templates lock to the framework selected here.",
      introFr: "Consigner le référentiel et la base de son acceptabilité. Les modèles de rapport sont liés à ce choix.",
      fields: [
        { key: "framework", kind: "auto", labelEn: "Framework selected", labelFr: "Référentiel retenu", source: "engagement record" },
        { key: "acceptable", kind: "input", labelEn: "Basis on which the framework is acceptable: the nature of the entity, the purpose of the financial statements, the intended users, and any prescription by law or regulation", labelFr: "Base de l'acceptabilité : nature de l'entité, objet des états financiers, utilisateurs visés, prescription légale éventuelle" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part C — Management's acknowledgements",
      titleFr: "Partie C — Reconnaissances de la direction",
      introEn:
        "Confirm by discussion with management that it acknowledges and understands each responsibility. The bracketed references are to ISA 210. Explain each “No” in the box beneath it.",
      introFr:
        "Confirmer par entretien que la direction reconnaît et comprend chacune de ces responsabilités. Les références renvoient à l'ISA 210.",
      items: [
        { key: "prep", en: "Preparing the financial statements in accordance with the applicable framework, including fair presentation where the framework requires it (¶6(b)(i)).", fr: "Établir les états financiers conformément au référentiel applicable, y compris l'image fidèle lorsque celui-ci l'exige (¶6(b)(i))." },
        { key: "control", en: "Maintaining the internal control that management determines is necessary to enable the preparation of financial statements free from material misstatement, whether due to fraud or error (¶6(b)(ii)).", fr: "Maintenir le contrôle interne nécessaire à l'établissement d'états financiers exempts d'anomalies significatives (¶6(b)(ii))." },
        { key: "access_info", en: "Providing us with access to all information of which management is aware that is relevant to the preparation of the financial statements (¶6(b)(iii)a).", fr: "Nous donner accès à toutes les informations pertinentes dont elle a connaissance (¶6(b)(iii)a)." },
        { key: "additional", en: "Providing any additional information that we request for the purpose of the audit (¶6(b)(iii)b).", fr: "Nous fournir toute information complémentaire demandée pour les besoins de l'audit (¶6(b)(iii)b)." },
        { key: "access_people", en: "Providing unrestricted access to persons within the entity from whom we determine it necessary to obtain audit evidence (¶6(b)(iii)c).", fr: "Nous donner un accès sans restriction aux personnes auprès desquelles nous jugeons nécessaire d'obtenir des éléments probants (¶6(b)(iii)c)." },
        { key: "in_letter", en: "These acknowledgements are recorded in the engagement letter (P1.4).", fr: "Ces reconnaissances figurent dans la lettre de mission (P1.4)." },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part D — Limitation on scope",
      titleFr: "Partie D — Limitation de l'étendue",
      introEn:
        "Explain a “No” answer in the box beneath it. Where management imposes a limitation of this kind and the audit is not required by law or regulation, we do not accept the engagement.",
      introFr:
        "Expliquer une réponse « Non » dans la zone prévue. Une telle limitation, hors obligation légale, empêche l'acceptation.",
      items: [
        { key: "no_limitation", en: "Management has imposed no limitation on the scope of our work of a nature likely to result in a disclaimer of opinion.", fr: "La direction n'a imposé aucune limitation de nature à conduire à une impossibilité d'exprimer une opinion." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- P1.2 --- */
const D3_4: PaperDef = {
  std: "ISA 300 ¶13 · IESBA Code §320 · ISA 510",
  ownsEn: "the predecessor auditor communication and the opening balances strategy",
  ownsFr: "la communication avec l'auditeur précédent et la stratégie sur les soldes d'ouverture",
  reqEn: [
    "For an initial audit engagement we perform the acceptance procedures required by ISA 220 (Revised) and communicate with the predecessor auditor where there has been a change of auditor (ISA 300 ¶13).",
    "The IESBA Code requires a proposed accountant to determine whether there are reasons for not accepting an appointment. That determination ordinarily requires direct communication with the existing accountant to establish the facts and circumstances behind the proposed change (§320). The client's permission is required before we make contact. A refusal of permission, or a permission granted but not honoured, is itself information relevant to the acceptance decision and to the integrity evaluation in P1.1.",
    "On opening balances, the objective is to obtain sufficient appropriate audit evidence about whether they contain misstatements that materially affect the current period, and whether appropriate accounting policies have been consistently applied (ISA 510 ¶3, ¶6). We read the most recent financial statements and the predecessor's report for information relevant to opening balances (ISA 510 ¶5).",
    "Where the prior period opinion was modified, we consider the effect on the current period (ISA 510 ¶12). Where we cannot obtain sufficient appropriate audit evidence over opening balances, we express a qualified opinion or disclaim an opinion (ISA 510 ¶10). Either outcome is foreseen here, not discovered at reporting. The detailed opening-balances work is performed in E6.5.",
  ],
  reqFr: [
    "Pour une mission initiale, nous mettons en œuvre les procédures d'acceptation et communiquons avec l'auditeur précédent en cas de changement (ISA 300 ¶13).",
    "Le Code IESBA impose de déterminer s'il existe des motifs de ne pas accepter la mission, ce qui suppose une communication directe avec le confrère en place (§320). L'autorisation du client est requise.",
    "Sur les soldes d'ouverture, l'objectif est d'obtenir des éléments probants suffisants et appropriés (ISA 510 ¶3, ¶6). Les travaux détaillés sont réalisés en E6.5.",
    "Une opinion modifiée sur l'exercice précédent est prise en compte pour l'exercice courant (ISA 510 ¶12).",
  ],
  conclEn: [
    "The communication with the predecessor auditor has been completed, or the client's refusal of permission has been evaluated, and the opening balances strategy recorded below is appropriate in the circumstances.",
  ],
  conclFr: [
    "La communication avec l'auditeur précédent est achevée, ou le refus du client a été évalué, et la stratégie sur les soldes d'ouverture est appropriée.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn:
        "Perform each procedure and record the result. Carry any finding bearing on integrity into P1.1 Part B.",
      introFr:
        "Mettre en œuvre chaque procédure et consigner le résultat. Reporter tout constat touchant à l'intégrité en P1.1 partie B.",
      procs: [
        { key: "identify", en: "Establish the identity of the predecessor auditor and the periods audited.", fr: "Établir l'identité de l'auditeur précédent et les exercices audités.", srcEn: "Prior financial statements · RCCM filings · inquiry of management", srcFr: "États financiers antérieurs · dépôts RCCM · entretien avec la direction" },
        { key: "authority", en: "Obtain management's written authority to communicate with the predecessor auditor. Where authority is refused, record the refusal and its effect on acceptance.", fr: "Obtenir l'autorisation écrite de la direction pour communiquer avec l'auditeur précédent. En cas de refus, consigner ce refus et son incidence sur l'acceptation.", srcEn: "Signed authority · correspondence with management", srcFr: "Autorisation signée · correspondance avec la direction" },
        { key: "inquire", en: "Send the written inquiry to the predecessor auditor. Ask about disagreements on accounting or auditing matters, about identified fraud or non-compliance with law and regulation, about the reason for the change, and about any matter bearing on the integrity of management.", fr: "Adresser la demande écrite à l'auditeur précédent. Interroger sur les désaccords en matière comptable ou d'audit, les fraudes ou non-conformités identifiées, le motif du changement, et tout élément touchant à l'intégrité de la direction.", srcEn: "Our letter of inquiry · correspondence file", srcFr: "Notre lettre de demande · chrono de correspondance" },
        { key: "followup", en: "Where no reply is received within a reasonable period, follow up in writing and record the follow-up.", fr: "En l'absence de réponse dans un délai raisonnable, relancer par écrit et consigner la relance.", srcEn: "Correspondence file", srcFr: "Chrono de correspondance" },
        { key: "evaluate", en: "Read the predecessor auditor's response and evaluate its effect on acceptance and on our assessment of risk.", fr: "Lire la réponse de l'auditeur précédent et en évaluer l'incidence sur l'acceptation et sur notre évaluation des risques.", srcEn: "Predecessor auditor's written response", srcFr: "Réponse écrite de l'auditeur précédent" },
        { key: "file", en: "Request access to the predecessor auditor's file for the opening balances. Where access is granted, inspect the working papers supporting the opening position.", fr: "Demander l'accès au dossier de l'auditeur précédent pour les soldes d'ouverture. Si l'accès est accordé, examiner les feuilles de travail justifiant la position d'ouverture.", srcEn: "Predecessor's working papers · access agreement", srcFr: "Feuilles de travail du prédécesseur · convention d'accès" },
        { key: "alternative", en: "Where access is not obtained, plan the alternative procedures on opening balances and record them in E6.5.", fr: "À défaut d'accès, planifier les procédures alternatives sur les soldes d'ouverture et les consigner en E6.5.", srcEn: "ISA 510 ¶6 · working paper E6.5", srcFr: "ISA 510 ¶6 · feuille de travail E6.5" },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part B — Predecessor auditor",
      titleFr: "Partie B — Auditeur précédent",
      fields: [
        { key: "firm", kind: "input", labelEn: "Firm and contact person", labelFr: "Cabinet et interlocuteur" },
        { key: "periods", kind: "input", labelEn: "Periods audited by the predecessor", labelFr: "Exercices audités par le prédécesseur" },
        { key: "opinion", kind: "input", labelEn: "Opinion issued on the most recent period, including any modification", labelFr: "Opinion émise sur le dernier exercice, y compris toute modification" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part C — Evaluation of the response",
      titleFr: "Partie C — Évaluation de la réponse",
      introEn: "Evaluate what the Part A procedures produced. Explain each “No” in the box beneath it, including its effect on the acceptance decision. A limited response, or no response, is a matter to weigh in deciding whether to accept the engagement.",
      introFr: "Évaluer les résultats des procédures de la partie A. Expliquer chaque « Non » dans la zone prévue, y compris son effet sur la décision d'acceptation. Une réponse limitée ou l'absence de réponse est à peser dans cette décision.",
      items: [
        { key: "permission", en: "Permission to communicate with the predecessor auditor was obtained without restriction (procedure 2).", fr: "L'autorisation de communiquer avec l'auditeur précédent a été obtenue sans restriction (procédure 2)." },
        { key: "answered", en: "The predecessor auditor's response addressed every matter we raised (procedures 3 to 5).", fr: "La réponse de l'auditeur précédent traite chacune des questions posées (procédures 3 à 5)." },
        { key: "nodisagreement", en: "The response discloses no disagreement over an accounting or auditing matter that remained unresolved (procedure 5).", fr: "La réponse ne fait état d'aucun désaccord comptable ou d'audit resté non résolu (procédure 5)." },
        { key: "nofraud", en: "The response discloses no fraud or non-compliance with law and regulation affecting the periods audited (procedure 5).", fr: "La réponse ne fait état d'aucune fraude ni non-conformité aux textes affectant les exercices audités (procédure 5)." },
        { key: "consistent", en: "The reason given for the change of auditor is consistent with management's account (procedure 5; P1.1 procedure 10).", fr: "Le motif du changement d'auditeur concorde avec la version de la direction (procédure 5 ; P1.1 procédure 10)." },
        { key: "integrity", en: "Nothing in the response bears adversely on the integrity of management (procedure 5). Any finding is carried into P1.1 Part B.", fr: "Rien dans la réponse ne met en cause l'intégrité de la direction (procédure 5). Tout constat est reporté en P1.1 partie B." },
        { key: "papers", en: "Access to the predecessor auditor's working papers on the opening balances was obtained (procedure 6).", fr: "L'accès aux feuilles de travail du prédécesseur sur les soldes d'ouverture a été obtenu (procédure 6).", na: true },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part D — Opening balances strategy",
      titleFr: "Partie D — Stratégie sur les soldes d'ouverture",
      introEn: "Select the strategy for obtaining sufficient appropriate audit evidence that the opening balances contain no misstatement materially affecting the current period. The work itself is performed in E6.5.",
      introFr: "Choisir la stratégie d'obtention des éléments probants sur les soldes d'ouverture. Les travaux sont réalisés en E6.5.",
      fields: [
        { key: "strategy", kind: "input", labelEn: "Strategy selected: review of the predecessor's working papers, evidence arising from current period procedures, or specific procedures on opening balances", labelFr: "Stratégie retenue : revue des dossiers du prédécesseur, éléments issus des procédures de l'exercice, ou procédures spécifiques" },
        { key: "prior_mod", kind: "input", labelEn: "Any modification to the prior period opinion relevant to the current period, and its effect", labelFr: "Toute modification de l'opinion antérieure pertinente pour l'exercice, et son effet" },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- P1.4 --- */
const D3_5: PaperDef = {
  std: "ISA 210 ¶9–13, ¶A29",
  ownsEn: "the agreed terms of the engagement",
  ownsFr: "les termes convenus de la mission",
  reqEn: [
    "We agree the terms of the audit engagement with management or those charged with governance, and record the agreed terms in an engagement letter or other suitable form of written agreement (ISA 210 ¶9–10). Agreement is reached before the audit work begins.",
    "The letter sets out the objective and scope of the audit, our responsibilities, the responsibilities of management, the applicable financial reporting framework, and reference to the expected form and content of any reports, together with a statement that circumstances may require a report to differ from that expected form (ISA 210 ¶10).",
    "Where law or regulation prescribes the terms in sufficient detail, we need not record them in the letter, but we do record that the law applies and that management acknowledges its responsibilities under the premise (ISA 210 ¶11–12).",
    "On a recurring engagement we assess each period whether the terms require revision and whether the entity should be reminded of the existing terms (ISA 210 ¶13). Indicators include a change of senior management, a significant change in ownership, a significant change in the nature or size of the business, a change in legal or reporting requirements, a change in the framework, and any indication that management misunderstands the objective and scope of the audit (ISA 210 ¶A29).",
  ],
  reqFr: [
    "Les termes de la mission sont convenus avec la direction ou les responsables de la gouvernance et consignés dans une lettre de mission avant le début des travaux (ISA 210 ¶9–10).",
    "La lettre précise l'objectif et l'étendue, nos responsabilités, celles de la direction, le référentiel applicable et la forme attendue des rapports (ISA 210 ¶10).",
    "Lorsque la loi fixe les termes de façon suffisamment détaillée, il suffit de le consigner (ISA 210 ¶11–12).",
    "Pour une mission récurrente, apprécier chaque exercice si les termes doivent être révisés (ISA 210 ¶13, ¶A29).",
  ],
  conclEn: [
    "A signed engagement letter recording the agreed terms is on file, and planning work has not begun before that date.",
  ],
  conclFr: [
    "Une lettre de mission signée figure au dossier, et les travaux de planification n'ont pas débuté avant cette date.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn:
        "Perform each procedure and record the result. The letter is signed and filed before fieldwork begins.",
      introFr:
        "Mettre en œuvre chaque procédure et consigner le résultat. La lettre est signée et classée avant le début des travaux.",
      procs: [
        { key: "draft", en: "Prepare the engagement letter covering the objective and scope of the audit, our responsibilities, management's responsibilities, the applicable financial reporting framework, and the expected form and content of our report.", fr: "Établir la lettre de mission couvrant l'objectif et l'étendue de l'audit, nos responsabilités, celles de la direction, le référentiel comptable applicable, ainsi que la forme et le contenu attendus de notre rapport.", srcEn: "Firm template · ISA 210 ¶10", srcFr: "Modèle du cabinet · ISA 210 ¶10" },
        { key: "statutory", en: "Include the elements required by law or by the entity's statutes for a statutory appointment, including the term of the mandate.", fr: "Inclure les éléments requis par la loi ou les statuts au titre d'un mandat légal, y compris sa durée.", srcEn: "OHADA Uniform Act · statutes · appointment resolution", srcFr: "Acte uniforme OHADA · statuts · résolution de nomination" },
        { key: "terms", en: "Agree the fee basis, the timetable, and the involvement of any auditor's expert, component auditor or internal audit function.", fr: "Convenir de la base des honoraires, du calendrier, et de l'intervention de tout expert de l'auditeur, auditeur de composant ou service d'audit interne.", srcEn: "Budget · agreed timetable · P2.2", srcFr: "Budget · calendrier convenu · P2.2" },
        { key: "sign", en: "Obtain the signature of the person with authority to bind the entity. Record the name, position and dates in Part C.", fr: "Obtenir la signature de la personne habilitée à engager l'entité. Consigner son nom, sa fonction et les dates en partie C.", srcEn: "Signed letter · appointment resolution", srcFr: "Lettre signée · résolution de nomination" },
        { key: "recurring", en: "For a recurring engagement, assess whether the circumstances require the terms to be revised, and whether the entity needs to be reminded of the existing terms. Record the assessment in Part C.", fr: "Pour une mission récurrente, apprécier si les circonstances imposent de réviser les termes et s'il y a lieu de rappeler à l'entité les termes en vigueur. Consigner l'appréciation en partie C.", srcEn: "Prior engagement letter · ISA 210 ¶13", srcFr: "Lettre de mission antérieure · ISA 210 ¶13" },
        { key: "filed", en: "File the signed letter before fieldwork begins. Where fieldwork has begun without it, record the reason and the date the letter was obtained.", fr: "Classer la lettre signée avant le début des travaux. Si les travaux ont commencé sans elle, consigner le motif et la date d'obtention.", srcEn: "Engagement file", srcFr: "Dossier de mission" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Contents of the letter",
      titleFr: "Partie B — Contenu de la lettre",
      introEn: "Read the signed letter and confirm that it contains each of the following. The bracketed references are to ISA 210. Explain each “No” in the box beneath it.",
      introFr: "Lire la lettre signée et confirmer qu'elle contient chacun des éléments suivants. Les références renvoient à l'ISA 210.",
      items: [
        { key: "objective", en: "The objective and scope of the audit of the financial statements (¶10(a)).", fr: "L'objectif et l'étendue de l'audit des états financiers (¶10(a))." },
        { key: "auditor_resp", en: "The responsibilities of the auditor (¶10(b)).", fr: "Les responsabilités de l'auditeur (¶10(b))." },
        { key: "mgmt_resp", en: "The responsibilities of management, including the acknowledgements recorded in P1.3 Part B (¶10(c)).", fr: "Les responsabilités de la direction, y compris les reconnaissances de P1.3 partie B (¶10(c))." },
        { key: "framework", en: "Identification of the applicable financial reporting framework (¶10(d)).", fr: "L'identification du référentiel comptable applicable (¶10(d))." },
        { key: "report_form", en: "Reference to the expected form and content of our reports, and a statement that circumstances may require a report to differ from that form (¶10(e)).", fr: "La référence à la forme attendue des rapports, et la mention que les circonstances peuvent l'affecter (¶10(e))." },
        { key: "fees", en: "The basis on which fees are charged and the billing arrangements.", fr: "La base de facturation des honoraires et les modalités de règlement." },
        { key: "access", en: "The arrangements for access to, and inspection of, the audit documentation.", fr: "Les modalités d'accès et d'examen de la documentation d'audit." },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part C — Execution and recurring engagements",
      titleFr: "Partie C — Signature et missions récurrentes",
      fields: [
        { key: "dated", kind: "input", labelEn: "Date of the letter, who signed for the entity and in what capacity, and the date it was countersigned and returned", labelFr: "Date de la lettre, signataire pour l'entité et sa qualité, date de retour contresigné" },
        { key: "recurring", kind: "input", labelEn: "Recurring engagements: the factors assessed in deciding whether the terms require revision, and the conclusion reached", labelFr: "Missions récurrentes : facteurs appréciés pour décider d'une révision des termes, et conclusion" },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- P1.5 --- */
const D3_6: PaperDef = {
  std: "ISQM 1 ¶34(f) · ISQM 2 ¶19–25 · ISA 220 (Revised) ¶36",
  ownsEn: "whether the engagement requires a quality review, and the reviewer appointed",
  ownsFr: "l'exigence d'une revue de qualité et la désignation du réviseur",
  reqEn: [
    "The firm's system of quality management provides for an engagement quality review in three cases (ISQM 1 ¶34(f)). The first is an audit of the financial statements of a listed entity. The second is an engagement for which a review is required by law or regulation. The third is any other engagement for which the firm determines that a review is an appropriate response to the assessed quality risks.",
    "The determination is made before the engagement begins. The reviewer is appointed early enough to review the significant judgements as they are made, and performs the review at appropriate points during the engagement (ISQM 2 ¶21–25).",
    "The reviewer must be eligible: competent, with appropriate authority and time, objective in fact and appearance, and not a member of the engagement team. A person who served as the engagement partner may not act as reviewer until a cooling-off period of two years, or longer where required, has elapsed (ISQM 2 ¶19–20).",
    "Where a review is required, the auditor's report may not be dated until the reviewer has notified the engagement partner that the review is complete (ISA 220 (Revised) ¶36; ISQM 2 ¶26). The reviewer's conclusion is recorded in C4.2.",
  ],
  reqFr: [
    "Le système de gestion de la qualité prévoit une revue de qualité dans trois cas (ISQM 1 ¶34(f)) : entité cotée, exigence légale, ou décision du cabinet au regard des risques qualité évalués.",
    "La détermination intervient avant le début de la mission ; le réviseur est désigné assez tôt pour examiner les jugements importants au fur et à mesure (ISQM 2 ¶21–25).",
    "Le réviseur doit être éligible : compétent, disposant de l'autorité et du temps, objectif, extérieur à l'équipe. Un délai de viduité de deux ans s'applique à l'ancien associé responsable (ISQM 2 ¶19–20).",
    "Le rapport ne peut être daté avant la notification d'achèvement de la revue (ISA 220 (Révisée) ¶36). La conclusion du réviseur est consignée en C4.2.",
  ],
  conclEn: [
    "The requirement for an engagement quality review has been determined and, where a review is required, an eligible reviewer has been appointed.",
  ],
  conclFr: [
    "L'exigence d'une revue de qualité a été déterminée et, le cas échéant, un réviseur éligible a été désigné.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn:
        "Perform each procedure and record the result. Where a review is required, the report is not dated before the review is complete.",
      introFr:
        "Mettre en œuvre chaque procédure et consigner le résultat. Lorsqu'une revue est requise, le rapport n'est pas daté avant son achèvement.",
      procs: [
        { key: "listed", en: "Determine whether the entity is listed on a securities exchange.", fr: "Déterminer si l'entité est cotée sur un marché de valeurs mobilières.", srcEn: "Listing records · statutes", srcFr: "Registre de cotation · statuts" },
        { key: "law", en: "Determine whether law or regulation requires a quality review for this class of entity.", fr: "Déterminer si la loi ou la réglementation impose une revue de qualité pour cette catégorie d'entité.", srcEn: "Applicable law · regulator requirements", srcFr: "Textes applicables · exigences du régulateur" },
        { key: "policy", en: "Apply the firm's own criteria for a review, taking account of the client risk rating recorded in P1.1 and the significance of the judgements expected.", fr: "Appliquer les critères propres au cabinet, en tenant compte de la notation du risque client consignée en P1.1 et de l'importance des jugements attendus.", srcEn: "Firm policy · P1.1 Part C", srcFr: "Politique du cabinet · P1.1 partie C" },
        { key: "appoint", en: "Where a review is required, appoint a reviewer who is not a member of the engagement team, who has the competence and authority for the role, and who has not served as engagement partner on this engagement within the last two periods.", fr: "Lorsqu'une revue est requise, désigner un responsable qui n'est pas membre de l'équipe, qui dispose de la compétence et de l'autorité nécessaires, et qui n'a pas été associé responsable de la mission au cours des deux exercices précédents.", srcEn: "Firm partner records · rotation register", srcFr: "Dossiers des associés · registre de rotation" },
        { key: "indep", en: "Confirm the reviewer's independence of the entity and record the confirmation.", fr: "Confirmer l'indépendance du responsable de la revue vis-à-vis de l'entité et consigner cette confirmation.", srcEn: "Reviewer's declaration · P2.1", srcFr: "Déclaration du responsable de la revue · P2.1" },
        { key: "timing", en: "Record the points in the engagement at which the review will take place, and confirm that our report will not be dated before the review is complete.", fr: "Consigner les moments de la mission où la revue interviendra et confirmer que notre rapport ne sera pas daté avant son achèvement.", srcEn: "Agreed timetable · ISQM 2 ¶25", srcFr: "Calendrier convenu · ISQM 2 ¶25" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Criteria",
      titleFr: "Partie B — Critères",
      introEn: "A review is required where any criterion is answered “Yes”. Explain a “No” only where the position is not self-evident from the engagement record.",
      introFr: "Une revue est requise si un critère reçoit la réponse « Oui ». N'expliquer un « Non » que si la situation n'est pas évidente.",
      items: [
        { key: "listed", en: "The entity is a listed entity (ISQM 1 ¶34(f)(i)).", fr: "L'entité est cotée (ISQM 1 ¶34(f)(i))." },
        { key: "law", en: "A review is required by law or regulation (ISQM 1 ¶34(f)(ii)).", fr: "Une revue est exigée par la loi ou la réglementation (ISQM 1 ¶34(f)(ii))." },
        { key: "pie", en: "The entity has public interest characteristics, such as being a regulated financial institution, having a significant public profile, or having lenders that rely on covenant compliance (ISQM 1 ¶34(f)(iii)).", fr: "L'entité présente des caractéristiques d'intérêt public : établissement financier réglementé, notoriété significative, ou prêteurs dépendant du respect de covenants (ISQM 1 ¶34(f)(iii))." },
        { key: "high_risk", en: "The client risk rating recorded in P1.1 Part C is High.", fr: "La notation du risque client en P1.1 partie C est Élevée." },
        { key: "first_year", en: "This is the first period the firm audits the entity.", fr: "Il s'agit du premier exercice audité par le cabinet." },
        { key: "complexity", en: "The engagement is expected to involve unusual complexity or significant judgements: complex estimates, structured or unusual transactions, or doubt over going concern.", fr: "La mission devrait comporter une complexité inhabituelle ou des jugements importants : estimations complexes, opérations structurées ou inhabituelles, ou doute sur la continuité d'exploitation." },
        { key: "capital", en: "The entity is preparing a capital-markets transaction, or the financial statements are expected to be used in one.", fr: "L'entité prépare une opération sur les marchés de capitaux, ou les états financiers devraient y être utilisés." },
        { key: "monitor", en: "The engagement has been designated for close monitoring under firm policy or following a quality-review finding.", fr: "La mission est placée sous surveillance renforcée par la politique du cabinet ou à la suite d'un constat de revue qualité." },
        { key: "policy", en: "Another trigger under firm policy applies.", fr: "Un autre critère de la politique du cabinet s'applique." },
      ],
    },
    {
      kind: "fields",
      titleEn: "Part C — Appointment of the reviewer",
      titleFr: "Partie C — Désignation du réviseur",
      introEn: "Complete this part only where Part A requires a review. Where none is required, record that conclusion here.",
      introFr: "Ne compléter que si la partie A exige une revue. Sinon, consigner ici cette conclusion.",
      fields: [
        { key: "reviewer", kind: "input", labelEn: "Name and qualifications of the reviewer, or the conclusion that no review is required", labelFr: "Nom et qualifications du réviseur, ou conclusion qu'aucune revue n'est requise" },
        { key: "eligibility", kind: "input", labelEn: "Basis on which eligibility is confirmed: competence, authority and objectivity, including the two-year cooling-off period after serving as engagement partner", labelFr: "Base de l'éligibilité : compétence, autorité et objectivité, y compris le délai de viduité de deux ans" },
        { key: "points", kind: "input", labelEn: "Points at which the review will take place: planning conclusions, significant judgements, the report", labelFr: "Moments de la revue : conclusions de planification, jugements importants, rapport" },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- P2.3 --- */
// The scope of the audit when the entity is more than one place: branches,
// subsidiaries, sites whose figures reach the financial statements. Scoped to
// complex engagements — a single-site SARL never sees it.
const D6_2: PaperDef = {
  std: "ISA 600 (Revised) ¶17–31 · ISA 300 ¶8",
  ownsEn: "the components in scope and the work planned at each",
  ownsFr: "les composants inclus dans le périmètre et les travaux prévus sur chacun",
  reqEn: [
    "Where the financial statements include the financial information of components — branches, subsidiaries, divisions or other locations — the auditor determines the components on which work is to be performed, the nature of that work, and the involvement of any component auditor (ISA 600 (Revised)).",
    "A component is scoped in for its significance to the group figures or for its assessed risk, not for its convenience. For components where no specific work is planned, analytical procedures at the aggregated level respond to the residual risk.",
    "Where another auditor performs work on a component, the group auditor directs and supervises that work, evaluates its adequacy, and communicates the matters required — the group auditor's responsibility is not reduced by delegation.",
  ],
  reqFr: [
    "Lorsque les états financiers comprennent l'information financière de composants — succursales, filiales, divisions ou autres sites — l'auditeur détermine les composants sur lesquels des travaux seront réalisés, la nature de ces travaux et l'implication de tout auditeur de composant (ISA 600 (Révisée)).",
    "Un composant entre dans le périmètre pour son importance dans les chiffres d'ensemble ou pour son risque évalué, non pour sa commodité. Pour les composants sans travaux spécifiques, des procédures analytiques au niveau agrégé répondent au risque résiduel.",
    "Lorsqu'un autre auditeur intervient sur un composant, l'auditeur du groupe dirige et supervise ces travaux, en apprécie le caractère suffisant et communique les points requis — la responsabilité de l'auditeur du groupe n'est pas réduite par la délégation.",
  ],
  conclEn: [
    "The components within the scope of the audit have been identified, the work at each is planned in proportion to its significance and risk, and any component auditor's involvement is directed and supervised.",
  ],
  conclFr: [
    "Les composants du périmètre d'audit ont été identifiés, les travaux sur chacun sont proportionnés à son importance et à son risque, et l'intervention de tout auditeur de composant est dirigée et supervisée.",
  ],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: "Perform each procedure and record the result with the reference of the evidence filed.",
      introFr: "Mettre en œuvre chaque procédure et consigner le résultat avec la référence des éléments classés.",
      procs: [
        { key: "map", en: "List every component whose financial information reaches the financial statements: branches, subsidiaries, sites, divisions. Record for each its location, its activity, and the balances or flows it contributes.", fr: "Recenser chaque composant dont l'information financière alimente les états financiers : succursales, filiales, sites, divisions. Consigner pour chacun sa localisation, son activité et les soldes ou flux qu'il apporte.", srcEn: "Group structure · consolidation schedules · management reports", srcFr: "Organigramme du groupe · tableaux de consolidation · rapports de gestion" },
        { key: "significance", en: "Determine which components are significant, by their share of the entity's totals or by the risks they carry, and record the threshold or reasoning applied.", fr: "Déterminer les composants importants, par leur part dans les totaux de l'entité ou par les risques qu'ils portent, et consigner le seuil ou le raisonnement appliqué.", srcEn: "Consolidation schedules vs materiality (P6.1)", srcFr: "Tableaux de consolidation vs seuil (P6.1)" },
        { key: "work", en: "Set the work to be performed at each component: an audit of its financial information, specified procedures on particular balances, or analytical procedures at the aggregated level — and record why that response fits the component's significance and risk.", fr: "Arrêter les travaux à réaliser sur chaque composant : audit de son information financière, procédures spécifiées sur des soldes déterminés, ou procédures analytiques au niveau agrégé — et consigner pourquoi cette réponse correspond à son importance et à son risque.", srcEn: "Component risk profile · S3.1", srcFr: "Profil de risque du composant · S3.1" },
        { key: "auditors", en: "Where a component auditor is involved, record who they are, evaluate their competence and independence, and set how their work will be directed, supervised and reviewed, including the materiality allocated to them.", fr: "Lorsqu'un auditeur de composant intervient, consigner son identité, apprécier sa compétence et son indépendance, et fixer comment ses travaux seront dirigés, supervisés et revus, y compris le seuil qui lui est alloué.", srcEn: "Component auditor confirmations · group instructions", srcFr: "Confirmations de l'auditeur de composant · instructions du groupe" },
        { key: "access", en: "Confirm access to the components' records and people, including any restriction from a different jurisdiction, and record how a restriction is overcome or its effect on the opinion.", fr: "Confirmer l'accès aux livres et aux personnes des composants, y compris toute restriction tenant à une autre juridiction, et consigner comment une restriction est levée ou son incidence sur l'opinion.", srcEn: "Engagement letter · correspondence with component management", srcFr: "Lettre de mission · correspondance avec la direction du composant" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Scoping confirmations",
      titleFr: "Partie B — Confirmations de périmètre",
      introEn: "Answer each item. Explain a “No” in the field beneath it.",
      introFr: "Répondre à chaque point. Expliquer un « Non » dans le champ situé dessous.",
      items: [
        { key: "coverage", en: "The components scoped in account for the predominant part of each significant account, or the residual is addressed by analytical procedures.", fr: "Les composants retenus couvrent l'essentiel de chaque compte significatif, ou le résidu est traité par procédures analytiques." },
        { key: "risk_led", en: "No component with a significant risk has been left outside the scope of specific work.", fr: "Aucun composant porteur d'un risque important n'est resté hors du périmètre de travaux spécifiques." },
        { key: "directed", en: "Any component auditor's work is directed and supervised by this team, with the communications required by ISA 600 recorded.", fr: "Les travaux de tout auditeur de composant sont dirigés et supervisés par la présente équipe, avec les communications requises par l'ISA 600 consignées.", na: true },
      ],
    },
  ],
};

export const ACCEPTANCE_PAPERS: Record<string, PaperDef> = {
  "P2.3": D6_2,
  "P1.1": D3_1,
  "P2.2": D6_1,
  "P2.1": D3_2,
  "P1.3": D3_3,
  "P1.2": D3_4,
  "P1.4": D3_5,
  "P1.5": D3_6,
};
