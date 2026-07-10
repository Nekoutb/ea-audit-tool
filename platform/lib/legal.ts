// Phase 8: OHADA legal module (spec §12) — F1 statutory deadlines calendar,
// F2 conventions réglementées + rapport spécial, F3 article 715 report,
// F5 faits délictueux + signalement letters, F6 titres attestation,
// F7 equity < ½ share-capital monitoring. Article numbers follow the OHADA
// practice guide; verify against the current revised AUSCGIE before relying
// on them in production (spec §12 caveat).

import { createHash } from "node:crypto";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { PoolClient } from "pg";
import { letterheadFooter, letterheadParagraphs, loadBranding } from "@/lib/branding";
import { withTenant } from "@/lib/db";
import { DOCX_MIME } from "@/lib/documents";
import type { Locale } from "@/lib/i18n";
import { mandateExpiryYear } from "@/lib/letters";
import { createNotification } from "@/lib/notifications";
import { canPartnerSignoff } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";

export class LegalError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "LegalError";
  }
}

// ---- date helpers (statutory arithmetic on YYYY-MM-DD strings) ----

/** Add months clamping to the target month's last day (Dec 31 + 4 → Apr 30). */
export function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const targetMonth = m - 1 + months;
  const lastDay = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(y, targetMonth, Math.min(d, lastDay)));
  return date.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ---- shared: file a generated .docx under an F-section file item ----

export async function fileUnderCode(
  tx: PoolClient,
  args: {
    tenantId: string;
    userId: string;
    engagementId: string;
    code: string;
    title: string;
    kind: "letter" | "report";
    content: Buffer;
    note: string;
    locale?: Locale;
  },
): Promise<string> {
  const item = await tx.query<{ id: string }>(
    "SELECT id FROM file_item WHERE engagement_id = $1 AND code = $2",
    [args.engagementId, args.code],
  );
  if (!item.rows[0]) throw new LegalError("not-found");

  let documentId: string;
  const existing = await tx.query<{ id: string }>(
    "SELECT id FROM document WHERE file_item_id = $1 AND kind = $2 AND title = $3 LIMIT 1",
    [item.rows[0].id, args.kind, args.title],
  );
  if (existing.rows[0]) {
    documentId = existing.rows[0].id;
  } else {
    const created = await tx.query<{ id: string }>(
      `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [args.tenantId, args.engagementId, item.rows[0].id, args.title, args.locale ?? "fr", args.kind, args.userId],
    );
    documentId = created.rows[0].id;
  }
  const next = await tx.query<{ v: number }>(
    "SELECT coalesce(max(version_no), 0) + 1 AS v FROM document_version WHERE document_id = $1",
    [documentId],
  );
  await tx.query(
    `INSERT INTO document_version
       (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      args.tenantId, documentId, next.rows[0].v, DOCX_MIME, args.content.length,
      createHash("sha256").update(args.content).digest("hex"), args.content, args.note, args.userId,
    ],
  );
  await tx.query("UPDATE document SET current_version = $2 WHERE id = $1", [documentId, next.rows[0].v]);
  return documentId;
}

const p = (text: string, bold = false): Paragraph =>
  new Paragraph({ children: [new TextRun({ text, bold })] });
const h = (text: string): Paragraph =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const title = (text: string): Paragraph =>
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(text)] });

// ---- F1: statutory deadlines calendar (spec §12.1) ----

export interface DeadlineInfo {
  key: string;
  dueDate: string;
  basis: string;
  done: boolean;
  daysLeft: number;
}

interface EngagementLegalRow {
  period_end: string;
  agm_date: string | null;
  report_date: string | null;
  legal_form: string;
  share_capital: string | null;
  co_cac: boolean;
  mandate_type: "statutes" | "ago" | null;
  mandate_start_year: number | null;
  client_name: string;
  fiscal_year: number;
}

async function loadLegalContext(tx: PoolClient, engagementId: string): Promise<EngagementLegalRow> {
  const result = await tx.query<EngagementLegalRow>(
    `SELECT to_char(e.period_end, 'YYYY-MM-DD') AS period_end,
            to_char(e.agm_date, 'YYYY-MM-DD') AS agm_date,
            to_char(e.report_date, 'YYYY-MM-DD') AS report_date,
            c.legal_form, c.share_capital::text, c.co_cac, c.mandate_type,
            c.mandate_start_year, c.name AS client_name, e.fiscal_year
       FROM engagement e JOIN client c ON c.id = e.client_id
      WHERE e.id = $1`,
    [engagementId],
  );
  if (!result.rows[0]) throw new LegalError("not-found");
  return result.rows[0];
}

/**
 * (Re)generate the F1 calendar from period-end / AGM / report dates. Upserts
 * by key so regeneration follows date changes without losing done-marks.
 */
export async function generateDeadlines(engagementId: string): Promise<DeadlineInfo[]> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const e = await loadLegalContext(tx, engagementId);
    const rows: { key: string; due: string; basis: string }[] = [
      { key: "fs_arrete", due: addMonthsClamped(e.period_end, 4), basis: "AUDCIF art. 23 — FS arrêtés ≤ 4 mois" },
      { key: "continuing_conventions_notice", due: addMonthsClamped(e.period_end, 1), basis: "Art. 438 al. 2 — conventions courantes notifiées ≤ 1 mois de la clôture" },
      { key: "ago", due: addMonthsClamped(e.period_end, 6), basis: "Art. 72 — AGO ≤ 6 mois de la clôture" },
    ];
    if (e.agm_date) {
      rows.push(
        { key: "docs_to_cac", due: addDaysIso(e.agm_date, -45), basis: "Art. 71 — documents au CAC ≥ 45 jours avant l'AGO" },
        { key: "cac_report_shareholders", due: addDaysIso(e.agm_date, -15), basis: "Rapport du CAC aux actionnaires ≥ 15 jours avant l'AGM (à défaut : rapport de carence)" },
        { key: "rapport_special_deposit", due: addDaysIso(e.agm_date, -15), basis: "Art. 442 — dépôt du rapport spécial au siège ≥ 15 jours avant l'AGO" },
      );
    }
    if (e.report_date) {
      rows.push({ key: "file_assembly", due: addDaysIso(e.report_date, 60), basis: "ISA 230 — assemblage du dossier ≤ 60 jours du rapport" });
    }
    if (e.mandate_type && e.mandate_start_year) {
      rows.push({
        key: "mandate_expiry",
        due: `${mandateExpiryYear(e.mandate_type, e.mandate_start_year)}-12-31`,
        basis: "Art. 704 — expiration du mandat (2/6 exercices)",
      });
    }
    for (const row of rows) {
      await tx.query(
        `INSERT INTO statutory_deadline (tenant_id, engagement_id, key, due_date, basis)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (engagement_id, key) DO UPDATE SET due_date = EXCLUDED.due_date, basis = EXCLUDED.basis`,
        [tenantId, engagementId, row.key, row.due, row.basis],
      );
    }
  });
  await escalateOverdue(engagementId);
  return listDeadlines(engagementId);
}

export async function listDeadlines(engagementId: string): Promise<DeadlineInfo[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ key: string; due_date: string; basis: string; done: boolean; days_left: number }>(
      `SELECT key, to_char(due_date, 'YYYY-MM-DD') AS due_date, basis, done,
              (due_date - CURRENT_DATE)::int AS days_left
         FROM statutory_deadline WHERE engagement_id = $1 ORDER BY due_date`,
      [engagementId],
    );
    return result.rows.map((row) => ({
      key: row.key, dueDate: row.due_date, basis: row.basis, done: row.done, daysLeft: row.days_left,
    }));
  });
}

export async function markDeadlineDone(engagementId: string, key: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      "UPDATE statutory_deadline SET done = true, done_at = now() WHERE engagement_id = $1 AND key = $2",
      [engagementId, key],
    );
  });
}

/** Escalation: overdue undone deadlines notify every engagement partner. */
export async function escalateOverdue(engagementId: string): Promise<number> {
  const { tenantId } = await requireTenant();
  const { overdue, partners } = await withTenant(tenantId, async (tx) => {
    const overdueRows = await tx.query<{ key: string; due_date: string }>(
      `SELECT key, to_char(due_date, 'YYYY-MM-DD') AS due_date
         FROM statutory_deadline
        WHERE engagement_id = $1 AND done = false AND due_date < CURRENT_DATE`,
      [engagementId],
    );
    const partnerRows = await tx.query<{ user_id: string }>(
      "SELECT user_id FROM team_member WHERE engagement_id = $1 AND team_role = 'partner'",
      [engagementId],
    );
    return { overdue: overdueRows.rows, partners: partnerRows.rows };
  });
  for (const deadline of overdue) {
    for (const partner of partners) {
      await createNotification({
        tenantId,
        userId: partner.user_id,
        kind: "deadline-overdue",
        title: `Statutory deadline overdue: ${deadline.key}`,
        body: `Due ${deadline.due_date} — engagement ${engagementId}.`,
      });
    }
  }
  return overdue.length;
}

// ---- F2: conventions réglementées register + rapport spécial (spec §12.2) ----

export const CONVENTION_CAPACITIES = [
  "director", "gerant", "shareholder10", "president", "dirigeant", "controlling",
] as const;
export type ConventionCapacity = (typeof CONVENTION_CAPACITIES)[number];

export interface ConventionInfo {
  id: string;
  parties: string;
  interested: string;
  capacity: ConventionCapacity;
  nature: string;
  terms: string;
  amountsPeriod: number | null;
  continuing: boolean;
  boardAuthRef: string | null;
  notifiedAt: string | null;
  /** SA only (art. 447): no prior board authorization → curable nullity. */
  unauthorized: boolean;
}

export async function addConvention(
  engagementId: string,
  input: {
    parties: string;
    interested: string;
    capacity: ConventionCapacity;
    nature: string;
    terms?: string;
    amountsPeriod?: number;
    continuing?: boolean;
    boardAuthRef?: string;
    notifiedAt?: string;
  },
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  if (!input.parties.trim() || !input.interested.trim() || !input.nature.trim()) {
    throw new LegalError("fields-required");
  }
  if (!CONVENTION_CAPACITIES.includes(input.capacity)) throw new LegalError("invalid-capacity");
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string }>(
      `INSERT INTO convention
         (tenant_id, engagement_id, parties, interested, capacity, nature, terms,
          amounts_period, continuing, board_auth_ref, notified_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        tenantId, engagementId, input.parties, input.interested, input.capacity,
        input.nature, input.terms ?? "", input.amountsPeriod ?? null,
        input.continuing ?? false, input.boardAuthRef || null, input.notifiedAt || null, userId,
      ],
    );
    return result.rows[0].id;
  });
}

export async function listConventions(
  engagementId: string,
): Promise<{ legalForm: string; conventions: ConventionInfo[] }> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const e = await loadLegalContext(tx, engagementId);
    const result = await tx.query<{
      id: string; parties: string; interested: string; capacity: ConventionCapacity;
      nature: string; terms: string; amounts_period: string | null; continuing: boolean;
      board_auth_ref: string | null; notified_at: string | null;
    }>(
      `SELECT id, parties, interested, capacity, nature, terms, amounts_period::text,
              continuing, board_auth_ref, to_char(notified_at, 'YYYY-MM-DD') AS notified_at
         FROM convention WHERE engagement_id = $1 ORDER BY created_at`,
      [engagementId],
    );
    return {
      legalForm: e.legal_form,
      conventions: result.rows.map((row) => ({
        id: row.id, parties: row.parties, interested: row.interested, capacity: row.capacity,
        nature: row.nature, terms: row.terms,
        amountsPeriod: row.amounts_period === null ? null : Number(row.amounts_period),
        continuing: row.continuing, boardAuthRef: row.board_auth_ref, notifiedAt: row.notified_at,
        unauthorized: e.legal_form === "SA" && !row.board_auth_ref,
      })),
    };
  });
}

const CAPACITY_FR: Record<ConventionCapacity, string> = {
  director: "administrateur",
  gerant: "gérant",
  shareholder10: "actionnaire détenant ≥ 10 %",
  president: "président",
  dirigeant: "dirigeant",
  controlling: "société contrôlante",
};

/** 8.3: build the rapport spécial from the register (arts. 353/440/442). */
export async function generateRapportSpecial(engagementId: string): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const e = await loadLegalContext(tx, engagementId);
    const { conventions } = await (async () => {
      const rows = await tx.query<{
        parties: string; interested: string; capacity: ConventionCapacity; nature: string;
        terms: string; amounts_period: string | null; continuing: boolean; board_auth_ref: string | null;
      }>(
        `SELECT parties, interested, capacity, nature, terms, amounts_period::text, continuing, board_auth_ref
           FROM convention WHERE engagement_id = $1 ORDER BY created_at`,
        [engagementId],
      );
      return { conventions: rows.rows };
    })();

    const branding = await loadBranding(tx, tenantId);
    const children: Paragraph[] = [
      ...letterheadParagraphs(branding),
      title("Rapport spécial du commissaire aux comptes sur les conventions réglementées"),
      p(`${e.client_name} — Exercice clos le 31 décembre ${e.fiscal_year}`, true),
      p(
        "En notre qualité de commissaire aux comptes, nous vous présentons notre rapport sur les conventions réglementées dont nous avons été avisés, conformément aux dispositions de l'Acte uniforme relatif au droit des sociétés commerciales et du GIE.",
      ),
    ];
    if (conventions.length === 0) {
      children.push(
        h("Absence de convention"),
        p("Nous vous informons qu'il ne nous a été donné avis d'aucune convention réglementée conclue ou poursuivie au cours de l'exercice."),
      );
    } else {
      children.push(h("Conventions soumises à l'approbation de l'assemblée"));
      conventions.forEach((convention, index) => {
        children.push(
          p(`Convention ${index + 1} — ${convention.nature}`, true),
          p(`Parties : ${convention.parties}. Personne intéressée : ${convention.interested} (${CAPACITY_FR[convention.capacity]}).`),
          p(`Modalités essentielles : ${convention.terms || "—"}.`),
        );
        if (convention.continuing) {
          children.push(
            p(`Convention poursuivie — montants comptabilisés au titre de l'exercice : ${convention.amounts_period ?? "—"} FCFA.`),
          );
        }
        children.push(
          convention.board_auth_ref
            ? p(`Autorisation préalable du conseil d'administration : ${convention.board_auth_ref}.`)
            : e.legal_form === "SA"
              ? p("ATTENTION : convention non autorisée préalablement par le conseil — nullité encourue, couvrable par un vote spécial de l'assemblée sur rapport explicatif du commissaire aux comptes (art. 447).", true)
              : p("Autorisation préalable non requise pour cette forme sociale (arts. 350-353 / 853.14)."),
        );
      });
    }
    children.push(
      p("Le présent rapport est déposé au siège social quinze jours au moins avant la réunion de l'assemblée générale ordinaire (art. 442).", false),
      ...letterheadFooter(branding),
    );

    const content = await Packer.toBuffer(new Document({ sections: [{ children }] }));
    return fileUnderCode(tx, {
      tenantId, userId, engagementId, code: "F2",
      title: `Rapport spécial conventions — ${e.fiscal_year}`,
      kind: "report", content, note: "legal:rapport-special",
    });
  });
}

// ---- F3: article 715 report to the board (spec §12.3) ----

export async function generateArticle715Report(engagementId: string): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const e = await loadLegalContext(tx, engagementId);

    const steps = await tx.query<{ total: string; complete: string; na: string }>(
      `SELECT count(*)::text AS total,
              count(*) FILTER (WHERE status = 'complete')::text AS complete,
              count(*) FILTER (WHERE status = 'na')::text AS na
         FROM program_step WHERE engagement_id = $1`,
      [engagementId],
    );
    const conclusions = await tx.query<{ code: string; conclusion: string }>(
      `SELECT fi.code, sc.conclusion
         FROM section_conclusion sc JOIN file_item fi ON fi.id = sc.file_item_id
        WHERE sc.engagement_id = $1 ORDER BY fi.code`,
      [engagementId],
    );
    const adjustments = await tx.query<{ description: string; accounts: string | null; amount: string }>(
      `SELECT description, accounts, amount::text FROM misstatement
        WHERE engagement_id = $1 AND trivial = false AND corrected = false ORDER BY created_at`,
      [engagementId],
    );
    const c1Points = await tx.query<{ title: string; detail: string | null }>(
      "SELECT title, detail FROM finding WHERE engagement_id = $1 AND route = 'c1' ORDER BY created_at",
      [engagementId],
    );
    const irregularities = await tx.query<{ title: string }>(
      "SELECT title FROM finding WHERE engagement_id = $1 AND route = 'b4' AND status = 'open' ORDER BY created_at",
      [engagementId],
    );
    // Results current vs prior year: résultat = -(classes 6+7+8 closings).
    const results = await tx.query<{ fiscal_year: number; result: string }>(
      `SELECT e2.fiscal_year,
              coalesce(-sum(r.opening_debit - r.opening_credit + r.debit - r.credit)
                        FILTER (WHERE r.account_code ~ '^[678]'), 0)::text AS result
         FROM engagement e1
         JOIN engagement e2 ON e2.client_id = e1.client_id
                            AND e2.fiscal_year IN (e1.fiscal_year, e1.fiscal_year - 1)
         LEFT JOIN trial_balance tb ON tb.engagement_id = e2.id
         LEFT JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
         LEFT JOIN trial_balance_row r ON r.version_id = v.id
        WHERE e1.id = $1
        GROUP BY e2.fiscal_year ORDER BY e2.fiscal_year`,
      [engagementId],
    );
    const current = results.rows.find((row) => row.fiscal_year === e.fiscal_year);
    const prior = results.rows.find((row) => row.fiscal_year === e.fiscal_year - 1);

    const branding = await loadBranding(tx, tenantId);
    const children: Paragraph[] = [
      ...letterheadParagraphs(branding),
      title("Rapport du commissaire aux comptes au conseil d'administration (art. 715)"),
      p(`${e.client_name} — Exercice clos le 31 décembre ${e.fiscal_year}`, true),
      h("1. Contrôles et vérifications effectués et sondages opérés"),
      p(
        `Diligences du programme de travail : ${steps.rows[0].complete} étapes réalisées et ${steps.rows[0].na} jugées non applicables sur ${steps.rows[0].total} planifiées.`,
      ),
      ...conclusions.rows.map((row) => p(`Section ${row.code} : ${row.conclusion}`)),
      h("2. Postes du bilan et documents comptables appelant des modifications"),
      ...(adjustments.rows.length === 0
        ? [p("Aucun ajustement proposé demeurant non corrigé à la date du présent rapport.")]
        : adjustments.rows.map((row) =>
            p(`${row.description}${row.accounts ? ` (comptes ${row.accounts})` : ""} — ${row.amount} FCFA.`),
          )),
      ...c1Points.rows.map((row) => p(`Observation sur les méthodes : ${row.title}${row.detail ? ` — ${row.detail}` : ""}`)),
      h("3. Irrégularités et inexactitudes découvertes"),
      ...(irregularities.rows.length === 0
        ? [p("Néant.")]
        : irregularities.rows.map((row) => p(row.title))),
      h("4. Conclusions sur les résultats de l'exercice comparés au précédent"),
      p(
        `Résultat de l'exercice ${e.fiscal_year} : ${current?.result ?? "n/d"} FCFA ; exercice ${e.fiscal_year - 1} : ${prior?.result ?? "n/d"} FCFA.`,
      ),
      ...letterheadFooter(branding),
    ];

    const content = await Packer.toBuffer(new Document({ sections: [{ children }] }));
    return fileUnderCode(tx, {
      tenantId, userId, engagementId, code: "F3",
      title: `Rapport art. 715 — ${e.fiscal_year}`,
      kind: "report", content, note: "legal:art715",
    });
  });
}

// ---- F5: révélation des faits délictueux + signalement (spec §12.5.6) ----

export interface FaitInfo {
  id: string;
  description: string;
  documentId: string | null;
  revealedAt: string;
}

/** Partner-only: reveal to the ministère public (art. 716) + confidential log. */
export async function revealFait(engagementId: string, description: string): Promise<string> {
  const { tenantId, userId, role } = await requireTenant();
  if (!canPartnerSignoff(role)) throw new LegalError("forbidden");
  if (!description.trim()) throw new LegalError("fields-required");
  return withTenant(tenantId, async (tx) => {
    const e = await loadLegalContext(tx, engagementId);
    const branding = await loadBranding(tx, tenantId);
    const children = [
      ...letterheadParagraphs(branding),
      title("Révélation de faits délictueux au ministère public (art. 716)"),
      p(`${e.client_name} — Exercice ${e.fiscal_year}`, true),
      p(
        "Monsieur le Procureur de la République, en application de l'article 716 de l'Acte uniforme relatif au droit des sociétés commerciales et du GIE, nous portons à votre connaissance les faits délictueux suivants dont nous avons eu connaissance dans l'exercice de notre mission, sans que notre responsabilité puisse être engagée par cette révélation :",
      ),
      p(description),
      p("Le commissaire aux comptes.", true),
      ...letterheadFooter(branding),
    ];
    const content = await Packer.toBuffer(new Document({ sections: [{ children }] }));
    const documentId = await fileUnderCode(tx, {
      tenantId, userId, engagementId, code: "F5",
      title: `Révélation faits délictueux — ${e.fiscal_year}`,
      kind: "letter", content, note: "legal:fait-delictueux",
    });
    await tx.query(
      `INSERT INTO fait_delictueux (tenant_id, engagement_id, description, document_id, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, engagementId, description, documentId, userId],
    );
    return documentId;
  });
}

/** Partner-only read (strict access control per spec §12.5.6). */
export async function listFaits(engagementId: string): Promise<FaitInfo[]> {
  const { tenantId, role } = await requireTenant();
  if (!canPartnerSignoff(role)) throw new LegalError("forbidden");
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string; description: string; document_id: string | null; revealed_at: string;
    }>(
      `SELECT id, description, document_id, to_char(revealed_at, 'YYYY-MM-DD') AS revealed_at
         FROM fait_delictueux WHERE engagement_id = $1 ORDER BY revealed_at`,
      [engagementId],
    );
    return result.rows.map((row) => ({
      id: row.id, description: row.description, documentId: row.document_id, revealedAt: row.revealed_at,
    }));
  });
}

/** Irregularities signalement letter to the AG or the board (art. 716). */
export async function generateIrregularitiesLetter(
  engagementId: string,
  target: "ag" | "board",
  points: string,
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  if (!points.trim()) throw new LegalError("fields-required");
  return withTenant(tenantId, async (tx) => {
    const e = await loadLegalContext(tx, engagementId);
    const audience = target === "ag" ? "à la plus proche assemblée générale" : "au conseil d'administration";
    const branding = await loadBranding(tx, tenantId);
    const children = [
      ...letterheadParagraphs(branding),
      title(`Signalement d'irrégularités et d'inexactitudes ${audience}`),
      p(`${e.client_name} — Exercice ${e.fiscal_year}`, true),
      p("Conformément à l'article 716 de l'AUSCGIE, nous signalons les irrégularités et inexactitudes relevées au cours de l'accomplissement de notre mission :"),
      p(points),
      p("Le commissaire aux comptes.", true),
      ...letterheadFooter(branding),
    ];
    const content = await Packer.toBuffer(new Document({ sections: [{ children }] }));
    return fileUnderCode(tx, {
      tenantId, userId, engagementId, code: "F5",
      title: target === "ag" ? `Signalement AG — ${e.fiscal_year}` : `Signalement conseil — ${e.fiscal_year}`,
      kind: "letter", content, note: `legal:irregularites-${target}`,
    });
  });
}

// ---- F6: attestation registres de titres nominatifs (art. 746-2) ----

export async function generateTitresAttestation(engagementId: string): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const e = await loadLegalContext(tx, engagementId);
    const branding = await loadBranding(tx, tenantId);
    const children = [
      ...letterheadParagraphs(branding),
      title("Attestation sur les registres de titres nominatifs (art. 746-2)"),
      p(`${e.client_name} — Exercice clos le 31 décembre ${e.fiscal_year}`, true),
      p(
        "Nous avons procédé à la vérification de l'existence et de la conformité des registres de titres nominatifs tenus par la société : existence matérielle des registres, tenue chronologique des inscriptions, concordance avec les mouvements de titres portés à notre connaissance.",
      ),
      p(
        "Sur la base de nos travaux, nous attestons que les registres de titres nominatifs sont tenus conformément aux dispositions applicables.",
      ),
      h("Annexe — Déclaration de la direction"),
      p(
        "La direction déclare que les registres de titres nominatifs présentés au commissaire aux comptes sont complets, à jour, et retracent l'intégralité des mouvements de titres intervenus au cours de l'exercice.",
      ),
      p("Signatures : le représentant légal · le commissaire aux comptes", true),
      ...letterheadFooter(branding),
    ];
    const content = await Packer.toBuffer(new Document({ sections: [{ children }] }));
    return fileUnderCode(tx, {
      tenantId, userId, engagementId, code: "F6",
      title: `Attestation titres nominatifs — ${e.fiscal_year}`,
      kind: "report", content, note: "legal:titres-attestation",
    });
  });
}

// ---- F7: equity < half of share capital (spec §12.5.9) ----

export interface EquityCheck {
  equity: number;
  shareCapital: number | null;
  halfCapital: number | null;
  breach: boolean;
  hasTb: boolean;
}

/**
 * Capitaux propres from the current TB (accounts 10-15 plus the unposted
 * result from classes 6/7/8) vs half of the share capital. A breach raises
 * the statutory EGM deadline (SA arts. 664-669; SARL arts. 371-373) and
 * notifies the engagement partners.
 */
export async function equityCheck(engagementId: string): Promise<EquityCheck> {
  const { tenantId } = await requireTenant();
  const check = await withTenant(tenantId, async (tx) => {
    const e = await loadLegalContext(tx, engagementId);
    const totals = await tx.query<{ equity: string | null; result: string | null; rows: string }>(
      `SELECT -sum(r.opening_debit - r.opening_credit + r.debit - r.credit)
                FILTER (WHERE r.account_code ~ '^1[0-5]') AS equity,
              -sum(r.opening_debit - r.opening_credit + r.debit - r.credit)
                FILTER (WHERE r.account_code ~ '^[678]') AS result,
              count(*)::text AS rows
         FROM trial_balance tb
         JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
         JOIN trial_balance_row r ON r.version_id = v.id
        WHERE tb.engagement_id = $1`,
      [engagementId],
    );
    const hasTb = Number(totals.rows[0]?.rows ?? 0) > 0;
    const equity = Number(totals.rows[0]?.equity ?? 0) + Number(totals.rows[0]?.result ?? 0);
    const shareCapital = e.share_capital === null ? null : Number(e.share_capital);
    const halfCapital = shareCapital === null ? null : shareCapital / 2;
    const breach = hasTb && halfCapital !== null && equity < halfCapital;
    if (breach) {
      const basisDate = e.agm_date ?? addMonthsClamped(e.period_end, 6);
      await tx.query(
        `INSERT INTO statutory_deadline (tenant_id, engagement_id, key, due_date, basis)
         VALUES ($1, $2, 'egm_equity', $3, $4)
         ON CONFLICT (engagement_id, key) DO UPDATE SET due_date = EXCLUDED.due_date, basis = EXCLUDED.basis`,
        [
          tenantId, engagementId, addMonthsClamped(basisDate, 4),
          "Capitaux propres < ½ capital — AGE ≤ 4 mois de l'approbation des comptes déficitaires (SA arts. 664-669 ; SARL arts. 371-373)",
        ],
      );
    }
    return { equity, shareCapital, halfCapital, breach, hasTb };
  });
  if (check.breach) {
    const partners = await withTenant(tenantId, async (tx) => {
      const rows = await tx.query<{ user_id: string }>(
        "SELECT user_id FROM team_member WHERE engagement_id = $1 AND team_role = 'partner'",
        [engagementId],
      );
      return rows.rows;
    });
    for (const partner of partners) {
      await createNotification({
        tenantId,
        userId: partner.user_id,
        kind: "equity-breach",
        title: "Capitaux propres < ½ capital social",
        body: `Equity ${check.equity} vs half capital ${check.halfCapital} — statutory EGM workflow raised (F7).`,
      });
    }
  }
  return check;
}

/** Client share capital used by the F7 monitor. */
export async function setShareCapital(engagementId: string, amount: number): Promise<void> {
  const { tenantId } = await requireTenant();
  if (!Number.isFinite(amount) || amount <= 0) throw new LegalError("invalid-amount");
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      "UPDATE client SET share_capital = $2 WHERE id = (SELECT client_id FROM engagement WHERE id = $1)",
      [engagementId, amount],
    );
    if (updated.rowCount === 0) throw new LegalError("not-found");
  });
}
