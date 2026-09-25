"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { acceptPbc, addPbcItem, addPortalContact, attachAcceptedPbc, chasePbc, uploadPbc } from "@/lib/pbc";
import { UnsafeFileError } from "@/lib/upload-safety";

async function guarded(path: string, fn: () => Promise<string | void>): Promise<never> {
  let target = path;
  try {
    const result = await fn();
    if (typeof result === "string") target = result;
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(path);
  redirect(target);
}

export async function addPbcItemAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(`/engagements/${engagementId}/pbc`, async () => {
    await addPbcItem(engagementId, String(formData.get("title") ?? ""), String(formData.get("note") ?? ""));
  });
}

/** Firm side: remind the client of a request still outstanding (UAT B112). */
export async function chasePbcAction(engagementId: string, itemId: string): Promise<void> {
  await guarded(`/engagements/${engagementId}/pbc`, async () => {
    await chasePbc(itemId);
  });
}

export async function acceptPbcAction(engagementId: string, itemId: string, formData: FormData): Promise<void> {
  await guarded(`/engagements/${engagementId}/pbc`, async () => {
    const fileItemId = String(formData.get("fileItemId") ?? "");
    try {
      const documentId = await acceptPbc(itemId, fileItemId || undefined);
      if (documentId) return `/documents/${documentId}`;
    } catch (error) {
      // an upload that predates the portal allowlist is refused on its way into the file
      if (error instanceof UnsafeFileError) throw new Error("file-type");
      throw error;
    }
  });
}

/** Firm side: file an already-accepted upload under a section it was never attached to. */
export async function attachPbcAction(engagementId: string, itemId: string, formData: FormData): Promise<void> {
  await guarded(`/engagements/${engagementId}/pbc`, async () => {
    try {
      const documentId = await attachAcceptedPbc(itemId, String(formData.get("fileItemId") ?? ""));
      return `/documents/${documentId}`;
    } catch (error) {
      if (error instanceof UnsafeFileError) throw new Error("file-type");
      throw error;
    }
  });
}

/** Portal side: the client user uploads a response to a PBC item. */
export async function uploadPbcAction(itemId: string, formData: FormData): Promise<void> {
  await guarded("/portal", async () => {
    const session = await auth();
    const clientId = session?.user?.clientId;
    if (!clientId) throw new Error("forbidden");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("file-required");
    try {
      await uploadPbc(itemId, clientId, {
        filename: file.name,
        mime: file.type || "application/octet-stream",
        content: Buffer.from(await file.arrayBuffer()),
      });
    } catch (error) {
      // The allowlist refusal (executable, wrong bytes for the extension, …)
      // becomes one banner code the portal page can show.
      if (error instanceof UnsafeFileError) throw new Error("file-type");
      throw error;
    }
  });
}

export async function addPortalContactAction(clientId: string, formData: FormData): Promise<void> {
  await guarded(`/clients/${clientId}`, async () => {
    await addPortalContact(clientId, {
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  });
}
