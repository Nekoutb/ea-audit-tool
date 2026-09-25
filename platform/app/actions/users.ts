"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  UserAdminError,
  changeUserRole,
  inviteFirmUser,
  removeFirmUser,
  resendInvite,
  resetUserPassword,
} from "@/lib/users";

async function run(fn: () => Promise<void>, success = "saved", value = "1"): Promise<never> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof UserAdminError) redirect(`/users?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
  revalidatePath("/users");
  redirect(`/users?${success}=${encodeURIComponent(value)}`);
}

export async function inviteUserAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  await run(
    () =>
      inviteFirmUser({
        email,
        name: String(formData.get("name") ?? ""),
        role: String(formData.get("role") ?? ""),
      }),
    "invited",
    email,
  );
}

/** Re-issue the set-password link to a colleague still waiting on one (UAT B87). */
export async function resendInviteAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  let email: string;
  try {
    email = (await resendInvite(userId)).email;
  } catch (error) {
    if (error instanceof UserAdminError) redirect(`/users?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
  revalidatePath("/users");
  redirect(`/users?invited=${encodeURIComponent(email)}`);
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
