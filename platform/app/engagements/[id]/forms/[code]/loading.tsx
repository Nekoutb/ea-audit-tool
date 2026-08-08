/** Skeleton for a task page: back link, header, purpose card, fields, footer. */
export default function TaskLoading() {
  const shimmer = "animate-pulse motion-reduce:animate-none rounded-[var(--radius-atlas-sm)] bg-surface-2";
  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8" aria-busy>
      <div className={`${shimmer} h-14 w-full rounded-[var(--radius-atlas)]`} />
      <div className="flex flex-col gap-2">
        <div className={`${shimmer} h-4 w-52`} />
        <div className={`${shimmer} h-8 w-96 max-w-full`} />
        <div className={`${shimmer} h-4 w-72`} />
      </div>
      <div className={`${shimmer} h-44 w-full rounded-[var(--radius-atlas)]`} />
      <div className={`${shimmer} h-56 w-full rounded-[var(--radius-atlas)]`} />
      <div className={`${shimmer} h-16 w-full rounded-[var(--radius-atlas)]`} />
    </main>
  );
}
