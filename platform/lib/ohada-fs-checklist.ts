// The OHADA financial statement checklist: what the annual financial statements
// [états financiers annuels] must contain and how they must be presented under
// the revised Uniform Act on accounting law and financial reporting [AUDCIF] and
// the SYSCOHADA révisé, one requirement per row with the article beside it.
//
// This is the catalogue the E6.10 checklist workbook is generated from. Every
// row is grounded in the Act — the article column is not decoration, it is the
// reference the reviewer checks — and rows the Act does not support are not
// here. Where the Act prescribes a table, the row says so, because a note that
// carries the right figures in the wrong shape is still a presentation finding.
//
// The handbook is explicit that the review of the notes must be formalised in a
// disclosure checklist [questionnaire de contrôle de l'annexe] rather than left
// to a reading; this is that checklist for OHADA reporters.

export interface FsChecklistRow {
  /** stable reference shown on the paper, e.g. "N-12.3" */
  ref: string;
  en: string;
  fr: string;
  /** the AUDCIF article, or the SYSCOHADA note number, the requirement rests on */
  article: string;
}

export interface FsChecklistSection {
  key: string;
  titleEn: string;
  titleFr: string;
  introEn?: string;
  introFr?: string;
  rows: FsChecklistRow[];
}

/** The standard the paper is written to, as its heading states it. */
export const OHADA_FS_CHECKLIST_STD =
  "AUDCIF — Acte uniforme révisé relatif au droit comptable et à l'information financière · SYSCOHADA révisé";

// A word on the article column. The Act's own articles are cited as "Art. n".
// The Plan comptable général OHADA annexed to the Act carries no article
// numbers, so requirements that live only there are cited by the part of the
// PCGO they sit in ("PCGO Titre IX", "PCGO ch. 30") or by the note number for
// the model notes, and the note number is always given for a note. Where the
// Act sets a requirement and the PCGO gives it its shape, both are cited. No
// row cites an article the Act does not contain; two places where the sources
// are silent or disagree — rounding, and the headcount that triggers Note 35 —
// are handled in the row text rather than papered over with a number.

/**
 * The catalogue, in the order the statements are read: the statements and the
 * system that applies, the principles the whole set is measured against, the
 * balance sheet and income statement, the cash-flow statement, then every note
 * the SYSCOHADA révisé requires, in its own numbering, then the disclosures the
 * Act requires wherever they fall.
 */
export const OHADA_FS_CHECKLIST: readonly FsChecklistSection[] = [
  {
    key: "A",
    titleEn: "The statements and the system that applies",
    titleFr: "Les états financiers et le système applicable",
    introEn:
      "Tests that the entity has produced the right set of statements under the right system, for the right period, on the prescribed models, with comparatives. The système minimal de trésorerie [SMT] has its own reduced set; rows that apply to it are marked SMT in their text.",
    introFr:
      "Vérifie que l'entité a produit le bon jeu d'états financiers, dans le système qui lui est applicable, pour la bonne période, sur les modèles prescrits et avec les chiffres comparatifs. Le système minimal de trésorerie [SMT] dispose d'un jeu réduit qui lui est propre ; les lignes qui le concernent portent la mention SMT.",
    rows: [
      {
        ref: "A.1",
        en: "The annual financial statements form a complete set [jeu complet]: balance sheet [Bilan], income statement [Compte de résultat], cash-flow statement [Tableau des flux de trésorerie] and notes [Notes annexes].",
        fr: "Les états financiers annuels forment un jeu complet : Bilan, Compte de résultat, Tableau des flux de trésorerie et Notes annexes.",
        article: "Art. 8 ; Art. 26",
      },
      {
        ref: "A.2",
        en: "The statements form an indivisible whole [tout indissociable] and describe the year's events, transactions and situations regularly and sincerely so as to give a true and fair view [image fidèle] of the entity's assets, financial position and result.",
        fr: "Les états financiers forment un tout indissociable et décrivent de façon régulière et sincère les événements, opérations et situations de l'exercice pour donner une image fidèle du patrimoine, de la situation financière et du résultat de l'entité.",
        article: "Art. 8",
      },
      {
        ref: "A.3",
        en: "The entity reports under one of the two admitted systems, the Système normal or the Système minimal de trésorerie, and the Système normal applies by default to every entity unless its size allows the SMT.",
        fr: "L'entité applique l'un des deux systèmes admis, le Système normal ou le Système minimal de trésorerie ; toute entité est soumise au Système normal sauf exception liée à sa taille.",
        article: "Art. 11",
      },
      {
        ref: "A.4",
        en: "SMT: where the SMT is applied, annual turnover excluding tax is below the threshold for the entity's activity (60 million F CFA for trading, 40 million for artisanal, 30 million for services, or the equivalent in the legal-tender unit); a small entity that has opted for the Système normal applies it in full.",
        fr: "SMT : lorsque le SMT est appliqué, le chiffre d'affaires hors taxes annuel est inférieur au seuil propre à l'activité (60 millions de F CFA pour le négoce, 40 millions pour l'artisanat, 30 millions pour les services, ou l'équivalent dans l'unité monétaire légale) ; la petite entité qui a opté pour le Système normal l'applique intégralement.",
        article: "Art. 13",
      },
      {
        ref: "A.5",
        en: "SMT: the statements are drawn from the cash-basis books [comptabilité de trésorerie] on the SMT models and consist of a balance sheet, an income statement and notes; the Act also names a cash-flow statement, whereas the PCGO models for the SMT provide none, so its absence is not a finding but its presence must follow the Act. Significant variations in stocks, receivables and payables are taken into the result and the balance sheet.",
        fr: "SMT : les états financiers sont dressés à partir de la comptabilité de trésorerie sur les modèles du SMT et comprennent un Bilan, un Compte de résultat et des Notes annexes ; l'Acte cite en outre un Tableau des flux de trésorerie que les modèles du PCGO pour le SMT ne prévoient pas, de sorte que son absence n'est pas une anomalie. Les variations significatives des stocks, des créances et des dettes sont prises en compte dans le résultat et le Bilan.",
        article: "Art. 28 ; PCGO Titre X",
      },
      {
        ref: "A.6",
        en: "SMT: the notes are the four SMT notes — Note 1 tracking of equipment, furniture and deposits [suivi du matériel, du mobilier et des cautions], Note 2 stock statement [état des stocks], Note 3 statement of receivables and payables not yet due [état des créances et des dettes non échues] with opening and closing amounts and variation, and Note 4 cash journal [journal de trésorerie] — each on its prescribed table.",
        fr: "SMT : les Notes annexes sont les quatre notes du SMT — Note 1 tableau de suivi du matériel, du mobilier et des cautions, Note 2 état des stocks, Note 3 état des créances et des dettes non échues avec montants d'ouverture, de clôture et variation, Note 4 journal de trésorerie — chacune sur son tableau prescrit.",
        article: "PCGO Titre X",
      },
      {
        ref: "A.7",
        en: "An entity whose securities are listed on a stock exchange or that raises finance by public offering [appel public à l'épargne] also prepares statements under IFRS, in addition to the SYSCOHADA set; the IFRS statements are for the financial markets only and are not the basis for distributable profit.",
        fr: "L'entité dont les titres sont inscrits à une bourse de valeurs ou qui sollicite un financement par appel public à l'épargne établit en sus des états financiers selon les normes IFRS ; ceux-ci sont destinés exclusivement aux marchés financiers et ne servent pas de base à la détermination du bénéfice distribuable.",
        article: "Art. 8 ; Art. 73-1",
      },
      {
        ref: "A.8",
        en: "The period [exercice] covers twelve months and coincides with the calendar year; only a first period may be shorter (started in the first half) or longer (started in the second half), and a liquidation counts as a single period subject to provisional annual positions.",
        fr: "L'exercice couvre douze mois et coïncide avec l'année civile ; seul le premier exercice peut être plus court (débuté au premier semestre) ou plus long (débuté au second semestre), et la durée des opérations de liquidation est comptée pour un seul exercice sous réserve de situations annuelles provisoires.",
        article: "Art. 7",
      },
      {
        ref: "A.9",
        en: "The statements are closed [arrêtés] no later than four months after the year-end, and the closing date [date d'arrêté] is stated on every transmission of the statements.",
        fr: "Les états financiers sont arrêtés au plus tard dans les quatre mois qui suivent la clôture de l'exercice, et la date d'arrêté est mentionnée dans toute transmission des états financiers.",
        article: "Art. 23",
      },
      {
        ref: "A.10",
        en: "The statements and the management report [rapport de gestion] are submitted to the shareholders, partners or members for approval within six months of the year-end, and are sent to the statutory auditors [commissaires aux comptes], where there are any, at least forty-five days before the ordinary general meeting.",
        fr: "Les états financiers et le rapport de gestion sont soumis à l'approbation des actionnaires, associés ou membres dans les six mois de la clôture, et transmis aux commissaires aux comptes, s'il en existe, quarante-cinq jours au moins avant l'assemblée générale ordinaire.",
        article: "Art. 72 ; Art. 71",
      },
      {
        ref: "A.11",
        en: "The entity complies with the common rules on communicating information to shareholders, partners or members and on publishing the annual statements, including the half-year publication required of companies making a public offering under the AUSCGIE.",
        fr: "L'entité se conforme aux mesures communes de communication des informations aux actionnaires, associés ou membres et de publicité des états financiers annuels, y compris la publication semestrielle exigée des sociétés faisant appel public à l'épargne par l'AUSCGIE.",
        article: "Art. 73",
      },
      {
        ref: "A.12",
        en: "The books and the statements are kept in the official language and in the monetary unit that is legal tender in the State party, and every page of the published statements shows the entity's name and identifiers, the closing date and the period covered, and the monetary unit used.",
        fr: "La comptabilité et les états financiers sont tenus dans la langue officielle et dans l'unité monétaire ayant cours légal dans l'État partie, et chaque page des états financiers publiés porte le nom de l'entité et ses moyens d'identification, la date d'arrêté et la période couverte, ainsi que l'unité monétaire utilisée.",
        article: "Art. 17-1° ; PCGO Titre IX §2.4",
      },
      {
        ref: "A.13",
        en: "Every line [poste] of every statement shows the figure of the corresponding line of the prior year; where a prior-year figure is not comparable it is the prior year that is restated, and the lack of comparability or the restatement is disclosed in the notes.",
        fr: "Chaque poste de chaque état comporte l'indication du chiffre du poste correspondant de l'exercice précédent ; lorsqu'un chiffre de l'exercice précédent n'est pas comparable, c'est lui qui est adapté, et l'absence de comparabilité ou l'adaptation est signalée dans les Notes annexes.",
        article: "Art. 34",
      },
      {
        ref: "A.14",
        en: "The opening balance sheet agrees to the closing balance sheet of the prior year [correspondance bilan de clôture – bilan d'ouverture]; the only entries taken directly to opening equity are the effect of a change of method decided by the standard-setter and the correction of a significant prior-year error, each disclosed in the notes.",
        fr: "Le bilan d'ouverture correspond au bilan de clôture de l'exercice précédent ; les seules imputations directes sur les capitaux propres d'ouverture sont l'effet d'un changement de méthode décidé par les autorités de normalisation et la correction d'une erreur significative d'un exercice antérieur, chacune signalée dans les Notes annexes.",
        article: "Art. 34 ; Art. 41",
      },
      {
        ref: "A.15",
        en: "The presentation of the statements is identical from one year to the next; any change in the presentation or in the valuation methods is flagged in the notes.",
        fr: "La présentation des états financiers est identique d'un exercice à l'autre ; toute modification de la présentation ou des méthodes d'évaluation est signalée dans les Notes annexes.",
        article: "Art. 34 ; Art. 33",
      },
      {
        ref: "A.16",
        en: "Each statement other than the notes follows the SYSCOHADA model [tracé] for the system applied, laid out in successive headings [rubriques] subdivided into lines [postes], each carrying its alphabetic code (AE, AF, … ; TA, RA, … ; ZA, FA, …); no heading is created outside the model, and nil or unused lines may be left out.",
        fr: "Chaque état autre que les Notes annexes suit le tracé SYSCOHADA du système appliqué, présenté en rubriques successives subdivisées en postes portant chacun son code alphabétique (AE, AF, … ; TA, RA, … ; ZA, FA, …) ; aucune rubrique n'est créée en dehors du modèle, et les postes nuls ou non utilisés peuvent être omis.",
        article: "Art. 25 ; PCGO Titre IX §2.4",
      },
      {
        ref: "A.17",
        en: "The filed set [liasse] is complete: cover page, identification sheets R1 to R4 (identification, activity, directors and officers, recap of the notes presented), then balance sheet, income statement, cash-flow statement and the notes that are documented.",
        fr: "La liasse est complète : page de garde, fiches R1 à R4 (identification, activité, dirigeants et administrateurs, récapitulatif des Notes annexes présentées), puis Bilan, Compte de résultat, Tableau des flux de trésorerie et les Notes annexes documentées.",
        article: "PCGO Titre IX ch. 2",
      },
    ],
  },
  {
    key: "B",
    titleEn: "Principles of presentation",
    titleFr: "Principes de présentation",
    introEn:
      "Tests the whole set against the postulates and conventions the Act names: each principle is a row, and a departure from any of them is a finding unless the notes explain it as the Act allows.",
    introFr:
      "Confronte l'ensemble du jeu aux postulats et conventions énoncés par l'Acte : chaque principe fait l'objet d'une ligne, et toute dérogation constitue une anomalie sauf si les Notes annexes l'expliquent comme l'Acte le permet.",
    rows: [
      {
        ref: "B.1",
        en: "Regularity and sincerity [régularité, sincérité]: the information results from an adequate, faithful, clear, precise and complete description of the year's events, transactions and situations, in compliance with the rules in force applied in good faith.",
        fr: "Régularité et sincérité : les informations résultent d'une description adéquate, loyale, claire, précise et complète des événements, opérations et situations de l'exercice, dans le respect des règles en vigueur appliquées de bonne foi.",
        article: "Art. 3 ; Art. 6 ; Art. 9",
      },
      {
        ref: "B.2",
        en: "True and fair view [image fidèle]: correct application of the SYSCOHADA is presumed to give it; where a prescription proves insufficient or unsuited, the additional information or justification needed is given in the notes, and any departure and its reasons are disclosed there.",
        fr: "Image fidèle : l'application correcte du SYSCOHADA est réputée la donner ; lorsqu'une prescription se révèle insuffisante ou inadaptée, les informations complémentaires ou justifications nécessaires sont fournies dans les Notes annexes, où toute dérogation et ses motifs sont exposés.",
        article: "Art. 8 ; Art. 10",
      },
      {
        ref: "B.3",
        en: "Prudence [convention de prudence] is observed in all cases, on a reasonable assessment of the year's events and transactions; probable losses are recognised and latent gains are not taken to the result.",
        fr: "La convention de prudence est observée en tous cas, à partir d'une appréciation raisonnable des événements et opérations de l'exercice ; les pertes probables sont constatées et les gains latents ne participent pas au résultat.",
        article: "Art. 3 ; Art. 6 ; Art. 35",
      },
      {
        ref: "B.4",
        en: "Consistency of methods [permanence des méthodes]: terminology and valuation rules are applied unchanged from year to year; an exception is justified only by better information or imperative circumstances, and everything needed to understand and assess the change is disclosed in the notes.",
        fr: "Permanence des méthodes : la terminologie et les règles d'évaluation sont appliquées sans changement d'un exercice à l'autre ; toute exception est justifiée par la recherche d'une meilleure information ou par des circonstances impératives, et toutes les informations nécessaires à la compréhension du changement sont données dans les Notes annexes.",
        article: "Art. 9 ; Art. 40 ; Art. 41",
      },
      {
        ref: "B.5",
        en: "Independence of periods [spécialisation des exercices]: the result of each year is independent of the preceding and following years, and only the events and transactions belonging to the year are attached to it.",
        fr: "Spécialisation des exercices : le résultat de chaque exercice est indépendant de celui qui le précède et de celui qui le suit, et seuls lui sont rattachés les événements et opérations qui lui sont propres.",
        article: "Art. 59",
      },
      {
        ref: "B.6",
        en: "Historical cost [coût historique]: assets are carried at acquisition cost, contribution value, current value for gifts and exchanges, or production cost; the only departure is a revaluation of tangible and financial fixed assets under Articles 62 to 65 or a legal revaluation.",
        fr: "Coût historique : les biens sont inscrits à leur coût réel d'acquisition, à leur valeur d'apport, à leur valeur actuelle pour les biens acquis à titre gratuit ou par échange, ou à leur coût réel de production ; la seule dérogation est la réévaluation des immobilisations corporelles et financières dans le respect des articles 62 à 65, ou une réévaluation légale.",
        article: "Art. 35 ; Art. 36",
      },
      {
        ref: "B.7",
        en: "Going concern [continuité d'exploitation]: the statements are prepared on that basis; where the entity intends or is obliged to liquidate or to reduce its activities substantially, the valuation of its assets is reconsidered, and the uncertainties and the basis actually used are stated and justified.",
        fr: "Continuité d'exploitation : les états financiers sont établis sur cette base ; lorsque l'entité a manifesté l'intention ou se trouve dans l'obligation de se mettre en liquidation ou de réduire sensiblement ses activités, l'évaluation de ses biens est reconsidérée, et les incertitudes ainsi que la base retenue sont indiquées et justifiées.",
        article: "Art. 35 ; Art. 39 ; PCGO Titre IX §2.1",
      },
      {
        ref: "B.8",
        en: "No offsetting [non-compensation]: no offset is made between asset and liability lines in the balance sheet or between expense and income lines in the income statement unless it has a legal basis.",
        fr: "Non-compensation : aucune compensation n'est opérée entre postes d'actif et postes de passif au Bilan, ni entre postes de charges et postes de produits au Compte de résultat, sauf si elle est juridiquement fondée.",
        article: "Art. 34",
      },
      {
        ref: "B.9",
        en: "Materiality [importance significative]: the notes carry every significant item not evident elsewhere that could influence the users' judgement of the entity's assets, financial position and result; the PCGO's indicative thresholds are a guide, not a substitute for that judgement.",
        fr: "Importance significative : les Notes annexes comportent tous les éléments significatifs non mis en évidence ailleurs et susceptibles d'influencer le jugement des utilisateurs sur le patrimoine, la situation financière et le résultat ; les seuils indicatifs du PCGO guident ce jugement sans s'y substituer.",
        article: "Art. 33 ; PCGO Titre V §4.1.2.5",
      },
      {
        ref: "B.10",
        en: "Transparency [transparence]: the information is presented and communicated clearly, without any intention of hiding the reality behind the appearance.",
        fr: "Transparence : les informations sont présentées et communiquées clairement, sans intention de dissimuler la réalité derrière l'apparence.",
        article: "Art. 3 ; Art. 6",
      },
      {
        ref: "B.11",
        en: "Substance over form [prééminence de la réalité sur l'apparence] is applied in the four cases the PCGO limits it to: goods sold with retention of title [réserve de propriété], assets held under finance leases [location-acquisition], discounted bills not yet due [effets escomptés non échus], and external staff [personnel extérieur].",
        fr: "La prééminence de la réalité sur l'apparence est appliquée dans les quatre cas auxquels le PCGO la limite : biens vendus avec clause de réserve de propriété, biens pris en location-acquisition, effets escomptés non échus et personnel extérieur.",
        article: "PCGO Titre V §4.1.1.5",
      },
      {
        ref: "B.12",
        en: "Entity and accrual postulates [postulat de l'entité, comptabilité d'engagement]: the statements cover the entity alone, distinct from its owners, and record transactions when they occur rather than when cash moves, except under the SMT which is cash-based by design.",
        fr: "Postulats de l'entité et de la comptabilité d'engagement : les états financiers couvrent la seule entité, distincte de ses propriétaires, et enregistrent les opérations à leur naissance et non lors des mouvements de trésorerie, sauf dans le SMT, fondé par construction sur la comptabilité de trésorerie.",
        article: "PCGO Titre V §4.1.1.1–4.1.1.2 ; Art. 28",
      },
    ],
  },
  {
    key: "C",
    titleEn: "Balance sheet, income statement and cash-flow statement",
    titleFr: "Bilan, compte de résultat et tableau des flux de trésorerie",
    introEn:
      "Tests the three primary statements against the Act's structure and the PCGO models, line by line and total by total, including the arithmetic controls the models build in.",
    introFr:
      "Confronte les trois états de synthèse à la structure fixée par l'Acte et aux modèles du PCGO, poste par poste et total par total, y compris les contrôles arithmétiques que les modèles intègrent.",
    rows: [
      {
        ref: "C.1",
        en: "The balance sheet describes assets and liabilities separately, shows equity [capitaux propres] distinctly, and on the asset side shows fixed assets, current assets, cash assets and translation differences [actif immobilisé, actif circulant, trésorerie-actif, écart de conversion-actif], and on the liability side stable resources, current liabilities, cash liabilities and translation differences [ressources stables, passif circulant, trésorerie-passif, écart de conversion-passif].",
        fr: "Le Bilan décrit séparément les éléments d'actif et de passif, fait apparaître distinctement les capitaux propres, et présente à l'actif l'actif immobilisé, l'actif circulant, la trésorerie-actif et l'écart de conversion-actif, et au passif les ressources stables, le passif circulant, la trésorerie-passif et l'écart de conversion-passif.",
        article: "Art. 29 ; Art. 30",
      },
      {
        ref: "C.2",
        en: "The asset side follows the model lines and codes: intangibles AD–AH, tangibles AI–AN with land and buildings each split to show investment property [dont immeuble de placement], advances on fixed assets AP, financial fixed assets AQ–AS, total AZ; HAO current assets BA, stocks BB, receivables BG–BJ, total BK; investment securities BQ, items for collection BR, banks and cash BS, total BT; translation difference BU; grand total BZ.",
        fr: "L'actif suit les postes et codes du modèle : immobilisations incorporelles AD–AH, corporelles AI–AN avec terrains et bâtiments ventilés pour faire apparaître les immeubles de placement, avances et acomptes sur immobilisations AP, immobilisations financières AQ–AS, total AZ ; actif circulant HAO BA, stocks BB, créances BG–BJ, total BK ; titres de placement BQ, valeurs à encaisser BR, banques et caisse BS, total BT ; écart de conversion-actif BU ; total général BZ.",
        article: "PCGO Titre IX ch. 3",
      },
      {
        ref: "C.3",
        en: "The liability side follows the model lines and codes: capital CA, uncalled capital CB, premiums CD, revaluation differences CE, reserves CF–CG, retained earnings CH, result CJ, investment grants CL, regulated provisions CM, total equity CP; borrowings DA, finance-lease debts DB, provisions for risks and charges DC, total financial debts DD, stable resources DF; HAO debts DH, customer advances DI, suppliers DJ, tax and social debts DK, other debts DM, short-term provisions DN, total DP; cash liabilities DQ–DR, total DT; translation difference DV; grand total DZ, before appropriation of the result.",
        fr: "Le passif suit les postes et codes du modèle : capital CA, capital non appelé CB, primes CD, écarts de réévaluation CE, réserves CF–CG, report à nouveau CH, résultat CJ, subventions d'investissement CL, provisions réglementées CM, total capitaux propres CP ; emprunts DA, dettes de location-acquisition DB, provisions pour risques et charges DC, total dettes financières DD, ressources stables DF ; dettes HAO DH, clients avances reçues DI, fournisseurs DJ, dettes fiscales et sociales DK, autres dettes DM, provisions pour risques à court terme DN, total DP ; trésorerie-passif DQ–DR, total DT ; écart de conversion-passif DV ; total général DZ, avant répartition du résultat.",
        article: "PCGO Titre IX ch. 3",
      },
      {
        ref: "C.4",
        en: "Each balance-sheet line shows gross, depreciation and impairment, net for the year and net for the prior year [brut, amortissements et dépréciations, net N, net N-1], and carries the reference of the note that details it; the model's totals foot and the two sides agree.",
        fr: "Chaque poste du Bilan présente le brut, les amortissements et dépréciations, le net de l'exercice et le net de l'exercice précédent, et porte la référence de la note qui le détaille ; les totaux du modèle sont justes et l'actif égale le passif.",
        article: "Art. 33 ; Art. 34 ; PCGO Titre IX ch. 3",
      },
      {
        ref: "C.5",
        en: "The income statement is presented in list form [en liste], distinguishing operating and financial items of ordinary activities from items outside ordinary activities [hors activités ordinaires, HAO], so that the intermediate management balances [soldes intermédiaires de gestion] appear in cascade down to the net result.",
        fr: "Le Compte de résultat est présenté en liste, en distinguant les opérations d'exploitation et financières des activités ordinaires des opérations hors activités ordinaires (HAO), de sorte que les soldes intermédiaires de gestion apparaissent en cascade jusqu'au résultat net.",
        article: "Art. 29 ; Art. 31",
      },
      {
        ref: "C.6",
        en: "The income statement follows the model lines and mandatory sub-totals: sales of goods TA less purchases RA and stock variation RB give the commercial margin XA; TB–TD give turnover XB; production and other income TE–TI less purchases, transport, external services, taxes and other charges RC–RJ give value added XC; less staff costs RK gives EBITDA [excédent brut d'exploitation] XD; with reversals TJ and charges RL gives the operating result XE; financial items TK–TM and RM–RN give the financial result XF; XG is the result of ordinary activities; disposals and other HAO items TN–TO and RO–RP give the HAO result XH; after employee participation RQ and income tax RS comes the net result XI.",
        fr: "Le Compte de résultat suit les postes et les sous-totaux obligatoires du modèle : ventes de marchandises TA moins achats RA et variation de stocks RB donnent la marge commerciale XA ; TB–TD donnent le chiffre d'affaires XB ; production et autres produits TE–TI moins achats, transports, services extérieurs, impôts et autres charges RC–RJ donnent la valeur ajoutée XC ; moins charges de personnel RK, l'excédent brut d'exploitation XD ; avec reprises TJ et dotations RL, le résultat d'exploitation XE ; les éléments financiers TK–TM et RM–RN donnent le résultat financier XF ; XG est le résultat des activités ordinaires ; cessions et autres éléments HAO TN–TO et RO–RP donnent le résultat HAO XH ; après participation des travailleurs RQ et impôts sur le résultat RS vient le résultat net XI.",
        article: "Art. 31 ; PCGO Titre IX ch. 4",
      },
      {
        ref: "C.7",
        en: "Each income-statement line shows the year and the prior year and carries the reference of the note that details it; the net result XI agrees to the balance-sheet result CJ.",
        fr: "Chaque poste du Compte de résultat présente l'exercice et l'exercice précédent et porte la référence de la note qui le détaille ; le résultat net XI est égal au résultat du Bilan CJ.",
        article: "Art. 34 ; PCGO Titre IX ch. 4",
      },
      {
        ref: "C.8",
        en: "The cash-flow statement shows opening net cash, cash flows from operating activities, from investing activities, from equity and from external financing [capitaux étrangers], and closing net cash.",
        fr: "Le Tableau des flux de trésorerie fait apparaître la trésorerie nette en début d'exercice, les flux provenant des activités opérationnelles, des opérations d'investissement, des capitaux propres et des capitaux étrangers, et la trésorerie nette en fin d'exercice.",
        article: "Art. 32",
      },
      {
        ref: "C.9",
        en: "The cash-flow statement follows the model lines and codes: ZA opening net cash (A); FA global self-financing capacity [CAFG] computed from EBITDA and FB–FE working-capital variations giving ZB operating flows (B); FF–FJ acquisitions and disposals giving ZC investing flows (C); FK–FN capital increases, investment grants, withdrawals and dividends giving ZD (D); FO–FQ borrowings, other financial debts and repayments giving ZE (E); ZF financing (D+E); ZG variation (B+C+F); ZH closing net cash (G+A).",
        fr: "Le Tableau des flux de trésorerie suit les postes et codes du modèle : ZA trésorerie nette au 1er janvier (A) ; FA capacité d'autofinancement globale (CAFG) calculée à partir de l'EBE et FB–FE variations du besoin de financement donnant ZB flux opérationnels (B) ; FF–FJ acquisitions et cessions donnant ZC flux d'investissement (C) ; FK–FN augmentations de capital, subventions d'investissement, prélèvements et dividendes donnant ZD (D) ; FO–FQ emprunts, autres dettes financières et remboursements donnant ZE (E) ; ZF financement (D+E) ; ZG variation (B+C+F) ; ZH trésorerie nette au 31 décembre (G+A).",
        article: "Art. 32 ; PCGO Titre IX ch. 5",
      },
      {
        ref: "C.10",
        en: "The cash-flow statement's control holds: opening and closing net cash each equal cash assets less cash liabilities [trésorerie-actif − trésorerie-passif] on the corresponding balance sheet, and the closing figure agrees to Note 34.",
        fr: "Le contrôle du Tableau des flux de trésorerie est satisfait : la trésorerie nette d'ouverture et de clôture est égale à la trésorerie-actif moins la trésorerie-passif du Bilan correspondant, et le montant de clôture concorde avec la Note 34.",
        article: "PCGO Titre IX ch. 5",
      },
      {
        ref: "C.11",
        en: "Every line of the statements maps to the accounts the PCGO assigns to it in the correspondence table [tableau de correspondance postes / comptes]; a balance carried on the wrong line is a presentation finding even when the total is right.",
        fr: "Chaque poste des états financiers est alimenté par les comptes que le PCGO lui affecte dans le tableau de correspondance postes / comptes ; un solde porté sur un poste erroné constitue une anomalie de présentation même si le total est juste.",
        article: "PCGO Titre IX ch. 7",
      },
      {
        ref: "C.12",
        en: "SMT: the balance sheet and income statement are presented on the SMT models of the PCGO, and where the entity holds fixed assets it keeps the fixed-asset register (SMT Note 1) with a straight-line depreciation schedule for each asset, without time apportionment [sans prorata temporis].",
        fr: "SMT : le Bilan et le Compte de résultat sont présentés sur les modèles SMT du PCGO, et l'entité qui possède des immobilisations tient le registre des immobilisations (Note 1 SMT) avec, pour chaque bien, un tableau d'amortissement linéaire sans prorata temporis.",
        article: "Art. 28 ; PCGO Titre X",
      },
    ],
  },
  {
    key: "D",
    titleEn: "The notes [Notes annexes]",
    titleFr: "Les notes annexes",
    introEn:
      "Tests the notes of the Système normal one by one against the SYSCOHADA models: the general rules first, then each of the thirty-six numbered notes and their sub-notes, stating what each must contain and, where the PCGO prescribes a table, that the table is used. A note that is not documented is not attached but is ticked N/A on sheet R4.",
    introFr:
      "Vérifie une à une les Notes annexes du Système normal au regard des modèles SYSCOHADA : les règles générales d'abord, puis chacune des trente-six notes numérotées et de leurs sous-notes, en précisant ce que chacune doit contenir et, lorsque le PCGO prescrit un tableau, que ce tableau est utilisé. Une note non documentée n'est pas jointe mais est cochée N/A sur la fiche R4.",
    rows: [
      {
        ref: "D.1",
        en: "The notes are an integral part of the statements and are organised by cross-reference [référence croisée] to the related information: every element of the balance sheet, income statement and cash-flow statement points to the note that completes it, and every note points back.",
        fr: "Les Notes annexes font partie intégrante des états financiers et sont organisées par référence croisée avec l'information liée : chaque élément du Bilan, du Compte de résultat et du Tableau des flux de trésorerie renvoie à la note qui le complète, et chaque note y renvoie en retour.",
        article: "Art. 33 ; PCGO Titre IX §1.2",
      },
      {
        ref: "D.2",
        en: "The notes complete and explain the other statements without substituting for recognition in them, do not repeat figures already shown in the balance sheet or income statement, and their figures are prepared on the same principles and in the same conditions as those statements.",
        fr: "Les Notes annexes complètent et commentent les autres états sans se substituer à une inscription au Bilan ou au Compte de résultat, ne reprennent pas les informations déjà portées dans ces états, et leurs éléments chiffrés sont établis selon les mêmes principes et dans les mêmes conditions que ceux du Bilan et du Compte de résultat.",
        article: "Art. 33 ; PCGO Titre IX §1.1",
      },
      {
        ref: "D.3",
        en: "The notes contain an explicit declaration of compliance with the Plan comptable général OHADA [déclaration explicite de conformité au PCGO], and the statements are declared compliant only if they comply with every provision of the SYSCOHADA.",
        fr: "Les Notes annexes comportent une déclaration explicite de conformité au Plan comptable général OHADA, et les états financiers ne sont déclarés conformes au SYSCOHADA que s'ils respectent toutes les dispositions du Système comptable OHADA.",
        article: "PCGO Titre IX §1.1 ; Note 2",
      },
      {
        ref: "D.4",
        en: "Only documented notes are attached; a model note with nothing to report is left out of the set and marked N/A on the recap sheet R4, and every note that is attached is marked A there, so that R4 agrees to the notes actually presented.",
        fr: "Seules les notes documentées sont jointes ; un modèle de note sans contenu est écarté de la liasse et coché N/A sur la fiche récapitulative R4, et chaque note jointe y est cochée A, de sorte que la fiche R4 concorde avec les notes effectivement présentées.",
        article: "PCGO Titre IX §1.2 ; Fiche R4",
      },
      {
        ref: "D.5",
        en: "Every note carries its heading block: entity name, identification number, year-end date [exercice clos le] and period length in months [durée en mois], and every note with figures shows the year and the prior year.",
        fr: "Chaque note porte son en-tête : désignation de l'entité, numéro d'identification, date de clôture de l'exercice et durée en mois, et chaque note chiffrée présente l'exercice et l'exercice précédent.",
        article: "PCGO Titre IX §2.4 ; Art. 34",
      },
      {
        ref: "N-1",
        en: "Note 1 discloses secured liabilities [dettes garanties par des sûretés réelles] in the prescribed table: for each debt category (financial debts, finance-lease debts, current liabilities) the gross amount secured by mortgages [hypothèques], pledges [nantissements, gages] or other securities, with the note reference, and states the reason for the securities given.",
        fr: "La Note 1 présente les dettes garanties par des sûretés réelles dans le tableau prescrit : pour chaque catégorie de dettes (dettes financières, dettes de location-acquisition, passif circulant), le montant brut garanti par hypothèques, nantissements ou gages, ou autres sûretés, avec la référence de la note, et indique le motif des sûretés consenties.",
        article: "Note 1 ; Art. 33",
      },
      {
        ref: "N-1.2",
        en: "Note 1 also discloses commitments given and received [engagements financiers donnés et reçus] in the prescribed table: commitments to and from related entities, redemption premiums, guarantees and endorsements [avals, cautions, garanties], discounted bills not yet due, receivables assigned, conditional debt waivers, and any other commitment the entity tracks.",
        fr: "La Note 1 présente également les engagements financiers donnés et reçus dans le tableau prescrit : engagements envers et de la part des entités liées, primes de remboursement, avals, cautions et garanties, effets escomptés non échus, créances cédées, abandons de créances conditionnels et tout autre engagement suivi par l'entité.",
        article: "Note 1 ; Art. 33",
      },
      {
        ref: "N-2A",
        en: "Note 2, part A, gives the declaration of compliance with the SYSCOHADA [déclaration de conformité], stated explicitly and without qualification.",
        fr: "La Note 2, partie A, contient la déclaration de conformité au SYSCOHADA, formulée explicitement et sans réserve.",
        article: "Note 2 ; Art. 10",
      },
      {
        ref: "N-2B",
        en: "Note 2, part B, describes the accounting rules and methods applied [règles et méthodes comptables]: valuation of fixed assets and depreciation, stocks, receivables, provisions, foreign-currency items, revenue, and any option the SYSCOHADA leaves open.",
        fr: "La Note 2, partie B, décrit les règles et méthodes comptables appliquées : évaluation des immobilisations et amortissements, stocks, créances, provisions, éléments en monnaies étrangères, produits, et toute option laissée ouverte par le SYSCOHADA.",
        article: "Note 2 ; Art. 33",
      },
      {
        ref: "N-2C",
        en: "Note 2, part C, discloses any departure from the accounting postulates and conventions [dérogation aux postulats et conventions comptables], with its justification and its effect on the statements.",
        fr: "La Note 2, partie C, expose toute dérogation aux postulats et conventions comptables, avec sa justification et son incidence sur les états financiers.",
        article: "Note 2 ; Art. 10 ; Art. 41",
      },
      {
        ref: "N-2D",
        en: "Note 2, part D, gives the additional information on the balance sheet, income statement and cash-flow statement [informations complémentaires] that the true and fair view requires and no other note carries, including changes of method or presentation, restated comparatives and post-closing events.",
        fr: "La Note 2, partie D, fournit les informations complémentaires relatives au Bilan, au Compte de résultat et au Tableau des flux de trésorerie qu'exige l'image fidèle et qu'aucune autre note ne porte, notamment les changements de méthode ou de présentation, les comparatifs adaptés et les événements postérieurs à la clôture.",
        article: "Note 2 ; Art. 33 ; Art. 34",
      },
      {
        ref: "N-3A",
        en: "Note 3A presents gross fixed assets [immobilisation brute] in the prescribed movement table, line by line for intangibles, tangibles (land and buildings each split between investment property and other), advances on fixed assets and financial fixed assets: gross at opening, acquisitions / contributions / creations, transfers between lines [virements de poste à poste], revaluation in the year, disposals / demergers / retirements [cessions, scissions, hors service], gross at closing.",
        fr: "La Note 3A présente les immobilisations brutes dans le tableau de mouvements prescrit, poste par poste pour les incorporelles, les corporelles (terrains et bâtiments ventilés entre immeubles de placement et autres), les avances et acomptes sur immobilisations et les immobilisations financières : montant brut à l'ouverture, acquisitions / apports / créations, virements de poste à poste, réévaluation pratiquée au cours de l'exercice, cessions / scissions / mises hors service, montant brut à la clôture.",
        article: "Note 3A",
      },
      {
        ref: "N-3A.2",
        en: "Note 3A's commentary explains every significant movement, itemises goodwill [fonds commercial] with its acquisition date, describes any concession agreement (nature of the right, duration, expiry), lists group receivables with nature and due date, and for term deposits [DAT] names the bank, the amount and the maturity.",
        fr: "Le commentaire de la Note 3A explique toute variation significative, détaille les éléments constitutifs du fonds commercial avec leur date d'acquisition, décrit tout accord de concession (nature du droit, durée, échéance), indique les créances du groupe avec leur nature et leur échéance, et pour les dépôts à terme nomme la banque, le montant et l'échéance.",
        article: "Note 3A",
      },
      {
        ref: "N-3B",
        en: "Note 3B presents assets held under finance leases [biens pris en location-acquisition] in the prescribed movement table (same columns as Note 3A), by line and by contract type — I real-estate lease, M equipment lease, A other contracts, split where significant — and states for each the nature of the asset, the lessor's name and the lease term.",
        fr: "La Note 3B présente les biens pris en location-acquisition dans le tableau de mouvements prescrit (mêmes colonnes que la Note 3A), par poste et par nature de contrat — I crédit-bail immobilier, M crédit-bail mobilier, A autres contrats, dédoublés si les montants sont significatifs — et indique pour chacun la nature du bien, le nom du bailleur et la durée du bail.",
        article: "Note 3B",
      },
      {
        ref: "N-3C",
        en: "Note 3C presents accumulated depreciation [amortissements] in the prescribed table, by line: cumulative at opening, charge for the year, amounts released on disposals, cumulative at closing; the commentary states the depreciation methods used and the useful lives or rates applied.",
        fr: "La Note 3C présente les amortissements dans le tableau prescrit, poste par poste : cumul à l'ouverture, dotations de l'exercice, sorties, cumul à la clôture ; le commentaire indique les modes d'amortissement utilisés ainsi que les durées de vie ou les taux appliqués.",
        article: "Note 3C ; Art. 45",
      },
      {
        ref: "N-3D",
        en: "Note 3D presents gains and losses on disposal of fixed assets [plus-values et moins-values de cession] in the prescribed table, by line: gross value, accumulated depreciation, net book value, sale price, gain or loss; the commentary justifies each disposal and gives the acquisition date and the exit date.",
        fr: "La Note 3D présente les plus-values et moins-values de cession d'immobilisations dans le tableau prescrit, poste par poste : valeur brute, amortissements cumulés, valeur nette comptable, prix de cession, plus ou moins-value ; le commentaire justifie chaque cession et mentionne la date d'acquisition et la date de sortie.",
        article: "Note 3D",
      },
      {
        ref: "N-3E",
        en: "Note 3E discloses any revaluation carried out [réévaluations effectuées]: its nature (free or legal) and date, the lines concerned with historical cost, the additional depreciation, the method used, the tax treatment of the revaluation surplus [écart de réévaluation] and the amount of surplus incorporated into capital.",
        fr: "La Note 3E renseigne toute réévaluation effectuée : sa nature (libre ou légale) et sa date, les postes concernés avec leur coût historique, les amortissements supplémentaires, la méthode utilisée, le traitement fiscal de l'écart de réévaluation et le montant de l'écart incorporé au capital.",
        article: "Note 3E ; Art. 35 ; Art. 62–65",
      },
      {
        ref: "N-3F",
        en: "Note 3F (printed as Note 8A in the PCGO models) presents the spreading schedule of capitalised charges [tableau d'étalement des charges immobilisées] — formation costs, deferred charges and redemption premiums carried at 1 January 2018 through the transitional account 475: amount at that date, spreading period and annual amounts by account until cleared.",
        fr: "La Note 3F (imprimée comme Note 8A dans les modèles du PCGO) présente le tableau d'étalement des charges immobilisées — frais d'établissement, charges à répartir et primes de remboursement portés au 1er janvier 2018 par le compte transitoire 475 : montant à cette date, durée d'étalement et montants annuels par compte jusqu'à apurement.",
        article: "Note 3F ; Art. 111-1",
      },
      {
        ref: "N-4",
        en: "Note 4 presents financial fixed assets [immobilisations financières] in the prescribed table, by line (investment securities, loans, staff loans, receivables from the State, other long-term securities, deposits and guarantees, accrued interest): year, prior year, variation in value and per cent, maturity within one year, one to two years and beyond two years, and impairment.",
        fr: "La Note 4 présente les immobilisations financières dans le tableau prescrit, poste par poste (titres de participation, prêts, prêts au personnel, créances sur l'État, titres immobilisés, dépôts et cautionnements, intérêts courus) : exercice, exercice précédent, variation en valeur et en pourcentage, échéances à un an au plus, de un à deux ans et à plus de deux ans, et dépréciations.",
        article: "Note 4",
      },
      {
        ref: "N-4.2",
        en: "Note 4 lists subsidiaries and investments [filiales et participations]: name, location, percentage held, acquisition value, equity and result of the last financial year; the commentary justifies significant variations, comments old receivables, describes any concession receivable, gives the number and acquisition date of own shares [actions propres], and states the events that led to any impairment or reversal.",
        fr: "La Note 4 dresse la liste des filiales et participations : dénomination, localisation, pourcentage détenu, valeur d'acquisition, capitaux propres et résultat du dernier exercice ; le commentaire justifie les variations significatives, commente les créances anciennes, décrit toute créance relative à une concession, indique le nombre et la date d'acquisition des actions ou parts propres, et expose les événements ayant motivé toute dépréciation ou reprise.",
        article: "Note 4 ; Art. 76",
      },
      {
        ref: "N-5",
        en: "Note 5 presents HAO current assets [actif circulant HAO] (receivables on disposals of fixed assets, other) and HAO current liabilities [dettes circulantes HAO] (suppliers of fixed assets, amounts unpaid on securities, other) in the prescribed table with year, prior year, variation and impairment, and states the dates and nature of the assets bought or sold.",
        fr: "La Note 5 présente l'actif circulant HAO (créances sur cessions d'immobilisations, autres) et les dettes circulantes HAO (fournisseurs d'investissements, versements restant à effectuer sur titres, autres) dans le tableau prescrit avec exercice, exercice précédent, variation et dépréciations, et indique les dates et la nature des biens acquis ou cédés.",
        article: "Note 5",
      },
      {
        ref: "N-6",
        en: "Note 6 presents stocks and work in progress [stocks et en-cours] in the prescribed table by category, including goods in transit, on consignment and in deposit, with impairment; HAO stocks are shown on line BA only when they exceed 5 per cent of current assets.",
        fr: "La Note 6 présente les stocks et en-cours dans le tableau prescrit par catégorie, y compris les biens en route, en consignation et en dépôt, avec les dépréciations ; les stocks HAO ne figurent au poste BA que s'ils dépassent 5 % de l'actif circulant.",
        article: "Note 6 ; Art. 44",
      },
      {
        ref: "N-6.2",
        en: "Note 6's commentary states the physical inventory date and procedure, the valuation methods applied (FIFO or weighted average cost, and any cost technique such as standard cost), and details the impaired stock and the reasons for the impairment.",
        fr: "Le commentaire de la Note 6 indique la date et la procédure de l'inventaire physique, les méthodes de valorisation appliquées (PEPS ou coût moyen pondéré, et toute technique de coût telle que le coût standard), et détaille les stocks dépréciés et les motifs de la dépréciation.",
        article: "Note 6 ; Art. 44",
      },
      {
        ref: "N-7",
        en: "Note 7 presents trade receivables [clients] in the prescribed table: non-group customers, bills receivable, sales with retention of title, group customers, receivables on disposals of fixed assets, discounted bills not yet due, doubtful receivables and accrued income, with maturities and impairment, and separately customers in credit [clients créditeurs] for advances received.",
        fr: "La Note 7 présente les créances clients dans le tableau prescrit : clients hors groupe, effets à recevoir, ventes avec réserve de propriété, clients groupe, créances sur cessions d'immobilisations, effets escomptés non échus, créances douteuses et produits à recevoir, avec échéances et dépréciations, et séparément les clients créditeurs au titre des avances reçues.",
        article: "Note 7",
      },
      {
        ref: "N-7.2",
        en: "Note 7's commentary names the group companies concerned and the percentage held, and states the events that led to any impairment or reversal.",
        fr: "Le commentaire de la Note 7 nomme les sociétés du groupe concernées et le pourcentage détenu, et expose les événements ayant motivé toute dépréciation ou reprise.",
        article: "Note 7",
      },
      {
        ref: "N-8",
        en: "Note 8 presents other receivables [autres créances] in the prescribed table: staff, social bodies, State, international bodies, associates and group, transitional account 475, sundry debtors and liaison accounts, with maturities and impairment; the commentary justifies significant variations and old receivables, details significant items, and for the transitional account gives its composition and the time left to clear it.",
        fr: "La Note 8 présente les autres créances dans le tableau prescrit : personnel, organismes sociaux, État, organismes internationaux, associés et groupe, compte transitoire 475, débiteurs divers et comptes de liaison, avec échéances et dépréciations ; le commentaire justifie les variations significatives et les créances anciennes, détaille les créances significatives, et pour le compte transitoire en indique le détail et la durée restant pour l'apurement.",
        article: "Note 8 ; Art. 111-1",
      },
      {
        ref: "N-9",
        en: "Note 9 presents investment securities [titres de placement] in the prescribed table by type with impairment; for listed securities it gives the number held, the unit cost and the market price at 31 December, and for own shares the date and number acquired.",
        fr: "La Note 9 présente les titres de placement dans le tableau prescrit par nature avec les dépréciations ; pour les titres cotés elle indique le nombre détenu, le coût unitaire et le cours au 31 décembre, et pour les actions propres la date et le nombre acquis.",
        article: "Note 9",
      },
      {
        ref: "N-10",
        en: "Note 10 presents items for collection [valeurs à encaisser] — bills, cheques, card receipts — in the prescribed table with impairment.",
        fr: "La Note 10 présente les valeurs à encaisser — effets, chèques, cartes — dans le tableau prescrit avec les dépréciations.",
        article: "Note 10",
      },
      {
        ref: "N-11",
        en: "Note 11 presents cash and equivalents [disponibilités] in the prescribed table: local banks, banks in other States of the region, term deposits, other banks, accrued interest, postal accounts, treasury instruments, cash, electronic money and imprest accounts [régies d'avances]; the commentary states the date of the last bank reconciliation and of the cash count.",
        fr: "La Note 11 présente les disponibilités dans le tableau prescrit : banques locales, banques des autres États de la région, dépôts à terme, autres banques, intérêts courus, chèques postaux, instruments de trésorerie, caisse, monnaie électronique et régies d'avances ; le commentaire indique la date du dernier rapprochement bancaire et celle de l'inventaire de caisse.",
        article: "Note 11",
      },
      {
        ref: "N-12",
        en: "Note 12 presents translation differences [écarts de conversion] on the asset and liability side in the prescribed table: each foreign-currency receivable and payable, currency, amount, rate at acquisition, rate at 31 December and the resulting difference, with the provision for exchange losses that the probable losses require.",
        fr: "La Note 12 présente les écarts de conversion actif et passif dans le tableau prescrit : chaque créance et dette en devises, la devise, le montant, le cours d'acquisition, le cours au 31 décembre et l'écart en résultant, avec la provision pour pertes de change qu'exigent les pertes probables.",
        article: "Note 12 ; Art. 54",
      },
      {
        ref: "N-12.2",
        en: "Note 12 also details transfers of operating and financial charges [transferts de charges] by nature, so that each reclassification in the income statement can be traced.",
        fr: "La Note 12 détaille également les transferts de charges d'exploitation et financières par nature, de sorte que chaque reclassement du Compte de résultat puisse être suivi.",
        article: "Note 12",
      },
      {
        ref: "N-13",
        en: "Note 13 presents the capital in the prescribed table: nominal value of shares or units, each holder with name, nationality, number and class of shares (ordinary or preference), amount, and movements by transfer or repayment, and uncalled capital; the commentary gives the capital at formation, the dates of the extraordinary meetings that increased or reduced it, the rights attached to preference shares and the time left to call unpaid capital.",
        fr: "La Note 13 présente le capital dans le tableau prescrit : valeur nominale des actions ou parts, chaque détenteur avec nom, nationalité, nombre et catégorie de titres (ordinaires ou de préférence), montant, et mouvements par cession ou remboursement, ainsi que le capital non appelé ; le commentaire indique le capital à la constitution, les dates des assemblées générales extraordinaires ayant augmenté ou réduit le capital, les droits attachés aux actions de préférence et le délai restant pour appeler le capital.",
        article: "Note 13",
      },
      {
        ref: "N-14",
        en: "Note 14 presents premiums and reserves [primes et réserves] in the prescribed table: contribution, issue, merger and conversion premiums; legal, statutory, long-term capital gain, free-allocation and regulated reserves; free reserves and retained earnings; the commentary gives the dates of the meetings that decided the appropriations, the legal-reserve rate and the balance still to be endowed.",
        fr: "La Note 14 présente les primes et réserves dans le tableau prescrit : primes d'apport, d'émission, de fusion et de conversion ; réserves légales, statutaires, de plus-values à long terme, d'attribution gratuite et réglementées ; réserves libres et report à nouveau ; le commentaire indique les dates des assemblées ayant décidé les affectations, le taux de la réserve légale et le solde restant à doter.",
        article: "Note 14",
      },
      {
        ref: "N-15A",
        en: "Note 15A presents investment grants [subventions d'investissement] by grantor and regulated provisions [provisions réglementées] (accelerated depreciation, capital gains to reinvest, special revaluation provision and the like) in the prescribed table: year, prior year, variations, tax regime and maturities; the commentary gives for each grant its date, nature, the obligations attached and the legal text it rests on.",
        fr: "La Note 15A présente les subventions d'investissement par organisme et les provisions réglementées (amortissements dérogatoires, plus-values à réinvestir, provision spéciale de réévaluation et assimilées) dans le tableau prescrit : exercice, exercice précédent, variations, régime fiscal et échéances ; le commentaire indique pour chaque subvention sa date, sa nature, les obligations qui y sont attachées et le texte qui la fonde.",
        article: "Note 15A",
      },
      {
        ref: "N-15B",
        en: "Note 15B presents other equity instruments [autres fonds propres] — participating securities, conditional advances, perpetual subordinated notes [TSDI], bonds redeemable in shares [ORA] — in the prescribed table, shown as a separate balance-sheet line when significant, and justifies their classification in equity.",
        fr: "La Note 15B présente les autres fonds propres — titres participatifs, avances conditionnées, titres subordonnés à durée indéterminée, obligations remboursables en actions — dans le tableau prescrit, présentés sur une ligne distincte du Bilan lorsqu'ils sont significatifs, et justifie leur classement en fonds propres.",
        article: "Note 15B",
      },
      {
        ref: "N-16A",
        en: "Note 16A presents borrowings and financial debts [emprunts et dettes financières] in the prescribed table by type (bonds, credit-institution borrowings, State advances, blocked current accounts, deposits received, accrued interest, advances on special terms, other borrowings, debts linked to investments, permanent blocked accounts of establishments): year, prior year, variation in value and per cent, and maturities within one year, one to two years and beyond; for each loan the commentary gives the grant date, the lender, the initial amount, the term and the guarantees given.",
        fr: "La Note 16A présente les emprunts et dettes financières dans le tableau prescrit par nature (emprunts obligataires, emprunts auprès des établissements de crédit, avances reçues de l'État, comptes courants bloqués, dépôts et cautionnements reçus, intérêts courus, avances assorties de conditions particulières, autres emprunts, dettes liées à des participations, comptes permanents bloqués des établissements et succursales) : exercice, exercice précédent, variation en valeur et en pourcentage, échéances à un an au plus, de un à deux ans et au-delà ; pour chaque emprunt le commentaire indique la date d'octroi, l'organisme prêteur, le montant initial, la durée et les garanties données.",
        article: "Note 16A",
      },
      {
        ref: "N-16A.2",
        en: "Note 16A presents finance-lease debts [dettes de location-acquisition] in the same table by type — real-estate lease, equipment lease, hire purchase, accrued interest, other — with the same maturity split and, for each contract, the same particulars as for a loan.",
        fr: "La Note 16A présente les dettes de location-acquisition dans le même tableau par nature — crédit-bail immobilier, crédit-bail mobilier, location-vente, intérêts courus, autres — avec la même ventilation par échéance et, pour chaque contrat, les mêmes indications que pour un emprunt.",
        article: "Note 16A",
      },
      {
        ref: "N-16A.3",
        en: "Note 16A presents provisions for risks and charges [provisions pour risques et charges] in the same table by nature — litigation, customer guarantees, losses on contracts, exchange losses, taxes, pensions and similar obligations with the related plan assets, restructuring, fines and penalties, self-insurance, dismantling and site restoration, deduction rights, other — and the commentary states the events and circumstances that led to each provision and each reversal, and for pensions the valuation method, the insurer or pension fund and the terms of the agreement, and the principal actuarial assumptions with their basis.",
        fr: "La Note 16A présente les provisions pour risques et charges dans le même tableau par nature — litiges, garanties données aux clients, pertes sur marchés, pertes de change, impôts, pensions et obligations assimilées avec l'actif du régime correspondant, restructuration, amendes et pénalités, propre assureur, démantèlement et remise en état, droits à déduction, autres — et le commentaire expose les événements et circonstances ayant conduit à chaque provision et à chaque reprise, et pour les pensions la méthode d'évaluation, la compagnie d'assurance ou le fonds de pension et les termes de la convention, ainsi que les principales hypothèses actuarielles et leur base de détermination.",
        article: "Note 16A ; Art. 48",
      },
      {
        ref: "N-16B",
        en: "Note 16B (actuarial method) presents the actuarial assumptions for retirement and similar obligations [engagements de retraite et avantages assimilés] in the prescribed table for the year and the prior year: salary increase rate, discount rate, inflation rate, probability of remaining in the entity until retirement, probability of survival to retirement age (mortality table) and effective return on plan assets, with a commentary on any change in assumptions.",
        fr: "La Note 16B (méthode actuarielle) présente les hypothèses actuarielles des engagements de retraite et avantages assimilés dans le tableau prescrit pour l'exercice et l'exercice précédent : taux d'augmentation des salaires, taux d'actualisation, taux d'inflation, probabilité d'être présent dans l'entité à la date de départ à la retraite, probabilité d'être en vie à l'âge de la retraite (table de mortalité) et taux de rendement effectif des actifs du régime, avec un commentaire sur toute variation d'hypothèse.",
        article: "Note 16B ; Art. 48",
      },
      {
        ref: "N-16B.2",
        en: "Note 16B rolls the obligation forward in the prescribed table: obligation at opening, current service cost, interest cost, actuarial losses or gains, benefits paid, past service cost, obligation at closing, and states the charge recognised in the year by nature.",
        fr: "La Note 16B présente la variation de l'engagement dans le tableau prescrit : obligation à l'ouverture, coût des services rendus, coût financier, pertes ou gains actuariels, prestations payées, coût des services passés, obligation à la clôture, et indique le montant de la charge comptabilisée dans l'exercice par nature.",
        article: "Note 16B ; Art. 48",
      },
      {
        ref: "N-16B.3",
        en: "Note 16B gives the sensitivity analysis in the prescribed table: the effect on the obligation of an increase and a decrease in the discount rate, the salary progression rate and the staff turnover rate, for the year and the prior year, with the size of the variation tested.",
        fr: "La Note 16B fournit l'analyse de sensibilité dans le tableau prescrit : l'incidence sur l'engagement d'une hausse et d'une baisse du taux d'actualisation, du taux de progression des salaires et du taux de départ du personnel, pour l'exercice et l'exercice précédent, en précisant l'ampleur de la variation testée.",
        article: "Note 16B",
      },
      {
        ref: "N-16Bbis",
        en: "Note 16B bis presents funded plans [régimes financés] in the prescribed tables: present value of the funded obligation, fair value of plan assets and the resulting surplus or deficit with the net amount recognised, then plan assets by class (equities, bonds, other) with expected return and fair value for the year and the prior year, explaining how the rates of return were set and giving the actual return.",
        fr: "La Note 16B bis présente les régimes financés dans les tableaux prescrits : valeur actuelle de l'obligation, juste valeur des actifs affectés au plan et excédent ou déficit en résultant avec le montant net comptabilisé, puis les actifs du régime par catégorie (actions, obligations, autres) avec rendement attendu et juste valeur pour l'exercice et l'exercice précédent, en expliquant la détermination des taux de rendement et en indiquant les rendements réels.",
        article: "Note 16B bis",
      },
      {
        ref: "N-16C",
        en: "Note 16C presents contingent assets and liabilities [actifs et passifs éventuels] in the prescribed table (litigation and other, year and prior year) and describes their main characteristics, the expected timing of the inflows or outflows and any reimbursement expected; a contingent liability whose outflow is remote need not be disclosed.",
        fr: "La Note 16C présente les actifs et passifs éventuels dans le tableau prescrit (litiges et autres, exercice et exercice précédent) et décrit leurs principales caractéristiques, l'horizon auquel les encaissements ou décaissements sont attendus et les éventuels remboursements à percevoir ; un passif éventuel dont la sortie de ressources est improbable n'a pas à être mentionné.",
        article: "Note 16C ; PCGO ch. 30",
      },
      {
        ref: "N-17",
        en: "Note 17 presents trade payables [fournisseurs d'exploitation] in the prescribed table: suppliers on account, bills payable, group suppliers and invoices not yet received, with maturities, and separately suppliers in debit [fournisseurs débiteurs]; the commentary names the group companies and the percentage held.",
        fr: "La Note 17 présente les fournisseurs d'exploitation dans le tableau prescrit : fournisseurs en compte, effets à payer, fournisseurs du groupe et factures non parvenues, avec les échéances, et séparément les fournisseurs débiteurs ; le commentaire nomme les sociétés du groupe et le pourcentage détenu.",
        article: "Note 17",
      },
      {
        ref: "N-18",
        en: "Note 18 presents tax and social liabilities [dettes fiscales et sociales] in the prescribed table by line — staff, social security, pension bodies, income tax, VAT, withholdings — with maturities.",
        fr: "La Note 18 présente les dettes fiscales et sociales dans le tableau prescrit par poste — personnel, organismes de sécurité sociale, organismes de retraite, impôt sur le résultat, TVA, retenues à la source — avec les échéances.",
        article: "Note 18",
      },
      {
        ref: "N-19",
        en: "Note 19 presents other liabilities [autres dettes] in the prescribed table — associates, dividends payable, group, sundry creditors, factor, transitional account 475, liaison accounts — with maturities, and short-term provisions for risks cross-referenced to Note 28; the commentary states the interest rate on shareholder current accounts.",
        fr: "La Note 19 présente les autres dettes dans le tableau prescrit — associés, dividendes à payer, groupe, créditeurs divers, factor, compte transitoire 475, comptes de liaison — avec les échéances, ainsi que les provisions pour risques à court terme renvoyant à la Note 28 ; le commentaire indique le taux d'intérêt des comptes courants d'associés.",
        article: "Note 19",
      },
      {
        ref: "N-20",
        en: "Note 20 presents bank overdrafts, discount and treasury credits [banques, crédits d'escompte et de trésorerie] in the prescribed table and states for each facility the lender, the conditions, the rate and the term.",
        fr: "La Note 20 présente les banques, crédits d'escompte et crédits de trésorerie dans le tableau prescrit et indique pour chaque concours le prêteur, les conditions, le taux et la durée.",
        article: "Note 20",
      },
      {
        ref: "N-21",
        en: "Note 21 presents turnover and other income [chiffre d'affaires et autres produits] in the prescribed table: each type of sale split between the region, outside the region, group and internet sales, then ancillary income, capitalised production, operating grants and other income, for the year and the prior year.",
        fr: "La Note 21 présente le chiffre d'affaires et les autres produits dans le tableau prescrit : chaque nature de vente ventilée entre la région, hors région, groupe et ventes par internet, puis les produits accessoires, la production immobilisée, les subventions d'exploitation et les autres produits, pour l'exercice et l'exercice précédent.",
        article: "Note 21",
      },
      {
        ref: "N-22",
        en: "Note 22 presents purchases [achats] in the prescribed table: goods and raw materials split between the region, outside the region and group, and other purchases by nature, for the year and the prior year.",
        fr: "La Note 22 présente les achats dans le tableau prescrit : marchandises et matières ventilées entre la région, hors région et groupe, et autres achats par nature, pour l'exercice et l'exercice précédent.",
        article: "Note 22",
      },
      {
        ref: "N-23",
        en: "Note 23 presents transport costs [transports] in the prescribed table by nature, for the year and the prior year.",
        fr: "La Note 23 présente les transports dans le tableau prescrit par nature, pour l'exercice et l'exercice précédent.",
        article: "Note 23",
      },
      {
        ref: "N-24",
        en: "Note 24 presents external services [services extérieurs] in the prescribed table by nature, including finance-lease rentals, fees and training costs, for the year and the prior year.",
        fr: "La Note 24 présente les services extérieurs dans le tableau prescrit par nature, y compris les redevances de location-acquisition, les honoraires et les frais de formation, pour l'exercice et l'exercice précédent.",
        article: "Note 24",
      },
      {
        ref: "N-25",
        en: "Note 25 presents taxes and duties [impôts et taxes] in the prescribed table by nature, and details fines and penalties with their cause.",
        fr: "La Note 25 présente les impôts et taxes dans le tableau prescrit par nature, et détaille les pénalités et amendes avec leur cause.",
        article: "Note 25",
      },
      {
        ref: "N-26",
        en: "Note 26 presents other charges [autres charges] in the prescribed table: losses on receivables, net book value of ordinary disposals, directors' remuneration with the date of the meeting that authorised it, donations with their beneficiaries and short-term provision charges.",
        fr: "La Note 26 présente les autres charges dans le tableau prescrit : pertes sur créances, valeur nette comptable des cessions courantes, rémunérations des administrateurs avec la date de l'assemblée ou du conseil qui les a autorisées, dons avec leurs bénéficiaires et charges pour provisions à court terme.",
        article: "Note 26",
      },
      {
        ref: "N-27A",
        en: "Note 27A presents staff costs [charges de personnel] in the prescribed table by nature, including external staff [personnel extérieur] with the nature and term of the contracts.",
        fr: "La Note 27A présente les charges de personnel dans le tableau prescrit par nature, y compris le personnel extérieur avec la nature et la durée des contrats.",
        article: "Note 27A",
      },
      {
        ref: "N-27B",
        en: "Note 27B presents headcount, payroll and external staff [effectifs, masse salariale et personnel extérieur] in the prescribed coded table (YA to YO): by qualification, split between nationals, other OHADA nationals and non-OHADA nationals and between men and women, then permanent and seasonal staff, with a commentary on any significant movement.",
        fr: "La Note 27B présente les effectifs, la masse salariale et le personnel extérieur dans le tableau codé prescrit (YA à YO) : par qualification, ventilés entre nationaux, autres ressortissants OHADA et hors OHADA et entre hommes et femmes, puis permanents et saisonniers, avec un commentaire sur tout mouvement significatif.",
        article: "Note 27B",
      },
      {
        ref: "N-28",
        en: "Note 28 presents provisions and impairment recognised in the balance sheet [provisions et dépréciations inscrites au bilan] in the prescribed movement table for each category (regulated provisions, provisions for risks and charges, impairment of fixed assets, stocks, HAO assets, suppliers, customers, other receivables, securities and the rest): opening, charges split operating / financial / HAO, reversals split the same way, closing; the commentary states the events that motivated each charge and reversal.",
        fr: "La Note 28 présente les provisions et dépréciations inscrites au Bilan dans le tableau de mouvements prescrit pour chaque catégorie (provisions réglementées, provisions pour risques et charges, dépréciations des immobilisations, des stocks, de l'actif HAO, des fournisseurs, des clients, des autres créances, des titres et autres) : ouverture, dotations ventilées exploitation / financières / HAO, reprises ventilées de même, clôture ; le commentaire expose les événements ayant motivé chaque dotation et chaque reprise.",
        article: "Note 28 ; Art. 46 ; Art. 49",
      },
      {
        ref: "N-29",
        en: "Note 29 presents financial charges and income [charges et revenus financiers] in the prescribed table by nature, and states any interest on deferred payment terms that has not been recorded.",
        fr: "La Note 29 présente les charges et revenus financiers dans le tableau prescrit par nature, et mentionne les intérêts sur délais de paiement qui n'auraient pas été comptabilisés.",
        article: "Note 29",
      },
      {
        ref: "N-30",
        en: "Note 30 presents other HAO charges and income [autres charges et produits hors activités ordinaires] in the prescribed table by nature — donations, debt waivers, balancing grants, employee participation, HAO provisions and reversals — with a commentary on significant variations.",
        fr: "La Note 30 présente les autres charges et produits hors activités ordinaires dans le tableau prescrit par nature — dons, abandons de créances, subventions d'équilibre, participation des travailleurs, provisions et reprises HAO — avec un commentaire sur les variations significatives.",
        article: "Note 30 ; Art. 31",
      },
      {
        ref: "N-31",
        en: "Note 31 presents the appropriation of the result and the key figures of the last five years [répartition du résultat et éléments caractéristiques des cinq derniers exercices] in the prescribed table: capital structure, turnover, result of ordinary activities before charges, employee participation, income tax, net result, distributed result, dividend per share, headcount, payroll and social benefits.",
        fr: "La Note 31 présente la répartition du résultat et les éléments caractéristiques des cinq derniers exercices dans le tableau prescrit : structure du capital, chiffre d'affaires, résultat des activités ordinaires avant dotations, participation des travailleurs, impôt sur le résultat, résultat net, résultat distribué, dividende par action, effectifs, masse salariale et avantages sociaux.",
        article: "Note 31",
      },
      {
        ref: "N-32",
        en: "Note 32 presents the year's production [production de l'exercice] in the prescribed statistical table by product: quantity and value sold in the State, in other OHADA States and outside OHADA, capitalised production, and opening and closing stocks.",
        fr: "La Note 32 présente la production de l'exercice dans le tableau statistique prescrit par produit : quantité et valeur vendues dans l'État, dans les autres États OHADA et hors OHADA, production immobilisée, et stocks d'ouverture et de clôture.",
        article: "Note 32",
      },
      {
        ref: "N-33",
        en: "Note 33 presents purchases intended for production [achats destinés à la production] in the prescribed statistical table by material: unit, quantity and value bought in the State and imported, and stock variation.",
        fr: "La Note 33 présente les achats destinés à la production dans le tableau statistique prescrit par matière : unité, quantité et valeur achetées dans l'État et importées, et variation des stocks.",
        article: "Note 33",
      },
      {
        ref: "N-34",
        en: "Note 34 gives the summary of key financial indicators [fiche de synthèse des principaux indicateurs financiers], expressed in thousands of francs — the only statement the PCGO expresses in thousands — with the intermediate balances, operating and global self-financing capacity, self-financing, economic and financial return, working capital, operating and HAO financing needs, net cash with its control to the balance sheet, cash variation and net financial debt.",
        fr: "La Note 34 fournit la fiche de synthèse des principaux indicateurs financiers, exprimée en milliers de francs — seul état que le PCGO exprime en milliers — avec les soldes intermédiaires de gestion, la CAF d'exploitation et la CAFG, l'autofinancement, les rentabilités économique et financière, le fonds de roulement, les besoins de financement d'exploitation et HAO, la trésorerie nette avec son contrôle au Bilan, la variation de trésorerie et l'endettement financier net.",
        article: "Note 34",
      },
      {
        ref: "N-35",
        en: "Note 35 gives the social, environmental and societal information [informations sociales, environnementales et sociétales] for entities above the headcount threshold — which the Note 35 model states as more than 250 employees and PCGO chapter 30 as more than 500, so the paper records which reading was applied — covering employment, labour relations, health and safety, training, equal treatment, environmental policy, pollution and waste, sustainable use of resources, climate change, biodiversity and societal commitments.",
        fr: "La Note 35 fournit les informations sociales, environnementales et sociétales pour les entités dépassant le seuil d'effectif — que le modèle de la Note 35 fixe à plus de 250 salariés et le chapitre 30 du PCGO à plus de 500, de sorte que le papier consigne la lecture retenue — couvrant l'emploi, les relations sociales, la santé et la sécurité, la formation, l'égalité de traitement, la politique environnementale, la pollution et les déchets, l'utilisation durable des ressources, le changement climatique, la biodiversité et les engagements sociétaux.",
        article: "Note 35 ; PCGO ch. 30 §1.4.3",
      },
      {
        ref: "N-36",
        en: "Note 36 carries the code tables [tables des codes] — legal form, tax regime, country of registered office, activities — and the codes entered on sheets R1 and R2 are taken from them.",
        fr: "La Note 36 comporte les tables des codes — forme juridique, régime fiscal, pays du siège social, activités — et les codes portés sur les fiches R1 et R2 en sont issus.",
        article: "Note 36",
      },
    ],
  },
  {
    key: "E",
    titleEn: "Other mandatory disclosures",
    titleFr: "Autres informations obligatoires",
    introEn:
      "Tests the disclosures the Act requires wherever they happen to fall in the notes — changes, errors, post-closing events, related parties, commitments, group relationships — because none of them has a dedicated numbered note and each is easily missed.",
    introFr:
      "Vérifie les informations que l'Acte exige quel que soit l'endroit des Notes annexes où elles figurent — changements, erreurs, événements postérieurs, parties liées, engagements, liens de groupe — car aucune ne dispose d'une note numérotée propre et chacune est facilement omise.",
    rows: [
      {
        ref: "E.1",
        en: "A change of accounting method [changement de méthode comptable] is disclosed in the notes with its justification and its effect; where it is decided by the standard-setter its retrospective effect is taken to opening equity, and comparatives are restated so the years remain comparable.",
        fr: "Tout changement de méthode comptable est signalé dans les Notes annexes avec sa justification et son incidence ; lorsqu'il est décidé par les autorités de normalisation, son effet rétrospectif est imputé sur les capitaux propres d'ouverture, et les comparatifs sont adaptés pour que les exercices restent comparables.",
        article: "Art. 41 ; Art. 34",
      },
      {
        ref: "E.2",
        en: "A change of accounting estimate [changement d'estimation] is applied prospectively to the current and future periods only, and its nature and effect are disclosed when significant.",
        fr: "Tout changement d'estimation comptable est appliqué de manière prospective aux exercices en cours et futurs seulement, et sa nature et son incidence sont mentionnées lorsqu'elles sont significatives.",
        article: "PCGO Titre V §4.1.1.4",
      },
      {
        ref: "E.3",
        en: "Errors [corrections d'erreurs]: an error of the current year is corrected only by negative entries of the wrong elements followed by the correct entry; a significant prior-year error is corrected through retained earnings, and any prior-year error is disclosed in the notes.",
        fr: "Corrections d'erreurs : une erreur de l'exercice en cours est corrigée exclusivement par inscription en négatif des éléments erronés puis enregistrement exact ; une erreur significative d'un exercice antérieur est corrigée par le report à nouveau, et toute erreur d'exercice antérieur est mentionnée dans les Notes annexes.",
        article: "Art. 20 ; PCGO Titre V §4.1.1.4",
      },
      {
        ref: "E.4",
        en: "Income and charges relating to prior years that could not be recorded before those years closed are recorded by nature in the current year and are specifically mentioned in the notes.",
        fr: "Les produits et charges concernant des exercices antérieurs qui n'ont pu être pris en compte avant leur clôture sont enregistrés selon leur nature dans l'exercice en cours et font l'objet d'une mention spécifique dans les Notes annexes.",
        article: "Art. 61",
      },
      {
        ref: "E.5",
        en: "Events after the reporting date [événements postérieurs à la clôture]: risks, charges and income known between the closing date and the date the accounts are closed are taken into account; the notes state the date of closing and the body that authorised it, and for each category of non-adjusting event its nature and financial effect or the fact that it cannot be estimated; dividends declared after closing are disclosed in the notes only.",
        fr: "Événements postérieurs à la clôture : les risques, charges et produits connus entre la date de clôture et celle de l'arrêté des comptes sont pris en compte ; les Notes annexes indiquent la date d'arrêté et l'organe qui l'a autorisé, et pour chaque catégorie d'événement ne donnant pas lieu à ajustement sa nature et son incidence financière ou l'impossibilité de l'estimer ; les dividendes décidés après la clôture ne sont mentionnés que dans les Notes annexes.",
        article: "Art. 49 ; Art. 71 ; PCGO ch. 31",
      },
      {
        ref: "E.6",
        en: "Where going concern is in doubt, the notes indicate and justify the uncertainties and state the basis on which the statements were closed, and the management report addresses the prospects for continuing the activity.",
        fr: "Lorsque la continuité d'exploitation est compromise, les Notes annexes indiquent et justifient les incertitudes et précisent la base sur laquelle les états financiers ont été arrêtés, et le rapport de gestion traite des perspectives de continuation de l'activité.",
        article: "Art. 39 ; Art. 71 ; PCGO Titre IX §2.1",
      },
      {
        ref: "E.7",
        en: "Related-party transactions [transactions entre parties liées] are disclosed: designation of the related party, nature of the asset or service, amount of the transaction and any other information needed to assess the entity's financial position.",
        fr: "Les transactions entre parties liées sont mentionnées : désignation de la partie liée, nature du bien ou du service, montant de la transaction et toute autre information nécessaire à l'appréciation de la situation financière de l'entité.",
        article: "PCGO ch. 30 §1.4.2",
      },
      {
        ref: "E.8",
        en: "Off-balance-sheet commitments given and received [engagements donnés et reçus] are tracked by the entity within its accounting organisation and, when significant, disclosed in the notes (Note 1 table), valued at the contract amount or the residual amount, or described in words where they cannot be quantified.",
        fr: "Les engagements donnés et reçus hors bilan sont suivis par l'entité dans le cadre de son organisation comptable et, lorsqu'ils sont significatifs, mentionnés dans les Notes annexes (tableau de la Note 1), évalués au montant du contrat ou au montant résiduel, ou décrits lorsqu'ils ne peuvent être chiffrés.",
        article: "Art. 33 ; PCGO ch. 30 §1.3–1.4",
      },
      {
        ref: "E.9",
        en: "Items outside ordinary activities [hors activités ordinaires] are shown distinctly in the income statement and detailed by nature in Note 30, so that the result of ordinary activities is not distorted by them.",
        fr: "Les éléments hors activités ordinaires sont présentés distinctement au Compte de résultat et détaillés par nature dans la Note 30, de sorte que le résultat des activités ordinaires n'en soit pas faussé.",
        article: "Art. 31 ; Note 30",
      },
      {
        ref: "E.10",
        en: "For a foreign-currency loan or borrowing of more than one year contracted abroad, whose exchange gain or loss is spread over the remaining term, the total potential gain or loss recomputed at each year-end is stated in the notes.",
        fr: "Pour un emprunt contracté ou un prêt consenti à l'étranger pour plus d'un an, dont le gain ou la perte de change est étalé sur la durée restant à courir, le gain futur total ou la perte future totale recalculé à chaque clôture est mentionné dans les Notes annexes.",
        article: "Art. 56",
      },
      {
        ref: "E.11",
        en: "Where different assets were acquired jointly or produced inseparably for a global cost, the notes state the valuation method used to allocate that cost between them.",
        fr: "Lorsque des biens différents ont été acquis conjointement ou produits de façon indissociable pour un coût global, les Notes annexes mentionnent les modalités d'évaluation retenues pour ventiler ce coût entre eux.",
        article: "Art. 38",
      },
      {
        ref: "E.12",
        en: "Where the entity is a consolidating entity itself under the exclusive or joint control of one or more entities based outside the OHADA area, their identity is disclosed in its own notes; an entity that is ultimately under the exclusive or joint control of a legal person states so in its notes and names the entity of the State party charged with preparing the combined accounts.",
        fr: "Lorsque l'entité consolidante est elle-même sous le contrôle exclusif ou conjoint d'une ou plusieurs entités établies hors de l'espace OHADA, leur identité est signalée dans ses propres Notes annexes ; toute entité placée en dernier ressort sous le contrôle exclusif ou conjoint d'une personne morale en fait mention dans ses Notes annexes et y précise l'entité de l'État partie chargée de l'établissement des comptes combinés.",
        article: "Art. 76 ; Art. 103",
      },
      {
        ref: "E.13",
        en: "Where the entity controls one or more other entities, exclusively or jointly, it prepares and publishes consolidated statements and a group management report unless it is exempted — as a sub-group already consolidated within the OHADA area, or a group below 500 million F CFA of turnover for two successive years — and any entity left out of the scope falls within one of the causes the Act allows.",
        fr: "Lorsque l'entité contrôle, de manière exclusive ou conjointe, une ou plusieurs autres entités, elle établit et publie des états financiers consolidés et un rapport sur la gestion de l'ensemble, sauf dispense — sous-groupe déjà consolidé dans l'espace OHADA, ou ensemble dont le chiffre d'affaires ne dépasse pas 500 millions de F CFA pendant deux exercices successifs — et toute entité laissée hors du périmètre relève de l'une des causes admises par l'Acte.",
        article: "Art. 74 ; Art. 77 ; Art. 95 ; Art. 96",
      },
      {
        ref: "E.14",
        en: "The management report [rapport de gestion] accompanies the statements and sets out the entity's situation during the year, its development prospects or foreseeable evolution and in particular the prospects for continuing the activity, the evolution of its cash position and the financing plan, and the important events between the year-end and the date it was drawn up; a social report [bilan social] is added where required.",
        fr: "Le rapport de gestion accompagne les états financiers et expose la situation de l'entité durant l'exercice, ses perspectives de développement ou son évolution prévisible et en particulier les perspectives de continuation de l'activité, l'évolution de la situation de trésorerie et le plan de financement, ainsi que les événements importants survenus entre la clôture et la date de son établissement ; un bilan social y est joint le cas échéant.",
        article: "Art. 71",
      },
    ],
  },
  {
    key: "F",
    titleEn: "Approval, signature and dating",
    titleFr: "Arrêté, signature et datation",
    introEn:
      "Tests that the set was drawn up, dated, signed and, where an auditor is appointed, reported on by the right people at the right time, and that it is transcribed in the statutory books.",
    introFr:
      "Vérifie que le jeu a été dressé, daté, signé et, lorsqu'un commissaire aux comptes est désigné, certifié par les bonnes personnes au bon moment, et qu'il est transcrit dans les livres légaux.",
    rows: [
      {
        ref: "F.1",
        en: "The inventory and the annual statements are drawn up at each year-end by the administrative or management body, together with the management report and, where applicable, the social report; a director who fails to prepare them, or who knowingly prepares statements that do not give a true and fair view, incurs criminal liability.",
        fr: "L'inventaire et les états financiers annuels sont dressés à chaque clôture par les organes d'administration ou de direction, avec le rapport de gestion et, le cas échéant, le bilan social ; le dirigeant qui ne les établit pas, ou qui établit sciemment des états financiers ne donnant pas une image fidèle, encourt une sanction pénale.",
        article: "Art. 71 ; Art. 111",
      },
      {
        ref: "F.2",
        en: "The closing date [date d'arrêté] is within four months of the year-end and is stated on every transmission of the statements; on sheet R1 it appears as the effective closing date (ZB) beside the period (ZA) and the prior period (ZC).",
        fr: "La date d'arrêté se situe dans les quatre mois de la clôture et est mentionnée dans toute transmission des états financiers ; sur la fiche R1 elle figure comme date d'arrêté effectif des comptes (ZB) à côté de l'exercice (ZA) et de l'exercice précédent (ZC).",
        article: "Art. 23 ; PCGO Fiche R1",
      },
      {
        ref: "F.3",
        en: "Sheet R1 identifies the professional who prepared the statements — the entity's salaried professional, or the name, address and telephone of the firm or professional registered with the national institute of chartered accountants [Ordre national des experts-comptables et des comptables agréés] — and bears the visa of the expert-comptable or comptable agréé.",
        fr: "La fiche R1 identifie le professionnel ayant établi les états financiers — le professionnel salarié de l'entité, ou le nom, l'adresse et le téléphone du cabinet ou du professionnel inscrit à l'Ordre national des experts-comptables et des comptables agréés — et porte le visa de l'expert-comptable ou du comptable agréé.",
        article: "PCGO Fiche R1",
      },
      {
        ref: "F.4",
        en: "Sheet R1 records whether the statements have been approved by the general meeting [états financiers approuvés par l'assemblée générale], and the approval falls within six months of the year-end.",
        fr: "La fiche R1 indique si les états financiers ont été approuvés par l'assemblée générale, et l'approbation intervient dans les six mois de la clôture.",
        article: "PCGO Fiche R1 ; Art. 72",
      },
      {
        ref: "F.5",
        en: "Where statutory auditors [commissaires aux comptes] are appointed, voluntarily or by law, their report states either that the statements are regular and sincere and give a true and fair view of the year's result, the financial position and the assets, or a qualified or adverse opinion with reasons, or a disclaimer; it also states whether the information in the management report is sincere and consistent with the statements.",
        fr: "Lorsque des commissaires aux comptes sont désignés, volontairement ou obligatoirement, leur rapport indique soit que les états financiers sont réguliers et sincères et donnent une image fidèle du résultat de l'exercice, de la situation financière et du patrimoine, soit une opinion avec réserve ou défavorable motivée, soit l'impossibilité d'exprimer une opinion ; il se prononce également sur la sincérité et la concordance avec les états financiers des informations du rapport de gestion.",
        article: "Art. 70",
      },
      {
        ref: "F.6",
        en: "The presentation and publication of the statements are accompanied by the verification opinion of an independent professional.",
        fr: "La présentation et la publication des états financiers sont accompagnées de l'opinion de vérification d'un professionnel indépendant.",
        article: "PCGO Titre IX §2.4",
      },
      {
        ref: "F.7",
        en: "The balance sheet, income statement and cash-flow statement of the year, with the summary of the inventory, are transcribed in the inventory book [livre d'inventaire], which is numbered and initialled by the competent court, and the books and supporting documents are kept for ten years.",
        fr: "Le Bilan, le Compte de résultat et le Tableau des flux de trésorerie de l'exercice, avec le résumé de l'opération d'inventaire, sont transcrits sur le livre d'inventaire, coté et paraphé par la juridiction compétente, et les livres et pièces justificatives sont conservés pendant dix ans.",
        article: "Art. 19 ; Art. 66 ; Art. 24",
      },
    ],
  },
];
