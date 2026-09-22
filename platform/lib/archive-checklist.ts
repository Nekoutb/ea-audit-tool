// The archive checklist: every gate that stands between a file and its archive,
// with every item behind a failing gate named and linked to the place where it
// is put right.
//
// The gates themselves already exist — the completion gates behind C4.1 and
// the archive gates behind the lock — and they are reused here unchanged, so
// this screen can never disagree with the archive itself about what blocks it.
// What they do not carry is the detail: a gate reports a count and, at most,
// twenty codes. A reviewer facing "papers_signed (37)" has a number, not a list.
// This module runs the same questions again for their answers rather than their
// counts, uncapped, and turns each answer into a link to the task, the risk
// register or the conclusion page where it is fixed.
//
// Every gate is shown, green or red, because a reviewer has to see the whole
// wall, not only the holes in it.

import type { PoolClient } from "pg";
import { archiveGates, completionGates, type ArchiveGate } from "@/lib/completion";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import type { GateResult } from "@/lib/gates";

export interface ChecklistItem {
  /** what the reader sees: "E4.2 — Trade payables" or a risk description */
  label: string;
  /** where it is put right */
  href: string;
  /** a file-index code when the item is a task */
  code?: string;
}

export interface ChecklistGate {
  key: string;
  labelEn: string;
  labelFr: string;
  ok: boolean;
  /** how many items stand behind a failing gate (0 when ok) */
  pending: number;
  /** a failing gate always has somewhere to go, even when its items are not itemised */
  href: string;
  /** whether a failure here refuses the archive — every gate below does */
  blocking: boolean;
  items: ChecklistItem[];
}

export interface ChecklistGroup {
  key: "report" | "completion" | "papers" | "review" | "assembly";
  titleEn: string;
  titleFr: string;
  gates: ChecklistGate[];
}

export interface ArchiveChecklist {
  archivedAt: string | null;
  reportDate: string | null;
  /** gates still failing that would refuse the archive */
  blocking: number;
  groups: ChecklistGroup[];
}

interface TaskRef {
  id: string;
  code: string;
  titleEn: string;
  titleFr: string;
}

const LABELS: Record<string, { en: string; fr: string }> = {
  report_issued: { en: "Report issued and dated", fr: "Rapport émis et daté" },
  sections_concluded: { en: "Every worked E-section concluded and reviewed; no program step left planned", fr: "Chaque section E travaillée conclue et revue ; aucune diligence laissée planifiée" },
  risks_concluded: { en: "Every risk concluded, or validly rebutted; mid-audit additions partner-approved", fr: "Chaque risque conclu, ou valablement réfuté ; ajouts en cours de mission approuvés par l'associé" },
  b5_within_materiality: { en: "Uncorrected misstatements within final materiality", fr: "Anomalies non corrigées dans le seuil de signification final" },
  final_analytical_review: { en: "Final analytical review performed (C2.1)", fr: "Revue analytique finale réalisée (C2.1)" },
  fs_tieout_passed: { en: "Financial statement tie-out passed", fr: "Rapprochement des états financiers concluant" },
  disclosure_checklist: { en: "Disclosure checklist completed", fr: "Contrôle des informations à fournir complété" },
  subsequent_events: { en: "Subsequent events reviewed to the report date", fr: "Événements postérieurs revus jusqu'à la date du rapport" },
  rep_letters_generated: { en: "Both representation letters generated (C3.1)", fr: "Les deux lettres d'affirmation générées (C3.1)" },
  b4_cleared: { en: "Every significant matter in C1.2 cleared", fr: "Chaque point significatif de C1.2 levé" },
  partner_conclusion: { en: "Partner overall conclusion and independence reconfirmation (C4.1)", fr: "Conclusion générale de l'associé et reconfirmation d'indépendance (C4.1)" },
  completion_gates: { en: "Every completion gate green", fr: "Toutes les portes d'achèvement au vert" },
  controls_concluded: { en: "Every control selected for testing designed, tested and concluded", fr: "Chaque contrôle retenu pour test conçu, testé et conclu" },
  papers_signed: { en: "Every task holding work has a paper signed by its preparer", fr: "Chaque tâche portant des travaux a un papier signé par son préparateur" },
  reviews_complete: { en: "Every prepared paper carries its review sign-off", fr: "Chaque papier préparé porte sa signature de revue" },
  review_notes_cleared: { en: "Every review note cleared", fr: "Chaque note de revue levée" },
  review_approval: { en: "Review and approval summary concluded (C4.1)", fr: "Récapitulatif de revue et d'approbation conclu (C4.1)" },
  c62_checklist: { en: "Documentation and archive checklist concluded (C6.2)", fr: "Liste de documentation et d'archivage conclue (C6.2)" },
};

const GROUP_OF: Record<string, ChecklistGroup["key"]> = {
  report_issued: "report",
  sections_concluded: "completion", risks_concluded: "completion", b5_within_materiality: "completion",
  final_analytical_review: "completion", fs_tieout_passed: "completion", disclosure_checklist: "completion",
  subsequent_events: "completion", rep_letters_generated: "completion", b4_cleared: "completion",
  partner_conclusion: "completion", completion_gates: "completion",
  controls_concluded: "completion",
  papers_signed: "papers", reviews_complete: "papers",
  review_notes_cleared: "review", review_approval: "review",
  c62_checklist: "assembly",
};

const GROUPS: { key: ChecklistGroup["key"]; titleEn: string; titleFr: string }[] = [
  { key: "report", titleEn: "The report", titleFr: "Le rapport" },
  { key: "completion", titleEn: "Completion of the work", titleFr: "Achèvement des travaux" },
  { key: "papers", titleEn: "Working papers prepared and reviewed", titleFr: "Papiers de travail préparés et revus" },
  { key: "review", titleEn: "Review", titleFr: "Revue" },
  { key: "assembly", titleEn: "Assembly and archive", titleFr: "Assemblage et archivage" },
];

/** The task-level answers behind the gates that count tasks. */
async function itemise(
  tx: PoolClient,
  engagementId: string,
  locale: "en" | "fr",
): Promise<Record<string, ChecklistItem[]>> {
  const base = `/engagements/${engagementId}`;
  const title = (t: TaskRef) => `${t.code} — ${locale === "fr" ? t.titleFr : t.titleEn}`;
  const taskItem = (t: TaskRef): ChecklistItem => ({ label: title(t), href: `${base}/sections/${t.id}`, code: t.code });

  const tasks = await tx.query<{ id: string; code: string; title_en: string; title_fr: string; conditional: boolean }>(
    "SELECT id, code, title_en, title_fr, conditional FROM file_item WHERE engagement_id = $1 ORDER BY sort_order, code",
    [engagementId],
  );
  const refs = new Map(tasks.rows.map((r) => [r.id, { id: r.id, code: r.code, titleEn: r.title_en, titleFr: r.title_fr }]));
  const ref = (id: string): TaskRef | undefined => refs.get(id);

  // The same reading of "holds work", "prepared" and "reviewed" as the gate
  // in lib/completion.ts, kept word for word so the two can never disagree.
  const preparer =
    "EXISTS (SELECT 1 FROM signoff s WHERE s.document_id = d.id AND s.role = 'preparer' AND s.voided_at IS NULL)";
  const reviewer =
    "EXISTS (SELECT 1 FROM signoff s WHERE s.document_id = d.id AND s.role IN ('reviewer', 'partner') AND s.voided_at IS NULL)";
  const papers = await tx.query<{ id: string; worked: boolean; prepared: boolean; reviewed: boolean; half_reviewed: boolean; conditional: boolean }>(
    `SELECT fi.id, fi.conditional,
            (EXISTS (SELECT 1 FROM program_step ps WHERE ps.file_item_id = fi.id AND ps.status <> 'na')
             OR EXISTS (SELECT 1 FROM section_conclusion sc WHERE sc.file_item_id = fi.id)
             OR EXISTS (SELECT 1 FROM document d WHERE d.file_item_id = fi.id AND d.kind IN ('workpaper', 'leadsheet'))
             OR EXISTS (SELECT 1 FROM form_response fr
                         WHERE fr.engagement_id = fi.engagement_id AND fr.code = 'wp:' || fi.code
                           AND btrim(coalesce(fr.value #>> '{}', '')) <> '')) AS worked,
            EXISTS (SELECT 1 FROM document d WHERE d.file_item_id = fi.id AND d.kind IN ('workpaper', 'leadsheet') AND ${preparer}) AS prepared,
            EXISTS (SELECT 1 FROM document d WHERE d.file_item_id = fi.id AND d.kind IN ('workpaper', 'leadsheet') AND ${reviewer}) AS reviewed,
            EXISTS (SELECT 1 FROM document d WHERE d.file_item_id = fi.id AND ${preparer} AND NOT ${reviewer}) AS half_reviewed
       FROM file_item fi WHERE fi.engagement_id = $1`,
    [engagementId],
  );
  const unsigned: ChecklistItem[] = [];
  const unreviewed: ChecklistItem[] = [];
  for (const p of papers.rows) {
    const t = ref(p.id);
    if (!t) continue;
    const owes = !p.conditional && p.worked;
    if (owes && !p.prepared) unsigned.push(taskItem(t));
    if ((owes && !p.reviewed) || p.half_reviewed) unreviewed.push(taskItem(t));
  }

  const unconcluded = await tx.query<{ file_item_id: string; planned: string }>(
    `SELECT ps.file_item_id, count(*) FILTER (WHERE ps.status = 'planned')::text AS planned
       FROM program_step ps
      WHERE ps.engagement_id = $1 AND ps.status <> 'na'
        AND (NOT EXISTS (SELECT 1 FROM section_conclusion sc WHERE sc.file_item_id = ps.file_item_id AND sc.reviewed_by IS NOT NULL)
             OR ps.status = 'planned')
      GROUP BY ps.file_item_id`,
    [engagementId],
  );
  const sections: ChecklistItem[] = unconcluded.rows.flatMap((r) => {
    const t = ref(r.file_item_id);
    if (!t) return [];
    const planned = Number(r.planned);
    const suffix = planned > 0
      ? locale === "fr" ? ` · ${planned} diligence(s) planifiée(s)` : ` · ${planned} step(s) still planned`
      : locale === "fr" ? " · conclusion de section non revue" : " · section conclusion not reviewed";
    return [{ ...taskItem(t), label: title(t) + suffix }];
  });

  const risks = await tx.query<{ id: string; description: string; status: string; rebutted: boolean; added: boolean; approved: boolean }>(
    `SELECT id, description, status, rebutted, added_after_planning AS added, (addition_approved_by IS NOT NULL) AS approved
       FROM risk WHERE engagement_id = $1
        AND ((rebutted = false AND status <> 'concluded') OR (added_after_planning AND addition_approved_by IS NULL))`,
    [engagementId],
  );
  const riskItems: ChecklistItem[] = risks.rows.map((r) => ({
    label: `${r.description}${r.added && !r.approved ? (locale === "fr" ? " · ajout non approuvé" : " · addition not approved") : ""}`,
    href: `${base}/risks`,
  }));

  const controls = await tx.query<{ name: string }>(
    `SELECT c.name FROM scot_control c JOIN scot s ON s.id = c.scot_id
      WHERE s.engagement_id = $1 AND c.selected_for_testing
        AND (c.design_eval IS NULL OR NOT EXISTS (SELECT 1 FROM control_test ct WHERE ct.scot_control_id = c.id))`,
    [engagementId],
  );
  const e12 = tasks.rows.find((t) => t.code === "E1.2");
  const controlItems: ChecklistItem[] = controls.rows.map((c) => ({
    label: c.name,
    href: e12 ? `${base}/sections/${e12.id}` : `${base}/groups/e1`,
  }));

  const notes = await tx.query<{ id: string; body: string; file_item_id: string | null; document_id: string | null }>(
    `SELECT rn.id, left(rn.body, 90) AS body,
            coalesce(rn.file_item_id, d.file_item_id) AS file_item_id, rn.document_id
       FROM review_note rn LEFT JOIN document d ON d.id = rn.document_id
      WHERE rn.status = 'open'
        AND coalesce(d.engagement_id, rn.engagement_id, (SELECT engagement_id FROM file_item WHERE id = rn.file_item_id)) = $1`,
    [engagementId],
  );
  const noteItems: ChecklistItem[] = notes.rows.map((n) => {
    const t = n.file_item_id ? ref(n.file_item_id) : undefined;
    return {
      label: t ? `${t.code} — ${n.body}` : n.body,
      href: t ? `${base}/sections/${t.id}` : `${base}/tools/review-notes`,
      code: t?.code,
    };
  });


  const findings = await tx.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM finding WHERE engagement_id = $1 AND route = 'b4' AND status = 'open'",
    [engagementId],
  );
  const findingItems: ChecklistItem[] = Number(findings.rows[0]?.n ?? 0) > 0
    ? [{ label: locale === "fr" ? `${findings.rows[0].n} point(s) significatif(s) ouvert(s) en C1.2` : `${findings.rows[0].n} open significant matter(s) in C1.2`, href: `${base}/findings` }]
    : [];

  const byCode = (code: string) => tasks.rows.find((t) => t.code === code);
  const link = (code: string, fallback: string) => {
    const t = byCode(code);
    return t ? `${base}/sections/${t.id}` : fallback;
  };

  return {
    papers_signed: unsigned,
    reviews_complete: unreviewed,
    sections_concluded: sections,
    risks_concluded: riskItems,
    controls_concluded: controlItems,
    review_notes_cleared: noteItems,
    b4_cleared: findingItems,
    // Single-destination gates: the item is the place itself.
    review_approval: [{ label: locale === "fr" ? "C4.1 — récapitulatif de revue et d'approbation" : "C4.1 — review and approval summary", href: link("C4.1", `${base}/groups/c4`), code: "C4.1" }],
    c62_checklist: [{ label: locale === "fr" ? "C6.2 — documentation et archivage" : "C6.2 — documentation and archive", href: link("C6.2", `${base}/groups/c6`), code: "C6.2" }],
  };
}

const HREF_OF = (engagementId: string): Record<string, string> => {
  const base = `/engagements/${engagementId}`;
  return {
    report_issued: `${base}/conclusion`,
    sections_concluded: `${base}/phase/E`,
    risks_concluded: `${base}/risks`,
    b5_within_materiality: `${base}/findings`,
    final_analytical_review: `${base}/conclusion`,
    fs_tieout_passed: `${base}/conclusion`,
    disclosure_checklist: `${base}/conclusion`,
    subsequent_events: `${base}/conclusion`,
    rep_letters_generated: `${base}/conclusion`,
    b4_cleared: `${base}/findings`,
    partner_conclusion: `${base}/conclusion`,
    completion_gates: `${base}/conclusion`,
    controls_concluded: `${base}/groups/e1`,
    papers_signed: `${base}/dashboard`,
    reviews_complete: `${base}/dashboard`,
    review_notes_cleared: `${base}/tools/review-notes`,
    review_approval: `${base}/groups/c4`,
    c62_checklist: `${base}/groups/c6`,
  };
};

/**
 * Every gate, in the order a reviewer reads them, each carrying the items that
 * still stand behind it. The gates come from the same functions the archive
 * itself calls; the items come from the same questions asked for their answers.
 */
export async function archiveChecklist(engagementId: string, locale: "en" | "fr"): Promise<ArchiveChecklist> {
  const { tenantId } = await requireTenant();
  const [completion, archive] = await Promise.all([completionGates(engagementId), archiveGates(engagementId)]);

  const { archivedAt, reportDate, items } = await withTenant(tenantId, async (tx) => {
    const e = await tx.query<{ archived_at: string | null; report_date: string | null }>(
      "SELECT archived_at::text, report_date::text FROM engagement WHERE id = $1",
      [engagementId],
    );
    return { archivedAt: e.rows[0]?.archived_at ?? null, reportDate: e.rows[0]?.report_date ?? null, items: await itemise(tx, engagementId, locale) };
  });

  const hrefs = HREF_OF(engagementId);
  const gate = (g: GateResult | ArchiveGate): ChecklistGate => {
    const label = LABELS[g.key] ?? { en: g.key, fr: g.key };
    const own = items[g.key] ?? [];
    const pending = "pending" in g ? g.pending : own.length;
    return {
      key: g.key,
      labelEn: label.en,
      labelFr: label.fr,
      ok: g.ok,
      pending: g.ok ? 0 : Math.max(pending, own.length),
      href: hrefs[g.key] ?? `/engagements/${engagementId}/conclusion`,
      blocking: true,
      // Behind a green gate the list is noise; behind a red one it is the point.
      items: g.ok ? [] : own,
    };
  };

  // The archive gate "completion_gates" folds the completion gates into one
  // line; the reader wants them unfolded, so they are listed in its place.
  const all: ChecklistGate[] = [];
  for (const g of archive) {
    if (g.key === "completion_gates") {
      for (const c of completion) all.push(gate(c));
    } else {
      all.push(gate(g));
    }
  }

  const groups: ChecklistGroup[] = GROUPS.map((gr) => ({
    key: gr.key,
    titleEn: gr.titleEn,
    titleFr: gr.titleFr,
    gates: all.filter((g) => (GROUP_OF[g.key] ?? "completion") === gr.key),
  })).filter((gr) => gr.gates.length > 0);

  return {
    archivedAt,
    reportDate,
    blocking: all.filter((g) => !g.ok && g.blocking).length,
    groups,
  };
}
