"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";
import { rollforwardFromRegisterAction } from "@/app/actions/conclusion";
import { startPageLoad } from "@/components/PageLoader";

type StageTone = "acc" | "warn" | "prog" | "done" | "muted";
type StatusTone = "ok" | "over" | "done" | "muted";

export interface RegisterRowData {
  id: string;
  title: string;
  clientName: string | null; // sub-line when a convention name exists
  fiscalYear: number;
  partnerName: string | null;
  stage: { label: string; tone: StageTone };
  status: { label: string; tone: StatusTone };
  pct: number;
  deadline: string;
  lastActivity: string;
  /** Present on conclusion/archived rows: offer FY+1 roll-forward. */
  rollForward: { newYear: number; label: string } | null;
  openLabel: string;
}

const STAGE_CLASS: Record<StageTone, string> = {
  acc: "text-[#34467f] bg-[#e9ecf9] dark:text-[#9fb0ec] dark:bg-[#1c2340]",
  warn: "text-warn bg-[var(--color-warn-soft)]",
  prog: "text-emerald-800 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
  done: "text-emerald-800 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
  muted: "text-muted bg-surface-2",
};
const STATUS_CLASS: Record<StatusTone, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  over: "text-rose",
  done: "text-ink-soft",
  muted: "text-muted",
};
const STATUS_DOT: Record<StatusTone, string> = {
  ok: "bg-emerald-600",
  over: "bg-rose",
  done: "bg-line-strong",
  muted: "bg-line-strong",
};

/** One engagement in the register: the whole row opens the hub. */
export function RegisterRow({ row }: { row: RegisterRowData }) {
  const router = useRouter();
  const open = () => {
    startPageLoad({ overlay: true });
    router.push(`/engagements/${row.id}/dashboard`);
  };
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKey}
      data-testid={`register-row-${row.id}`}
      className="cursor-pointer outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-emerald-600"
    >
      <td className="border-t border-line px-5 py-3.5">
        <span className="block truncate text-[13.5px] font-semibold text-ink">{row.title}</span>
        {row.clientName ? (
          <span className="block truncate text-[11.5px] text-muted">{row.clientName}</span>
        ) : null}
      </td>
      <td className="border-t border-line px-4 py-3.5 text-[13px] text-ink-soft tnum">{row.fiscalYear}</td>
      <td className="border-t border-line px-4 py-3.5">
        <span className="block truncate text-[12.5px] text-ink-soft">{row.partnerName ?? "—"}</span>
      </td>
      <td className="border-t border-line px-4 py-3.5">
        <span
          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.03em] ${STAGE_CLASS[row.stage.tone]}`}
        >
          {row.stage.label}
        </span>
      </td>
      <td className="border-t border-line px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-[5px] w-[72px] flex-shrink-0 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${row.pct}%` }} />
          </span>
          <span className="text-[11.5px] text-muted tnum">{row.pct}%</span>
        </div>
      </td>
      <td className="border-t border-line px-4 py-3.5">
        <span className="block text-[12.5px] text-ink tnum">{row.deadline}</span>
        <span
          className={`inline-flex items-center gap-1.5 text-[10.5px] font-bold ${STATUS_CLASS[row.status.tone]}`}
        >
          <span className={`h-[6px] w-[6px] rounded-full ${STATUS_DOT[row.status.tone]}`} />
          {row.status.label}
        </span>
      </td>
      <td className="border-t border-line px-4 py-3.5 text-[12px] text-muted tnum">{row.lastActivity}</td>
      <td className="border-t border-line px-4 py-3.5 text-right">
        {row.rollForward ? (
          <form action={rollforwardFromRegisterAction} onClick={stop} className="inline-block">
            <input type="hidden" name="engagementId" value={row.id} />
            <input type="hidden" name="newYear" value={row.rollForward.newYear} />
            <button
              type="submit"
              data-testid={`rollforward-${row.id}`}
              className="inline-flex min-h-[28px] items-center whitespace-nowrap rounded-full border border-line-strong px-3 py-1 text-[11.5px] font-semibold text-ink-soft transition hover:bg-surface-2"
            >
              {row.rollForward.label}
            </button>
          </form>
        ) : (
          <span className="text-[12.5px] font-medium text-emerald-700 dark:text-emerald-400">{row.openLabel}</span>
        )}
      </td>
    </tr>
  );
}
