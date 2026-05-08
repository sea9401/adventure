"use client";

import { useEffect, useState } from "react";
import { loadBundle, writeBundleKey } from "../storage-bundle";
import { useAdmin } from "../AdminContext";
import { Button, Checkbox, NumberInput } from "../ui/Field";
import {
  defaultAutoPotionConfig,
  type AutoPotionConfig,
  type AutoPotionRule,
} from "@/adventure/inventory/useAutoPotionConfig";

export function AutoPotionTab() {
  const { readOnly, bump, bumpVersion, showToast } = useAdmin();
  const [config, setConfig] = useState<AutoPotionConfig>(
    defaultAutoPotionConfig(),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfig(loadBundle().data.autoPotion ?? defaultAutoPotionConfig());
  }, [bumpVersion]);

  const persist = (next: AutoPotionConfig) => {
    setConfig(next);
    writeBundleKey("autoPotion", next);
    bump();
    showToast("저장됨.");
  };

  const updateRule = (idx: number, patch: Partial<AutoPotionRule>) => {
    persist({
      ...config,
      rules: config.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    });
  };

  const addRule = () => {
    persist({
      ...config,
      rules: [
        ...config.rules,
        {
          enabled: false,
          target: "hp_heal",
          trigger: { kind: "hp_below_pct", pct: 50 },
        },
      ],
    });
  };

  const removeRule = (idx: number) => {
    persist({
      ...config,
      rules: config.rules.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">자동 포션 룰 ({config.rules.length})</h2>
          <div className="flex gap-2">
            <Button disabled={readOnly} onClick={addRule}>
              + 룰 추가
            </Button>
            <Button
              disabled={readOnly}
              onClick={() => persist(defaultAutoPotionConfig())}
            >
              기본값 복원
            </Button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {config.rules.map((rule, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-3 rounded border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <Checkbox
                checked={rule.enabled}
                disabled={readOnly}
                onChange={(enabled) => updateRule(i, { enabled })}
                label="활성화"
              />
              <div className="text-xs text-zinc-500">
                target: <code className="font-mono">{rule.target}</code>
              </div>
              <div>
                <div className="text-xs text-zinc-500">
                  HP 이하(%) 트리거
                </div>
                <div className="w-28">
                  <NumberInput
                    value={rule.trigger.pct}
                    min={0}
                    max={100}
                    disabled={readOnly}
                    onChange={(pct) =>
                      updateRule(i, {
                        trigger: { kind: "hp_below_pct", pct },
                      })
                    }
                  />
                </div>
              </div>
              <Button
                disabled={readOnly}
                onClick={() => removeRule(i)}
              >
                삭제
              </Button>
            </div>
          ))}
          {config.rules.length === 0 ? (
            <div className="text-center text-xs text-zinc-500">
              룰이 없습니다.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
