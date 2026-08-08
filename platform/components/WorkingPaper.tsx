import { SubmitButton } from "@/components/SubmitButton";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import type { Locale } from "@/lib/i18n";
import {
  conclKey,
  conclWhyKey,
  procKey,
  ynKey,
  ynWhyKey,
  type PaperDef,
  type PaperField,
} from "@/lib/papers/types";
import { paperProgress } from "@/lib/working-papers";

/**
 * The working paper inside every task. Blue fields hold what a tool produced;
 * amber fields hold the judgement the preparer records. Rich papers add the
 * standards narrative, numbered procedures with their expected sources, and
 * Yes/No factor checklists whose "No" opens an explanation box underneath.
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
  autoValues: Record<string, string>;
  locale: Locale;
  action: (formData: FormData) => void;
  readOnly?: boolean;
}) {
  const fr = locale === "fr";
  const L = fr ? "fr" : "en";
  const { done, total } = paperProgress(def, values);
  const req = (fr ? def.reqFr : def.reqEn) ?? [];
  const concl = (fr ? def.conclFr : def.conclEn) ?? [];

  return (
    <Panel className="mt-6">
      <PanelHeader
        title={fr ? "Feuille de travail" : "Working paper"}
        hint={`${done}/${total}`}
        right={<span className="font-mono text-[11px] text-muted">{code}</span>}
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
        {fr ? def.ownsFr : def.ownsEn}
      </p>

      <form action={action} className="mt-5 flex flex-col gap-5" data-testid={`wp-form-${code}`}>
        {req.length > 0 ? (
          <details className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-ink-soft">
              {fr ? "Ce que les normes exigent" : "What the standards require"}
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {req.map((p, i) => (
                <p key={i} className="text-[12.5px] leading-relaxed text-muted">{p}</p>
              ))}
            </div>
          </details>
        ) : null}

        {/* simple papers */}
        {def.fields?.map((f) => (
          <FieldRow key={f.key} f={f} values={values} autoValues={autoValues} fr={fr} readOnly={readOnly} />
        ))}

        {/* rich papers */}
        {def.sections?.map((s, si) => (
          <section key={si} className="flex flex-col gap-3">
            <h3 className="border-b border-line pb-1.5 text-[12px] font-bold uppercase tracking-[0.05em] text-ink">
              {s[`title${fr ? "Fr" : "En"}`]}
            </h3>
            {s[`intro${fr ? "Fr" : "En"}`] ? (
              <p className="text-[12.5px] text-muted">{s[`intro${fr ? "Fr" : "En"}`]}</p>
            ) : null}

            {s.kind === "fields"
              ? s.fields.map((f) => (
                  <FieldRow key={f.key} f={f} values={values} autoValues={autoValues} fr={fr} readOnly={readOnly} />
                ))
              : null}

            {s.kind === "proc" ? (
              <ol className="flex flex-col gap-3">
                {s.procs.map((p, i) => (
                  <li key={p.key} className="grid gap-2 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    <div>
                      <p className="text-[12.8px] text-ink">
                        <span className="mr-1.5 font-mono text-[11px] text-muted tnum">{i + 1}.</span>
                        {p[L]}
                      </p>
                      <p className="mt-1 pl-5 text-[11.5px] text-muted">
                        {fr ? "Sources attendues : " : "Expected sources: "}
                        {p[`src${fr ? "Fr" : "En"}`]}
                      </p>
                    </div>
                    <textarea
                      name={procKey(p.key)}
                      rows={2}
                      defaultValue={values[procKey(p.key)] ?? ""}
                      readOnly={readOnly}
                      data-testid={`wp-${procKey(p.key)}`}
                      placeholder={fr ? "Résultat et référence du dossier" : "Result and working-paper reference"}
                      className={AMBER}
                    />
                  </li>
                ))}
              </ol>
            ) : null}

            {s.kind === "yn" ? (
              <div className="flex flex-col gap-2.5">
                {s.items.map((it, i) => (
                  <YesNo
                    key={it.key}
                    n={i + 1}
                    label={it[L]}
                    na={it.na}
                    name={ynKey(it.key)}
                    whyName={ynWhyKey(it.key)}
                    value={values[ynKey(it.key)] ?? ""}
                    why={values[ynWhyKey(it.key)] ?? ""}
                    fr={fr}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ))}

        {concl.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <h3 className="border-b border-line pb-1.5 text-[12px] font-bold uppercase tracking-[0.05em] text-ink">
              {fr ? "Conclusion" : "Conclusion"}
            </h3>
            {concl.map((c, i) => (
              <YesNo
                key={i}
                label={c}
                name={conclKey(i)}
                whyName={conclWhyKey(i)}
                value={values[conclKey(i)] ?? ""}
                why={values[conclWhyKey(i)] ?? ""}
                fr={fr}
                readOnly={readOnly}
              />
            ))}
          </section>
        ) : null}

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

const AMBER =
  "w-full resize-y rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-input)] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-emerald-600/25";

function FieldRow({
  f,
  values,
  autoValues,
  fr,
  readOnly,
}: {
  f: PaperField;
  values: Record<string, string>;
  autoValues: Record<string, string>;
  fr: boolean;
  readOnly?: boolean;
}) {
  const label = fr ? f.labelFr : f.labelEn;
  if (f.kind === "auto") {
    const v = autoValues[f.key];
    return (
      <div>
        <label className="mb-1 block text-xs text-muted">{label}</label>
        <p
          className="rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-auto)] px-3 py-2 text-sm text-ink-soft"
          data-testid={`wp-auto-${f.key}`}
        >
          {v ?? (fr ? `Renseigné par « ${f.source} »` : `Filled by the ${f.source}`)}
        </p>
      </div>
    );
  }
  return (
    <div>
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
        className={AMBER}
      />
    </div>
  );
}

/**
 * A Yes/No factor. The explanation box is always in the DOM so the answer
 * survives a save; CSS reveals it only when "No" is the selected answer, which
 * keeps the reason next to the question it belongs to.
 */
function YesNo({
  n,
  label,
  na,
  name,
  whyName,
  value,
  why,
  fr,
  readOnly,
}: {
  n?: number;
  label: string;
  na?: boolean;
  name: string;
  whyName: string;
  value: string;
  why: string;
  fr: boolean;
  readOnly?: boolean;
}) {
  const opts: { v: string; l: string }[] = [
    { v: "yes", l: fr ? "Oui" : "Yes" },
    { v: "no", l: fr ? "Non" : "No" },
    ...(na ? [{ v: "na", l: fr ? "S.O." : "N/A" }] : []),
  ];
  return (
    <div className="rounded-[var(--radius-atlas-sm)] border border-line px-3 py-2">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 text-[12.8px] text-ink">
          {n ? <span className="mr-1.5 font-mono text-[11px] text-muted tnum">{n}.</span> : null}
          {label}
        </p>
        <div className="flex flex-shrink-0 gap-3">
          {opts.map((o) => (
            <label key={o.v} className="flex items-center gap-1.5 text-xs text-ink-soft">
              <input
                type="radio"
                name={name}
                value={o.v}
                defaultChecked={value === o.v}
                disabled={readOnly}
                data-testid={`wp-${name}-${o.v}`}
                className="h-3.5 w-3.5 accent-emerald-700"
              />
              {o.l}
            </label>
          ))}
        </div>
      </div>
      <div className="mt-2">
        <label htmlFor={`wp-${whyName}`} className="mb-1 block text-[11px] text-muted">
          {fr ? "Expliquer une réponse « Non »" : "Explain a “No” answer"}
        </label>
        <textarea
          id={`wp-${whyName}`}
          name={whyName}
          rows={1}
          defaultValue={why}
          readOnly={readOnly}
          data-testid={`wp-${whyName}`}
          placeholder={fr ? "Motif, et suite donnée" : "Reason, and how it was resolved"}
          className={`${AMBER} text-[12.5px]`}
        />
      </div>
    </div>
  );
}
