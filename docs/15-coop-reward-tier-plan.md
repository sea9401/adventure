# 협동 보스 보상 티어제 개편안

> 관련 코드: `src/app/api/coop/route.ts` (claim 로직), `src/lib/game/data.ts` (`COOP_BOSSES`), `src/lib/game/types.ts` (`CoopBossDef`, `ActiveCoopBoss`)
>
> 상태: **제안 (구상 단계)**. 구현 전 의사결정 필요 항목은 마지막 절 참고.

## 1. 현재 시스템 요약

`claim` 액션 시점에 다음과 같이 정산.

```ts
const ratio = myDamage / totalDamage;
reward.gold = floor(def.rewardPool.gold * ratio);
reward.iron = floor(def.rewardPool.iron * ratio);
reward.materials[k] = floor(v * ratio);
```

- **풀(rewardPool)은 고정**. 기여자 수와 무관하게 합산 보상의 총량은 `rewardPool` 그대로.
- **기여자 간 제로섬**: A가 많이 때리면 B의 몫이 줄어듦.
- **약점**
  - 늦게 합류한 사람이 의미 있는 데미지를 넣어도 마지막에 큰손이 등장하면 비율이 깎임 → 합류 동기 약화.
  - "내 보상"을 미리 가늠하기 어려움 (다른 참여자 행동에 종속).
  - 보스 처치에 기여하는 행위 자체보다 "비율 점유율"이 중요해짐.

## 2. 개편 목표

> "일정 데미지를 넣을 때마다 보상 테이블이 좋아지는" 구조로 전환.

핵심 원칙:

1. **결정적 보상**: 내가 일정 임계치를 넘기면 그 티어의 보상이 확정. 다른 사람이 얼마나 때리든 내 보상은 줄지 않는다.
2. **누진 티어**: 더 때릴수록 더 좋은 보상 테이블이 열림. 상위 티어는 하위 티어를 포함하는 누적식.
3. **보스 HP 비율 기준**: 각 보스에 동일한 티어 곡선을 적용하기 위해, 임계치는 절대값이 아니라 보스 최대 HP 대비 % 로 정의.
4. **참여 진입장벽 유지**: 최소 티어 미달자는 보상 없음 (현재의 `myDamage <= 0` 가드를 % 기준으로 격상).

## 3. 티어 설계

### 3.1 임계치 (보스 HP 대비 누적 데미지 비율) — 모든 보스 공통

| 티어     | 임계치 (HP 비율) | 의미                  |
| -------- | ---------------- | --------------------- |
| `bronze` | 2%               | 참여 인정 — 보상 자격 |
| `silver` | 7%               | 안정적 기여자         |
| `gold`   | 15%              | 핵심 딜러             |
| `epic`   | 30%              | 주력 딜러             |
| `legend` | 50%              | 캐리                  |

- **세 보스(산군/그리폰/크라켄) 모두 동일한 임계치 적용**. 유저가 룰을 한 번만 외우면 됨.
- 한 보스에 동시에 5명이 모두 50%를 달성할 수는 없으므로 (총합 ≤ 100%) `legend`는 자연 희소.
- 반대로 10명이 각자 10%씩 때리면 모두 `silver`까지 달성 → 다인 파티가 보상 면에서 손해 보지 않는다.
- 데이터 모델은 보스별 차등을 허용하지만 (보스 정의 내 `thresholds`), 운영 단순화를 위해 v1은 공통 값으로 출시. 후반 보스 난이도 보정이 필요해지면 차등 적용 검토.

### 3.2 티어별 보상 (누적식 = 상위 티어는 하위 티어를 포함)

각 보스 정의에 `rewardTiers: Record<TierKey, TierReward>`를 두고, 플레이어는 **달성한 최고 티어까지의 합**을 받는다.

> 예: `gold` 도달 = `bronze + silver + gold` 보상을 모두 합산하여 지급.

#### 3.2.1 캘리브레이션 원칙 (인플레 최소화)

기존 풀 P 대비 각 티어의 **누적** 지급 비율을 다음과 같이 고정:

| 티어     | 누적 비율 | 증분 |
| -------- | --------- | ---- |
| `bronze` | 4%        | +4%  |
| `silver` | 13%       | +9%  |
| `gold`   | 25%       | +12% |
| `epic`   | 40%       | +15% |
| `legend` | 60%       | +20% |

> 누적 비율은 기존 풀(P) 대비 단일 플레이어가 받는 비율. 즉 legend 도달자 1명은 풀의 60%를 가져감.

**시나리오별 총 지급량 검증** (기존 풀 = 100%):

| 분배                   | 각자 도달 티어 | 총합             | vs 기존 |
| ---------------------- | -------------- | ---------------- | ------- |
| 솔로 100%              | legend         | 60%              | -40%    |
| 70 / 30                | legend / epic  | 60% + 40% = 100% | ±0%     |
| 50 / 50                | legend × 2     | 120%             | +20%    |
| 40 / 30 / 30           | epic × 3       | 120%             | +20%    |
| 20 / 20 / 20 / 20 / 20 | gold × 5       | 125%             | +25%    |
| 10 × 10명              | silver × 10    | 130%             | +30%    |

- 인플레 상한 ≈ **+30%**. "균등 다인 캐리" 시 약간의 협동 보너스를 주되, 폭주는 차단.
- 솔로 캐리는 의도적으로 손해 — 협동 보스의 정체성 유지.

#### 3.2.2 보스별 티어 보상 (증분 단위)

> 표의 각 셀은 **해당 티어 도달 시 추가로 지급되는 양**. 누적 보상 = 도달 티어까지의 합.

> **하향 적용**: bronze 외 silver/gold/epic/legend 보상은 절반으로 인플레이션 보정 (이전 풀 50k/100k/200k → 16k/32k/64k 합계). bronze는 첫 진입 보상 보호 차원에서 그대로 유지.

**산군** (현 풀 합계: gold 16,000 / iron 6,400 / mountain_lord_pelt 10 — 단일 legend 도달)

| 티어     | gold   | iron   | mountain_lord_pelt |
| -------- | ------ | ------ | ------------------ |
| `bronze` | 2,000  | 800    | 1                  |
| `silver` | +2,250 | +900   | +2                 |
| `gold`   | +3,000 | +1,200 | +2                 |
| `epic`   | +3,750 | +1,500 | +2                 |
| `legend` | +5,000 | +2,000 | +3                 |

**그리폰** (현 풀 합계: gold 32,000 / iron 9,600 / griffon_feather 10)

| 티어     | gold    | iron   | griffon_feather |
| -------- | ------- | ------ | --------------- |
| `bronze` | 4,000   | 1,200  | 1               |
| `silver` | +4,500  | +1,350 | +2              |
| `gold`   | +6,000  | +1,800 | +2              |
| `epic`   | +7,500  | +2,250 | +2              |
| `legend` | +10,000 | +3,000 | +3              |

**크라켄** (현 풀 합계: gold 64,000 / iron 19,200 / kraken_tentacle 10)

| 티어     | gold    | iron   | kraken_tentacle |
| -------- | ------- | ------ | --------------- |
| `bronze` | 8,000   | 2,400  | 1               |
| `silver` | +9,000  | +2,700 | +2              |
| `gold`   | +12,000 | +3,600 | +2              |
| `epic`   | +15,000 | +4,500 | +2              |
| `legend` | +20,000 | +6,000 | +3              |

### 3.3 마무리 보너스 (선택)

- **First Blood**: 첫 공격자 — 소량 (예: bronze gold의 50%).
- **Last Hit / MVP**: 처치 일격자 또는 누적 1위 — 한정 재화 (예: 보스 전용 토큰 1개) 1회 한정.

> v1에서는 **누진 티어만** 도입하고, 보너스는 v2 이후 검토.

## 4. 데이터 모델 변경

### 4.1 `CoopBossDef` (types.ts)

```ts
export type CoopRewardTier = "bronze" | "silver" | "gold" | "epic" | "legend";

export type CoopTierReward = {
  gold: number;
  iron: number;
  materials: Materials;
};

export type CoopBossDef = {
  // ... 기존 필드
  // rewardPool 제거하고:
  rewardTiers: {
    thresholds: Record<CoopRewardTier, number>; // HP 비율 (0~1)
    rewards: Record<CoopRewardTier, CoopTierReward>;
  };
};
```

`thresholds`는 보스별로 동일하게 두는 게 기본 (`{bronze:0.02, silver:0.07, gold:0.15, epic:0.30, legend:0.50}`). 보스 난이도에 따라 조정 여지를 위해 보스 정의 안에 둠.

### 4.2 `ActiveCoopBoss` — 변경 없음

`contributors[nickname].damage`만 있으면 충분. 티어는 claim 시점에 계산.

### 4.3 claim 응답

```ts
{
  boss: ActiveCoopBoss,
  reward: { gold, iron, materials },
  tier: CoopRewardTier,            // 달성 최고 티어
  damageRatio: number,             // myDamage / maxHp
}
```

UI에서 "🥇 GOLD 등급 보상" 같은 표기를 위해 티어 키를 노출.

## 5. 구현 변경 포인트

`src/app/api/coop/route.ts` claim 분기:

```ts
const myDamage = state.contributors[nickname]?.damage ?? 0;
const ratio = myDamage / state.maxHp; // ← 기존 totalDamage 기반에서 변경
const def = COOP_BOSSES[state.bossId];
const tier = highestTierReached(ratio, def.rewardTiers.thresholds);
if (!tier)
  return Response.json({ error: "최소 기여 미달 (HP의 2% 이상 데미지 필요)" }, { status: 403 });
const reward = sumTiersUpTo(tier, def.rewardTiers.rewards);
```

부수 작업:

- `data.ts`의 `COOP_BOSSES` 3종 모두 `rewardPool` → `rewardTiers`로 마이그레이션.
- 클라이언트(`CoopBossPanel`)에 현재 내 누적 데미지 → 다음 티어까지 남은 % 진행도 노출.
- `docs/05-content.md`, `docs/08-balance-reference.md`의 협동 보스 보상 표 갱신.

## 6. 결정 사항 / 남은 검토 항목

### 결정됨

1. **인플레 허용 범위: 최소** — §3.2.1의 캘리브레이션으로 상한 +30%로 묶음. 솔로는 -40% 손해.
2. **임계치: 모든 보스 공통** — `{0.02, 0.07, 0.15, 0.30, 0.50}`. 데이터 모델은 보스별 차등을 허용하지만 v1에서는 사용하지 않음.
3. **소환자 우대: 없음** — 소환자 별도 보너스 미적용. 소환자도 동일한 티어 룰 적용.
4. **티어 확정 시점: claim 시점** — 보스 처치 후 데미지 추가 누적 없음.
5. **기여 데미지: `contributors[].damage` 그대로 사용** — 오버킬은 `applied`에서 이미 컷됨.
6. **legend 다중 수령: 자연 제한** — 누적 합 ≤ 100%이므로 한 명이 legend 받으면 나머지는 epic 이하로 자동 제한.

### 남은 검토

- **마무리 보너스(First Blood / Last Hit / MVP)**: v2 이후 검토. v1은 누진 티어만.
- **데미지 누적이 100%를 초과하는 경우**: 이론상 발생하지 않지만(applied 컷), 방어적으로 `min(myDamage / maxHp, 1.0)`로 클램프 권장.

## 7. 마이그레이션 / 호환성

- KV에 저장된 진행 중 세션은 `rewardPool`을 참조하지 않음 (claim 시점에 `COOP_BOSSES`를 다시 조회). 따라서 배포 즉시 신규 티어제로 정산되어도 안전.
- 단, 배포 직전에 처치된 보스가 KV에 남아 있다면 기존 비율식으로 받을 거라 예상한 유저가 새 산식으로 받게 됨 → **배포 시 KV의 `coop:sessions` 정리 또는 공지** 필요.
