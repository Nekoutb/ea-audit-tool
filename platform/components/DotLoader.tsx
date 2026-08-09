/** A ring of nine dots turning slowly — the loading state across the app. */
export function DotLoader() {
  const dots = Array.from({ length: 9 }, (_, i) => i);
  return (
    <div
      aria-label="Loading"
      role="status"
      className="relative h-12 w-12 motion-safe:animate-[spin_2.8s_linear_infinite]"
    >
      {dots.map((i) => (
        <span
          key={i}
          className="absolute left-1/2 top-0 h-1.5 w-1.5 -ml-[3px] rounded-full bg-emerald-700 dark:bg-emerald-400"
          style={{ transform: `rotate(${i * 40}deg)`, transformOrigin: "3px 24px", opacity: 0.25 + 0.75 * (i / 9) }}
        />
      ))}
    </div>
  );
}
