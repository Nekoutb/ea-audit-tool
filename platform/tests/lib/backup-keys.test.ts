import { describe, expect, it } from "vitest";

// The rule these tests defend: a firm renaming itself must not move a single
// object. Object Lock retention is set per bucket and applied at PUT, and a
// COMPLIANCE-locked object cannot be moved — only copied — so a slug in the
// path would strand a decade of a renamed firm's archived files under a prefix
// nobody would think to look in.

import {
  bucketFor,
  dbPrefix,
  engagementArchiveKey,
  engagementPrefix,
  engagementRollingKey,
  parseKey,
  runId,
  slugify,
  tenantFullKey,
  tenantPrefix,
} from "@/lib/backup/keys.mjs";

const TENANT = "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b101";
const ENGAGEMENT = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c101";

describe("object keys", () => {
  it("puts ids in the path and names in the filename", () => {
    const before = tenantFullKey({
      tenantId: TENANT,
      tenantName: "Cabinet Alpha",
      runid: "20260904T022300Z",
    });
    const after = tenantFullKey({
      tenantId: TENANT,
      tenantName: "Cabinet Bêta & Co",
      runid: "20260904T022300Z",
    });
    expect(before.startsWith(tenantPrefix(TENANT))).toBe(true);
    expect(after.startsWith(tenantPrefix(TENANT))).toBe(true);
    // Same directory, different filename: a rename never orphans an object.
    expect(before.slice(0, before.lastIndexOf("/"))).toBe(after.slice(0, after.lastIndexOf("/")));
    expect(before).toContain("cabinet-alpha");
    expect(after).toContain("cabinet-b-ta-co");
  });

  it("nests an engagement under its firm", () => {
    expect(engagementPrefix(TENANT, ENGAGEMENT)).toBe(`tenant/${TENANT}/engagement/${ENGAGEMENT}`);
  });

  it("refuses anything that is not a uuid", () => {
    expect(() => tenantPrefix("cabinet-alpha")).toThrow(/must be a uuid/);
    expect(() => engagementPrefix(TENANT, "../../etc")).toThrow(/must be a uuid/);
  });

  it("sorts chronologically as text", () => {
    const early = runId(new Date("2026-09-04T02:23:00Z"));
    const late = runId(new Date("2026-09-04T22:23:00Z"));
    const next = runId(new Date("2026-12-31T23:59:59Z"));
    expect([late, next, early].sort()).toEqual([early, late, next]);
    expect(early).toBe("20260904T022300Z");
  });

  it("routes only the archival copies to the immutable bucket", () => {
    // This function is the whole of the WORM policy.
    expect(
      bucketFor(
        engagementArchiveKey({
          tenantId: TENANT,
          engagementId: ENGAGEMENT,
          clientName: "Client X",
          fiscalYear: 2025,
          archivedAt: "2026-03-04T10:00:00Z",
        }),
      ),
    ).toBe("archive");
    expect(bucketFor(dbPrefix("20270101T022300Z", "yearly"))).toBe("archive");

    expect(bucketFor(dbPrefix("20260904T022300Z", "daily"))).toBe("dr");
    expect(bucketFor(dbPrefix("20260906T022300Z", "weekly"))).toBe("dr");
    expect(
      bucketFor(tenantFullKey({ tenantId: TENANT, tenantName: "A", runid: "20260904T022300Z" })),
    ).toBe("dr");
    expect(
      bucketFor(
        engagementRollingKey({
          tenantId: TENANT,
          engagementId: ENGAGEMENT,
          clientName: "Client X",
          fiscalYear: 2025,
          runid: "20260904T022300Z",
        }),
      ),
    ).toBe("dr");
  });

  it("names the archival copy by the archive date, not the run", () => {
    const key = engagementArchiveKey({
      tenantId: TENANT,
      engagementId: ENGAGEMENT,
      clientName: "Société Générale",
      fiscalYear: 2025,
      archivedAt: "2026-03-04T10:00:00Z",
    });
    expect(key).toContain("/archive/2026-03-04--soci-t-g-n-rale-FY2025");
  });

  it("round-trips through parseKey", () => {
    const cases = [
      tenantFullKey({ tenantId: TENANT, tenantName: "A", runid: "20260904T022300Z" }),
      engagementRollingKey({
        tenantId: TENANT,
        engagementId: ENGAGEMENT,
        clientName: "C",
        fiscalYear: 2025,
        runid: "20260904T022300Z",
      }),
      engagementArchiveKey({
        tenantId: TENANT,
        engagementId: ENGAGEMENT,
        clientName: "C",
        fiscalYear: 2025,
        archivedAt: "2026-03-04T10:00:00Z",
      }),
      dbPrefix("20260904T022300Z", "daily"),
    ];
    for (const key of cases) expect(parseKey(key), key).not.toBeNull();
    expect(
      parseKey(tenantFullKey({ tenantId: TENANT, tenantName: "A", runid: "20260904T022300Z" })),
    ).toMatchObject({
      kind: "tenant-full",
      tenantId: TENANT,
    });
    expect(parseKey("nonsense/thing")).toBeNull();
  });

  it("never produces an empty slug segment", () => {
    expect(slugify("")).toBe("unnamed");
    expect(slugify("///")).toBe("unnamed");
    expect(slugify(null, "client")).toBe("client");
  });
});
