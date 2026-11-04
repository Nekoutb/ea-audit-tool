"use client";

import { AssignSelect } from "@/components/AssignSelect";
import { useState } from "react";

type Role = "preparer" | "approver";

/**
 * The preparer (P) and reviewer (R) selects of one Forms row (F006). Each
 * keeps its own form and OK button; neither offers the person chosen in the
 * other, so the matrix cannot be set up with one person on both sides. The
 * server refuses it anyway (preparer-equals-approver, lib/team.ts). A row
 * already stored that way is shown in red with the reason, and keeps its
 * current values selectable so it can be corrected.
 */
export function FormsAssignRow({
  code,
  action,
  team,
  preparerUserId,
  approverUserId,
  labels,
  selectClass,
}: {
  code: string;
  action: (formData: FormData) => void | Promise<void>;
  team: { userId: string; userName: string }[];
  preparerUserId: string | null;
  approverUserId: string | null;
  labels: { preparer: string; approver: string; conflict: string; saved: string; undo: string };
  selectClass: string;
}) {
  const [chosen, setChosen] = useState<Record<Role, string>>({
    preparer: preparerUserId ?? "",
    approver: approverUserId ?? "",
  });
  const storedConflict = preparerUserId !== null && preparerUserId === approverUserId;
  const other = (role: Role): Role => (role === "preparer" ? "approver" : "preparer");

  return (
    <span
      className={`flex flex-shrink-0 flex-wrap items-center gap-1.5 ${
        storedConflict ? "rounded-[var(--radius-atlas-xs)] bg-red-50 px-1 ring-1 ring-red-300 dark:bg-red-950/40 dark:ring-red-900" : ""
      }`}
      data-testid={`assign-row-${code}`}
      data-conflict={storedConflict ? "true" : "false"}
    >
      {(["preparer", "approver"] as const).map((role) => {
        const label = labels[role];
        const exclude = chosen[other(role)];
        return (
          <span key={role} className="flex items-center gap-1">
            <AssignSelect
              action={action}
              current={role === "preparer" ? (preparerUserId ?? "") : (approverUserId ?? "")}
              hidden={{ role }}
              prefix={
                <span className="text-[10px] font-extrabold text-muted" title={label}>
                  {role === "preparer" ? "P" : "R"}
                </span>
              }
              options={team
                // the person on the other side is not offered — unless this
                // select already holds them (a stored conflict to correct)
                .filter((m) => m.userId !== exclude || m.userId === chosen[role])
                .map((m) => ({ value: m.userId, label: m.userName }))}
              selectClass={selectClass}
              ariaLabel={`${label} ${code}`}
              testId={`assign-${role}-${code}`}
              labels={labels}
              onChosen={(value) => setChosen((c) => ({ ...c, [role]: value }))}
            />
          </span>
        );
      })}
      {storedConflict ? (
        <span role="note" className="w-full text-[10.5px] font-semibold text-red-700 dark:text-red-300" data-testid={`assign-conflict-${code}`}>
          {labels.conflict}
        </span>
      ) : null}
    </span>
  );
}
