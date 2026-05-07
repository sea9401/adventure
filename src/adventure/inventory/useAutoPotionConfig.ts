"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PotionId } from "../data/potions";

export type AutoUseTrigger = { kind: "hp_below_pct"; pct: number };

export type AutoPotionRule = {
  enabled: boolean;
  potionId: PotionId;
  trigger: AutoUseTrigger;
};

export type AutoPotionConfig = { rules: AutoPotionRule[] };

const STORAGE_KEY = "auto-potion-rules.v1";

export const defaultAutoPotionConfig = (): AutoPotionConfig => ({
  rules: [
    {
      enabled: false,
      potionId: "potion_heal_s",
      trigger: { kind: "hp_below_pct", pct: 50 },
    },
  ],
});

function load(): AutoPotionConfig {
  if (typeof window === "undefined") return defaultAutoPotionConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAutoPotionConfig();
    const parsed = JSON.parse(raw) as Partial<AutoPotionConfig> | null;
    if (!parsed?.rules) return defaultAutoPotionConfig();
    return { rules: parsed.rules };
  } catch {
    return defaultAutoPotionConfig();
  }
}

function save(config: AutoPotionConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function useAutoPotionConfig() {
  const [config, setConfig] = useState<AutoPotionConfig>(
    defaultAutoPotionConfig,
  );
  const [hydrated, setHydrated] = useState(false);
  const configRef = useRef<AutoPotionConfig>(defaultAutoPotionConfig());

  useEffect(() => {
    const loaded = load();
    configRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfig(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    configRef.current = config;
    if (!hydrated) return;
    save(config);
  }, [hydrated, config]);

  const updateRule = useCallback(
    (index: number, patch: Partial<AutoPotionRule>) => {
      const cur = configRef.current;
      if (index < 0 || index >= cur.rules.length) return;
      const nextRules = cur.rules.map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      );
      const next: AutoPotionConfig = { rules: nextRules };
      configRef.current = next;
      setConfig(next);
    },
    [],
  );

  return { config, configRef, hydrated, updateRule };
}
