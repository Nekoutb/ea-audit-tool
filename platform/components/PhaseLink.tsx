"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { startPageLoad } from "@/components/PageLoader";

/**
 * Wraps a dashboard phase gauge so clicking it drills into that phase's task
 * screen with the full transition treatment (top bar + spinner overlay).
 */
export function PhaseLink({
  href,
  children,
  testId,
}: {
  href: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      onClick={() => startPageLoad({ overlay: true })}
      className="block cursor-pointer rounded-[var(--radius-atlas)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-emerald-600 motion-reduce:hover:translate-y-0"
    >
      {children}
    </Link>
  );
}
