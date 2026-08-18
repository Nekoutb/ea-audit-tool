// The GAM-alignment papers: the ten tasks added when the file was restructured
// to mirror the roadmap (significant accounts, SCOTs, flows/WCGWs, walkthroughs,
// FSCP, controls strategy, post-interim updates, risk reassessment, archive).
// Wording is original and anchored to the ISAs, not to any firm's material.

import { PROC_INTRO_EN, PROC_INTRO_FR, YN_INTRO_EN, YN_INTRO_FR } from "@/lib/papers/strategy";
import type { PaperDef } from "./types";

/* ---------------------------------------------------------------- P6.2 --- */
const D5_8: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶28–29 · ISA 320 ¶10–11",
  ownsEn: "the scoping matrix: significant accounts, disclosures and their relevant assertions",
  ownsFr: "la matrice de périmètre : comptes significatifs, informations à fournir et assertions pertinentes",
  reqEn: [
    "For each class of transactions, account balance and disclosure, we determine whether it is significant: whether there is a reasonable possibility of a material misstatement, judged before considering controls (ISA 315 ¶28–29). The quantitative screen compares the item to performance materiality from P6.1; the qualitative screen considers susceptibility to fraud, estimation uncertainty, related-party involvement, changes in the business, and complexity of the accounting requirement.",
    "For every significant item we then identify the relevant assertions — those for which a material misstatement is reasonably possible. Assertions for classes of transactions are occurrence, completeness, accuracy, cutoff, classification and presentation; for balances they are existence, rights and obligations, completeness, accuracy-valuation-allocation, classification and presentation (ISA 315 ¶A190).",
    "The matrix recorded here drives everything downstream: each significant account maps to the transaction cycles that feed it (S1.1) and to the execution programs that will address its relevant assertions. An account excluded here is not worked; the exclusion rationale is therefore documented with the same care as an inclusion.",
  ],
  reqFr: [
    "Pour chaque flux, solde et information à fournir, nous déterminons s'il est significatif : existe-t-il une possibilité raisonnable d'anomalie significative, appréciée avant prise en compte des contrôles (ISA 315 ¶28–29) ? Le filtre quantitatif compare l'élément au seuil de planification de P6.1 ; le filtre qualitatif considère la fraude, l'incertitude d'estimation, les parties liées, les évolutions de l'activité et la complexité comptable.",
    "Pour chaque élément significatif, nous identifions les assertions pertinentes — celles pour lesquelles une anomalie significative est raisonnablement possible (ISA 315 ¶A190).",
    "La matrice établie ici pilote la suite : chaque compte significatif est relié aux cycles qui l'alimentent (S1.1) et aux programmes d'exécution qui traiteront ses assertions. Une exclusion est documentée avec le même soin qu'une inclusion.",
  ],
  conclEn: ["Significant accounts, disclosures and their relevant assertions have been identified, and the resulting scope is complete."],
  conclFr: ["Les comptes significatifs, informations à fournir et assertions pertinentes ont été identifiés, et le périmètre qui en résulte est complet."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        { key: "tb", en: "Obtain the trial balance or latest financial statements and list every class of transactions, account balance and disclosure.", fr: "Obtenir la balance ou les derniers états financiers et recenser chaque flux, solde et information à fournir.", srcEn: "Trial balance import · prior-year financial statements", srcFr: "Import de balance · états financiers N-1" },
        { key: "quant", en: "Apply the quantitative screen: flag every item above performance materiality (P6.1), and record the threshold used.", fr: "Appliquer le filtre quantitatif : signaler tout élément supérieur au seuil de planification (P6.1) et consigner le seuil retenu.", srcEn: "P6.1 materiality paper · trial balance", srcFr: "Papier P6.1 · balance" },
        { key: "qual", en: "Apply the qualitative screen to items below the threshold: fraud susceptibility, estimation uncertainty, related parties, business changes, accounting complexity. Add any item flagged.", fr: "Appliquer le filtre qualitatif aux éléments sous le seuil : fraude, incertitude d'estimation, parties liées, évolutions, complexité comptable. Ajouter tout élément signalé.", srcEn: "P5.1 fraud risks · S4.3 related parties · P3.1 understanding", srcFr: "P5.1 · S4.3 · P3.1" },
        { key: "assertions", en: "For each significant item, identify the relevant assertions and record the reason each assertion is (or is not) relevant.", fr: "Pour chaque élément significatif, identifier les assertions pertinentes et le motif de leur pertinence (ou non).", srcEn: "Risk assessment discussions · cycle knowledge", srcFr: "Échanges d'évaluation des risques · connaissance des cycles" },
        { key: "map", en: "Map each significant account to the transaction cycles that feed it, and confirm every one is carried by a SCOT identified in S1.1.", fr: "Relier chaque compte significatif aux cycles qui l'alimentent et vérifier que chacun est porté par une SCOT identifiée en S1.1.", srcEn: "S1.1 SCOT listing", srcFr: "Liste des SCOT (S1.1)" },
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

/* ---------------------------------------------------------------- S1.1 --- */
const D8_1: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶25(a) · ¶A136–A143",
  ownsEn: "the list of significant classes of transactions and the IT applications that process them",
  ownsFr: "la liste des catégories significatives de transactions et des applications qui les traitent",
  reqEn: [
    "We identify the significant classes of transactions (SCOTs): the transaction streams that feed the significant accounts identified in P6.2. Each is classified as routine (high volume, recurring), non-routine (unusual, period-end) or estimation (judgement-driven), because the classification drives where misstatements are likely to arise and what the audit response looks like.",
    "For each SCOT we identify the IT applications and other technology through which the transactions are initiated, recorded, processed and reported (ISA 315 ¶25(a), ¶26(b)). This list is the bridge to the IT work: the applications named here define the scope of ITGC testing (E1.1) and application-control work (E1.2), and connect to the IT environment understanding in P4.3.",
  ],
  reqFr: [
    "Nous identifions les catégories significatives de transactions (SCOT) : les flux qui alimentent les comptes significatifs de P6.2. Chacune est classée routinière, non routinière ou estimation, car cette classification détermine où les anomalies peuvent naître et la réponse d'audit.",
    "Pour chaque SCOT, nous identifions les applications informatiques par lesquelles les transactions sont initiées, enregistrées, traitées et restituées (ISA 315 ¶25(a), ¶26(b)). Cette liste définit le périmètre des travaux ITGC (E1.1) et des contrôles applicatifs (E1.2), en lien avec P4.3.",
  ],
  conclEn: ["The significant classes of transactions and their related applications have been identified completely."],
  conclFr: ["Les catégories significatives de transactions et leurs applications associées ont été identifiées de manière exhaustive."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        { key: "streams", en: "From the significant accounts in P6.2, identify every transaction stream that feeds them, and name each SCOT.", fr: "À partir des comptes significatifs de P6.2, identifier chaque flux de transactions qui les alimente et nommer chaque SCOT.", srcEn: "P6.2 scoping matrix · discussion with finance", srcFr: "Matrice P6.2 · échange avec la direction financière", tipEn: "Print the balance des comptes and work through it class by class: for each significant account, ask the chef comptable which journal feeds it — ventes, achats, banque, caisse, OD. In Sage/SAARI the journal codes map almost exactly to the significant transaction streams; a stream that only ever appears in the OD journal is a warning sign, not a stream.", tipFr: "Imprimer la balance des comptes et la parcourir classe par classe : pour chaque compte significatif, demander au chef comptable quel journal l'alimente — ventes, achats, banque, caisse, OD. Dans Sage/SAARI, les codes journaux correspondent presque exactement aux flux significatifs ; un flux qui n'apparaît que dans le journal des OD est un signal d'alerte, pas un flux." },
        { key: "classify", en: "Classify each SCOT as routine, non-routine or estimation, and record the volume and frequency.", fr: "Classer chaque SCOT (routinière, non routinière, estimation) et consigner volume et fréquence.", srcEn: "Management inquiry · system reports", srcFr: "Entretiens · états systèmes", tipEn: "Pull a count of entries per journal per month from Sage/SAARI — a simple export of the brouillard is enough. Steady monthly volumes point to routine; entries clustered in December and January point to non-routine; anything that starts from a spreadsheet calculation — amortissements, the provision for congés payés, doubtful-debt provisions — is estimation regardless of volume.", tipFr: "Extraire de Sage/SAARI le nombre d'écritures par journal et par mois — un simple export du brouillard suffit. Des volumes mensuels stables signalent le routinier ; des écritures concentrées en décembre-janvier signalent le non-routinier ; tout ce qui part d'un calcul sur tableur — amortissements, provision pour congés payés, provisions clients — relève de l'estimation, quel que soit le volume." },
        { key: "apps", en: "For each SCOT, identify the applications and interfaces through which transactions are initiated, recorded, processed and reported.", fr: "Pour chaque SCOT, identifier les applications et interfaces d'initiation, d'enregistrement, de traitement et de restitution.", srcEn: "IT inquiry (P4.3) · system landscape diagram", srcFr: "Entretiens IT (P4.3) · cartographie des systèmes", tipEn: "Ask where each transaction is born, not just where it is booked: many entities invoice in Excel or a billing tool and re-key into Sage, and mobile money collections may live only in the operator's portal until a monthly summary entry. Note every re-keying point and every interface as a step of its own — that is exactly where E1.2 will look.", tipFr: "Demander où naît chaque transaction, pas seulement où elle est comptabilisée : beaucoup d'entités facturent sous Excel ou un logiciel de facturation puis ressaisissent dans Sage, et les encaissements mobile money ne figurent que dans le portail de l'opérateur jusqu'à une écriture récapitulative mensuelle. Noter chaque point de ressaisie et chaque interface comme une étape à part entière — c'est précisément là que porteront les travaux E1.2." },
        { key: "accounts", en: "Map each SCOT to the significant accounts it affects, and verify every significant account is reached by at least one SCOT or scoped as a non-transactional balance.", fr: "Relier chaque SCOT aux comptes significatifs concernés et vérifier que chaque compte significatif est couvert.", srcEn: "P6.2 matrix", srcFr: "Matrice P6.2", tipEn: "Do the tick both ways: take the P6.2 list and tie each account to a transaction stream, then take each stream and tick off the accounts it hits in the grand livre. Balances with no stream — provisions, capital, subventions — should be marked non-transactional on purpose, not left blank.", tipFr: "Faire le pointage dans les deux sens : prendre la liste P6.2 et rattacher chaque compte à un flux, puis prendre chaque flux et pointer les comptes qu'il touche dans le grand livre. Les soldes sans flux — provisions, capital, subventions — doivent être marqués non transactionnels volontairement, pas laissés en blanc." },
        { key: "itscope", en: "Confirm the applications listed here are inside the ITGC scope (E1.1), or record why not.", fr: "Vérifier que les applications recensées entrent dans le périmètre ITGC (E1.1), ou consigner pourquoi non.", srcEn: "E1.1 scope note", srcFr: "Note de périmètre E1.1", tipEn: "Compare your application list line by line against the E1.1 scope note and initial each match. Where an application sits outside scope — the operator's mobile money portal, a standalone payroll tool — write the one-sentence reason (for example: output re-keyed and reconciled manually) so the reviewer sees a decision, not an omission.", tipFr: "Comparer ligne à ligne la liste des applications avec la note de périmètre E1.1 et viser chaque correspondance. Quand une application est hors périmètre — portail mobile money de l'opérateur, logiciel de paie isolé — écrire la raison en une phrase (par exemple : sorties ressaisies et rapprochées manuellement) pour que le réviseur voie une décision, pas un oubli." },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "complete", en: "Every significant account from P6.2 is fed by an identified SCOT or documented as non-transactional.", fr: "Chaque compte significatif de P6.2 est alimenté par une SCOT identifiée ou documenté comme non transactionnel." },
        { key: "classified", en: "Each SCOT carries a routine / non-routine / estimation classification.", fr: "Chaque SCOT est classée routinière / non routinière / estimation." },
        { key: "apps_listed", en: "The related applications are identified for every SCOT.", fr: "Les applications associées sont identifiées pour chaque SCOT." },
        { key: "it_aligned", en: "The application list agrees with the IT environment understanding in P4.3.", fr: "La liste des applications concorde avec la connaissance de l'environnement informatique (P4.3)." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- S1.2 --- */
const D8_2: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶25–26 · ¶A144–A150",
  ownsEn: "the per-cycle flow documentation: transaction flows, what-could-go-wrongs and the controls that address them",
  ownsFr: "la documentation par cycle : flux de transactions, points de risque (WCGW) et contrôles associés",
  reqEn: [
    "For each SCOT we document the flow of transactions from initiation through recording and processing to reporting, including how the flow is corrected and how it reaches the general ledger (ISA 315 ¶25(a)). The documentation names the people, the documents and the systems at each step.",
    "At each step we ask what could go wrong: the specific points where a misstatement could arise in a relevant assertion. For each what-could-go-wrong we identify whether a control exists that addresses it, who performs the control, how often, and whether it is manual, IT-dependent manual, or automated. Automated and IT-dependent controls inherit the reliability of the applications behind them, which is why each is tagged to its application from S1.1.",
    "We evaluate the design of each identified control and determine whether it has been implemented — walkthroughs (S1.3) provide that evidence. Whether the control will be tested for operating effectiveness is a separate decision, made in S2.1.",
  ],
  reqFr: [
    "Pour chaque SCOT, nous documentons le flux de l'initiation à la restitution, y compris les corrections et le déversement en comptabilité générale (ISA 315 ¶25(a)), en nommant acteurs, documents et systèmes à chaque étape.",
    "À chaque étape, nous identifions ce qui pourrait mal tourner (WCGW) : les points précis où une anomalie pourrait naître sur une assertion pertinente, puis le contrôle qui y répond, son exécutant, sa fréquence et sa nature (manuel, manuel dépendant de l'informatique, automatisé).",
    "Nous évaluons la conception de chaque contrôle et sa mise en œuvre — les tests de cheminement (S1.3) en apportent la preuve. La décision de tester l'efficacité opérationnelle relève de S2.1.",
  ],
  conclEn: ["The flows, what-could-go-wrongs and controls of each significant class of transactions are documented and their design evaluated."],
  conclFr: ["Les flux, points de risque et contrôles de chaque catégorie significative de transactions sont documentés et leur conception évaluée."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        { key: "flow", en: "For each SCOT, document the flow initiation → recording → processing → reporting, naming people, documents and systems at each step.", fr: "Pour chaque SCOT, documenter le flux initiation → enregistrement → traitement → restitution, en nommant acteurs, documents et systèmes.", srcEn: "Process inquiry · procedure manuals · system screens", srcFr: "Entretiens · manuels de procédures · écrans systèmes", tipEn: "Build each flow as a simple four-column table: step, who, document, system. Collect a real specimen at each step — bon de commande, bon de livraison, facture, the Sage entry screen — and attach copies to the paper; a flow written from the procedure manual alone will not survive the walkthrough.", tipFr: "Construire chaque flux sous forme de tableau simple à quatre colonnes : étape, qui, document, système. Collecter un spécimen réel à chaque étape — bon de commande, bon de livraison, facture, écran de saisie Sage — et joindre les copies au papier ; un flux rédigé d'après le seul manuel de procédures ne survivra pas au test de cheminement." },
        { key: "wcgw", en: "At each step, record the what-could-go-wrongs: where a misstatement could arise and which relevant assertion it would hit.", fr: "À chaque étape, consigner les WCGW : où une anomalie pourrait naître et quelle assertion serait touchée.", srcEn: "Flow documentation · team discussion (P5.2)", srcFr: "Documentation des flux · discussion d'équipe (P5.2)", tipEn: "At each step ask two blunt questions: what if this document never arrives, and what if it arrives twice or wrong? A delivery with no invoice is completeness; an invoice with no delivery is occurrence; a price typed by hand is accuracy. Write each what-could-go-wrong in one sentence a junior could test.", tipFr: "À chaque étape, poser deux questions directes : que se passe-t-il si ce document n'arrive jamais, et que se passe-t-il s'il arrive en double ou avec une erreur ? Une livraison sans facture, c'est l'exhaustivité ; une facture sans livraison, c'est la réalité ; un prix saisi à la main, c'est l'exactitude. Rédiger chaque risque d'anomalie en une phrase qu'un assistant peut tester." },
        { key: "controls", en: "For each what-could-go-wrong, identify the control that addresses it: performer, frequency, and nature (manual / IT-dependent / automated), tagged to its application.", fr: "Pour chaque WCGW, identifier le contrôle qui y répond : exécutant, fréquence, nature (manuel / dépendant IT / automatisé), rattaché à son application.", srcEn: "Control descriptions · S1.1 application list", srcFr: "Descriptions de contrôles · liste d'applications S1.1", tipEn: "Name a person, not a department: 'accounting checks it' is not a control, 'the chef comptable signs the rapprochement bancaire each month' is. Tag automated controls — a Sage sequence check, a blocking credit limit — to their application from S1.1: their reliability depends directly on the E1.1 conclusions.", tipFr: "Nommer une personne, pas un service : « la comptabilité vérifie » n'est pas un contrôle, « le chef comptable signe le rapprochement bancaire chaque mois » en est un. Rattacher les contrôles automatisés — contrôle de séquence Sage, plafond de crédit bloquant — à leur application de S1.1 : leur fiabilité dépend directement des conclusions de E1.1." },
        { key: "design", en: "Evaluate the design of each control: performed as described, by someone with authority and competence, at a frequency that would catch a material misstatement.", fr: "Évaluer la conception de chaque contrôle : exécution conforme, autorité et compétence de l'exécutant, fréquence adaptée.", srcEn: "Inquiry · inspection of control evidence", srcFr: "Entretiens · inspection des preuves de contrôle", tipEn: "For each control, take one recent instance and look at the trace it left — the visa on the facture, the signed reconciliation, the parameter screen. Then ask the deciding question: would this control catch a misstatement above performance materiality, or only small errors? A monthly review at balance level rarely catches an item hidden inside a large account.", tipFr: "Pour chaque contrôle, prendre une occurrence récente et regarder la trace laissée — le visa sur la facture, le rapprochement signé, l'écran de paramétrage. Puis poser la question décisive : ce contrôle détecterait-il une anomalie supérieure au seuil de planification, ou seulement de petites erreurs ? Une revue mensuelle au niveau de la balance détecte rarement un écart caché dans un gros compte." },
        { key: "gaps", en: "Record every what-could-go-wrong with no control or a badly designed one, and carry each to the risk register (S3.1) and to S2.1 as substantive-only.", fr: "Consigner chaque WCGW sans contrôle ou mal conçu, et le reporter au registre des risques (S3.1) et en approche substantive (S2.1).", srcEn: "This paper · S3.1", srcFr: "Ce papier · S3.1", tipEn: "Keep a running gap column in the flow table so nothing carries over from memory. For each gap, draft the risk sentence for S3.1 and note in S2.1 that the assertion goes substantive-only — and be honest about family-run entities where the gérant does everything: that is one pervasive segregation gap, not five separate ones.", tipFr: "Tenir une colonne « écart » dans le tableau des flux pour que rien ne passe de mémoire. Pour chaque écart, rédiger la phrase de risque pour S3.1 et noter dans S2.1 que l'assertion sera couverte en substantif seul — et rester lucide sur les entités familiales où le gérant fait tout : c'est une carence de séparation des tâches généralisée, pas cinq carences distinctes." },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "each_scot", en: "A flow, its what-could-go-wrongs and its controls are documented for every SCOT in S1.1.", fr: "Flux, WCGW et contrôles sont documentés pour chaque SCOT de S1.1." },
        { key: "assertions", en: "Each what-could-go-wrong names the relevant assertion it threatens.", fr: "Chaque WCGW précise l'assertion pertinente menacée." },
        { key: "design_ok", en: "The design of each identified control has been evaluated.", fr: "La conception de chaque contrôle identifié a été évaluée." },
        { key: "gaps_carried", en: "Control gaps are carried to the risk register and to the controls strategy.", fr: "Les lacunes de contrôle sont reportées au registre des risques et à la stratégie de contrôles." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- S1.3 --- */
const D8_3: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶26(a) · ISA 230 ¶8",
  ownsEn: "the walkthrough evidence that the documented flows and controls exist as described",
  ownsFr: "la preuve par cheminement que les flux et contrôles documentés existent tels que décrits",
  reqEn: [
    "A walkthrough traces one transaction of each significant class from origination through the entity's processes to its reporting in the financial statements, using the same documents and IT systems the entity uses. It combines inquiry, observation and inspection: we watch the control performed, inspect the evidence it leaves, and ask the performer what happens when something unusual arrives (ISA 315 ¶26(a), A verification of implementation).",
    "The walkthrough confirms — or corrects — the flow documentation in S1.2. A difference between the documented and the observed process is not a footnote: it updates S1.2, may create a new what-could-go-wrong, and may change the controls strategy in S2.1.",
  ],
  reqFr: [
    "Un test de cheminement suit une transaction de chaque catégorie significative depuis son origine jusqu'aux états financiers, avec les documents et systèmes réels de l'entité. Il combine entretien, observation et inspection (ISA 315 ¶26(a)).",
    "Le cheminement confirme — ou corrige — la documentation de S1.2. Un écart entre le processus documenté et le processus observé met à jour S1.2, peut créer un nouveau WCGW et modifier la stratégie de contrôles (S2.1).",
  ],
  conclEn: ["Walkthroughs confirm that the documented flows and controls are implemented as described."],
  conclFr: ["Les tests de cheminement confirment que les flux et contrôles documentés sont mis en œuvre tels que décrits."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        { key: "select", en: "Select one representative transaction per SCOT (and one non-routine instance where the flow differs at period end).", fr: "Sélectionner une transaction représentative par SCOT (et un cas non routinier lorsque le flux diffère en clôture).", srcEn: "Transaction listings", srcFr: "Journaux de transactions", tipEn: "Pick from the middle of the population, not the item the accountant offers: take the journal des ventes, choose an ordinary invoice from a routine month, and separately a period-end item — a December sale, a year-end OD — where the flow differs. Note the reference before announcing the walkthrough, so the file is not tidied up in advance.", tipFr: "Choisir au milieu de la population, pas la pièce que le comptable propose : prendre le journal des ventes, retenir une facture ordinaire d'un mois banal, et à part un élément de fin d'exercice — une vente de décembre, une OD de clôture — où le circuit diffère. Relever la référence avant d'annoncer le cheminement, pour que le dossier ne soit pas remis en ordre à l'avance." },
        { key: "trace", en: "Trace it end-to-end through documents and systems, recording each step against the S1.2 flow.", fr: "La suivre de bout en bout à travers documents et systèmes, en rapprochant chaque étape du flux S1.2.", srcEn: "Source documents · system records", srcFr: "Pièces d'origine · enregistrements systèmes", tipEn: "Follow the paper and the screen together: start at the bon de commande, follow to the bon de livraison, the facture, the Sage entry, and the collection on the relevé bancaire or mobile money statement. Tick each step against the S1.2 flow as you go and note the dates — a facture dated before its delivery is a finding, not a formality.", tipFr: "Suivre le papier et l'écran ensemble : partir du bon de commande, suivre le bon de livraison, la facture, l'écriture Sage, puis l'encaissement sur le relevé bancaire ou le relevé mobile money. Pointer chaque étape contre le flux S1.2 en avançant et noter les dates — une facture antérieure à sa livraison est un constat, pas un détail." },
        { key: "observe", en: "At each control point, observe or reperform the control and inspect the evidence it leaves.", fr: "À chaque point de contrôle, observer ou refaire le contrôle et inspecter la preuve laissée.", srcEn: "Control evidence (signatures, logs, reports)", srcFr: "Preuves de contrôle (visas, journaux, états)", tipEn: "Sit next to the performer and watch them do it on a live item: ask the accountant to run this month's rapprochement in front of you, or to show the Sage screen that blocks a duplicate invoice number. Scan or photograph the signed evidence there and then — 'yes, we sign it' with no signature to show is inquiry, not observation.", tipFr: "S'asseoir à côté de l'exécutant et le regarder faire sur une pièce réelle : demander au comptable de dérouler le rapprochement du mois devant soi, ou de montrer l'écran Sage qui bloque un numéro de facture en double. Scanner ou photographier la trace signée sur-le-champ — « oui, on le signe » sans signature à montrer relève de l'entretien, pas de l'observation." },
        { key: "exceptions", en: "Ask each performer how exceptions and unusual items are handled, and corroborate with an example where available.", fr: "Demander à chaque exécutant le traitement des exceptions et le corroborer par un exemple si possible.", srcEn: "Inquiry · exception logs", srcFr: "Entretiens · journaux d'exceptions", tipEn: "Ask 'show me the last one that went wrong': a rejected mobile money payment, a refused delivery, a credit note. If the performer cannot produce a single example, either exceptions never happen — unlikely — or they are handled off the books; both answers belong in the paper.", tipFr: "Demander « montrez-moi la dernière qui a mal tourné » : un paiement mobile money rejeté, une livraison refusée, un avoir. Si l'exécutant ne peut produire aucun exemple, soit les exceptions n'arrivent jamais — peu probable —, soit elles se traitent hors circuit ; les deux réponses ont leur place dans le papier." },
        { key: "update", en: "Record every difference from the documented flow and update S1.2, S3.1 and S2.1 accordingly.", fr: "Consigner tout écart avec le flux documenté et mettre à jour S1.2, S3.1 et S2.1.", srcEn: "This paper", srcFr: "Ce papier", tipEn: "Write the differences down at the client's premises the same day, while the detail is fresh, and route each one: correct the S1.2 flow, add any new what-could-go-wrong, and re-ask whether the S2.1 strategy still holds. A walkthrough that changed nothing anywhere should make a reviewer suspicious.", tipFr: "Consigner les écarts chez le client le jour même, tant que le détail est frais, et donner une suite à chacun : corriger le flux S1.2, ajouter tout nouveau risque d'anomalie, et réexaminer si la stratégie S2.1 tient toujours. Un cheminement qui n'a rien changé nulle part doit rendre le réviseur méfiant." },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "all_scots", en: "A walkthrough was performed for every SCOT.", fr: "Un cheminement a été réalisé pour chaque SCOT." },
        { key: "as_described", en: "The observed process matches the S1.2 documentation (differences resolved and documented).", fr: "Le processus observé correspond à la documentation S1.2 (écarts résolus et documentés)." },
        { key: "controls_seen", en: "Each key control was observed or reperformed, not merely described in inquiry.", fr: "Chaque contrôle clé a été observé ou refait, et non simplement décrit en entretien." },
        { key: "updates_done", en: "Differences found have been carried through to S1.2, S3.1 and S2.1.", fr: "Les écarts relevés ont été répercutés dans S1.2, S3.1 et S2.1." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- S1.4 --- */
const D8_4: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶25(a)(ii) · ISA 240 ¶32",
  ownsEn: "the understanding and evaluation of the financial statement close process",
  ownsFr: "la compréhension et l'évaluation du processus d'arrêté des comptes (FSCP)",
  reqEn: [
    "The financial statement close process covers how the entity moves from trial balance to financial statements: standard and non-standard journal entries, consolidation adjustments, reconciliations, the selection and application of accounting policies, and the preparation of disclosures (ISA 315 ¶25(a)(ii)). It deserves its own paper because it runs at period end, under time pressure, with pervasive access — the exact conditions under which management override operates (ISA 240 ¶32).",
    "We document who can post entries, who approves non-standard entries, how reconciliations are reviewed, how the statements are compiled and reviewed, and which spreadsheets or tools outside the accounting system intervene. Each manual step outside the system is a what-could-go-wrong of its own.",
    "In a SYSCOHADA entity the close is where the écritures d'inventaire live: amortissements, provisions, stock variations and the régularisations de charges et de produits, almost all posted as manual OD entries after the balance avant inventaire is drawn. ISA 315 (Revised 2019) para 25(a)(ii) requires an understanding of exactly this — how journal entries, standard and non-standard, are initiated, authorised, recorded and processed — so this paper names, entry family by entry family, who calculates the figure, who posts it and who reviews it. The DSF adds a further layer: the statements are compiled into a tax-facing format, often in a separate workbook or by an external expert-comptable, and any adjustment made in that workbook without a matching ledger entry is a misstatement risk in its own right.",
    "The same understanding feeds the fraud response: manual journals posted at the close, by senior people, outside normal patterns are the classic vehicle for management override (ISA 240 para 32), and ISA 315 para 25 is what tells the team what 'normal' looks like at this entity. Document the expected profile — who posts, in which journals, in which period — so that E3.1 can select against it: entries by unexpected users, to unusual account pairings, or dated after the balance après inventaire come first.",
  ],
  reqFr: [
    "Le processus d'arrêté couvre le passage de la balance aux états financiers : écritures standards et non standards, retraitements, rapprochements, choix des méthodes comptables et préparation de l'annexe (ISA 315 ¶25(a)(ii)). Il s'exécute en clôture, sous pression, avec des accès étendus — les conditions mêmes du contournement par la direction (ISA 240 ¶32).",
    "Nous documentons qui peut passer des écritures, qui approuve les écritures non standards, comment les rapprochements sont revus, comment les états sont établis et revus, et quels tableurs hors système interviennent. Chaque étape manuelle hors système constitue un WCGW à part entière.",
    "Dans une entité SYSCOHADA, la clôture est le lieu des écritures d'inventaire : amortissements, provisions, variations de stocks et régularisations de charges et de produits, presque toutes passées en OD manuelles après l'édition de la balance avant inventaire. La norme ISA 315 (révisée 2019) ¶25(a)(ii) exige de comprendre précisément cela — comment les écritures, standard et non standard, sont initiées, autorisées, enregistrées et traitées — et ce papier nomme donc, famille d'écritures par famille d'écritures, qui calcule le chiffre, qui le passe et qui le revoit. La DSF ajoute une couche supplémentaire : les états sont compilés dans un format à finalité fiscale, souvent dans un classeur distinct ou par un expert-comptable externe, et tout ajustement opéré dans ce classeur sans écriture correspondante au grand livre constitue un risque d'anomalie à part entière.",
    "Cette même compréhension nourrit la réponse au risque de fraude : les écritures manuelles passées à la clôture, par des personnes de niveau élevé, hors des schémas habituels, sont le véhicule classique du contournement des contrôles par la direction (ISA 240 ¶32), et c'est le ¶25 d'ISA 315 qui dit à l'équipe à quoi ressemble le « normal » chez cette entité. Documenter le profil attendu — qui passe des écritures, dans quels journaux, à quelle période — pour que E3.1 puisse cibler ce qui s'en écarte : écritures passées par des utilisateurs inattendus, sur des couples de comptes inhabituels, ou datées après la balance après inventaire, à examiner en premier.",
  ],
  conclEn: ["The financial statement close process is understood, its what-could-go-wrongs identified, and the planned response recorded."],
  conclFr: ["Le processus d'arrêté est compris, ses points de risque identifiés et la réponse prévue consignée."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        { key: "map", en: "Document the close calendar and each step from trial balance to signed financial statements, naming performers and tools.", fr: "Documenter le calendrier de clôture et chaque étape de la balance aux états signés, en nommant exécutants et outils.", srcEn: "Close calendar · finance inquiry", srcFr: "Calendrier de clôture · entretiens finance", tipEn: "Have the chef comptable talk you through last year's close document by document: the balance avant inventaire, the écritures d'inventaire (amortissements, provisions, stocks, régularisations), the balance après inventaire and the DSF. Write real dates against each step — a DSF finalised the night before the April deadline says more about review time than any calendar.", tipFr: "Faire raconter au chef comptable la clôture de l'an dernier document par document : la balance avant inventaire, les écritures d'inventaire (amortissements, provisions, stocks, régularisations), la balance après inventaire et la DSF. Noter les vraies dates à chaque étape — une DSF bouclée la veille de l'échéance d'avril en dit plus sur le temps de revue que n'importe quel calendrier." },
        { key: "je", en: "Understand journal-entry practices: who can post, approval of non-standard entries, and the population of period-end adjustments.", fr: "Comprendre la pratique des écritures : qui peut saisir, approbation des écritures non standards, population des écritures de clôture.", srcEn: "User-access listing · journal-entry reports", srcFr: "Liste des accès · journaux d'écritures", tipEn: "Get the Sage/SAARI user list and match it to the actual humans: in many entities everyone shares one login, which makes 'who can post' an easy but important finding. Then export the OD journal for the closing months — that is the population of period-end adjustments E3.1 will test — and ask who approved each non-standard entry.", tipFr: "Obtenir la liste des utilisateurs Sage/SAARI et la rapprocher des personnes réelles : dans beaucoup d'entités, tout le monde partage un seul identifiant, constat facile mais important sur « qui peut passer une écriture ». Exporter ensuite le journal des OD des mois de clôture — c'est la population des ajustements de fin d'exercice que testera E3.1 — et demander qui a approuvé chaque écriture non standard." },
        { key: "recon", en: "Identify the key reconciliations (bank, intercompany, subledger-to-GL) and how each is prepared and reviewed.", fr: "Identifier les rapprochements clés (banque, intragroupe, auxiliaire-général) et leurs modalités de préparation et de revue.", srcEn: "Reconciliation files", srcFr: "Dossiers de rapprochement", tipEn: "Collect the December rapprochements bancaires themselves, not the assurance that they exist, and check each carries a preparer and a reviewer signature with dates. Ask how old the oldest unreconciled item is — long-standing suspens on the bank and mobile money accounts are where close problems hide.", tipFr: "Se faire remettre les rapprochements bancaires de décembre eux-mêmes, pas l'assurance qu'ils existent, et vérifier sur chacun la signature du préparateur et du réviseur avec les dates. Demander l'âge du plus vieux suspens — les suspens anciens sur les comptes banque et mobile money sont l'endroit où se cachent les problèmes de clôture." },
        { key: "spreadsheets", en: "List the spreadsheets and tools outside the accounting system used in the close, and treat each as a what-could-go-wrong.", fr: "Recenser les tableurs et outils hors système utilisés à l'arrêté, chacun constituant un WCGW.", srcEn: "Finance inquiry · file inspection", srcFr: "Entretiens · inspection des fichiers", tipEn: "Ask for the actual files and open them: the amortization schedule, the stock valuation sheet, the congés payés provision, the DSF preparation workbook. For each, check who owns it, whether the formulas are protected, and how figures travel from the spreadsheet into Sage — every manual re-key is a what-could-go-wrong of its own.", tipFr: "Demander les fichiers eux-mêmes et les ouvrir : tableau d'amortissement, feuille de valorisation des stocks, provision pour congés payés, classeur de préparation de la DSF. Pour chacun, vérifier qui en est propriétaire, si les formules sont protégées, et comment les chiffres passent du tableur à Sage — chaque ressaisie manuelle est un risque d'anomalie à part entière." },
        { key: "evaluate", en: "Evaluate the design of the controls over the close and decide the response: controls testing (S2.1) and/or the journal-entry testing in E3.1.", fr: "Évaluer la conception des contrôles de l'arrêté et arrêter la réponse : tests de contrôles (S2.1) et/ou tests d'écritures (E3.1).", srcEn: "This paper · S2.1 · E3.1", srcFr: "Ce papier · S2.1 · E3.1", tipEn: "Be realistic: in most SYSCOHADA SMEs the close is one or two people with full access, so the honest answer is often no reliance and a full E3.1 journal-entry response. Where a genuine review exists — the DG or the expert-comptable signing off the écritures d'inventaire — evidence it and weigh S2.1 testing; either way, record the decision, not just the description.", tipFr: "Rester réaliste : dans la plupart des PME SYSCOHADA, la clôture repose sur une ou deux personnes avec accès complet, et la réponse honnête est souvent l'absence d'appui sur les contrôles et un test complet des écritures en E3.1. Là où une vraie revue existe — le DG ou l'expert-comptable qui vise les écritures d'inventaire — la documenter et peser un test S2.1 ; dans les deux cas, écrire la décision, pas seulement la description." },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "documented", en: "The close process is documented end-to-end, including tools outside the accounting system.", fr: "Le processus d'arrêté est documenté de bout en bout, y compris les outils hors système." },
        { key: "je_pop", en: "The journal-entry population and posting rights are understood.", fr: "La population d'écritures et les droits de saisie sont compris." },
        { key: "override", en: "The management-override points in the close are identified and linked to E3.1.", fr: "Les points de contournement possibles à l'arrêté sont identifiés et reliés à E3.1." },
        { key: "response", en: "The planned response to close-process risks is recorded.", fr: "La réponse prévue aux risques de l'arrêté est consignée." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- S2.1 --- */
const D8_5: PaperDef = {
  std: "ISA 330 ¶8 · ISA 315 (Revised 2019) ¶33–34",
  ownsEn: "the controls-reliance decision: which controls will be tested for operating effectiveness, and why",
  ownsFr: "la décision d'appui sur les contrôles : lesquels seront testés en efficacité, et pourquoi",
  reqEn: [
    "For each relevant assertion of each significant account we decide the strategy: substantive procedures alone, or a combined approach relying on controls. Controls must be tested when we intend to rely on their operating effectiveness, and whenever substantive procedures alone cannot provide sufficient appropriate evidence — typically highly automated processing with little or no documentation outside the system (ISA 330 ¶8).",
    "Where reliance is planned, we select the controls that address the what-could-go-wrongs of the assertion (from S1.2), preferring controls that cover more than one what-could-go-wrong and automated controls whose consistency ITGCs can carry. The selection names each control, the assertion it supports, and the deviation tolerance the strategy can bear.",
    "Reliance pays only when two conditions hold together: the risk assessment at assertion level includes an expectation that the controls operate effectively, and testing them costs less than the substantive assurance it replaces (ISA 330 ¶8(a)). The more the strategy leans on a control, the more persuasive the evidence of its operating effectiveness must be (ISA 330 ¶9). And reliance stops being a choice where substantive procedures alone cannot provide sufficient appropriate evidence at assertion level: where routine transactions are initiated, recorded, processed and reported only in automated form, those are risks for which controls must be identified and tested (ISA 330 ¶8(b); ISA 315 (Revised 2019) ¶33).",
    "No control enters the reliance plan on its description alone. For each control identified, ISA 315 (Revised 2019) ¶26 requires an evaluation of whether its design is capable of effectively preventing, or detecting and correcting, the misstatement it addresses, and a determination — by walkthrough or inspection of a live occurrence, never by inquiry alone — that it has been implemented. A control whose design evaluation failed, or whose implementation was not confirmed in S1.2, cannot be selected for testing here, whatever the strategy would prefer.",
  ],
  reqFr: [
    "Pour chaque assertion pertinente de chaque compte significatif, nous arrêtons la stratégie : substantive seule ou combinée avec appui sur les contrôles. Les contrôles doivent être testés lorsque nous prévoyons de nous appuyer sur leur efficacité, et lorsque les procédures substantives seules ne suffisent pas — traitement fortement automatisé sans documentation hors système (ISA 330 ¶8).",
    "En cas d'appui prévu, nous sélectionnons les contrôles qui répondent aux WCGW de l'assertion (S1.2), en privilégiant les contrôles couvrant plusieurs WCGW et les contrôles automatisés dont les ITGC portent la constance.",
    "L'appui sur les contrôles n'est rentable que si deux conditions tiennent ensemble : l'évaluation des risques au niveau des assertions repose sur l'attente que les contrôles fonctionnent efficacement, et leur test coûte moins que l'assurance corroborative qu'il remplace (ISA 330 ¶8(a)). Plus la stratégie s'appuie sur un contrôle, plus la preuve de son efficacité doit être convaincante (ISA 330 ¶9). Et l'appui cesse d'être un choix lorsque les procédures de corroboration seules ne peuvent fournir des éléments suffisants et appropriés au niveau de l'assertion : quand des transactions courantes sont initiées, enregistrées, traitées et restituées uniquement sous forme automatisée, ce sont des risques pour lesquels des contrôles doivent être identifiés et testés (ISA 330 ¶8(b) ; ISA 315 (révisée 2019) ¶33).",
    "Aucun contrôle n'entre dans le plan d'appui sur sa seule description. Pour chaque contrôle identifié, ISA 315 (révisée 2019) ¶26 exige d'évaluer si sa conception est capable de prévenir, ou de détecter et corriger, l'anomalie qu'il vise, et de déterminer — par cheminement ou inspection d'une occurrence réelle, jamais par simple demande d'information — qu'il a été mis en œuvre. Un contrôle dont l'évaluation de conception a échoué, ou dont la mise en œuvre n'a pas été confirmée en S1.2, ne peut pas être retenu pour les tests ici, quelle que soit la préférence de la stratégie.",
  ],
  conclEn: ["The audit strategy per assertion is decided, and the controls selected for testing address the associated what-could-go-wrongs."],
  conclFr: ["La stratégie par assertion est arrêtée et les contrôles sélectionnés répondent aux WCGW associés."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        { key: "strategy", en: "For each relevant assertion, record the strategy: substantive only, or combined with controls reliance, with the reason.", fr: "Pour chaque assertion pertinente, consigner la stratégie : substantive seule ou combinée, avec le motif.", srcEn: "P6.2 matrix · S1.2 flow papers", srcFr: "Matrice P6.2 · papiers de flux S1.2", tipEn: "Work down the P6.2 matrix assertion by assertion, not account by account: occurrence of revenue may justify reliance while cut-off stays substantive. Write the reason in one line a reviewer can challenge — 'volumes too high to vouch substantively' or 'control cheap to test and ran all year' — never 'combined approach' on its own.", tipFr: "Descendre la matrice P6.2 assertion par assertion, pas compte par compte : la réalité des ventes peut justifier l'appui sur les contrôles pendant que la séparation des exercices reste corroborative. Écrire la raison en une ligne qu'un réviseur peut discuter — « volumes trop importants pour tout pointer » ou « contrôle peu coûteux à tester et actif toute l'année » — jamais « approche mixte » seule." },
        { key: "forced", en: "Identify assertions where substantive procedures alone cannot suffice (automated processing, no external evidence) — controls testing is mandatory there.", fr: "Identifier les assertions où la substantive seule ne peut suffire (traitement automatisé, absence de preuve externe) — le test de contrôles y est obligatoire.", srcEn: "S1.1 application list · S1.2", srcFr: "Liste S1.1 · S1.2", tipEn: "Hunt for figures that exist only inside a system: interconnection revenue rated by a billing platform, fuel volumes from automated pumps, mobile money commissions computed on the operator's portal. If the only trail is a system report with no paper or third-party document behind it, flag the assertion as reliance-mandatory and route the application straight into the ITGC scope.", tipFr: "Chercher les chiffres qui n'existent que dans un système : revenus d'interconnexion tarifés par une plateforme de facturation, volumes de carburant issus de pompes automatisées, commissions mobile money calculées sur le portail de l'opérateur. Si la seule trace est un état système sans papier ni pièce externe derrière, classer l'assertion en appui obligatoire et faire entrer l'application directement dans le périmètre ITGC." },
        { key: "select", en: "Where reliance is planned, select the controls to test, naming the what-could-go-wrongs each addresses.", fr: "En cas d'appui prévu, sélectionner les contrôles à tester en précisant les WCGW couverts.", srcEn: "S1.2 control inventory", srcFr: "Inventaire des contrôles S1.2", tipEn: "Prefer one control that kills several what-could-go-wrongs: a monthly bank reconciliation signed by the chef comptable covers existence and accuracy of cash in a single test. Pick the control closest to where the error would arise in the S1.2 flow and drop duplicative downstream reviews — testing two controls over the same what-could-go-wrong buys no extra assurance.", tipFr: "Préférer un contrôle qui couvre plusieurs risques à la fois : un rapprochement bancaire mensuel signé du chef comptable couvre l'existence et l'exactitude de la trésorerie en un seul test. Choisir dans le flux S1.2 le contrôle le plus proche de la naissance de l'erreur et écarter les revues aval redondantes — tester deux contrôles sur le même risque n'ajoute aucune assurance." },
        { key: "itgc_dep", en: "For each automated or IT-dependent control selected, confirm its application is covered by the ITGC scope (E1.1).", fr: "Pour chaque contrôle automatisé ou dépendant IT sélectionné, vérifier la couverture ITGC de son application (E1.1).", srcEn: "E1.1 scope", srcFr: "Périmètre E1.1", tipEn: "List the application behind each automated control — the Sage/SAARI posting rules, the billing platform, the payroll package — and tick each one against the E1.1 scope table. An application missing from E1.1 means extending the ITGC work now or abandoning the reliance before the test is designed, not discovering the gap at final.", tipFr: "Lister l'application derrière chaque contrôle automatisé — paramétrage des écritures Sage/SAARI, plateforme de facturation, logiciel de paie — et pointer chacune dans le tableau de périmètre E1.1. Une application absente d'E1.1 impose d'étendre les travaux ITGC maintenant ou de renoncer à l'appui avant de concevoir le test, et non de découvrir la faille lors des travaux de fin d'exercice." },
        { key: "substantive", en: "Confirm every assertion keeps a substantive component regardless of reliance (ISA 330 ¶18 for significant risks).", fr: "Vérifier que chaque assertion conserve une composante substantive quel que soit l'appui (ISA 330 ¶18 pour les risques importants).", srcEn: "Execution programs", srcFr: "Programmes d'exécution", tipEn: "Scan every execution program for the substantive line that survives the reliance decision — a tests-of-details sample, a confirmation, a substantive analytic — and add one where the program shows controls testing alone. Where the assertion carries a significant risk, check the substantive response answers that specific risk rather than repeating the standard programme step.", tipFr: "Balayer chaque programme d'exécution pour repérer la ligne corroborative qui survit à la décision d'appui — un sondage sur pièces, une confirmation, une procédure analytique de substance — et en ajouter une là où le programme ne montre que des tests de contrôles. Quand l'assertion porte un risque significatif, vérifier que la réponse corroborative traite ce risque précis au lieu de répéter l'étape standard du programme." },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "every_assertion", en: "A strategy is recorded for every relevant assertion.", fr: "Une stratégie est consignée pour chaque assertion pertinente." },
        { key: "forced_found", en: "Assertions where substantive alone cannot suffice are identified and controls selected there.", fr: "Les assertions où la substantive seule ne suffit pas sont identifiées et couvertes par des contrôles sélectionnés." },
        { key: "wcgw_covered", en: "Each selected control is traced to the what-could-go-wrongs it addresses.", fr: "Chaque contrôle sélectionné est relié aux WCGW qu'il couvre." },
        { key: "itgc_ok", en: "ITGC coverage is confirmed for automated and IT-dependent controls.", fr: "La couverture ITGC est confirmée pour les contrôles automatisés et dépendants IT." },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- S2.2 --- */
const D8_6: PaperDef = {
  std: "ISA 330 ¶8–11 · ISA 530",
  ownsEn: "the design of each test of controls: attribute, population, timing and extent",
  ownsFr: "la conception de chaque test de contrôles : attribut, population, calendrier et étendue",
  reqEn: [
    "For each control selected in S2.1 we design the test: the attribute that shows the control operated (a signature, a system log, a matched document), the population of control occurrences, the period covered, and the sample size. Inquiry alone is never sufficient — the test combines inquiry with inspection, observation or reperformance (ISA 330 ¶10).",
    "Extent follows frequency: a control operating many times daily is tested on a sample sized for its population; monthly, quarterly and annual controls are tested across the instances of the period; an automated control is tested once per configuration provided its ITGCs are effective. Timing decides how much of the period the test covers now and what the post-interim update (E2.1) must add.",
    "Extent and nature rise with the weight the strategy puts on the control: the greater the reliance, or the thinner the substantive work on the same assertion, the more persuasive the evidence must be — larger samples, stronger procedures, more of the period covered (ISA 330 ¶9). Inquiry alone never suffices; combine it with inspection or reperformance in preference to observation, which only proves the control operated at the moment it was watched (ISA 330 ¶10(a)). Where the tested control depends on indirect controls — the ITGCs behind a system report, the review that maintains a master file — decide explicitly whether evidence on those indirect controls is needed as well (ISA 330 ¶10(b)).",
    "The design also presumes the groundwork of ISA 315 (Revised 2019) ¶26 is already in the file: the control's design has been evaluated as capable of addressing the risk and its implementation confirmed by walkthrough — a test of operating effectiveness never substitutes for that evaluation. Timing then follows the reliance: the evidence must cover the whole period over which reliance is intended, so an interim test commits the plan to updating the remaining months, not to hoping about them (ISA 330 ¶11). And where substantive procedures alone cannot suffice (ISA 330 ¶8(b)), deviations found in the test force redesign or extension of the controls work — there is no substantive fallback to retreat to.",
  ],
  reqFr: [
    "Pour chaque contrôle retenu en S2.1, nous concevons le test : attribut probant (visa, journal système, rapprochement), population des occurrences, période couverte, taille d'échantillon. L'entretien seul ne suffit jamais (ISA 330 ¶10).",
    "L'étendue suit la fréquence : contrôle pluriquotidien testé par sondage, contrôles mensuels/trimestriels/annuels testés sur les occurrences de la période, contrôle automatisé testé une fois par configuration si les ITGC sont efficaces. Le calendrier détermine la part de période couverte maintenant et ce que la mise à jour post-intérim (E2.1) devra ajouter.",
    "L'étendue et la nature du test croissent avec le poids que la stratégie fait porter au contrôle : plus l'appui est grand, ou plus les travaux corroboratifs sur la même assertion sont minces, plus la preuve doit être convaincante — échantillons plus larges, procédures plus fortes, période couverte plus longue (ISA 330 ¶9). La demande d'information seule ne suffit jamais ; la combiner avec l'inspection ou la réexécution de préférence à l'observation, qui ne prouve le fonctionnement du contrôle qu'à l'instant où on le regarde (ISA 330 ¶10(a)). Quand le contrôle testé dépend de contrôles indirects — les ITGC derrière un état système, la revue qui entretient un fichier maître — décider explicitement si une preuve sur ces contrôles indirects est aussi nécessaire (ISA 330 ¶10(b)).",
    "La conception du test suppose aussi que le socle d'ISA 315 (révisée 2019) ¶26 est déjà au dossier : la conception du contrôle évaluée comme capable de répondre au risque et sa mise en œuvre confirmée par cheminement — un test d'efficacité ne remplace jamais cette évaluation. Le calendrier suit ensuite l'appui : la preuve doit couvrir toute la période sur laquelle l'appui est prévu, si bien qu'un test intérimaire engage le plan à mettre à jour les mois restants, pas à l'espérer (ISA 330 ¶11). Et là où les procédures de corroboration seules ne peuvent suffire (ISA 330 ¶8(b)), les déviations relevées imposent de reconcevoir ou d'étendre les travaux sur les contrôles — il n'existe pas de repli corroboratif.",
  ],
  conclEn: ["Each selected control has a designed test whose nature, timing and extent can support the planned reliance."],
  conclFr: ["Chaque contrôle retenu dispose d'un test conçu dont la nature, le calendrier et l'étendue peuvent soutenir l'appui prévu."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        { key: "attribute", en: "Define, per control, the attribute evidencing operation and the documents or records where it lives.", fr: "Définir, par contrôle, l'attribut probant et les documents ou enregistrements où il se trouve.", srcEn: "S1.2 control descriptions", srcFr: "Descriptions S1.2", tipEn: "Ask the control performer to show you last month's evidence before writing the attribute: the signed rapprochement bancaire, the 'validated' status in Sage, the stamp on the bon de livraison. If nothing can be produced on the spot, the attribute you were about to test does not exist — redesign the test or drop the reliance now.", tipFr: "Demander à l'exécutant du contrôle de montrer la preuve du mois dernier avant d'écrire l'attribut : le rapprochement bancaire signé, le statut « validé » dans Sage, le cachet sur le bon de livraison. Si rien ne peut être produit séance tenante, l'attribut que vous alliez tester n'existe pas — reconcevoir le test ou renoncer à l'appui tout de suite." },
        { key: "population", en: "Define the population of control occurrences for the period and how completeness of that population is established.", fr: "Définir la population des occurrences sur la période et la manière d'en établir l'exhaustivité.", srcEn: "System reports · control logs", srcFr: "États systèmes · journaux de contrôle", tipEn: "Draw the population from a source the client cannot rebuild after the fact: the numbered sequence of bons de livraison, the journal-validation log in the accounting software, the twelve monthly reconciliations. Then prove the count — tie the number of occurrences to the grand livre activity or to the calendar — so the sample comes from the whole period, not from the binder the client hands you.", tipFr: "Tirer la population d'une source que le client ne peut pas reconstituer après coup : la séquence numérotée des bons de livraison, le journal de validation du logiciel comptable, les douze rapprochements mensuels. Prouver ensuite le décompte — rapprocher le nombre d'occurrences de l'activité du grand livre ou du calendrier — pour que le sondage couvre toute la période et pas seulement le classeur remis par le client." },
        { key: "extent", en: "Set the sample size from the control's frequency and the planned reliance; automated controls: one per configuration plus ITGC dependency.", fr: "Fixer la taille d'échantillon selon la fréquence et l'appui prévu ; contrôles automatisés : un par configuration plus dépendance ITGC.", srcEn: "Sampling tool", srcFr: "Outil d'échantillonnage", tipEn: "Read the frequency straight off the S1.2 description and take the size from the firm's sampling table — one instance for an annual control, a couple for a monthly one, a full sample for a many-times-daily control. For an automated control, test one occurrence per configuration and attach the E1.1 ITGC conclusion to it: reperforming the same calculation twenty times adds nothing.", tipFr: "Lire la fréquence directement dans la description S1.2 et prendre la taille dans la table de sondage du cabinet — une occurrence pour un contrôle annuel, deux pour un mensuel, un échantillon complet pour un contrôle pluriquotidien. Pour un contrôle automatisé, tester une occurrence par paramétrage et y joindre la conclusion ITGC d'E1.1 : refaire vingt fois le même calcul n'apporte rien." },
        { key: "timing", en: "Set the timing: period covered by the interim test and the roll-forward the post-interim update (E2.1) will need.", fr: "Fixer le calendrier : période couverte à l'intérim et complément attendu de la mise à jour post-intérim (E2.1).", srcEn: "Engagement timetable", srcFr: "Calendrier de la mission", tipEn: "Push the interim test as late as the timetable allows so the roll-forward window stays short. Write the E2.1 update into the plan today — which controls, what evidence covers the remaining months, who performs it — instead of leaving 'update at final' as a blank line the busy season will erase.", tipFr: "Placer le test intérimaire aussi tard que le calendrier le permet pour raccourcir la fenêtre de mise à jour. Inscrire la mise à jour E2.1 dans le plan dès aujourd'hui — quels contrôles, quelle preuve pour les mois restants, qui l'exécute — plutôt que de laisser une ligne vide « à compléter au final » que la période de pointe effacera." },
        { key: "assign", en: "Assign each designed test to a team member and link it to the execution program that will record the result.", fr: "Affecter chaque test conçu à un membre de l'équipe et le relier au programme d'exécution qui recevra le résultat.", srcEn: "Team plan (P2.2)", srcFr: "Plan d'équipe (P2.2)", tipEn: "Match difficulty to grade: reperforming a bank reconciliation suits an assistant, but walking the billing platform's configuration needs the senior or the IT specialist named in P2.2. Write the working-paper reference of the execution program next to each name so the result lands in the file, not in someone's inbox.", tipFr: "Ajuster la difficulté au grade : refaire un rapprochement bancaire convient à un assistant, mais parcourir le paramétrage de la plateforme de facturation exige le chef de mission ou le spécialiste informatique désigné en P2.2. Écrire la référence du programme d'exécution à côté de chaque nom pour que le résultat atterrisse dans le dossier et non dans une messagerie." },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "each_control", en: "Every control selected in S2.1 has a designed test.", fr: "Chaque contrôle retenu en S2.1 dispose d'un test conçu." },
        { key: "beyond_inquiry", en: "No test relies on inquiry alone.", fr: "Aucun test ne repose sur le seul entretien." },
        { key: "extent_ok", en: "Sample sizes follow the frequency of each control and the planned reliance.", fr: "Les tailles d'échantillon suivent la fréquence des contrôles et l'appui prévu." },
        { key: "rollforward", en: "Interim timing and the post-interim update are planned together (link to E2.1).", fr: "Le calendrier d'intérim et la mise à jour post-intérim sont planifiés ensemble (lien E2.1)." },
      ],
    },
  ],
};

/* ----------------------------------------------------------------- E6.8 --- */
const E6_8: PaperDef = {
  std: "ISA 315 (Revised 2019) ¶37 · ISA 330 ¶25–26",
  ownsEn: "the reassessment of the combined risk assessments in the light of the evidence obtained",
  ownsFr: "la réévaluation de l'évaluation combinée des risques au vu des éléments obtenus",
  reqEn: [
    "The risk assessment is not static. When evidence obtained during execution is inconsistent with the assessment made at planning — control deviations, misstatements, unexpected analytical results, new information about the entity — we revise the assessment and modify the planned procedures accordingly (ISA 315 ¶37, ISA 330 ¶25).",
    "This paper is the formal checkpoint: after controls testing and before concluding the substantive work, each combined risk assessment in the risk register (S3.1) is confronted with what execution actually found. A revision is not a failure of planning; an unrevised assessment contradicted by the evidence is a failure of the audit.",
  ],
  reqFr: [
    "L'évaluation des risques n'est pas figée. Lorsque les éléments obtenus en exécution contredisent l'évaluation initiale — déviations de contrôles, anomalies, résultats analytiques inattendus, informations nouvelles — nous révisons l'évaluation et modifions les procédures prévues (ISA 315 ¶37, ISA 330 ¶25).",
    "Ce papier est le point de contrôle formel : après les tests de contrôles et avant de conclure les travaux substantifs, chaque évaluation combinée du registre (S3.1) est confrontée aux constats de l'exécution.",
  ],
  conclEn: ["The combined risk assessments remain appropriate, or have been revised and the procedures adjusted."],
  conclFr: ["Les évaluations combinées demeurent appropriées, ou ont été révisées avec ajustement des procédures."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        { key: "deviations", en: "List the control deviations found (E1.1/E1.2/E2.1 and cycle tests) and assess the effect of each on the related combined risk assessment.", fr: "Recenser les déviations de contrôles constatées (E1.1/E1.2/E2.1 et tests de cycles) et leur effet sur l'évaluation combinée concernée.", srcEn: "Controls testing papers", srcFr: "Papiers de tests de contrôles" },
        { key: "misstatements", en: "Review the misstatements accumulated to date (C1.1) for what they say about the assessed risks that should have caught them.", fr: "Analyser les anomalies cumulées (C1.1) au regard des risques évalués qui auraient dû les prévenir.", srcEn: "C1.1 summary of audit differences", srcFr: "Récapitulatif C1.1" },
        { key: "analytics", en: "Consider unexpected relationships from substantive analytics against the risk assessment.", fr: "Confronter les corrélations inattendues des procédures analytiques à l'évaluation des risques.", srcEn: "Cycle analytics", srcFr: "Analytiques de cycles" },
        { key: "register", en: "Update the risk register (S3.1): revise each affected assessment and record the reason.", fr: "Mettre à jour le registre (S3.1) : réviser chaque évaluation touchée en motivant.", srcEn: "S3.1 risk register", srcFr: "Registre S3.1" },
        { key: "procedures", en: "Modify the nature, timing or extent of remaining procedures where an assessment rose, and record what changed.", fr: "Modifier la nature, le calendrier ou l'étendue des procédures restantes lorsque l'évaluation augmente, en consignant les changements.", srcEn: "Execution programs", srcFr: "Programmes d'exécution" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "confronted", en: "Every combined risk assessment was confronted with the execution evidence.", fr: "Chaque évaluation combinée a été confrontée aux constats d'exécution." },
        { key: "deviations_fed", en: "Control deviations are reflected in the affected assessments.", fr: "Les déviations de contrôles sont répercutées dans les évaluations concernées." },
        { key: "procs_adjusted", en: "Procedures were adjusted wherever an assessment was revised upward.", fr: "Les procédures ont été ajustées pour chaque révision à la hausse." },
        { key: "documented", en: "Each revision (or confirmation) is documented with its reason.", fr: "Chaque révision (ou confirmation) est documentée avec son motif." },
      ],
    },
  ],
};

/* ----------------------------------------------------------------- E2.1 --- */
const E1_3: PaperDef = {
  std: "ISA 330 ¶12–15",
  ownsEn: "the post-interim update: controls evidence extended from the interim date to the period end",
  ownsFr: "la mise à jour post-intérim : preuve sur les contrôles étendue de l'intérim à la clôture",
  reqEn: [
    "When operating effectiveness was tested at an interim date, we obtain evidence about the remaining period: what changed in the controls since the interim, and whether the interim conclusion can be rolled forward (ISA 330 ¶12). Significant changes to a control, its performer, or its application reset the test.",
    "For ITGCs the same logic applies at the level of change management, access and operations: a period-end reliance on an automated control assumes the application did not change uncontrolled after the interim ITGC work (E1.1).",
  ],
  reqFr: [
    "Lorsque l'efficacité a été testée à une date intérimaire, nous obtenons des éléments sur la période restante : ce qui a changé depuis l'intérim et si la conclusion intérimaire peut être prolongée (ISA 330 ¶12). Un changement significatif du contrôle, de son exécutant ou de son application remet le test à zéro.",
    "Pour les ITGC, la même logique s'applique à la gestion des changements, aux accès et à l'exploitation : l'appui en clôture sur un contrôle automatisé suppose une application inchangée de façon maîtrisée depuis les travaux ITGC d'intérim (E1.1).",
  ],
  conclEn: ["The controls evidence covers the full period: interim conclusions were validly rolled forward or the tests extended."],
  conclFr: ["La preuve sur les contrôles couvre toute la période : conclusions intérimaires valablement prolongées ou tests étendus."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures and expected sources",
      titleFr: "Partie A — Procédures et sources attendues",
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        { key: "period", en: "Determine the remaining period for each control tested at interim and the additional evidence it requires.", fr: "Déterminer la période restante pour chaque contrôle testé à l'intérim et la preuve complémentaire requise.", srcEn: "S2.2 timing plan", srcFr: "Plan de calendrier S2.2" },
        { key: "changes", en: "Inquire and inspect for changes since the interim: control redesign, new performers, application changes, organisational moves.", fr: "Rechercher les changements depuis l'intérim : refonte du contrôle, nouveaux exécutants, évolutions applicatives, réorganisations.", srcEn: "Management inquiry · change logs · HR moves", srcFr: "Entretiens · journaux de changements · mouvements RH" },
        { key: "extend", en: "Extend the tests over the remaining period where required — changed controls are retested, unchanged high-frequency controls receive a reduced roll-forward sample.", fr: "Étendre les tests sur la période restante si nécessaire — contrôles modifiés retestés, contrôles inchangés à haute fréquence couverts par un échantillon réduit.", srcEn: "Control evidence of the remaining period", srcFr: "Preuves de contrôle de la période restante" },
        { key: "itgc", en: "Roll forward the ITGC conclusions: review the change-management and access logs for the remaining period for the in-scope applications.", fr: "Prolonger les conclusions ITGC : revue des journaux de changements et d'accès de la période restante pour les applications du périmètre.", srcEn: "E1.1 papers · system logs", srcFr: "Papiers E1.1 · journaux systèmes" },
        { key: "conclude", en: "Conclude on operating effectiveness for the full period, and carry any failure to E6.8 and to the substantive response.", fr: "Conclure sur l'efficacité pour l'ensemble de la période et reporter toute défaillance vers E6.8 et la réponse substantive.", srcEn: "This paper · E6.8", srcFr: "Ce papier · E6.8" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Confirmations",
      titleFr: "Partie B — Confirmations",
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
      items: [
        { key: "all_interim", en: "Every control relied upon and tested at interim has a roll-forward conclusion.", fr: "Chaque contrôle d'appui testé à l'intérim dispose d'une conclusion de prolongation." },
        { key: "changes_checked", en: "Changes since the interim were actively searched, not assumed absent.", fr: "Les changements depuis l'intérim ont été recherchés activement, non présumés absents." },
        { key: "itgc_rf", en: "ITGC conclusions cover the full period for every in-scope application.", fr: "Les conclusions ITGC couvrent toute la période pour chaque application du périmètre." },
        { key: "failures_fed", en: "Roll-forward failures are carried to E6.8 and the substantive response.", fr: "Les échecs de prolongation sont reportés vers E6.8 et la réponse substantive." },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ C6.2 --- */
const C6_2: PaperDef = {
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
      introEn: PROC_INTRO_EN,
      introFr: PROC_INTRO_FR,
      procs: [
        { key: "complete", en: "Confirm every task in the file carries its working paper, evidence and preparer/reviewer sign-offs; clear the points outstanding (C4.3).", fr: "Vérifier que chaque tâche du dossier porte son papier de travail, ses preuves et ses signatures ; solder les points en suspens (C4.3).", srcEn: "Dashboard completion counts · C4.3", srcFr: "Compteurs du tableau de bord · C4.3" },
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
      introEn: YN_INTRO_EN,
      introFr: YN_INTRO_FR,
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

/* ---------------------------------------------------------------- P7.1 --- */
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
  "P7.1": D9_2,
  "P6.2": D5_8,
  "S1.1": D8_1,
  "S1.2": D8_2,
  "S1.3": D8_3,
  "S1.4": D8_4,
  "S2.1": D8_5,
  "S2.2": D8_6,
  "E6.8": E6_8,
  "E2.1": E1_3,
  "C6.2": C6_2,
};
