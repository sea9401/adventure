# 스킬 시스템

> 코드: `src/lib/game/data.ts` (SKILLS), `src/lib/game/types.ts` (SkillEffect, SkillTrigger), `src/lib/game/logic.ts` (전투 처리)

## 트리거

| 종류            | 동작                                |
| --------------- | ----------------------------------- |
| `every_n_turns` | N턴마다 발동 (액티브). 슬롯을 소모. |
| `passive`       | 상시 적용. 슬롯 비소모.             |

## 슬롯 규칙

- 매 턴 SPD 기반 `totalSlots` 계산
- 액티브 스킬이 슬롯을 소모 (1 슬롯 = 1 액티브)
- 잔여 슬롯 = 기본 공격 횟수
- **데미지 스킬 (`extra_damage_with_stun`, `magic_damage`, `shield_strike` 등)**: 슬롯 소모 + hit 1회 추가
- **비-데미지 액티브 (독칼·자가힐·도발 등)**: 슬롯 소모, hit 없음
- 패시브: 슬롯 무시

## 스킬 효과 종류

### 직접 데미지 / 공격

| Effect kind                    | 설명                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `extra_damage_with_stun`       | 추가 hit (mult배 데미지). 스턴 / DEF 무시 옵션                                          |
| `magic_damage`                 | 마법 데미지 N회 (`stats.int × intMult`, MDEF 적용 / `ignoreMdef` 가능). hit별 크리 판정 |
| `magic_damage_with_spd_debuff` | 마법 데미지 + 적 SPD 감소. 크리 판정                                                    |
| `shield_strike`                | DEF×defMult 데미지 (방어형). 크리 판정                                                  |
| `bonus_attacks`                | 일반 공격 추가 N회 (`guaranteedCrit`이면 크리 보장)                                     |
| `dot_burst`                    | 누적 독 스택 일괄 폭발 (`int × intMultPerStack × stacks`)                               |
| `enemy_hp_pct_damage`          | 적 현재 HP의 N% 데미지 (cap 옵션, `coopBossExempt` / `bossOnly` 플래그)                 |

### DOT / 디버프

| Effect kind            | 설명                                                 |
| ---------------------- | ---------------------------------------------------- |
| `apply_dot`            | 독 스택 N개 부여 (옵션: linger, ampBoost, stunTurns) |
| `dot_on_hit` (passive) | 매 공격에 독 스택 자동 부여                          |
| `dot_amp` (passive)    | DOT 데미지 +N%                                       |
| `enemy_debuff`         | 적 ATK / DEF 디버프 (turns)                          |

### 자기 강화 / 회복

| Effect kind                   | 설명                                                      |
| ----------------------------- | --------------------------------------------------------- |
| `atk_boost` (passive)         | ATK +N% 상시                                              |
| `self_atk_buff`               | ATK +N% N턴 (selfHpCostPct 옵션)                          |
| `damage_amplify` (passive)    | 가하는 데미지 +N%                                         |
| `damage_reduction` (passive)  | 받는 데미지 −N%                                           |
| `dodge_boost` (passive)       | 회피율 +N (flat)                                          |
| `crit_chance_boost` (passive) | 크리율 +N                                                 |
| `magic_damage_amp` (passive)  | 마법 데미지 +N%                                           |
| `self_heal`                   | 발동 시 maxHP의 N% 회복                                   |
| `heal_per_turn` (passive)     | 매 턴 maxHP의 N% 회복                                     |
| `lifesteal` (passive)         | 가한 데미지의 N%만큼 흡혈 (physical/magic 구분)           |
| `guaranteed_crit`             | 다음 hit 확정 크리 (mult배)                               |
| `revive_once` (passive)       | HP가 triggerPct 이하로 떨어지면 1회 부활 (restorePct까지) |

### 반격 / 반사

| Effect kind                  | 설명                                        |
| ---------------------------- | ------------------------------------------- |
| `reflect_on_hit` (passive)   | 피격 시 DEF×defMult 반사                    |
| `reflect_boost`              | 반사 비율 +N%p N턴 (반격 강화)              |
| `dodge_reaction` (passive)   | 회피 시 카운터 어택 / 다음 hit 멀티         |
| `thorn_aura` (passive)       | 매 턴 DEF×defMult 적에게 자동 데미지 (가시) |
| `follow_up_attack` (passive) | 매 hit에 데미지의 N%만큼 추가 hit           |

### 처형 / 특수

| Effect kind                      | 설명                                                       |
| -------------------------------- | ---------------------------------------------------------- |
| `execute_on_hits` (passive)      | N hit마다 적 maxHP의 M% 데미지 (사형)                      |
| `taunt`                          | 적 강제 추가 공격 N회 (수호기사)                           |
| `turn_start_magic` (passive)     | 매 턴 시작 시 INT×N 자동 마법 공격                         |
| `def_pierce` (passive)           | 적 DEF N% 무시                                             |
| `flat_stat` (passive)            | ATK / DEF / SPD / AGI / INT / HP 고정 보너스               |
| `stat_pct_boost` (passive)       | ATK / DEF / SPD / AGI / INT / HP 비율 보너스               |
| `conditional_modifier` (passive) | 조건(예: HP_below_pct, vs_boss) 만족 시 ATK/DmgAmp 등 부여 |

## 보스 스킬 (BossSkillEffect)

`Boss.skill`에 정의되며 every N turns 발동:

| Kind               | 설명                                       |
| ------------------ | ------------------------------------------ |
| `flat_damage`      | atk × atkMult 고정 데미지                  |
| `next_attack_mult` | 다음 공격 멀티                             |
| `atk_boost`        | 일정 턴 동안 보스 ATK +N%                  |
| `def_boost`        | 일정 턴 동안 보스 DEF +N%                  |
| `dot_pct`          | 플레이어에게 N턴 동안 매 턴 maxHP의 M% DOT |
| `spd_debuff`       | 플레이어 SPD −N (N턴)                      |
| `self_heal`        | 보스 maxHP의 N% 회복                       |

## 학습 시스템

- **1차 스킬** (Lv 1~99): 직업 선택 시 자동 사용 가능
- **2차 스킬** (Lv 100+): `learnCost` 만큼 skillExp 차감 후 학습. `learnedAdvancedSkills` 배열에 보관

## 장착

- 최대 동시 장착 수: `getMaxEquippedSkills(c)` (레벨 / 직업에 따라 결정)
- 장착 순서가 발동 우선순위 (위에서부터 슬롯 소모)
- `equippedSkills` 배열에 ID 순서로 저장
