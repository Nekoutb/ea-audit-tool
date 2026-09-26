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
    // In-app navigation never fires beforeunload (UAT run 2 B90): a link click
    // and the browser's Back button are intercepted here while dirty. Back is
    // caught with one sentinel history entry for the same URL, pushed the first
    // time the page becomes dirty; popping it asks, and re-pushes on "stay".
    let sentinel = false;
    const onInput = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        if (target instanceof HTMLInputElement && (target.type === "search" || target.type === "file")) return;
        dirty = true;
        if (!sentinel) {
          sentinel = true;
          window.history.pushState(window.history.state, "", window.location.href);
        }
      }
    };
    const onSubmit = () => {
      dirty = false;
    };
    const onClick = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // a jump within the page loses nothing
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      if (window.confirm(message)) {
        dirty = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    const onPopState = () => {
      if (!sentinel) return;
      if (!dirty) {
        sentinel = false;
        return;
      }
      if (window.confirm(message)) {
        dirty = false;
        sentinel = false;
        window.history.back();
      } else {
        window.history.pushState(window.history.state, "", window.location.href);
      }
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
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [message]);
  return null;
}
