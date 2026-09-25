"use client";

// The benchmark select of the materiality form. Changing it refills the
// amount from the trial-balance base and the percentage from the middle of
// the firm's range for that benchmark (UAT B47) — the old select kept the
// previous benchmark's figures under the new label.

const RANGES: Record<string, { min: number; max: number }> = {
  pbt: { min: 5, max: 10 },
  revenue: { min: 0.5, max: 2 },
  total_assets: { min: 0.5, max: 2 },
  equity: { min: 1, max: 5 },
  expenses: { min: 0.5, max: 2 },
};

export function MaterialityBenchmarkSelect({
  options,
  bases,
  className,
  defaultValue,
}: {
  options: { value: string; label: string }[];
  bases: Record<string, number> | null;
  className: string;
  defaultValue?: string;
}) {
  function onChange(key: string) {
    const amount = document.querySelector<HTMLInputElement>('[data-testid="materiality-amount"]');
    const pct = document.querySelector<HTMLInputElement>('[data-testid="materiality-pct"]');
    if (amount && bases && bases[key] !== undefined) amount.value = String(Math.abs(bases[key]));
    const range = RANGES[key];
    if (pct && range) pct.value = String((range.min + range.max) / 2);
  }
  return (
    <select
      name="benchmark"
      className={className}
      defaultValue={defaultValue}
      onChange={(e) => onChange(e.target.value)}
      data-testid="materiality-benchmark"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
