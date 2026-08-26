import Link from "next/link";

/** Branded 404 — the file has no such page; the register always exists. */
export default function NotFound() {
  return (
    <main className="grid min-h-screen w-full place-items-center px-6">
      <div className="text-center">
        <p className="font-mono text-[13px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">AuditISA</p>
        <h1 className="mt-3 text-[42px] font-extrabold leading-none tracking-[-0.03em] text-ink">404</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          This page is not in the audit file. / Cette page n&rsquo;est pas au dossier.
        </p>
        <Link
          href="/engagements"
          className="mt-5 inline-block rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-800"
        >
          Back to my engagements / Retour aux missions
        </Link>
      </div>
    </main>
  );
}
