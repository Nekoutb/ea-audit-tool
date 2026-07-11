"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Kick the top progress bar (and optionally the full-screen spinner overlay used
 * by phase drill-downs). Interactive components call this the moment a navigation
 * starts; PageLoader completes/clears everything when the route commits.
 */
export function startPageLoad(opts?: { overlay?: boolean }): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById("atlas-loader");
  if (el) {
    el.className = "";
    // force reflow so the width transition restarts even on rapid navigations
    void el.offsetWidth;
    el.classList.add("run");
  }
  if (opts?.overlay) {
    const overlay = document.getElementById("atlas-overlay");
    if (overlay) {
      overlay.classList.add("show");
      // Safety: never leave the overlay stuck if a navigation is cancelled.
      window.setTimeout(() => overlay.classList.remove("show"), 8000);
    }
  }
}

/** App-wide route-transition indicator. Mounted once in the root layout. */
export function PageLoader() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    document.getElementById("atlas-overlay")?.classList.remove("show");
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

  return (
    <>
      <div id="atlas-loader" aria-hidden="true" />
      <div id="atlas-overlay" aria-hidden="true">
        <div className="atlas-spinner" />
      </div>
    </>
  );
}
