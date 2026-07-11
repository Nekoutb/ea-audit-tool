import { expect, test, type Page } from "@playwright/test";

// Phase 1 acceptance (master spec §17): create engagement → instantiate D3.1
// from template → open (download) → edit → close (upload) → version 2 visible →
// sign off → locked. Plus the review-note gate on reviewer sign-off.

const EMAIL = "alice@firm-a.test";
const PASSWORD = "password";

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill("input[name=email]", EMAIL);
  await page.fill("input[name=password]", PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard");
}

test("full Phase 1 acceptance flow on D3.1", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);

  // Create a client (unique per run — engagement is unique per client+year).
  const clientName = `Acceptance SA ${Date.now()}`;
  await page.goto("/clients");
  await page.getByTestId("client-name").fill(clientName);
  await page.getByTestId("create-client").click();
  await page.waitForURL("**/clients/**");

  // Create the engagement; landing on the audit file page.
  await page.getByTestId("new-engagement").click();
  await page.waitForURL("**/new-engagement**");
  await page.getByTestId("engagement-year").fill("2025");
  await page.getByTestId("engagement-period-end").fill("2025-12-31");
  await page.getByTestId("cq-listed").check();
  await page.getByTestId("create-engagement").click();
  await page.waitForURL("**/engagements/**");

  // The A–F index is instantiated with the methodology's gaps preserved.
  await expect(page.getByTestId("file-item-D3.1")).toBeVisible();
  await expect(page.getByTestId("file-item-B10")).toBeVisible();
  await expect(page.getByTestId("file-item-F8")).toBeVisible();
  await expect(page.getByTestId("file-item-D2")).toHaveCount(0);
  await expect(page.getByTestId("file-item-D5.3")).toHaveCount(0);

  // Instantiate D3.1 from its template.
  await page.getByTestId("generate-doc-D3.1").click();
  await page.waitForURL("**/documents/**");
  await expect(page.getByTestId("download-current")).toContainText("v1");

  // "Open in Word": download version 1 — a real .docx (ZIP magic bytes).
  const downloadHref = await page.getByTestId("download-current").getAttribute("href");
  const download = await page.request.get(downloadHref!);
  expect(download.status()).toBe(200);
  const bytes = await download.body();
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
  expect(bytes.length).toBeGreaterThan(2000);

  // "Edit and close": check out, upload the edited file → version 2.
  await page.getByTestId("checkout").click();
  await page.getByTestId("upload-file").setInputFiles({
    name: "D3.1 edited.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: bytes,
  });
  await page.getByTestId("upload-submit").click();
  await expect(page.getByTestId("download-current")).toContainText("v2");
  await expect(page.getByTestId("versions-table")).toContainText("v2");

  // Preparer signs.
  await page.getByTestId("sign-preparer").click();
  await expect(page.getByTestId("signed-preparer")).toBeVisible();

  // Reviewer is blocked while a review note is open.
  await page.getByTestId("note-body").fill("Confirm the predecessor communication is filed.");
  await page.getByTestId("add-note").click();
  await page.getByTestId("sign-reviewer").click();
  await expect(page.getByTestId("doc-error")).toBeVisible();

  // Clear the note, then the reviewer sign-off locks the paper.
  await page.locator("[data-testid^=note-response-]").fill("Filed under D3.1 narrative.");
  await page.locator("[data-testid^=clear-note-]").click();
  await page.getByTestId("sign-reviewer").click();
  await expect(page.getByTestId("signed-reviewer")).toBeVisible();
  await expect(page.getByTestId("doc-status")).toContainText(/locked|verrouillée/i);

  // Locked: no check-out and no upload controls.
  await expect(page.getByTestId("checkout")).toHaveCount(0);
  await expect(page.getByTestId("upload-file")).toHaveCount(0);

  // Reopen with a reason voids the sign-offs and unlocks the paper.
  await page.getByTestId("reopen-reason").fill("Additional acceptance evidence received.");
  await page.getByTestId("reopen").click();
  await expect(page.getByTestId("doc-status")).toContainText(/Draft|Brouillon/i);
  await expect(page.getByTestId("checkout")).toBeVisible();
});
