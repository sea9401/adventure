"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { useEscapeKey } from "@/lib/useEscapeKey";
import {
  AP_SKILL_CONDITION_PRESETS,
  type APSkillCondition,
} from "@/adventure/character/apSkills";

// AP 스킬 슬롯 발동 조건 편집 모달.
//   - 트리거 라디오 (always / AP≥ / HP< / 적HP<)
//   - 임계값 입력: 프리셋 버튼 ↔ 슬라이더 토글
//   - 저장 시 onSave(condition) — 닫기는 호출 측이 담당.

type KindWithValue = Exclude<APSkillCondition["kind"], "always">;

const KIND_LABEL: Record<APSkillCondition["kind"], string> = {
  always: "항상",
  ap_at_least: "AP ≥ X",
  hp_below_pct: "HP < X%",
  enemy_hp_below_pct: "적HP < X%",
};

const VALUE_SUFFIX: Record<KindWithValue, string> = {
  ap_at_least: "",
  hp_below_pct: "%",
  enemy_hp_below_pct: "%",
};

export function APSkillConditionModal({
  skillName,
  initial,
  onSave,
  onClose,
}: {
  skillName: string;
  initial: APSkillCondition;
  onSave: (next: APSkillCondition) => void;
  onClose: () => void;
}) {
  useEscapeKey(onClose);
  const [kind, setKind] = useState<APSkillCondition["kind"]>(initial.kind);
  const [values, setValues] = useState<Record<KindWithValue, number>>(() => {
    // 트리거별 입력값을 따로 보관 — 사용자가 라디오를 바꿔도 직전 값 유지.
    const base = {
      ap_at_least: AP_SKILL_CONDITION_PRESETS.ap_at_least.presets[1],
      hp_below_pct: AP_SKILL_CONDITION_PRESETS.hp_below_pct.presets[1],
      enemy_hp_below_pct:
        AP_SKILL_CONDITION_PRESETS.enemy_hp_below_pct.presets[0],
    };
    if (initial.kind !== "always") base[initial.kind] = initial.value;
    return base;
  });
  const [sliderMode, setSliderMode] = useState(false);

  const handleSave = () => {
    if (kind === "always") onSave({ kind: "always" });
    else onSave({ kind, value: values[kind] });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ap-cond-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="ap-cond-title"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {skillName} — 발동 조건
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              조건이 맞을 때만 AP 를 써서 발동합니다. 슬롯 순서는 우선순위로 유지.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <fieldset className="mt-4 space-y-1">
          <legend className="sr-only">트리거 종류</legend>
          {(
            Object.keys(KIND_LABEL) as Array<APSkillCondition["kind"]>
          ).map((k) => (
            <label
              key={k}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <input
                type="radio"
                name="ap-cond-kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-500"
              />
              <span className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {KIND_LABEL[k]}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="mt-1 px-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          임계값 X 는 아래 프리셋/슬라이더에서 설정.
        </p>

        {kind !== "always" && (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                임계값
              </span>
              <button
                type="button"
                onClick={() => setSliderMode((v) => !v)}
                className="rounded-md border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {sliderMode ? "프리셋" : "슬라이더"}
              </button>
            </div>
            <ThresholdInput
              kind={kind}
              value={values[kind]}
              onChange={(v) =>
                setValues((prev) => ({ ...prev, [kind]: v }))
              }
              slider={sliderMode}
            />
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              현재 설정: <strong>{values[kind]}{VALUE_SUFFIX[kind]}</strong>
            </p>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function ThresholdInput({
  kind,
  value,
  onChange,
  slider,
}: {
  kind: KindWithValue;
  value: number;
  onChange: (v: number) => void;
  slider: boolean;
}) {
  const cfg = AP_SKILL_CONDITION_PRESETS[kind];
  if (slider) {
    return (
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-emerald-500"
        />
        <span className="w-12 text-right text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
          {value}
          {VALUE_SUFFIX[kind]}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {cfg.presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            value === p
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          {p}
          {VALUE_SUFFIX[kind]}
        </button>
      ))}
    </div>
  );
}
