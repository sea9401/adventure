import { REPEAT_COOLDOWN_MS_DEFAULT, type Quest } from "../data/quests";
import type { QuestProgressEntry } from "./storage";

// 반복 의뢰의 재수주 가능 시각(ms). 비반복/한 번도 안 끝낸 경우 null.
export function cooldownReadyAt(
  quest: Quest,
  entry: QuestProgressEntry,
): number | null {
  if (!quest.repeatable) return null;
  if (entry.lastCompletedAt == null) return null;
  const dur = quest.cooldownMs ?? REPEAT_COOLDOWN_MS_DEFAULT;
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
