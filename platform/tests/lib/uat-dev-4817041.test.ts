import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Regressions for the DEV test of 4817041: acceptance gates against the wizard,
// team and read-only refusals, C5.10, the 490/499 captions, assignment without
// a redirect, the French of the trail and the organ grammar of the papers.

const FIRM = "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4";
const ADMIN = "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c401";
const MANAGER = "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c402";
const STAFF = "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c403";
const READER = "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c404";
const OUTSIDER = "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c405";
const USERS = [ADMIN, MANAGER, STAFF, READER, OUTSIDER];

let actor = { id: ADMIN, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: FIRM, role: actor.role, locale: "en", clientId: null },
  })),
}));
vi.mock("@/lib/locale", () => ({ getLocale: vi.fn(async () => "fr") }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

import { updateEngagementSetupAction, updateStandardsEditionAction } from "@/app/actions/audit-file";
import { assignFormsTasksAction } from "@/app/actions/planning";
import { POST as evidencePost } from "@/app/api/steps/[id]/evidence/route";
import { localizedNotificationTitle, localizedSummary } from "@/lib/activity-summary";
import { addComment } from "@/lib/comments";
import { closePool } from "@/lib/db";
import { restoreVersion } from "@/lib/documents";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { completeStep, uncompleteStep } from "@/lib/execution";
import { saveForm } from "@/lib/forms";
import { bilanTotals } from "@/lib/fs-captions";
import { acceptanceGates } from "@/lib/gates";
import { addFirmHoliday } from "@/lib/je-selection";
import { resolveLegalFormText, LEGAL_FORMS } from "@/lib/legal-forms";
import { leadIndexFor, LEAD_INDEX_BY_CODE } from "@/lib/lead-classes";
import { reflagMisstatements } from "@/lib/materiality";
import { listMyNotifications, unreadCount } from "@/lib/notifications";
import { personsOnSave } from "@/lib/papers/statutory-525";
import { requiredKeys } from "@/lib/papers/types";
import { addRisk, dismissPotentialRisk } from "@/lib/risks";
import { noNegativeZero } from "@/lib/sad-model";
import { saveSad, saveSadMeta } from "@/lib/sad";
import { createDataset } from "@/lib/subledgers";
import { assignTeamMember } from "@/lib/team";
import { acceptancePaperVerdict, loadPaper, paperFieldLabel, paperFor, savePaper } from "@/lib/working-papers";
import { assignTemplate, listTemplates } from "@/lib/wp-templates";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const as = (id: string, role: string) => {
  actor = { id, role };
};

let clientId: string;
let eng: string;
let stepId: string;
let itemId: string;

/** Every required answer of a paper, as the wizard saves them. */
function answers(code: string, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    ...Object.fromEntries(
      requiredKeys(paperFor(code)).map((k) => [k, k.startsWith("q_") || k.startsWith("c_") ? "yes" : "Done."]),
    ),
    ...overrides,
  };
}
const p11 = (overrides: Record<string, string> = {}) =>
  answers("P1.1", { engagement_type: "recurring", auditor_change: "no", rating: "moderate", ...overrides });

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [FIRM]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [USERS]);
}

const gate = (gates: { key: string; ok: boolean }[], key: string) => gates.find((g) => g.key === key)?.ok;

async function newFile(fiscalYear: number): Promise<string> {
  as(ADMIN, "firm_admin");
  const id = await createEngagement({ clientId, fiscalYear, periodEnd: `${fiscalYear}-12-31`, partnerId: ADMIN });
  await assignTeamMember(id, MANAGER, "manager");
  return id;
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Dev 4817041', 'dev-4817041')", [FIRM]);
  const users: [string, string][] = [
    [ADMIN, "firm_admin"],
    [MANAGER, "manager"],
    [STAFF, "staff"],
    [READER, "read_only"],
    [OUTSIDER, "staff"],
  ];
  for (const [id, role] of users) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [
      id,
      `${id.slice(-2)}@dev-4817041.local`,
    ]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, FIRM, role]);
  }
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Dev SA', 'SA') RETURNING id",
    [FIRM],
  );
  clientId = client.rows[0].id;
  eng = await newFile(2025);
  await assignTeamMember(eng, STAFF, "staff");
  await assignTeamMember(eng, READER, "staff");
  itemId = (await listFileItems(eng)).find((i) => i.code === "E4.20")!.id;
  const step = await admin.query<{ id: string }>(
    `INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, source)
     VALUES ($1, $2, $3, 900, 'Test step', 'custom') RETURNING id`,
    [FIRM, eng, itemId],
  );
  stepId = step.rows[0].id;
}, 90_000);

afterEach(() => as(ADMIN, "firm_admin"));

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("acceptance gates and the P1.1 wizard", () => {
  it("are satisfied by the answers given on the paper, the only screen since F078", async () => {
    const id = await newFile(2020);
    as(MANAGER, "manager");
    expect(gate(await acceptanceGates(id), "d31_form_complete")).toBe(false);
    await savePaper(id, "P1.1", p11());
    const gates = await acceptanceGates(id);
    expect(gate(gates, "d31_form_complete")).toBe(true);
    expect(gate(gates, "d31_checks_passed")).toBe(true);
  });

  it("still pass on a file that filled the legacy form", async () => {
    const id = await newFile(2021);
    as(MANAGER, "manager");
    await saveForm(id, "P1.1", {
      engagement_type: "continuing",
      integrity_ok: true,
      competence_ok: true,
      conflicts_ok: true,
      aml_ok: true,
      independence_ok: true,
      risk_rating: "moderate",
      conclusion: "accept",
    });
    const gates = await acceptanceGates(id);
    expect(gate(gates, "d31_form_complete")).toBe(true);
    expect(gate(gates, "d31_checks_passed")).toBe(true);
  });

  it("read a refusal of acceptance, a No nobody explained and an unsupported rating as failures", () => {
    expect(acceptancePaperVerdict(p11({ c_0: "no", c_0_x: "Declined." }), {}).accepted).toBe(false);
    expect(acceptancePaperVerdict(p11({ c_0: "no", c_0_x: "Declined." }), {}).checksPassed).toBe(false);
    expect(acceptancePaperVerdict(p11({ c_1: "no", c_1_x: "Not supported." }), {}).checksPassed).toBe(false);
    const unexplained = acceptancePaperVerdict(p11({ q_reputation: "no" }), {});
    expect(unexplained.complete).toBe(false);
    expect(unexplained.missing).toBe(1);
    expect(acceptancePaperVerdict(p11({ q_reputation: "na" }), {}).complete).toBe(false);
  });

  it("let a No through once explained, unless the rating stays Low (Part C)", () => {
    const explained = { q_reputation: "no", q_reputation_x: "Old matter, resolved." };
    expect(acceptancePaperVerdict(p11(explained), {}).checksPassed).toBe(true);
    expect(acceptancePaperVerdict(p11({ ...explained, rating: "low" }), {}).checksPassed).toBe(false);
    expect(acceptancePaperVerdict(p11({ rating: "low" }), {}).checksPassed).toBe(true);
  });

  it("want P1.2 completed where the auditor changed, and the save puts P1.2 on the file", async () => {
    const changed = p11({ engagement_type: "new", auditor_change: "yes" });
    expect(acceptancePaperVerdict(changed, {}).checksPassed).toBe(false);
    expect(acceptancePaperVerdict(changed, {}).predecessorRecorded).toBe(false);
    expect(acceptancePaperVerdict(changed, answers("P1.2")).checksPassed).toBe(true);
    // a first audit: new, nobody before us, nothing to communicate with
    expect(acceptancePaperVerdict(p11({ engagement_type: "new", auditor_change: "no" }), {}).checksPassed).toBe(true);

    const id = await newFile(2022);
    await admin.query("DELETE FROM file_item WHERE engagement_id = $1 AND code = 'P1.2'", [id]);
    as(MANAGER, "manager");
    await savePaper(id, "P1.1", changed);
    const p12 = await admin.query<{ conditional: boolean }>(
      "SELECT conditional FROM file_item WHERE engagement_id = $1 AND code = 'P1.2'",
      [id],
    );
    expect(p12.rows[0]?.conditional).toBe(false);
    expect(gate(await acceptanceGates(id), "d31_checks_passed")).toBe(false);
  });
});

describe("POST /api/steps/[id]/evidence", () => {
  const post = (id: string) => {
    const form = new FormData();
    form.set("file", new File(["hello"], "note.txt", { type: "text/plain" }));
    return evidencePost(new Request("http://x/api", { method: "POST", body: form }), { params: Promise.resolve({ id }) });
  };
  const count = async () => Number((await admin.query<{ n: string }>("SELECT count(*)::text AS n FROM evidence WHERE program_step_id = $1", [stepId])).rows[0].n);

  it("refuses staff who are not on the team with 403, and writes nothing", async () => {
    as(OUTSIDER, "staff");
    const response = await post(stepId);
    expect(response.status).toBe(403);
    expect(await count()).toBe(0);
  });

  it("refuses before reading the body, and answers an unknown step the same way", async () => {
    as(OUTSIDER, "staff");
    const body = vi.fn(async () => new FormData());
    const request = { formData: body } as unknown as Request;
    expect((await evidencePost(request, { params: Promise.resolve({ id: stepId }) })).status).toBe(403);
    expect(body).not.toHaveBeenCalled();
    expect((await post("c4c4c4c4-c4c4-4c4c-8c4c-000000000000")).status).toBe(403);
  });

  it("refuses a read-only member with 403", async () => {
    as(READER, "read_only");
    expect((await post(stepId)).status).toBe(403);
    expect(await count()).toBe(0);
  });

  it("lets a team member attach", async () => {
    as(STAFF, "staff");
    expect((await post(stepId)).status).toBe(200);
    expect(await count()).toBe(1);
  });
});

describe("read-only refusals", () => {
  const STEP = "c4c4c4c4-c4c4-4c4c-8c4c-111111111111";
  const refused: [string, () => Promise<unknown>][] = [
    ["addRisk", () => addRisk(eng, { description: "A risk from a reader" } as never)],
    ["dismissPotentialRisk", () => dismissPotentialRisk(STEP, "because")],
    ["completeStep", () => completeStep(stepId, "done")],
    ["uncompleteStep", () => uncompleteStep(stepId)],
    ["restoreVersion", () => restoreVersion(STEP, 1)],
    ["reflagMisstatements", () => reflagMisstatements(eng)],
    ["saveSad", () => saveSad(eng, STEP, "rationale", "x")],
    ["saveSadMeta", () => saveSadMeta(eng, "concl_text", "x")],
    ["createDataset", () => createDataset(eng, "ar" as never, "a.csv", Buffer.from("a,b"))],
    ["addFirmHoliday", () => addFirmHoliday({ country: "CM", holidayDate: "2025-01-01", labelEn: "x", labelFr: "x", engagementId: eng } as never)],
    ["addComment", () => addComment({ engagementId: eng, body: "hello" })],
    ["assignTemplate", () => assignTemplate(itemId, listTemplates()[0].key)],
  ];
  it.each(refused)("%s", async (_name, call) => {
    as(READER, "read_only");
    await expect(call()).rejects.toThrow("read-only-role");
  });

  it("leaves the register untouched", async () => {
    const r = await admin.query("SELECT 1 FROM risk WHERE engagement_id = $1 AND description LIKE '%from a reader%'", [eng]);
    expect(r.rowCount).toBe(0);
  });

  it("answers a replayed engagement-settings post with a banner, not a 500", async () => {
    as(READER, "read_only");
    const setup = new FormData();
    setup.set("framework", "syscohada");
    await expect(updateEngagementSetupAction(eng, setup)).rejects.toThrow(/REDIRECT:.*error=read-only-role/);
    const edition = new FormData();
    edition.set("standardsEdition", "current");
    edition.set("reason", "replay");
    await expect(updateStandardsEditionAction(eng, edition)).rejects.toThrow(/REDIRECT:.*error=read-only-role/);
  });

  it("keeps staff off a template on a file they are not on", async () => {
    as(OUTSIDER, "staff");
    await expect(assignTemplate(itemId, listTemplates()[0].key)).rejects.toThrow("not-on-this-engagement");
  });
});

describe("C5.10: persons follow the headcount (F058)", () => {
  it("recomputes when the figure changed, unless persons was changed on that same save", () => {
    const stored = { headcount: "150 salariés", persons: "five" };
    expect(personsOnSave(stored, { headcount: "250 salariés", persons: "five" })).toBe("ten");
    expect(personsOnSave(stored, { headcount: "250", persons: "" })).toBe("ten");
    expect(personsOnSave(stored, { headcount: "250", persons: "ten" })).toBeNull();
    expect(personsOnSave({ headcount: "250", persons: "ten" }, { headcount: "180", persons: "five" })).toBeNull();
    // a hand choice survives a save that leaves the figure alone
    expect(personsOnSave({ headcount: "150", persons: "ten" }, { headcount: "150 employees", persons: "ten" })).toBeNull();
    // no figure: the preparer's choice stands
    expect(personsOnSave(stored, { headcount: "to confirm", persons: "five" })).toBeNull();
  });

  it("follows 150 → five → 250 → ten through savePaper", async () => {
    as(MANAGER, "manager");
    const id = await newFile(2023);
    as(MANAGER, "manager");
    await savePaper(id, "C5.10", { headcount: "150", persons: "" });
    expect((await loadPaper(id, "C5.10")).persons).toBe("five");
    await savePaper(id, "C5.10", { headcount: "250", persons: "five" });
    expect((await loadPaper(id, "C5.10")).persons).toBe("ten");
    await savePaper(id, "C5.10", { headcount: "150", persons: "ten" });
    expect((await loadPaper(id, "C5.10")).persons).toBe("five");
    await savePaper(id, "C5.10", { headcount: "250", persons: "five" });
    await savePaper(id, "C5.10", { headcount: "150", persons: "five" });
    expect((await loadPaper(id, "C5.10")).persons).toBe("five");
    // changed by hand on the save that changes the figure: the hand wins
    await savePaper(id, "C5.10", { headcount: "300", persons: "five" });
    expect((await loadPaper(id, "C5.10")).persons).toBe("ten");
    await savePaper(id, "C5.10", { headcount: "400", persons: "five" });
    expect((await loadPaper(id, "C5.10")).persons).toBe("five");
  });
});

describe("490 and 499: the aggregator agrees with the lead classes (F013, F059)", () => {
  const base = [
    { account: "2410000", value: 20_000_000 },
    { account: "4110000", value: 16_000_000 },
    { account: "1010000", value: -36_000_000 },
  ];

  it("keeps 499 on the liabilities: total assets 36,350,000 with 350,000 in 499", () => {
    const totals = bilanTotals([
      ...base,
      { account: "4110001", value: 350_000 },
      { account: "4990000", value: -350_000 },
    ]);
    expect(totals.totalAssets).toBe(36_350_000);
    expect(totals.class4Credit).toBe(350_000);
    expect(LEAD_INDEX_BY_CODE[leadIndexFor("4990000")!].accountType).toBe("Liabilities");
  });

  it("keeps 490 on the liabilities too, whatever its sign", () => {
    const credit = bilanTotals([...base, { account: "4090000", value: 100 }, { account: "4900000", value: -100 }]);
    expect(credit.totalAssets).toBe(36_000_100);
    expect(credit.class4Credit).toBe(100);
    const debit = bilanTotals([...base, { account: "4900000", value: 100 }]);
    expect(debit.totalAssets).toBe(36_000_000);
    expect(debit.class4Credit).toBe(-100);
    expect(LEAD_INDEX_BY_CODE[leadIndexFor("4900000")!].accountType).toBe("Liabilities");
  });

  it("still nets the receivables with the other impairment accounts", () => {
    const totals = bilanTotals([...base, { account: "4910000", value: -1_000 }]);
    expect(totals.receivables).toBe(15_999_000);
  });
});

describe("assignment in place (F084)", () => {
  it("does not navigate when asked to stay, so the Undo toast survives", async () => {
    as(MANAGER, "manager");
    const form = new FormData();
    form.set("assignee", STAFF);
    form.set("role", "preparer");
    form.set("stay", "1");
    await expect(assignFormsTasksAction(eng, [itemId], form)).resolves.toBeUndefined();
    const owner = async () => (await admin.query<{ owner_id: string | null }>("SELECT owner_id FROM file_item WHERE id = $1", [itemId])).rows[0].owner_id;
    expect(await owner()).toBe(STAFF);
    // and Undo puts it back
    const undo = new FormData();
    undo.set("assignee", "");
    undo.set("role", "preparer");
    undo.set("stay", "1");
    await expect(assignFormsTasksAction(eng, [itemId], undo)).resolves.toBeUndefined();
    expect(await owner()).toBeNull();
  });

  it("still lands on the banner for the phase form's OK button", async () => {
    as(MANAGER, "manager");
    const form = new FormData();
    form.set("assignee", STAFF);
    form.set("role", "preparer");
    await expect(assignFormsTasksAction(eng, [itemId], form)).rejects.toThrow(/REDIRECT:.*assigned=1/);
  });
});

describe("the trail and the bell in French (F086)", () => {
  it("translates the lines the dashboard and the answer-history trigger show", () => {
    expect(localizedSummary("E4.11 signed off as reviewer", "fr")).toBe("E4.11 signé comme réviseur");
    expect(localizedSummary("wp:P1.3 · p_framework changed", "fr")).toBe("P1.3 : réponse modifiée");
    expect(localizedSummary("wp:P1.3 · p_framework cleared", "fr")).toBe("P1.3 : réponse effacée");
    expect(localizedSummary("wp:P1.3 · p_framework changed", "en")).toBe("P1.3: answer changed");
    expect(
      localizedSummary(
        "C5.11 Communications (ISA 260/265) created next to C5.1, retitled Opinion and auditor's report (ISA 700–706): 2 letter(s) and 1 finding(s) moved from C5.1 to C5.11",
        "fr",
      ),
    ).toContain("déplacés de C5.1 vers C5.11");
    expect(localizedSummary("ISA 265 deficiency evaluated on C5.11: graded significant, communicated in writing on 2026-01-02 to PCA", "fr")).toBe(
      "Déficience ISA 265 évaluée en C5.11 : classée significative, communiquée par écrit le 2026-01-02 à PCA",
    );
    expect(localizedSummary("P1.1 working paper saved — p_docs, q_fees", "fr")).toBe("P1.1 feuille de travail enregistrée — 2 champ(s)");
  });

  it("shows the edition's label, never its key", () => {
    const fr = localizedSummary("Standards edition changed from current to revised_2026: new period", "fr");
    expect(fr).not.toMatch(/current|revised_2026/);
    expect(fr).toContain("new period");
    expect(localizedSummary("Standards edition changed from current to revised_2026: x", "en")).not.toMatch(/revised_2026/);
  });

  it("translates a stored English notification title", () => {
    expect(localizedNotificationTitle("Sign-off voided: Lettre", "fr")).toBe("Signature annulée : Lettre");
    expect(localizedNotificationTitle("Sign-off voided: Letter", "en")).toBe("Sign-off voided: Letter");
    expect(localizedNotificationTitle("Task assigned · Tâche assignée : E1", "fr")).toBe("Tâche assignée : E1");
  });

  it("names an answer by its label, not its storage key", () => {
    expect(paperFieldLabel("P1.1", "rating", "fr")).toBe("Notation du risque client");
    expect(paperFieldLabel("P1.1", "p_docs", "fr")).toMatch(/^Obtenir et examiner les statuts/);
    expect(paperFieldLabel("P1.1", "q_fees_x", "en")).toMatch(/^There is no undue concern/);
    expect(paperFieldLabel("P1.1", "c_1", "fr")).toBe("Conclusion 2");
    expect(paperFieldLabel("P1.1", "gone_key", "fr")).toBe("gone_key");
  });
});

describe("the organ's grammar on the papers (F052)", () => {
  it("takes the article the name needs", () => {
    const t = (text: string, form: string) => resolveLegalFormText(text, form, "fr");
    expect(t("adressé à l'[[lf.board]]", "SA")).toBe("adressé au conseil d'administration");
    expect(t("adressé à l'[[lf.chair]]", "SA_AG")).toBe("adressé à l'administrateur général");
    expect(t("par l'[[lf.board]]", "SARL")).toBe("par le gérant (la SARL n'a pas de conseil)");
    expect(t("de l'[[lf.board]]", "SA")).toBe("du conseil d'administration");
    expect(t("les [[lf.officers]]", "SA_AG")).toBe("l'administrateur général et l'administrateur général adjoint");
    expect(t("les [[lf.officers]]", "SARL")).toBe("les gérants");
    expect(t("Obtenir des [[lf.officers]] la liste", "SA_AG")).toBe("Obtenir de l'administrateur général et l'administrateur général adjoint la liste");
    expect(t("pour cette [[lf.form]]", "GIE")).toBe("pour ce GIE");
    expect(t("les [[lf.nothing]]", "SA")).toBe("les [[lf.nothing]]");
  });

  it("states the ten per cent only on the forms it applies to", () => {
    const candidates = (form: string) => {
      const def = paperFor("C5.3", "current", form);
      const proc = def.sections!.flatMap((s) => (s.kind === "proc" ? s.procs : [])).find((p) => p.key === "candidates")!;
      return proc.fr;
    };
    expect(candidates("SA")).toContain("les actionnaires détenant directement ou indirectement au moins dix pour cent");
    expect(candidates("SA")).not.toContain("(SA)");
    expect(candidates("SARL")).not.toContain("dix pour cent");
    expect(candidates("SARL")).toContain("les associés");
    expect(candidates("SA_AG")).not.toMatch(/les administrateur général/);
  });

  it("leaves no broken article anywhere on the statutory papers, under any form", () => {
    for (const form of LEGAL_FORMS) {
      for (const code of ["C5.2", "C5.3", "C5.4", "C5.5", "C5.6", "C5.7", "C5.8", "C5.9", "C5.10"]) {
        const text = JSON.stringify(paperFor(code, "current", form));
        expect(text, `${code} ${form}`).not.toMatch(/\b[Ll]'(conseil|gérant|président|dirigeant|décisions|associés|membres)/);
        expect(text, `${code} ${form}`).not.toMatch(/\b[Ll]es (administrateur général|gérant\b|président\b)/);
        expect(text, `${code} ${form}`).not.toContain("[[lf.");
      }
    }
  });
});

describe("retired notifications and the SAD's zero", () => {
  it("hides the independence campaign's notifications without deleting them", async () => {
    as(READER, "read_only");
    await admin.query(
      `INSERT INTO notification (tenant_id, user_id, kind, title) VALUES
         ($1, $2, 'independence-confirmation', 'Independence confirmation required · Confirmation d''indépendance requise'),
         ($1, $2, 'other', 'Still shown')`,
      [FIRM, READER],
    );
    const titles = (await listMyNotifications()).map((n) => n.title);
    expect(titles).toContain("Still shown");
    expect(titles.some((t) => t.startsWith("Independence"))).toBe(false);
    expect(await unreadCount()).toBe(1);
    const stored = await admin.query("SELECT 1 FROM notification WHERE user_id = $1 AND kind = 'independence-confirmation'", [READER]);
    expect(stored.rowCount).toBe(1);
  });

  it("never shows a negative zero percentage", () => {
    expect(Object.is(noNegativeZero(-0.001, 2), 0)).toBe(true);
    expect(new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(noNegativeZero(-0.001, 2))).toBe("0,00");
    expect(noNegativeZero(-0.5, 2)).toBe(-0.5);
  });
});
