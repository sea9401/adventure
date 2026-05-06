# 전투 시스템

> 코드: `src/lib/game/logic.ts` (resolveDispatch, resolveBossDispatch, simulateCoopAttack), `src/lib/game/data.ts` (밸런스 상수)

## 공통 흐름

매 턴 다음 순서로 진행:

1. **선공 결정**: 효과 SPD 비교, 동률은 플레이어 우선
2. **스킬 발동**: 쿨다운 만료된 액티브 스킬을 슬롯 만큼 사용 (`skillsToFire`)
3. **공격 페이즈**: 슬롯 기반 기본 공격 + 데미지 스킬 hit
4. **반격/패시브**: 카운터, 반사, DOT 틱 등
5. **HP 처리**: 어느 한 쪽이 0이 되면 즉시 종료

## 행동 슬롯 (SPD → 공격 횟수)

```ts
const computeAttackCount = (spd: number): number => {
  const cap = 4;
  let attacks = 1;
  let pool = spd * SPD_EXTRA_ATTACK_RATE; // 0.05
  while (attacks < cap) {
    if (pool >= 1) {
      attacks++;
      pool -= 1;
    } else {
      if (Math.random() < pool) attacks++;
      break;
    }
  }
  return attacks;
};
```

| SPD  | 평균 공격 횟수 | 비고                          |
| ---- | -------------- | ----------------------------- |
| 0~19 | 1 (확률)       | 0.05 × spd 만큼 추가 1회 시도 |
| 20   | 2 (확정)       | pool ≥ 1                      |
| 40   | 3 (확정)       |                               |
| 60   | 4 (확정, cap)  |                               |
| 80+  | 4 (cap)        | 추가 공격 무효                |

`triggeredTauntExtra` (도발 스킬)는 적의 공격 횟수에 추가됩니다.

## 슬롯 분배

매 턴 SPD로 결정된 `totalSlots` 안에서:

- 발동 가능한 액티브 스킬이 우선 슬롯을 소모 (`skillsToFire`)
- 남은 슬롯 = 기본 공격 (`basicAttackSlots`)
- 데미지 스킬은 자체 hit가 추가 1회 더 발생 (총 공격 횟수 = `basicAttackSlots + damageSkillCount + bonusAttacks`)

비-데미지 스킬(독칼·자가힐 등)은 슬롯만 소모하고 별도 hit 없음.

## 데미지 공식

### 물리 (computePlayerDamage)

```
boostedAtk = ATK × (1 + atkBoostPct)
effectiveDef = enemyDef × (1 − totalPierce)
dmg = max(1, boostedAtk − effectiveDef)
dmg ×= (0.9 + Math.random() × 0.2)   // ±10% 랜덤
if 크리티컬: dmg ×= critMult
if multiplier: dmg ×= multiplier      // 스킬 멀티
if damageAmpPct: dmg ×= (1 + amp)
```

### 적 데미지 (computeEnemyDamage)

```
dmg = max(1, eAtk − pDef)
dmg ×= (0.9 + Math.random() × 0.2)
if damage_reduction passive: dmg ×= (1 − pct)
```

### DEF 무시 (def_pierce)

- 마법사 패시브: 적 DEF 50% 무시
- 추가 무시: 장비 / 스킬 / 어택 옵션 (`opts.defPiercePct`)
- 합산 후 100% 캡

## 회피 / 크리

| 항목               | 공식            | 캡  |
| ------------------ | --------------- | --- |
| 회피율             | `AGI × 0.002`   | 60% |
| 크리율 보정        | `AGI × 0.001`   | 30% |
| 도적 패시브 크리   | 15% (×2 데미지) | —   |
| 어쌔신 패시브 크리 | 50% (×2.5)      | —   |

회피 시 `dodge_reaction` 패시브가 트리거 (카운터 어택 / 다음 hit 멀티 등).

## DOT (도트 데미지)

```
dotDmg = max(1, INT × 0.5 × stacks × (1 + dotAmpPct))
```

- `DOT_BASE_INT_MULT = 0.5`
- `DOT_STACK_CAP = 5` (맹독술사 패시브로 +2)
- 매 턴 자연 감소 1
- DEF/MDEF 무시
- `dot_burst` 스킬은 모든 스택을 한 번에 폭발 (`stats.int × intMultPerStack × stacks`)

## 보스 전투 (resolveBossDispatch)

| 항목                | 값                                  |
| ------------------- | ----------------------------------- |
| `BOSS_DURATION_SEC` | 30 (최대 턴)                        |
| `BOSS_COOLDOWN_MS`  | 60,000 (1분, 테스트값)              |
| `BOSS_REWARD_MULT`  | 5                                   |
| `TEST_REWARD_MULT`  | 50 (테스트용)                       |
| 길드 멀티           | `min(1.5, 1 + reputation × 0.0005)` |

보스는 `boss.skill` 정의에 따라 일정 쿨마다 스킬 발동 (`flat_damage`, `next_attack_mult`, `def_boost` 등).

## 코옵 보스 전투 (simulateCoopAttack)

| 항목                      | 값                            |
| ------------------------- | ----------------------------- |
| `COOP_ATTACK_TURNS`       | 30                            |
| `COOP_ATTACK_COOLDOWN_MS` | 30,000 (30초)                 |
| 옵션                      | `noCounter` (훈련장에서 사용) |

코옵 보스의 HP는 서버에서 관리. 로컬 시뮬레이터는 시작 HP를 받아 진행하다가 0이 되면 조기 종료. 한쪽이 죽으면 즉시 종료(추가 턴 진행 없음).

## 전투 로그 포맷

표시되는 narrative 형식:

| 종류                | 포맷                                              |
| ------------------- | ------------------------------------------------- |
| 공격 헤더           | `🎯 {캐릭터명}의 N회 공격!`                       |
| 기본 hit            | `⚔ {dmg}의 피해를 입혔다!`                        |
| 크리 hit            | `⚔ 치명타! {dmg}의 피해를 입혔다!`                |
| 데미지 스킬 hit     | `⚡ 스킬 발동! {스킬명}! {dmg}의 피해를 입혔다!`  |
| 적 회피             | `🎯 {적이름}이/가 피했다!`                        |
| 적 공격 헤더        | `☠ {적이름}의 N회 공격!`                          |
| 적 hit              | `☠ 공격! {dmg}의 피해를 입혔다!`                  |
| 플레이어 회피       | `☠ {캐릭터명}이/가 피했다!`                       |
| 비-데미지 스킬 발동 | `⚡ {스킬명} 발동` + `↳ {description}` (sub-text) |

이모지는 분류용이며 `BattleLogTurn.tsx`의 `stripLeadEmoji`로 화면 표시 시 제거됩니다.

전투 로그는 좌(나) / 우(적) 컬럼 분할로 행위 주체 구분. 패시브(가시·반사·흡혈·DOT 등)는 별도 라인에 amber/violet 색상으로 표기.

## 테스트 환경 (훈련장)

- 허수아비: 1B HP (실질 무한)
- `noCounter: true` 옵션으로 반격 없음
- DPS 측정 / 빌드 검증용
