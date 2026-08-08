import { SubmitButton } from "@/components/SubmitButton";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import type { Locale } from "@/lib/i18n";
import { fieldLabelOf, paperOwns, type PaperDef } from "@/lib/working-papers";

/**
 * The working paper that sits inside every task. Two kinds of field: values a
 * tool produced (read-only, tinted blue) and the judgement the preparer records
 * (amber). The distinction is the point — the tool owns its numbers, the paper
 * owns the reasoning.
 */
export function WorkingPaper({
  code,
  def,
  values,
  autoValues,
  locale,
  action,
  readOnly,
}: {
  code: string;
  def: PaperDef;
  values: Record<string, string>;
  /** rendered into `auto` fields; missing keys show the source hint instead */
  autoValues: Record<string, string>;
  locale: Locale;
  action: (formData: FormData) => void;
  readOnly?: boolean;
}) {
  const fr = locale === "fr";
  const inputs = def.fields.filter((f) => f.kind === "input");
  const filled = inputs.filter((f) => (values[f.key] ?? "").trim().length > 0).length;

  return (
    <Panel className="mt-6">
      <PanelHeader
        title={fr ? "Feuille de travail" : "Working paper"}
        hint={`${filled}/${inputs.length}`}
        right={
          <span className="font-mono text-[11px] text-muted">{code}</span>
        }
      />

      <p className="mt-2 text-xs text-muted">{def.std}</p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[color:var(--wp-auto)]" aria-hidden />
          {fr ? "Produit par un outil" : "From a tool"}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[color:var(--wp-input)]" aria-hidden />
          {fr ? "Votre jugement" : "Your judgement"}
        </span>
      </div>

      <p className="mt-3 text-sm text-ink-soft">
        <span className="text-muted">{fr ? "Enregistre : " : "Records: "}</span>
        {paperOwns(def, fr ? "fr" : "en")}
      </p>

      <form action={action} className="mt-4 flex flex-col gap-3" data-testid={`wp-form-${code}`}>
        {def.fields.map((f) => {
          const label = fieldLabelOf(f, fr ? "fr" : "en");
          if (f.kind === "auto") {
            const v = autoValues[f.key];
            return (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-muted">{label}</label>
                <p
                  className="rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-auto)] px-3 py-2 text-sm text-ink-soft"
                  data-testid={`wp-auto-${f.key}`}
                >
                  {v ?? (fr ? `Renseigné par l’outil « ${f.source} »` : `Filled by the ${f.source} tool`)}
                </p>
              </div>
            );
          }
          return (
            <div key={f.key}>
              <label htmlFor={`wp-${f.key}`} className="mb-1 block text-xs text-muted">
                {label}
              </label>
              <textarea
                id={`wp-${f.key}`}
                name={f.key}
                rows={2}
                defaultValue={values[f.key] ?? ""}
                readOnly={readOnly}
                data-testid={`wp-${f.key}`}
                placeholder={fr ? "Consigner les travaux effectués" : "Record the work performed"}
                className="w-full resize-y rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-input)] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-emerald-600/25"
              />
            </div>
          );
        })}
        {readOnly ? null : (
          <div className="flex justify-end">
            <SubmitButton
              testId={`wp-save-${code}`}
              className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              {fr ? "Enregistrer la feuille" : "Save paper"}
            </SubmitButton>
          </div>
        )}
      </form>
    </Panel>
  );
}
