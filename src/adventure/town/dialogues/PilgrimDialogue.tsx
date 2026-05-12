import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";

type Props = {
  npc: Npc;
  onClose: () => void;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

// 순례자 미상 — "북쪽 너머" 미스터리. 의뢰 없이 대사 분기만 (콘텐츠 떡밥 보관소).
//   0 잠금          : 운향 도달 직후 — npcs.ts greeting + 짧은 잡담.
//   1 1차 해금      : volcano_heart_defeated → 천공 성지·해무를 가리킨다.
//   2 2차 해금      : skyreach_main_cleared → 북쪽의 정체 일부 공개 + pilgrim_revealed flag.
//   (3 후드 손님 합류는 §11 hidden-hooded-cipher — M6)
export function PilgrimDialogue({ npc, onClose, storyFlags }: Props) {
  const revealed = storyFlags.has("pilgrim_revealed");
  const skyreachCleared = storyFlags.has("skyreach_main_cleared");
  const volcanoDefeated = storyFlags.has("volcano_heart_defeated");

  // 이미 한 번 들었음 — 북쪽 떡밥 재확인.
  if (revealed) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "북쪽 너머. 구름이 끝나는 곳, 그 위에 또 한 겹이 있다.\n…너는 이미 표식을 봤어. 후드를 쓴 자에게서, 그리고 해무에게서. 같은 손이 그은 거다. 머지않아 알게 될 거야."
        }
      />
    );
  }

  // 2차 해금 — 봉인 라인까지 끝낸 자에게 북쪽의 정체 한 겹을 연다.
  if (skyreachCleared) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "봉인을 완성했다고 들었다. 해무가 전한 말도.\n…그렇다면 이제 말해주지. 내가 온 곳은 단순한 북쪽이 아니야. 구름층 너머 — 사람이 닿은 적 없는 곳. 거기서 무언가가 깨어나려 하고, 나는 그걸 막을 손을 찾아 내려왔다.\n네가 그 손인지는 아직 모르겠어. 하지만 표식은 너를 향하고 있어. 후드를 쓴 자도, 해무도, 나도 — 같은 표식을 봤다."
        }
        primaryAction={{
          label: "고개를 끄덕인다",
          onClick: () => {
            storyFlags.set("pilgrim_revealed");
            onClose();
          },
        }}
      />
    );
  }

  // 1차 해금 — 화산의 심장 처치 후. 천공 성지·해무를 가리킨다.
  if (volcanoDefeated) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "능선 너머의 불덩이를 잠재웠다고? …그렇다면 천공 성지가 열렸겠군.\n거기 원로 해무를 만나라. 그가 나보다 더 안다. 봉인의 일이라면 — 끝까지 그를 도와라. 그게 북쪽 너머로 가는 첫 걸음이다."
        }
      />
    );
  }

  // 0 — 떡밥 들은 적 없는 초기. npcs.ts greeting + 짧은 잡담.
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={
        "…북쪽에서 왔다. 그 너머는 아직 네가 알 시간이 아니야.\n춥나? 산정의 추위는 견딜 만한 거다. 진짜 추운 건 별이 끝나는 자리지. — 가라. 산이 너를 부른다."
      }
    />
  );
}
