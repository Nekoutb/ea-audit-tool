/** What an engagement page looks like while its data arrives (F080), instead of the previous page. */
export default function EngagementLoading() {
  const bar = "animate-pulse rounded-[var(--radius-atlas-sm)] bg-surface-2 motion-reduce:animate-none";
  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-6" aria-busy="true" data-testid="engagement-skeleton">
      <div className={`${bar} h-9 w-full`} />
      <div className={`${bar} h-7 w-72`} />
      <div className={`${bar} h-40 w-full`} />
      <div className={`${bar} h-64 w-full`} />
    </main>
  );
}
