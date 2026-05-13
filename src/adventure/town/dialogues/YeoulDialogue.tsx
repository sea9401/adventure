import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { FERRYMAN_FLAG_REEF_PASSAGE } from "./HaerangDialogue";

// 여울 — 소만 원로. 차분한 노인. 해안 지선 메인 라인의 축.
// 갈매·보말의 인트로 의뢰를 한 번씩 마치면 소만이 자네를 받아들임 → saltmarsh_vouched
// (= 해랑이 선저 덧대기 의뢰를 내준다). 해랑이 ferryman_reef_passage 를 켜면 →
// 암초 정찰(deep_scale ×10 deliver) → 수심의 것 처치(kill) → the_deep_one_stilled(보스 onDefeatFlag)
// → 정기 토벌 반복 의뢰. 각 의뢰는 quests.ts 의 saltmarsh-yeoul-* / saltmarsh-deep-one-recurring.
export const SALTMARSH_FLAG_VOUCHED = "saltmarsh_vouched";

const PORT_TRIAL_QUEST_IDS = [
  "saltmarsh-galmae-crabs",
  "saltmarsh-bomal-crab-shells",
] as const;

const SURVEY_QUEST = "saltmarsh-yeoul-reef-survey";
const SURVEY_NEED = 10; // 심해 비늘
const BOSS_QUEST = "saltmarsh-yeoul-deep-one";
const RECURRING_QUEST = "saltmarsh-deep-one-recurring";
const RECURRING_NEED = 3;

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  inventory: ReturnType<typeof useInventory>;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

export function YeoulDialogue({
  npc,
  onClose,
  quests,
  completeQuest,
  inventory,
  storyFlags,
}: Props) {
  const vouched = storyFlags.has(SALTMARSH_FLAG_VOUCHED);
  const passage = storyFlags.has(FERRYMAN_FLAG_REEF_PASSAGE);
  const stilled = storyFlags.has("the_deep_one_stilled");

  const survey = quests.getEntry(SURVEY_QUEST);
  const boss = quests.getEntry(BOSS_QUEST);
  const recurring = quests.getEntry(RECURRING_QUEST);

  // ── 정기 토벌 반복 의뢰 (수심의 것 처치 이후) ──
  if (recurring.state === "ready") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"또 가라앉혔구려. 물이 한동안은 잠잠하겠어 — 자, 약속한 사례요."}
        primaryAction={{
          label: "보상을 받는다",
          onClick: () => {
            if (completeQuest(RECURRING_QUEST)) onClose();
          },
        }}
      />
    );
  }
  if (recurring.state === "active") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={`그것은 한 번 가라앉혀도 또 뒤척이오. 세 번은 더 다녀와야 물이 가라앉을 게요. — 진행 ${recurring.progress}/${RECURRING_NEED}`}
      />
    );
  }

  // ── 수심의 것 처치 의뢰 ──
  if (boss.state === "ready") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"…수심의 것이 잠잠해졌다고. 자네가 그것을 가라앉혔어.\n물이 벌써 다르오. 한낮의 한기가 가셨어. 소만이 자네에게 진 빚은 — 갚을 길이 없겠지만, 우선 이거라도 받아 주게."}
        primaryAction={{
          label: "보상을 받는다",
          onClick: () => {
            if (completeQuest(BOSS_QUEST)) onClose();
          },
        }}
      />
    );
  }
  if (boss.state === "active") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={`혼자선 어림없는 상대요. 단단히 채비하고, 동료를 데려가게. 산정의 거인을 잠재운 자들처럼. — 진행 ${boss.progress}/1`}
      />
    );
  }
  if (boss.state === "completed") {
    if (recurring.state === "available") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={"한 번 가라앉혔다고 끝이 아니오. 또 물이 차거든 — 수심의 것을 세 번 더 가라앉혀 주게. 소만이 자네를 잊지 않을 게요."}
          primaryAction={{
            label: "받아들인다",
            onClick: () => {
              quests.accept(RECURRING_QUEST);
              onClose();
            },
          }}
        />
      );
    }
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          stilled
            ? "그물이 차오르고, 소금밭에 다시 사람이 붐비오. …자네가 한 일이야.\n안개 너머의 일이 다 끝난 건 아닐지 몰라도 — 이 포구는 자네를 식구로 기억할 게요."
            : "…고맙소. 진심으로. 소만은 자네를 잊지 않을 게요."
        }
      />
    );
  }

  // ── 암초 정찰 의뢰 완료 → 보스 의뢰 제안 ──
  if (survey.state === "completed") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"자네가 가져온 비늘을 봤네. …이만큼 자랐다면, 밑에서 자는 것이 거의 깨어난 거요.\n이제 알겠소 — 암초 밑에서 뒤척이는 그것이 잠잠해지지 않는 한, 이 포구는 다시 일어서지 못해. 수심의 것. 단단히 준비해 가서 그것을 가라앉혀 주게. 소만의 명운이 거기 달렸소."}
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept(BOSS_QUEST);
            onClose();
          },
        }}
      />
    );
  }

  // ── 암초 정찰 의뢰 (deliver: 심해 비늘 ×10) ──
  if (survey.state === "ready" || survey.state === "active") {
    const have = inventory.materialCount("deep_scale");
    if (have >= SURVEY_NEED) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={"열 조각 — 그래. 산호초 사이렌의 비늘이야. 이것이 이렇게 두꺼워졌다면…\n됐소. 잠깐 앉아 보게. 자네에게 할 이야기가 있어."}
          primaryAction={{
            label: "건네준다",
            onClick: () => {
              const r = quests.tryDeliver(
                SURVEY_QUEST,
                inventory.materialCount,
                inventory.consumeMaterial,
              );
              if (r.ok) {
                completeQuest(SURVEY_QUEST);
                onClose();
              }
            },
          }}
        />
      );
    }
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={`심해 비늘은 산호초 사이렌이 떨구오. 열 조각이면 암초가 얼마나 깨어났는지 보일 게요. 진행: ${have}/${SURVEY_NEED}`}
      />
    );
  }

  // ── 해랑이 배를 내준 뒤 — 암초 정찰 의뢰 제안 ──
  if (vouched && passage) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"해랑이 자네를 난바다로 데려갔다고 들었네. 그렇다면 부탁이 있소.\n암초 둘레의 산호가 어떻게 자라는지 봐 주게 — 산호초 사이렌의 비늘 열 조각이면 충분해. 그것이 두꺼워질수록, 밑에서 자는 것이 가까이 깨어났다는 뜻이오."}
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept(SURVEY_QUEST);
            onClose();
          },
        }}
      />
    );
  }

  // ── 보증은 했으나 아직 해랑이 배를 안 내줌 ──
  if (vouched) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"해랑에게 가 보게 — 자네를 보증해 뒀소. 그가 배를 손봐 줄 거요.\n…암초 너머, 안개 밑에 잠든 것이 있소. 노인들은 그것이 다시 뒤척인다고들 해. 자네가 그 너머를 보고 와 줘야겠소."}
      />
    );
  }

  // ── 아직 소만의 신임을 못 얻음 ──
  const portHelped = PORT_TRIAL_QUEST_IDS.every(
    (id) => quests.getEntry(id).completedCount > 0,
  );
  if (portHelped) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"갈매도, 보말도 자네를 받아들였군. …그렇다면 소만도 자네를 받아들이오.\n이제 이야기를 하지. 해랑에게 가 보게 — 내가 자네를 보증할 테니, 그가 자네를 난바다로 데려갈 거요. 암초 너머에 봐야 할 게 있소."}
        primaryAction={{
          label: "그러겠다고 한다",
          onClick: () => {
            storyFlags.set(SALTMARSH_FLAG_VOUCHED);
            onClose();
          },
        }}
      />
    );
  }
  const helpedCount = PORT_TRIAL_QUEST_IDS.filter(
    (id) => quests.getEntry(id).completedCount > 0,
  ).length;
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={`소만이 자네를 알아야, 우리 이야기도 시작되오. 갈매와 보말의 부탁을 한 번씩 들어주게. 둘이 자네를 받아들이면, 그때 다시 오시오. — ${helpedCount}/2`}
    />
  );
}
