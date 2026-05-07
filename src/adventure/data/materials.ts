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
} as const;

export type MaterialId = keyof typeof MATERIALS;
export type Material = (typeof MATERIALS)[MaterialId];

export function getMaterialName(id: MaterialId): string {
  return MATERIALS[id].name;
}
