// The scoping triggers that used to live only on the legacy form screens:
// S6.1's five yes/no drivers (experts / service organisations / internal audit
// / control environment / IT) and S4.2's going-concern indicator flag. The
// panel writes the SAME legacy form keys through saveFormAction, so the
// planning driver table and the considerations screen read on unchanged.

import { saveFormAction } from "@/app/actions/planning";
import type { FormDefinition } from "@/lib/forms";

const select =
  "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-[12.5px] text-ink outline-none focus:border-emerald-600";

export function TriggerPanel({
  engagementId,
  definition,
  values,
  returnTo,
  locale,
}: {
  engagementId: string;
  definition: FormDefinition;
  values: Record<string, unknown>;
  returnTo: string;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const booleans = definition.fields.filter((f) => f.type === "boolean");
  if (booleans.length === 0) return null;
  return (
    <form
      action={saveFormAction.bind(null, engagementId, definition.code)}
      className="mb-2 rounded-[var(--radius-atlas-sm)] border border-emerald-600/30 bg-emerald-50/70 px-3 py-2 dark:bg-emerald-950/30"
      data-testid="trigger-panel"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-emerald-800 dark:text-emerald-300">
          {fr ? "Déclencheurs de périmètre" : "Scoping triggers"}
        </span>
        {booleans.map((field) => {
          const current = values[field.key];
          return (
            <label key={field.key} className="flex items-center gap-1.5 text-[12px] text-ink-soft">
              {fr ? field.labelFr : field.labelEn}
              <select
                name={field.key}
                defaultValue={current === true ? "yes" : current === false ? "no" : ""}
                className={select}
                data-testid={`trigger-${field.key}`}
              >
                <option value="">—</option>
                <option value="yes">{fr ? "Oui" : "Yes"}</option>
                <option value="no">{fr ? "Non" : "No"}</option>
              </select>
            </label>
          );
        })}
        <button
          type="submit"
          className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-800"
          data-testid="trigger-save"
        >
          {fr ? "Enregistrer" : "Save"}
        </button>
      </div>
    </form>
  );
}
