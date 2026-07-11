import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { uploadPbcAction } from "@/app/actions/pbc";
import { ErrorBanner } from "@/components/GatesPanel";
import { getBranding } from "@/lib/branding";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listPortalItems } from "@/lib/pbc";

/** 9.1 Client portal: PBC requests only — never the audit file (spec §2.3). */
export default async function PortalPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "client_user" || !session.user.clientId) redirect("/dashboard");

  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const [items, branding] = await Promise.all([
    listPortalItems(session.user.clientId),
    getBranding(), // the audit firm's identity — this is their client-facing page
  ]);

  return (
    <main className="min-h-screen bg-canvas px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">
              {branding.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URI, no optimizer benefit
                <img src={branding.logo} alt="" className="h-6 w-auto" />
              ) : null}
              <span data-testid="brand-name">{branding.displayName}</span>
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.01em] text-ink">
              {t.portal.title}
            </h1>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2"
            >
              {t.portal.signOut}
            </button>
          </form>
        </header>
        <ErrorBanner error={error} locale={locale} />

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink">{t.portal.welcome}</h2>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t.portal.empty}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3" data-testid="portal-items">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-[var(--radius-atlas)] border border-line bg-surface p-4 shadow-[var(--shadow-atlas)]"
                  data-testid={`portal-item-${item.title}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {item.title}{" "}
                        <span className="text-xs text-muted tnum">
                          · {item.clientName} {item.fiscalYear}
                        </span>
                      </p>
                      {item.note ? <p className="mt-1 text-xs text-muted">{item.note}</p> : null}
                      {item.filename ? (
                        <p className="mt-1 text-xs text-muted">
                          {t.portal.uploaded}: {item.filename}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={
                        item.status === "accepted"
                          ? "rounded-[var(--radius-atlas-xs)] bg-[var(--color-good-soft)] px-2 py-0.5 text-xs font-semibold text-good"
                          : item.status === "uploaded"
                            ? "rounded-[var(--radius-atlas-xs)] bg-[var(--color-warn-soft)] px-2 py-0.5 text-xs font-semibold text-warn"
                            : "rounded-[var(--radius-atlas-xs)] bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-soft"
                      }
                      data-testid={`portal-status-${item.title}`}
                    >
                      {t.portal.statuses[item.status]}
                    </span>
                  </div>
                  {item.status !== "accepted" ? (
                    <form action={uploadPbcAction.bind(null, item.id)} className="mt-3 flex items-center gap-2">
                      <input
                        type="file"
                        name="file"
                        required
                        className="text-xs text-ink-soft"
                        data-testid={`portal-file-${item.title}`}
                      />
                      <button
                        type="submit"
                        className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2"
                        data-testid={`portal-upload-${item.title}`}
                      >
                        {t.portal.upload}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
