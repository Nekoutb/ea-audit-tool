import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { AdminError, createFirm, listFirms } from "@/lib/admin";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Admin console · AuditISA" };

/**
 * The platform admin console (super admin only): every audit firm on the
 * platform with its footprint, and firm onboarding. Data segregation is
 * enforced below this screen by FORCE ROW LEVEL SECURITY per tenant; the
 * console itself only reads global tables and per-tenant rollups under each
 * tenant's own RLS context.
 */
export default async function AdminPage(props: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuper) redirect("/dashboard");
  const { error, ok } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const firms = await listFirms();

  async function createFirmAction(formData: FormData) {
    "use server";
    try {
      const r = await createFirm({
        name: String(formData.get("name") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        adminEmail: String(formData.get("adminEmail") ?? ""),
        adminName: String(formData.get("adminName") ?? ""),
        language: String(formData.get("language") ?? "fr") === "en" ? "en" : "fr",
      });
      redirect(`/admin?ok=${encodeURIComponent(r.tempPassword ? `created:${r.tempPassword}` : "created")}`);
    } catch (e) {
      if (e instanceof AdminError) redirect(`/admin?error=${encodeURIComponent(e.message)}`);
      throw e;
    }
  }

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-emerald-600";
  const th = "px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted bg-surface-2";
  const td = "border-t border-line px-4 py-2.5 text-[13px]";

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks />
      <h1 className="mt-5 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
        {fr ? "Console d'administration de la plateforme" : "Platform admin console"}
      </h1>
      <p className="mt-1 text-[12.5px] text-muted">
        {fr
          ? "Chaque cabinet est cloisonné par sécurité au niveau des lignes (RLS forcée) ; chaque mission est indépendante au sein du cabinet."
          : "Every firm is walled off by forced row-level security; every engagement is independent within its firm."}
      </p>

      {error ? <p role="alert" className="mt-3 text-[13px] font-semibold text-rose">{error}</p> : null}
      {ok ? (
        <p className="mt-3 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400" data-testid="admin-ok">
          {ok.startsWith("created:")
            ? `${fr ? "Cabinet créé — mot de passe provisoire (aussi envoyé par email)" : "Firm created — temporary password (also emailed)"}: ${ok.slice(8)}`
            : fr ? "Cabinet créé — email d'accueil envoyé." : "Firm created — onboarding email sent."}
        </p>
      ) : null}

      <Panel flush className="mt-4">
        <div className="border-b border-line px-4 py-3">
          <PanelHeader
            title={fr ? "Cabinets d'audit" : "Audit firms"}
            right={<span className="text-xs font-semibold text-muted tnum">{firms.length}</span>}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="admin-firms">
            <thead>
              <tr>
                <th className={th}>{fr ? "Cabinet" : "Firm"}</th>
                <th className={th}>Slug</th>
                <th className={th}>{fr ? "Utilisateurs" : "Users"}</th>
                <th className={th}>{fr ? "Clients" : "Clients"}</th>
                <th className={th}>{fr ? "Missions" : "Engagements"}</th>
                <th className={th}>{fr ? "Créé le" : "Created"}</th>
              </tr>
            </thead>
            <tbody>
              {firms.map((f) => (
                <tr key={f.id} className="hover:bg-surface-2" data-testid={`admin-firm-${f.slug}`}>
                  <td className={`${td} font-medium text-ink`}>{f.name}</td>
                  <td className={`${td} font-mono text-[11.5px] text-muted`}>{f.slug}</td>
                  <td className={`${td} tnum`}>{f.users}</td>
                  <td className={`${td} tnum`}>{f.clients}</td>
                  <td className={`${td} tnum`}>{f.engagements}</td>
                  <td className={`${td} text-muted tnum`}>{f.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-4">
        <PanelHeader title={fr ? "Intégrer un nouveau cabinet" : "Onboard a new audit firm"} hint={fr ? "l'administrateur reçoit l'email d'accueil" : "the admin receives the onboarding email"} />
        <form action={createFirmAction} className="mt-3 flex flex-wrap items-end gap-2.5" data-testid="admin-create-firm">
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Nom du cabinet" : "Firm name"}
            <input name="name" required className={`${input} w-[220px]`} data-testid="firm-name" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            Slug
            <input name="slug" required placeholder="my-firm" className={`${input} w-[140px]`} data-testid="firm-slug" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Email de l'administrateur" : "Admin email"}
            <input name="adminEmail" type="email" required className={`${input} w-[220px]`} data-testid="firm-admin-email" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Nom de l'administrateur" : "Admin name"}
            <input name="adminName" className={`${input} w-[180px]`} />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Langue" : "Language"}
            <select name="language" defaultValue="fr" className={input}>
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </label>
          <button type="submit" className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800" data-testid="firm-create">
            {fr ? "Créer le cabinet" : "Create firm"}
          </button>
        </form>
      </Panel>
    </main>
  );
}
