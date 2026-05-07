export const MATERIALS = {
  branch: {
    id: "branch",
    name: "나뭇가지",
    description: "어디서나 주울 수 있는 평범한 나뭇가지.",
    price: 1,
  },
  slime_chunk: {
    id: "slime_chunk",
    name: "슬라임 조각",
    description: "끈적한 점액 덩어리. 묘하게 약효가 있다고 한다.",
    price: 3,
  },
} as const;

export type MaterialId = keyof typeof MATERIALS;
export type Material = (typeof MATERIALS)[MaterialId];

export function getMaterialName(id: MaterialId): string {
  return MATERIALS[id].name;
}
