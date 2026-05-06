import { Tooltip } from "./Tooltip";

export function Row({ label, value, title }: { label: string; value: string; title?: string }) {
  if (!title) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-fg-faint">{label}</span>
        <span className="text-fg font-medium">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between text-sm">
      <Tooltip content={title}>
        <span className="text-fg-faint underline decoration-dotted decoration-fg-dim underline-offset-2">
          {label}
        </span>
      </Tooltip>
      <span className="text-fg font-medium">{value}</span>
    </div>
  );
}
