import type { useQuests } from "@/adventure/quests/useQuests";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";

// completeQuest 의 후처리 — 특정 의뢰 완료 시 칭호 부여 + 스토리 flag 세팅.
// claim 직후 호출한다 (방금 완료한 의뢰 자체는 상태가 비동기라, 짝 의뢰의 completed 여부로
// 라인 클로저를 판정하는 패턴).
export function applyQuestCompletionSideEffects(
  id: string,
  deps: {
    grantTitle: (titleId: string) => void;
    storyFlags: ReturnType<typeof useStoryFlags>;
    quests: ReturnType<typeof useQuests>;
  },
): void {
  const { grantTitle, storyFlags, quests } = deps;

  // 마린의 영혼 결정 의뢰 = "안개 너머의 길" 라인의 클로저 → 칭호 부여.
  if (id === "diola-marin-soul-crystals") grantTitle("diola_friend");
  // 운향 메인 라인 "잠들지 않는 산" — 백운의 운봉의 거인 의뢰 완수 → 칭호 + flag.
  if (id === "unhyang-baekun-peak-giant") {
    grantTitle("mountain_friend");
    storyFlags.set("unhyang_main_cleared");
  }
  // 교역로 정리 2종(협곡 절벽 늑대 + 산기슭 산양) 둘 다 완료 → 디올라 연계 입구 개방.
  // claim 직후엔 방금 완료한 쪽 상태가 비동기라, 나머지 한쪽이 이미 completed 인지로 판정.
  if (
    id === "unhyang-baekun-cliff-wolves" &&
    quests.getEntry("unhyang-baekun-highland-goats").state === "completed"
  )
    storyFlags.set("mountain_trade_open");
  if (
    id === "unhyang-baekun-highland-goats" &&
    quests.getEntry("unhyang-baekun-cliff-wolves").state === "completed"
  )
    storyFlags.set("mountain_trade_open");
  // 천공 성지 메인 라인 "능선 너머의 봉인" — 해무의 마지막 자물쇠 완수 → 칭호 + flag.
  if (id === "skyreach-haemu-flame-scale") {
    grantTitle("ridge_crosser");
    storyFlags.set("skyreach_main_cleared");
  }
  // 마을 간 연계 — 완료 시 양쪽 NPC 다이얼로그 갱신용 flag (+ 칭호).
  if (id === "diola-marin-mountain-trade")
    storyFlags.set("diola_unhyang_trade_done");
  if (id === "unhyang-sanha-nora-herbs") {
    storyFlags.set("sanha_nora_herbs_sent");
    grantTitle("herbalists_courier");
  }
  if (id === "village-jimmy-doyeon-timber")
    storyFlags.set("jimmy_doyeon_timber_done");
  // 보스 누적 사냥 의뢰 3종(광맥의 수호자 / 운봉의 거인 / 화산의 심장) 모두 완수 → 칭호.
  // claim 직후 방금 완료한 쪽 상태가 비동기라, 나머지가 이미 completed 인지로 판정.
  {
    const HUNTERS = [
      "deep-cave-hunter",
      "peak-giant-hunter",
      "volcano-heart-hunter",
    ] as const;
    if ((HUNTERS as readonly string[]).includes(id)) {
      const others = HUNTERS.filter((h) => h !== id);
      if (others.every((h) => quests.getEntry(h).state === "completed"))
        grantTitle("boss_hunter");
    }
  }
  // 바람골 노을의 호위 의뢰 2종 모두 완수 → '대상의 수호자' 칭호.
  {
    const ESCORTS = [
      "windvale-merchant-escort-raiders",
      "windvale-merchant-escort-hawks",
    ] as const;
    if ((ESCORTS as readonly string[]).includes(id)) {
      const other = ESCORTS.find((e) => e !== id)!;
      if (quests.getEntry(other).state === "completed")
        grantTitle("caravan_warden");
    }
  }
}
