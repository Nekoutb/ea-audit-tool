import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/notifications";

/** Mark one notification read — used by the bell when a row is opened. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    const id = String(body.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "invalid-id" }, { status: 400 });
    await markNotificationRead(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }
}
