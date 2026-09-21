// C6.1 Archive checklist — the paper behind the board that lists every gate
// between the file and its archive.
//
// C6.1 used to be "Points forward": the matters the next engagement needs to
// know. At the user's request that task became the archive checklist. The
// points themselves are not lost — they are recorded on the Conclusion screen
// as a completion record, which is what the roll-forward reads and carries
// into the next year's file — so nothing the next engagement relied on has
// moved. What changed is what this task is for: it is where a reviewer sees,
// in one place, everything that would still stop the archive.
//
// The board does the counting. The paper records the judgement: that every
// item behind a red gate was either put right or, where it could not be,
// explained — and by whom the archive was decided.
import type { PaperDef } from "@/lib/papers/types";

export const ARCHIVE_CHECKLIST_PAPER: PaperDef = {
  std: "ISA 230 ¶14–16, A21–A24 · ISQM 1 ¶31(f) · ISA 220 (Revised) ¶31",
  ownsEn: "the state of every gate between this file and its archive, and the disposition of every item still behind a failing one",
  ownsFr: "l'état de chaque porte entre ce dossier et son archivage, et le sort de chaque point encore derrière une porte non franchie",
  reqEn: [
    "A file is archived when nothing on it is still open: the report is issued, every completion gate behind C4.1 holds, every task that holds work carries a paper prepared and reviewed, every review note is cleared, the review and approval summary and the documentation checklist are concluded. The board above lists each of those gates, green or red, and behind each red one the items that still stand in the way, each linked to where it is put right. It is computed from the same tests the archive itself applies, so it can never disagree with the engine about what blocks the lock (ISA 230 ¶14–16).",
    "The final file is assembled within sixty days of the report date, and assembly is administrative only: nothing is added by way of new procedure or new conclusion after the report is dated. An item on this board is therefore put right by completing work that was already due, or explained — never by performing new work after the date of the report (ISA 230 A21–A24).",
    "The decision to archive belongs to the engagement partner and is taken on C6.2 once this board is entirely green. From that moment the file is frozen, every member invited to the engagement is told, and the engagement can be found in the archived register and rolled forward into the next year.",
  ],
  reqFr: [
    "Un dossier est archivé lorsque plus rien n'y est ouvert : le rapport est émis, chaque porte d'achèvement derrière C4.1 tient, chaque tâche portant des travaux a un papier préparé et revu, chaque note de revue est levée, le récapitulatif de revue et d'approbation et la liste de documentation sont conclus. Le tableau ci-dessus liste chacune de ces portes, verte ou rouge, et derrière chaque porte rouge les points qui font encore obstacle, chacun relié à l'endroit où il se règle. Il est calculé à partir des mêmes tests que l'archivage lui-même applique, et ne peut donc jamais être en désaccord avec le moteur sur ce qui bloque le verrou (ISA 230 ¶14–16).",
    "Le dossier définitif est assemblé dans les soixante jours de la date du rapport, et l'assemblage est purement administratif : rien n'est ajouté par voie de nouvelle procédure ou de nouvelle conclusion après la date du rapport. Un point de ce tableau se règle donc en achevant un travail déjà dû, ou s'explique — jamais en réalisant de nouveaux travaux après la date du rapport (ISA 230 A21–A24).",
    "La décision d'archiver appartient à l'associé responsable et se prend sur C6.2 une fois ce tableau entièrement vert. Dès lors le dossier est figé, chaque membre invité à la mission en est informé, et la mission se retrouve dans la liste des missions archivées et peut être reconduite sur l'exercice suivant.",
  ],
  sections: [
    {
      kind: "yn",
      titleEn: "Evaluation",
      titleFr: "Évaluation",
      introEn: "Answer from the board above. Explain each 'No' in the box beneath it, naming the items concerned and what was decided about them.",
      introFr: "Répondre d'après le tableau ci-dessus. Expliquer chaque « Non », en nommant les points concernés et ce qui a été décidé à leur sujet.",
      items: [
        {
          key: "all_green",
          en: "Every gate on the board is green, and no item remains behind a failing one.",
          fr: "Chaque porte du tableau est verte, et aucun point ne subsiste derrière une porte non franchie.",
        },
        {
          key: "no_new_work",
          en: "Every item put right since the report date was work already due at that date; no new procedure or conclusion was performed after it.",
          fr: "Chaque point réglé depuis la date du rapport était un travail déjà dû à cette date ; aucune procédure ni conclusion nouvelle n'a été réalisée après.",
        },
        {
          key: "points_recorded",
          en: "The matters the next engagement needs to know are recorded as points forward on the Conclusion screen, so the roll-forward carries them.",
          fr: "Les points utiles à la mission suivante sont consignés en points à reporter sur l'écran Conclusion, afin que la reconduction les emporte.",
        },
        {
          key: "within_sixty",
          en: "The archive falls within sixty days of the report date, or the reason it does not is recorded here.",
          fr: "L'archivage intervient dans les soixante jours de la date du rapport, ou la raison pour laquelle il n'y parvient pas est consignée ici.",
        },
      ],
    },
  ],
  conclEn: [
    "Every gate between this file and its archive holds, and the file can be locked.",
    "Nothing was added to the file after the report date other than assembly.",
  ],
  conclFr: [
    "Chaque porte entre ce dossier et son archivage tient, et le dossier peut être verrouillé.",
    "Rien n'a été ajouté au dossier après la date du rapport hormis l'assemblage.",
  ],
};
