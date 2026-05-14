import {
  REGION_REPEAT_COOLDOWN_MS,
  REPEAT_COOLDOWN_MS_DEFAULT,
  getQuestsForRegion,
  type Quest,
} from "../data/quests";
import type { RegionId } from "../data/world";
import type { QuestProgressEntry } from "./storage";

// 반복 의뢰의 재수주 가능 시각(ms). 비반복/한 번도 안 끝낸 경우 null.
// 쿨다운 우선순위: quest.cooldownMs > 지역별 기본값 > 전역 기본값.
export function cooldownReadyAt(
  quest: Quest,
  entry: QuestProgressEntry,
): number | null {
  if (!quest.repeatable) return null;
  if (entry.lastCompletedAt == null) return null;
  const dur =
    quest.cooldownMs ??
    REGION_REPEAT_COOLDOWN_MS[quest.regionId] ??
    REPEAT_COOLDOWN_MS_DEFAULT;
  return entry.lastCompletedAt + dur;
}

// 현재 시각 기준으로 쿨다운 중인지 + 남은 시간(ms).
export function cooldownStatus(
  quest: Quest,
  entry: QuestProgressEntry,
  now: number,
): { onCooldown: boolean; remaining: number } {
  const ready = cooldownReadyAt(quest, entry);
  if (ready == null) return { onCooldown: false, remaining: 0 };
  const remaining = ready - now;
  return remaining > 0
    ? { onCooldown: true, remaining }
    : { onCooldown: false, remaining: 0 };
}

// 길드 게시판에서 "지금 수락 가능한" 의뢰 ID 목록 — 단일 카드의 수락 버튼 활성화 조건과 동일.
// (1) 선행 의뢰 충족, (2) state=available, (3) 쿨다운 만료, (4) 레벨 충족.
// "전체 수락" 버튼이 사용 — GuildView 의 개별 카드 disabled 로직과 같은 기준이라 카운트가 일치.
export function getAcceptableQuestIds(
  regionId: RegionId,
  characterLevel: number,
  getEntry: (id: string) => QuestProgressEntry,
  now: number,
): string[] {
  return getQuestsForRegion(regionId)
    .filter((q) => {
      if (q.requiresQuestCompleted) {
        if (getEntry(q.requiresQuestCompleted).completedCount === 0) return false;
      }
      const entry = getEntry(q.id);
      if (entry.state !== "available") return false;
      if (cooldownStatus(q, entry, now).onCooldown) return false;
      if (characterLevel < q.requiredLevel) return false;
      return true;
    })
    .map((q) => q.id);
}
