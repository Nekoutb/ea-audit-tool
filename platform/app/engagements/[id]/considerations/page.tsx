import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveFormAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { NavLink } from "@/components/NavLink";
import { SubmitButton } from "@/components/SubmitButton";
import { Chip, Panel, btnPrimary } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { shortTitle } from "@/lib/file-index";
import { fieldLabel, FORM_DEFINITIONS, loadForm } from "@/lib/forms";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { requireTenant } from "@/lib/tenant";

export const metadata = { title: "Planning considerations · AuditISA" };

// The five one-field conditional planning forms, merged into one screen
// (UI audit S1). Keep the trigger map in sync with planning/page.tsx.
const CONSIDERATION_CODES = ["P4.2", "P4.3", "S4.1", "S4.2", "S4.3"] as const;
const CONDITIONAL_TRIGGERS: Record<string, string> = {
  "P4.2": "assess_control_env",
  "P4.3": "assess_it_env",
  "S4.1": "uses_expert",
  "S4.2": "uses_service_org",
  "S4.3": "has_internal_audit",
};

async function d1Triggers(engagementId: string): Promise<Record<string, unknown>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ field_key: string; value: unknown }>(
      "SELECT field_key, value FROM form_response WHERE engagement_id = $1 AND code = 'S5.1'",
      [engagementId],
    );
    return Object.fromEntries(r.rows.map((row) => [row.field_key, row.value]));
  });
}

export default async function ConsiderationsPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tc = t.considerations;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [triggers, ...loaded] = await Promise.all([
    d1Triggers(id),
    ...CONSIDERATION_CODES.map((code) => loadForm(id, code)),
  ]);
  const fileItems = await listFileItems(id);
  const itemIdOf = new Map(fileItems.map((item) => [item.code, item.id]));
  const valuesByCode = Object.fromEntries(CONSIDERATION_CODES.map((code, i) => [code, loaded[i].values]));

  const d1Fields = FORM_DEFINITIONS["S5.1"]?.fields ?? [];
  const triggerLabel = (code: string) => {
    const key = CONDITIONAL_TRIGGERS[code];
    const field = d1Fields.find((f) => f.key === key);
    return field ? fieldLabel(field, locale) : key;
  };

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div>
        <NavLink
          href={`/engagements/${id}/planning`}
          className="inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          testId="back-to-planning"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {tc.back}
        </NavLink>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{tc.title}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{tc.subtitle}</p>
      </div>

      <ErrorBanner error={error} locale={locale} />

      {CONSIDERATION_CODES.map((code) => {
        const definition = FORM_DEFINITIONS[code];
        if (!definition) return null;
        const active = triggers[CONDITIONAL_TRIGGERS[code]] === true;
        const values = valuesByCode[code];
        return (
          <Panel key={code} id={code} className="p-5" data-testid={`consideration-${code}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-[12.5px] font-extrabold text-ink-soft">
                  {code}
                </span>
                <span className="text-[15px] font-bold text-ink">{shortTitle(code, locale, code)}</span>
              </div>
              <span className="flex items-center gap-2">
                {itemIdOf.has(code) ? (
                  <Link href={`/engagements/${id}/sections/${itemIdOf.get(code)}`} className="text-[12.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400" data-testid={`wp-link-${code}`}>
                    {locale === "fr" ? "Ouvrir le dossier de travail →" : "Open working paper →"}
                  </Link>
                ) : null}
                {active ? <Chip tone="warn">{tc.applicable}</Chip> : <Chip tone="muted">{tc.notRequired}</Chip>}
              </span>
            </div>
            {active ? (
              <form action={saveFormAction.bind(null, id, code)} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="returnTo" value={`/engagements/${id}/considerations`} />
                {definition.fields.map((field) => (
                  <label key={field.key} className="flex flex-col gap-1.5 text-sm">
                    <span className="text-ink-soft">{fieldLabel(field, locale)}</span>
                    <textarea
                      name={field.key}
                      defaultValue={values[field.key] === undefined ? "" : String(values[field.key])}
                      rows={3}
                      className={input}
                      data-testid={`cons-${code}-${field.key}`}
                    />
                  </label>
                ))}
                <div>
                  <SubmitButton className={btnPrimary} testId={`cons-save-${code}`}>{t.planning.save}</SubmitButton>
                </div>
              </form>
            ) : (
              <p className="mt-3 text-[13px] text-muted">
                {tc.notRequiredHint.replace("{trigger}", triggerLabel(code))}
              </p>
            )}
          </Panel>
        );
      })}
    </main>
  );
}
