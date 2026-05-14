export const MATERIALS = {
  branch: {
    id: "branch",
    name: "나뭇가지",
    description: "어디서나 주울 수 있는 평범한 나뭇가지.",
    price: 1,
    inShop: true,
  },
  slime_chunk: {
    id: "slime_chunk",
    name: "슬라임 조각",
    description: "끈적한 점액 덩어리. 묘하게 약효가 있다고 한다.",
    price: 3,
    inShop: false,
  },
  slime_core: {
    id: "slime_core",
    name: "슬라임 핵",
    description: "슬라임 깊숙한 곳에서 드물게 발견되는 단단한 결정.",
    price: 20,
    inShop: false,
  },
  rusty_nail: {
    id: "rusty_nail",
    name: "낡은 못",
    description: "어딘가에 박혀 있던 듯 녹이 슬어 있는 못.",
    price: 2,
    inShop: false,
  },
  wilddog_hide: {
    id: "wilddog_hide",
    name: "들개 가죽",
    description: "거칠지만 단단한 가죽. 손질하면 가벼운 방어구가 된다.",
    price: 4,
    inShop: false,
  },
  wilddog_fang: {
    id: "wilddog_fang",
    name: "들개 송곳니",
    description: "끝이 날카로운 송곳니. 단검 손잡이나 장신구에 박는다.",
    price: 8,
    inShop: false,
  },
  spider_silk: {
    id: "spider_silk",
    name: "거미줄",
    description: "끈끈하고 질긴 실. 천을 짜거나 함정에 쓴다.",
    price: 3,
    inShop: false,
  },
  bat_eye: {
    id: "bat_eye",
    name: "박쥐 눈알",
    description: "어둠 속에서도 빛을 본다는 박쥐의 눈알.",
    price: 5,
    inShop: false,
  },
  hard_crystal: {
    id: "hard_crystal",
    name: "단단한 수정",
    description: "동굴 깊은 곳에서 발견되는 투명한 결정. 깨지기 어렵다.",
    price: 10,
    inShop: false,
  },
  fairy_dust: {
    id: "fairy_dust",
    name: "요정가루",
    description: "호수 님프의 옷자락에서 떨어진 반짝이는 가루.",
    price: 18,
    inShop: false,
  },
  ruin_fragment: {
    id: "ruin_fragment",
    name: "폐허 잔해",
    description: "옛 문명의 돌 조각. 미세한 마력이 남아 있다.",
    price: 12,
    inShop: false,
  },
  soul_crystal: {
    id: "soul_crystal",
    name: "영혼 결정",
    description: "망령에게서 떨어진 푸르스름한 결정. 만지면 서늘하다.",
    price: 25,
    inShop: false,
  },
  mana_crystal: {
    id: "mana_crystal",
    name: "마정석",
    description:
      "깊은 동굴 광맥에서만 캐낼 수 있는 강한 마력을 머금은 결정. 무기에 박아 넣으면 한층 단단해진다.",
    price: 30,
    inShop: false,
  },
  giant_scale: {
    id: "giant_scale",
    name: "거인 비늘",
    description: "운봉의 거인이 떨군 회청색 비늘. 단단하면서도 가볍다.",
    price: 28,
    inShop: false,
  },
  unbong_ore: {
    id: "unbong_ore",
    name: "운봉석",
    description: "협곡 깊숙한 광맥에서만 캐낼 수 있는 반짝이는 광석.",
    price: 32,
    inShop: false,
  },
  sancho_blossom: {
    id: "sancho_blossom",
    name: "산초꽃",
    description: "산기슭에서만 피는 작고 매운 꽃. 약초로 쓴다.",
    price: 14,
    inShop: false,
  },
  tough_hide: {
    id: "tough_hide",
    name: "단단한 가죽",
    description: "산기슭의 짐승에게서 얻는 두텁고 질긴 가죽.",
    price: 15,
    inShop: false,
  },
  wind_mana_stone: {
    id: "wind_mana_stone",
    name: "바람 마석",
    description: "협곡의 정령이 흩뿌리는 푸르스름한 결정. 손에 쥐면 바람을 머금은 듯 가볍다.",
    price: 22,
    inShop: false,
  },
  wolf_king_fang: {
    id: "wolf_king_fang",
    name: "늑대왕의 송곳니",
    description: "무리를 이끄는 늑대만이 갖는 길고 굵은 송곳니. 흔치 않다.",
    price: 40,
    inShop: false,
  },
  // ── 다리 구간 재료 (운저 평원 / 잿빛 협로) ──────────────────────────────
  bison_hide: {
    id: "bison_hide",
    name: "들소 가죽",
    description: "운저 평원 들소의 두툼한 가죽. 무겁지만 손질하면 든든한 갑옷이 된다.",
    price: 16,
    inShop: false,
  },
  hawk_feather: {
    id: "hawk_feather",
    name: "초원 매 깃털",
    description: "초원 매의 길고 가벼운 깃털. 바람을 잘 타 장신구 세공에 쓰인다.",
    price: 12,
    inShop: false,
  },
  ash_stone: {
    id: "ash_stone",
    name: "잿돌",
    description: "잿빛 협로에 굴러다니는 거뭇한 돌. 두드리면 잿가루가 풀풀 인다.",
    price: 18,
    inShop: false,
  },
  // ── 봉황령·화산 지대 재료 ────────────────────────────────────────────────
  phoenix_feather: {
    id: "phoenix_feather",
    name: "봉황 깃털",
    description: "불꽃 독수리의 날개에서 뽑아낸 진홍빛 깃털. 손에 쥐면 은은한 온기가 느껴진다.",
    price: 35,
    inShop: false,
  },
  flame_scale: {
    id: "flame_scale",
    name: "화염 비늘",
    description: "화염 도마뱀의 등에서 벗겨낸 주홍빛 비늘. 열을 머금고 있어 쉬이 식지 않는다.",
    price: 28,
    inShop: false,
  },
  lava_core: {
    id: "lava_core",
    name: "용암 핵",
    description: "용암 속에서 굳어진 짙은 붉은 결정. 뜨거운 기운이 오래도록 빠져나가지 않는다.",
    price: 60,
    inShop: false,
  },
  // ── 해안 지선 재료 (조수 갯벌 / 산호초 섬) ──────────────────────────────
  crab_shell: {
    id: "crab_shell",
    name: "게딱지",
    description: "집게발 게의 두툼한 등딱지. 가볍고 단단해 방패나 갑옷에 덧댄다.",
    price: 12,
    inShop: false,
  },
  coral_spine: {
    id: "coral_spine",
    name: "산호 가시",
    description: "암초에서 부러져 나온 날카로운 산호 조각. 잘 갈면 송곳처럼 박을 수 있다.",
    price: 20,
    inShop: false,
  },
  deep_scale: {
    id: "deep_scale",
    name: "심해 비늘",
    description: "산호초 사이렌의 몸을 덮은 푸른 비늘. 물기를 머금어 차갑고 매끄럽다.",
    price: 24,
    inShop: false,
  },
  // ── 서편 옛길 재료 (서편 옛길 / 옛 변경 성채) ──────────────────────────
  raven_feather: {
    id: "raven_feather",
    name: "까마귀 깃",
    description: "옛길과 폐성벽에 들끓는 까마귀의 검은 깃털. 가볍고 질겨 두건이나 망토 안감에 댄다.",
    price: 3,
    inShop: false,
  },
  scrap_iron: {
    id: "scrap_iron",
    name: "녹슨 쇳조각",
    description: "옛 변경 성채의 자동인형과 무너진 막사에서 거둔 녹슨 철. 다시 벼리면 갑옷·무기가 된다.",
    price: 8,
    inShop: false,
  },
  war_banner_scrap: {
    id: "war_banner_scrap",
    name: "옛 군기 조각",
    description: "한 세대 전 변경 수비대가 들었던 깃발의 누더기. 빛바랜 문장이 희미하게 남아 있다.",
    price: 12,
    inShop: false,
  },
  // ── 별의 첨탑 재료 ───────────────────────────────────────────────────────
  stardust: {
    id: "stardust",
    name: "별먼지",
    description: "별빛이 흩어져 가라앉은 미세한 가루. 모아 두면 손바닥에서 옅게 빛난다.",
    price: 45,
    inShop: false,
  },
  sky_alloy: {
    id: "sky_alloy",
    name: "천공 합금",
    description: "옛 천공인이 별빛 아래에서 단조했다 전해지는 가벼우면서 단단한 금속. 첨탑 안에서만 마주칠 수 있다.",
    price: 80,
    inShop: false,
  },
  // ── 선인의 폐도 재료 ─────────────────────────────────────────────────────
  stellar_essence: {
    id: "stellar_essence",
    name: "별의 정수",
    description: "옛 천공인이 별빛을 한 점에 가둬 둔 정수. 손에 쥐면 별 한 자루의 무게가 그대로 실린다.",
    price: 110,
    inShop: false,
  },
  aether_alloy: {
    id: "aether_alloy",
    name: "에테르 합금",
    description: "선인의 폐도 골렘 안쪽에서만 꺼낼 수 있는, 별빛과 에테르를 함께 두드려 짠 단단하면서 가벼운 합금.",
    price: 180,
    inShop: false,
  },
  // 통화성 재료 — 잉여 장비/재료를 대장간 분해실에서 갈아내면 가루처럼 부서지며 쌓인다.
  // 어디든 통하는 작은 마력의 결정이라, 회복약 라인의 통합 재료로 쓰인다.
  // inShop: false (상점 미취급) — 분해로만 얻고, 회복약 제작으로 소진한다.
  mana_dust: {
    id: "mana_dust",
    name: "마력가루",
    description: "잉여 장비와 재료를 갈아내면 가루처럼 부서지며 모이는, 어디든 통하는 작은 마력의 결정. 약을 졸이는 데 두루 쓰인다.",
    price: 4,
    inShop: false,
  },
} as const;

export type MaterialId = keyof typeof MATERIALS;
export type Material = (typeof MATERIALS)[MaterialId];

export function getMaterialName(id: MaterialId): string {
  return MATERIALS[id].name;
}
