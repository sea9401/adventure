export function HpBar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(1, pct)) * 100;
  const color = pct > 0.6 ? "bg-emerald-500" : pct > 0.3 ? "bg-amber-500" : "bg-red-500";
  const pulse = pct > 0 && pct <= 0.3 ? "animate-pulse" : "";
  return (
    <div className="h-2 bg-panel-2 rounded-full overflow-hidden">
      <div className={`h-full transition-all ${color} ${pulse}`} style={{ width: `${p}%` }} />
    </div>
  );
}
