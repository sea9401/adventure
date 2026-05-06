import type { CraftableDef, CraftableId } from "../types";

export const CRAFTABLES: Record<CraftableId, CraftableDef> = {
  summon_san_gun: {
    id: "summon_san_gun",
    name: "산군 소환서",
    cost: {
      summon_scroll: 5,
    },
    output: { material: "san_gun_summon", count: 1 },
    flavor: "협동 의식서를 엮어 산군을 부르는 의식서. 협동 보스 소환에 사용.",
  },
  summon_griffon: {
    id: "summon_griffon",
    name: "그리폰 소환서",
    cost: {
      summon_scroll: 10,
    },
    output: { material: "griffon_summon", count: 1 },
    flavor: "오지 상공의 포식자 그리폰을 부르는 의식서. 협동 보스 소환에 사용.",
  },
  summon_kraken: {
    id: "summon_kraken",
    name: "크라켄 소환서",
    cost: {
      summon_scroll: 20,
    },
    output: { material: "kraken_summon", count: 1 },
    flavor: "해적 섬 심해의 거대 두족류를 수면 위로 끌어올리는 의식서. 협동 보스 소환에 사용.",
  },
};
