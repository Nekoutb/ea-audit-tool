"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";
import { signOffPreparerAction, signOffReviewerAction } from "@/app/actions/audit-file";
import { startPageLoad } from "@/components/PageLoader";

type LineTone = "done" | "wait" | "idle" | "none";
type DlTone = "ok" | "over" | "done";
type StatusTone = "done" | "rev" | "prog" | "wait";

interface Cell {
  ini: string;
  line: string;
  lineTone: LineTone;
}

export interface PhaseRowData {
  id: string;
  code: string;
  title: string;
  href: string;
  status: { label: string; tone: StatusTone };
  deadline: { date: string; tag: string; tagTone: DlTone };
  preparer: Cell;
  reviewer: Cell;
  preparerSigned: boolean;
  reviewerSigned: boolean;
}

const LINE_CLASS: Record<LineTone, string> = {
  done: "text-muted",
  wait: "text-warn font-semibold",
  idle: "text-muted",
  none: "text-muted italic",
};
const STATUS_CLASS: Record<StatusTone, string> = {
  done: "text-emerald-800 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
  rev: "text-warn bg-[var(--color-warn-soft)]",
  prog: "text-[#34467f] bg-[#e9ecf9] dark:text-[#9fb0ec] dark:bg-[#1c2340]",
  wait: "text-muted bg-surface-2",
};
const DL_CLASS: Record<DlTone, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  over: "text-rose",
  done: "text-muted",
};
const DL_DOT: Record<DlTone, string> = {
  ok: "bg-emerald-600",
  over: "bg-rose",
  done: "bg-muted",
};

/**
 * One task row in the phase sign-off table. The whole row opens the task; the
 * P and R squares are sign-off buttons (preparer / reviewer) that stop the row
 * click and submit their own server action.
 */
export function PhaseTaskRow({
  row,
  engagementId,
  phaseSlug,
  signPreparerLabel,
  signReviewerLabel,
}: {
  row: PhaseRowData;
  engagementId: string;
  phaseSlug: string;
  signPreparerLabel: string;
  signReviewerLabel: string;
}) {
  const router = useRouter();

  const open = () => {
    startPageLoad({ overlay: true });
    router.push(row.href);
  };
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  const stop = (e: MouseEvent) => e.stopPropagation();

  const hidden = (
    <>
      <input type="hidden" name="fileItemId" value={row.id} />
      <input type="hidden" name="engagementId" value={engagementId} />
      <input type="hidden" name="phase" value={phaseSlug} />
    </>
  );

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKey}
      data-testid={`phase-task-${row.code}`}
      className="cursor-pointer outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-emerald-600"
    >
      <td className="border-t border-line px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="w-11 flex-shrink-0 font-mono text-[11px] font-bold text-ink-soft">{row.code}</span>
          <span className="truncate text-[13.5px] font-semibold text-ink">{row.title}</span>
        </div>
      </td>

      <td className="border-t border-line px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {row.preparerSigned ? (
            <span className="sobox p" aria-hidden>P</span>
          ) : (
            <form action={signOffPreparerAction} onClick={stop}>
              {hidden}
              <button type="submit" className="sobox p" title={signPreparerLabel} aria-label={signPreparerLabel} data-testid={`sign-preparer-${row.code}`}>
                P
              </button>
            </form>
          )}
          <span className="flex min-w-0 flex-col leading-tight">
            {row.preparer.ini ? <span className="truncate text-[12.5px] font-bold tracking-wide text-ink">{row.preparer.ini}</span> : null}
            <span className={`truncate text-[11px] ${LINE_CLASS[row.preparer.lineTone]}`}>{row.preparer.line}</span>
          </span>
        </div>
      </td>

      <td className="border-t border-line px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {row.reviewerSigned ? (
            <span className="sobox r" aria-hidden>R</span>
          ) : row.preparerSigned ? (
            <form action={signOffReviewerAction} onClick={stop}>
              {hidden}
              <button type="submit" className="sobox r" title={signReviewerLabel} aria-label={signReviewerLabel} data-testid={`sign-reviewer-${row.code}`}>
                R
              </button>
            </form>
          ) : (
            <span className="sobox off" aria-hidden>R</span>
          )}
          <span className="flex min-w-0 flex-col leading-tight">
            {row.reviewer.ini ? <span className="truncate text-[12.5px] font-bold tracking-wide text-ink">{row.reviewer.ini}</span> : null}
            <span className={`truncate text-[11px] ${LINE_CLASS[row.reviewer.lineTone]}`}>{row.reviewer.line}</span>
          </span>
        </div>
      </td>

      <td className="border-t border-line px-5 py-4">
        <div className="flex flex-col gap-1 leading-tight">
          <span className="text-[12.5px] font-bold text-ink tnum">{row.deadline.date}</span>
          <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-bold ${DL_CLASS[row.deadline.tagTone]}`}>
            <span className={`h-[7px] w-[7px] rounded-full ${DL_DOT[row.deadline.tagTone]}`} />
            {row.deadline.tag}
          </span>
        </div>
      </td>

      <td className="border-t border-line px-5 py-4 text-right">
        <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.03em] ${STATUS_CLASS[row.status.tone]}`}>
          {row.status.label}
        </span>
      </td>
    </tr>
  );
}
