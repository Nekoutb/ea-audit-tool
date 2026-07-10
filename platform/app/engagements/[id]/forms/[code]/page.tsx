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
    "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const btn =
    "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
  const btnPrimary =
    "rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800";

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {code} · {engagement.clientName} — {engagement.fiscalYear}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="planning" />
      <ErrorBanner error={error} locale={locale} />

      <form action={saveFormAction.bind(null, id, code)} className="mt-6 flex flex-col gap-4">
        {definition.fields.map((field) => {
          const value = values[field.key];
          const isCarried = carried.has(field.key);
          return (
            <label key={field.key} className="flex flex-col gap-1 text-sm">
              <span className="text-slate-700 dark:text-slate-300">
                {fieldLabel(field, locale)}
                {field.required ? " *" : ""}
                {isCarried ? (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300" data-testid={`carried-${field.key}`}>
                    {tp.carriedForward}
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
                  className={input}
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

      {code === "D5.6" ? (
        <section className="mt-8 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.fileIndex.title} — D5.6
          </h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm" data-testid="related-parties">
            {registers.parties.map((party) => (
              <li key={party.id} className="rounded border border-slate-200 px-3 py-1.5 dark:border-slate-800">
                <span className="font-medium">{party.name}</span> — {party.relationship}
                {party.notes ? ` · ${party.notes}` : ""}
                {party.carried_forward ? (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {tp.carriedForward}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <form action={addRelatedPartyAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-3">
            <input name="name" placeholder="Nom / Name" required className={input} data-testid="rp-name" />
            <input name="relationship" placeholder="Relation" required className={input} data-testid="rp-relationship" />
            <input name="notes" placeholder="Notes" className={input} />
            <button type="submit" className={btn} data-testid="rp-add">
              +
            </button>
          </form>
        </section>
      ) : null}

      {code === "D5.7" ? (
        <section className="mt-8 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
          <ul className="mt-1 flex flex-col gap-1 text-sm" data-testid="estimates">
            {registers.estimates.map((estimate) => (
              <li key={estimate.id} className="rounded border border-slate-200 px-3 py-1.5 dark:border-slate-800">
                <span className="font-medium">{estimate.nature}</span>
                {estimate.method ? ` — ${estimate.method}` : ""}
                {estimate.uncertainty ? ` · ${estimate.uncertainty}` : ""}
              </li>
            ))}
          </ul>
          <form action={addEstimateAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-3">
            <input name="nature" placeholder="Nature" required className={input} />
            <input name="method" placeholder="Méthode / Method" className={input} />
            <input name="uncertainty" placeholder="Incertitude / Uncertainty" className={input} />
            <button type="submit" className={btn}>
              +
            </button>
          </form>
        </section>
      ) : null}

      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900 dark:bg-amber-950/20">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tp.raiseRisk}</h2>
        <form action={raiseRiskAction.bind(null, id, code)} className="mt-2 flex flex-wrap items-end gap-3">
          <input
            name="description"
            placeholder={tp.riskDescription}
            required
            className={`${input} w-96 max-w-full`}
            data-testid="raise-risk-description"
          />
          <button type="submit" className={btn} data-testid="raise-risk">
            {tp.raiseRisk}
          </button>
        </form>
      </section>
    </main>
  );
}
