"use client";

import { Button } from "../../ui/Field";
import { WORLD_MAP } from "@/adventure/data/world";
import type { CharacterDynamicState } from "@/adventure/character/useCharacterState";

// region 일일 보스 입장 카운터 — character.v2 의 bossAttempts 필드.
// 빈 객체로 비우면 getBossAttemptsToday 가 모든 region 에 대해 0 을 돌려준다.
// 다른 날짜의 잔여 엔트리는 어차피 무시되지만, 깔끔하게 통째로 비운다.
export function BossSection({
  character,
  readOnly,
  loading,
  onResetBossAttempts,
}: {
  character: CharacterDynamicState | undefined;
  readOnly: boolean;
  loading: boolean;
  onResetBossAttempts: () => void;
}) {
  const entries = Object.entries(character?.bossAttempts ?? {}).filter(
    ([, v]) => v && v.count > 0,
  );
  const hasUsage = entries.length > 0;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">싱글 보스</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">기록된 도전 없음.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {entries.map(([regionId, v]) => {
            const name = regionName(regionId);
            return (
              <li key={regionId} className="flex justify-between gap-2">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {name}{" "}
                  <span className="font-mono text-[10px] text-zinc-400">
                    ({regionId})
                  </span>
                </span>
                <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                  {v!.count}회 · {v!.date}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3">
        <Button
          disabled={readOnly || loading || !hasUsage}
          onClick={onResetBossAttempts}
        >
          전체 보스 일일 카운터 초기화
        </Button>
      </div>
      {readOnly && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          보기 전용 모드 — 상단에서 편집 가능으로 전환해야 동작합니다.
        </p>
      )}
    </section>
  );
}

function regionName(regionId: string): string {
  return WORLD_MAP.regions.find((r) => r.id === regionId)?.name ?? "(알 수 없음)";
}
