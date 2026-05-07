export type Monster = {
  name: string;
  image?: string;
};

export const MONSTERS: Record<string, Monster> = {
  주정뱅이: {
    name: "주정뱅이",
    image: "/images/monster/hobo.png",
  },
};
