"use client";

// P7 — the Planning Review & Approval Summary. Three tiers of confirmation,
// each line carrying the live state of the tasks it rests on, and four
// signatures. Answers save as you make them; a signature records who and when,
// and can be withdrawn if the plan changes.

import Link from "next/link";
import { useState } from "react";
import { GRID_CELL, GRID_COMMENT_INPUT, GRID_HEAD, GRID_NUM, colWidths } from "@/components/ui/grid";
import type {
  PlanningRasView,
  RasItem,
  RasTaskState,
  SignatureRole,
} from "@/lib/planning-ras";

/** Appendix 1 rows: the engagement team, then free rows for specialists. */
export interface CompetenceRow {
  key: string;
  name: string;
  role: string;
  fixed: boolean;
}

const STATUS_TONE: Record<RasTaskState["status"], string> = {
  reviewed: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  in_review: "bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400",
  in_progress: "bg-[var(--color-warn-soft)] text-warn",
  not_started: "bg-surface-2 text-muted",
  absent: "bg-[var(--color-rose-soft)] text-rose",
};

const STATUS_LABEL: Record<RasTaskState["status"], { en: string; fr: string }> = {
  reviewed: { en: "reviewed", fr: "revu" },
  in_review: { en: "for review", fr: "à revoir" },
  in_progress: { en: "in progress", fr: "en cours" },
  not_started: { en: "not started", fr: "non démarré" },
  absent: { en: "not in file", fr: "absent du dossier" },
};

export function PlanningRas({
  engagementId,
  view,
  sections,
  signatureRoles,
  canSign,
  team,
  locale,
}: {
  engagementId: string;
  view: PlanningRasView;
  sections: { key: "A" | "B" | "C"; titleEn: string; titleFr: string; items: RasItem[] }[];
  signatureRoles: { role: SignatureRole; en: string; fr: string; allowed: boolean }[];
  canSign: boolean;
  team: CompetenceRow[];
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [answers, setAnswers] = useState(view.answers);
  const [signatures, setSignatures] = useState(view.signatures);
  const [busy, setBusy] = useState<string | null>(null);

  async function save(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
    setBusy(key);
    await fetch(`/api/engagements/${engagementId}/planning-ras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    }).catch(() => null);
    setBusy(null);
  }

  async function sign(role: SignatureRole, clear: boolean) {
    setBusy(role);
    const response = await fetch(`/api/engagements/${engagementId}/planning-ras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sign: role, clear }),
    }).catch(() => null);
    setBusy(null);
    if (!response?.ok) return;
    const body = (await response.json().catch(() => ({}))) as { signature?: { name: string; signedAt: string } };
    setSignatures((s) => {
      const next = { ...s };
      if (clear) delete next[role];
      else if (body.signature) next[role] = { role, ...body.signature };
      return next;
    });
  }

  const answered = sections.flatMap((s) => s.items).filter((i) => answers[i.key]).length;
  const total = sections.flatMap((s) => s.items).length;

  const radio = (item: RasItem, value: string, label: string) => (
    <label className="flex cursor-pointer items-center gap-1 text-[11px] text-ink-soft">
      <input
        type="radio"
        name={`ras-${item.key}`}
        checked={answers[item.key] === value}
        onChange={() => void save(item.key, value)}
        data-testid={`ras-${item.key}-${value}`}
        className="h-3 w-3 accent-emerald-700"
      />
      {label}
    </label>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="planning-ras">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
          {fr ? "Revue et approbation de la planification" : "Planning Review & Approval"}
        </span>
        <span className="text-[11px] text-muted tnum" data-testid="ras-progress">
          {answered}/{total} {fr ? "confirmations" : "confirmed"}
        </span>
        {view.unreadyA > 0 ? (
          <span className="rounded-full bg-[var(--color-warn-soft)] px-2 py-0.5 text-[10.5px] font-bold text-warn" data-testid="ras-unready">
            {view.unreadyA} {fr ? "livrable(s) non prêt(s)" : "deliverable(s) not ready"}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            {fr ? "Livrables en place" : "Deliverables in place"}
          </span>
        )}
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {sections.map((section) => (
          <section key={section.key} data-testid={`ras-section-${section.key}`}>
            <h3 className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-emerald-800 dark:text-emerald-300">
              {fr ? section.titleFr : section.titleEn}
            </h3>
            <ul className="mt-1 flex flex-col gap-1.5">
              {section.items.map((item, index) => {
                const states = (item.codes ?? []).map((c) => view.tasks[c]).filter(Boolean);
                const value = answers[item.key];
                return (
                  <li
                    key={item.key}
                    className={`rounded-[var(--radius-atlas-xs)] border px-2 py-1.5 ${
                      value === "no" ? "border-[var(--color-rose)]/40 bg-[var(--color-rose-soft)]" : "border-line"
                    }`}
                    data-testid={`ras-item-${item.key}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="w-5 flex-shrink-0 font-mono text-[10.5px] font-bold text-muted">
                        {section.key}{index + 1}
                      </span>
                      <p className="min-w-0 flex-1 text-[11.8px] leading-snug text-ink">{fr ? item.fr : item.en}</p>
                      <span className="flex flex-shrink-0 items-center gap-2">
                        {radio(item, "yes", fr ? "Oui" : "Yes")}
                        {radio(item, "no", fr ? "Non" : "No")}
                        {item.na ? radio(item, "na", "N/A") : null}
                      </span>
                    </div>
                    {states.length > 0 ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1 pl-7">
                        {states.map((task) => (
                          <span key={task.code} className="inline-flex items-center gap-1">
                            {task.itemId ? (
                              <Link
                                href={`/engagements/${engagementId}/sections/${task.itemId}`}
                                className="font-mono text-[10px] font-bold text-emerald-800 hover:underline dark:text-emerald-300"
                                title={task.title}
                                data-testid={`ras-task-${task.code}`}
                              >
                                {task.code}
                              </Link>
                            ) : (
                              <span className="font-mono text-[10px] font-bold text-muted">{task.code}</span>
                            )}
                            <span className={`rounded-full px-1.5 py-[1px] text-[9.5px] font-semibold ${STATUS_TONE[task.status]}`}>
                              {fr ? STATUS_LABEL[task.status].fr : STATUS_LABEL[task.status].en}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {value === "no" ? (
                      <textarea
                        defaultValue={answers[`${item.key}_x`] ?? ""}
                        onBlur={(e) => void save(`${item.key}_x`, e.target.value)}
                        rows={2}
                        placeholder={fr ? "Expliquer et indiquer la suite donnée…" : "Explain, and say what is being done about it…"}
                        data-testid={`ras-${item.key}-why`}
                        className="mt-1 ml-7 w-[calc(100%-1.75rem)] resize-none rounded-[var(--radius-atlas-xs)] bg-[var(--color-warn-soft)] px-2 py-1 text-[11.5px] text-ink outline-none focus:ring-1 focus:ring-emerald-600/40"
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {/* Appendix 1 — the team competence table Section A line a8 leans on */}
        <section data-testid="ras-appendix1">
          <h3 className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-emerald-800 dark:text-emerald-300">
            {fr
              ? "Annexe 1 — Évaluation de l'équipe de mission"
              : "Appendix 1 — Engagement team assessment"}
          </h3>
          <p className="mt-0.5 text-[10.5px] leading-snug text-muted">
            {fr
              ? "L'équipe de la mission est reprise automatiquement ; les lignes libres accueillent les spécialistes (informatique, fiscalité, évaluation)."
              : "The engagement team is listed automatically; the free rows take the specialists (IT, tax, valuation)."}
          </p>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                {colWidths(160, 110, 84, 84, 84, null).map((style, i) => (
                  <col key={i} style={style} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {[
                    fr ? "Nom" : "Name",
                    fr ? "Rôle" : "Role",
                    fr ? "Années de grade" : "Years in grade",
                    fr ? "Années client" : "Years with client",
                    fr ? "Heures prévues" : "Planned hours",
                    fr ? "Compétences particulières / observations" : "Specialist skills / notes",
                  ].map((h) => (
                    <th key={h} className={`${GRID_CELL} ${GRID_HEAD} whitespace-normal text-left`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.map((row) => (
                  <tr key={row.key} data-testid={`ras-app1-${row.key}`}>
                    {row.fixed ? (
                      <td className={GRID_CELL}>{row.name}</td>
                    ) : (
                      <td className={`${GRID_CELL} p-0`}>
                        <input
                          defaultValue={answers[`ap_${row.key}_name`] ?? ""}
                          onBlur={(e) => void save(`ap_${row.key}_name`, e.target.value)}
                          placeholder={fr ? "Nom…" : "Name…"}
                          className={GRID_COMMENT_INPUT}
                        />
                      </td>
                    )}
                    {row.fixed ? (
                      <td className={GRID_CELL}>{row.role}</td>
                    ) : (
                      <td className={`${GRID_CELL} p-0`}>
                        <input
                          defaultValue={answers[`ap_${row.key}_role`] ?? ""}
                          onBlur={(e) => void save(`ap_${row.key}_role`, e.target.value)}
                          placeholder={fr ? "Rôle…" : "Role…"}
                          className={GRID_COMMENT_INPUT}
                        />
                      </td>
                    )}
                    {(["grade", "client", "hours"] as const).map((col) => (
                      <td key={col} className={`${GRID_NUM} p-0`}>
                        <input
                          defaultValue={answers[`ap_${row.key}_${col}`] ?? ""}
                          onBlur={(e) => void save(`ap_${row.key}_${col}`, e.target.value)}
                          inputMode="numeric"
                          className={`${GRID_COMMENT_INPUT} text-right tnum`}
                        />
                      </td>
                    ))}
                    <td className={`${GRID_CELL} p-0`}>
                      <input
                        defaultValue={answers[`ap_${row.key}_skills`] ?? ""}
                        onBlur={(e) => void save(`ap_${row.key}_skills`, e.target.value)}
                        className={GRID_COMMENT_INPUT}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* the four signatures that close planning */}
        <section data-testid="ras-signatures">
          <h3 className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-emerald-800 dark:text-emerald-300">
            {fr ? "Signatures" : "Signatures"}
          </h3>
          <ul className="mt-1 flex flex-col gap-1">
            {signatureRoles.map((role) => {
              const signature = signatures[role.role];
              return (
                <li
                  key={role.role}
                  className="flex flex-wrap items-center gap-2 rounded-[var(--radius-atlas-xs)] border border-line px-2 py-1.5"
                  data-testid={`ras-sig-${role.role}`}
                >
                  <span className="min-w-0 flex-1 text-[11.8px] text-ink">{fr ? role.fr : role.en}</span>
                  {signature ? (
                    <>
                      <span className="text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {signature.name}
                      </span>
                      <span className="text-[10.5px] text-muted tnum">{signature.signedAt}</span>
                      {canSign && role.allowed ? (
                        <button
                          type="button"
                          onClick={() => void sign(role.role, true)}
                          disabled={busy === role.role}
                          className="text-[10.5px] text-muted hover:text-rose"
                          data-testid={`ras-unsign-${role.role}`}
                        >
                          {fr ? "retirer" : "withdraw"}
                        </button>
                      ) : null}
                    </>
                  ) : role.allowed ? (
                    <button
                      type="button"
                      onClick={() => void sign(role.role, false)}
                      disabled={busy === role.role}
                      className="rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      data-testid={`ras-sign-${role.role}`}
                    >
                      {fr ? "Signer" : "Sign"}
                    </button>
                  ) : (
                    <span className="text-[10.5px] text-muted">{fr ? "en attente" : "awaiting"}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-[10.5px] leading-snug text-muted">
            {fr
              ? "Les quatre signatures doivent être apposées avant le début des travaux sur le terrain. Une modification du plan justifie de retirer et de renouveler l'approbation."
              : "All four signatures belong in place before fieldwork begins. If the plan changes, withdraw the approval and give it again."}
          </p>
        </section>
      </div>
    </div>
  );
}
