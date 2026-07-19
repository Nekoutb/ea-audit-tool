import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resetTemplateAction, saveTemplateAction } from "@/app/actions/templates";
import { AppNav } from "@/components/AppNav";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { DEFAULT_FILE_INDEX, shortTitle } from "@/lib/file-index";
import { canManageFirm, type Role } from "@/lib/rbac";
import { listOverrides } from "@/lib/template-overrides";
import { templateFor } from "@/lib/templates";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function TemplateEditPage(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canManageFirm(session.user.role as Role)) redirect("/dashboard");

  const { code: raw } = await props.params;
  const code = decodeURIComponent(raw);
  const { error } = await props.searchParams;
  const entry = DEFAULT_FILE_INDEX.find((e) => e.code === code);
  if (!entry) notFound();

  const locale = await getLocale();
  const t = getMessages(locale);
  const tp = t.templates;
  const base = templateFor(code);
  const override = (await listOverrides()).find((o) => o.code === code);

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const label = "flex flex-col gap-1 text-sm text-ink-soft";

  return (
    <main className="min-h-screen w-full px-6 py-10">
      <AppNav locale={locale} />
      <div className="mt-8">
        <Link href="/templates" className="text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          ← {tp.backToList}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-ink">
          {code} · {shortTitle(code, locale, locale === "fr" ? entry.titleFr : entry.titleEn)}
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">{tp.editHint}</p>
      </div>

      {error ? (
        <p className="mt-4 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-[var(--color-rose-soft)] px-4 py-3 text-sm text-rose">
          {(tp.errors as Record<string, string>)[error] ?? error}
        </p>
      ) : null}

      <Panel className="mt-6 p-6">
        <PanelHeader title={tp.editorTitle} hint={`${base.id} v${base.version}`} />
        <form action={saveTemplateAction} className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <input type="hidden" name="code" value={code} />
          <label className={label}>
            {tp.purposeEn}
            <textarea name="purposeEn" rows={3} defaultValue={override?.purposeEn ?? ""} placeholder={base.purpose.en} className={input} data-testid="tpl-purpose-en" />
          </label>
          <label className={label}>
            {tp.purposeFr}
            <textarea name="purposeFr" rows={3} defaultValue={override?.purposeFr ?? ""} placeholder={base.purpose.fr} className={input} data-testid="tpl-purpose-fr" />
          </label>
          <label className={label}>
            {tp.itemsEn}
            <textarea name="itemsEn" rows={8} defaultValue={(override?.itemsEn ?? []).join("\n")} placeholder={base.items.en.join("\n")} className={`${input} font-mono text-xs`} data-testid="tpl-items-en" />
          </label>
          <label className={label}>
            {tp.itemsFr}
            <textarea name="itemsFr" rows={8} defaultValue={(override?.itemsFr ?? []).join("\n")} placeholder={base.items.fr.join("\n")} className={`${input} font-mono text-xs`} data-testid="tpl-items-fr" />
          </label>
          <p className="text-xs text-muted lg:col-span-2">{tp.blankHint}</p>
          <div className="flex items-center gap-3 lg:col-span-2">
            <button type="submit" className={btnPrimary} data-testid="tpl-save">{tp.save}</button>
          </div>
        </form>
        {override ? (
          <form action={resetTemplateAction} className="mt-3">
            <input type="hidden" name="code" value={code} />
            <button type="submit" data-testid="tpl-reset" className="text-[12.5px] font-semibold text-rose hover:underline">
              {tp.reset}
            </button>
          </form>
        ) : null}
      </Panel>
    </main>
  );
}
