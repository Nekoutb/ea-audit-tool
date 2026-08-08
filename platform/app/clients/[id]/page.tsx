import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateClientMasterAction } from "@/app/actions/clients";
import { addPortalContactAction } from "@/app/actions/pbc";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { NavLink } from "@/components/NavLink";
import { SubmitButton } from "@/components/SubmitButton";
import { Chip, Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { FRAMEWORKS, getClient } from "@/lib/clients";
import { withTenant } from "@/lib/db";
import { listEngagements } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listPortalContacts } from "@/lib/pbc";
import { requireTenant } from "@/lib/tenant";

export const metadata = { title: "Entity record · AuditISA" };

// Page-local labels (IA audit 5D — entity-record strings are not in messages/*.json yet).
const LABELS = {
  en: {
    back: "Back to register",
    identity: "Identity",
    identityHint: "Master data reused across engagements",
    registrationNumber: "Registration nº",
    niu: "Tax ID (NIU)",
    address: "Registered address",
    yearEnd: "Year-end",
    framework: "Framework",
    frameworkOther: "Other",
    pie: "Public-interest entity (PIE)",
    pieChip: "PIE",
    yes: "Yes",
    no: "No",
    save: "Save",
    history: "Engagement history",
    opinion: "Opinion",
    reportDate: "Report date",
    newEngagement: "New engagement for this entity",
    opinions: {
      unmodified: "Unmodified",
      qualified: "Qualified",
      adverse: "Adverse",
      disclaimer: "Disclaimer",
    },
  },
  fr: {
    back: "Retour au registre",
    identity: "Identité",
    identityHint: "Données de référence réutilisées d'une mission à l'autre",
    registrationNumber: "Nº d'immatriculation",
    niu: "NIU",
    address: "Adresse du siège",
    yearEnd: "Clôture d'exercice",
    framework: "Référentiel",
    frameworkOther: "Autre",
    pie: "Entité d'intérêt public (EIP)",
    pieChip: "EIP",
    yes: "Oui",
    no: "Non",
    save: "Enregistrer",
    history: "Historique des missions",
    opinion: "Opinion",
    reportDate: "Date du rapport",
    newEngagement: "Nouvelle mission pour cette entité",
    opinions: {
      unmodified: "Non modifiée",
      qualified: "Avec réserve",
      adverse: "Défavorable",
      disclaimer: "Impossibilité",
    },
  },
} as const;

type Opinion = "unmodified" | "qualified" | "adverse" | "disclaimer";

/** One query: each engagement's issued opinion, joined to the history rows in TS. */
async function listOpinions(clientId: string): Promise<Map<string, Opinion | null>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; opinion: Opinion | null }>(
      "SELECT id, opinion FROM engagement WHERE client_id = $1",
      [clientId],
    );
    return new Map(result.rows.map((row) => [row.id, row.opinion]));
  });
}

export default async function ClientDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const L = LABELS[locale];

  const client = await getClient(id);
  if (!client) notFound();
  const [engagements, contacts, opinions] = await Promise.all([
    listEngagements(id),
    listPortalContacts(id),
    listOpinions(id),
  ]);

  const isAdmin = session.user.role === "firm_admin";

  const inputClass =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const th =
    "border-b border-line bg-surface-2 px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const td = "border-t border-line px-5 py-3.5 text-[13px] text-ink-soft";

  const identityRows: Array<[string, string | null]> = [
    [L.registrationNumber, client.registrationNumber ?? null],
    [L.niu, client.niu ?? null],
    [L.yearEnd, client.yearEnd ?? null],
    [L.framework, client.framework === "Other" ? L.frameworkOther : (client.framework ?? null)],
    [L.pie, client.pie ? L.yes : L.no],
    [L.address, client.address ?? null],
  ];

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />

      <div className="mt-8">
        <NavLink
          href="/engagements"
          className="inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          testId="back-to-register"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {L.back}
        </NavLink>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{client.name}</h1>
          <Chip tone="muted">{client.legalForm}</Chip>
          {client.listed ? <Chip tone="accent">{t.clients.listed}</Chip> : null}
          {client.coCac ? <Chip tone="accent">{t.clients.coCac}</Chip> : null}
          {client.pie ? <Chip tone="warn">{L.pieChip}</Chip> : null}
        </div>
      </div>

      <Panel className="mt-6 p-6" data-testid="entity-identity">
        <PanelHeader title={L.identity} hint={L.identityHint} />
        {isAdmin ? (
          <form
            action={updateClientMasterAction.bind(null, client.id)}
            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">{L.registrationNumber}</span>
              <input
                name="registrationNumber"
                defaultValue={client.registrationNumber ?? ""}
                className={inputClass}
                data-testid="entity-registration"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">{L.niu}</span>
              <input name="niu" defaultValue={client.niu ?? ""} className={inputClass} data-testid="entity-niu" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">{L.yearEnd}</span>
              <input
                name="yearEnd"
                defaultValue={client.yearEnd ?? ""}
                placeholder="31/12"
                className={inputClass}
                data-testid="entity-year-end"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">{L.framework}</span>
              <select
                name="framework"
                defaultValue={client.framework ?? ""}
                className={inputClass}
                data-testid="entity-framework"
              >
                <option value="">—</option>
                {FRAMEWORKS.map((framework) => (
                  <option key={framework} value={framework}>
                    {framework === "Other" ? L.frameworkOther : framework}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-ink-soft">{L.address}</span>
              <input
                name="address"
                defaultValue={client.address ?? ""}
                className={inputClass}
                data-testid="entity-address"
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                name="pie"
                defaultChecked={client.pie ?? false}
                className="h-4 w-4 accent-emerald-700"
                data-testid="entity-pie"
              />
              {L.pie}
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <SubmitButton className={btnPrimary} testId="entity-save">
                {L.save}
              </SubmitButton>
            </div>
          </form>
        ) : (
          <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {identityRows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted">{label}</dt>
                <dd className="mt-1 text-sm text-ink">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <Panel flush className="mt-4" data-testid="entity-history">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader
            title={L.history}
            right={
              <Link href={`/new-engagement?client=${client.id}`} className={btnPrimary} data-testid="new-engagement">
                {L.newEngagement}
              </Link>
            }
          />
        </div>
        {engagements.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">{t.engagements.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]" data-testid="client-engagements">
              <thead>
                <tr>
                  <th className={th}>{t.engagements.fiscalYear}</th>
                  <th className={th}>{t.engagements.stage}</th>
                  <th className={th}>{L.opinion}</th>
                  <th className={th}>{L.reportDate}</th>
                  <th className={`${th} text-right`} />
                </tr>
              </thead>
              <tbody>
                {engagements.map((engagement) => {
                  const opinion = opinions.get(engagement.id) ?? null;
                  return (
                    <tr
                      key={engagement.id}
                      className="transition-colors hover:bg-surface-2"
                      data-testid={`history-row-${engagement.id}`}
                    >
                      <td className="border-t border-line px-5 py-3.5 text-[13.5px] font-semibold text-ink tnum">
                        {engagement.fiscalYear}
                      </td>
                      <td className={td}>{t.engagements.stages[engagement.phase]}</td>
                      <td className={td}>{opinion ? L.opinions[opinion] : "—"}</td>
                      <td className={`${td} tnum`}>{engagement.reportDate ?? "—"}</td>
                      <td className="border-t border-line px-5 py-3.5 text-right">
                        <Link
                          href={`/engagements/${engagement.id}/dashboard`}
                          className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          {t.engagements.open}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="mt-4 p-6">
        <PanelHeader title={t.pbc.contacts} />
        <ErrorBanner error={error} locale={locale} />
        {contacts.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-soft" data-testid="portal-contacts">
            {contacts.map((contact) => (
              <li key={contact.id}>
                {contact.name ?? contact.email} — <span className="font-mono text-xs">{contact.email}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={addPortalContactAction.bind(null, client.id)} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.pbc.contactName}</span>
            <input name="name" required className={inputClass} data-testid="contact-name" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.pbc.contactEmail}</span>
            <input name="email" type="email" required className={inputClass} data-testid="contact-email" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{t.pbc.contactPassword}</span>
            <input name="password" type="password" required minLength={8} className={inputClass} data-testid="contact-password" />
          </label>
          <button
            type="submit"
            data-testid="add-contact"
            className={btnPrimary}
          >
            {t.pbc.addContact}
          </button>
        </form>
      </Panel>
    </main>
  );
}
