# 22. 보물 드랍 — 길이별 격차 해소

> **상태**: 적용 완료 (분당 1회 독립 굴림, 페이아웃은 finalMult로 효율 곡선 자동 적용)
> **관련 코드**: `src/lib/game/logic.ts:1248-1260` (treasure 굴림), `src/lib/game/data.ts:2184-2192` (`DISPATCH_DURATIONS`, `DISPATCH_REWARD_MULT`), `src/lib/game/types.ts:617-623` (`Treasure`)
> **연관 문서**: `18-cancel-partial-reward-plan.md` §3·§5.2 (취소 시 보물 처리)

## 1. 현재 비율과 문제

`logic.ts:1248`은 dispatch 종료 직전 **dispatch당 1회** 보물을 굴린다. 굴림 확률은 `region.treasure.chance` 한 값으로 모든 길이에 동일.

`DISPATCH_REWARD_MULT`는 gold/iron/exp에만 적용되고 **보물 굴림 자체에는 적용되지 않는다**. 다만 보물의 `gold/iron` 페이아웃은 finalMult로 한 번 곱해진다(`logic.ts:1268-1269`).

평원(`chance: 5%, gold: 100, materials: { slime_jelly: 3 }`) 기준 1초당 기대 보물 골드:

| 길이   | 효율 (per-kill) | 보물 chance |  보물 gold | 1초당 기대 보물 골드 |
| ------ | --------------: | ----------: | ---------: | -------------------: |
| 60초   |            1.00 |          5% | 100 × 1.00 |           **0.0833** |
| 1800초 |            0.88 |          5% | 100 × 0.88 |              0.00244 |
| 7200초 |            0.75 |          5% | 100 × 0.75 |              0.00052 |

→ 60초 : 7200초 **≈ 160 : 1**.

per-kill 자원의 효율 곡선(1.00 / 0.88 / 0.75 = 60초 : 7200초 ≈ **1.33 : 1**)과 비교하면 보물만 **120배 더 가파른 곡선**이다. 즉 *활성 플레이 우대*라는 의도는 살아 있으나, 보물에 한해서만 의도와 무관하게 과한 페널티가 붙어 있다.

## 2. 설계 목표

> **목표 곡선**: 보물 효율도 per-kill 효율과 **같은 비율** — 60초 : 1800초 : 7200초 = 1.00 : 0.88 : 0.75.

근거:

- 활성 플레이 우대(60초 풀 운용이 7200초 풀 운용보다 ~33% 유리)는 유지.
- 그러나 _추가로 120x_ 가산되는 비대칭은 디자인 의도가 아닌 구현 상의 우연.
- 보물도 자원의 일부 — 효율 우대 곡선의 일관성을 보물에 동등 적용.

**비목표**: 보물 효율을 per-kill보다 더 평탄하게(혹은 더 가파르게) 만드는 것. 본 문서는 보물 곡선을 per-kill 곡선에 **맞추는 것**만 다룬다.

## 3. 모델 비교

### 3.A 분당 1회 굴림 + 길이별 chance 가중치 — 권장

```
rolls = max(1, floor(durationSec / 60))
perRollChance = region.treasure.chance × DISPATCH_REWARD_MULT[durationSec]
treasureCount = sum of 1 for each independent roll < perRollChance
```

평원 5% 기준 dispatch당 기대 보물 수:

- 60초 (1굴림 × 5% × 1.00) = **0.050**
- 1800초 (30굴림 × 5% × 0.88) = 30 × 0.044 = **1.320**
- 7200초 (120굴림 × 5% × 0.75) = 120 × 0.0375 = **4.500**

1초당 기대 보물 수:

- 60초: 0.050 / 60 = 8.33×10⁻⁴
- 1800초: 1.320 / 1800 = 7.33×10⁻⁴
- 7200초: 4.500 / 7200 = 6.25×10⁻⁴

→ 비율 1.00 : 0.88 : 0.75 ✓ (per-kill 효율과 정확히 동일)

**장점**:

- per-kill 효율 곡선이 그대로 보물에 이식 — 단일 진리원.
- 굴림 단위가 "분"이라 §18(취소)와 자연 호환: cancel 시 `floor(elapsedSec / 60)`만큼만 굴림이 유효.
- `region.treasure.chance` 값 **그대로 보존** — 데이터 마이그레이션 0. 의미만 "분당 굴림 확률 (DISPATCH_REWARD_MULT 적용 전)"로 재정의.

**단점**:

- 한 dispatch에서 보물이 여러 번 적중할 수 있어 `Treasure | null` → `Treasure & { count }` 구조 변경 필요.

### 3.B per-kill 굴림

매 적 처치 시 작은 확률로 굴림 (`enemy.drop`처럼). 처치 수에 비례.

**장점**: 기존 드랍 루프(`logic.ts:1141-1151`)에 자연 통합. 코드 가장 작음.
**단점**: 길이가 같아도 *지역별 처치 속도*에 따라 보물 효율이 달라짐 (강한 적이 많은 지역 = 처치 적음 = 보물 적음). 이건 의도 외 비대칭.

### 3.C 분당 1회 굴림 + chance 무가중치 (완전 균등)

```
rolls = floor(durationSec / 60)
perRollChance = region.treasure.chance   // DISPATCH_REWARD_MULT 미적용
```

→ 1초당 기대값 60초 : 7200초 = **1 : 1** (완전 평탄).

**거부 이유**: per-kill 자원과 효율 곡선이 어긋남(per-kill은 0.75배 페널티, 보물은 0배 페널티 = 7200초가 보물에서만 우대 받음). 일관성 위반.

### 3.D 가중치 lookup table

`DISPATCH_TREASURE_ROLLS: Record<DispatchDuration, number>` 같은 별도 테이블로 굴림 횟수를 자유 정의.

**거부 이유**: 새로운 튜닝 다이얼 추가 → DISPATCH_REWARD_MULT와 *항상 같은 비율*을 손으로 유지해야 함. 휴먼 에러 위험. 3.A처럼 단일 진리원에서 파생하는 게 안전.

## 4. 권장안 상세 — 3.A

### 4.1 굴림 단위는 왜 60초인가?

- 가장 짧은 duration이 60초 → "1 dispatch = 1 굴림"이라는 기존 의미가 60초에선 그대로 유지.
- 굴림 단위가 작을수록 분산 감소. 60초 단위는 7200초에서 120 시행 → 보물 0개 확률 ≈ (1−0.0375)¹²⁰ ≈ 1.0% (사실상 보장).
- 굴림 단위 변경(30초/120초)은 평균 기대값엔 영향 없고 분산만 변동 — UX상 선호되는 단위 선택만 남음. 60초가 정수 떨어짐 + 분당 로그라는 직관에 가장 잘 맞음.

### 4.2 보물 페이아웃 처리

`region.treasure`의 `gold/iron/materials`는 **굴림당 1세트** 지급. 즉 7200초에서 보물 3회 적중 시 `gold × 3, materials × 3`.

`gained.gold`에 합산 후 `finalMult`(=guildMult × DISPATCH_REWARD_MULT × TEST_REWARD_MULT)가 한 번 곱해지는 기존 로직(`logic.ts:1262-1269`)을 그대로 둔다 — 단, **DISPATCH_REWARD_MULT는 chance에 한 번만 반영**해야 한다 (§4.3 주의사항).

### 4.3 페널티 이중 적용 방지

`finalMult`는 이미 `DISPATCH_REWARD_MULT[durationSec]`을 포함한다. 따라서 보물 gold/iron이 페이아웃 단계에서 한 번 더 0.75배 되면 `chance × 0.75 × payout × 0.75 = 0.5625x` 의도치 않은 이중 페널티.

**해법 두 가지**:

- **A. 페이아웃은 "원시 통째"로** — 보물 gold를 `gained.gold`에 더한 후 finalMult 적용 = 결과적으로 보물도 페이아웃 페널티를 받음. chance에는 0.75 미적용.
  - 효율 곡선 비율: 60초 : 7200초 = (1.0 × 1.0) : (1.0 × 0.75) = 1 : 0.75 ✓
  - chance 가중치 불필요 — 굴림 횟수만 시간 비례.
- **B. 페이아웃은 finalMult에서 분리** — 보물 gold는 finalMult를 거치지 않음. chance에 0.75 적용.
  - 효율 곡선 비율: 60초 : 7200초 = (1.0 × 1.0) : (0.75 × 1.0) = 1 : 0.75 ✓

**채택: A**. 코드 변경이 더 작다 (현재 보물 gold가 이미 `gained.gold`에 더해지고 있음 — 단지 chance 굴림 횟수만 분당으로 늘리면 됨).

A 채택 시 §3.A 표 재계산:

```
rolls = max(1, floor(durationSec / 60))
perRollChance = region.treasure.chance   // 그대로
페이아웃 = treasure.gold × finalMult     // 기존 로직 유지
```

평원 5% 1초당 기대 골드:

- 60초: (1굴림 × 5%) × 100 × 1.00 / 60 = **0.0833**
- 1800초: (30굴림 × 5%) × 100 × 0.88 / 1800 = 1.5 × 100 × 0.88 / 1800 = **0.0733**
- 7200초: (120굴림 × 5%) × 100 × 0.75 / 7200 = 6.0 × 100 × 0.75 / 7200 = **0.0625**

비율 1.00 : 0.88 : 0.75 ✓

→ 결국 §4.3.A가 가장 깔끔: **chance 가중치는 빼고 굴림 횟수만 분당으로 늘린다.** finalMult가 페이아웃에 자연스럽게 효율 곡선을 입힌다.

### 4.4 1초당 기대 보물 — 최종 비교표

평원(chance 5%, gold 100, materials slime_jelly×3) 기준:

| 길이   | 굴림수 | 1회 chance | 기대 적중 | 페이아웃 mult | 1초당 기대 골드 | vs 60초 |
| ------ | -----: | ---------: | --------: | ------------: | --------------: | ------: |
| 60초   |      1 |         5% |      0.05 |          1.00 |          0.0833 |   1.00× |
| 1800초 |     30 |         5% |      1.50 |          0.88 |          0.0733 |   0.88× |
| 7200초 |    120 |         5% |      6.00 |          0.75 |          0.0625 |   0.75× |

기존 시스템 대비 1초당 기대값:

| 길이   |    기존 |   신규 |          변화 |
| ------ | ------: | -----: | ------------: |
| 60초   |  0.0833 | 0.0833 | **변화 없음** |
| 1800초 | 0.00244 | 0.0733 |    **30배 ↑** |
| 7200초 | 0.00052 | 0.0625 |   **120배 ↑** |

→ 60초 절대값은 보존, 길이가 길수록 보물이 자연스럽게 누적되는 구조.

## 5. 데이터 변경

### 5.1 `region.treasure.chance` — 변경 없음

기존 모든 지역의 `chance` 값을 그대로 보존. 의미만 "**dispatch당** 1회 굴림" → "**60초당** 1회 굴림"으로 재정의. 60초 dispatch에선 동일 동작.

### 5.2 신규 상수

```ts
// src/lib/game/data.ts
export const TREASURE_ROLL_PERIOD_SEC = 60; // 분당 1회 굴림
```

상수 분리 이유: 향후 30초/120초 등으로 단위 튜닝 시 한 곳만 수정.

## 6. UX 변경

### 6.1 `Treasure` 타입 — count 필드 추가

```ts
export type Treasure = {
  name: string;
  chance: number; // (의미 재정의: 60초당 굴림 확률)
  gold?: number; // 1회 적중 시 페이아웃
  iron?: number;
  materials?: Materials;
};
```

`DispatchResult.treasure`는 단일 `Treasure | null` 대신:

```ts
treasure: Treasure | null; // 1회 이상 적중 시 region.treasure
treasureHits: number; // 적중 횟수 (0이면 treasure=null)
```

### 6.2 LogEntry 표시 (`ExploreTab.tsx:263-267`)

```tsx
{
  e.treasure && (
    <p className="text-xs text-amber-400 mt-1">
      ★ {e.treasure.name} 발견!
      {e.treasureHits > 1 && <span className="ml-1 text-amber-300">×{e.treasureHits}</span>}{" "}
      {formatTreasure(e.treasure, e.treasureHits)}
    </p>
  );
}
```

`formatTreasure` 시그니처는 `(treasure, hits)`로 확장: gold/iron/materials를 `× hits`로 곱해 출력.

### 6.3 분당 보물 알림은 **표시 안 함**

7200초 dispatch에서 분당 토스트가 뜨면 도배. 정산 시점(finalize/cancel)에 누적 hits만 한 번에 표시.

## 7. §18 (취소 부분 보상)과의 통합

### 7.1 단순화 — §18 §5.2 폐기

§18 §5.2 "비례 확률 재굴림"은 보물이 dispatch당 1회 굴림이라는 전제에서 만들어진 회피책. 본 안 적용 후엔:

```
취소 시 elapsedSec 기준 → 굴림 횟수 = max(1, floor(elapsedSec / 60))
페이아웃 = treasureHitsAtElapsed × treasure.gold × finalMult
```

자연스럽게 시간 비례. 별도 `treasureRoll` 시드 저장 불필요.

### 7.2 결정론 유지

`startDispatch` 시점에 굴림 결과를 배열로 저장:

```ts
// DispatchResult 신규
treasureRolls: number[];   // 길이 = floor(durationSec / 60), 각 [0, 1)
```

cancel 시 `treasureRolls.slice(0, floor(elapsedSec / 60))`만 사용. 같은 dispatch 같은 시점 cancel = 항상 같은 결과.

### 7.3 §18 코드 변경 영향

§18 §7.1 `scaleDispatchResult`의 보물 처리 블록(현재 ~25줄):

```ts
// before
if (
  partialKills > 0 &&
  region.treasure &&
  result.treasureRoll !== undefined &&
  result.treasureRoll < region.treasure.chance * p
) { ... }

// after
const elapsedRolls = Math.floor(elapsedSec / TREASURE_ROLL_PERIOD_SEC);
const partialHits = result.treasureRolls
  .slice(0, elapsedRolls)
  .filter((r) => r < region.treasure!.chance).length;
const treasure = partialHits > 0 ? region.treasure! : null;
const treasureGold = partialHits * (treasure?.gold ?? 0);
// ...
```

§18은 본 안에 의존 — 도입 순서: **22 먼저, 18 나중**. 또는 동일 PR.

## 8. 코드 변경 요약

### 8.1 `src/lib/game/logic.ts:1248-1260`

```ts
// before
let treasure: Treasure | null = null;
if (totalKills > 0 && region.treasure && Math.random() < region.treasure.chance) {
  treasure = region.treasure;
  if (treasure.gold) gained.gold = (gained.gold ?? 0) + treasure.gold;
  if (treasure.iron) gained.iron = (gained.iron ?? 0) + treasure.iron;
  if (treasure.materials) {
    for (const [k, v] of Object.entries(treasure.materials)) {
      droppedMaterials[k as keyof Materials] =
        (droppedMaterials[k as keyof Materials] ?? 0) + (v ?? 0);
    }
  }
}

// after
const treasureRolls: number[] = [];
let treasureHits = 0;
if (totalKills > 0 && region.treasure) {
  const rollCount = Math.max(1, Math.floor(durationSec / TREASURE_ROLL_PERIOD_SEC));
  for (let i = 0; i < rollCount; i++) {
    const r = Math.random();
    treasureRolls.push(r);
    if (r < region.treasure.chance) treasureHits++;
  }
  if (treasureHits > 0) {
    const t = region.treasure;
    if (t.gold) gained.gold = (gained.gold ?? 0) + t.gold * treasureHits;
    if (t.iron) gained.iron = (gained.iron ?? 0) + t.iron * treasureHits;
    if (t.materials) {
      for (const [k, v] of Object.entries(t.materials)) {
        droppedMaterials[k as keyof Materials] =
          (droppedMaterials[k as keyof Materials] ?? 0) + (v ?? 0) * treasureHits;
      }
    }
  }
}
const treasure = treasureHits > 0 ? region.treasure! : null;
```

`return`에 `treasureRolls, treasureHits` 추가.

### 8.2 `src/lib/game/types.ts`

- `DispatchResult` — `treasureHits: number`, `treasureRolls: number[]` 추가.
- `LogEntry` — `treasureHits?: number` (1회만 적중 시 생략 가능).

### 8.3 `src/components/game/LogStream.tsx` / `src/lib/format.ts`

`formatTreasure(treasure, hits)`로 시그니처 확장. hits 곱셈 처리.

### 8.4 `src/app/tabs/ExploreTab.tsx:263-267`

§6.2 적용.

### 8.5 보스 탐험 — 변경 없음

`resolveBossDispatch`에는 `region.treasure` 굴림이 없다(`logic.ts:2125+` 별도 보스 드랍 테이블). 본 안 영향 0.

## 9. 데이터 영향 — 기대값 비교

지역별 8시간 활성 플레이 기준 기대 보물 수 (60초 × 480회 vs 7200초 × 4회):

| 지역        | chance | 60초 × 480 (기대 hits) | 7200초 × 4 (기대 hits) | 비율 |
| ----------- | -----: | ---------------------: | ---------------------: | ---: |
| 평원        |     5% |                   24.0 |                   24.0 | 1.00 |
| 외곽 숲     |     4% |                   19.2 |                   19.2 | 1.00 |
| 광산        |     4% |                   19.2 |                   19.2 | 1.00 |
| 폐허        |     3% |                   14.4 |                   14.4 | 1.00 |
| 사막        |     3% |                   14.4 |                   14.4 | 1.00 |
| 설원        |     2% |                    9.6 |                    9.6 | 1.00 |
| 해적 정박지 |     4% |                   19.2 |                   19.2 | 1.00 |
| 유령선      |     3% |                   14.4 |                   14.4 | 1.00 |
| 균열        |     3% |                   14.4 |                   14.4 | 1.00 |
| 공허        |   2.5% |                   12.0 |                   12.0 | 1.00 |
| 심연        |     2% |                    9.6 |                    9.6 | 1.00 |

→ **per-kill 효율 곡선과 동일하게 60초가 33% 우대**(1.0 / 0.75)되지만, 절대 효율 차이는 **120x → 1.33x로 90배 완화**.

## 10. 인플레이션 — 실측 (`scripts/treasure-rate-sim.ts` RUNS=5000)

> 현재 `DISPATCH_DURATIONS = [60, 1800, 7200]` 기준. 8시간 풀 운용 = 60초 × 480회 / 1800초 × 16회 / 7200초 × 4회.

평원(chance 5%, treasure.gold 100, drops.gold [3,8]) 8시간 환산 — TEST_REWARD_MULT=1, guildRep=0:

| 활성도             | dispatch 횟수 | 보물 적중 | 보물 골드(post-mult) | 1초당 보물 골드 |
| ------------------ | ------------: | --------: | -------------------: | --------------: |
| 60초 × 480 (활성)  |           480 |        24 |            **2,400** |          0.0833 |
| 1800초 × 16 (중간) |            16 |        24 |            **2,112** |          0.0733 |
| 7200초 × 4 (방치)  |             4 |        24 |            **1,800** |          0.0625 |

→ 어느 활성도에서도 보물 **적중 횟수는 24회로 동일** (분당 1회 굴림 보장). 차이는 페이아웃에 입혀지는 `DISPATCH_REWARD_MULT` 곡선뿐 (1.00 / 0.88 / 0.75).

평원 1초당 일반 자원 골드 ≈ 0.84 (sim 추정, 7200초 dispatch 기준). 보물 비중 평원 ~7%, 후반 지역(심연 등)에선 보물 페이아웃이 25,000 단위라 비중 20~30%로 상승하지만 일반 자원 우세는 유지.

**기존 시스템 대비**:

- 60초 풀 운용파: 변화 없음 (이미 분당 1굴림 = 24회/8h)
- 7200초 방치파: 4회 → 24회 (6× 증가). 의도 — 방치 효율을 활성에 근접시키는 본 안의 핵심.

→ 신규 자원 발생량은 _방치파_ 만 늘어나며, 활성파 기대값은 그대로. **가속 인플레이션 없음**. 검증 PASS: §11.

## 11. 테스트 시나리오

| #   | 시나리오                          | 기대                                                                         |
| --- | --------------------------------- | ---------------------------------------------------------------------------- |
| 1   | 60초 dispatch 풀 완료             | 5% 확률로 1회 적중 (기존과 동일)                                             |
| 2   | 7200초 dispatch 풀 완료           | 6회 평균, 0회는 (1−0.05)¹²⁰ ≈ 0.2% 확률                                      |
| 3   | 1만 회 7200초 시뮬 평균 보물 골드 | 6.0 × 100 × 0.75 = **450 ±5%** (분산 검증)                                   |
| 4   | 7200초 dispatch 1800초 후 cancel  | 30회 굴림만 유효 → 기대 hits 1.5                                             |
| 5   | totalKills = 0 dispatch           | 보물 hits 0 (가드 유지)                                                      |
| 6   | 60초 dispatch 30초 후 cancel      | `floor(30/60) = 0` → max(1, 0) = 1로 보정? 아니면 0으로 보상 0? — §11.1 결정 |

### 11.1 `floor(elapsedSec / 60) = 0` 처리

- **옵션 A**: 0굴림. cancel 30초 = 보물 0%. 단순.
- **옵션 B**: 비례 확률 굴림 (`chance × elapsedSec / 60`). 60초 미만 cancel에도 부분 보물 가능.

**채택: A**. 1분 단위 굴림이 모델의 정의. 30초 cancel은 굴림 시점 도달 X. UX상 "보물은 1분 단위"라 명시. MIN_PARTIAL_SEC=5는 일반 자원에만 적용.

자동화: `scripts/treasure-rate-sim.ts` 추가 — 지역별/길이별 1만 회 시뮬, 기대값 ±2% 검증.

## 12. 결정 항목 — 모두 마감

- [x] **§3.A 단순 + §4.3.A finalMult 페이아웃 채택** — `treasure-rate-sim.ts`(RUNS=5000): 1초당 보물 골드 비율이 1.00:0.88:0.75에 ±2% 수렴 (1800/7200초). 곡선 일치 검증 PASS.
- [x] **`TREASURE_ROLL_PERIOD_SEC = 60` 유지** — sim 분산 적정. "분당"이 직관적이며 30/120초로 변경해도 평균값엔 영향 없음 (분산만 변동).
- [x] **§11.1 옵션 A 채택** — `floor(elapsedSec/60) = 0` → 0굴림. cancel 30초 = 보물 0%. 1분 단위 굴림 모델의 정의에 부합. MIN_PARTIAL_SEC=5는 일반 자원에만 적용.
- [x] **22 선행 + 18 후행** — 실제 commit 순서: `4868f8a`(22) → `b767367`(18). doc 22의 `treasureRolls` 배열이 doc 18 cancel 슬라이싱에 자연 흡수됨.
- [x] **단일 "×N" 배지 채택** — `formatTreasure(t, hits)` 시그니처로 곱셈 표시. `LogEntry`에 `treasureHits?: number`로 1회 적중 시 생략 가능. 줄 분리는 도배 위험 — 거부.
