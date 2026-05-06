# 24. 원소술사 컨셉 재설계 — 원소 스택 + 콤보 시스템

> **상태**: 적용 완료. 본 문서는 변경 이력/근거 기록용.
> 코드 변경: `types.ts` (`ElementKind`/`ElementBuff`/`ElementState`/`apply_element`/`elemental_combo` SkillEffect) · `data.ts` (`ELEMENT_BUFFS`/`ELEMENT_COMBO_EFFECTS`/`ELEMENT_STACK_CAP`/`ELEMENT_LINGER_TURNS` + SKILLS 4종 재정의) · `logic.ts` (헬퍼 + resolveDispatch/resolveBossDispatch 통합) · `store.ts` (persist v2→v3 + 구 4종 ID 자동 매핑).
> 협동 보스 `simulateCoopAttack` 통합 완료 — 산군/그리폰/크라켄 공격 시 원소 스택/콤보 정상 작동.
> LogStream UI 완료 — DispatchLogEntry/BossCombatLogEntry에 `elements`/`elementLingerTurns` 스냅샷 필드 추가, HP 영역 옆 원소 스택 인디케이터(🔥/❄️/⚡ 3슬롯 + 잔존 턴), 원소 부여/콤보 텍스트 색상화.
> **관련 코드**: `src/lib/game/data.ts` (`SKILLS` elementalist 4종), `src/lib/game/types.ts` (`SkillEffect`), `src/lib/game/logic.ts` (전투 상태 / `magic_damage`·`enemy_debuff` 처리부), `src/components/game/LogStream.tsx` (전투 로그 표시)
> **연관 문서**: `docs/23-mage-rebalance-plan.md` (마법사 정체성 약점 진단), `docs/03-skills.md` (스킬 효과 종류), `docs/02-combat.md` (턴 처리)

## 0. 한 문장 요약

원소술사의 4개 액티브 스킬을 **3개 원소 부여 버프(즉발 데미지 없음) + 1개 원소 콤보 폭발기**로 재설계 — 매 턴 스택을 모아 큰 한 방을 준비하는 빌드업형 마법사로 정체성을 바꾸고, 콤보 발동 시 보유 원소 종류로 7가지 분기 효과 중 하나가 발동한다.

## 1. 변경의 동기

`docs/23` §2에서 진단된 마법사·원소술사의 약점 중 **2차 빌드 다양성 0**과 **마법 스킬이 정해진 데미지 곱연산만 반복**한다는 두 문제를 한 번에 해결한다.

현재 원소술사 액티브 4개(`data.ts` SKILLS):

- 화염 폭발 / 얼음 가시 / 번개 사슬 → 모두 `magic_damage` 계열, 각자 INT×N의 즉발 데미지
- 메테오 강림 → 더 큰 INT×8.0의 즉발 단발

→ 4스킬을 모두 슬롯에 끼우면 "쿨다운 타이머 4개가 돌아가는데 효과는 다 비슷한 데미지"라 빌드 의사결정이 없다. 어느 원소 스킬을 빼도 게임이 비슷하게 돌아간다.

새 시스템의 의도:

1. **사냥(필드)**: 원하는 원소 1종만 슬롯에 끼우고 stacking — "불 빌드 / 얼음 빌드 / 번개 빌드"가 명확히 갈림
2. **보스(고난도)**: 3개 원소 모두 끼우고 조합으로 콤보 스킬 분기 — 보스 패턴/턴 안배에 따라 콤보 선택
3. **빌드업 정체성**: 원소 부여 자체는 즉발 데미지가 없고 매 턴 자기 버프만 누적 → "큰 한 방을 준비하는 마법사"의 페이싱 확보
4. 단일 패시브(매직 +60% / 턴 시작 INT×0.3 자동 마법)는 그대로 유지 — 1차 마법사로부터의 강화 정체성

## 2. 변경 전후 비교

| 항목               | 현재                                     | 변경 후                                                                      |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------------------------- |
| 액티브 스킬 4종    | 화염/얼음/번개 즉발 데미지 + 메테오 강림 | 불의 원소 / 얼음 원소 / 번개 원소 (순수 자기 버프) + 원소 조합 (분기 폭발기) |
| 원소 부여의 데미지 | 즉발 INT×2.0~8.0                         | **즉발 0** — 자기 스택 +1만                                                  |
| 메인 메커니즘      | 매 N턴 INT×M 즉발 데미지                 | 원소 stacking (cap 3, 종류 무관) → 자가 강화 + 콤보 분기                     |
| 콤보 발동 처리     | 메테오 강림 = 단일 효과                  | 보유 원소 종류로 7가지 분기 + **스택 소비 + 자기 버프 3턴 잔존**             |
| 콤보 cd            | 9턴                                      | **6턴**                                                                      |
| 사냥 차별화        | 4스킬 모두 의무                          | 1~2개 원소만 채용 가능 → 빌드 자유도                                         |
| 슬롯 부담          | 4개 슬롯 점유                            | 4개 슬롯 (동일) — 사냥 시 2~3개만 끼워도 작동                                |

## 3. 원소 스택 시스템 — 코어

### 3.1 자료 구조

전투 시작 시 `ElementState` 초기화. 매 스킬 발동 / 매 턴 시작 시 갱신.

```ts
// types.ts — DispatchResult 흐름 안에서만 사용 (저장 X)
type ElementKind = "fire" | "ice" | "lightning";

type ElementState = {
  stacks: ElementKind[]; // 현재 스택, 길이 ≤ 3, FIFO 순서로 저장
  lingeringBuff: ElementBuff | null; // 콤보 소비 직전의 자기 버프 스냅샷
  lingerTurnsLeft: number; // 잔존 남은 턴 (3에서 시작, 매 턴 -1)
};
```

상수 (data.ts에 추가):

```ts
export const ELEMENT_STACK_CAP = 3;
export const ELEMENT_LINGER_TURNS = 3; // 콤보 발동 후 자기 버프 잔존
```

### 3.2 적용 규칙 (확정)

1. **원소 부여 스킬 발동** = `stacks.push(kind)`. 단, `stacks.length === 3`이면 `stacks.shift()` (FIFO push out) 후 push.
2. **자기 버프** = `computeElementBuffs(stacks)` + `lingeringBuff`(있다면) **합산 적용**. 매 턴 `computeStats` 직후 합산.
3. **콤보 스킬 발동**:
   - 발동 직전 자기 버프를 `lingeringBuff`로 스냅샷 저장
   - `lingerTurnsLeft = ELEMENT_LINGER_TURNS (=3)`
   - `stacks = []` (모두 소비)
   - 분기 효과 발동 (§5)
4. **매 턴 시작**: `lingerTurnsLeft > 0`이면 −1. 0 이하 도달 시 `lingeringBuff = null`.
5. **전투 종료 시 모두 리셋** — 다음 dispatch carry-over 없음.

### 3.3 잔존 버프와 새 스택의 동시 적용 (Q&A)

**문제**: 콤보 발동 후 곧바로 새 원소를 부여하면 잔존 버프와 새 스택 버프가 동시에 활성화되는가?

**확정**: **그렇다, 합산**. 콤보 직후의 빈 시간을 메우기 위한 안전망이 잔존 버프의 의도이므로 새 빌드를 다시 쌓는 동안 잔존이 같이 작동해야 자연스럽다.

예 (불 특화, 부여 cd 3턴, 콤보 cd 6턴):

- T0: 시작
- T3: 불 부여 → stacks=[불], INT +10%
- T6: 불 부여 → stacks=[불,불], INT +25%. **콤보 cd 만료** → 콤보 발동 직전 스냅샷(INT +25%) 저장, stacks=[], lingerTurnsLeft=3
- T7: 매 턴 처리. 잔존 INT +25% 활성, lingerTurnsLeft=2
- T8: 잔존 INT +25%, lingerTurnsLeft=1
- T9: 불 부여 → stacks=[불] (INT +10%) + 잔존(+25%) = **INT +35%**. lingerTurnsLeft=0 → 잔존 소멸은 다음 턴
- T10: 잔존 만료, stacks=[불] = INT +10%만
- T12: 콤보 cd 만료. stacks=[불,불] (INT +25%) → 콤보 발동, 사이클 반복

→ T9 시점이 가장 강하다 (잔존 + 새 스택 합산). 이 일시적 피크는 의도된 디자인 — "큰 한 방 직후 재충전 페널티가 없음".

### 3.4 같은 종류 vs 혼합 — 사냥/보스 분기 메커니즘

| 시나리오             | 슬롯 구성                    | 결과                                                    |
| -------------------- | ---------------------------- | ------------------------------------------------------- |
| **사냥 — 불 특화**   | 불의 원소만 1슬롯 + 콤보     | 불×3 도달 후 콤보 = "지옥불" 분기                       |
| **사냥 — 얼음 탱킹** | 얼음 원소만 1슬롯 + 콤보     | 얼음×3 도달 → DEF/MDEF 풀스택 + "절대영도" 콤보         |
| **사냥 — 번개 속도** | 번개 원소만 1슬롯 + 콤보     | 번개×3 → SPD 풀스택 + 다중 히트 "뇌신강림"              |
| **사냥 — 듀얼**      | 불 1슬롯 + 얼음 1슬롯 + 콤보 | 불×n / 얼음×m 혼합 → "마그마 폭발" 발동                 |
| **보스 — 풀 조합**   | 4개 모두 슬롯                | 1+1+1 도달 → "원소 조화" (메테오 강림) — 가장 강한 콤보 |

→ 슬롯 구성만으로 빌드가 정의된다. 공통 패시브(매직 +60%)는 항상 작동.

## 4. 원소별 자기 버프

각 원소 부여 스킬은 **즉발 데미지 0, 순수 스택 부여**. 스택 수에 비례한 자기 강화 효과는 매 턴 `computeStats` 시점에 합산.

### 4.1 불의 원소 (`fire_element`)

> 컨셉: **공격형 — INT 증폭으로 마법 데미지 자체를 키운다.**

- 발동: 매 3턴, **데미지 없음 + 불 스택 +1**
- 자기 버프 (스택 누적):
  - 1스택: INT +10%
  - 2스택: INT +25%
  - 3스택: INT +45% + **마법 크리 +10%** (`docs/23` B1 도입 시 시너지)
- 적합한 빌드: 단일 강적 버스트, 보스 패턴 짧을 때

### 4.2 얼음 원소 (`ice_element`)

> 컨셉: **방어형 — DEF/MDEF 강화로 장기전 생존성.**

- 발동: 매 3턴, **데미지 없음 + 적 SPD −1 (2턴, 디버프) + 얼음 스택 +1**
- 자기 버프 (스택 누적):
  - 1스택: DEF +15%, MDEF +15%
  - 2스택: DEF +30%, MDEF +30%
  - 3스택: DEF +50%, MDEF +50% + **받는 데미지 −10%**
- 적합한 빌드: 광폭 적 지역, 코옵 보스 후반 광역기 버티기

> 얼음만 적 디버프(SPD)를 갖는 이유 = 컨셉 부여(둔화)에 필요한 최소 효과. 데미지는 여전히 0이라 정체성 위반 아님.

### 4.3 번개 원소 (`lightning_element`)

> 컨셉: **속도형 — SPD로 공격 횟수와 패시브 자동 마법 발동률 증대.**

- 발동: 매 3턴, **데미지 없음 + 번개 스택 +1**
- 자기 버프 (스택 누적):
  - 1스택: SPD +5
  - 2스택: SPD +12
  - 3스택: SPD +20 + **턴 시작 자동 마법(`turnStartIntMult`) 발동 횟수 ×2**
- 적합한 빌드: SPD 슬롯 풀로 활성화하는 평타+자동 마법 누적

### 4.4 즉발 데미지가 0인 이유 (정체성)

원소 부여는 "마법진을 그리는 행위"로 모델링. 효과는 100% 자기 버프와 콤보 폭발에 응축되어 있고, 발동감은 **자기 버프 인디케이터의 시각 변화**(§9)로 보강. 데미지 숫자가 매 3턴 로그에 찍히면 콤보의 한 방이 묻혀 "큰 한 방 마법사"의 정체성이 흐려짐.

대신 **공통 패시브의 턴 시작 자동 마법(INT×0.3)**이 매 턴 작은 데미지를 깔아 "마법 페이스"는 유지한다. 번개 3스택 시 이 자동 마법이 ×2가 되어 빌드 시너지도 확보.

## 5. 원소 조합 콤보 스킬 (`elemental_combo`)

메테오 강림 슬롯을 **분기형 콤보 스킬**로 교체. 발동 시점에 `stacks`를 읽어 7가지 분기 중 하나가 발동, 발동 후 스택 소비 + 자기 버프 3턴 잔존.

### 5.1 분기 매트릭스 — 7가지 (확정)

발동 시 보유 원소 **종류 set**(중복 무시)을 기준으로 분기. **N**은 각 분기에서 사용하는 해당 원소의 스택 수.

| 보유 원소 (종류 set)     | 콤보 이름       | 효과                                                                  |
| ------------------------ | --------------- | --------------------------------------------------------------------- |
| {불}                     | **지옥불**      | INT×(2.0 + N) 마법, DEF 무시 + 화염 DOT 1스택 부여 (N=불 스택 수)     |
| {얼음}                   | **절대영도**    | INT×(1.5 + N) 마법, **적 SPD 0 (1턴) + 적 DEF/MDEF −30% (2턴)**       |
| {번개}                   | **뇌신강림**    | INT×1.5 ×(N+2) 히트 (DEF 무시) — 단일 적 누적                         |
| {불, 얼음}               | **마그마 폭발** | INT×4.0 마법 + 적 DEF/MDEF −20% (3턴) + 화염 DOT 1스택                |
| {불, 번개}               | **플라즈마**    | INT×2.5 ×3 히트 (전부 DEF 무시) + 본인 SPD +5 (3턴)                   |
| {얼음, 번개}             | **빙뢰 폭풍**   | INT×3.0 ×2 히트 + 적 SPD −3 (3턴) + 본인 MDEF +20% (3턴)              |
| {불, 얼음, 번개} (1+1+1) | **원소 조화**   | INT×10.0 마법 (DEF·MDEF 모두 무시) — **현재의 메테오 강림 컨셉 보존** |

> 예: 불×2만 보유한 상태에서 콤보 → 지옥불 발동 시 INT×4.0 + DOT.

### 5.2 분기 결정 알고리즘

```ts
function pickCombo(stacks: ElementKind[]): ComboKind | "none" {
  if (stacks.length === 0) return "none";
  const kinds = new Set(stacks);
  if (kinds.size === 3) return "harmony";
  if (kinds.size === 2) {
    if (kinds.has("fire") && kinds.has("ice")) return "magma";
    if (kinds.has("fire") && kinds.has("lightning")) return "plasma";
    return "frost_storm"; // {ice, lightning}
  }
  // size === 1
  return stacks[0] === "fire" ? "hellfire" : stacks[0] === "ice" ? "absolute_zero" : "thunder_god";
}
```

### 5.3 스택 소비 + 잔존 버프 (확정 — §3.2)

콤보 발동 시:

1. 자기 버프 스냅샷 저장 → `lingeringBuff`
2. `lingerTurnsLeft = 3`
3. `stacks = []`
4. 콤보 분기 효과 발동

다음 3턴 동안 자기 버프 유지 → 새 스택 부여 시 §3.3대로 합산. 4턴 차에 잔존 만료.

### 5.4 쿨다운 (확정)

**6턴**. 부여 cd 3턴 + 콤보 cd 6턴 조합으로:

- 단일 원소 빌드: 콤보 cd 도달 시 평균 **2스택** (간헐적 3스택 도달 후 발동) → "절반 충전" 인상
- 풀 조합 빌드: T6에 1+1+1, T9에 cd 만료 시점 = 다시 1+1+1 도달 가능 → 매 6턴 풀 조합 콤보

> "큰 한 방 준비" 컨셉을 살리려면 풀 충전 도달 후 발동이 자연스럽지만, 단일 빌드도 풀 충전을 기다리려 굳이 cd를 흘리는 것보다 cd 만료 즉시 발동이 게임 감각상 더 직관적. 부여 cd 3턴 / 콤보 6턴 비율은 평균 2스택 콤보를 기준값으로 삼는다 — 효과 수치는 §5.1처럼 **N에 비례 스케일링**되어 자연 보정.

### 5.5 발동 가드

- `stacks.length === 0`이면 콤보 발동 차단 (cd 소모 안 함, 다음 턴 재시도)
- 효과 적용 직후 `lastComboAt = totalTurns` 기록 (시각화용)

## 6. 게임플레이 시나리오

### 6.1 사냥 빌드 — "불 특화" (cd 3/6, 잔존 3턴 적용)

슬롯: 1차 패시브 2~3개 + **불의 원소** + **원소 조합** = 4~5슬롯

흐름:

- T0: 전투 시작. 스택 0
- T3: 불 부여 → 불×1 (INT +10%)
- T6: 불 부여 → 불×2 (INT +25%). **콤보 cd 만료** → 지옥불 (INT×4.0 + DOT) 발동, stacks=[], 잔존 +25% 3턴
- T7: 잔존 +25%, lingerTurnsLeft=2
- T8: 잔존 +25%, lingerTurnsLeft=1
- T9: 불 부여 → 불×1 (INT +10%) + 잔존 (+25%) = **INT +35%**. lingerTurnsLeft=0 → 다음 턴 만료
- T10: 잔존 소멸, 불×1 (+10%)
- T12: 불 부여 → 불×2 (+25%). 콤보 cd 만료 → 지옥불 발동, 사이클 반복

콤보 발동 빈도: 매 6턴 = 약 17%/턴 (vs 9턴 cd 시 11%) → **빈도 50% ↑**.

DPS 추정 (Lv150 INT 342 가정):

- 평균 INT 멀티 ≈ 1.20 (잔존 + 신규 스택 평균)
- 지옥불 (불×2): 342×1.25×4 = 1,710 + 화염 DOT
- 평타: ATK 311 (DEF 50% 무시 패시브 X — 원소술사는 1차 패시브 교체)

### 6.2 사냥 빌드 — "얼음 탱킹"

슬롯: 1차 패시브 + **얼음 원소** + **원소 조합** = 4슬롯

T6 이후 얼음×2 도달, T9 이후 얼음×3: DEF +50% / MDEF +50% / 받는 데미지 −10% 풀스택. 콤보 cd 6턴 도달 = "절대영도" — 적 SPD 0 + DEF/MDEF −30% × 2턴.

매 6턴 SPD 0 봉인으로 1턴 휴식 + 자기 버프 잔존 3턴 → 광폭 보스에서도 안정.

### 6.3 보스 빌드 — "풀 조합"

슬롯: **불 + 얼음 + 번개 + 원소 조합** = 4슬롯 (전부)

흐름:

- T3: 불 → stacks=[불] (INT +10%)
- T6: 얼음 → stacks=[불,얼음] (INT +10% + DEF/MDEF +15%). 콤보 cd 만료, 그러나 종류 set={불,얼음}이라 마그마 폭발 (INT×4.0 + DEF/MDEF −20% 3턴 + DOT) 발동, 잔존 3턴 시작
- T9: 번개 → stacks=[번개] (SPD +5) + 잔존 (불×1+얼음×1 버프) = INT +10% + DEF/MDEF +15% + SPD +5
- T10: 잔존 만료. SPD +5만
- T12: 불 → stacks=[번개,불]. 콤보 cd 만료, set={불,번개} → **플라즈마** (INT×2.5 ×3 + 본인 SPD +5)

→ 풀 조합 빌드는 **매 6턴마다 변하는 콤보**. 적 디버프와 자기 버프가 끊임없이 회전 — 보스 패턴에 대응하기 좋은 형태. 1+1+1 풀 충전 "원소 조화"는 부여 타이밍을 의식적으로 안배해야 도달 (T0~T9 사이클을 T0:불 / T3:얼음 / T6:번개로 배치).

### 6.4 보스 빌드 — "원소 조화 노림"

슬롯 구성은 같음. 부여 발동 순서를 의도적으로 배치하면 매 9턴마다 1+1+1 = 원소 조화 (INT×10) 가능. 다만 콤보 cd가 6턴이라 6턴 시점에 한 번 다른 콤보를 흘려야 하는 트레이드오프 — "조화를 기다리며 cd 1회 스킵"이 의식적 선택이 됨.

## 7. 데이터 모델 변경

### 7.1 `types.ts` — `SkillEffect` 확장

```ts
// 신규 effect — 원소 스택 부여 (즉발 데미지 0, 자기 버프만)
| {
    kind: "apply_element";
    element: "fire" | "ice" | "lightning";
    // 옵션: 부여 시 적 디버프 (얼음 SPD -1 등)
    enemyDebuff?: { stat: "spd"; flat: number; turns: number };
  }

// 신규 effect — 원소 조합 콤보 (스택 소비 + 잔존)
| { kind: "elemental_combo" }
//  추가 파라미터는 ELEMENT_COMBO_EFFECTS 룩업으로 위임
```

### 7.2 전투 상태 (`logic.ts` resolveDispatch / resolveBossDispatch)

```ts
// turn loop 시작 전 초기화
const elementState: ElementState = {
  stacks: [],
  lingeringBuff: null,
  lingerTurnsLeft: 0,
};

// 매 턴 시작
if (elementState.lingerTurnsLeft > 0) {
  elementState.lingerTurnsLeft -= 1;
  if (elementState.lingerTurnsLeft === 0) elementState.lingeringBuff = null;
}

// computeStats 직후
const stackBuff = computeElementBuffs(elementState.stacks);
const totalBuff = mergeBuffs(stackBuff, elementState.lingeringBuff);
const effStats = applyElementBuff(stats, totalBuff);
```

`mergeBuffs(a, b)`: 같은 필드 합산 (intPct + intPct, defPct + defPct …).

### 7.3 `data.ts` — SKILLS elementalist 4종 재정의 (확정)

```ts
fire_element: {
  id: "fire_element", name: "불의 원소", classId: "elementalist",
  description: "3턴마다 불 원소 1스택 부여 (cap 3, 종류 무관) — 즉발 데미지 없음",
  unlockLevel: 100,
  trigger: { kind: "every_n_turns", n: 3 },
  effect: { kind: "apply_element", element: "fire" },
  learnCost: 50000,
},
ice_element: {
  ...
  description: "3턴마다 얼음 원소 1스택 + 적 SPD -1 (2턴)",
  effect: {
    kind: "apply_element", element: "ice",
    enemyDebuff: { stat: "spd", flat: -1, turns: 2 },
  },
  learnCost: 100000,
},
lightning_element: {
  ...
  description: "3턴마다 번개 원소 1스택 부여",
  effect: { kind: "apply_element", element: "lightning" },
  learnCost: 200000,
},
elemental_combo: {
  id: "elemental_combo", name: "원소 조합", classId: "elementalist",
  description: "6턴마다 보유 원소 조합에 따라 7가지 콤보 발동 — 발동 시 스택 소비, 자기 버프 3턴 잔존",
  unlockLevel: 100,
  trigger: { kind: "every_n_turns", n: 6 },
  effect: { kind: "elemental_combo" },
  learnCost: 500000,
},
```

총 학습비 850,000 → 그대로 유지.

### 7.4 `data.ts` — 자기 버프 룩업

```ts
export type ElementBuff = {
  intPct?: number;
  defPct?: number;
  mdefPct?: number;
  spdFlat?: number;
  dmgReductionPct?: number;
  magicCritChance?: number;
  turnStartMagicMult?: number;
};

export const ELEMENT_BUFFS: Record<ElementKind, [ElementBuff, ElementBuff, ElementBuff]> = {
  fire: [{ intPct: 0.1 }, { intPct: 0.25 }, { intPct: 0.45, magicCritChance: 0.1 }],
  ice: [
    { defPct: 0.15, mdefPct: 0.15 },
    { defPct: 0.3, mdefPct: 0.3 },
    { defPct: 0.5, mdefPct: 0.5, dmgReductionPct: 0.1 },
  ],
  lightning: [{ spdFlat: 5 }, { spdFlat: 12 }, { spdFlat: 20, turnStartMagicMult: 2.0 }],
};
```

`computeElementBuffs(stacks)`는 종류별 카운트 → `ELEMENT_BUFFS[kind][count-1]` 합산 후 반환.

### 7.5 `data.ts` — 콤보 효과 테이블

```ts
export const ELEMENT_COMBO_EFFECTS = {
  hellfire: (n: number) => ({ intMult: 2.0 + n, ignoreDef: true, dotStacks: 1 }),
  absolute_zero: (n: number) => ({
    intMult: 1.5 + n,
    enemySpdZeroTurns: 1,
    enemyDefMdefDebuff: 0.3,
    debuffTurns: 2,
  }),
  thunder_god: (n: number) => ({ intMult: 1.5, hits: n + 2, ignoreDef: true }),
  magma: () => ({ intMult: 4.0, enemyDefMdefDebuff: 0.2, debuffTurns: 3, dotStacks: 1 }),
  plasma: () => ({ intMult: 2.5, hits: 3, ignoreDef: true, selfSpdBuff: 5, selfBuffTurns: 3 }),
  frost_storm: () => ({
    intMult: 3.0,
    hits: 2,
    enemySpdDebuff: 3,
    selfMdefBuff: 0.2,
    selfBuffTurns: 3,
  }),
  harmony: () => ({ intMult: 10.0, ignoreDef: true, ignoreMdef: true }),
};
```

## 8. 코드 변경 항목 — 작업량 추정

| 파일                                | 변경                                                                                                   | 추정 줄 수 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| `src/lib/game/types.ts`             | `apply_element`, `elemental_combo` SkillEffect 추가 + `ElementKind`/`ElementBuff`/`ElementState` 타입  | ~35        |
| `src/lib/game/data.ts`              | SKILLS elementalist 4종 재정의 + `ELEMENT_BUFFS` / `ELEMENT_COMBO_EFFECTS` / `ELEMENT_LINGER_TURNS` 등 | ~120       |
| `src/lib/game/logic.ts`             | `elementState` 변수 + `computeElementBuffs` / `mergeBuffs` / `applyElementBuff` 헬퍼 + 콤보 분기 처리  | ~180       |
| `src/components/game/LogStream.tsx` | 원소 부여/콤보 발동 로그 색상화                                                                        | ~20        |
| `src/lib/game/store.ts`             | persist migrate — 구 4종 ID 학습 시 새 4종으로 매핑 (skillExp 보존)                                    | ~25        |
| `docs/03-skills.md`                 | 원소술사 스킬 표 갱신                                                                                  | ~30        |
| `docs/08-balance-reference.md`      | 원소술사 행 갱신 + `ELEMENT_STACK_CAP`/`ELEMENT_LINGER_TURNS` 신규 상수                                | ~10        |

**총 ~420줄** + 시뮬 검증. 1차 PR 분량으로 적절하지만 한 커밋에 다 넣지 말고 1) 타입+데이터 2) 로직 3) UI/문서 3단 분할 권장.

## 9. UI / UX

### 9.1 전투 로그

- 원소 부여 발동 시: `🔥 불의 원소 발동 — 불×2 (INT +25%)` (데미지 라인 없음)
- 잔존 활성 표시: `✨ 원소 여운: INT +25% (남은 2턴)` — 콤보 직후에만 1회 출력
- 콤보 발동 시: `⚡ 원소 조합 → 플라즈마 (불×2 + 번개×1)` + 데미지 결과
- 색상: 불=red-500, 얼음=cyan-300, 번개=violet-400, 콤보=amber-300, 잔존=fg-faint

### 9.2 캐릭터 시트 (탐험 중)

기존 HP/INT 표시 옆에 **현재 원소 스택 인디케이터** 3칸:

```
[🔥🔥⚪]  (불×2 / 얼음×0 / 번개×0)   ✨ 잔존 1턴
```

- 빈 칸은 회색, 보유 시 원소 색
- **3스택 도달 시 펄스 애니메이션** + 발광 효과 (확정 — 결정 §10) — 토스트는 안 띄움
- 잔존 활성 시 인디케이터 옆에 작은 ✨ 아이콘 + 남은 턴

### 9.3 스킬 툴팁

원소 조합 스킬 툴팁은 7가지 분기 표를 접이식으로. HelpTab에는 풀 표 + 시나리오 예시.

## 10. 결정 사항 (모두 확정)

| 항목                                | 확정값                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 스택 cap                            | **3** (종류 무관)                                                                                                     |
| cap 도달 시 처리                    | **FIFO push out** (가장 오래된 스택 제거 후 push)                                                                     |
| 콤보 발동 시 스택                   | **소비** (모두 0)                                                                                                     |
| 콤보 발동 시 자기 버프              | **3턴 잔존** (`ELEMENT_LINGER_TURNS = 3`)                                                                             |
| 잔존 + 새 스택 동시 적용            | **합산** (§3.3)                                                                                                       |
| 콤보 cd                             | **6턴**                                                                                                               |
| 부여 cd                             | **3턴** (모든 원소 동일)                                                                                              |
| 원소 부여의 즉발 데미지             | **0** (얼음만 적 SPD 디버프 동반)                                                                                     |
| 3스택 도달 시각 피드백              | **인디케이터 펄스/발광만** (토스트 X)                                                                                 |
| 기존 elementalist 캐릭 마이그레이션 | **자동** — 구 4종 ID(`fire_burst`, `ice_spike`, `lightning_chain`, `meteor_descent`) → 새 4종으로 매핑, skillExp 보존 |

## 11. 리스크 / 미해결

### 11.1 풀 조합 매 6턴 콤보의 OP 가능성

§6.3 시나리오에서 매 6턴마다 (마그마 / 플라즈마 / 빙뢰 / 조화) 중 하나 발동 + 자기 버프 잔존이 깔린 상태. 보스 30턴 cap에서 약 5회 콤보 가능 → 시뮬상 보스 평균 클리어 턴이 30→18 정도로 줄 수 있음. **시뮬 후 콤보 효과 수치를 보수적으로 하향**할 수 있음(예: harmony INT×10 → ×8).

### 11.2 단일 원소 빌드의 누적 손실 (push out)

cap 3 도달 후 같은 원소 스킬을 또 발동하면 가장 오래된 스택이 빠진다 → 결국 "쿨다운만큼 발동했지만 스택은 항상 3 유지". 단, 콤보 발동 시 스택이 비워지므로 cap 3 push out이 실제로 발동하는 빈도는 높지 않다. 다른 원소를 한 번 끼면 영구 손실 — 듀얼 빌드는 단일보다 자기 버프가 약하지만 콤보 다양성으로 보상.

### 11.3 thunder_god 다중 히트의 분산 효과 무의미

dispatch 시 동시 등장 적이 1마리(`pickEnemy`)이고 코옵 보스도 단일이라 "분산"은 사실상 단일 적 누적. **§5.1 표의 분산 표기 삭제 — 단일 적 누적으로 통일**.

### 11.4 보스 30턴 cap

`BOSS_DURATION_SEC = 30`. 콤보 cd 6턴이면 보스 1전투당 콤보 4~5회 발동 가능. 풀 조합 빌드의 변형 콤보가 보스 패턴 디버프와 시너지 → 평균 클리어 턴 단축 폭이 큼. 시뮬 필수.

### 11.5 1차 마법사 패시브 손실 보전

원소술사 패시브가 1차 마법사 `def_pierce 50%`를 교체하는 현 구조 그대로. 별도 보완은 `docs/23` §3.A에 위임.

### 11.6 turn_start_magic ×2 (번개 3스택)와 자동 마법의 상호작용

`magic_amp_with_aura` 패시브의 `turnStartIntMult: 0.3` 자동 마법이 번개 3스택 시 ×2 = INT×0.6 매 턴. Lv150 INT 342 기준 약 ~205 데미지/턴. 다른 자동 마법 시너지 패시브와 곱연산이 되지 않도록 분리해 합산만.

## 12. 작업 순서

1. **타입 + 데이터 (커밋 1)**: `types.ts`에 `ElementKind`/`ElementBuff`/`ElementState`/`apply_element`/`elemental_combo` 추가. `data.ts`에 `ELEMENT_BUFFS`/`ELEMENT_COMBO_EFFECTS`/`ELEMENT_STACK_CAP`/`ELEMENT_LINGER_TURNS` + SKILLS 4종 재정의.
2. **로직 (커밋 2)**: `logic.ts`에 `elementState` + 헬퍼(`computeElementBuffs`, `mergeBuffs`, `applyElementBuff`) + 매 턴 잔존 감소 + apply_element/elemental_combo 분기.
3. **UI + 문서 (커밋 3)**: LogStream 색상화, 캐릭터 시트 인디케이터, `docs/03-skills.md`/`08-balance-reference.md` 동기화.
4. **마이그레이션 (커밋 2 또는 3에 포함)**: store.ts persist migrate — 구 4종 ID 매핑.
5. `npx tsc --noEmit`, `npm run lint`, `npm run build` (각 커밋 후)
6. 시뮬 — `scripts/first-job-progression-sim.ts`에 elementalist 분기 추가, 원소술사 사냥/보스 클리어 턴 변화 측정. §11.1 결과로 콤보 수치 튜닝.
7. 본 plan 문서 §0/§1에 "적용 완료" 표시 + 시뮬 결과 §11에 기록.
