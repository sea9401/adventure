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

// "유실된 명품" — 일부 잡몹이 아주 드물게 떨구는 unique 등급 장비(ITEMS 끝 "유실된 명품" 블록 참고).
// 드랍/원정 결과에 「✨ 굉장한 발견!」 강조 배너를 띄우는 트리거 — 현재 unique == 이 부류라 rarity 만으로 판별한다.
export function isLuckyFind(item: EquipItem | null | undefined): boolean {
  return item?.rarity === "unique";
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
  // "유실된 명품" 1번. 같은 부류 5종은 ITEMS 끝 "유실된 명품" 블록에 모여 있다.
  mole_king_drill: {
    name: "두더지왕의 드릴",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+5" },
      { label: "속도", value: "+2" },
    ],
    bonus: { atk: 5, spd: 2 },
    description: "어느 두더지가 품에 꼭 쥐고 있던 작은 드릴. 회전시키면 묘하게 손맛이 좋다. 정말로 두더지왕이 있었는지는 아무도 모른다.",
    rarity: "unique",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
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
    rarity: "uncommon",
  } satisfies EquipItem,

  // ── 히든 퀘스트 보상 (§11) — 정식 곡선 위 한 칸, 의뢰로만 입수 ─────────────
  // 월광검: 볼드 ↔ 만월 옛 합작 무기를 마저 완성한 것(hidden-blacksmith-duel). 운봉 무기 한 칸 위.
  moonlight_blade: {
    name: "월광검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+9" },
      { label: "힘", value: "+4" },
      { label: "속도", value: "+3" },
    ],
    bonus: { atk: 9, str: 4, spd: 3 },
    description:
      "두 대장장이가 절반씩 벼려 마침내 한 자루로 합친 검. 달빛 같은 푸른 결이 칼날을 따라 흐른다.",
    rarity: "rare",
    tradable: false,
  } satisfies EquipItem,
  // 용암 정수: 화산의 심장이 잠든 자리에 고인 정수를 시온이 다듬은 것(hidden-volcano-relic). 봉황 액세서리 한 칸 위.
  lava_essence: {
    name: "용암 정수",
    slot: "accessory",
    stats: [
      { label: "힘", value: "+6" },
      { label: "활력", value: "+5" },
    ],
    bonus: { str: 6, vit: 5 },
    description:
      "화산의 심장이 잠든 자리에서 흘러나와 굳은 정수. 손에 쥐면 가슴께가 묵직하게 달아오른다.",
    rarity: "rare",
    tradable: false,
  } satisfies EquipItem,

  // ── 유실된 명품 ───────────────────────────────────────────────────────────
  // 일부 잡몹이 아주 드물게(≈0.01~0.02%) 떨구는 unique 등급 장비. 그 구간에서 제작·일반 드랍으로는
  // 못 얻는 한두 티어 위의 "한 자루" — 운빨로 점프하는 손맛 전용이라 곡선 위로 살짝만 비집고 들어간다
  // (보조 스탯 합으로 보면 같은 구간 정식 장비가 대개 더 낫다). 드랍/원정 결과에 강조 배너가 뜨고,
  // 드랍 품질 롤도 그대로 적용된다 — 정교한/빼어난까지 겹치면 더블 잭팟. 1번(두더지왕의 드릴)은 위 참고.
  bat_swarm_charm: {
    name: "박쥐떼의 길잡이",
    slot: "accessory",
    stats: [
      { label: "속도", value: "+4" },
      { label: "민첩", value: "+2" },
    ],
    bonus: { spd: 4, dex: 2 },
    description: "박쥐 한 마리가 발에 꼭 끼우고 다니던 작은 뼈 장신구. 지니면 발밑이 환해지고 발걸음이 가벼워진다. 박쥐떼가 길을 안다는 옛말이 진짜였을지도.",
    rarity: "unique",
  } satisfies EquipItem,
  spider_queen_silk_robe: {
    name: "거미여왕의 비단갑",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+3" },
      { label: "행운", value: "+7" },
    ],
    bonus: { def: 3, luk: 7 },
    description: "거미가 제 몸보다 큰 비단 뭉치를 끌어안고 있었다. 풀어 두르면 결이 비단보다 곱고, 묘하게 운이 따라붙는다. 진짜 여왕이 짠 건지는 아무도 모른다.",
    rarity: "unique",
  } satisfies EquipItem,
  hero_broken_sword: {
    name: "부러진 영웅검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+8" },
      { label: "방어력", value: "-2" },
    ],
    bonus: { atk: 8, def: -2 },
    description: "폐허 한구석에 반쯤 묻혀 있던 검의 윗동강. 폐허 늑대가 자루를 물어뜯고 있었다. 날밑이 떨어져 나가 손이 자꾸 베이지만, 한 번 휘두르면 옛 영웅의 무게가 실린다.",
    rarity: "unique",
  } satisfies EquipItem,
  // 운향 만월의 '부러진 영웅검' 복원 의뢰(storyQuests: hero_sword_restoration) 보상.
  // hero_broken_sword 윗동강 + 운봉석 검신 + 화염 능선 재료 날밑 → 한 자루로 복원. 서사 아이템이라 거래 불가.
  hero_sword: {
    name: "영웅검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+16" },
      { label: "속도", value: "-1" },
    ],
    bonus: { atk: 16, spd: -1 },
    description: "운향 대장장이 만월이 부러진 윗동강에 운봉석 검신을 잇고, 화염 능선의 것으로 새 날밑을 둘러 되살린 검. 옛 영웅이 들었을 때의 무게가 고스란히 돌아왔다 — 묵직하지만, 그 무게가 곧 위력이 된다.",
    rarity: "legendary",
    tradable: false,
  } satisfies EquipItem,
  sky_render_talon: {
    name: "하늘가르개",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+9" },
      { label: "민첩", value: "+5" },
    ],
    bonus: { atk: 9, dex: 5 },
    description: "초원 매가 한쪽 발에 끼우고 다니던 굽은 발톱 모양 쇳조각. 휘두르면 허공이 가늘게 갈라진다. 어느 대장장이가 매에게 빼앗긴 물건이라는 소문이 있다.",
    rarity: "unique",
  } satisfies EquipItem,
  lava_core_maul: {
    name: "굳은 용암핵 망치",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+11" },
      { label: "속도", value: "-2" },
    ],
    bonus: { atk: 11, spd: -2 },
    description: "용암 슬라임이 미처 녹이지 못한 채 품고 있던 거대한 용암 핵에 자루를 단 것. 둔하기 짝이 없지만, 한 번 내리치면 땅이 운다.",
    rarity: "unique",
  } satisfies EquipItem,

  // ── 중간 단계 제작 장비 ───────────────────────────────────────────────────
  // 그동안 퀘스트 deliver/판매 외엔 쓸 데가 없던 재료(영혼 결정·산초꽃·바람 마석·늑대왕의 송곳니·
  // 초원 매 깃털)에 제작 destination 을 붙인 라인. 각자 그 재료가 나오는 구간에서 다음 보스 보상 전까지
  // 한 칸 메우는 정도 — 곡선 위로 살짝 비집고 들어간다. 제작서는 해당 재료를 이미 소비하던 의뢰의
  // 보상으로 풀린다(바람 마석만 돌풍 정령 recipe 드롭).
  soul_blade: {
    name: "혼백검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+5" },
      { label: "활력", value: "+1" },
    ],
    bonus: { atk: 5, vit: 1 },
    description: "떠도는 망령에게서 거둔 영혼 결정을 칼날 안에 박아 벼린 검. 결정에서 새어 나오는 한기가 칼날을 좀처럼 식지 않게 한다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  sancho_vest: {
    name: "산초 누비 조끼",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+3" },
      { label: "활력", value: "+2" },
    ],
    bonus: { def: 3, vit: 2 },
    description: "말린 산초꽃을 천 사이에 누벼 넣은 조끼. 두르면 몸이 은근히 따뜻하고, 베인 자리가 더디 곪는다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  windmana_charm: {
    name: "바람 마석 부적",
    slot: "accessory",
    stats: [
      { label: "속도", value: "+3" },
      { label: "민첩", value: "+1" },
    ],
    bonus: { spd: 3, dex: 1 },
    description: "협곡 정령이 흩뿌린 바람 마석을 가는 끈에 꿰어 만든 부적. 손목에 두르면 발끝이 바람을 머금은 듯 가볍다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  wolfking_fang_dagger: {
    name: "늑대왕 송곳니 단검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+7" },
      { label: "민첩", value: "+3" },
    ],
    bonus: { atk: 7, dex: 3 },
    description: "무리를 이끄는 늑대만이 갖는 길고 굵은 송곳니를 그대로 자루에 박아 만든 단검. 휘두를 때마다 짐승의 무게가 손에 실린다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  hawkfeather_cloak: {
    name: "매깃 망토",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+2" },
      { label: "속도", value: "+4" },
    ],
    bonus: { def: 2, spd: 4 },
    description: "초원 매의 길고 가벼운 깃털을 이어 짠 망토. 바람을 잘 타 두르면 발걸음이 한결 빨라진다.",
    rarity: "uncommon",
  } satisfies EquipItem,

  // ── 기존 장비를 재료(equip)로 한 단계 끌어올린 결과물 ──
  // 베이스가 'equip' 재료로 소비된다 (recipes.ts). 명품(unique) 업그레이드는 결과도 unique·비거래 ("손에 맞춰진 보물").
  reinforced_leather_armor: {
    name: "덧댄 가죽갑옷",
    slot: "armor",
    stats: [{ label: "방어력", value: "+4" }],
    bonus: { def: 4 },
    description: "낡은 가죽갑옷에 들개 가죽을 덧대고 두텁게 누벼 받친 것. 같은 한 벌인데 한층 든든하다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  bandit_chief_dagger: {
    name: "두목의 단검",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+6" },
      { label: "민첩", value: "+3" },
    ],
    bonus: { atk: 6, dex: 3 },
    description: "산적의 단검에 단단한 수정을 박아 날을 다시 세운 것. 두목쯤은 들고 다녔을 법한 무게가 손에 감긴다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  nymph_blessing: {
    name: "호수 님프의 가호",
    slot: "accessory",
    stats: [
      { label: "속도", value: "+4" },
      { label: "민첩", value: "+1" },
    ],
    bonus: { spd: 4, dex: 1 },
    description: "님프의 반지에 요정가루를 입혀 가호를 깊게 한 것. 끼고 있으면 발끝이 호숫물처럼 가볍다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  reforged_golem_hammer: {
    name: "재단조한 골렘 망치",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+8" },
      { label: "힘", value: "+3" },
      { label: "속도", value: "-2" },
    ],
    bonus: { atk: 8, str: 3, spd: -2 },
    description: "골렘의 망치를 마정석으로 다시 벼리고 폐허 잔해로 자루를 보강한 것. 여전히 둔하지만, 한 번 내리치면 무게가 다르다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  wraithking_cloak: {
    name: "망령왕의 망토",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+3" },
      { label: "민첩", value: "+2" },
      { label: "속도", value: "+3" },
    ],
    bonus: { def: 3, dex: 2, spd: 3 },
    description: "망령의 망토에 영혼 결정을 엮어 넣어 한기를 깊게 한 것. 두르면 발소리가 사라지고, 베인 자리가 시리다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  lava_core_greatmaul: {
    name: "용암핵 대망치",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+14" },
      { label: "속도", value: "-2" },
    ],
    bonus: { atk: 14, spd: -2 },
    description: "굳은 용암핵 망치에 용암 핵을 더 녹여 붓고 화염 비늘로 자루를 감싼 것. 더 둔해진 만큼, 한 번 내리치면 땅이 갈라진다.",
    rarity: "unique",
    tradable: false,
  } satisfies EquipItem,
  azure_talon: {
    name: "창천의 발톱",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+11" },
      { label: "민첩", value: "+6" },
    ],
    bonus: { atk: 11, dex: 6 },
    description: "하늘가르개에 초원 매 깃털을 겹겹이 둘러 균형을 잡은 것. 휘두르면 허공이 한 줄 더 깊게 갈라진다.",
    rarity: "unique",
    tradable: false,
  } satisfies EquipItem,
  spider_queen_silk_plate: {
    name: "거미여왕의 비단 정갑",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+4" },
      { label: "행운", value: "+9" },
    ],
    bonus: { def: 4, luk: 9 },
    description: "거미여왕의 비단갑을 거미줄로 더 곱게 짜 올린 정갑. 결이 비단 위의 비단이고, 운이 더 끈질기게 따라붙는다.",
    rarity: "unique",
    tradable: false,
  } satisfies EquipItem,
  bat_swarm_guide: {
    name: "박쥐떼의 인도자",
    slot: "accessory",
    stats: [
      { label: "속도", value: "+6" },
      { label: "민첩", value: "+3" },
    ],
    bonus: { spd: 6, dex: 3 },
    description: "박쥐떼의 길잡이에 박쥐 눈알을 박아 어둠을 더 멀리 읽게 한 것. 지니면 한 발 앞이 늘 환하고, 그만큼 발이 앞선다.",
    rarity: "unique",
    tradable: false,
  } satisfies EquipItem,
  phoenix_flight_cape: {
    name: "봉황 비행깃 망토",
    slot: "armor",
    stats: [
      { label: "방어력", value: "+4" },
      { label: "민첩", value: "+3" },
      { label: "속도", value: "+6" },
    ],
    bonus: { def: 4, dex: 3, spd: 6 },
    description: "봉황 망토에 봉황 깃털을 더 이어 짜 비행깃을 살린 것. 두르면 발이 불꽃처럼 가벼워지고, 방향을 트는 게 한결 빠르다.",
    rarity: "uncommon",
  } satisfies EquipItem,
  mole_king_borer: {
    name: "두더지왕의 굴착드릴",
    slot: "weapon",
    stats: [
      { label: "공격력", value: "+8" },
      { label: "속도", value: "+3" },
    ],
    bonus: { atk: 8, spd: 3 },
    description: "두더지왕의 드릴에 단단한 수정 날과 마정석 동력부를 단 것. 회전이 묵직해지고, 파고드는 손맛이 한 단계 위다.",
    rarity: "unique",
    tradable: false,
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
