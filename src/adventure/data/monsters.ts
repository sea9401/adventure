export type Monster = {
  name: string;
  image?: string;
};

export const MONSTERS: Record<string, Monster> = {
  주정뱅이: {
    name: "주정뱅이",
    image: "/images/monster/hobo.png",
  },
  슬라임: {
    name: "슬라임",
    image: "/images/monster/slime.png",
  },
  들개: {
    name: "들개",
    image: "/images/monster/wilddog.png",
  },
  두더쥐: {
    name: "두더쥐",
    image: "/images/monster/mole.png",
  },
};
