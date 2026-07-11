import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  addEstimateAction,
  addRelatedPartyAction,
  raiseRiskAction,
  saveFormAction,
} from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel, PanelHeader, Chip, btnPrimary, btnGhost } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { fieldLabel, FORM_DEFINITIONS, loadForm } from "@/lib/forms";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { requireTenant } from "@/lib/tenant";

async function subRegisters(engagementId: string, code: string) {
  if (code !== "D5.6" && code !== "D5.7") return { parties: [], estimates: [] };
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const parties =
      code === "D5.6"
        ? (
            await tx.query<{ id: string; name: string; relationship: string; notes: string | null; carried_forward: boolean }>(
              "SELECT id, name, relationship, notes, carried_forward FROM related_party WHERE engagement_id = $1 ORDER BY name",
              [engagementId],
            )
          ).rows
        : [];
    const estimates =
      code === "D5.7"
        ? (
            await tx.query<{ id: string; nature: string; method: string | null; uncertainty: string | null }>(
              "SELECT id, nature, method, uncertainty FROM accounting_estimate WHERE engagement_id = $1 ORDER BY created_at",
              [engagementId],
            )
          ).rows
        : [];
    return { parties, estimates };
  });
}

export default async function FormPage(props: {
  params: Promise<{ id: string; code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, code: rawCode } = await props.params;
  const code = decodeURIComponent(rawCode);
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tp = t.planning;

  const definition = FORM_DEFINITIONS[code];
  const engagement = await getEngagement(id);
  if (!definition || !engagement) notFound();

  const [{ values, carried }, registers] = await Promise.all([
    loadForm(id, code),
    subRegisters(id, code),
  ]);

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em] text-ink">
        {code} · {engagement.clientName} — {engagement.fiscalYear}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="planning" />
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-6">
        <form action={saveFormAction.bind(null, id, code)} className="flex flex-col gap-4">
          {definition.fields.map((field) => {
            const value = values[field.key];
            const isCarried = carried.has(field.key);
            return (
              <label key={field.key} className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-center gap-2 text-ink-soft">
                  <span>
                    {fieldLabel(field, locale)}
                    {field.required ? " *" : ""}
                  </span>
                  {isCarried ? (
                    <span data-testid={`carried-${field.key}`}>
                      <Chip tone="warn">{tp.carriedForward}</Chip>
                    </span>
                  ) : null}
                </span>
                {field.type === "boolean" ? (
                  // Yes/No select (not a checkbox): unanswered stays unanswered,
                  // so required checks are only "complete" once explicitly chosen.
                  <select
                    name={field.key}
                    defaultValue={value === true ? "yes" : value === false ? "no" : ""}
                    className={input}
                    data-testid={`field-${field.key}`}
                  >
                    <option value="" />
                    <option value="yes">{t.common.yes}</option>
                    <option value="no">{t.common.no}</option>
                  </select>
                ) : field.type === "select" ? (
                  <select
                    name={field.key}
                    defaultValue={value === undefined ? "" : String(value)}
                    className={input}
                    data-testid={`field-${field.key}`}
                  >
                    <option value="" />
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === "text" ? (
                  <textarea
                    name={field.key}
                    defaultValue={value === undefined ? "" : String(value)}
                    rows={2}
                    className={input}
                    data-testid={`field-${field.key}`}
                  />
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "date"}
                    name={field.key}
                    defaultValue={value === undefined ? "" : String(value)}
                    className={`${input} tnum`}
                    data-testid={`field-${field.key}`}
                  />
                )}
              </label>
            );
          })}
          <div>
            <button type="submit" className={btnPrimary} data-testid="save-form">
              {tp.save}
            </button>
          </div>
        </form>
      </Panel>

      {code === "D5.6" ? (
        <Panel className="mt-8">
          <PanelHeader title={`${t.fileIndex.title} — D5.6`} />
          <ul className="mt-4 flex flex-col gap-2 text-sm" data-testid="related-parties">
            {registers.parties.map((party) => (
              <li
                key={party.id}
                className="flex flex-wrap items-center gap-x-1.5 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-ink-soft"
              >
                <span className="font-medium text-ink">{party.name}</span> — {party.relationship}
                {party.notes ? ` · ${party.notes}` : ""}
                {party.carried_forward ? <Chip tone="warn">{tp.carriedForward}</Chip> : null}
              </li>
            ))}
          </ul>
          <form action={addRelatedPartyAction.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3">
            <input name="name" placeholder="Nom / Name" required className={input} data-testid="rp-name" />
            <input name="relationship" placeholder="Relation" required className={input} data-testid="rp-relationship" />
            <input name="notes" placeholder="Notes" className={input} />
            <button type="submit" className={btnGhost} data-testid="rp-add">
              +
            </button>
          </form>
        </Panel>
      ) : null}

      {code === "D5.7" ? (
        <Panel className="mt-8">
          <ul className="flex flex-col gap-2 text-sm" data-testid="estimates">
            {registers.estimates.map((estimate) => (
              <li
                key={estimate.id}
                className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-ink-soft"
              >
                <span className="font-medium text-ink">{estimate.nature}</span>
                {estimate.method ? ` — ${estimate.method}` : ""}
                {estimate.uncertainty ? ` · ${estimate.uncertainty}` : ""}
              </li>
            ))}
          </ul>
          <form action={addEstimateAction.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3">
            <input name="nature" placeholder="Nature" required className={input} />
            <input name="method" placeholder="Méthode / Method" className={input} />
            <input name="uncertainty" placeholder="Incertitude / Uncertainty" className={input} />
            <button type="submit" className={btnGhost}>
              +
            </button>
          </form>
        </Panel>
      ) : null}

      <section className="mt-8 rounded-[var(--radius-atlas)] border border-line bg-[var(--color-warn-soft)] p-5 shadow-[var(--shadow-atlas)]">
        <h2 className="text-sm font-semibold text-ink">{tp.raiseRisk}</h2>
        <form action={raiseRiskAction.bind(null, id, code)} className="mt-3 flex flex-wrap items-end gap-3">
          <input
            name="description"
            placeholder={tp.riskDescription}
            required
            className={`${input} w-96 max-w-full`}
            data-testid="raise-risk-description"
          />
          <button type="submit" className={btnGhost} data-testid="raise-risk">
            {tp.raiseRisk}
          </button>
        </form>
      </section>
    </main>
  );
}
