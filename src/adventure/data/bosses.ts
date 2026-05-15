// 보스 식별 헬퍼 — 솔로 보스(region.boss) + 협동 보스(COOP_BOSSES) 의 monsterName 집합.
// 도감 reveal 임계와 도감 완료 카운트가 보스용 낮은 임계(1/5/10)로 분기되는 데 쓰인다.

import { WORLD_MAP } from "./world";
import { COOP_BOSSES } from "@/adventure/coop/data";

export const BOSS_MONSTER_NAMES: ReadonlySet<string> = (() => {
  const s = new Set<string>();
  for (const r of WORLD_MAP.regions) {
    if (r.boss) s.add(r.boss.monsterName);
  }
  for (const b of Object.values(COOP_BOSSES)) {
    if (b) s.add(b.monsterName);
  }
  return s;
})();

export function isBossMonster(name: string): boolean {
  return BOSS_MONSTER_NAMES.has(name);
}
