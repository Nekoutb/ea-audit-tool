import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { FirmOnboardingWizard } from "@/components/FirmOnboardingWizard";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { AdminError, checkAvailability, createFirm, deleteFirm, listFirms, type Availability } from "@/lib/admin";
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

  async function deleteFirmAction(formData: FormData) {
    "use server";
    // requireSuper() runs inside deleteFirm — same reasoning as availability:
    // a server action is a public endpoint, the console page is not the gate.
    try {
      await deleteFirm(String(formData.get("tenantId") ?? ""), String(formData.get("confirmSlug") ?? ""));
      redirect("/admin?ok=deleted");
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

      {error ? (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-rose">
          {error === "confirm-mismatch"
            ? fr
              ? "Suppression refusée : tapez le slug exact du cabinet dans le champ de confirmation."
              : "Deletion refused: type the firm's exact slug in the confirmation field."
            : error === "firm-has-archived-files"
              ? fr
                ? "Suppression refusée : ce cabinet détient des dossiers d'audit archivés sous obligation de conservation (ISA 230)."
                : "Deletion refused: this firm holds archived audit files under a retention obligation (ISA 230)."
              : error === "firm-has-legal-hold"
                ? fr
                  ? "Suppression refusée : une mission de ce cabinet est sous conservation légale."
                  : "Deletion refused: an engagement of this firm is under legal hold."
                : error === "firm-holds-operator-membership"
                  ? fr
                    ? "Suppression refusée : ce cabinet porte la seule appartenance de l'opérateur de la plateforme — rattachez d'abord son compte à un autre cabinet."
                    : "Deletion refused: this firm holds the platform operator's only membership — attach their account to another firm first."
                  : error === "firm-protected"
                    ? fr
                      ? "Suppression refusée : ce cabinet est protégé (hébergement de l'opérateur de la plateforme)."
                      : "Deletion refused: this firm is protected (the platform operator's home)."
                    : error}
        </p>
      ) : null}
      {ok ? (
        <p className="mt-3 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400" data-testid="admin-ok">
          {ok === "created-emailed"
            ? fr
              ? "Cabinet créé. Le mot de passe provisoire a été envoyé à l'administrateur par email ; il devra le remplacer à la première connexion."
              : "Firm created. The temporary password was emailed to the administrator, who must replace it at first sign-in."
            : ok === "deleted"
              ? fr
                ? "Cabinet supprimé, ainsi que ses données et les comptes qui n'appartenaient qu'à lui."
                : "Firm deleted, with its data and the accounts that belonged only to it."
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
                <th className={th}>{fr ? "Supprimer" : "Delete"}</th>
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
                  <td className={td}>
                    {f.protected ? (
                      <span className="text-[11px] font-semibold text-muted" data-testid={`protected-${f.slug}`}>
                        {fr ? "🔒 Protégé — hébergement de l'opérateur" : "🔒 Protected — operator home"}
                      </span>
                    ) : (
                    <form action={deleteFirmAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="tenantId" value={f.id} />
                      <input
                        name="confirmSlug"
                        placeholder={f.slug}
                        autoComplete="off"
                        spellCheck={false}
                        className="w-32 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 font-mono text-[11px] text-ink outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                        aria-label={fr ? `Taper ${f.slug} pour confirmer` : `Type ${f.slug} to confirm`}
                        data-testid={`delete-confirm-${f.slug}`}
                      />
                      <button
                        type="submit"
                        className="rounded-[var(--radius-atlas-sm)] border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        data-testid={`delete-firm-${f.slug}`}
                      >
                        {fr ? "Supprimer" : "Delete"}
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
