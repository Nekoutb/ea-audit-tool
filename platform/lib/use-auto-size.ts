"use client";

// Answer boxes sized to their text. The boxes used to grow only while typing
// (onInput) and were capped at 120 px, so after a save the paper re-rendered
// them at one row and the rest of the answer was hidden with no scroll bar.
//
// Default: a box is always as tall as its text — when the paper opens, when a
// wizard page that was hidden becomes visible (a ResizeObserver sees the box
// go from 0 px wide to its real width), and while typing.
//
// Compact view (per-user switch on the paper, remembered in this browser):
// a box shows two lines with a fade until it is clicked, then opens to its
// full text and folds back when focus leaves it. Print always shows the full
// text (app/globals.css).

import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react";

const KEY = "wp-compact-view";
const EVENT = "wp-compact-change";
/** Lines a folded box keeps visible in compact view. */
export const COMPACT_LINES = 2;

function readCompact(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The compact-view preference; false on the server and before hydration. */
export function useCompactView(): [boolean, (on: boolean) => void] {
  const compact = useSyncExternalStore(subscribe, readCompact, () => false);
  const set = useCallback((on: boolean) => {
    try {
      window.localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      // storage blocked: the switch still applies until the page reloads
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [compact, set];
}

/** Set a textarea's height to its content, or to the folded height. */
export function fitTextarea(el: HTMLTextAreaElement, folded: boolean): void {
  if (el.clientWidth === 0) return; // inside a hidden wizard page: measure later
  el.style.height = "auto";
  const full = el.scrollHeight + (el.offsetHeight - el.clientHeight);
  if (!folded) {
    el.style.height = `${full}px`;
    return;
  }
  const cs = window.getComputedStyle(el);
  const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
  const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = `${Math.min(full, Math.ceil(line * COMPACT_LINES + pad + border))}px`;
}

/**
 * Keep a textarea sized to its text. Returns whether the box is currently
 * folded (compact view, not focused, text longer than the folded height), so
 * the caller can draw the fade.
 */
export function useAutoSize(
  ref: RefObject<HTMLTextAreaElement | null>,
  enabled = true,
  /** false for boxes that must never fold (a review-note composer) */
  compactable = true,
): boolean {
  const [compact] = useCompactView();
  const [focused, setFocused] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const folded = enabled && compactable && compact && !focused;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const fit = () => {
      fitTextarea(el, folded);
      setOverflowing(folded && el.scrollHeight > el.clientHeight + 1);
    };
    fit();
    el.addEventListener("input", fit);
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    el.addEventListener("focus", onFocus);
    el.addEventListener("blur", onBlur);
    // A wizard page that was hidden has width 0; this fires when it is shown,
    // and when the window is resized and lines re-wrap.
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => {
      el.removeEventListener("input", fit);
      el.removeEventListener("focus", onFocus);
      el.removeEventListener("blur", onBlur);
      ro.disconnect();
    };
  }, [ref, enabled, folded]);

  return folded && overflowing;
}
