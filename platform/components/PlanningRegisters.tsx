// The S4.3 related-parties register and S4.4 estimates inventory, rendered on
// the legacy form page and embedded on the working-paper screens. The add
// forms post the existing planning actions with a returnTo so each screen
// lands back on itself.

import { addEstimateAction, addRelatedPartyAction } from "@/app/actions/planning";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import type { EstimateRow, RelatedPartyRow } from "@/lib/registers";

const input =
  "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
const btnGhost =
  "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";

export function RelatedPartyRegister({
  engagementId,
  rows,
  returnTo,
  locale,
  carriedForwardLabel,
  title,
}: {
  engagementId: string;
  rows: RelatedPartyRow[];
  returnTo?: string;
  locale: "en" | "fr";
  carriedForwardLabel: string;
  title: string;
}) {
  const fr = locale === "fr";
  return (
    <Panel>
      <PanelHeader title={title} />
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {fr ? "Aucune partie liée enregistrée." : "No related parties recorded yet."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2 text-sm" data-testid="related-parties">
          {rows.map((party) => (
            <li
              key={party.id}
              className="flex flex-wrap items-center gap-x-1.5 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-ink-soft"
            >
              <span className="font-medium text-ink">{party.name}</span> — {party.relationship}
              {party.notes ? ` · ${party.notes}` : ""}
              {party.carried_forward ? <Chip tone="warn">{carriedForwardLabel}</Chip> : null}
            </li>
          ))}
        </ul>
      )}
      <form action={addRelatedPartyAction.bind(null, engagementId)} className="mt-4 flex flex-wrap items-end gap-3">
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <input name="name" placeholder="Nom / Name" aria-label="Nom / Name" required className={input} data-testid="rp-name" />
        <input name="relationship" placeholder="Relation" aria-label="Relation" required className={input} data-testid="rp-relationship" />
        <input name="notes" placeholder="Notes" aria-label="Notes" className={input} />
        <button type="submit" className={btnGhost} data-testid="rp-add">
          +
        </button>
      </form>
    </Panel>
  );
}

export function EstimatesRegister({
  engagementId,
  rows,
  returnTo,
  locale,
  title,
}: {
  engagementId: string;
  rows: EstimateRow[];
  returnTo?: string;
  locale: "en" | "fr";
  title?: string;
}) {
  const fr = locale === "fr";
  return (
    <Panel>
      {title ? <PanelHeader title={title} /> : null}
      {rows.length === 0 ? (
        <p className={`${title ? "mt-2 " : ""}text-sm text-muted`}>
          {fr ? "Aucune estimation recensée." : "No estimates inventoried yet."}
        </p>
      ) : (
        <ul className={`${title ? "mt-4 " : ""}flex flex-col gap-2 text-sm`} data-testid="estimates">
          {rows.map((estimate) => (
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
      )}
      <form action={addEstimateAction.bind(null, engagementId)} className="mt-4 flex flex-wrap items-end gap-3">
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <input name="nature" placeholder="Nature" aria-label="Nature" required className={input} />
        <input name="method" placeholder="Méthode / Method" aria-label="Méthode / Method" className={input} />
        <input name="uncertainty" placeholder="Incertitude / Uncertainty" aria-label="Incertitude / Uncertainty" className={input} />
        <button type="submit" className={btnGhost}>
          +
        </button>
      </form>
    </Panel>
  );
}
