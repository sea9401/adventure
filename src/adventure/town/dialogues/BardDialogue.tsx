import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { EquippedSlots } from "@/adventure/character/types";
import { ownedUniqueItemCount } from "@/adventure/inventory/ownership";

type Props = {
  npc: Npc;
  onClose: () => void;
  storyFlags: ReturnType<typeof useStoryFlags>;
  inventory: ReturnType<typeof useInventory>;
  equippedSlots: EquippedSlots;
};

// 떠돌이 음유시인 — 의뢰는 없고 §11 hidden-lucky-collector 만 가드한다.
// 유실된 명품(unique) 2종 보유 → bard_lucky_collected flag → lucky_finder 칭호(useTitleGrants).
export function BardDialogue({ npc, onClose, storyFlags, inventory, equippedSlots }: Props) {
  const collected = storyFlags.has("bard_lucky_collected");

  if (collected) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "행운은 이미 자네 손에 붙었어 — 노래대로.\n…그러니 다음 번 굉장한 발견이 있거든, 그건 운이 아니라 자네 솜씨인 거다. 잊지 마."
        }
      />
    );
  }

  const uniques = ownedUniqueItemCount(inventory.state, equippedSlots);

  if (uniques >= 2) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "오호 — 두 점이군. 유실품을 둘이나 그러모은 손이야.\n옛 노래대로다. 행운이 자네 손에 붙어. 어디서 떨어진 건지도 모를 명품이 두 번이나 자네한테 왔다면 — 세 번째도 올 거야. 그게 노래의 끝이지."
        }
        primaryAction={{
          label: "노래를 듣는다",
          onClick: () => {
            storyFlags.set("bard_lucky_collected");
            onClose();
          },
        }}
      />
    );
  }

  if (uniques >= 1) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "한 점은 있군 — 유실된 명품. 어디서 떨어진 건지도 모를 물건이지.\n노래는 두 점부터 시작돼. 하나 더 그러모으거든 다시 와. 그때 끝까지 불러줄게."
        }
      />
    );
  }

  return <NpcDialogue npc={npc} onClose={onClose} />;
}
