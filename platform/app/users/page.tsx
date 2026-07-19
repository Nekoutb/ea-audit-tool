import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { changeRoleAction, inviteUserAction, removeUserAction } from "@/app/actions/users";
import { AppNav } from "@/components/AppNav";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { canManageFirm, type Role } from "@/lib/rbac";
import { ASSIGNABLE_ROLES, listFirmUsers } from "@/lib/users";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Users · AuditISA" };

export default async function UsersPage(props: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canManageFirm(session.user.role as Role)) redirect("/dashboard");

  const { error, saved } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tu = t.users;
  const users = await listFirmUsers();

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const label = "flex flex-col gap-1 text-sm text-ink-soft";
  const roleName = (r: string) => (tu.roles as Record<string, string>)[r] ?? r;

  return (
    <main className="min-h-screen w-full px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.01em] text-ink">{tu.title}</h1>
      <p className="mt-1 text-[13px] text-ink-soft">{tu.subtitle}</p>

      {error ? (
        <p data-testid="users-error" className="mt-4 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-[var(--color-rose-soft)] px-4 py-3 text-sm text-rose">
          {(tu.errors as Record<string, string>)[error] ?? error}
        </p>
      ) : null}
      {saved ? (
        <p data-testid="users-saved" className="mt-4 rounded-[var(--radius-atlas-sm)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {tu.saved}
        </p>
      ) : null}

      <Panel flush className="mt-6">
        <div className="border-b border-line px-5 py-4">
          <PanelHeader title={tu.firmUsers} hint={String(users.length)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="users-table">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">{tu.name}</th>
                <th className="px-5 py-3 font-semibold">{tu.email}</th>
                <th className="px-5 py-3 font-semibold">{tu.role}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line" data-testid={`user-row-${u.email}`}>
                  <td className="px-5 py-3 font-medium text-ink">{u.name ?? "—"}{u.isSelf ? <span className="ml-2 text-xs text-muted">({tu.you})</span> : null}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-soft">{u.email}</td>
                  <td className="px-5 py-3">
                    {u.isSelf ? (
                      <span className="text-ink-soft">{roleName(u.role)}</span>
                    ) : (
                      <form action={changeRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <select name="role" defaultValue={u.role} className={input} data-testid={`role-${u.email}`}>
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{roleName(r)}</option>
                          ))}
                        </select>
                        <button type="submit" className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-2">
                          {tu.saveRole}
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.isSelf ? null : (
                      <form action={removeUserAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button type="submit" data-testid={`remove-${u.email}`} className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-2.5 py-1.5 text-xs font-semibold text-rose hover:bg-[var(--color-rose-soft)]">
                          {tu.remove}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-8 p-6">
        <PanelHeader title={tu.invite} hint={tu.inviteHint} />
        <form action={inviteUserAction} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className={label}>{tu.name}<input name="name" required className={input} data-testid="invite-name" /></label>
          <label className={label}>{tu.email}<input name="email" type="email" required className={input} data-testid="invite-email" /></label>
          <label className={label}>{tu.role}
            <select name="role" defaultValue="staff" className={input} data-testid="invite-role">
              {ASSIGNABLE_ROLES.map((r) => (<option key={r} value={r}>{roleName(r)}</option>))}
            </select>
          </label>
          <label className={label}>{tu.password}<input name="password" type="password" required minLength={8} className={input} data-testid="invite-password" /></label>
          <button type="submit" className={`self-end ${btnPrimary}`} data-testid="invite-submit">{tu.inviteButton}</button>
        </form>
      </Panel>
    </main>
  );
}
