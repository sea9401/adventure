import type { RegionId } from "./world";

export type NpcId =
  | "village_trainer_smith"
  | "diola_elder"
  | "diola_fisher"
  | "diola_innkeeper"
  | "diola_merchant"
  | "diola_kid"
  | "diola_stranger";

export type NpcRole =
  | "elder"
  | "vendor"
  | "innkeeper"
  | "quest"
  | "lore"
  | "stranger"
  | "trainer";

export type Npc = {
  id: NpcId;
  region: RegionId;
  name: string;
  role: NpcRole;
  description: string;
  greeting: string;
};

export const NPCS: Npc[] = [
  {
    id: "village_trainer_smith",
    region: "village",
    name: "훈련 교관 스미스",
    role: "trainer",
    description:
      "마을 한구석 훈련장을 지키는 전직 모험가. 어깨가 두툼하고 손마디가 굵다.",
    greeting:
      "왔구나, 새내기.\n자세부터 잡아주마. 모험은 한 번 휘두르는 검보다, 백 번 흘리는 땀이다.",
  },
  {
    id: "diola_elder",
    region: "diola",
    name: "촌장 마린",
    role: "elder",
    description: "바닷바람에 그을린 노인. 호수의 모든 변화를 기억한다.",
    greeting:
      "…어서 와요, 모험가.\n안개가 짙은 날엔 길을 잘 살펴야 해. 이 호수도 늘 같은 자리에 있는 건 아니거든.",
  },
  {
    id: "diola_fisher",
    region: "diola",
    name: "어부 카이",
    role: "quest",
    description: "매일 새벽 호수에 나가는 청년. 말수가 적다.",
    greeting:
      "…뭐.\n물고기가 줄었어. 그것뿐이야. 호수에 뭔가 있어.",
  },
  {
    id: "diola_innkeeper",
    region: "diola",
    name: "여관 주인 노라",
    role: "innkeeper",
    description: "안개 여관의 주인. 따뜻한 미소가 인상적.",
    greeting:
      "피곤해 보이네요. 들어와요.\n방은 비어 있어요. 침대 시트는 갓 갈아둔 거랍니다.",
  },
  {
    id: "diola_merchant",
    region: "diola",
    name: "잡화상 보로",
    role: "vendor",
    description: "어딘지 음흉한 미소의 잡화상.",
    greeting:
      "어이~ 좋은 거 들여놨는데, 한번 봐요.\n호수에서만 잡히는 미끼도 있다구요?",
  },
  {
    id: "diola_kid",
    region: "diola",
    name: "꼬마 리오",
    role: "lore",
    description: "또래 친구가 없는지, 모험가에게 들러붙는다.",
    greeting:
      "아저씨! 아니, 누나? 어쨌든!\n어젯밤에 호수에서 등불이 떠다니는 걸 봤어요. 진짜로!",
  },
  {
    id: "diola_stranger",
    region: "diola",
    name: "후드를 쓴 손님",
    role: "stranger",
    description: "여관 구석 자리에 앉아 있는 정체 모를 사람.",
    greeting:
      "…아직 너에게 들려줄 이야기는 없어.\n호수 너머를 봤을 때, 다시 와.",
  },
];

export function getNpcsByRegion(regionId: RegionId): Npc[] {
  return NPCS.filter((n) => n.region === regionId);
}
