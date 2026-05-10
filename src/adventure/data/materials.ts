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
    // 가격 추후 재설정.
    price: 0,
    inShop: false,
  },
  sancho_blossom: {
    id: "sancho_blossom",
    name: "산초꽃",
    description: "산기슭에서만 피는 작고 매운 꽃. 약초로 쓴다.",
    // 가격 추후 재설정.
    price: 0,
    inShop: false,
  },
  tough_hide: {
    id: "tough_hide",
    name: "단단한 가죽",
    description: "산기슭의 짐승에게서 얻는 두텁고 질긴 가죽.",
    price: 0,
    inShop: false,
  },
} as const;

export type MaterialId = keyof typeof MATERIALS;
export type Material = (typeof MATERIALS)[MaterialId];

export function getMaterialName(id: MaterialId): string {
  return MATERIALS[id].name;
}
