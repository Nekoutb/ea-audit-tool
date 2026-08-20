import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { FirmOnboardingWizard } from "@/components/FirmOnboardingWizard";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { AdminError, checkAvailability, createFirm, listFirms, type Availability } from "@/lib/admin";
import { mailDomain } from "@/lib/email";
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
  const domain = mailDomain();

  async function createFirmAction(formData: FormData) {
    "use server";
    try {
      const r = await createFirm({
        name: String(formData.get("name") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        adminEmail: String(formData.get("adminEmail") ?? ""),
        adminName: String(formData.get("adminName") ?? ""),
        language: String(formData.get("language") ?? "fr") === "en" ? "en" : "fr",
        mailLocal: String(formData.get("mailLocal") ?? ""),
      });
      redirect(`/admin?ok=${r.emailed ? "created-emailed" : "created"}`);
    } catch (e) {
      if (e instanceof AdminError) redirect(`/admin?error=${encodeURIComponent(e.message)}`);
      throw e;
    }
  }

  async function checkAvailabilityAction(
    slug: string,
    mailLocal: string,
    adminEmail: string,
  ): Promise<Availability> {
    "use server";
    // requireSuper() runs inside checkAvailability — a server action is a public
    // endpoint, so the console being super-admin-only is not the control here.
    return checkAvailability({ slug, mailLocal, adminEmail });
  }

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
          {ok === "created-emailed"
            ? fr
              ? "Cabinet créé. Le mot de passe provisoire a été envoyé à l'administrateur par email ; il devra le remplacer à la première connexion."
              : "Firm created. The temporary password was emailed to the administrator, who must replace it at first sign-in."
            : fr
              ? "Cabinet créé — l'administrateur utilise son mot de passe existant."
              : "Firm created — the administrator uses their existing password."}
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
                <th className={th}>{fr ? "Adresse d'envoi" : "Sending address"}</th>
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
                  <td className={`${td} font-mono text-[11.5px] text-ink-soft`} data-testid={`admin-firm-mail-${f.slug}`}>
                    {f.mailLocal ? `${f.mailLocal}@${domain}` : "—"}
                  </td>
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
        <PanelHeader
          title={fr ? "Intégrer un cabinet d'audit" : "Onboard an audit firm"}
          hint={
            fr
              ? "quatre étapes ; rien n'est écrit avant la dernière"
              : "four steps; nothing is written until the last one"
          }
        />
        <div className="mt-3">
          <FirmOnboardingWizard
            domain={domain}
            locale={locale}
            createAction={createFirmAction}
            checkAction={checkAvailabilityAction}
          />
        </div>
      </Panel>
    </main>
  );
}
