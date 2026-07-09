import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { sendTestNotification } from "@/app/actions/notifications";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { withTenant } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { unreadCount } from "@/lib/notifications";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { email, role, tenantId } = session.user;
  const locale = await getLocale();
  const t = getMessages(locale);

  // Tenant-scoped read: RLS guarantees these rows belong only to this firm.
  const notes = await withTenant(tenantId, async (client) => {
    const result = await client.query<{ note: string }>(
      "SELECT note FROM rls_probe ORDER BY created_at",
    );
    return result.rows.map((row) => row.note);
  });

  const unread = await unreadCount();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">
            {t.common.appName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {t.dashboard.title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/notifications"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-400"
          >
            {t.notifications.link}
            {unread > 0 ? (
              <span
                data-testid="unread-badge"
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-700 px-1.5 text-xs font-semibold text-white"
              >
                {unread}
              </span>
            ) : null}
          </Link>
          <LanguageSwitcher current={locale} />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.common.signOut}
            </button>
          </form>
        </div>
      </header>

      <section className="mt-8">
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.dashboard.signedInAs}</p>
        <p className="text-lg font-medium text-slate-900 dark:text-slate-100">{email}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <dt className="text-slate-500 dark:text-slate-400">{t.dashboard.role}</dt>
            <dd className="mt-1 font-mono text-slate-900 dark:text-slate-100">{role}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <dt className="text-slate-500 dark:text-slate-400">{t.dashboard.tenant}</dt>
            <dd className="mt-1 font-mono text-xs text-slate-900 dark:text-slate-100">{tenantId}</dd>
          </div>
        </dl>

        <div className="mt-8">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.dashboard.firmData}</p>
          <ul className="mt-2 flex flex-col gap-1" data-testid="firm-notes">
            {notes.map((note) => (
              <li
                key={note}
                className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              >
                {note}
              </li>
            ))}
          </ul>
        </div>

        <form
          action={async () => {
            "use server";
            await sendTestNotification();
          }}
          className="mt-8"
        >
          <button
            type="submit"
            data-testid="send-test-notification"
            className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            {t.dashboard.sendTestNotification}
          </button>
        </form>

        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">{t.dashboard.phase1Note}</p>
      </section>
    </main>
  );
}
