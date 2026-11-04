import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The DEV re-test of 8725e6a, everything but the access rule (engagement-write-guard).

const TENANT = "d8d8d8d8-d8d8-4d8d-8d8d-d8d8d8d8d801";
const USER = "d8d8d8d8-d8d8-4d8d-8d8d-d8d8d8d8d802";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { localizedNotificationBody, localizedNotificationTitle } from "@/lib/activity-summary";
import { closePool } from "@/lib/db";
import { DocumentRuleError } from "@/lib/documents";
import { createEngagement } from "@/lib/engagements";
import { buildProjection } from "@/lib/gl-line";
import { twoAccountCorrelation } from "@/lib/gl-correlation";
import { resolveLegalFormPaper } from "@/lib/legal-forms";
import { listMyNotifications, unreadCount } from "@/lib/notifications";
import { CONCLUSION_PAPERS } from "@/lib/papers/conclusion";
import { conclKey, procKey, ynKey, type PaperDef } from "@/lib/papers/types";
import { todCraLabel, TOD_CRAS } from "@/lib/tod-plan";
import { paperMissingParts } from "@/lib/working-papers";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Retest Firm', 'retest-8725')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'r@retest.local', 'R', 'x')", [USER]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Retest SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31", partnerId: USER });
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("D4: correlation between two accounts on an imported ledger", () => {
  const line = (je: string, date: string, account: string, debit: number, credit: number) => ({
    "N° pièce": je, Date: date, "N° de compte": account, Libellé: "Entry", Débit: debit, Crédit: credit,
  });
  const ROWS = [
    line("1", "2025-01-15", "411000", 1200, 0),
    line("1", "2025-01-15", "701000", 0, 1000),
    line("1", "2025-01-15", "443000", 0, 200),
    line("2", "2025-02-10", "411000", 600, 0),
    line("2", "2025-02-10", "701000", 0, 500),
    line("2", "2025-02-10", "443000", 0, 100),
    line("3", "2025-02-20", "401000", 300, 0),
    line("3", "2025-02-20", "521000", 0, 300),
    line("4", "2025-03-20", "411000", 50, 0),
    line("4", "2025-03-20", "521000", 0, 50),
  ];
  const MAPPING = { account: "N° de compte", jeNumber: "N° pièce", jeDescription: "Libellé", journalDate: "Date", debit: "Débit", credit: "Crédit" };
  let datasetId: string;

  beforeAll(async () => {
    const d = await admin.query<{ id: string }>(
      `INSERT INTO sub_ledger_dataset (tenant_id, engagement_id, kind, timing, name, source_filename, source_sha256, row_count, mapping, created_by)
       VALUES ($1, $2, 'journal_entries', 'pre_audit', 'gl', 'gl.xlsx', 'x', $3, $4, $5) RETURNING id`,
      [TENANT, engagementId, ROWS.length, JSON.stringify(MAPPING), USER],
    );
    datasetId = d.rows[0].id;
    for (let i = 0; i < ROWS.length; i += 1) {
      await admin.query("INSERT INTO sub_ledger_row (tenant_id, dataset_id, row_no, data) VALUES ($1, $2, $3, $4)", [TENANT, datasetId, i + 1, JSON.stringify(ROWS[i])]);
    }
    await buildProjection(engagementId, datasetId);
  });

  it("answers for 411000 / 701000: what entries touching both post to each, month by month", async () => {
    const r = await twoAccountCorrelation(engagementId, datasetId, "411000", "701000");
    expect(r.commonEntries).toBe(2);
    expect(r.months.map((m) => m.month)).toEqual(["2025-01", "2025-02"]);
    expect(r.totalA).toBe(1800);
    expect(r.totalB).toBe(-1500);
  });

  it("answers for 401000 / 521000", async () => {
    const r = await twoAccountCorrelation(engagementId, datasetId, "401000", "521000");
    expect(r.commonEntries).toBe(1);
    expect(r.totalA).toBe(300);
    expect(r.totalB).toBe(-300);
  });

  it("answers with no common entry rather than failing", async () => {
    const r = await twoAccountCorrelation(engagementId, datasetId, "701000", "521000");
    expect(r.commonEntries).toBe(0);
    expect(r.months).toEqual([]);
  });
});

describe("D2: stored notifications in the reader's language", () => {
  const CASES: [string, string, string][] = [
    ["Task assigned · Tâche assignée : P3.2", "Task assigned: P3.2", "Tâche assignée : P3.2"],
    ["1 task(s) assigned to you as preparer · 1 tâche(s) qui vous sont assignée(s) comme préparateur", "1 task(s) assigned to you as preparer", "1 tâche(s) qui vous sont assignée(s) comme préparateur"],
    ["Added to Mission X · Ajouté(e) à Mission X", "Added to Mission X", "Ajouté(e) à Mission X"],
    ["Added to Mission Y", "Added to Mission Y", "Ajouté(e) à Mission Y"],
    ["Engagement archived · Mission archivée", "Engagement archived", "Mission archivée"],
    ["Review note on E1 · Note de revue sur E1", "Review note on E1", "Note de revue sur E1"],
    ["Anne declined the engagement · Anne a refusé la mission", "Anne declined the engagement", "Anne a refusé la mission"],
    ["Statutory deadline overdue: agm", "Statutory deadline overdue: agm", "Échéance légale dépassée : agm"],
    ["Capitaux propres < ½ capital social", "Equity below half of share capital", "Capitaux propres < ½ capital social"],
    ["Sign-off voided: Letter", "Sign-off voided: Letter", "Signature annulée : Letter"],
  ];

  it.each(CASES)("title %s", (stored, en, fr) => {
    expect(localizedNotificationTitle(stored, "en")).toBe(en);
    expect(localizedNotificationTitle(stored, "fr")).toBe(fr);
  });

  it("renders the older English-only invitation line", () => {
    const body = "Accept or decline the engagement from its dashboard.";
    expect(localizedNotificationBody("engagement-invite", body, "fr")).toBe("Acceptez ou refusez l'invitation à la mission.");
    expect(localizedNotificationBody("engagement-invite", body, "en")).toBe("Accept or decline the engagement invitation.");
    const both = "Accept or decline the engagement invitation. · Acceptez ou refusez l'invitation à la mission.";
    expect(localizedNotificationBody("engagement-invite", both, "fr")).toBe("Acceptez ou refusez l'invitation à la mission.");
    expect(localizedNotificationBody("engagement-invite", both, "en")).toBe("Accept or decline the engagement invitation.");
  });

  it("takes a task's own title from its pair", () => {
    expect(localizedNotificationBody("task_assigned", "Risk assessment · Évaluation des risques", "fr")).toBe("Évaluation des risques");
    expect(localizedNotificationBody("task_assigned", "Risk assessment · Évaluation des risques", "en")).toBe("Risk assessment");
  });

  it("never alters what a person wrote", () => {
    const words = "On revoit ça · let's review";
    expect(localizedNotificationBody("mention", words, "en")).toBe(words);
    expect(localizedNotificationBody("mention", words, "fr")).toBe(words);
    expect(localizedNotificationTitle("Quelque chose d'inconnu", "en")).toBe("Quelque chose d'inconnu");
  });
});

describe("D3: the retired independence campaign, every variant", () => {
  it("hides every kind and title and keeps the rows", async () => {
    const retired: [string, string][] = [
      ["independence-confirmation", "Independence confirmation required · Confirmation d'indépendance requise"],
      ["independence-reminder", "Independence confirmation outstanding"],
      ["independence-reminder", "Independence confirmation outstanding · Confirmation d'indépendance en attente"],
      ["independence-exception", "Independence exception: A. Name"],
      ["independence-exception", "Independence exception · Exception d'indépendance : A. Name"],
      // a title that outlived its kind
      ["system", "Independence confirmation outstanding"],
      ["system", "Confirmation d'indépendance en attente"],
    ];
    for (const [kind, title] of retired) {
      await admin.query("INSERT INTO notification (tenant_id, user_id, kind, title) VALUES ($1, $2, $3, $4)", [TENANT, USER, kind, title]);
    }
    await admin.query("INSERT INTO notification (tenant_id, user_id, kind, title) VALUES ($1, $2, 'system', 'Still here')", [TENANT, USER]);
    const titles = (await listMyNotifications(50)).map((n) => n.title);
    expect(titles).toEqual(["Still here"]);
    expect(await unreadCount()).toBe(1);
    const stored = await admin.query("SELECT 1 FROM notification WHERE user_id = $1", [USER]);
    expect(stored.rowCount).toBe(retired.length + 1);
  });
});

describe("C5.3 and C5.4 on a SARL", () => {
  const texts = (def: PaperDef, lang: "En" | "Fr"): string[] => {
    const out: string[] = [];
    for (const s of def.sections ?? []) {
      if (s.kind === "proc") for (const p of s.procs) out.push(lang === "En" ? p.en : p.fr, (lang === "En" ? p.tipEn : p.tipFr) ?? "");
      if (s.kind === "yn") for (const q of s.items) out.push(lang === "En" ? q.en : q.fr, (lang === "En" ? q.tipEn : q.tipFr) ?? "");
    }
    return out;
  };

  it("speaks of no director and no ten per cent in the work of a SARL", () => {
    const sarl = resolveLegalFormPaper(CONCLUSION_PAPERS["C5.3"], "SARL");
    const fr = texts(sarl, "Fr").join(" ");
    expect(fr).not.toMatch(/administrateur/i);
    expect(fr).not.toMatch(/dix pour cent/i);
    expect(fr).not.toMatch(/quoi qu'ait décidé le conseil/);
    expect(fr).toContain("une société du gérant");
    const en = texts(sarl, "En").join(" ");
    expect(en).not.toMatch(/\bdirector/i);
    expect(en).not.toMatch(/ten per cent/i);
  });

  it("never says the gérant holds a meeting", () => {
    for (const code of ["C5.3", "C5.4"]) {
      const sarl = JSON.stringify(resolveLegalFormPaper(CONCLUSION_PAPERS[code], "SARL"));
      expect(sarl).not.toMatch(/réunion du gérant/);
      expect(sarl).not.toMatch(/meeting of the gérant/);
    }
  });
});

describe("the sampling preview", () => {
  it("translates every combined assessment", () => {
    expect(todCraLabel("moderate", "fr")).toBe("Modéré");
    expect(todCraLabel("moderate", "en")).toBe("Moderate");
    for (const cra of TOD_CRAS) expect(todCraLabel(cra, "fr")).not.toMatch(/_|moderate/);
  });
});

describe("paper-incomplete names the parts", () => {
  const def = {
    sections: [
      { kind: "proc", titleEn: "Part A — Procedures", titleFr: "Partie A — Procédures", procs: [{ key: "a", en: "", fr: "", srcEn: "", srcFr: "" }] },
      { kind: "yn", titleEn: "Part G — Evaluation", titleFr: "Partie G — Évaluation", items: [{ key: "g", en: "", fr: "" }] },
    ],
    conclEn: ["Done."],
    conclFr: ["Fait."],
  } as unknown as PaperDef;

  it("lists only the parts with missing answers, in both languages", () => {
    const values = { [procKey("a")]: "done", [conclKey(0)]: "yes" };
    expect(paperMissingParts(def, values)).toEqual({ en: ["Part G"], fr: ["Partie G"] });
    expect(paperMissingParts(def, { ...values, [ynKey("g")]: "yes" })).toEqual({ en: [], fr: [] });
    expect(paperMissingParts(def, { [procKey("a")]: "done", [ynKey("g")]: "yes" })).toEqual({ en: ["Conclusion"], fr: ["Conclusion"] });
    // a "No" nobody explained is missing too
    expect(paperMissingParts(def, { ...values, [ynKey("g")]: "no" }).en).toEqual(["Part G"]);
  });

  it("carries them on the refusal, in the reader's language", () => {
    const refused = new DocumentRuleError("paper-incomplete", { en: ["Part G", "Conclusion"], fr: ["Partie G", "Conclusion"] });
    expect(refused.message).toBe("paper-incomplete");
    expect(refused.banner("en")).toBe("paper-incomplete:Part G, Conclusion");
    expect(refused.banner("fr")).toBe("paper-incomplete:Partie G, Conclusion");
    expect(new DocumentRuleError("self-review").banner("fr")).toBe("self-review");
  });
});
