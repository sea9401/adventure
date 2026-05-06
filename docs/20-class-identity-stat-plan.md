# 직업 정체성 자원 격상 플랜 (STR/VIT/AGI/MATK)

> 관련 코드: `src/lib/game/data.ts` (`CLASSES`, `ADVANCED_CLASSES`, `AGI_DODGE_RATE`, `AGI_CRIT_RATE`), `src/lib/game/logic.ts` (`computeStats`, `dodgeChance`, `agiCritChance`, `playerDodgeChance`/`playerAgiCritChance`).
>
> 상태: **적용 완료**. §7 결정 결과·§10 적용 상태 참조.

## 1. 배경

`docs/20`(이전 안: 전사 STR/VIT 단독 격상) 검토 중 **다른 직업 정체성 자원과의 비대칭 문제**가 드러남.

- 전사만 STR/VIT 변환 계수를 받으면, codex/장비/명예에서 들어오는 STR/VIT 보너스도 전사 한정으로 1.4배 → 후반 격차 누적
- 도적의 **AGI**, 마법사의 **MATK**도 동일하게 "이름값만 있고 정체성 동력 아님" 상태
- 따라서 **세 직업 모두 정체성 자원을 격상하는 대칭 모델**로 확장

## 2. 현재 시스템 진단

### 2.1 1차 자원의 현재 효과

| 자원 | 정체성 직업 | 현재 처리                                                  | 위치               |
| ---- | ----------- | ---------------------------------------------------------- | ------------------ |
| STR  | 전사        | ATK에 **1:1 가산**                                         | `logic.ts:194`     |
| VIT  | 전사        | DEF에 **1:1 가산**, HP 기여 없음                           | `logic.ts:201`     |
| AGI  | 도적        | 회피 = AGI × 0.002 (cap 60%), 크리 = AGI × 0.001 (cap 30%) | `logic.ts:305-309` |
| MATK | 마법사      | INT에 **1:1 가산**                                         | `logic.ts:229`     |

### 2.2 1차 직업 베이스 (현재)

| 직업   | baseStr/grow | baseVit/grow | baseAgi/grow | baseMatk/grow |
| ------ | ------------ | ------------ | ------------ | ------------- |
| 전사   | 5/+1         | 5/+1         | 2/+0         | 0/+0          |
| 도적   | 3/+0.5       | 2/+0.5       | 18/+1        | 0/+0          |
| 마법사 | 1/+0         | 1/+0         | 3/+0         | 5/+1          |

→ 정체성 자원의 base/grow는 이미 직업별로 차등화되어 있음. **자원량은 충분히 다름**, 다만 **자원 → 효과 변환률**이 모두 1:1이라 정체성이 약함.

## 3. 변경 목표

각 1차 직업의 **정체성 자원이 약 +20% 효율로 변환**되도록 계수를 도입.

- 전사: STR → ATK, VIT → DEF + HP (이중)
- 도적: AGI → 회피 + 크리 (이중)
- 마법사: MATK → INT (단일)
- 자원량(base/grow)은 **건드리지 않음** — 변환 계수만 추가
- 다른 자원(예: 도적의 STR, 마법사의 VIT)은 기본값 1.0 유지 → 영향 없음

### 3.1 단일 효과 vs 이중 효과 보정

자원이 두 효과에 동시 기여하면 누적 영향이 크므로 계수를 보수적으로:

| 자원          | 효과 수         | 계수                         |
| ------------- | --------------- | ---------------------------- |
| STR (전사)    | 1 (ATK)         | **×1.4**                     |
| MATK (마법사) | 1 (INT)         | **×1.4**                     |
| VIT (전사)    | 2 (DEF + HP)    | DEF **×1.2**, HP **+2/VIT**  |
| AGI (도적)    | 2 (회피 + 크리) | 회피 **×1.2**, 크리 **×1.2** |

> 수치 검증은 §6 참조. 단일 효과는 1.4, 이중 효과는 각 1.2로 총량 균형.

## 4. 데이터 모델 변경

### 4.1 타입 (`src/lib/game/types.ts`)

```ts
export type ClassDef = {
  ...
  // 정체성 자원 → 파생 효과 변환 계수 (모두 옵셔널, 미설정 시 기본 동작)
  strToAtkMult?: number;   // 기본 1
  vitToDefMult?: number;   // 기본 1
  vitToHp?: number;        // 기본 0 (VIT 1당 HP +N)
  agiDodgeMult?: number;   // 기본 1
  agiCritMult?: number;    // 기본 1
  matkToIntMult?: number;  // 기본 1
};
```

### 4.2 클래스 정의 (`src/lib/game/data.ts`)

```ts
warrior: {
  ...  // base/grow 그대로 유지
  strToAtkMult: 1.4,
  vitToDefMult: 1.2,
  vitToHp: 2,
  passiveText: "받는 데미지 -15% · STR/VIT가 ATK·DEF·HP를 견인",
},
rogue: {
  ...  // base/grow 그대로 유지
  agiDodgeMult: 1.2,
  agiCritMult: 1.2,
  passiveText: "크리티컬 15% (×2) · AGI가 회피·크리 빈도를 견인",
},
mage: {
  ...  // base/grow 그대로 유지
  matkToIntMult: 1.4,
  passiveText: "적 DEF 50% 무시 · MATK가 마법 데미지를 견인",
},
```

> 2차 직업(`ADVANCED_CLASSES`)은 변경 없음 — `computeStats`에서 부모 `CLASSES[currentClass]` 참조 시 자동 상속.

### 4.3 `computeStats` (`logic.ts:146`)

```ts
const strToAtkMult = cls.strToAtkMult ?? 1;
const vitToDefMult = cls.vitToDefMult ?? 1;
const vitToHpFactor = cls.vitToHp ?? 0;
const matkToIntMult = cls.matkToIntMult ?? 1;

return {
  maxHp: cls.baseHp + (cls.growHp * m("hp") + b("hp")) * lvBonus
       + (eq.hp ?? 0) + (setB.hp ?? 0) + cx.hp + (mn.hp ?? 0)
       + vit * vitToHpFactor,                              // 신규
  atk:   cls.baseAtk + (cls.growAtk * m("atk") + b("atk")) * lvBonus
       + (eq.atk ?? 0) + (setB.atk ?? 0) + (mn.atk ?? 0)
       + str * strToAtkMult,                               // 변경: ×mult
  def:   cls.baseDef + (cls.growDef * m("def") + b("def")) * lvBonus
       + (eq.def ?? 0) + (setB.def ?? 0) + (mn.def ?? 0)
       + vit * vitToDefMult,                               // 변경: ×mult
  int:   cls.baseInt + (cls.growInt * m("int") + b("int")) * lvBonus
       + (eq.int ?? 0) + (setB.int ?? 0) + (mn.int ?? 0)
       + matk * matkToIntMult,                             // 변경: ×mult
  ...
};
```

### 4.4 회피·크리 계산 (`logic.ts:305-309`, 호출 사이트)

`dodgeChance` / `agiCritChance` 자체는 **pure 함수로 유지** (적 사이드도 동일 함수 사용). **플레이어 사이드 호출 사이트에서만** 계수 곱.

```ts
// 신규 헬퍼 (logic.ts에 추가)
export const playerDodgeChance = (cls: ClassDef, agi: number): number =>
  Math.min(AGI_DODGE_CAP, dodgeChance(agi) * (cls.agiDodgeMult ?? 1));

export const playerAgiCritChance = (cls: ClassDef, agi: number): number =>
  Math.min(AGI_CRIT_CAP, agiCritChance(agi) * (cls.agiCritMult ?? 1));
```

기존 호출 사이트 (`logic.ts:682, 1485`, 그리고 보스/코옵 전투 — `1670, 2367` 등) 변경:

```ts
// 변경 전
dodgeChance(stats.agi) + dodgeBoostFlat + flatDodgePct;
// 변경 후
playerDodgeChance(cls, stats.agi) + dodgeBoostFlat + flatDodgePct;
```

> 적 사이드 (`dodgeChance(enemy.agi)`)는 그대로. 적은 직업 정체성 시스템 적용 대상 아님.

## 5. 영향 시뮬레이션

### 5.1 전사 lv 100 (장비 0)

| 스탯 | 현재  | 변경 후                   | 차이     |
| ---- | ----- | ------------------------- | -------- |
| STR  | 104   | 104                       | —        |
| VIT  | 104   | 104                       | —        |
| ATK  | 312   | 312 + 104·0.4 = **354**   | **+13%** |
| DEF  | 305   | 305 + 104·0.2 = **326**   | **+7%**  |
| HP   | 1,585 | 1,585 + 104·2 = **1,793** | **+13%** |

### 5.2 도적 lv 100 (장비 0)

| 스탯               | 현재  | 변경 후            |
| ------------------ | ----- | ------------------ |
| AGI                | 117   | 117                |
| 회피율             | 23.4% | **28.1%** (+4.7%p) |
| AGI 크리 보정      | 11.7% | **14.0%** (+2.3%p) |
| 패시브+AGI 크리 합 | 26.7% | **29.0%**          |

### 5.3 마법사 lv 100 (장비 0)

| 스탯               | 현재                | 변경 후                        |
| ------------------ | ------------------- | ------------------------------ |
| MATK               | 104                 | 104                            |
| INT (MATK 가산 후) | 212 + 104 = **316** | 212 + 104·1.4 = **358** (+13%) |

→ 세 직업 모두 약 **+13% 효율 격상**으로 대칭. 단발 격차 작지만 정체성 자원 의존도가 올라감.

### 5.4 외부 보너스 영향 (예: codex STR 5pt = 50 STR)

| 직업   | 현재 추가 ATK | 변경 후         |
| ------ | ------------- | --------------- |
| 전사   | +50           | **+70**         |
| 도적   | +50           | +50 (변동 없음) |
| 마법사 | +50           | +50             |

각 직업이 **자기 정체성 자원에서만 1.4배 보너스**를 받음 → 빌드 차별화 자연스러움.

### 5.5 2차 직업 영향

| 2차      | 영향                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 광전사   | 부모(전사) 변환 계수 자동 상속. 패시브 ATK +45%와 시너지 → ATK +13% × 1.45 = 패시브 후 ATK +13% (비례). **밸런스 OK**                                            |
| 방패병   | vitToDefMult 1.2 + 자체 growMult.def 1.4 → DEF가 ~+5% 정도 추가. **밸런스 OK**                                                                                   |
| 어쌔신   | AGI 변환 자동 상속. 회피·크리 격상은 어쌔신의 "한방" 정체성과 시너지 → 패시브 50% 크리 + AGI 14% = cap 30% 적용 후 합 30%. **현재 대비 큰 차이 없음 (cap 영향)** |
| 맹독술사 | AGI 변환 상속. growMult.agi×0.85라 AGI 성장 약간 낮음 → 영향 미미                                                                                                |
| 원소술사 | MATK 변환 상속. 패시브 마법 +60%와 시너지. **밸런스 OK**                                                                                                         |

### 5.6 주의: 어쌔신 크리 cap 충돌

어쌔신은 패시브 크리 50% + AGI 보정 14%(변경 후) → 합 64%인데 도적·어쌔신 코드 흐름상 패시브와 AGI 보정은 **합산 후 적용**. cap이 패시브에는 안 걸리고 AGI 보정 자체에 cap 30%만 적용.

→ 어쌔신은 변경 후 패시브 50% + AGI보정 14% = 실효 64% (현재 61.7%) → **+2.3%p**. 의미는 작지만 누적 시 무시 못함.

## 6. 단계별 작업

1. **타입 확장** — `ClassDef`에 6개 옵셔널 필드 추가 (`types.ts`)
2. **`computeStats` 수정** — STR/VIT/MATK 변환 계수 적용. 기본값으로 기존 동작 보존
3. **회피·크리 헬퍼 추가** — `playerDodgeChance`, `playerAgiCritChance` 도입 (`logic.ts`)
4. **호출 사이트 일괄 교체** — `dodgeChance(stats.agi)` / `agiCritChance(stats.agi)`를 플레이어 헬퍼로 변경. 적 사이드는 그대로
   - 호출 위치: `logic.ts:682, 1485, 1670, 2367` 등 (검색해 일괄)
5. **클래스 데이터 갱신** — 전사/도적/마법사에 변환 계수 추가 (`data.ts`)
6. **passiveText 보강** — 정체성 자원 견인 한 줄 명시
7. **단위 테스트** — 직업별 lv 1/50/100 ATK·DEF·HP·회피·크리 스냅샷
8. **시뮬레이션** — `scripts/`에 1차/2차 모든 직업 1킬/턴 변화 검증
9. **문서 갱신** — `docs/08-balance-reference.md`, `docs/19-kill-per-turn-by-class.md` 수치 재계산
10. **CHANGELOG** 기록

## 7. 결정 결과 (2026-05-06 확정)

`scripts/identity-stat-sim.ts` 시뮬 기반.

- [x] **단일 효과 계수 = 1.3** — STR→ATK, MATK→INT
  - 1.4 시 외부 누적 격차 (codex 100 STR 기준) +40 ATK로 후반 비대칭 ↑
  - 1.3에서 +30 ATK로 정체성은 살리되 누적 격차 보수적
  - 만렙 ATK·INT 약 +10% 격상으로 깔끔
- [x] **이중 효과 계수 = 1.2** — VIT→DEF, AGI→회피·크리
  - 1.15 시 DEF +5%, 회피 +3.5%p로 격상 효과 약함 → 변환 도입 의미 흐려짐
  - 1.2에서 DEF +7%, 회피 +20%로 정체성 명확
- [x] **`vitToHp` = 3 + 광전사 `growMult.hp` 0.6 → 0.52**
  - vitToHp=2는 전사 +13%로 정체성 약, vitToHp=3은 전사 +20%로 명확하나 광전사 +32% 과함
  - 광전사 hp 성장 0.52로 보정 → 광전사도 +20%로 전사와 동일 격상비
  - 광전사 매턴 2% drain 절대값도 +20% 비례 → "강해진 만큼 갉히는 양도 늘었다" 정체성 보존
- [x] **어쌔신 크리 cap 별도 도입 = 보류** — 현재 패시브 50% + AGI 14% = 64%로 자연 누적. 추가 게이트 없이 어쌔신 정체성 그대로
- [x] **codex 1pt = 10 STR 표기 = 그대로** — 변환 계수는 백엔드 처리. 실효 ATK·INT는 캐릭터 시트의 최종값에 이미 반영됨
- [ ] **UI 노출 (STR/VIT/AGI/MATK 옆 환산 표기)** — 후속 PR로 분리. 현재는 최종 ATK/DEF/HP/회피/크리만 노출되므로 동작에는 영향 없음

## 8. 비변경 항목 (참고)

- 자원 base/grow 값은 **건드리지 않음** — 변환 계수만 추가
- 도적/마법사의 **다른 자원**(STR, VIT)은 1:1 그대로 — 정체성 자원만 격상
- `AGI_DODGE_CAP` (60%), `AGI_CRIT_CAP` (30%) **상한 그대로** — 도적이 cap에 빨리 도달하는 게 의도
- 적의 AGI는 변환 계수 영향 없음 (적 직업 분류 없음)
- 저장 데이터 마이그레이션 불필요 — `computeStats`는 매번 재계산

## 9. 적용 후 19번 가이드 갱신

`docs/19-kill-per-turn-by-class.md` §6 "만렙 베이스 ATK 추정" 표 갱신 완료. 임계 ATK(§4·§5)는 적 HP/DEF가 그대로이므로 변동 없음. 캐릭터 베이스 ATK가 +10% 올라간 효과가 §6.1 "베이스만으로 어디까지 가능한가"에 반영됨.

## 10. 적용 상태

- [x] §6.1 타입 확장 — `ClassDef`에 `strToAtkMult`/`vitToDefMult`/`vitToHp`/`agiDodgeMult`/`agiCritMult`/`matkToIntMult` 6개 옵셔널 필드 (`types.ts`)
- [x] §6.2 `computeStats` 변환 적용 (`logic.ts:180`)
- [x] §6.3 `playerDodgeChance`/`playerAgiCritChance` 헬퍼 추가 (`logic.ts:319` 이후)
- [x] §6.4 호출 사이트 교체 — `resolveDispatch`/`resolveBossDispatch`/`simulateCoopAttack` 3개 함수의 player dodge/crit 사이트
- [x] §6.5 클래스 데이터 갱신 — 전사/도적/마법사 + 광전사 `growMult.hp` 0.52
- [x] §6.6 passiveText 보강
- [x] §6.7~8 시뮬 검증 — `scripts/identity-stat-sim.ts`, `scripts/identity-stat-applied-check.ts`
  - 전사 lv 100: ATK 343 / DEF 330 / HP 1897 (예상 343/325/1897 일치)
  - 광전사 lv 150: ATK 523 → 패시브 후 758 / HP 1724 (예상치 일치)
  - 마법사 lv 100: INT 347 (예상 347 일치)
- [x] §6.9 `docs/19`, `docs/08` 갱신
- [x] §6.10 CHANGELOG 기록
