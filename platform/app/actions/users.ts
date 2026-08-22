"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserAdminError, changeUserRole, inviteFirmUser, removeFirmUser, resetUserPassword } from "@/lib/users";

async function run(fn: () => Promise<void>, success = "saved"): Promise<never> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof UserAdminError) redirect(`/users?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
  revalidatePath("/users");
  redirect(`/users?${success}=1`);
}

export async function inviteUserAction(formData: FormData): Promise<void> {
  await run(() =>
    inviteFirmUser({
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      role: String(formData.get("role") ?? ""),
    }),
  );
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  await run(() => resetUserPassword(userId), "reset");
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  await run(() => changeUserRole(userId, role));
}

export async function removeUserAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  await run(() => removeFirmUser(userId));
}
