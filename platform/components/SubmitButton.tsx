"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Spinner sized for inline button use; hidden from screen readers. */
function Spin() {
  return (
    <svg
      className="animate-spin motion-reduce:animate-none"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden
    >
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Submit button with a pending state (audit S2): while its form's server action
 * runs, the button disables (no double-submit) and shows a spinner. Must be
 * rendered INSIDE the <form> it submits (useFormStatus reads form context).
 */
export function SubmitButton({
  className,
  children,
  testId,
  name,
  value,
}: {
  className?: string;
  children: ReactNode;
  testId?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending || undefined}
      className={`${className ?? ""} inline-flex items-center gap-2 disabled:cursor-progress disabled:opacity-60`}
      data-testid={testId}
    >
      {pending ? <Spin /> : null}
      {children}
    </button>
  );
}

/**
 * Variant for buttons OUTSIDE their form (submitting via the form="..."
 * attribute, where useFormStatus has no context): disables itself right after
 * the click that submits, and re-enables if the page doesn't navigate.
 */
export function SubmitOnceButton({
  formId,
  className,
  children,
  testId,
  name,
  value,
}: {
  formId: string;
  className?: string;
  children: ReactNode;
  testId?: string;
  name?: string;
  value?: string;
}) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(false), 15_000);
    return () => clearTimeout(t);
  }, [pending]);
  return (
    <button
      type="submit"
      form={formId}
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => {
        // Defer so the click still submits the (valid) form before disabling.
        setTimeout(() => {
          const form = document.getElementById(formId) as HTMLFormElement | null;
          if (form && form.checkValidity()) setPending(true);
        }, 0);
      }}
      className={`${className ?? ""} inline-flex items-center gap-2 disabled:cursor-progress disabled:opacity-60`}
      data-testid={testId}
    >
      {pending ? <Spin /> : null}
      {children}
    </button>
  );
}
