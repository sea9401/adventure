import { useEffect, useState } from "react";

export function RegionBackground({
  regionId,
}: {
  regionId: string;
}) {
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrored(false);
  }, [regionId]);
  if (errored) return null;
  const src = `/images/ui/${regionId}.webp`;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onError={() => setErrored(true)}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-zinc-50/85 dark:bg-zinc-950/80" />
    </div>
  );
}
