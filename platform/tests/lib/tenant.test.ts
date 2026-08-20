import { describe, expect, it, vi } from "vitest";

const TENANT = "7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c";
const USER = "7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c01";
const CLIENT = "7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c02";

let session: { user: Record<string, unknown> } | null = null;

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => session),
}));

import { ForbiddenError, requirePortalUser, requireRole, requireTenant, requireWrite } from "@/lib/tenant";

function signedInAs(role: string, clientId: string | null = null) {
  session = { user: { id: USER, tenantId: TENANT, role, locale: "en", clientId } };
}

/**
 * The authorization boundary. Before this existed, requireTenant() checked only
 * that a session carried a tenantId — so read_only could write and a portal
 * account could reach any firm function whose id it could name.
 */
describe("requireTenant", () => {
  it("returns the context for ordinary firm roles", async () => {
    for (const role of ["staff", "senior", "manager", "partner", "firm_admin"]) {
      signedInAs(role);
      await expect(requireTenant()).resolves.toMatchObject({ tenantId: TENANT, userId: USER, role });
    }
  });

  it("refuses a portal account", async () => {
    signedInAs("client_user", CLIENT);
    await expect(requireTenant()).rejects.toThrow(ForbiddenError);
    await expect(requireTenant()).rejects.toThrow("portal-account");
  });

  it("still admits read_only, which may read", async () => {
    signedInAs("read_only");
    await expect(requireTenant()).resolves.toMatchObject({ role: "read_only" });
  });

  it("throws when there is no session at all", async () => {
    session = null;
    await expect(requireTenant()).rejects.toThrow(/UNAUTHENTICATED/);
  });

  it("throws when the session carries no tenant", async () => {
    session = { user: { id: USER, role: "staff" } };
    await expect(requireTenant()).rejects.toThrow(/UNAUTHENTICATED/);
  });
});

describe("requireWrite", () => {
  it("admits every role that may change something", async () => {
    for (const role of ["staff", "senior", "eqr_reviewer", "manager", "partner", "firm_admin"]) {
      signedInAs(role);
      await expect(requireWrite()).resolves.toMatchObject({ role });
    }
  });

  it("refuses read_only", async () => {
    signedInAs("read_only");
    await expect(requireWrite()).rejects.toThrow("read-only-role");
  });

  it("refuses a portal account before it reaches the read_only check", async () => {
    signedInAs("client_user", CLIENT);
    await expect(requireWrite()).rejects.toThrow("portal-account");
  });
});

describe("requireRole", () => {
  it("admits a role at the floor", async () => {
    signedInAs("manager");
    await expect(requireRole("manager")).resolves.toMatchObject({ role: "manager" });
  });

  it("admits a role above the floor", async () => {
    signedInAs("partner");
    await expect(requireRole("manager")).resolves.toMatchObject({ role: "partner" });
  });

  it("refuses a role below the floor, naming what was required", async () => {
    signedInAs("staff");
    await expect(requireRole("partner")).rejects.toThrow("requires-partner");
  });

  it("renders a multi-word floor as a hyphenated code", async () => {
    signedInAs("partner");
    await expect(requireRole("firm_admin")).rejects.toThrow("requires-firm-admin");
  });

  it("treats eqr_reviewer as manager-rank for review authority", async () => {
    signedInAs("eqr_reviewer");
    await expect(requireRole("manager")).resolves.toMatchObject({ role: "eqr_reviewer" });
  });

  it("refuses read_only whatever the floor", async () => {
    signedInAs("read_only");
    await expect(requireRole("staff")).rejects.toThrow("read-only-role");
  });
});

describe("requirePortalUser", () => {
  it("returns the client id for a portal account", async () => {
    signedInAs("client_user", CLIENT);
    await expect(requirePortalUser()).resolves.toMatchObject({ role: "client_user", clientId: CLIENT });
  });

  it("refuses firm staff, so one function cannot serve both surfaces", async () => {
    signedInAs("manager");
    await expect(requirePortalUser()).rejects.toThrow("not-a-portal-account");
  });

  it("refuses a portal account with no client attached", async () => {
    signedInAs("client_user", null);
    await expect(requirePortalUser()).rejects.toThrow("not-a-portal-account");
  });
});
