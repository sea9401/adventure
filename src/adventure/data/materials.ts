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
} as const;

export type MaterialId = keyof typeof MATERIALS;
export type Material = (typeof MATERIALS)[MaterialId];

export function getMaterialName(id: MaterialId): string {
  return MATERIALS[id].name;
}
