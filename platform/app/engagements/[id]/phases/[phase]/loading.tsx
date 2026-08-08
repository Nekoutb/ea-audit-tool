/** Skeleton for a phase task list: header + workspace chips + table rows. */
export default function PhaseLoading() {
  const shimmer = "animate-pulse motion-reduce:animate-none rounded-[var(--radius-atlas-sm)] bg-surface-2";
  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8" aria-busy>
      <div className={`${shimmer} h-14 w-full rounded-[var(--radius-atlas)]`} />
      <div className="flex flex-col gap-2">
        <div className={`${shimmer} h-4 w-44`} />
        <div className={`${shimmer} h-8 w-80`} />
      </div>
      <div className="flex gap-2">
        {[0, 1].map((i) => (
          <div key={i} className={`${shimmer} h-8 w-32 rounded-full`} />
        ))}
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-[var(--radius-atlas)]">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className={`${shimmer} h-14 w-full rounded-none`} />
        ))}
      </div>
    </main>
  );
}
