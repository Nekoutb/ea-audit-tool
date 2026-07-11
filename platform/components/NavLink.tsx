"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { startPageLoad } from "@/components/PageLoader";

/**
 * Nav link that fires the page-transition loader on click and marks itself active
 * when the current path matches. `exact` requires a full match (for top-level tabs);
 * otherwise a prefix match lights the section.
 */
export function NavLink({
  href,
  children,
  exact,
  className,
  activeClassName,
  idleClassName,
  onNavigate,
  testId,
}: {
  href: string;
  children: ReactNode;
  exact?: boolean;
  className?: string;
  activeClassName?: string;
  idleClassName?: string;
  onNavigate?: () => void;
  testId?: string;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      onClick={() => {
        startPageLoad();
        onNavigate?.();
      }}
      className={[className, active ? activeClassName : idleClassName].filter(Boolean).join(" ")}
    >
      {children}
    </Link>
  );
}
