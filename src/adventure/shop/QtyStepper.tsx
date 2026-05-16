"use client";

export function QtyStepper({
  qty,
  setQty,
  min,
  max,
  disabled,
}: {
  qty: number;
  setQty: (n: number | ((prev: number) => number)) => void;
  min: number;
  max?: number;
  disabled?: boolean;
}) {
  const clamp = (n: number) => {
    let v = Math.max(min, Math.floor(n || min));
    if (max !== undefined) v = Math.min(v, max);
    return v;
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setQty((q) => clamp(q - 1))}
        disabled={disabled || qty <= min}
        className="h-10 w-10 rounded-md border border-zinc-300 text-base text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-label="수량 감소"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={qty}
        disabled={disabled}
        onChange={(e) => setQty(clamp(Number(e.target.value)))}
        className="w-12 rounded-md border border-zinc-300 bg-white px-2 py-1 text-center text-sm tabular-nums disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        type="button"
        onClick={() => setQty((q) => clamp(q + 1))}
        disabled={disabled || (max !== undefined && qty >= max)}
        className="h-10 w-10 rounded-md border border-zinc-300 text-base text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-label="수량 증가"
      >
        +
      </button>
    </>
  );
}
