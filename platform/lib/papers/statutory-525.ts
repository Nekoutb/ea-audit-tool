// C5.10 Article 525 — the statutory auditor's certification of the total
// remuneration paid to the highest-paid persons [attestation sur le montant
// global des rémunérations versées aux personnes les mieux rémunérées].
//
// Article 525 of the Uniform Act on commercial companies (AUSCGIE) lists what
// a shareholder may obtain before the annual general meeting; among those
// documents is the total amount, certified as exact by the statutory auditors,
// of the remuneration paid to the highest-paid persons — ten or five of them
// according to whether the entity's headcount exceeds the threshold the article
// sets. It is a report of its own, distinct from the report on the financial
// statements and from the special report on regulated agreements, and the file
// had no task for it.
//
// The paper is written against the form the certification takes in OHADA
// practice, read from two signed attestations (Togo 2019, five persons; Côte
// d'Ivoire 2025, ten persons): addressed to the shareholders for the meeting
// approving the accounts; the information established under management's
// responsibility and the auditors attesting it; the audit of the accounts as a
// whole giving no opinion on these amounts in isolation; diligences under the
// professional standards of Règlement n°01/2017/CM/OHADA that are neither an
// audit nor a limited review and consist of reconciling the total to the
// accounting from which the statements were prepared; a conclusion that the
// amount is exact and agrees to the accounting; the sentence that the
// attestation stands as the certification the article requires; and a
// restriction of its use to that purpose. The headcount and the number of
// persons are recorded on the paper from the article, not assumed by it.
import type { PaperDef, PaperItem, PaperProc, PaperSection } from "@/lib/papers/types";

const P = (
  key: string,
  en: string,
  fr: string,
  srcEn: string,
  srcFr: string,
  tipEn?: string,
  tipFr?: string,
): PaperProc => (tipEn && tipFr ? { key, en, fr, srcEn, srcFr, tipEn, tipFr } : { key, en, fr, srcEn, srcFr });

const Q = (key: string, en: string, fr: string, na?: boolean): PaperItem =>
  na ? { key, en, fr, na } : { key, en, fr };

const facts: PaperSection = {
  kind: "fields",
  titleEn: "Part A — The facts the article turns on",
  titleFr: "Partie A — Les faits dont dépend l'article",
  introEn:
    "Record the headcount and the reading of the article applied, so the reviewer can see why five or ten persons were retained.",
  introFr:
    "Consigner l'effectif et la lecture de l'article retenue, afin que le réviseur voie pourquoi cinq ou dix personnes ont été retenues.",
  fields: [
    { key: "headcount", kind: "input", labelEn: "Headcount at the closing date (basis and source)", labelFr: "Effectif à la date de clôture (base et source)" },
    {
      key: "persons",
      kind: "select",
      labelEn: "Number of highest-paid persons retained under art. 525",
      labelFr: "Nombre de personnes les mieux rémunérées retenu (art. 525)",
      options: [
        { value: "five", en: "Five — headcount at or below the article's threshold", fr: "Cinq — effectif inférieur ou égal au seuil de l'article" },
        { value: "ten", en: "Ten — headcount above the article's threshold", fr: "Dix — effectif supérieur au seuil de l'article" },
      ],
    },
    { key: "amount", kind: "input", labelEn: "Total remuneration certified (currency, gross, period)", labelFr: "Montant global des rémunérations attesté (devise, brut, période)" },
    { key: "scope", kind: "input", labelEn: "Scope of remuneration retained: fixed, variable, benefits in kind, persons other than employees", labelFr: "Périmètre des rémunérations retenu : fixe, variable, avantages en nature, personnes non salariées" },
    { key: "provided", kind: "input", labelEn: "Date the attestation was made available to shareholders, and how", labelFr: "Date de mise à disposition de l'attestation aux actionnaires, et modalité" },
  ],
};

export const STATUTORY_525_PAPER: PaperDef = {
  std: "AUSCGIE art. 525 · Règlement n°01/2017/CM/OHADA (normes professionnelles) · ISRS 4400 (procédures convenues) by analogy",
  ownsEn:
    "the statutory auditor's certification of the total remuneration paid to the highest-paid persons, and the work that supports it",
  ownsFr:
    "l'attestation du commissaire aux comptes sur le montant global des rémunérations versées aux personnes les mieux rémunérées, et les travaux qui la fondent",
  reqEn: [
    "Among the documents a shareholder may obtain before the annual general meeting, article 525 of the Uniform Act on commercial companies places the total amount of remuneration paid to the highest-paid persons — ten of them where the headcount exceeds the threshold the article sets, five where it does not — certified as exact by the statutory auditors. The certification is the statutory auditor's own report, separate from the report on the financial statements and from the special report on regulated agreements, and it is given for the meeting that approves the accounts.",
    "The information — the total, and the list of persons behind it — is established under the responsibility of management; the statutory auditor attests it. The audit of the financial statements gives no opinion on these amounts taken in isolation and includes no procedure aimed at them, so the attestation says so, and rests on diligences of its own: neither an audit nor a limited review, but the reconciliations needed between the total and the accounting from which the financial statements were prepared, performed under the professional standards of Règlement n°01/2017/CM/OHADA.",
    "The attestation is addressed to the shareholders, cites article 525, states management's responsibility and the auditor's, describes the diligences and their limits, concludes that the amount is exact and agrees to the accounting, records that it stands as the certification the article requires, and restricts its use to that purpose. It is dated and signed by the statutory auditor, with the amount in an annex.",
  ],
  reqFr: [
    "Parmi les documents qu'un actionnaire peut obtenir avant l'assemblée générale annuelle, l'article 525 de l'Acte uniforme relatif au droit des sociétés commerciales place le montant global des rémunérations versées aux personnes les mieux rémunérées — dix lorsque l'effectif excède le seuil fixé par l'article, cinq dans le cas contraire — certifié exact par les commissaires aux comptes. Cette certification est un rapport propre du commissaire aux comptes, distinct du rapport sur les états financiers et du rapport spécial sur les conventions réglementées, établi pour l'assemblée qui approuve les comptes.",
    "L'information — le montant global et la liste des personnes qui le composent — est établie sous la responsabilité de la direction ; le commissaire aux comptes l'atteste. L'audit des états financiers n'exprime aucune opinion sur ces montants pris isolément et ne comporte aucune diligence qui leur soit destinée : l'attestation le dit, et repose sur des diligences propres — ni un audit ni un examen limité, mais les rapprochements nécessaires entre le montant global et la comptabilité ayant servi de base à l'établissement des états financiers, mis en œuvre selon les normes professionnelles du Règlement n°01/2017/CM/OHADA.",
    "L'attestation est adressée aux actionnaires, vise l'article 525, énonce la responsabilité de la direction et celle du commissaire aux comptes, décrit les diligences et leurs limites, conclut que le montant est exact et concorde avec la comptabilité, mentionne qu'elle tient lieu de la certification requise par l'article et en restreint l'usage à cet objet. Elle est datée et signée par le commissaire aux comptes, le montant figurant en annexe.",
  ],
  sections: [
    facts,
    {
      kind: "proc",
      titleEn: "Part B — Procedures and expected sources",
      titleFr: "Partie B — Procédures et sources attendues",
      introEn:
        "Perform each procedure and record the result, what was obtained and from whom, and the reference of the evidence filed.",
      introFr:
        "Mettre en œuvre chaque procédure et consigner le résultat, ce qui a été obtenu et de qui, et la référence du dossier.",
      procs: [
        P(
          "headcount",
          "Establish the headcount at the closing date from the payroll register and the social declarations, and determine from it whether the article calls for the ten or the five highest-paid persons; record the reading applied in Part A.",
          "Établir l'effectif à la date de clôture à partir du registre du personnel et des déclarations sociales, en déduire si l'article vise les dix ou les cinq personnes les mieux rémunérées, et consigner la lecture retenue en partie A.",
          "Payroll register · social declarations · AUSCGIE art. 525",
          "Registre du personnel · déclarations sociales · AUSCGIE art. 525",
          "The number of persons follows the headcount, not the size of the payroll. Establish the count before asking for the list, so the list is not shaped by what management would prefer to disclose.",
          "Le nombre de personnes découle de l'effectif, non de la masse salariale. Établir l'effectif avant de demander la liste, afin que celle-ci ne soit pas façonnée par ce que la direction préférerait communiquer.",
        ),
        P(
          "statement",
          "Obtain from management its statement of the total remuneration paid to those persons for the year, with the underlying list and amounts per person, signed as established under its responsibility.",
          "Obtenir de la direction sa déclaration du montant global des rémunérations versées à ces personnes au titre de l'exercice, avec la liste et les montants par personne, signée comme établie sous sa responsabilité.",
          "Management's signed statement · list of persons and amounts",
          "Déclaration signée de la direction · liste des personnes et des montants",
        ),
        P(
          "scope",
          "Confirm the scope of remuneration retained is complete — fixed and variable pay, bonuses, benefits in kind, allowances, amounts paid to corporate officers and to persons who are not employees but serve the entity exclusively — and that the persons retained are indeed the highest paid on that basis.",
          "Vérifier que le périmètre des rémunérations retenu est complet — fixe, variable, primes, avantages en nature, indemnités, sommes versées aux dirigeants sociaux et aux personnes non salariées au service exclusif de l'entité — et que les personnes retenues sont bien les mieux rémunérées sur cette base.",
          "Payroll ledger · board and general meeting minutes on officers' remuneration · C5.3 regulated agreements",
          "Livre de paie · procès-verbaux du conseil et de l'assemblée sur la rémunération des dirigeants · C5.3 conventions réglementées",
          "Corporate officers are commonly among the highest paid and are commonly missing from a payroll-only list. Cross-check the officers' remuneration approved in the minutes and any regulated agreement on C5.3.",
          "Les dirigeants sociaux figurent souvent parmi les mieux rémunérés et manquent souvent d'une liste tirée de la seule paie. Recouper la rémunération des dirigeants approuvée dans les procès-verbaux et toute convention réglementée en C5.3.",
        ),
        P(
          "reconcile",
          "Reconcile the total to the accounting from which the financial statements were prepared — the payroll ledger, the personnel-cost accounts and the social declarations — and explain any difference.",
          "Rapprocher le montant global de la comptabilité ayant servi de base aux états financiers — livre de paie, comptes de charges de personnel, déclarations sociales — et expliquer tout écart.",
          "Payroll ledger · general ledger (personnel costs) · social declarations · reconciliation schedule",
          "Livre de paie · grand livre (charges de personnel) · déclarations sociales · tableau de rapprochement",
        ),
        P(
          "consistency",
          "Check the amount is consistent with the personnel-cost disclosures in the notes and with the audited financial statements, and that nothing in the audit file contradicts the list or the total.",
          "Vérifier la cohérence du montant avec les informations sur les charges de personnel dans les notes annexes et avec les états financiers audités, et qu'aucun élément du dossier ne contredit la liste ou le montant.",
          "Notes on personnel costs (E6.10 checklist) · E4 personnel-cost paper · this file",
          "Notes sur les charges de personnel (contrôle E6.10) · papier E4 charges de personnel · le présent dossier",
        ),
        P(
          "draft",
          "Draft the attestation in the form the article and the professional standards call for: addressed to the shareholders; citing article 525; management's responsibility and the auditor's; the audit of the accounts as a whole giving no opinion on these amounts in isolation; the diligences performed and that they are neither an audit nor a limited review; the conclusion that the amount is exact and agrees to the accounting; the sentence that it stands as the certification the article requires; the restriction of use; date, signature, and the amount in an annex.",
          "Rédiger l'attestation dans la forme requise par l'article et les normes professionnelles : adressée aux actionnaires ; visant l'article 525 ; responsabilité de la direction et du commissaire aux comptes ; l'audit des comptes dans leur ensemble n'exprimant aucune opinion sur ces montants isolément ; les diligences mises en œuvre et le fait qu'elles ne constituent ni un audit ni un examen limité ; la conclusion que le montant est exact et concorde avec la comptabilité ; la mention qu'elle tient lieu de la certification requise ; la restriction d'usage ; date, signature et montant en annexe.",
          "Firm's attestation model · Règlement n°01/2017/CM/OHADA · AUSCGIE art. 525",
          "Modèle d'attestation du cabinet · Règlement n°01/2017/CM/OHADA · AUSCGIE art. 525",
        ),
        P(
          "review",
          "Have the attestation and the reconciliation reviewed by the engagement partner before signature, and file the signed attestation on this task.",
          "Faire revoir l'attestation et le rapprochement par l'associé avant signature, et joindre l'attestation signée à cette tâche.",
          "Partner review · signed attestation",
          "Revue de l'associé · attestation signée",
        ),
        P(
          "provide",
          "Make the attestation available to the shareholders with the other documents article 525 lists, within the period before the general meeting, and record the date and manner on C5.2.",
          "Mettre l'attestation à la disposition des actionnaires avec les autres documents visés à l'article 525, dans le délai précédant l'assemblée, et consigner la date et la modalité en C5.2.",
          "C5.2 statutory deadlines calendar · convening documents · AUSCGIE art. 525",
          "C5.2 calendrier des échéances légales · documents de convocation · AUSCGIE art. 525",
        ),
      ],
    },
    {
      kind: "yn",
      titleEn: "Part C — Evaluation",
      titleFr: "Partie C — Évaluation",
      introEn: "Answer each statement from the work above. Explain each 'No' in the box beneath it.",
      introFr: "Répondre à chaque affirmation à partir des travaux ci-dessus. Expliquer chaque « Non ».",
      items: [
        Q("count_right", "The headcount at closing is established from source records, and the number of persons retained — five or ten — follows from it under the article.", "L'effectif à la clôture est établi à partir de pièces sources, et le nombre de personnes retenu — cinq ou dix — en découle conformément à l'article."),
        Q("scope_complete", "The scope of remuneration is complete, including corporate officers and benefits in kind, and the persons retained are the highest paid on that basis.", "Le périmètre des rémunérations est complet, dirigeants sociaux et avantages en nature compris, et les personnes retenues sont les mieux rémunérées sur cette base."),
        Q("reconciled", "The total reconciles to the accounting from which the financial statements were prepared, without unexplained difference.", "Le montant global se rapproche de la comptabilité ayant servi de base aux états financiers, sans écart inexpliqué."),
        Q("consistent", "The amount is consistent with the notes on personnel costs and with the audited financial statements.", "Le montant est cohérent avec les notes sur les charges de personnel et avec les états financiers audités."),
        Q("form_right", "The attestation carries every element the article and the professional standards call for, including the limits of the diligences and the restriction of use.", "L'attestation comporte chaque élément requis par l'article et les normes professionnelles, y compris les limites des diligences et la restriction d'usage."),
        Q("provided", "The signed attestation was made available to the shareholders before the general meeting, and the date is recorded on C5.2.", "L'attestation signée a été mise à la disposition des actionnaires avant l'assemblée, et la date est consignée en C5.2."),
      ],
    },
  ],
  conclEn: [
    "The total remuneration paid to the highest-paid persons, as retained under article 525, is exact and agrees to the accounting from which the financial statements were prepared.",
    "The attestation is in the form the article and the professional standards require and stands as the certification article 525 calls for.",
    "The attestation was made available to the shareholders within the period the article requires.",
  ],
  conclFr: [
    "Le montant global des rémunérations versées aux personnes les mieux rémunérées, tel que retenu au sens de l'article 525, est exact et concorde avec la comptabilité ayant servi de base aux états financiers.",
    "L'attestation est établie dans la forme requise par l'article et les normes professionnelles et tient lieu de la certification prévue à l'article 525.",
    "L'attestation a été mise à la disposition des actionnaires dans le délai prévu par l'article.",
  ],
};

/**
 * Keyed the way the conclusion set keys its papers, so wiring it in is a change
 * of one entry rather than a change of shape.
 */
export const STATUTORY_525_PAPERS: Record<string, PaperDef> = {
  "C5.10": STATUTORY_525_PAPER,
};
