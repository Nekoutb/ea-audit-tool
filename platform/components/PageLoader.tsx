"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Kick the top progress bar. Interactive components (nav links, the engagement
 * selector) call this the moment a navigation starts, so the bar appears during
 * the pending transition; PageLoader then completes it when the route commits.
 */
export function startPageLoad(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById("atlas-loader");
  if (!el) return;
  el.className = "";
  // force reflow so the width transition restarts even on rapid navigations
  void el.offsetWidth;
  el.classList.add("run");
}

/** App-wide route-transition indicator. Mounted once in the root layout. */
export function PageLoader() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = document.getElementById("atlas-loader");
    if (!el) return;
    if (!el.classList.contains("run")) {
      el.classList.add("run");
      void el.offsetWidth;
    }
    el.classList.remove("run");
    el.classList.add("done");
    const t = window.setTimeout(() => {
      el.className = "";
    }, 450);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return <div id="atlas-loader" aria-hidden="true" />;
}
