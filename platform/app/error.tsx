"use client";

import Link from "next/link";

/** Branded error boundary: no stack traces, one honest sentence, a way back. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen w-full place-items-center px-6">
      <div className="text-center">
        <p className="font-mono text-[13px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">AuditISA</p>
        <h1 className="mt-3 text-[24px] font-extrabold tracking-[-0.02em] text-ink">
          Something went wrong / Une erreur est survenue
        </h1>
        <p className="mt-2 text-[13.5px] text-ink-soft">
          Nothing was lost. Try again, or return to your engagements. / Rien n&rsquo;est perdu — réessayez ou revenez aux missions.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-800"
          >
            Try again / Réessayer
          </button>
          <Link href="/engagements" className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-4 py-2 text-[13px] font-semibold text-ink-soft hover:bg-surface-2">
            My engagements / Mes missions
          </Link>
        </div>
      </div>
    </main>
  );
}
