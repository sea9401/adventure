import type { Monster } from "../data/monsters";
import { computeHealAmount, type Potion, type PotionId } from "../data/potions";
import {
  CRIT_MULT_BASE,
  ETERNAL_GALE_ABSOLUTE_CAP,
  GALE_CHAIN_MAX_PER_TURN,
  HEAVEN_DECREE_HP_PCT,
  IMPACT_WAVE_INTERVAL,
  LUCKY_STAR_DAMAGE_MULT,
  POWER_ATTACK_TURN_INTERVAL,
  RAMPAGE_START_TURN,
} from "../character/skills";
import {
  AP_BATTLE_START,
  AP_CAP,
  type APSkill,
  type APSkillId,
} from "../character/apSkills";

export type BattleLogEntry = {
  kind: "player_attack" | "enemy_attack" | "info" | "phase_trigger" | "turn_marker";
  text: string;
  /**
   * 이 entry 가 발생한 페이즈. UI 가 좌/우 레인 분할에 사용 — info entry 의 사이드를
   * 결정. attack kind 는 그대로 좌(player)/우(enemy) 라 turn 보조 없이도 동작.
   * resolveBattle 이 advanceTurn 전후의 phase 차이를 보고 사후 태깅한다 (engine
   * 호출부 변경 최소화). 옛 로그 (서버 캐시 / DB) 는 미동봉 — 클라 폴백.
   */
  turn?: "player" | "enemy";
};

export type BattleOutcome = "win" | "lose";

export type BattlePhase = "player" | "enemy" | "ended";

// 진행 카운터 + 턴마다 리셋되는 1회용 게이트들.
export type BattleTurnState = {
  // 완료된 플레이어 턴 수 — 강공격(N턴마다 발동) 트리거에 사용. 진행 중인 턴은 미포함.
  completedPlayerTurns: number;
  // 종료된 적 페이즈 수 — 가드("첫 N턴" 의미) 가 선공자에 무관하게 N번 발동하도록
  // 적 페이즈 시작 직전에 비교하고 페이즈 종료 시 +1.
  enemyPhasesCompleted: number;
  // 그 턴의 첫 공격이 아직 안 나갔는지 — 강공격(첫 공격에만 보너스) 트리거에 사용.
  // 새 턴 시작 시 true, 첫 공격 후 false. 연타(같은 턴 연장)에는 영향 없음.
  firstAttackPending: boolean;
  // 연타가 한 턴에 한 번만 발동하도록 막는 게이트 — 새 턴 시작 시 false 로 리셋.
  doubleStrikeUsedThisTurn: boolean;
  // 광속이 한 턴에 한 번만 발동하도록 막는 게이트 — 새 턴 시작 시 false 로 리셋. 연타와 별개.
  lightspeedUsedThisTurn: boolean;
  // 풍사슬 (5티어) — 이번 턴 풍사슬 체인 발동 횟수. 턴 종료 시 0 으로 리셋. 캡 GALE_CHAIN_MAX_PER_TURN.
  galeChainsThisTurn: number;
  // 연참 (특기) — 이번 턴에 크리티컬이 한 번이라도 났는지. 턴 종료 시 false 로 리셋.
  critThisTurn: boolean;
  // 연참 (특기) — 이번 턴에 연참 추가타가 이미 발동했는지 (턴당 1회). 턴 종료 시 false 로 리셋.
  riposteUsedThisTurn: boolean;
  // 약점 적중 (2티어 특기) — 이번 턴에 약점 적중 추가타가 이미 발동했는지. 턴 종료 시 리셋. 턴당 1회.
  weakpointUsedThisTurn: boolean;
  // 연쇄 운명 (2티어 특기) — 이번 턴에 연쇄 운명 트리거가 이미 발동했는지. 턴 종료 시 리셋. 턴당 1회.
  fatedChainTriggeredThisTurn: boolean;
  // 이번 턴에 발동한 AP 스킬 id — null = 미발동. 턴 종료 시 null 로 리셋. 한 턴 최대 1개 정책.
  apSkillFiredThisTurn: APSkillId | null;
};

// 전투당 1회성 토글 — 한 번 켜지면 그 전투 동안 유지.
export type BattleFlags = {
  // 페이즈 트리거 1회성 가드. 트리거 발동 후 true 로 전환되어 같은 전투에서 중복 발동 방지.
  phaseTriggered: boolean;
  // "격노" 1회성 가드 — 발동 후 true 로 전환되어 같은 전투에서 중복 발동 방지.
  enrageTriggered: boolean;
  // 불굴 1회성 가드. 발동 후 true — 같은 전투에서 두 번째 치명 피해에는 정상 사망.
  enduranceTriggered: boolean;
  // 암살 (특기) — 전투 첫 공격에 1회 발동 후 true. 같은 전투에서 재발동 안 함.
  assassinateUsed: boolean;
  // 이중 행운 — 첫 크리티컬 발동 시 true 로 전환, 전투 종료까지 유지. 회피/크리티컬 보너스 적용 게이트.
  luckyBuffActive: boolean;
  // 연쇄 운명 — 다음 공격 1회 크리 100% 보장 큐. 트리거 발동 후 true, 다음 공격에서 소비되며 false.
  fatedChainCritPending: boolean;
};

// 누적 +/- 보너스/페널티 (수치, 0 기준으로 더해짐).
export type BattleBuffs = {
  // 적 페이즈 트리거로 누적된 DEF 보너스. 기본 0, 트리거 발동 시 enemy.phaseTrigger.defBonus 만큼 증가.
  enemyDefBonus: number;
  // 잡몹 스킬 "격노"로 누적된 적 ATK 보너스. 기본 0, 발동 시 enemy.skill.atkBonus 만큼 증가.
  enemyAtkBonus: number;
  // 막다른 격노 (5티어) — 그 전투 동안 누적된 ATK 보너스. 매 플레이어 턴 종료 시(RAMPAGE_START_TURN 후) +rampagePerTurn.
  rampageAtkBonus: number;
  // 약점 분석 (5티어) — 매 플레이어 턴 종료 시 누적된 적 ATK·DEF 페널티 (각각 clamp to 0).
  enemyAtkPenalty: number;
  enemyDefPenalty: number;
  // 회전 운기 (2티어 특기) — 그 전투 누적 회피/크리 보너스(%). 매 플레이어 턴 시작 시 +cyclingChiPerTurn.
  cyclingChiBonus: number;
  // 연단의 룬 합산 — 포션 회복량 +% (initialBattleState 에서 player.potionHealPct 로 시드).
  potionHealPct: number;
};

// 가변 자원 스택 / 잔량 카운트.
export type BattleStacks = {
  // 출혈 (4티어) — 누적 스택. 매 적 턴 시작 시 스택당 bleedDmgPerStack 만큼 적 HP 감소 (DEF 무시).
  bleedStacks: number;
  // 철벽 (4티어) — 남은 보호막. 받는 피해를 먼저 흡수. 회복 안 됨.
  playerShield: number;
  // 회피 강화로 적립된 보장 회피 잔량 — enemy phase 에서 % 회피 판정 전에 우선 소모.
  evadesRemaining: number;
  // 무피해 난무 (4티어) — 이 전투에서 플레이어가 실제로 받은 누적 HP 피해 (보호막 흡수분 제외). 0 = 무피해.
  damageTakenThisCombat: number;
  // 약점 적중 — DEF 무시 큐 남은 카운트. 트리거 시 weakpointExtraAttacks 만큼 누적, 공격당 1 감산.
  weakpointDefIgnoreLeft: number;
};

export type BattleState = {
  enemy: Monster;
  enemyHp: number;
  playerHp: number;
  playerMaxHp: number;
  log: BattleLogEntry[];
  phase: BattlePhase;
  outcome: BattleOutcome | null;
  playerAttacksLeft: number;
  turn: BattleTurnState;
  flags: BattleFlags;
  buffs: BattleBuffs;
  stacks: BattleStacks;
  // AP 스킬 자원 — 매 플레이어 행동 +1, cap=AP_CAP, 전투 시작 시 AP_BATTLE_START.
  // 스킬 발동 시 cost 만큼 차감. equippedAPSkills 미장착이면 0 으로 두고 무시.
  ap: number;
};

export type PlayerCombat = {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number; // 선공 판정에 사용
  evasionPct: number; // 0~100, 적 공격 회피 확률
  attackCount: number; // 한 턴에 가하는 공격 횟수 (>=1)
  // 매 턴 시작 시 이 확률(0~100)로 추가 공격 1회. SPD 의 기본 환산.
  extraAttackChancePct?: number;
  // 강공격 보너스 — POWER_ATTACK_TURN_INTERVAL 턴마다 첫 공격에 추가 피해. 0/undefined = 스킬 미보유.
  powerAttackBonus?: number;
  // 분쇄 — 강공격 발동 턴, 그 공격에 한해 적 DEF 감산. 0/undefined = 스킬 미보유.
  crushDefReduction?: number;
  // 정확 — 플레이어의 모든 공격이 적 DEF 의 이 비율(0~1)을 무시. 0/undefined = 스킬 미보유.
  armorPierceFraction?: number;
  // 회피 강화 — 전투 시작 시 적립할 보장 회피 횟수. 0/undefined = 스킬 미보유.
  guaranteedEvades?: number;
  // 반격 — 회피 성공 시 즉시 카운터 1회, ATK + bonus 데미지. 0/undefined = 스킬 미보유.
  counterAtkBonus?: number;
  // 연타 — N턴마다 그 턴 마지막 공격 후 추가 1회 공격. undefined = 스킬 미보유.
  extraAttackEveryNTurns?: number;
  // 기습 — 전투 첫 플레이어 턴 추가 공격. 0/undefined = 스킬 미보유.
  vanguardFirstTurnBonus?: number;
  // 크리티컬 — 매 공격마다 발동 확률(0~100). 0/undefined = 스킬 미보유.
  critChancePct?: number;
  // 크리티컬 데미지 배수. undefined = CRIT_MULT_BASE 사용. luk 비례로 호출 측이 계산.
  critMult?: number;
  // 이중 행운 — 첫 크리티컬 발동 시 회피/크리티컬 +bonus% 발동, 전투 종료까지 유지. 0 이면 미보유.
  doubleLuck?: { evade: number; crit: number };
  // 가드 — 첫 N턴 동안 받는 피해 -reduction. 둘 다 0 이면 스킬 미보유.
  guard?: { turns: number; reduction: number };
  // 재생 — interval 턴마다 HP +amount. 둘 다 0 이면 스킬 미보유.
  regen?: { interval: number; amount: number };
  // 자연회복 — 모든 빌드 공통 상시 baseline. interval 턴마다 HP +amount.
  baselineRegen?: { interval: number; amount: number };
  // 처형 — 적 HP 비율이 hpFraction 미만일 때 데미지 ×mult. mult <= 1 또는 hpFraction <= 0 = 미보유.
  executionDamageMult?: number;
  executionHpFraction?: number;
  // 정확 — 적 evasionPct 에 곱할 배수 (0~1). undefined/1 = 미보유 (정상 회피).
  precisionEvasionMult?: number;
  // 불굴 — true 면 전투당 1회 HP 0 데미지를 HP 1 로 막아준다.
  enduranceActive?: boolean;
  // 광속 — 매 턴 마지막 공격 후 추가 1회 공격 확률(%). 0/undefined = 미보유.
  lightspeedExtraAttackPct?: number;
  // ── 특기 (특기 전용 슬롯, 1개만) ──────────────────────────────────────
  // 흡혈 — 크리티컬로 준 피해의 N% 만큼 HP 회복. 0/undefined = 미장착.
  lifestealCritHealPct?: number;
  // 곡예 — 회피(보장/%/행운의 방패) 성공 시 HP +amount. 0/undefined = 미장착.
  evadeHealAmount?: number;
  // 천칭 — (내SPD − 적SPD) 1당 추가 크리티컬 확률(%). 0/undefined = 미장착.
  balanceCritPctPerSpdDiff?: number;
  // 행운의 방패 — 피격을 무효화할 확률(%). 0/undefined = 미장착.
  luckyShieldBlockPct?: number;
  // ── 4티어 ──────────────────────────────────────────────────────────────
  // 출혈 — 적중 시 출혈 1스택, 매 적 턴마다 스택당 이만큼 고정 피해(DEF 무시). 0/undefined = 미보유.
  bleedDmgPerStack?: number;
  // 그림자 분신 — 매 플레이어 턴 종료 시 분신이 ATK 의 N% 로 추가 공격 1회. 0/undefined = 미보유.
  shadowCloneAtkPct?: number;
  // 철벽 — 전투 시작 시 받는 보호막. 0/undefined = 미보유.
  bulwarkShield?: number;
  // 무피해 난무 — 무피해 턴 종료 시 추가 공격 횟수. 0/undefined = 미보유.
  flurryAttacks?: number;
  // 천명 — 매 공격마다 적 현재 HP 의 HEAVEN_DECREE_HP_PCT% 를 추가 고정 피해로 줄 확률(%). 0/undefined = 미보유.
  heavenDecreeChancePct?: number;
  // ── 특기 (Phase 3) ─────────────────────────────────────────────────────
  // 광전사 — 잃은 HP 1%당 ATK +N%. 0/undefined = 미장착.
  berserkAtkPctPerLostHpPct?: number;
  // 암살 — 전투 첫 공격의 데미지 배수 (DEF 무시 동반). >1 일 때만 발동. 0/undefined = 미장착.
  assassinateDmgMult?: number;
  // 질풍검 — 턴 첫 공격에 (공격 횟수 × N) ATK 보너스. 0/undefined = 미장착.
  gustAtkPerAttack?: number;
  // 연참 — 그 턴 크리 발동 시 추가 공격 N회 (턴당 1회). 0/undefined = 미장착.
  riposteExtra?: number;
  // 유격 — 회피 성공 시 다음 플레이어 턴 공격 횟수 +N. 0/undefined = 미장착.
  skirmishNextTurnBonus?: number;
  // 반사 갑주 — 피격 시 받은 HP 피해의 N% 를 적에게 반사. 0/undefined = 미장착.
  thornsPct?: number;
  // ── 2티어 특기 (각 스탯 50 도달) ────────────────────────────────────────
  // 불굴의 일격 — 매 턴 본타에 (전투 누적 피해 × N) 추가. 0/undefined = 미장착.
  enduringStrikeMult?: number;
  // 약점 적중 — 크리티컬 발동 시 즉시 DEF 무시 추가 공격 N회 (턴당 1회). 0/undefined = 미장착.
  weakpointExtraAttacks?: number;
  // 광속 격투 — 매 턴 기본 공격 횟수 +N. derive 단계에서 attackCount 에 합산되므로 엔진은 직접 안 씀
  // (정보 보존용으로만 보관).
  lightHandExtraAttack?: number;
  // 연쇄 운명 — 크리 발동 시 다음 공격 1회 크리 100% 보장 (턴당 1회 트리거). 0/undefined = 미장착.
  fatedChainActive?: boolean;
  // 반사 회피 — 회피 성공 시 받았을 피해의 N 비율을 적에게 반사. 0/undefined = 미장착.
  reflexEvadeMult?: number;
  // 그림자 보법 — 매 적 턴 시작 시 N% 확률로 그 턴 모든 적 공격 무효. 0/undefined = 미장착.
  shadowStepPct?: number;
  // 행운의 흡혈 — 모든 공격 피해의 N% HP 회복 (크리 외도 포함). 0/undefined = 미장착.
  luckyLifestealPct?: number;
  // 무한 가시 — 매 적 공격에 적 ATK 의 N% 반사 (회피/피격 무관). 0/undefined = 미장착.
  infiniteThornsAtkPct?: number;
  // 굳건한 의지 — 받은 피해 평탄 -(N) 감소 (받는 피해 > 0 일 때, 최소 1로 클램프). 0/undefined = 미장착.
  steadfastWillFlat?: number;
  // 회전 운기 — 매 플레이어 턴 시작 시 회피/크리 +N% 누적 (전투 종료까지). 0/undefined = 미장착.
  cyclingChiPerTurn?: number;
  // 연단의 룬 합산 — 포션 회복량 +%. 0/undefined = 미장착.
  potionHealPct?: number;
  // 반격의 룬 합산 — 피격 시 ATK 데미지로 반격 발동 확률 %. 0/undefined = 미장착.
  runeCounterChancePct?: number;
  // 흡혈의 룬 합산 — 명중 시 가한 피해의 % 만큼 HP 회복. 0/undefined = 미장착.
  runeLifestealPct?: number;
  // ── 5티어 (각 스탯 65 도달) — 만렙 확장 패키지 ────────────────────────
  // 막다른 격노 — 전투 RAMPAGE_START_TURN 턴 경과 후, 매 플레이어 턴 종료 시 ATK 영구 +N 누적. 0/undefined = 미보유.
  rampagePerTurn?: number;
  // 약점 분석 — 매 플레이어 턴 종료 시 적 ATK·DEF 각각 -N 누적 (clamp to 0). 0/undefined = 미보유.
  analysisPerTurn?: number;
  // 가시 갑옷 — 피격 시 받은 HP 피해의 N% 를 적에게 반사 (반사 갑주와 별도 누적). 0/undefined = 미보유.
  bramblePct?: number;
  // 풍사슬 — 추가 공격(연타·광속·이전 풍사슬) 발동 후 N% 확률로 1회 더 (한 턴 최대 GALE_CHAIN_MAX_PER_TURN 회). 0/undefined = 미보유.
  galeChainChancePct?: number;
  // 행운의 별 — 모든 공격이 N% 확률로 데미지 ×LUCKY_STAR_DAMAGE_MULT (크리티컬과 별개·중첩). 0/undefined = 미보유.
  luckyStarChancePct?: number;
  // ── 6티어 (각 스탯 85 도달) — 만렙 확장 패키지 ────────────────────────
  // 충돌파 — 매 IMPACT_WAVE_INTERVAL 턴마다 본타가 적 현재 HP 의 N% 추가 고정 피해 (DEF 무시). 0/undefined = 미보유.
  impactWaveHpPct?: number;
  // 그림자 군단 — 매 플레이어 턴 종료 시 분신 추가 횟수 (기존 분신과 누적). 0/undefined = 미보유.
  shadowLegionExtraClones?: number;
  // 흡혈 갑옷 — 피격 시 받은 HP 피해의 N% HP 회복. 0/undefined = 미보유.
  bloodfeastPct?: number;
  // 무한 풍사슬 — 풍사슬 확률에 더할 보너스(%). 5티어 풍사슬 슬롯 같이 장착해야 의미.
  eternalGaleBonusPct?: number;
  // 무한 풍사슬 — true 면 풍사슬 한 턴 캡 해제. 5티어와 동반 장착 시.
  eternalGaleNoCap?: boolean;
  // 만물 행운 — 회피·크리·추가타 모든 확률에 더할 보너스(%). 0/undefined = 미보유.
  universalLuckBonusPct?: number;
  // AP 스킬 — 학습 + 슬롯 장착 된 것만. 슬롯 순서 보존. 빈 배열/undefined = 미장착.
  // 매 플레이어 턴 첫 공격 시 슬롯 순서로 첫 발동 가능(cost<=AP) 한 1개 발동. 한 턴 최대 1개.
  equippedAPSkills?: ReadonlyArray<APSkill>;
};

export type PlayerAction =
  | { kind: "attack" }
  | { kind: "use_potion"; potionId: PotionId; potion: Potion };

// 로그는 전체 보관 — 종료 후 알림에 첨부되는 battleLog 도 같은 배열을 사용한다.
// BattleScene 은 스크롤 컨테이너라 길이가 늘어도 UX 영향 없음.
export function appendLog(
  log: BattleLogEntry[],
  entry: BattleLogEntry,
): BattleLogEntry[] {
  return [...log, entry];
}

// 데미지 최소 비율 — 순수 감산(atk-def)이 0 이하가 되는 "방어력 임계 초과 = 1딜 고정" 절벽을 완화.
// 공격력의 이 비율(올림)만큼은 항상 들어간다. 정상 장비 구간에선 atk-def 가 항상 더 커서 무의미하고,
// def 가 atk 의 ~0.85 배를 넘는 (= 한참 저장비/저레벨) 구간에서만 체감된다.
// 플레이어↔적 양쪽 공격에 모두 적용 — 방어력을 무한 적층해 무피격이 되는 것도 같이 막힌다.
export const DAMAGE_FLOOR_FRACTION = 0.15;

export function damageBetween(atk: number, def: number): number {
  const minByAtk = Math.ceil(Math.max(0, atk) * DAMAGE_FLOOR_FRACTION);
  return Math.max(1, minByAtk, atk - def);
}

// 플레이어 공격이 마주하는 적 DEF — 누적 페이즈 보너스 포함, 보스 취약(armorVulnerable)·
// 정확 스킬(armorPierceFraction) 비례 관통을 차례로 적용. 본타는 여기에 분쇄(고정 감산)/
// 암살(DEF 0)을 추가로 얹으므로 호출 측에서 따로 처리하고, 단순 추가타(분신/난무/반격)는 이 값 그대로.
function playerFacingEnemyDef(state: BattleState, player: PlayerCombat): number {
  // 약점 분석(5티어)의 누적 페널티는 raw def 에 직접 적용 → 음수 클램프.
  const raw = Math.max(
    0,
    state.enemy.def + state.buffs.enemyDefBonus - state.buffs.enemyDefPenalty,
  );
  const afterVuln = Math.round(raw * (1 - (state.enemy.armorVulnerable ?? 0)));
  const frac = player.armorPierceFraction ?? 0;
  return frac > 0 ? Math.round(afterVuln * (1 - frac)) : afterVuln;
}

// 다음 플레이어 턴의 공격 횟수 — 기본 attackCount + extraAttackChancePct 1회 판정.
// 6티어 만물 행운 보너스가 있으면 추가타 확률에 가산.
function rollPlayerAttackCount(player: PlayerCombat): number {
  const base = Math.max(1, player.attackCount);
  const luckBonus = player.universalLuckBonusPct ?? 0;
  const chance = (player.extraAttackChancePct ?? 0) + luckBonus;
  if (chance > 0 && Math.random() * 100 < chance) return base + 1;
  return base;
}

// 페이즈 트리거 — 적 HP 가 phaseTrigger.hpFraction 미만으로 떨어진 순간 1회 발동.
// enemyDefBonus 누적 + 알림 로그. 이미 죽었거나 발동했으면 무시. 호출 측은 enemyHp 가
// 갱신된 state 를 넘겨야 한다.
function applyPhaseTriggerIfAny(state: BattleState): BattleState {
  const trigger = state.enemy.phaseTrigger;
  if (!trigger || state.flags.phaseTriggered) return state;
  if (state.enemyHp <= 0) return state;
  const threshold = state.enemy.hp * trigger.hpFraction;
  if (state.enemyHp >= threshold) return state;
  return {
    ...state,
    flags: { ...state.flags, phaseTriggered: true },
    buffs: {
      ...state.buffs,
      enemyDefBonus: state.buffs.enemyDefBonus + trigger.defBonus,
    },
    log: appendLog(state.log, { kind: "phase_trigger", text: trigger.message }),
  };
}

// 반격 — 회피 직후 카운터 1회. 적이 죽으면 ended 로 종료.
// 크리티컬 / 강공격 등은 적용하지 않음 — 별도 단순 데미지.
function applyCounterIfAny(
  state: BattleState,
  player: PlayerCombat,
): { state: BattleState; ended: boolean } {
  const bonus = player.counterAtkBonus ?? 0;
  if (bonus <= 0) return { state, ended: false };
  const dmg = damageBetween(
    player.atk + bonus,
    playerFacingEnemyDef(state, player),
  );
  const enemyHp = Math.max(0, state.enemyHp - dmg);
  let next: BattleState = {
    ...state,
    enemyHp,
    log: appendLog(state.log, {
      kind: "player_attack",
      text: `[반격] ${state.enemy.name}에게 ${dmg} 피해를 입혔다.`,
    }),
  };
  next = applyPhaseTriggerIfAny(next);
  if (enemyHp <= 0) {
    return {
      state: {
        ...next,
        log: appendLog(next.log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
      },
      ended: true,
    };
  }
  return { state: next, ended: false };
}

// 재생 — 플레이어 턴 종료 후 (completedPlayerTurns 증가 후) 호출.
// completedPlayerTurns 가 interval 의 배수일 때 HP +amount.
function applyRegenIfAny(
  state: BattleState,
  player: PlayerCombat,
  playerName: string,
): BattleState {
  const regen = player.regen;
  if (!regen || regen.interval <= 0 || regen.amount <= 0) return state;
  if (state.turn.completedPlayerTurns === 0) return state;
  if (state.turn.completedPlayerTurns % regen.interval !== 0) return state;
  if (state.playerHp >= state.playerMaxHp) return state;
  const newHp = Math.min(state.playerMaxHp, state.playerHp + regen.amount);
  const actual = newHp - state.playerHp;
  return {
    ...state,
    playerHp: newHp,
    log: appendLog(state.log, {
      kind: "info",
      text: `[재생] ${playerName}의 HP +${actual}`,
    }),
  };
}

// 자연회복 — 모든 빌드 공통. applyRegenIfAny 와 같은 로직, 다른 interval/amount.
function applyBaselineRegenIfAny(
  state: BattleState,
  player: PlayerCombat,
  playerName: string,
): BattleState {
  const r = player.baselineRegen;
  if (!r || r.interval <= 0 || r.amount <= 0) return state;
  if (state.turn.completedPlayerTurns === 0) return state;
  if (state.turn.completedPlayerTurns % r.interval !== 0) return state;
  if (state.playerHp >= state.playerMaxHp) return state;
  const newHp = Math.min(state.playerMaxHp, state.playerHp + r.amount);
  const actual = newHp - state.playerHp;
  return {
    ...state,
    playerHp: newHp,
    log: appendLog(state.log, {
      kind: "info",
      text: `[자연회복] ${playerName}의 HP +${actual}`,
    }),
  };
}

// 부가 공격(분신/난무 등) 1회 — 데미지 적용 + 페이즈 트리거 + 사망 처리. 크리/강공격/브레이스 등 미적용 (반격과 동일하게 단순 데미지).
function dealExtraEnemyDamage(
  state: BattleState,
  dmg: number,
  label: string,
): BattleState {
  const enemyHp = Math.max(0, state.enemyHp - dmg);
  let next = applyPhaseTriggerIfAny({
    ...state,
    enemyHp,
    log: appendLog(state.log, {
      kind: "player_attack",
      text: `[${label}] ${state.enemy.name}에게 ${dmg} 피해를 입혔다.`,
    }),
  });
  if (enemyHp <= 0) {
    next = {
      ...next,
      log: appendLog(next.log, {
        kind: "info",
        text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
      }),
      phase: "ended",
      outcome: "win",
    };
  }
  return next;
}

// 플레이어 턴 종료 후 처리 — 그림자 분신 추가타 → 무피해 난무 추가타들 → 재생.
// 추가타로 적이 죽으면 즉시 종료(이후 단계 건너뜀). 종전 applyRegenIfAny 호출을 이 함수로 대체.
function finishPlayerTurn(
  state: BattleState,
  player: PlayerCombat,
  playerName: string,
): BattleState {
  let st = state;
  // 그림자 분신 — ATK 의 N% 로 1회. 6티어 그림자 군단 보유 시 추가 횟수만큼 더 발동.
  const clonePct = player.shadowCloneAtkPct ?? 0;
  const cloneExtra = player.shadowLegionExtraClones ?? 0;
  const cloneCount = clonePct > 0 ? 1 + cloneExtra : 0;
  if (st.phase !== "ended" && cloneCount > 0) {
    for (let i = 0; i < cloneCount; i += 1) {
      if (st.phase === "ended") break;
      const cloneDmg = damageBetween(
        Math.floor((player.atk * clonePct) / 100),
        playerFacingEnemyDef(st, player),
      );
      st = dealExtraEnemyDamage(
        st,
        cloneDmg,
        cloneExtra > 0 ? "그림자 군단" : "그림자 분신",
      );
    }
  }
  // 무피해 난무 — 이 전투에서 받은 피해가 0이면 추가 공격 N회.
  const flurry = player.flurryAttacks ?? 0;
  if (st.phase !== "ended" && flurry > 0 && st.stacks.damageTakenThisCombat === 0) {
    for (let i = 0; i < flurry; i += 1) {
      if (st.phase === "ended") break;
      const fd = damageBetween(player.atk, playerFacingEnemyDef(st, player));
      st = dealExtraEnemyDamage(st, fd, "무피해 난무");
    }
  }
  if (st.phase === "ended") return st;
  // 막다른 격노 (5티어) — RAMPAGE_START_TURN 턴 후부터 매 플레이어 턴 종료 시 ATK 영구 누적.
  // completedPlayerTurns 는 이 시점에 막 +1 된 상태 (ended state 진입 후) — 1턴 종료 시 1.
  const rampage = player.rampagePerTurn ?? 0;
  if (rampage > 0 && st.turn.completedPlayerTurns >= RAMPAGE_START_TURN) {
    const nextBonus = st.buffs.rampageAtkBonus + rampage;
    st = {
      ...st,
      buffs: { ...st.buffs, rampageAtkBonus: nextBonus },
      log: appendLog(st.log, {
        kind: "info",
        text: `[막다른 격노] ATK +${rampage} (누적 +${nextBonus})`,
      }),
    };
  }
  // 약점 분석 (5티어) — 매 플레이어 턴 종료 시 적 ATK·DEF 누적 페널티 +N.
  const analysis = player.analysisPerTurn ?? 0;
  if (analysis > 0) {
    const nextAtkPen = st.buffs.enemyAtkPenalty + analysis;
    const nextDefPen = st.buffs.enemyDefPenalty + analysis;
    st = {
      ...st,
      buffs: {
        ...st.buffs,
        enemyAtkPenalty: nextAtkPen,
        enemyDefPenalty: nextDefPen,
      },
      log: appendLog(st.log, {
        kind: "info",
        text: `[약점 분석] ${st.enemy.name} ATK·DEF -${analysis} (누적 -${nextAtkPen}/-${nextDefPen})`,
      }),
    };
  }
  st = applyBaselineRegenIfAny(st, player, playerName);
  return applyRegenIfAny(st, player, playerName);
}

// 선공 — SPD가 높은 쪽이 먼저 공격. 동점이면 플레이어 우선.
export function initialBattleState(
  player: PlayerCombat,
  enemy: Monster,
  playerName: string,
): BattleState {
  const playerFirst = player.spd >= enemy.spd;
  const initiator = playerFirst ? playerName : enemy.name;
  const vanguardBonus = player.vanguardFirstTurnBonus ?? 0;
  const log: BattleLogEntry[] = [
    {
      kind: "info",
      text: `${enemy.name}이(가) 나타났다!`,
    },
    {
      kind: "info",
      text: `${initiator}의 선공.`,
    },
  ];
  if (vanguardBonus > 0) {
    log.push({
      kind: "info",
      text: `[기습] 첫 턴 추가 공격 ${vanguardBonus}회!`,
    });
  }
  if (enemy.skill) {
    log.push({
      kind: "info",
      text: `${enemy.name} — 능력 [${enemy.skill.name}]`,
    });
  }
  const startShield = player.bulwarkShield ?? 0;
  if (startShield > 0) {
    log.push({ kind: "info", text: `[철벽] 보호막 ${startShield} 전개` });
  }
  return {
    enemy,
    enemyHp: enemy.hp,
    playerHp: player.hp,
    playerMaxHp: player.maxHp,
    log,
    phase: playerFirst ? "player" : "enemy",
    outcome: null,
    playerAttacksLeft: rollPlayerAttackCount(player) + vanguardBonus,
    turn: {
      completedPlayerTurns: 0,
      enemyPhasesCompleted: 0,
      firstAttackPending: true,
      doubleStrikeUsedThisTurn: false,
      lightspeedUsedThisTurn: false,
      galeChainsThisTurn: 0,
      critThisTurn: false,
      riposteUsedThisTurn: false,
      weakpointUsedThisTurn: false,
      fatedChainTriggeredThisTurn: false,
      apSkillFiredThisTurn: null,
    },
    flags: {
      phaseTriggered: false,
      enrageTriggered: false,
      enduranceTriggered: false,
      assassinateUsed: false,
      luckyBuffActive: false,
      fatedChainCritPending: false,
    },
    buffs: {
      enemyDefBonus: 0,
      enemyAtkBonus: 0,
      rampageAtkBonus: 0,
      enemyAtkPenalty: 0,
      enemyDefPenalty: 0,
      cyclingChiBonus: 0,
      potionHealPct: player.potionHealPct ?? 0,
    },
    stacks: {
      bleedStacks: 0,
      playerShield: startShield,
      evadesRemaining: player.guaranteedEvades ?? 0,
      damageTakenThisCombat: 0,
      weakpointDefIgnoreLeft: 0,
    },
    // 장착된 AP 스킬이 있을 때만 의미. 없으면 그냥 0 으로 두고 회복/소비 노옵.
    ap: (player.equippedAPSkills?.length ?? 0) > 0 ? AP_BATTLE_START : 0,
  };
}

// 한 턴 진행 — 현재 phase 측이 행동하고 결과를 다음 BattleState로 반환.
// player phase는 action(공격 또는 물약)으로 분기. attack이면 attackCount 만큼 연속 공격.
// phase === "ended" 이면 그대로 반환.
export function advanceTurn(
  state: BattleState,
  player: PlayerCombat,
  playerName: string,
  action: PlayerAction = { kind: "attack" },
): BattleState {
  if (state.phase === "ended") return state;

  if (state.phase === "player") {
    if (action.kind === "use_potion") {
      const next = applyPotionEffect(state, action.potion, playerName);
      return {
        ...next,
        phase: "enemy",
        playerAttacksLeft: rollPlayerAttackCount(player),
        turn: { ...next.turn, firstAttackPending: true },
      };
    }

    // 강공격 발동 — POWER_ATTACK_TURN_INTERVAL 턴마다 그 턴의 첫 공격이 ATK + bonus.
    // 진행 중인 턴 번호 = completedPlayerTurns + 1. 첫 공격 여부는 firstAttackPending 으로 판단
    // (확률 기반 추가 공격 / 기습 보너스로 attackCount 비교가 신뢰할 수 없음).
    const turnNumber = state.turn.completedPlayerTurns + 1;
    const isFirstAttackOfTurn = state.turn.firstAttackPending;
    const bonus =
      isFirstAttackOfTurn &&
      turnNumber % POWER_ATTACK_TURN_INTERVAL === 0 &&
      (player.powerAttackBonus ?? 0) > 0
        ? player.powerAttackBonus!
        : 0;

    // AP 스킬 — 그 턴 첫 공격일 때만 슬롯 순서로 cost<=AP 인 첫 1개 발동.
    // 한 턴 1개 정책 (apSkillFiredThisTurn null 체크). 강공격과 동시 발동 가능 (별개 트리거).
    const apSkillFires =
      isFirstAttackOfTurn &&
      state.turn.apSkillFiredThisTurn === null &&
      (player.equippedAPSkills?.length ?? 0) > 0
        ? player.equippedAPSkills!.find((s) => s.apCost <= state.ap) ?? null
        : null;
    const apAtkMult =
      apSkillFires?.effect.kind === "atk_multiplier"
        ? apSkillFires.effect.atkMult
        : 1;
    const apIgnoresDef =
      apSkillFires?.effect.kind === "atk_multiplier" &&
      apSkillFires.effect.ignoresDef === true;

    // 적 회피 — 데미지 굴리기 전에 1차 판정. 회피하면 공격 1회가 그대로 빗나간다.
    // 정확 슬롯 시 적 evasion 에 배수(<1) 가 곱해져 부분 무력화.
    const precisionMult = player.precisionEvasionMult ?? 1;
    const enemyEvasionPct = (state.enemy.evasionPct ?? 0) * precisionMult;
    if (enemyEvasionPct > 0 && Math.random() * 100 < enemyEvasionPct) {
      const log = appendLog(state.log, {
        kind: "player_attack",
        text: `${state.enemy.name}이(가) 공격을 피했다.`,
      });
      // AP 회복 — 공격 시도 자체가 행동이므로 회피되어도 +1 (cap 클램프).
      // AP 스킬은 회피 시 발동/소비 안 함 (apSkillFires 는 첫 공격 명중에만 적용).
      const nextAp = Math.min(AP_CAP, state.ap + 1);
      const attacksLeft = state.playerAttacksLeft - 1;
      if (attacksLeft > 0) {
        return {
          ...state,
          log,
          ap: nextAp,
          playerAttacksLeft: attacksLeft,
          turn: { ...state.turn, firstAttackPending: false },
        };
      }
      const ended: BattleState = {
        ...state,
        log,
        ap: nextAp,
        phase: "enemy",
        playerAttacksLeft: rollPlayerAttackCount(player),
        turn: {
          ...state.turn,
          completedPlayerTurns: state.turn.completedPlayerTurns + 1,
          doubleStrikeUsedThisTurn: false,
          lightspeedUsedThisTurn: false,
          critThisTurn: false,
          riposteUsedThisTurn: false,
          firstAttackPending: true,
          galeChainsThisTurn: 0,
          weakpointUsedThisTurn: false,
          fatedChainTriggeredThisTurn: false,
          apSkillFiredThisTurn: null,
          // fatedChainCritPending 은 "다음 공격" 까지 살아 있어야 하므로 턴 경계에서 리셋 안 함.
        },
      };
      return finishPlayerTurn(ended, player, playerName);
    }

    // 암살 (특기) — 전투 첫 공격이면 발동: 적 DEF 무시 + 데미지 배수 (배수는 아래에서 적용).
    const assassinFires =
      (player.assassinateDmgMult ?? 0) > 1 &&
      !state.flags.assassinateUsed &&
      state.turn.completedPlayerTurns === 0 &&
      isFirstAttackOfTurn;
    // 약점 적중 (2티어 특기) — 큐가 있으면 이 공격은 DEF 무시. 트리거 자체는 아래 크리 처리 후.
    const weakpointDefIgnore = state.stacks.weakpointDefIgnoreLeft > 0;
    // 분쇄 — 강공격 발동 턴, 그 공격에 한해 적 DEF -crushDefReduction. 암살/약점 적중이면 DEF 0.
    // baseDef 는 보스 취약(armorVulnerable) + 정확(armorPierceFraction) 비례 관통이 이미 반영된 값 —
    // 분쇄는 그 위에 추가 고정 감산.
    const crushReduction = player.crushDefReduction ?? 0;
    const baseDef = playerFacingEnemyDef(state, player);
    const targetDef = assassinFires || weakpointDefIgnore || apIgnoresDef
      ? 0
      : bonus > 0 && crushReduction > 0
        ? Math.max(0, baseDef - crushReduction)
        : baseDef;
    // 광전사 (특기) — 잃은 HP 비율만큼 ATK 가산.
    // berserkAtkPctPerLostHpPct=0.5 → 잃은 HP 1%당 ATK +0.5% → 보너스ATK = atk × lostFraction × 0.5.
    const lostHpFraction = Math.max(0, 1 - state.playerHp / state.playerMaxHp);
    const berserkBonus =
      (player.berserkAtkPctPerLostHpPct ?? 0) > 0
        ? Math.floor(
            player.atk * lostHpFraction * player.berserkAtkPctPerLostHpPct!,
          )
        : 0;
    // 질풍검 (특기) — 턴 첫 공격에 (그 턴 공격 횟수 × N) ATK 보너스.
    const gustBonus =
      (player.gustAtkPerAttack ?? 0) > 0 && isFirstAttackOfTurn
        ? state.playerAttacksLeft * player.gustAtkPerAttack!
        : 0;
    // 불굴의 일격 (2티어 특기) — 본타(턴 첫 공격) 에만 (이번 전투 누적 받은 피해 × N) 추가.
    const enduringStrikeBonus =
      (player.enduringStrikeMult ?? 0) > 0 && isFirstAttackOfTurn
        ? Math.floor(state.stacks.damageTakenThisCombat * player.enduringStrikeMult!)
        : 0;
    // 회전 운기 (2티어 특기) — 매 플레이어 턴 시작 시 +cyclingChiPerTurn(%) 누적. 그 턴 즉시 적용.
    const cyclingChiThisTurn =
      state.buffs.cyclingChiBonus +
      (isFirstAttackOfTurn ? player.cyclingChiPerTurn ?? 0 : 0);
    // 크리티컬 — 매 공격마다 critChancePct 확률로 발동. 이중 행운 발동 후엔 +crit 보너스.
    const baseCritPct = player.critChancePct ?? 0;
    const luckCritBonus = state.flags.luckyBuffActive
      ? player.doubleLuck?.crit ?? 0
      : 0;
    // 천칭 — 내 SPD 가 적보다 빠른 만큼 크리티컬 확률 가산.
    const balanceCritBonus =
      (player.balanceCritPctPerSpdDiff ?? 0) > 0
        ? Math.floor(
            Math.max(0, player.spd - state.enemy.spd) *
              player.balanceCritPctPerSpdDiff!,
          )
        : 0;
    // 만물 행운 (6티어) — 크리티컬 확률 +N%.
    const universalLuckBonus = player.universalLuckBonusPct ?? 0;
    const effectiveCritPct =
      baseCritPct + luckCritBonus + balanceCritBonus + universalLuckBonus + cyclingChiThisTurn;
    // 연쇄 운명 (2티어 특기) — 큐가 있으면 이 공격 크리 강제. 큐는 아래에서 소비.
    const fatedChainConsumed = state.flags.fatedChainCritPending;
    const critRoll =
      fatedChainConsumed
        ? true
        : effectiveCritPct > 0
          ? Math.random() * 100 < effectiveCritPct
          : false;
    // AP 스킬의 atk_multiplier 는 모든 ATK 합산 후 곱 (강공격·격노·질풍 등의 보너스 포함).
    const atkBeforeApMult =
      player.atk + state.buffs.rampageAtkBonus + bonus + berserkBonus + gustBonus + enduringStrikeBonus;
    const baseDmg = damageBetween(
      apAtkMult !== 1 ? Math.floor(atkBeforeApMult * apAtkMult) : atkBeforeApMult,
      targetDef,
    );
    // 처형 — 적 HP 비율 < executionHpFraction 일 때 데미지 ×executionDamageMult.
    // 강공격/분쇄 후 데미지에 곱하고, 크리티컬은 그 위에 다시 곱한다 (다단 누적).
    const exMult = player.executionDamageMult ?? 1;
    const exFraction = player.executionHpFraction ?? 0;
    const enemyMaxHp = state.enemy.hp;
    const executionActive =
      exMult > 1 && exFraction > 0 && state.enemyHp / enemyMaxHp < exFraction;
    const dmgAfterExecution = executionActive
      ? Math.max(1, Math.floor(baseDmg * exMult))
      : baseDmg;
    const critMult = player.critMult ?? CRIT_MULT_BASE;
    const dmgAfterCrit = critRoll
      ? Math.floor(dmgAfterExecution * critMult)
      : dmgAfterExecution;
    // 행운의 별 (5티어) — 크리티컬과 별개, 발동 시 데미지 ×LUCKY_STAR_DAMAGE_MULT.
    const luckyStarPct = player.luckyStarChancePct ?? 0;
    const luckyStarFires =
      luckyStarPct > 0 && Math.random() * 100 < luckyStarPct;
    const dmgAfterLuckyStar = luckyStarFires
      ? Math.floor(dmgAfterCrit * LUCKY_STAR_DAMAGE_MULT)
      : dmgAfterCrit;
    // 암살 (특기) — 위 모든 배수(처형/크리/행운의 별) 후에 다시 ×N.
    const dmgBeforeBrace = assassinFires
      ? Math.floor(dmgAfterLuckyStar * player.assassinateDmgMult!)
      : dmgAfterLuckyStar;
    // 잡몹 스킬 "방어 태세" — 이 적을 공격할 때 데미지 -damageReduction (최소 1로 클램프).
    const braceReduction =
      state.enemy.skill?.kind === "brace" ? state.enemy.skill.damageReduction : 0;
    const dmg =
      braceReduction > 0 ? Math.max(1, dmgBeforeBrace - braceReduction) : dmgBeforeBrace;
    // 천명 (4티어) — 일정 확률로 적 현재 HP 의 일부를 추가 고정 피해 (이 공격의 보통 피해와 별개로 합산).
    const decreeFires =
      (player.heavenDecreeChancePct ?? 0) > 0 &&
      Math.random() * 100 < player.heavenDecreeChancePct!;
    const decreeDmg = decreeFires
      ? Math.floor((state.enemyHp * HEAVEN_DECREE_HP_PCT) / 100)
      : 0;
    // 충돌파 (6티어) — 매 IMPACT_WAVE_INTERVAL 턴마다 본타 첫 공격에 적 현재 HP 의 N% 추가 고정 피해.
    const impactPct = player.impactWaveHpPct ?? 0;
    const impactFires =
      impactPct > 0 &&
      isFirstAttackOfTurn &&
      turnNumber % IMPACT_WAVE_INTERVAL === 0;
    const impactDmg = impactFires
      ? Math.floor((state.enemyHp * impactPct) / 100)
      : 0;
    const totalDmg = dmg + decreeDmg + impactDmg;
    const labels: string[] = [];
    if (bonus > 0) labels.push("강공격");
    if (bonus > 0 && crushReduction > 0) labels.push("분쇄");
    if (executionActive) labels.push("처형");
    if (critRoll) labels.push("크리티컬");
    if (luckyStarFires) labels.push("행운의 별");
    if (assassinFires) labels.push("암살");
    if (decreeFires) labels.push("천명");
    if (impactFires) labels.push("충돌파");
    if (enduringStrikeBonus > 0) labels.push("불굴의 일격");
    if (weakpointDefIgnore) labels.push("약점 적중");
    if (fatedChainConsumed) labels.push("연쇄 운명");
    if (apSkillFires) labels.push(apSkillFires.name);
    const prefix = labels.length > 0 ? `[${labels.join(" + ")}] ` : "";
    let log = appendLog(state.log, {
      kind: "player_attack",
      text: `${prefix}${state.enemy.name}에게 ${totalDmg} 피해를 입혔다.`,
    });
    // 이중 행운 — 첫 크리티컬 발동 순간 활성화, 후속 공격/회피 부터 보너스 적용.
    const shouldActivateLucky =
      critRoll &&
      !state.flags.luckyBuffActive &&
      (player.doubleLuck?.crit ?? 0) > 0;
    if (shouldActivateLucky) {
      log = appendLog(log, {
        kind: "info",
        text: `[이중 행운] 회피/크리티컬 +${player.doubleLuck!.crit}% 발동!`,
      });
    }
    const luckyBuffActive = state.flags.luckyBuffActive || shouldActivateLucky;
    // 흡혈 (특기) — 크리티컬로 준 피해의 % 만큼 HP 회복.
    const lifestealHeal =
      critRoll && (player.lifestealCritHealPct ?? 0) > 0
        ? Math.floor((dmg * player.lifestealCritHealPct!) / 100)
        : 0;
    // 행운의 흡혈 (2티어 특기) — 모든 공격 피해의 N% HP 회복 (크리 외도 포함).
    const luckyLifestealHeal =
      (player.luckyLifestealPct ?? 0) > 0
        ? Math.floor((dmg * player.luckyLifestealPct!) / 100)
        : 0;
    // 흡혈의 룬 — 명중 시 가한 피해의 N% HP 회복 (luckyLifesteal 과 같은 trigger, 별도 가산).
    const runeLifestealHeal =
      (player.runeLifestealPct ?? 0) > 0
        ? Math.floor((dmg * player.runeLifestealPct!) / 100)
        : 0;
    const totalLifestealHeal =
      lifestealHeal + luckyLifestealHeal + runeLifestealHeal;
    const newPlayerHp =
      totalLifestealHeal > 0
        ? Math.min(state.playerMaxHp, state.playerHp + totalLifestealHeal)
        : state.playerHp;
    const actualLifesteal = newPlayerHp - state.playerHp;
    if (actualLifesteal > 0) {
      const lifestealLabels: string[] = [];
      if (lifestealHeal > 0) lifestealLabels.push("흡혈");
      if (luckyLifestealHeal > 0) lifestealLabels.push("행운의 흡혈");
      if (runeLifestealHeal > 0) lifestealLabels.push("흡혈의 룬");
      log = appendLog(log, {
        kind: "info",
        text: `[${lifestealLabels.join(" + ")}] ${playerName}의 HP +${actualLifesteal}`,
      });
    }
    const enemyHp = Math.max(0, state.enemyHp - totalDmg);
    // 출혈 (4티어) — 적중하면 출혈 1스택 누적 (다음 적 턴부터 도트).
    const bleedStacks =
      (player.bleedDmgPerStack ?? 0) > 0
        ? state.stacks.bleedStacks + 1
        : state.stacks.bleedStacks;
    // 약점 적중 (2티어 특기) — 크리 발동 시 그 턴 1회, DEF 무시 큐 + 추가타 1회.
    const weakpointFires =
      critRoll &&
      (player.weakpointExtraAttacks ?? 0) > 0 &&
      !state.turn.weakpointUsedThisTurn;
    const weakpointAdd = weakpointFires ? player.weakpointExtraAttacks! : 0;
    if (weakpointFires) {
      log = appendLog(log, {
        kind: "info",
        text: `[약점 적중] 빈틈을 — 한 번 더!`,
      });
    }
    // 연쇄 운명 (2티어 특기) — 크리 발동 시 그 턴 1회, 다음 공격 1회 크리 강제 큐.
    const fatedChainFires =
      critRoll &&
      !!player.fatedChainActive &&
      !state.turn.fatedChainTriggeredThisTurn;
    if (fatedChainFires) {
      log = appendLog(log, {
        kind: "info",
        text: `[연쇄 운명] 별빛이 다음 결을 점지했다 — 다음 공격 크리 보장.`,
      });
    }
    // 약점 큐 카운터: 이 공격에 사용된 경우 -1, 트리거 발화 시 +weakpointAdd.
    const newWeakpointDefIgnoreLeft =
      Math.max(0, state.stacks.weakpointDefIgnoreLeft - (weakpointDefIgnore ? 1 : 0)) +
      weakpointAdd;
    // AP 회복 +1 (행동 1회 = 공격 1회 명중), 발동된 AP 스킬 있으면 cost 차감.
    // 회복이 먼저 — 그 턴 첫 공격이 ult cost 와 정확히 일치할 때도 예상대로 발동.
    const nextApAfter = Math.max(
      0,
      Math.min(AP_CAP, state.ap + 1) - (apSkillFires?.apCost ?? 0),
    );
    // 페이즈 트리거 검사 — 데미지 적용 직후, 사망 분기 전에 처리해야 트리거된 def 가
    // 같은 턴 후속 공격(다중공격/연타)에 즉시 반영된다.
    const afterDamage = applyPhaseTriggerIfAny({
      ...state,
      enemyHp,
      playerHp: newPlayerHp,
      log,
      ap: nextApAfter,
      flags: {
        ...state.flags,
        assassinateUsed: state.flags.assassinateUsed || assassinFires,
        luckyBuffActive,
        fatedChainCritPending: fatedChainFires
          ? true
          : fatedChainConsumed
            ? false
            : state.flags.fatedChainCritPending,
      },
      buffs: {
        ...state.buffs,
        // 2티어 특기 상태 갱신.
        cyclingChiBonus: cyclingChiThisTurn,
      },
      stacks: {
        ...state.stacks,
        bleedStacks,
        weakpointDefIgnoreLeft: newWeakpointDefIgnoreLeft,
      },
      turn: {
        ...state.turn,
        critThisTurn: state.turn.critThisTurn || critRoll,
        fatedChainTriggeredThisTurn:
          state.turn.fatedChainTriggeredThisTurn || fatedChainFires,
        weakpointUsedThisTurn: state.turn.weakpointUsedThisTurn || weakpointFires,
        apSkillFiredThisTurn: apSkillFires
          ? apSkillFires.id
          : state.turn.apSkillFiredThisTurn,
      },
    });
    if (enemyHp <= 0) {
      return {
        ...afterDamage,
        log: appendLog(afterDamage.log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
        turn: {
          ...afterDamage.turn,
          completedPlayerTurns: state.turn.completedPlayerTurns + 1,
        },
      };
    }
    const attacksLeft = state.playerAttacksLeft - 1 + weakpointAdd;
    if (attacksLeft > 0) {
      return {
        ...afterDamage,
        playerAttacksLeft: attacksLeft,
        turn: { ...afterDamage.turn, firstAttackPending: false },
      };
    }
    // 마지막 공격이 끝난 시점 — 연타 발동 가능 여부 검사.
    const interval = player.extraAttackEveryNTurns;
    const canDoubleStrike =
      !!interval &&
      interval > 0 &&
      turnNumber % interval === 0 &&
      !state.turn.doubleStrikeUsedThisTurn;
    if (canDoubleStrike) {
      return {
        ...afterDamage,
        log: appendLog(afterDamage.log, { kind: "info", text: "[연타] 한 번 더!" }),
        phase: "player",
        playerAttacksLeft: 1,
        turn: {
          ...afterDamage.turn,
          doubleStrikeUsedThisTurn: true,
          firstAttackPending: false,
        },
      };
    }
    // 광속 — 마지막 공격 후 일정 확률로 추가 1회. 연타와 별개라 둘 다 슬롯 시
    // 한 턴에 +2 까지 발동 가능 (연타 → 광속 순서 — 연타가 먼저 빠져나간 다음 광속).
    const lightspeedPct = player.lightspeedExtraAttackPct ?? 0;
    const canLightspeed =
      lightspeedPct > 0 &&
      !state.turn.lightspeedUsedThisTurn &&
      Math.random() * 100 < lightspeedPct;
    if (canLightspeed) {
      return {
        ...afterDamage,
        log: appendLog(afterDamage.log, {
          kind: "info",
          text: "[광속] 잔상이 한 번 더 휘둘렀다!",
        }),
        phase: "player",
        playerAttacksLeft: 1,
        turn: {
          ...afterDamage.turn,
          lightspeedUsedThisTurn: true,
          firstAttackPending: false,
        },
      };
    }
    // 풍사슬 (5티어) — 추가 공격(연타·광속·이전 풍사슬) 발동 후 확률로 1회 더. 캡: GALE_CHAIN_MAX_PER_TURN.
    // 6티어 무한 풍사슬: 확률 +eternalGaleBonusPct% + 캡 해제.
    const baseGalePct = player.galeChainChancePct ?? 0;
    const eternalBonusPct = player.eternalGaleBonusPct ?? 0;
    const effectiveGalePct = baseGalePct + eternalBonusPct;
    const galeChainReady =
      state.turn.doubleStrikeUsedThisTurn ||
      state.turn.lightspeedUsedThisTurn ||
      state.turn.galeChainsThisTurn > 0;
    // 무한 풍사슬 시 절대 캡 (ETERNAL_GALE_ABSOLUTE_CAP) 까지만 — 정상 확률엔 도달 불가, cheese 방지용.
    const galeCap = player.eternalGaleNoCap
      ? ETERNAL_GALE_ABSOLUTE_CAP
      : GALE_CHAIN_MAX_PER_TURN;
    const canGaleChain =
      effectiveGalePct > 0 &&
      galeChainReady &&
      state.turn.galeChainsThisTurn < galeCap &&
      Math.random() * 100 < effectiveGalePct;
    if (canGaleChain) {
      return {
        ...afterDamage,
        log: appendLog(afterDamage.log, {
          kind: "info",
          text: "[풍사슬] 바람이 한 번 더 휘몰아친다!",
        }),
        phase: "player",
        playerAttacksLeft: 1,
        turn: {
          ...afterDamage.turn,
          galeChainsThisTurn: state.turn.galeChainsThisTurn + 1,
          firstAttackPending: false,
        },
      };
    }
    // 연참 (특기) — 이번 턴에 크리티컬이 났으면 추가 공격 N회 (턴당 1회).
    const canRiposte =
      (player.riposteExtra ?? 0) > 0 &&
      !state.turn.riposteUsedThisTurn &&
      afterDamage.turn.critThisTurn;
    if (canRiposte) {
      return {
        ...afterDamage,
        log: appendLog(afterDamage.log, {
          kind: "info",
          text: "[연참] 빈틈을 파고든다 — 한 번 더!",
        }),
        phase: "player",
        playerAttacksLeft: player.riposteExtra!,
        turn: {
          ...afterDamage.turn,
          riposteUsedThisTurn: true,
          firstAttackPending: false,
        },
      };
    }
    const ended: BattleState = {
      ...afterDamage,
      phase: "enemy",
      playerAttacksLeft: rollPlayerAttackCount(player),
      turn: {
        ...afterDamage.turn,
        completedPlayerTurns: state.turn.completedPlayerTurns + 1,
        doubleStrikeUsedThisTurn: false,
        lightspeedUsedThisTurn: false,
        critThisTurn: false,
        riposteUsedThisTurn: false,
        firstAttackPending: true,
        galeChainsThisTurn: 0,
        weakpointUsedThisTurn: false,
        fatedChainTriggeredThisTurn: false,
        apSkillFiredThisTurn: null,
      },
    };
    return finishPlayerTurn(ended, player, playerName);
  }

  // ── 출혈 (4티어) — 적 턴 시작 시 출혈 스택당 고정 피해 (DEF 무시) ──────────
  if (state.stacks.bleedStacks > 0 && (player.bleedDmgPerStack ?? 0) > 0) {
    const bleedDmg = state.stacks.bleedStacks * player.bleedDmgPerStack!;
    const afterBleedHp = Math.max(0, state.enemyHp - bleedDmg);
    const bled = applyPhaseTriggerIfAny({
      ...state,
      enemyHp: afterBleedHp,
      log: appendLog(state.log, {
        kind: "info",
        text: `[출혈] ${state.enemy.name}이(가) 출혈로 ${bleedDmg} 피해 (스택 ${state.stacks.bleedStacks})`,
      }),
    });
    if (afterBleedHp <= 0) {
      return {
        ...bled,
        log: appendLog(bled.log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
      };
    }
    state = bled;
  }

  // enemy phase — 그림자 보법 → 보장 회피 → % 회피 → 행운의 방패 → 데미지 (가드 적용) 순.
  // enemy phase 종료 시 enemyPhasesCompleted +1 (가드 카운터 진행).
  // 회피/방패 성공 시 곡예(특기) 장착이면 HP +evadeHealAmount.
  const evadeHeal = player.evadeHealAmount ?? 0;
  const healOnDodge = (hp: number): number =>
    evadeHeal > 0 ? Math.min(state.playerMaxHp, hp + evadeHeal) : hp;

  // 무한 가시 (2티어 특기) — 매 적 공격에 적 ATK 의 N% 반사 (회피/피격 무관).
  // 회피/피격 모든 분기에서 동일 적용 — helper 로 컴팩트하게.
  const infiniteThornsPct = player.infiniteThornsAtkPct ?? 0;
  const infiniteThornsDmg =
    infiniteThornsPct > 0
      ? Math.floor((state.enemy.atk * infiniteThornsPct) / 100)
      : 0;
  // 반사 회피 (2티어 특기) — 회피 성공 시 받았을 피해의 N 비율 반사. baseEnemyDmg 추정.
  const reflexEvadeMult = player.reflexEvadeMult ?? 0;
  const estimatedRawEnemyDmg = (() => {
    if (reflexEvadeMult <= 0) return 0;
    const sk = state.enemy.skill;
    const pierced =
      sk?.kind === "pierce" ? Math.max(0, player.def - sk.armorPierce) : player.def;
    const playerDefVuln = state.enemy.playerDefVulnerable ?? 0;
    const effDef =
      playerDefVuln > 0 ? Math.round(pierced * (1 - playerDefVuln)) : pierced;
    const effAtk = Math.max(
      0,
      state.enemy.atk + state.buffs.enemyAtkBonus - state.buffs.enemyAtkPenalty,
    );
    return damageBetween(effAtk, effDef);
  })();
  const reflexEvadeDmg =
    reflexEvadeMult > 0
      ? Math.floor(estimatedRawEnemyDmg * reflexEvadeMult)
      : 0;
  // 회피/무피격 분기에서 공통으로 적용할 반사 피해(무한 가시 + 반사 회피) — 적 HP 갱신용.
  const applyDodgeReflect = (
    log0: BattleLogEntry[],
    enemyHp0: number,
  ): { log: BattleLogEntry[]; enemyHp: number; killed: boolean } => {
    const totalReflect = infiniteThornsDmg + reflexEvadeDmg;
    if (totalReflect <= 0) return { log: log0, enemyHp: enemyHp0, killed: false };
    let nextLog = log0;
    const labels: string[] = [];
    if (infiniteThornsDmg > 0) labels.push("무한 가시");
    if (reflexEvadeDmg > 0) labels.push("반사 회피");
    const newEnemyHp = Math.max(0, enemyHp0 - totalReflect);
    nextLog = appendLog(nextLog, {
      kind: "player_attack",
      text: `[${labels.join(" + ")}] ${state.enemy.name}에게 ${totalReflect} 반사 피해.`,
    });
    return { log: nextLog, enemyHp: newEnemyHp, killed: newEnemyHp <= 0 };
  };

  // 그림자 보법 (2티어 특기) — 적 턴 시작 시 일정 확률로 그 턴 모든 적 공격 무효.
  const shadowStepPct = player.shadowStepPct ?? 0;
  if (shadowStepPct > 0 && Math.random() * 100 < shadowStepPct) {
    const healedHp = healOnDodge(state.playerHp);
    let log = appendLog(state.log, {
      kind: "info",
      text: `[그림자 보법] ${playerName}이(가) 모든 공격을 그림자처럼 흘려보냈다!`,
    });
    if (healedHp > state.playerHp) {
      log = appendLog(log, {
        kind: "info",
        text: `[곡예] ${playerName}의 HP +${healedHp - state.playerHp}`,
      });
    }
    const reflect = applyDodgeReflect(log, state.enemyHp);
    if (reflect.killed) {
      return {
        ...state,
        playerHp: healedHp,
        enemyHp: 0,
        turn: {
          ...state.turn,
          enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
        },
        log: appendLog(reflect.log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
      };
    }
    let next: BattleState = {
      ...state,
      playerHp: healedHp,
      enemyHp: reflect.enemyHp,
      turn: {
        ...state.turn,
        enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
      },
      playerAttacksLeft:
        state.playerAttacksLeft + (player.skirmishNextTurnBonus ?? 0),
      log: reflect.log,
    };
    const counter = applyCounterIfAny(next, player);
    if (counter.ended) return counter.state;
    next = counter.state;
    return { ...next, phase: "player" };
  }
  if (state.stacks.evadesRemaining > 0) {
    const healedHp = healOnDodge(state.playerHp);
    let log = appendLog(state.log, {
      kind: "info",
      text: `[회피 강화] ${state.enemy.name}의 공격을 회피했다!`,
    });
    if (healedHp > state.playerHp) {
      log = appendLog(log, {
        kind: "info",
        text: `[곡예] ${playerName}의 HP +${healedHp - state.playerHp}`,
      });
    }
    const reflect = applyDodgeReflect(log, state.enemyHp);
    if (reflect.killed) {
      return {
        ...state,
        playerHp: healedHp,
        enemyHp: 0,
        stacks: {
          ...state.stacks,
          evadesRemaining: state.stacks.evadesRemaining - 1,
        },
        turn: {
          ...state.turn,
          enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
        },
        log: appendLog(reflect.log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
      };
    }
    let next: BattleState = {
      ...state,
      playerHp: healedHp,
      enemyHp: reflect.enemyHp,
      stacks: {
        ...state.stacks,
        evadesRemaining: state.stacks.evadesRemaining - 1,
      },
      turn: {
        ...state.turn,
        enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
      },
      // 유격 (특기) — 회피 성공 시 다음 플레이어 턴 공격 횟수 +N (현재 playerAttacksLeft 는 다음 턴 선롤분).
      playerAttacksLeft:
        state.playerAttacksLeft + (player.skirmishNextTurnBonus ?? 0),
      log: reflect.log,
    };
    const counter = applyCounterIfAny(next, player);
    if (counter.ended) return counter.state;
    next = counter.state;
    return { ...next, phase: "player" };
  }
  // 이중 행운 — 활성 시 회피 확률 +bonus%.
  const luckEvadeBonus = state.flags.luckyBuffActive
    ? player.doubleLuck?.evade ?? 0
    : 0;
  // 만물 행운 (6티어) — 회피 확률에도 +N%.
  const universalLuckEvadeBonus = player.universalLuckBonusPct ?? 0;
  // 회전 운기 (2티어 특기) — 누적 보너스 회피에도 적용.
  const effectiveEvadePct =
    player.evasionPct +
    luckEvadeBonus +
    universalLuckEvadeBonus +
    state.buffs.cyclingChiBonus;
  if (Math.random() * 100 < effectiveEvadePct) {
    const healedHp = healOnDodge(state.playerHp);
    let log = appendLog(state.log, {
      kind: "info",
      text: `${playerName}이(가) ${state.enemy.name}의 공격을 회피했다!`,
    });
    if (healedHp > state.playerHp) {
      log = appendLog(log, {
        kind: "info",
        text: `[곡예] ${playerName}의 HP +${healedHp - state.playerHp}`,
      });
    }
    const reflect = applyDodgeReflect(log, state.enemyHp);
    if (reflect.killed) {
      return {
        ...state,
        playerHp: healedHp,
        enemyHp: 0,
        turn: {
          ...state.turn,
          enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
        },
        log: appendLog(reflect.log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
      };
    }
    let next: BattleState = {
      ...state,
      playerHp: healedHp,
      enemyHp: reflect.enemyHp,
      turn: {
        ...state.turn,
        enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
      },
      // 유격 (특기) — 회피 성공 시 다음 플레이어 턴 공격 횟수 +N (현재 playerAttacksLeft 는 다음 턴 선롤분).
      playerAttacksLeft:
        state.playerAttacksLeft + (player.skirmishNextTurnBonus ?? 0),
      log: reflect.log,
    };
    const counter = applyCounterIfAny(next, player);
    if (counter.ended) return counter.state;
    next = counter.state;
    return { ...next, phase: "player" };
  }
  // 행운의 방패 (특기) — 위 회피가 모두 실패해도 일정 확률로 피해 무효 (행운 회피).
  const luckyBlockPct = player.luckyShieldBlockPct ?? 0;
  if (luckyBlockPct > 0 && Math.random() * 100 < luckyBlockPct) {
    const healedHp = healOnDodge(state.playerHp);
    let log = appendLog(state.log, {
      kind: "info",
      text: `[행운의 방패] ${playerName}이(가) ${state.enemy.name}의 공격을 흘려보냈다!`,
    });
    if (healedHp > state.playerHp) {
      log = appendLog(log, {
        kind: "info",
        text: `[곡예] ${playerName}의 HP +${healedHp - state.playerHp}`,
      });
    }
    const reflect = applyDodgeReflect(log, state.enemyHp);
    if (reflect.killed) {
      return {
        ...state,
        playerHp: healedHp,
        enemyHp: 0,
        turn: {
          ...state.turn,
          enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
        },
        log: appendLog(reflect.log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
      };
    }
    let next: BattleState = {
      ...state,
      playerHp: healedHp,
      enemyHp: reflect.enemyHp,
      turn: {
        ...state.turn,
        enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
      },
      // 유격 (특기) — 회피 성공 시 다음 플레이어 턴 공격 횟수 +N (현재 playerAttacksLeft 는 다음 턴 선롤분).
      playerAttacksLeft:
        state.playerAttacksLeft + (player.skirmishNextTurnBonus ?? 0),
      log: reflect.log,
    };
    const counter = applyCounterIfAny(next, player);
    if (counter.ended) return counter.state;
    next = counter.state;
    return { ...next, phase: "player" };
  }

  // ── 잡몹 스킬 (적 공격에 영향) ──────────────────────────────────────────
  const skill = state.enemy.skill;
  // 격노 — 적 HP 가 maxHp×hpFraction 미만으로 떨어지는 순간 1회 발동, ATK +atkBonus (전투 종료까지 유지).
  const enrageReady =
    skill?.kind === "enrage" &&
    !state.flags.enrageTriggered &&
    state.enemyHp > 0 &&
    state.enemyHp < state.enemy.hp * skill.hpFraction;
  const enemyAtkBonus =
    enrageReady && skill?.kind === "enrage"
      ? state.buffs.enemyAtkBonus + skill.atkBonus
      : state.buffs.enemyAtkBonus;
  const enrageTriggered = state.flags.enrageTriggered || enrageReady;
  // 관통 — 잡몹 pierce 스킬의 고정 관통 먼저, 그 위에 보스 playerDefVulnerable 비례 관통.
  const pierced =
    skill?.kind === "pierce" ? Math.max(0, player.def - skill.armorPierce) : player.def;
  const playerDefVuln = state.enemy.playerDefVulnerable ?? 0;
  const effectivePlayerDef =
    playerDefVuln > 0 ? Math.round(pierced * (1 - playerDefVuln)) : pierced;
  // 강타 — everyPhases 번째 적 페이즈마다 데미지 ×multiplier. 이번 페이즈 종료 후
  // enemyPhasesCompleted 가 N 의 배수가 되는지로 판단.
  const heavyBlowMult =
    skill?.kind === "heavy_blow" &&
    skill.everyPhases > 0 &&
    (state.turn.enemyPhasesCompleted + 1) % skill.everyPhases === 0
      ? skill.multiplier
      : 1;
  const heavyBlowFired = heavyBlowMult > 1;
  // 약점 분석(5티어)의 적 ATK 페널티는 raw atk 에 적용 → 0 클램프.
  const effectiveEnemyAtk = Math.max(
    0,
    state.enemy.atk + enemyAtkBonus - state.buffs.enemyAtkPenalty,
  );
  const baseEnemyDmg = damageBetween(effectiveEnemyAtk, effectivePlayerDef);
  const rawDmg = heavyBlowFired
    ? Math.max(1, Math.floor(baseEnemyDmg * heavyBlowMult))
    : baseEnemyDmg;
  // 가드 — 첫 N번의 적 페이즈 동안 받는 피해 -reduction. 선공자에 무관하게
  // enemyPhasesCompleted 가 N 미만이면 이번 페이즈가 그 N 중 하나.
  const guard = player.guard;
  const guarded =
    guard && guard.turns > 0 && state.turn.enemyPhasesCompleted < guard.turns
      ? Math.max(0, rawDmg - guard.reduction)
      : rawDmg;
  // 굳건한 의지 (2티어 특기) — 받은 피해 평탄 -(N) 감소. 가드 뒤에 적용.
  const steadfastFlat = player.steadfastWillFlat ?? 0;
  const dmg = steadfastFlat > 0 ? Math.max(0, guarded - steadfastFlat) : guarded;
  const guardApplied = guarded < rawDmg;
  const steadfastApplied = dmg < guarded;
  // 철벽 (4티어) — 보호막이 데미지를 먼저 흡수, 남은 만큼만 HP 에 적용. 무피해 난무는 dmgToHp 로 누적.
  const shieldAbsorbed = Math.min(state.stacks.playerShield, dmg);
  const dmgToHp = dmg - shieldAbsorbed;
  const newShield = state.stacks.playerShield - shieldAbsorbed;
  // 불굴 — HP 0 이 되는 데미지를 HP 1 로 막는다. 전투당 1회 (enduranceTriggered).
  const wouldKill = state.playerHp - dmgToHp <= 0;
  const enduranceFires =
    wouldKill && !!player.enduranceActive && !state.flags.enduranceTriggered;
  const playerHpAfterDmg = enduranceFires
    ? 1
    : Math.max(0, state.playerHp - dmgToHp);
  // 흡혈 갑옷 (6티어) — 받은 HP 피해의 N% HP 회복. HP 0 으로 죽은 후엔 미발동, 불굴로 버틴 후엔 발동.
  const bloodfeastPct = player.bloodfeastPct ?? 0;
  const bloodfeastHeal =
    bloodfeastPct > 0 && dmgToHp > 0 && playerHpAfterDmg > 0
      ? Math.floor((dmgToHp * bloodfeastPct) / 100)
      : 0;
  const playerHp =
    bloodfeastHeal > 0
      ? Math.min(state.playerMaxHp, playerHpAfterDmg + bloodfeastHeal)
      : playerHpAfterDmg;
  const enduranceTriggered = state.flags.enduranceTriggered || enduranceFires;
  // 로그 — 격노 발동 → 가드 → (강타 라벨 포함) 공격 → 불굴 순.
  let log = state.log;
  if (enrageReady && skill?.kind === "enrage") {
    log = appendLog(log, {
      kind: "info",
      text: `[${skill.name}] ${state.enemy.name}이(가) 격앙되어 공격력이 +${skill.atkBonus}!`,
    });
  }
  if (guardApplied) {
    log = appendLog(log, {
      kind: "info",
      text: `[가드] 피해 -${rawDmg - guarded}`,
    });
  }
  if (steadfastApplied) {
    log = appendLog(log, {
      kind: "info",
      text: `[굳건한 의지] 피해 -${guarded - dmg}`,
    });
  }
  if (shieldAbsorbed > 0) {
    log = appendLog(log, {
      kind: "info",
      text: `[철벽] 보호막이 ${shieldAbsorbed} 흡수 (남은 ${newShield})`,
    });
  }
  const atkPrefix =
    heavyBlowFired && skill?.kind === "heavy_blow" ? `[${skill.name}] ` : "";
  log = appendLog(log, {
    kind: "enemy_attack",
    text: `${atkPrefix}${state.enemy.name}이(가) ${playerName}에게 ${dmgToHp} 피해를 입혔다.`,
  });
  if (enduranceFires) {
    log = appendLog(log, {
      kind: "info",
      text: `[불굴] 마지막 한 숨 — HP 1 로 버텼다!`,
    });
  }
  if (bloodfeastHeal > 0) {
    log = appendLog(log, {
      kind: "info",
      text: `[흡혈 갑옷] ${playerName}의 HP +${bloodfeastHeal}`,
    });
  }
  // 반사 갑주 (특기) + 가시 갑옷 (5티어) — 받은 HP 피해의 N% 를 적에게 반사. 둘 다 있으면 합산.
  // 무한 가시 (2티어 특기) — 피격분과 별개로 적 ATK 의 N% 를 추가 반사 (회피/피격 무관).
  const thornsDmg =
    (player.thornsPct ?? 0) > 0
      ? Math.floor((dmgToHp * player.thornsPct!) / 100)
      : 0;
  const brambleDmg =
    (player.bramblePct ?? 0) > 0
      ? Math.floor((dmgToHp * player.bramblePct!) / 100)
      : 0;
  const reflectDmg = thornsDmg + brambleDmg + infiniteThornsDmg;
  const enemyHpAfterThorns = Math.max(0, state.enemyHp - reflectDmg);
  if (reflectDmg > 0) {
    const reflectLabels: string[] = [];
    if (thornsDmg > 0) reflectLabels.push("반사 갑주");
    if (brambleDmg > 0) reflectLabels.push("가시 갑옷");
    if (infiniteThornsDmg > 0) reflectLabels.push("무한 가시");
    log = appendLog(log, {
      kind: "player_attack",
      text: `[${reflectLabels.join(" + ")}] ${state.enemy.name}에게 ${reflectDmg} 반사 피해.`,
    });
  }
  // 반격의 룬 — 피격 시 일정 확률로 적에게 ATK 데미지로 반격. 살아남았을 때만 발동.
  // 확률은 합산값. 100% 초과는 자연스럽게 항상 발동.
  const runeCounterPct = player.runeCounterChancePct ?? 0;
  let enemyHpAfterRuneCounter = enemyHpAfterThorns;
  if (
    runeCounterPct > 0 &&
    playerHp > 0 &&
    enemyHpAfterThorns > 0 &&
    Math.random() * 100 < runeCounterPct
  ) {
    const counterDmg = damageBetween(
      player.atk,
      playerFacingEnemyDef(state, player),
    );
    enemyHpAfterRuneCounter = Math.max(0, enemyHpAfterThorns - counterDmg);
    log = appendLog(log, {
      kind: "player_attack",
      text: `[반격의 룬] ${state.enemy.name}에게 ${counterDmg} 반격 피해.`,
    });
  }
  if (playerHp <= 0) {
    return {
      ...state,
      playerHp,
      enemyHp: enemyHpAfterRuneCounter,
      flags: {
        ...state.flags,
        enduranceTriggered,
        enrageTriggered,
      },
      buffs: {
        ...state.buffs,
        enemyAtkBonus,
      },
      stacks: {
        ...state.stacks,
        playerShield: newShield,
        damageTakenThisCombat: state.stacks.damageTakenThisCombat + dmgToHp,
      },
      turn: {
        ...state.turn,
        enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
      },
      log: appendLog(log, {
        kind: "info",
        text: `${playerName}이(가) 쓰러졌다...`,
      }),
      phase: "ended",
      outcome: "lose",
    };
  }
  if (enemyHpAfterRuneCounter <= 0) {
    // 반사 / 반격 피해로 적이 쓰러짐 — 플레이어는 생존.
    return {
      ...state,
      playerHp,
      enemyHp: 0,
      flags: {
        ...state.flags,
        enduranceTriggered,
        enrageTriggered,
      },
      buffs: {
        ...state.buffs,
        enemyAtkBonus,
      },
      stacks: {
        ...state.stacks,
        playerShield: newShield,
        damageTakenThisCombat: state.stacks.damageTakenThisCombat + dmgToHp,
      },
      turn: {
        ...state.turn,
        enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
      },
      log: appendLog(log, {
        kind: "info",
        text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
      }),
      phase: "ended",
      outcome: "win",
    };
  }
  return {
    ...state,
    playerHp,
    enemyHp: enemyHpAfterThorns,
    flags: {
      ...state.flags,
      enduranceTriggered,
      enrageTriggered,
    },
    buffs: {
      ...state.buffs,
      enemyAtkBonus,
    },
    stacks: {
      ...state.stacks,
      playerShield: newShield,
      damageTakenThisCombat: state.stacks.damageTakenThisCombat + dmgToHp,
    },
    turn: {
      ...state.turn,
      enemyPhasesCompleted: state.turn.enemyPhasesCompleted + 1,
    },
    log,
    phase: "player",
  };
}

// 한 전투를 시작부터 끝까지 한 번에 시뮬한다. 결과(최종 상태 + 로그 + 턴 수 + 소비된 포션)만
// 반환하므로 실시간 UI/오프라인 시뮬 양쪽에서 동일하게 사용 가능.
//
// `pickAction`은 player phase에서 호출. 포션 사용 결정 시 호출 측에서 보유량 체크 X —
// 함수 내부에서 잔량을 추적하고 부족하면 attack으로 폴백한다.
export type ResolveContext = {
  pickAction: (state: BattleState) => PlayerAction;
  potions: Partial<Record<PotionId, number>>;
  // 보스 전투면 BOSS_TURN_CAP 턴 경과 시 패배로 타임아웃. 일반 전투에는 영향 없음.
  isBoss?: boolean;
};

// 보스 전투 타임아웃 — 플레이어 턴 기준. 정상 빌드는 10~30턴 안에 끝나므로
// 50턴 도달은 데미지 부족 / 무한 회피 스톨로 간주, 패배 처리.
export const BOSS_TURN_CAP = 50;

export type BattleResolution = {
  outcome: BattleOutcome;
  finalState: BattleState;
  potionsConsumed: Partial<Record<PotionId, number>>;
  turns: number;
};

export function resolveBattle(
  player: PlayerCombat,
  enemy: import("../data/monsters").Monster,
  playerName: string,
  ctx: ResolveContext,
): BattleResolution {
  const potions: Partial<Record<PotionId, number>> = { ...ctx.potions };
  const consumed: Partial<Record<PotionId, number>> = {};
  let state = initialBattleState(player, enemy, playerName);
  // 턴 마커 — 그 턴 시작 시점 AP 동봉. 미장착 캐릭터도 그대로 노출 (시스템 발견용).
  const turnMarkerText = (turnNo: number, ap: number): string =>
    `${turnNo}턴 · AP ${ap}`;
  // 초기 entry (적 등장 / 선공 / 능력 안내 등) 는 player 턴으로 태깅. 첫 턴 marker 도 박는다.
  state = {
    ...state,
    log: [
      ...state.log.map((e) => ({ ...e, turn: "player" as const })),
      {
        kind: "turn_marker",
        text: turnMarkerText(1, state.ap),
        turn: "player" as const,
      },
    ],
  };
  let turns = 0;

  while (state.phase !== "ended") {
    let action: PlayerAction = { kind: "attack" };
    if (state.phase === "player") {
      const picked = ctx.pickAction(state);
      if (picked.kind === "use_potion") {
        const have = potions[picked.potionId] ?? 0;
        if (have > 0) {
          potions[picked.potionId] = have - 1;
          consumed[picked.potionId] = (consumed[picked.potionId] ?? 0) + 1;
          action = picked;
        }
      } else {
        action = picked;
      }
    }
    // advanceTurn 호출 직전의 phase 가 이번 step 의 turn — 호출 안에서 phase 가 다음으로
    // 전환되더라도, 그 사이 push 된 entry 들은 모두 이 turn 의 것이다.
    const turnContext: "player" | "enemy" = state.phase;
    const prevLogLen = state.log.length;
    const prevPhase = state.phase;
    state = advanceTurn(state, player, playerName, action);
    // 새로 추가된 entry 에만 turn 을 부여. (이미 turn 이 있는 entry — 만약 직접 박은
    // 곳이 있어도 — 는 보존.)
    if (state.log.length > prevLogLen) {
      const tagged = state.log.map((e, idx) =>
        idx < prevLogLen || e.turn ? e : { ...e, turn: turnContext },
      );
      state = { ...state, log: tagged };
    }
    // enemy → player 전환 시 새 턴 marker 박기 (다음 턴이 시작됨을 시각화).
    // 단, completedPlayerTurns === 0 인 경우는 적 선공의 첫 페이즈 직후이므로
    // 루프 진입 직전에 박아둔 "1턴" 마커와 중복됨 — 건너뛴다.
    if (
      prevPhase === "enemy" &&
      state.phase === "player" &&
      state.turn.completedPlayerTurns > 0
    ) {
      const turnNo = state.turn.completedPlayerTurns + 1;
      state = {
        ...state,
        log: appendLog(state.log, {
          kind: "turn_marker",
          text: turnMarkerText(turnNo, state.ap),
          turn: "player",
        }),
      };
    }
    turns += 1;

    // 보스 타임아웃 — completedPlayerTurns 가 BOSS_TURN_CAP 도달하면 패배로 종료.
    // 일반 전투는 영향 없음 (ctx.isBoss === false).
    if (
      ctx.isBoss &&
      state.phase !== "ended" &&
      state.turn.completedPlayerTurns >= BOSS_TURN_CAP
    ) {
      const timeoutLog = appendLog(state.log, {
        kind: "info",
        text: `${BOSS_TURN_CAP}턴 경과 — 보스를 쓰러뜨리지 못했다.`,
      });
      return {
        outcome: "lose",
        finalState: {
          ...state,
          log: timeoutLog,
          phase: "ended",
          outcome: "lose",
        },
        potionsConsumed: consumed,
        turns,
      };
    }

    // 무한 루프 가드 — 정상 전투는 보통 수십 턴 안에 끝난다. 만약 데미지 0/회피 100% 같은
    // 병리적 조합이면 적의 타임아웃 패배로 강제 종료.
    if (turns > 500) {
      return {
        outcome: "lose",
        finalState: { ...state, phase: "ended", outcome: "lose" },
        potionsConsumed: consumed,
        turns,
      };
    }
  }

  return {
    outcome: state.outcome!,
    finalState: state,
    potionsConsumed: consumed,
    turns,
  };
}

// 물약 효과 적용 — 순수 함수. 인벤토리 차감은 호출 측 책임.
export function applyPotionEffect(
  state: BattleState,
  potion: Potion,
  playerName: string,
): BattleState {
  if (potion.effect.kind === "heal_hp") {
    const baseHeal = computeHealAmount(potion, state.playerMaxHp);
    const heal = Math.floor(baseHeal * (1 + (state.buffs.potionHealPct ?? 0) / 100));
    const newHp = Math.min(state.playerMaxHp, state.playerHp + heal);
    const actual = newHp - state.playerHp;
    return {
      ...state,
      playerHp: newHp,
      log: appendLog(state.log, {
        kind: "info",
        text: `${playerName}이(가) ${potion.name}을(를) 마셨다 — HP +${actual} (${state.playerHp} → ${newHp})`,
      }),
    };
  }
  return state;
}
