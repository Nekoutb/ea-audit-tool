// Phase 6: third-party circularisations (ISA 505, spec §11.3).
// Selection from imported datasets with preset criteria, bilingual letter
// generation per confirmation type, dispatch with unique reply tokens and
// reminders, reply evaluation (difference → disposition; client error → B5),
// alternative procedures for non-replies, and an auto-produced summary
// working paper (coverage %, results).

import { createHash, randomBytes } from "node:crypto";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import ExcelJS from "exceljs";
import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { DOCX_MIME } from "@/lib/documents";
import { sendEmail } from "@/lib/email";
import { routeFinding } from "@/lib/execution";
import type { Locale } from "@/lib/i18n";
import { requireTenant } from "@/lib/tenant";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class ConfirmationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ConfirmationError";
  }
}

export type ConfirmationType =
  | "ar_positive"
  | "ar_negative"
  | "ap"
  | "bank"
  | "legal"
  | "related_party"
  | "inventory_third_party";

export const CONFIRMATION_TYPES: readonly ConfirmationType[] = [
  "ar_positive", "ar_negative", "ap", "bank", "legal", "related_party", "inventory_third_party",
];

/** A1: subject-type coverage (ISA engine §05, module A1). */
export type ConfirmationSubject =
  | "bank" | "receivable" | "payable" | "inventory_third_party" | "legal" | "lender";

export const CONFIRMATION_SUBJECTS: readonly ConfirmationSubject[] = [
  "bank", "receivable", "payable", "inventory_third_party", "legal", "lender",
];

/** A1: positive/negative designation (ISA 505.15 gate on negative). */
export type ConfirmationMethod = "positive" | "negative";

const SUBJECT_FOR_CTYPE: Record<ConfirmationType, ConfirmationSubject> = {
  ar_positive: "receivable",
  ar_negative: "receivable",
  ap: "payable",
  bank: "bank",
  legal: "legal",
  related_party: "receivable",
  inventory_third_party: "inventory_third_party",
};

/** The four ISA 505.15 conditions — all must hold to designate negative. */
export const NEGATIVE_CONDITION_KEYS = [
  "low_rmm_with_controls",
  "homogeneous_small_value",
  "low_expected_exception",
  "no_reason_to_disregard",
] as const;

export type NegativeConditionKey = (typeof NEGATIVE_CONDITION_KEYS)[number];

export type ConfirmationStatus =
  | "prepared" | "approved" | "sent" | "replied"
  | "reconciled" | "exception" | "alternative" | "closed";

export interface ConfirmationInfo {
  id: string;
  ctype: ConfirmationType;
  subject: ConfirmationSubject;
  method: ConfirmationMethod;
  fileItemId: string | null;
  partyName: string;
  partyEmail: string | null;
  bookAmount: number | null;
  status: ConfirmationStatus;
  reminderCount: number;
  daysSinceSent: number | null;
  confirmedAmount: number | null;
  difference: number | null;
  disposition: string | null;
  altProcedure: string | null;
  letterDocumentId: string | null;
  /** A1: positive request closed with neither a reply nor an alternative
   * procedure — possible scope limitation (ISA 505.12 → ISA 705). */
  scopeLimitation: boolean;
}

function findColumn(keys: string[], hints: RegExp): string | undefined {
  return keys.find((key) => hints.test(key));
}

/**
 * 6.1 Selection from an imported dataset: all balances above the threshold are
 * key items; optionally the top N by absolute amount; optionally nil balances
 * (AP completeness testing). Grouped by the party column.
 */
export async function selectFromDataset(input: {
  engagementId: string;
  fileItemId: string;
  datasetId: string;
  ctype: ConfirmationType;
  threshold?: number;
  topN?: number;
  includeNil?: boolean;
}): Promise<number> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.query<{ data: Record<string, unknown>; amount: string | null }>(
      "SELECT data, amount FROM sub_ledger_row WHERE dataset_id = $1 ORDER BY row_no",
      [input.datasetId],
    );
    if (rows.rows.length === 0) throw new ConfirmationError("empty-dataset");
    const keys = Object.keys(rows.rows[0].data);
    const partyKey =
      findColumn(keys, /customer|client|supplier|fournisseur|party|name|nom|banque|bank/i) ?? keys[0];
    const emailKey = findColumn(keys, /mail/i);

    // Aggregate by party.
    const parties = new Map<string, { total: number; email: string | null; row: Record<string, unknown> }>();
    for (const row of rows.rows) {
      const party = String(row.data[partyKey] ?? "").trim();
      if (!party) continue;
      const entry = parties.get(party) ?? { total: 0, email: null, row: row.data };
      entry.total += row.amount === null ? 0 : Number(row.amount);
      if (emailKey && !entry.email) entry.email = String(row.data[emailKey] ?? "").trim() || null;
      parties.set(party, entry);
    }

    const ranked = [...parties.entries()].sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));
    const selected = new Map<string, { total: number; email: string | null; row: Record<string, unknown>; reason: string }>();
    if (input.threshold && input.threshold > 0) {
      for (const [party, entry] of ranked) {
        if (Math.abs(entry.total) > input.threshold) selected.set(party, { ...entry, reason: "above-threshold" });
      }
    }
    if (input.topN && input.topN > 0) {
      for (const [party, entry] of ranked.slice(0, input.topN)) {
        if (!selected.has(party)) selected.set(party, { ...entry, reason: "top-n" });
      }
    }
    if (input.includeNil) {
      for (const [party, entry] of ranked) {
        if (entry.total === 0) selected.set(party, { ...entry, reason: "nil-balance" });
      }
    }
    if (selected.size === 0) throw new ConfirmationError("nothing-selected");

    let created = 0;
    for (const [party, entry] of selected) {
      const token = randomBytes(18).toString("hex");
      const inserted = await tx.query(
        `INSERT INTO confirmation
           (tenant_id, engagement_id, file_item_id, ctype, subject, method, party_name, party_email,
            book_amount, reply_token, source_row, created_by)
         SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
          WHERE NOT EXISTS (
            SELECT 1 FROM confirmation
             WHERE engagement_id = $2 AND ctype = $4 AND party_name = $7
          )`,
        [tenantId, input.engagementId, input.fileItemId, input.ctype, SUBJECT_FOR_CTYPE[input.ctype], input.ctype === "ar_negative" ? "negative" : "positive", party, entry.email, Math.round(entry.total), token, JSON.stringify({ ...entry.row, __reason: entry.reason }), userId],
      );
      created += inserted.rowCount ?? 0;
    }
    return created;
  });
}

/** Manual addition (banks — all relationships incl. nil/closed; legal counsel). */
export async function addManualConfirmation(input: {
  engagementId: string;
  fileItemId: string;
  ctype: ConfirmationType;
  subject?: ConfirmationSubject;
  method?: ConfirmationMethod;
  /** ISA 505.15 checklist — required (all four true) when method is negative. */
  methodRationale?: Partial<Record<NegativeConditionKey, boolean>> | null;
  partyName: string;
  partyEmail?: string;
  bookAmount?: number;
}): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!input.partyName.trim()) throw new ConfirmationError("party-required");
  const method: ConfirmationMethod = input.method ?? "positive";
  if (method === "negative" && !NEGATIVE_CONDITION_KEYS.every((key) => input.methodRationale?.[key] === true)) {
    throw new ConfirmationError("negative-conditions");
  }
  const rationale = method === "negative" ? { standard: "ISA 505.15", ...input.methodRationale } : null;
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO confirmation
         (tenant_id, engagement_id, file_item_id, ctype, subject, method, method_rationale,
          party_name, party_email, book_amount, reply_token, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [tenantId, input.engagementId, input.fileItemId, input.ctype, input.subject ?? SUBJECT_FOR_CTYPE[input.ctype], method, rationale === null ? null : JSON.stringify(rationale), input.partyName.trim(), input.partyEmail ?? null, input.bookAmount ?? null, randomBytes(18).toString("hex"), userId],
    );
  });
}

const LETTER_BODY: Record<ConfirmationType, { en: string; fr: string }> = {
  ar_positive: {
    en: "At the request of our auditors, please confirm directly to them the balance due to us as stated below, or report any difference.",
    fr: "À la demande de nos auditeurs, veuillez leur confirmer directement le solde dû tel qu'indiqué ci-dessous, ou signaler tout écart.",
  },
  ar_negative: {
    en: "Please respond ONLY IF the balance below does not agree with your records. (Negative confirmation — ISA 505 conditions: low risk, tested controls, small homogeneous items, low expected exception rate.)",
    fr: "Merci de répondre UNIQUEMENT en cas de désaccord avec le solde ci-dessous. (Confirmation négative — conditions ISA 505 : risque faible, contrôles testés, petits soldes homogènes, faible taux d'anomalies attendu.)",
  },
  ap: {
    en: "Please provide directly to our auditors a statement of our account, including invoices, payments and the balance at the date below.",
    fr: "Veuillez adresser directement à nos auditeurs un relevé de notre compte : factures, règlements et solde à la date ci-dessous.",
  },
  bank: {
    en: "Please confirm directly to our auditors: account balances, loans and facilities, guarantees, covenants, restrictions, and authorised signatories at the date below.",
    fr: "Veuillez confirmer directement à nos auditeurs : soldes des comptes, emprunts et lignes de crédit, garanties, covenants, restrictions et signataires autorisés à la date ci-dessous.",
  },
  legal: {
    en: "Please describe directly to our auditors any litigation, claims or assessments involving our company, including your evaluation of the outcome and estimated financial effects.",
    fr: "Veuillez décrire directement à nos auditeurs tout litige, réclamation ou redressement concernant notre société, avec votre appréciation de l'issue et des effets financiers estimés.",
  },
  related_party: {
    en: "Please confirm directly to our auditors the balances and transactions between our companies for the period, and the terms applied.",
    fr: "Veuillez confirmer directement à nos auditeurs les soldes et transactions entre nos sociétés pour la période, ainsi que les conditions appliquées.",
  },
  inventory_third_party: {
    en: "Please confirm directly to our auditors the quantities and condition of our inventory held by you at the date below.",
    fr: "Veuillez confirmer directement à nos auditeurs les quantités et l'état de nos stocks détenus par vos soins à la date ci-dessous.",
  },
};

/** 6.2 Generate the letter for one confirmation as a versioned document. */
export async function generateConfirmationLetter(
  confirmationId: string,
  locale: Locale,
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  const fr = locale === "fr";
  return withTenant(tenantId, async (tx) => {
    const info = await tx.query<{
      engagement_id: string;
      file_item_id: string | null;
      ctype: ConfirmationType;
      party_name: string;
      book_amount: string | null;
      reply_token: string;
      client_name: string;
      period_end: string;
    }>(
      `SELECT c.engagement_id, c.file_item_id, c.ctype, c.party_name, c.book_amount::text,
              c.reply_token, cl.name AS client_name, to_char(e.period_end, 'YYYY-MM-DD') AS period_end
         FROM confirmation c
         JOIN engagement e ON e.id = c.engagement_id
         JOIN client cl ON cl.id = e.client_id
        WHERE c.id = $1`,
      [confirmationId],
    );
    const row = info.rows[0];
    if (!row) throw new ConfirmationError("not-found");

    const children = [
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(fr ? "Demande de confirmation" : "Confirmation request")] }),
      new Paragraph({ children: [new TextRun({ text: `${row.client_name} → ${row.party_name}`, bold: true })] }),
      new Paragraph(fr ? `Date de référence : ${row.period_end}` : `Reference date: ${row.period_end}`),
      new Paragraph(LETTER_BODY[row.ctype][fr ? "fr" : "en"]),
      ...(row.book_amount !== null && row.ctype !== "bank" && row.ctype !== "legal"
        ? [new Paragraph({ children: [new TextRun({ text: fr ? `Solde selon nos livres : ${Number(row.book_amount).toLocaleString("fr-FR")} FCFA` : `Balance per our records: ${Number(row.book_amount).toLocaleString("en-US")} FCFA`, bold: true })] })]
        : []),
      new Paragraph(
        fr
          ? `Merci d'adresser votre réponse DIRECTEMENT à l'auditeur (référence : ${row.reply_token.slice(0, 8)}).`
          : `Please reply DIRECTLY to the auditor (reference: ${row.reply_token.slice(0, 8)}).`,
      ),
      new Paragraph(fr ? "Signature de la direction : ____________" : "Management signature: ____________"),
    ];
    const content = await Packer.toBuffer(new Document({ sections: [{ children }] }));

    const title = `${fr ? "Confirmation" : "Confirmation"} — ${row.party_name}`;
    const doc = await tx.query<{ id: string }>(
      `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by, current_version)
       VALUES ($1, $2, $3, $4, $5, 'letter', $6, 1) RETURNING id`,
      [tenantId, row.engagement_id, row.file_item_id, title, locale, userId],
    );
    await tx.query(
      `INSERT INTO document_version
         (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
       VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8)`,
      [tenantId, doc.rows[0].id, DOCX_MIME, content.length, createHash("sha256").update(content).digest("hex"), content, `confirmation:${row.ctype}`, userId],
    );
    await tx.query("UPDATE confirmation SET letter_document_id = $2 WHERE id = $1", [confirmationId, doc.rows[0].id]);
    return doc.rows[0].id;
  });
}

/** 6.3/6.4 lifecycle transitions. */
export async function approveConfirmation(id: string): Promise<void> {
  await transition(id, ["prepared"], "approved");
}

export async function sendConfirmation(id: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query<{ party_email: string | null; party_name: string; reply_token: string }>(
      `UPDATE confirmation SET status = 'sent', sent_at = now()
        WHERE id = $1 AND status = 'approved'
        RETURNING party_email, party_name, reply_token`,
      [id],
    );
    const row = updated.rows[0];
    if (!row) throw new ConfirmationError("wrong-status");
    if (row.party_email) {
      sendEmail({
        to: row.party_email,
        subject: "Confirmation request / Demande de confirmation",
        body: `Reply reference: ${row.reply_token}`,
      });
    }
  });
}

export async function remindConfirmation(id: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      `UPDATE confirmation SET reminder_count = reminder_count + 1, last_reminder_at = now()
        WHERE id = $1 AND status = 'sent'`,
      [id],
    );
    if (updated.rowCount === 0) throw new ConfirmationError("wrong-status");
  });
}

async function transition(id: string, from: ConfirmationStatus[], to: ConfirmationStatus): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      `UPDATE confirmation SET status = $3 WHERE id = $1 AND status = ANY($2)`,
      [id, from, to],
    );
    if (updated.rowCount === 0) throw new ConfirmationError("wrong-status");
  });
}

/** 6.6 Reply: difference auto-computed; zero diff reconciles, else exception. */
export async function recordReply(id: string, confirmedAmount: number): Promise<{
  difference: number;
  status: "reconciled" | "exception";
}> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const row = await tx.query<{ book_amount: string | null }>(
      "SELECT book_amount::text FROM confirmation WHERE id = $1 AND status IN ('sent') FOR UPDATE",
      [id],
    );
    if (!row.rows[0]) throw new ConfirmationError("wrong-status");
    const book = row.rows[0].book_amount === null ? 0 : Number(row.rows[0].book_amount);
    const difference = Math.round(confirmedAmount - book);
    const status = difference === 0 ? "reconciled" : "exception";
    await tx.query(
      `UPDATE confirmation
          SET status = $2, replied_at = now(), confirmed_amount = $3, difference = $4
        WHERE id = $1`,
      [id, status, Math.round(confirmedAmount), difference],
    );
    return { difference, status };
  });
}

/** Exception disposition: client error raises the difference into B5. */
export async function disposeReply(
  id: string,
  disposition: "timing" | "client_error" | "confirmee_error",
): Promise<void> {
  const { tenantId } = await requireTenant();
  const context = await withTenant(tenantId, async (tx) => {
    const updated = await tx.query<{
      engagement_id: string;
      file_item_id: string | null;
      party_name: string;
      difference: string | null;
    }>(
      `UPDATE confirmation SET disposition = $2, status = 'closed'
        WHERE id = $1 AND status = 'exception'
        RETURNING engagement_id, file_item_id, party_name, difference::text`,
      [id, disposition],
    );
    if (!updated.rows[0]) throw new ConfirmationError("wrong-status");
    return updated.rows[0];
  });

  if (disposition === "client_error" && context.difference !== null) {
    await routeFinding({
      engagementId: context.engagement_id,
      fileItemId: context.file_item_id ?? undefined,
      route: "b5",
      title: `Confirmation difference — ${context.party_name}`,
      amount: Number(context.difference),
      mtype: "factual",
      trivialConfirmed: true,
    });
  }
}

/**
 * A1 non-response escalation: close a positive request that got no reply and
 * for which no alternative procedure is recorded. The resulting state (closed,
 * no replied_at, no alt_procedure) is surfaced as a possible scope limitation
 * — ISA 505.12 / ISA 705 (module A1, R19).
 */
export async function closeNoResponse(id: string): Promise<void> {
  await transition(id, ["sent"], "closed");
}

/** 6.7 Non-reply → alternative procedures. */
export async function recordAlternative(id: string, procedure: string): Promise<void> {
  const { tenantId } = await requireTenant();
  if (!procedure.trim()) throw new ConfirmationError("procedure-required");
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      `UPDATE confirmation SET status = 'alternative', alt_procedure = $2
        WHERE id = $1 AND status IN ('sent')`,
      [id, procedure],
    );
    if (updated.rowCount === 0) throw new ConfirmationError("wrong-status");
  });
}

export async function listConfirmationsFor(engagementId: string): Promise<ConfirmationInfo[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      ctype: ConfirmationType;
      subject: ConfirmationSubject;
      method: ConfirmationMethod;
      file_item_id: string | null;
      party_name: string;
      party_email: string | null;
      book_amount: string | null;
      status: ConfirmationStatus;
      reminder_count: number;
      days_since_sent: number | null;
      confirmed_amount: string | null;
      difference: string | null;
      disposition: string | null;
      alt_procedure: string | null;
      letter_document_id: string | null;
    }>(
      `SELECT id, ctype, subject, method, file_item_id, party_name, party_email,
              book_amount::text, status, reminder_count,
              CASE WHEN sent_at IS NULL THEN NULL
                   ELSE floor(extract(epoch FROM now() - sent_at) / 86400)::int END AS days_since_sent,
              confirmed_amount::text, difference::text, disposition, alt_procedure, letter_document_id
         FROM confirmation WHERE engagement_id = $1 ORDER BY ctype, party_name`,
      [engagementId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      ctype: row.ctype,
      subject: row.subject,
      method: row.method,
      fileItemId: row.file_item_id,
      partyName: row.party_name,
      partyEmail: row.party_email,
      bookAmount: row.book_amount === null ? null : Number(row.book_amount),
      status: row.status,
      reminderCount: row.reminder_count,
      daysSinceSent: row.days_since_sent,
      confirmedAmount: row.confirmed_amount === null ? null : Number(row.confirmed_amount),
      difference: row.difference === null ? null : Number(row.difference),
      disposition: row.disposition,
      altProcedure: row.alt_procedure,
      letterDocumentId: row.letter_document_id,
      scopeLimitation:
        row.method === "positive" && row.status === "closed" &&
        row.confirmed_amount === null && row.alt_procedure === null,
    }));
  });
}

export interface ConfirmationSummary {
  ctype: ConfirmationType;
  total: number;
  replied: number;
  reconciled: number;
  exceptions: number;
  alternative: number;
  outstanding: number;
  coveragePct: number | null;
}

async function summarize(tx: PoolClient, engagementId: string): Promise<ConfirmationSummary[]> {
  const result = await tx.query<{
    ctype: ConfirmationType;
    total: string;
    replied: string;
    reconciled: string;
    exceptions: string;
    alternative: string;
    outstanding: string;
    book_selected: string | null;
  }>(
    `SELECT ctype,
            count(*)::text AS total,
            count(*) FILTER (WHERE replied_at IS NOT NULL)::text AS replied,
            count(*) FILTER (WHERE status IN ('reconciled'))::text AS reconciled,
            count(*) FILTER (WHERE status IN ('exception', 'closed'))::text AS exceptions,
            count(*) FILTER (WHERE status = 'alternative')::text AS alternative,
            count(*) FILTER (WHERE status IN ('prepared', 'approved', 'sent'))::text AS outstanding,
            sum(abs(coalesce(book_amount, 0)))::text AS book_selected
       FROM confirmation WHERE engagement_id = $1 GROUP BY ctype`,
    [engagementId],
  );
  return result.rows.map((row) => ({
    ctype: row.ctype,
    total: Number(row.total),
    replied: Number(row.replied),
    reconciled: Number(row.reconciled),
    exceptions: Number(row.exceptions),
    alternative: Number(row.alternative),
    outstanding: Number(row.outstanding),
    coveragePct: Number(row.total) > 0 ? Math.round((Number(row.replied) / Number(row.total)) * 100) : null,
  }));
}

export async function confirmationSummary(engagementId: string): Promise<ConfirmationSummary[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => summarize(tx, engagementId));
}

/** 6.7 Auto-produced summary working paper (xlsx) indexed under the section. */
export async function generateSummaryWorkpaper(
  engagementId: string,
  fileItemId: string,
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const summary = await summarize(tx, engagementId);
    const details = await tx.query<{
      ctype: string; party_name: string; book_amount: string | null; status: string;
      confirmed_amount: string | null; difference: string | null; disposition: string | null; alt_procedure: string | null;
    }>(
      `SELECT ctype, party_name, book_amount::text, status, confirmed_amount::text,
              difference::text, disposition, alt_procedure
         FROM confirmation WHERE engagement_id = $1 ORDER BY ctype, party_name`,
      [engagementId],
    );
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Confirmations");
    const header = sheet.addRow(["type", "total", "replied", "coverage %", "reconciled", "exceptions", "alternative", "outstanding"]);
    header.font = { bold: true };
    for (const row of summary) {
      sheet.addRow([row.ctype, row.total, row.replied, row.coveragePct, row.reconciled, row.exceptions, row.alternative, row.outstanding]);
    }
    sheet.addRow([]);
    const detailHeader = sheet.addRow(["type", "party", "book", "status", "confirmed", "difference", "disposition", "alternative procedure"]);
    detailHeader.font = { bold: true };
    for (const row of details.rows) {
      sheet.addRow([row.ctype, row.party_name, row.book_amount, row.status, row.confirmed_amount, row.difference, row.disposition, row.alt_procedure]);
    }
    const content = Buffer.from(await workbook.xlsx.writeBuffer());
    const doc = await tx.query<{ id: string }>(
      `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by, current_version)
       VALUES ($1, $2, $3, $4, 'en', 'engine_output', $5, 1) RETURNING id`,
      [tenantId, engagementId, fileItemId, `Confirmations summary — ${new Date().toISOString().slice(0, 10)}`, userId],
    );
    await tx.query(
      `INSERT INTO document_version
         (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
       VALUES ($1,$2,1,$3,$4,$5,$6,'confirmations:summary',$7)`,
      [tenantId, doc.rows[0].id, XLSX_MIME, content.length, createHash("sha256").update(content).digest("hex"), content, userId],
    );
    return doc.rows[0].id;
  });
}
