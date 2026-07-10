"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { acceptPbc, addPbcItem, addPortalContact, uploadPbc } from "@/lib/pbc";

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

export async function acceptPbcAction(engagementId: string, itemId: string, formData: FormData): Promise<void> {
  await guarded(`/engagements/${engagementId}/pbc`, async () => {
    const fileItemId = String(formData.get("fileItemId") ?? "");
    const documentId = await acceptPbc(itemId, fileItemId || undefined);
    if (documentId) return `/documents/${documentId}`;
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
    await uploadPbc(itemId, clientId, {
      filename: file.name,
      mime: file.type || "application/octet-stream",
      content: Buffer.from(await file.arrayBuffer()),
    });
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
