# 18. 탐험 도중 취소 시 부분 보상 지급안

> **상태**: 적용 완료 (§3.A 단순 시간 비례 + doc 22 `treasureRolls` 슬라이싱)
>
> **구현 요약**: `cancelDispatch`가 elapsedSec / playbackSec 비례로 kill 자원·EXP·재료를 분배하고, 보물은 `treasureRolls.slice(0, floor(elapsedSec/60))`로 자연스럽게 분당 굴림만 유효 처리. finalMult는 출발 시점 길이의 효율(0.75/0.88/1.0) 그대로 유지. 보스는 부분 보상 대상 외(기존처럼 보상 0). MIN_PARTIAL_SEC=5초 미만은 우발 클릭 보호로 보상 0.
> **관련 코드**: `src/lib/game/store.ts` (`startDispatch`, `cancelDispatch`, `finalizeDispatch`), `src/lib/game/logic.ts` (`resolveDispatch`), `src/lib/game/types.ts` (`DispatchResult`, `DispatchLogEntry`), `src/app/tabs/ExploreTab.tsx` (취소 버튼)
> **연관 문서**: `06-progression.md` (탐험 시간/효율), `08-balance-reference.md`

## 1. 문제 정의

현재 `cancelDispatch`는 진행 중인 탐험을 무조건 폐기한다(`store.ts:560-564`).

```ts
cancelDispatch: () => {
  const s = get();
  if (!s.dispatch || s._resolving) return;
  set({ dispatch: null });
},
```

→ 8시간(28800초) 탐험을 7시간 50분 돌려놓고 `취소`를 누르면 골드·아이언·EXP·재료·HP 변화까지 **전부 0**.

방치형 게임에서 가장 흔한 시나리오 두 가지가 모두 손해다.

- **상황 변경**: 다른 지역으로 옮기고 싶어졌다 → 누적된 시간을 버려야 옮길 수 있음
- **목표 달성**: 원하던 재료가 이미 떨어졌을 만큼 오래 돌렸지만, 정산 받으려면 끝까지 기다려야 함

## 2. 설계 원칙

1. **효율 곡선 보존** — 길이별 효율은 1분 100% / 30분 88% / 2시간 75% (`DISPATCH_REWARD_MULT`, 본 문서 작성 시점). 부분 보상은 **출발 시점에 선택한 길이의 효율**을 그대로 적용한 결정론적 결과의 부분 집합 — 즉 7200s 효율 0.75로 1시간 50분 진행 후 취소해도 60s 효율 1.0이 소급되지 않는다. 취소가 효율 우회 경로가 되는 것을 막는 핵심 조항.
2. **사전 계산 결과 재사용** — `startDispatch` 시점에 이미 `DispatchResult`(turn 단위 시뮬)가 계산되어 `state.dispatch.dispatchResult`에 저장되어 있다. 취소 보상은 **이 결정론적 결과의 부분 집합**으로 정의한다. RNG 재실행 금지(같은 탐험을 두 번 굴리는 효과 방지).
3. **남용 여지 차단** — 짧게 시작 → 즉시 취소를 반복해 RNG 시드를 농락하는 경로는 이미 결정론(시작 시 1회 굴림)으로 막혀 있다. 다만 `treasure`(보물)와 같은 "한 번에 결정되는" 보상은 **끝까지 도달한 경우에만** 지급한다 (§5).
4. **보스 탐험은 대상 외** — 보스는 처치/실패 이분 보상이라 비례 분할 의미가 없음. 기존처럼 취소 시 보상 0.

## 3. 보상 분배 모델 — 비교

### 3.A 단순 시간 비례 (Simple Pro-Rata) — MVP 후보

`progress = elapsedSec / playbackSec` 로 한 번에 나눈다.

| 항목                  | 처리                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `gained.gold`         | `floor(total * progress)`                                                                                                        |
| `gained.iron`         | `floor(total * progress)`                                                                                                        |
| `exp`                 | `floor(total * progress)`                                                                                                        |
| `droppedMaterials[k]` | `floor(total * progress)` (확률 드랍 누적이라 floor 무난)                                                                        |
| `treasure`            | **비례 확률 재굴림** — §5.2 (full 1회 굴림이 아니라 dispatch당 1회 굴림이므로 단순 progress 곱셈은 풀 완료를 페널티 없이 해석함) |
| `totalKills`          | `floor(total * progress)` (로그 표시용)                                                                                          |
| `finalHp`             | 뒤에 §6에서 별도 처리                                                                                                            |
| `diedEarly`           | false 고정 (사망 턴에 도달했다면 자동 종료가 먼저 트리거되므로 취소 불가)                                                        |

**장점**: 구현 30줄. `DispatchResult` 구조 무수정.
**단점**: 실제 1턴 1턴 골드 분포가 균등하지 않음(초반 적이 약하면 골드 적음). 그러나 동일 지역 동종 적을 도는 구조라 분산은 작다.

### 3.B 턴 인덱스 정확 분배 (Per-Turn Cumulative) — 정밀 후보

`resolveDispatch`를 수정해 매 턴 끝에 `cumGold/cumIron/cumExp/cumMaterials` 누적치를 `DispatchLogEntry`에 기록한다. 취소 시 `elapsedTurn = floor(elapsedMs / 1000)` 인덱스를 찾아 그 시점의 누적치를 그대로 지급.

| 항목       | 처리                                                                          |
| ---------- | ----------------------------------------------------------------------------- |
| 모든 자원  | `log[elapsedTurn].cumXxx`                                                     |
| `treasure` | (옵션) 보물 발생 턴을 결과에 기록하고, `elapsedTurn ≥ treasureAt`일 때만 지급 |

**장점**: "방금 보스 옆에서 본 적이 막 죽었는데 취소해도 그 킬 값은 받음" — 사용자 인지와 일치.
**단점**: `DispatchLogEntry` 스키마 확장 + `resolveDispatch` 1100여 줄 중 5~6곳 패치. 메모리/스토리지 영향은 무시 가능 (28800턴이라도 number 4개 추가는 ~ 1MB 미만, persist 직렬화 시 `dispatchResult`만 큼).

### 3.C 권장 — 단계별 도입

> **1단계 (이 PR)**: §3.A로 출시. 사용자 행동 실측 후 분산 불만이 들어오면 §3.B로 승격.
>
> **이유**: 방치형 동등 효율 정체성에서 가장 중요한 건 "시간 비례"라는 *약속*이지 단일 턴 단위 정확도가 아니다. UI에 "시간 비례 보상"이라고 명시하면 §3.A로도 사용자 기대치를 충족한다.

## 4. 데이터 흐름

```
[사용자 클릭 "취소"]
        ↓
ExploreTab → state.cancelDispatch()
        ↓
store.cancelDispatch() — 변경 후
  ├─ guard: !dispatch || _resolving → return
  ├─ guard: isBoss → 기존처럼 보상 없이 폐기 (§2.4)
  ├─ guard: elapsedSec < MIN_PARTIAL_SEC → 기존처럼 보상 없이 폐기 (§5.1)
  ├─ progress = clamp(elapsedSec / playbackSec, 0, 1)
  ├─ partial = scaleResult(dispatchResult, progress)
  ├─ resources/materials/character/exp 적용 (finalizeDispatch 정산 로직 재사용)
  ├─ LogEntry 기록 (kind: 동일, durationSec=elapsedSec, treasure=null, "조기 후퇴(취소)" 라벨)
  └─ dispatch=null
```

`finalizeDispatch`(`store.ts:566-725`)의 **정산 부분**(보상 적용·업적·HP·최근 전투 기록)은 함수로 분리해 `cancelDispatch`와 공유한다. AI 리포트 호출(`/api/report`)은 부분 결과에선 **건너뛴다** (취소 = 짧은 요약만, "당신은 N초 후 발길을 돌렸다." 정도의 로컬 문구).

## 5. 안전장치

### 5.1 최소 경과 시간 (스팸 방지)

```ts
const MIN_PARTIAL_SEC = 5; // 5초 미만 취소는 보상 0
```

근거:

- 방치형 효율은 1.0 동등이므로 "1초 굴려서 1초 분 보상" 자체는 남용이 아니다.
- 그러나 시뮬레이션 첫 턴 결과가 항상 "적 1마리 조우" 시작이라 1턴 보상이 평균보다 약간 높다(`pickEnemy`는 region 내에서만 굴림). 5초 floor 두면 마이크로 스팸 방어 + UX상 "방금 누른 거 실수였나?" 클릭 보호.

### 5.2 보물(treasure) 처리

**현재 구현 (`logic.ts:1248-1260`)**: 보물은 **dispatch당 1회** 굴림이다 (마지막 턴 굴림이 아님). `totalKills > 0`이고 `Math.random() < region.treasure.chance` 면 적중. 즉 1분 dispatch도, 8시간 dispatch도 보물 확률은 동일(예: 사막 3%).

→ 단순히 "취소 시 `treasure=null`"로 처리하면 **풀 완료에 과도한 인센티브가 생긴다** ("1초 더 안 기다려서 25000골드 날렸다"). 비례 보상 정체성 위반.

**채택안 — 비례 확률 재굴림**:

1. `startDispatch`에서 `Math.random()` 시드/주사위 값을 결과에 함께 저장:
   ```ts
   // resolveDispatch 내부, treasure 굴림 시
   const treasureRoll = Math.random(); // [0, 1)
   const treasure =
     totalKills > 0 && region.treasure && treasureRoll < region.treasure.chance
       ? region.treasure
       : null;
   // DispatchResult에 treasureRoll, treasureChance 추가
   ```
2. 풀 완료(`finalizeDispatch`): 기존과 동일한 결과 사용 — 행동 변화 0.
3. 취소(`cancelDispatch`): 같은 `treasureRoll`을 **비례된 확률**과 비교:

   ```ts
   const effectiveChance = region.treasure.chance * progress;
   const treasure =
     result.partialKills > 0 && treasureRoll < effectiveChance ? region.treasure : null;
   ```

   - `progress = 1` → 풀과 완전히 동일 (`treasureRoll < chance`).
   - `progress = 0.5` → 절반 확률 (`treasureRoll < chance × 0.5`).
   - **결정론 유지**: 같은 dispatch를 같은 시점에 취소하면 항상 같은 결과. RNG 재실행 남용 불가.

4. 보물 발생 시 내용물(gold/iron/materials)은 **풀 그대로** 지급. "확률은 비례, 보상은 통째"가 직관적이고 dropTable 분할보다 단순.

**장점**:

- 평균 기대 보상이 시간에 정확히 비례 → 효율 동등 정체성 유지.
- 풀 완료/부분 종료의 정량적 차이 0 → 사용자 의사결정이 보상이 아닌 "지금 그만두고 싶은가"에만 의존.
- 코드 변경: `DispatchResult`에 `treasureRoll: number` 1필드 + `cancelDispatch`에서 4줄 재계산.

**참고 — 거부한 대안**:

- _진행 중에도 매 턴 굴리기_: 시작 시점 결정론 깨짐. 취소 타이밍 농락 여지.
- _보물 내용물도 비례 분할_: 보상이 누더기처럼 쪼개져 사용자가 "받은 게 보물이 맞나?" 헷갈림.

### 5.2.1 `totalKills > 0` 가드와의 상호작용

비례 적용 후 `partialKills`가 0이 되는 짧은 취소(예: progress=0.01에 floor(20×0.01)=0)에선 보물 미적중 처리. 시뮬상 자연스러움.

### 5.3 보스 동시 정산 차단

`state._resolving === true` (finalize 중)일 때 취소 버튼은 이미 숨겨져 있다(`ExploreTab.tsx:98`). 추가 검증 불필요.

### 5.4 사망 시점이 경과 시간 안에 있는 경우

`startDispatch`는 `diedEarly`면 `playbackSec = totalTurns`로 클램프해 자연 종료를 앞당긴다(`store.ts:518-520`). 즉 사망 턴 이후엔 dispatch가 자동 종료되어 취소 버튼이 사라진다. 별도 처리 불필요.

## 6. HP 처리

탐험 중 받은 데미지는 보상의 일부가 아니라 **상태 변화**다. 부분 보상을 받으면 그 시점까지의 HP 변화도 반영해야 사용자 체감이 일관된다.

옵션:

- **A. finalHp 비례 보간**: `finalHpAtCancel = lerp(startHp, finalHp, progress)`. 단순하지만 사망 직전 절벽 곡선엔 부정확.
- **B. log[elapsedTurn].playerHpAfter 사용**: `DispatchLogEntry`엔 이미 `playerHpAfter`가 있다(`types.ts:672-676`). 정확하고 추가 데이터 불필요.

**권장: B**. log 인덱스 = 턴 = 초이므로 `result.log[elapsedTurn]?.playerHpAfter ?? character.currentHp`로 한 줄 처리.

## 7. 코드 변경 항목

### 7.1 `src/lib/game/store.ts`

```ts
// 추가
const MIN_PARTIAL_SEC = 5;

const scaleDispatchResult = (
  result: DispatchResult,
  region: Region,
  elapsedSec: number,
  playbackSec: number,
): DispatchResult => {
  const p = Math.min(1, Math.max(0, elapsedSec / playbackSec));
  const partialKills = Math.floor(result.totalKills * p);

  // §5.2 — 비례 확률 재굴림 (treasureRoll은 startDispatch에서 저장된 값)
  let treasure: Treasure | null = null;
  let treasureGold = 0, treasureIron = 0;
  const treasureMats: Materials = {};
  if (
    partialKills > 0 &&
    region.treasure &&
    result.treasureRoll !== undefined &&
    result.treasureRoll < region.treasure.chance * p
  ) {
    treasure = region.treasure;
    treasureGold = treasure.gold ?? 0;
    treasureIron = treasure.iron ?? 0;
    if (treasure.materials) Object.assign(treasureMats, treasure.materials);
  }

  // 비례 분할은 "보물 제외" 자원에만 적용 — 보물은 위에서 통째로 더함
  const baseGold = (result.gained.gold ?? 0) - (result.treasure?.gold ?? 0);
  const baseIron = (result.gained.iron ?? 0) - (result.treasure?.iron ?? 0);
  const baseMats: Materials = { ...result.droppedMaterials };
  if (result.treasure?.materials) {
    for (const [k, v] of Object.entries(result.treasure.materials)) {
      baseMats[k as keyof Materials] = (baseMats[k as keyof Materials] ?? 0) - (v ?? 0);
    }
  }

  return {
    ...result,
    durationSec: elapsedSec,
    totalKills: partialKills,
    damageDealt: Math.floor(result.damageDealt * p),
    damageTaken: Math.floor(result.damageTaken * p),
    gained: {
      gold: Math.floor(baseGold * p) + treasureGold,
      iron: Math.floor(baseIron * p) + treasureIron,
    },
    exp: Math.floor(result.exp * p),
    droppedMaterials: mergeMaterials(
      Object.fromEntries(Object.entries(baseMats).map(([k, v]) => [k, Math.floor((v ?? 0) * p)])),
      treasureMats,
    ),
    treasure,
    finalHp: result.log[elapsedSec - 1]?.playerHpAfter ?? result.finalHp,  // §6
    diedEarly: false,
    kills: result.kills.map((k) => ({ ...k, count: Math.floor(k.count * p) })).filter((k) => k.count > 0),
  };
};

// cancelDispatch 교체
cancelDispatch: () => {
  const s = get();
  if (!s.dispatch || s._resolving) return;
  if (s.dispatch.isBoss) { set({ dispatch: null }); return; }   // §2.4
  const elapsedSec = Math.floor((Date.now() - s.dispatch.startedAt) / 1000);
  if (elapsedSec < MIN_PARTIAL_SEC || !s.dispatch.dispatchResult) {
    set({ dispatch: null });
    return;
  }
  const region = findRegion(s.dispatch.regionId)!;
  const partial = scaleDispatchResult(
    s.dispatch.dispatchResult,
    region,
    elapsedSec,
    s.dispatch.durationSec,
  );
  applyDispatchPartial(set, get, s, partial);                    // §7.2 정산 헬퍼
},
```

### 7.2 정산 로직 분리

`finalizeDispatch`의 **AI 리포트 이후 set() 블록**(`store.ts:634-724`)을 함수로 추출:

```ts
const applyDispatchPartial = (set, get, s, result: DispatchResult) => {
  const region = findRegion(s.dispatch!.regionId)!;
  // "조기 후퇴(취소)" 라벨로 LogEntry 생성
  const entry: LogEntry = {
    /* ...result..., report: `${region.name}에서 발길을 돌렸다.` */
  };
  // ...resources/materials/exp/character/guild/stats/lastBattles/claims 일괄 적용
  set({ dispatch: null, ...applied });
};
```

`finalizeDispatch`도 같은 헬퍼를 거치도록 리팩터 (중복 제거 + 향후 §3.B 승격 시 단일 진입점). 단, **AI 리포트는 finalize 경로에서만** 호출.

### 7.3 `src/app/tabs/ExploreTab.tsx`

취소 버튼 라벨 + 툴팁:

```tsx
<Tooltip content={state.dispatch.isBoss
  ? "보스 전투는 보상 없이 종료됩니다."
  : `현재까지 진행분(약 ${Math.round(progress * 100)}%) 보상을 받고 종료합니다. 보물은 비례 확률로 굴립니다.`}>
  <button onClick={state.cancelDispatch} ...>
    {state.dispatch.isBoss ? "취소" : "조기 종료"}
  </button>
</Tooltip>
```

`progress < MIN_PARTIAL_SEC / playbackSec`이면 "보상 없이 취소"로 라벨/툴팁 변경.

### 7.4 `src/lib/game/types.ts`

§5.2 비례 확률 재굴림을 위해 `DispatchResult`에 1필드 추가:

```ts
export type DispatchResult = {
  ...
  treasureRoll?: number;   // [0, 1) — startDispatch 시점의 Math.random() 결과. 취소 시 비례 확률과 비교.
};
```

§3.B 승격 시 `DispatchLogEntry`에 `cumGold/cumIron/cumExp/cumMaterials` 추가.

### 7.5 `src/lib/game/logic.ts` — `resolveDispatch`

보물 굴림 부분(`logic.ts:1248-1260`)을 두 단계로 분리:

```ts
// before
let treasure: Treasure | null = null;
if (totalKills > 0 && region.treasure && Math.random() < region.treasure.chance) {
  treasure = region.treasure;
  ...
}

// after
const treasureRoll = Math.random();
let treasure: Treasure | null = null;
if (totalKills > 0 && region.treasure && treasureRoll < region.treasure.chance) {
  treasure = region.treasure;
  ...
}
// return에 treasureRoll 포함
```

`finalizeDispatch`(풀 완료) 경로 행동 변화 0. 취소 경로에서만 `treasureRoll`을 사용.

### 7.6 `LogEntry` 표시 (`ExploreTab.tsx:228-281`)

`diedEarly === false` 이지만 `durationSec < 원래 duration` 인 경우를 식별하기 위한 플래그가 필요:

```ts
type LogEntry = {
  ...
  earlyExit?: "death" | "cancel";   // 신규: "cancel"이면 "조기 종료" 라벨
};
```

표시:

```tsx
{
  e.earlyExit === "cancel" ? "조기 종료" : e.diedEarly ? "조기 후퇴" : `${e.totalKills}킬`;
}
```

## 8. 테스트 시나리오

| #   | 시나리오                                        | 기대                                                           |
| --- | ----------------------------------------------- | -------------------------------------------------------------- |
| 1   | 28800초 탐험 4시간 후 취소                      | 보상 ≈ 50% (정수 floor 오차 ±n킬), HP는 4시간차 시뮬 값        |
| 2   | 60초 탐험 3초 후 취소                           | 보상 0 (MIN_PARTIAL_SEC 미달)                                  |
| 3   | 60초 탐험 30초 후 취소                          | 보상 ≈ 50%, 보물은 region.chance × 0.5 확률로 적중 (시드 동일) |
| 3b  | 1만 회 시뮬: 50% 취소 vs 100% 풀 평균 보물 골드 | ≈ 1:2 비율 (분산 ±5% 안)                                       |
| 4   | 보스 탐험 도중 취소                             | 보상 0, 쿨다운은 시작 시 적용된 그대로 (별도 변경 없음)        |
| 5   | 사망 직전 자동 종료된 dispatch — 취소 누름      | \_resolving=true이면 버튼 안 보임 / 외부 경로면 guard 차단     |
| 6   | 취소 후 동일 지역 재시작                        | 새 RNG로 신규 시뮬 (seed 분리 정상)                            |
| 7   | 길드 평판 보상                                  | 부분 킬 수만큼만 (`min(5, partialKills)`)                      |
| 8   | 업적/마일스톤                                   | `processClaims` 정상 트리거 (kills/gold 임계 도달 시)          |

자동화: `scripts/`에 `cancel-partial-sim.ts` 추가 — 1만 회 시드별 (28800초, 50% 취소) vs (28800초 풀) 평균/분산 비교. 비례 ±2% 안이면 OK.

## 9. 결정 항목 — 모두 마감

- [x] **§3.A 단순 비례 채택** — `scripts/cancel-partial-sim.ts`(RUNS=2000): progress=0.5 시 정확히 50% (오차 0.0%), 7200@1800 cancel = fresh 1800 × 0.852 (= 0.75/0.88 정확 일치). §3.B 정밀 분배 승격 불필요.
- [x] **`MIN_PARTIAL_SEC = 5` 유지** — 우발 클릭 보호용 임계값. 사용자 행동 데이터 부족이지만 5초는 합리적 기본값.
- [x] **보스 취소 부분 보상 제외** — 보스는 처치/실패 이분 보상이라 비례 분할 의미 없음. 디자인 결정 확정.
- [x] **길드 평판/업적 비례 적용** — `min(5, partialKills)` / `processClaims`로 partial 값 그대로 흐름. 풀 인정 시 cancel이 효율 우대 우회 경로가 되므로 비례 유지.
- [x] **`LogEntry.earlyExit` 신규 옵셔널 필드 채택** — `diedEarly` enum 확장보다 깔끔. Sky 색상 + "N킬 · 조기 종료" 라벨로 풀 완료/사망과 시각 구분.
- [x] **보물 처리 — doc 22 분당 굴림 슬라이싱으로 흡수** — `treasureRolls.slice(0, floor(elapsedSec/60))`이 자연스러운 시간 비례. §5.2 비례 확률 재굴림 안은 폐기 (doc 22 §7.1).

## 10. 출시 후 관찰

- 취소 빈도 (전체 탐험 중 %)
- 취소 시점 분포 (히스토그램: 0~25%, 25~50%, ...)
- 풀 완료 비율이 급락하면 §5.2(보물 페널티) 또는 추가 인센티브 검토
