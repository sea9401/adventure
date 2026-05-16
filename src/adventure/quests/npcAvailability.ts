import type { NpcId } from "../data/npcs";
import { QUESTS } from "../data/quests";
import { cooldownStatus } from "./cooldown";
import type { QuestProgressEntry } from "./storage";

// TownView 의 NPC "!" 뱃지 판정 — 지금 이 NPC 와 대화하면 새 의뢰를 받을 수 있는가.
// 조건: giverNpcId 일치 + state=available + 레벨 충족 + 쿨다운 OK + 선행 의뢰(completedCount>0).
// 한계: 일부 NPC 다이얼로그가 추가로 스토리 플래그를 검사 (예: 마린의 ruinsGuided).
// 거짓 양성이 보고되면 그때 플래그 게이트를 인지하도록 확장. 거짓 음성은 없음.
export function npcHasAcceptableQuest(
  npcId: NpcId,
  characterLevel: number,
  getEntry: (id: string) => QuestProgressEntry,
  now: number,
): boolean {
  return QUESTS.some((q) => {
    if (q.giverNpcId !== npcId) return false;
    // 발견형 의뢰는 뱃지로 스포일하지 않음 — 다이얼로그가 인벤/플래그/특수 조건을 직접 판정.
    if (q.hidden) return false;
    const entry = getEntry(q.id);
    if (entry.state !== "available") return false;
    if (characterLevel < q.requiredLevel) return false;
    if (cooldownStatus(q, entry, now).onCooldown) return false;
    if (q.requiresQuestCompleted) {
      if (getEntry(q.requiresQuestCompleted).completedCount === 0) return false;
    }
    return true;
  });
}
