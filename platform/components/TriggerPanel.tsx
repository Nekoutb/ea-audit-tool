// The scoping triggers that used to live only on the legacy form screens:
// S6.1's five yes/no drivers (experts / service organisations / internal audit
// / control environment / IT) and S4.2's going-concern indicator flag. The
// panel writes the SAME legacy form keys, so the planning driver table and the
// considerations screen read on unchanged. Its selects belong to the paper's own
// form (F020): one "Save paper" saves both, and savePaperAction splits them off
// by the prefix below.

import type { FormDefinition } from "@/lib/forms";
import { TRIGGER_FIELD_PREFIX, paperFormId } from "@/lib/papers/types";

const select =
  "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-[12.5px] text-ink outline-none focus:border-emerald-600";

export function TriggerPanel({
  definition,
  values,
  locale,
  readOnly = false,
}: {
  definition: FormDefinition;
  values: Record<string, unknown>;
  locale: "en" | "fr";
  readOnly?: boolean;
}) {
  const fr = locale === "fr";
  const booleans = definition.fields.filter((f) => f.type === "boolean");
  if (booleans.length === 0) return null;
  return (
    <div
      className="mb-2 rounded-[var(--radius-atlas-sm)] border border-emerald-600/30 bg-emerald-50/70 px-3 py-2 dark:bg-emerald-950/30"
      data-testid="trigger-panel"
    >
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
                name={`${TRIGGER_FIELD_PREFIX}${field.key}`}
                form={paperFormId(definition.code)}
                disabled={readOnly}
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
        <span className="text-[11px] text-muted" data-testid="trigger-hint">
          {fr ? "Enregistrés avec la feuille" : "Saved with the paper"}
        </span>
      </div>
    </div>
  );
}
