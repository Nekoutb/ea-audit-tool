"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * A submit button that asks first (UAT B89). Removing a colleague or resetting
 * their password used to happen on a single click, with nothing naming who
 * was about to be affected. The confirmation carries the person's name and
 * what the action reaches; declining cancels the submit and nothing is sent.
 * Must be rendered INSIDE the <form> it submits (useFormStatus reads form
 * context), like SubmitButton.
 */
export function ConfirmSubmitButton({
  message,
  className,
  children,
  testId,
}: {
  /** the question shown in the browser's confirm dialog */
  message: string;
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={`${className ?? ""} disabled:cursor-progress disabled:opacity-60`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
