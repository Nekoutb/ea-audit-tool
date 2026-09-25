"use client";

import { useEffect } from "react";

/**
 * Warns before the page is left with unsaved typing. Any input, textarea or
 * select edited under the guard marks the page dirty; a form submit clears the
 * flag (the server action navigates afterwards). Rendered once per page —
 * it listens on the document, so it covers every form on the page without
 * wiring each one (UAT B105).
 */
export function UnsavedGuard({ message }: { message: string }) {
  useEffect(() => {
    let dirty = false;
    const onInput = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        if (target instanceof HTMLInputElement && (target.type === "search" || target.type === "file")) return;
        dirty = true;
      }
    };
    const onSubmit = () => {
      dirty = false;
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      // Browsers show their own wording; the string keeps legacy engines honest.
      event.returnValue = message;
      return message;
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [message]);
  return null;
}
