import type { CraftVariance } from "./craftQuality";

export type EquipSlot = "weapon" | "armor" | "accessory";

// 5단계 등급. 미지정은 common 으로 취급.
// common 은 기본 zinc 톤, 나머지는 색깔로 강조.
// unique 는 rare 위 / legendary 아래 — "특별한 한 자루" 급 보라색.
export type ItemRarity = "common" | "uncommon" | "rare" | "unique" | "legendary";

export type EquipBonus = {
  atk?: number;
  def?: number;
  str?: number;
  dex?: number;
  vit?: number;
  spd?: number;
  luk?: number;
};

// 보너스 키 ↔ 한글 라벨. EquipItem.stats 의 label 과 일치 — 제작 등급 stats 재생성·
// 인벤 비교 diff 등에서 공용으로 쓴다.
export const BONUS_LABELS: Record<keyof EquipBonus, string> = {
  atk: "공격력",
  def: "방어력",
  str: "힘",
  dex: "민첩",
  vit: "활력",
  spd: "속도",
  luk: "행운",
};

export const BONUS_KEYS = Object.keys(BONUS_LABELS) as (keyof EquipBonus)[];

// stats 표시용 — "+3" / "-2" / "+0".
export function signedBonus(n: number): string {
  return (n >= 0 ? "+" : "") + n;
}

export type EquipItem = {
  name: string;
  slot: EquipSlot;
  stats: { label: string; value: string }[];
  bonus?: EquipBonus;
  description?: string;
  // 거래소 등록 가능 여부. 미지정/true 면 거래 가능.
  // 시작 장비·서사 아이템 등에는 false 로 막는다.
  tradable?: boolean;
  rarity?: ItemRarity;
  // 드랍 품질 등급(정교한/빼어난) variance override. 미지정이면 "주력 양수 스탯 +q×1" 기본 규칙.
  // 드랍 경로(dropQuality.ts)에서만 참조 — 적용 대상이 아닌 장비(퀘 보상 등)에 둬도 무해.
  // varianceTable 을 쓰면 5칸 중 [2,3,4](일반/고급/걸작 칸)이 드랍 등급 0/1/2 로 재사용된다.
  dropVariance?: CraftVariance;
};

// 등급별 텍스트 색상. 인벤토리·장비창·드랍 모달 등 아이템 이름이 노출되는 곳에서 공용으로 쓴다.
// ITEMS의 const-narrow 타입에서는 rarity 미지정 아이템의 필드 자체가 안 보여서,
// EquipItem 으로 받아 옵셔널 접근하는 게 타입상 안전하다.
// fallback 은 common(미지정) 일 때 쓸 색상 — 보통 기본 zinc 톤이지만 보상 모달처럼 다른 톤이 어울리는 곳에서 override.
export function rarityTextClass(
  item: EquipItem | null | undefined,
  fallback = "text-zinc-900 dark:text-zinc-100",
): string {
  switch (item?.rarity) {
    case "uncommon":
      return "text-emerald-600 dark:text-emerald-400";
    case "rare":
      return "text-sky-600 dark:text-sky-400";
    case "unique":
      return "text-violet-600 dark:text-violet-400";
    case "legendary":
      return "text-amber-600 dark:text-amber-400";
    default:
      return fallback;
  }
}

export const ITEMS = {
  // 시작 장비
  branch_stick: {
    name: "나무 막대",
    slot: "weapon",
    stats: [{ label: "공격력", value: "+0" }],
    bonus: { atk: 0 },
    description: "나뭇가지를 대충 다듬어 만든 평범한 막대.",
    tradable: false,
  } satisfies EquipItem,
  cloth_clothes: {
    name: "천 옷",
    slot: "armor",
    stats: [{ label: "방어력", value: "+0" }],
    bonus: { def: 0 },
    description: "평범한 천으로 만든 옷.",
    tradable: false,
  } satisfies EquipItem,
  mom_amulet: {
    name: "엄마가 준 부적",
    slot: "accessory",
    stats: [{ label: "행운", value: "+2" }],
    bonus: { luk: 2 },
    description: "어머니의 사랑이 깃든 작은 부적.",
    tradable: false,
  } satisfies EquipItem,

  // 제작·드랍 장비
  baseball_bat: {
    name: "야구 방망이",
    slot: "weapon",
    stats: [{ label: "공격력", value: "+3" }],
    bonus: { atk: 3 },
    description: "단단한 나무를 깎아 만든 묵직한 방망이.",
  } satisfies EquipItem,
  nailed_baseball_bat: {
    name: "못박힌 야구방망이",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+3" },
      { label: "활력", value: "+1" },
    ],
    bonus: { atk: 3, vit: 1 },
    description: "방망이 끝에 낡은 못을 잔뜩 박아 넣었다. 휘두를 때마다 묵직하다.",
  } satisfies EquipItem,
  old_leather_armor: {
    name: "낡은 가죽갑옷",
    slot: "armor",
    stats: [{ label: "방어력", value: "+2" }],
    bonus: { def: 2 },
    description: "오랜 세월 입던 흔적이 남아있지만 천 옷보단 든든하다.",
  } satisfies EquipItem,
  vitality_ring: {
    name: "활력의 반지",
    slot: "accessory",
    stats: [{ label: "활력", value: "+2" }],
    bonus: { vit: 2 },
    description: "은은한 녹빛이 도는 반지. 끼고 있으면 몸이 가볍다.",
  } satisfies EquipItem,
  squishy_armor: {
    name: "물컹물컹한 갑옷",
    slot: "armor",
    stats: [{ label: "방어력", value: "+3" }],
    bonus: { def: 3 },
    description: "슬라임 핵을 심으로 두른 갑옷. 충격을 부드럽게 흡수한다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  bandit_dagger: {
    name: "산적의 단검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+4" },
      { label: "민첩", value: "+2" },
    ],
    bonus: { atk: 4, dex: 2 },
    description: "산적이 품에 숨기고 다니던 단검. 짧지만 손에 착 감긴다.",
  } satisfies EquipItem,
  mole_king_drill: {
    name: "두더지왕의 드릴",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+5" },
      { label: "속도", value: "+2" },
    ],
    bonus: { atk: 5, spd: 2 },
    description: "어느 두더지가 품에 꼭 쥐고 있던 작은 드릴. 회전시키면 묘하게 손맛이 좋다. 정말로 두더지왕이 있었는지는 아무도 모른다.",
    rarity: "rare",
  } satisfies EquipItem,
  spare_hatchet: {
    name: "예비 손도끼",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+2" },
      { label: "민첩", value: "+1" },
    ],
    bonus: { atk: 2, dex: 1 },
    description: "나무꾼 지미가 챙겨 다니던 예비 손도끼. 손에 익으면 제법 매섭다.",
    tradable: false,
  } satisfies EquipItem,
  nymph_ring: {
    name: "님프의 반지",
    slot: "accessory",
    stats: [{ label: "속도", value: "+2" }],
    bonus: { spd: 2 },
    description: "은은하게 푸른빛이 도는 가는 반지. 호수 님프의 가호가 깃들어 있다.",
  } satisfies EquipItem,
  golem_hammer: {
    name: "골렘의 망치",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+7" },
      { label: "속도", value: "-2" },
    ],
    bonus: { atk: 7, spd: -2 },
    description: "부서진 골렘의 팔에서 떼어낸 둔중한 돌망치. 휘두르려면 두 손이 필요하다.",
  } satisfies EquipItem,
  golem_armor: {
    name: "골렘갑주",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+6" },
      { label: "공격력", value: "-1" },
      { label: "속도", value: "-3" },
      { label: "행운", value: "-1" },
    ],
    bonus: { def: 6, atk: -1, spd: -3, luk: -1 },
    description: "골렘의 잔해를 덧대어 만든 두꺼운 갑주. 묵직한 만큼 휘두름과 발걸음, 운이 따라 무거워진다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  wraith_cloak: {
    name: "망령의 망토",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+2" },
      { label: "민첩", value: "+1" },
      { label: "속도", value: "+2" },
    ],
    bonus: { def: 2, dex: 1, spd: 2 },
    description: "떠도는 망령이 두르고 있던 누더기 망토. 입으면 발걸음이 어딘가 가벼워진다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  sticky_cloak: {
    name: "비단 로브",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+2" },
      { label: "행운", value: "+4" },
    ],
    bonus: { def: 2, luk: 4 },
    description: "거미줄을 비단처럼 곱게 짜낸 로브. 걸치고 있으면 묘하게 운이 따른다고 한다.",
  } satisfies EquipItem,
  bat_hood: {
    name: "박쥐가죽 후드",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+1" },
      { label: "속도", value: "+3" },
    ],
    bonus: { def: 1, spd: 3 },
    description: "박쥐 가죽을 이어 만든 후드. 어둠 속에서도 발이 가볍다.",
  } satisfies EquipItem,
  crystal_dagger: {
    name: "수정 단검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+4" },
      { label: "민첩", value: "+1" },
    ],
    bonus: { atk: 4, dex: 1 },
    description: "단단한 수정을 깎아 만든 날카로운 단검.",
    rarity: "uncommon",
  } satisfies EquipItem,
  fairy_blessing: {
    name: "요정의 가호",
    slot: "accessory",
    stats: [
      { label: "활력", value: "+3" },
      { label: "행운", value: "+2" },
    ],
    bonus: { vit: 3, luk: 2 },
    description: "활력의 반지에 요정가루의 가호를 입힌 것. 끼고 있으면 몸도, 운도 따른다.",
    rarity: "uncommon",
  } satisfies EquipItem,

  // 마정석 무기 4종 — 광맥의 수호자 처치 보상으로 풀리는 동굴 강화 라인.
  // 모두 weapon 슬롯, atk +6 공통(제작 `일반` 등급 기준 — 품질에 따라 ±2) + 보조 스탯이 다름.
  mana_sword: {
    name: "마정석 검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+6" },
      { label: "힘", value: "+3" },
    ],
    bonus: { atk: 6, str: 3 },
    description: "마정석을 칼날에 박아 넣은 한손검. 휘두르면 묵직한 무게가 손에 실린다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  mana_shield: {
    name: "마정석 방패",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+6" },
      { label: "활력", value: "+3" },
    ],
    bonus: { atk: 6, vit: 3 },
    description: "마정석을 박은 묵직한 방패. 막아내며 받아치는 데에도 쓴다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  mana_spear: {
    name: "마정석 창",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+6" },
      { label: "민첩", value: "+3" },
    ],
    bonus: { atk: 6, dex: 3 },
    description: "끝에 마정석을 깎아 박은 긴 창. 가벼우면서도 묘하게 정확하다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  mana_knuckle: {
    name: "마정석 너클",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+6" },
      { label: "행운", value: "+5" },
    ],
    bonus: { atk: 6, luk: 5 },
    description: "마정석 조각을 손등에 박은 너클. 한 방 한 방이 묘하게 운에 맡겨지는 느낌이 든다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  mana_bracelet: {
    name: "마정석 팔찌",
    slot: "accessory",
    stats: [
      { label: "활력", value: "+3" },
      { label: "속도", value: "+2" },
    ],
    bonus: { vit: 3, spd: 2 },
    description: "마정석 조각을 엮어 만든 팔찌. 손목에 두르면 몸이 단단해지면서도 발이 가벼워진다.",
  } satisfies EquipItem,

  // 운봉 무기 4종 + 액세서리 2 — 운봉의 거인 협동 처치 보상으로 풀리는 산정 강화 라인.
  // 마정석 라인의 한 단계 위. 무기 atk +8 공통(제작 `일반` 등급 기준 — 품질에 따라 ±2) + 보조 stat.
  peak_sword: {
    name: "운봉 대검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+8" },
      { label: "힘", value: "+5" },
    ],
    bonus: { atk: 8, str: 5 },
    description: "운봉의 거인 뼛조각으로 단련한 한손 대검. 무게가 손에 그대로 실린다.",
    rarity: "rare",
  } satisfies EquipItem,
  peak_shield: {
    name: "운봉 방벽",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+8" },
      { label: "활력", value: "+6" },
    ],
    bonus: { atk: 8, vit: 6 },
    description: "거인의 비늘을 그대로 두른 방패형 무기. 막으며 쳐낸다.",
    rarity: "rare",
  } satisfies EquipItem,
  peak_spear: {
    name: "운봉 장창",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+8" },
      { label: "민첩", value: "+6" },
    ],
    bonus: { atk: 8, dex: 6 },
    description: "운봉석 끝을 깎아 박은 긴 창. 멀리서도 정확하다.",
    rarity: "rare",
  } satisfies EquipItem,
  peak_claw: {
    name: "운봉 발톱",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+8" },
      { label: "행운", value: "+6" },
    ],
    bonus: { atk: 8, luk: 6 },
    description: "거인의 손가락뼈를 갈아 만든 발톱형 너클. 한 방 한 방이 운에 맡겨진다.",
    rarity: "rare",
  } satisfies EquipItem,
  peak_mantle: {
    name: "운봉 견갑",
    slot: "accessory",
    stats: [
      { label: "민첩", value: "+4" },
      { label: "속도", value: "+4" },
    ],
    bonus: { dex: 4, spd: 4 },
    description: "운봉의 거인 어깨 비늘을 가볍게 깎아 만든 견갑. 두르면 손이 빨라지고 발이 가벼워진다.",
    rarity: "rare",
  } satisfies EquipItem,
  // 운봉의 심장 — 협동 보스 처치 보상. str 중심 공격형 액세서리.
  peak_heart: {
    name: "운봉의 심장",
    slot: "accessory",
    stats: [
      { label: "힘", value: "+4" },
      { label: "활력", value: "+3" },
    ],
    bonus: { str: 4, vit: 3 },
    description: "운봉의 거인의 가슴에서 떼어낸 작은 심장. 손에 쥐면 어깨가 묵직해진다.",
    rarity: "rare",
  } satisfies EquipItem,

  // 다리 구간 장비 — 운저 평원 / 잿빛 협로. 운봉 라인과 화염 라인 사이의 빈 구간을 메운다.
  bison_hide_armor: {
    name: "들소 가죽 갑옷",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+7" },
      { label: "힘", value: "+2" },
      { label: "속도", value: "-1" },
    ],
    bonus: { def: 7, str: 2, spd: -1 },
    description: "들소 가죽을 여러 겹 다져 만든 묵직한 갑옷. 두르면 어깨가 든든해지는 만큼 발이 조금 무겁다.",
    rarity: "rare",
  } satisfies EquipItem,
  ashforged_blade: {
    name: "재무쇠 검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+8" },
      { label: "힘", value: "+4" },
    ],
    bonus: { atk: 8, str: 4 },
    description: "잿돌을 녹여 단단한 수정과 함께 벼려 낸 검. 베어 낼 때마다 잿가루가 흩날린다.",
    rarity: "rare",
  } satisfies EquipItem,

  // 봉황 망토 — 불꽃 독수리 희귀 드랍. 봉황령 파밍 동기.
  flame_eagle_cape: {
    name: "봉황 망토",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+4" },
      { label: "민첩", value: "+2" },
      { label: "속도", value: "+5" },
    ],
    bonus: { def: 4, dex: 2, spd: 5 },
    description: "불꽃 독수리의 날개깃을 이어 만든 망토. 두르면 발이 불꽃처럼 가벼워진다.",
    rarity: "rare",
  } satisfies EquipItem,

  // 봉황 무구 6종 — 화산의 심장 보스 보상으로 풀리는 최상위 강화 라인.
  // 봉황령에서 모은 봉황 깃털 + 보스가 떨군 용암 핵·화염 비늘로 벼린 고대 유물급 무구.
  // 무기 atk +10 공통(제작 `일반` 등급 기준 — 품질에 따라 ±2) + 보조 스탯이 다름.
  volcano_sword: {
    name: "봉황도",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+10" },
      { label: "힘", value: "+6" },
    ],
    bonus: { atk: 10, str: 6 },
    description: "봉황 깃털을 자루에 감고 용암 핵을 칼날에 녹여 벼린 한손 대검. 휘두를 때마다 붉은 열기가 일렁인다.",
    rarity: "legendary",
  } satisfies EquipItem,
  volcano_shield: {
    name: "봉황패",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+10" },
      { label: "활력", value: "+7" },
    ],
    bonus: { atk: 10, vit: 7 },
    description: "화염 비늘을 겹겹이 두른 방패형 무구. 막아내는 순간 봉황의 열기가 역류한다.",
    rarity: "legendary",
  } satisfies EquipItem,
  volcano_spear: {
    name: "봉황극",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+10" },
      { label: "민첩", value: "+7" },
    ],
    bonus: { atk: 10, dex: 7 },
    description: "봉황 깃털로 균형을 잡고 끝에 용암 핵을 박은 긴 창. 가볍고 정확하며, 창끝에서 불길이 떨린다.",
    rarity: "legendary",
  } satisfies EquipItem,
  volcano_claw: {
    name: "봉황조",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+10" },
      { label: "행운", value: "+7" },
    ],
    bonus: { atk: 10, luk: 7 },
    description: "화산의 심장 파편을 발톱 형태로 깎아 손등에 채운 너클. 한 방 한 방이 불처럼 타오른다.",
    rarity: "legendary",
  } satisfies EquipItem,
  volcano_armor: {
    name: "봉황갑",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+8" },
      { label: "힘", value: "+4" },
      { label: "활력", value: "+4" },
    ],
    bonus: { def: 8, str: 4, vit: 4 },
    description: "화염 비늘과 용암 핵을 단련해 만든 갑주. 봉황의 불길을 두른 듯 몸 전체가 달아오른다.",
    rarity: "legendary",
  } satisfies EquipItem,
  volcano_core: {
    name: "봉황주",
    slot: "accessory",
    stats: [
      { label: "민첩", value: "+5" },
      { label: "속도", value: "+5" },
    ],
    bonus: { dex: 5, spd: 5 },
    description: "화산의 심장에서 뽑아낸 가장 순수한 결정을 봉황 깃털로 감싼 구슬. 지니면 몸이 불꽃처럼 날렵해진다.",
    rarity: "legendary",
  } satisfies EquipItem,
} as const;

export type ItemId = keyof typeof ITEMS;

const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
const NAME_TO_ID: Map<string, ItemId> = new Map(
  ITEM_IDS.map((id) => [ITEMS[id].name, id]),
);

// 장착돼 있던 EquipItem이 어느 ITEMS 엔트리인지 역추적. localStorage 저장 후
// 참조가 끊긴 인스턴스도 이름 매칭으로 식별 — 이름은 고유라고 가정.
export function findItemId(item: EquipItem | null | undefined): ItemId | null {
  if (!item) return null;
  return NAME_TO_ID.get(item.name) ?? null;
}
