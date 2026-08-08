/** Skeleton for the engagement dashboard (Vercel guideline: content-shaped
 *  loading states beat spinners for initial paints). */
export default function DashboardLoading() {
  const shimmer = "animate-pulse motion-reduce:animate-none rounded-[var(--radius-atlas-sm)] bg-surface-2";
  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8" aria-busy>
      <div className={`${shimmer} h-14 w-full rounded-[var(--radius-atlas)]`} />
      <div className={`${shimmer} h-7 w-72`} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${shimmer} h-40 rounded-[var(--radius-atlas)]`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className={`${shimmer} h-64 rounded-[var(--radius-atlas)] lg:col-span-2`} />
        <div className={`${shimmer} h-64 rounded-[var(--radius-atlas)]`} />
      </div>
    </main>
  );
}
