# 물약 시스템 (Potion System) 기획

> 소비 아이템(물약)을 도입하고, **자동 전투 중에도 규칙에 따라 자동 사용**되도록 하는 기능.

---

## 목표 / 비목표

### 목표
- HP/MP 회복형 소비 아이템을 인벤토리에 보유 → 전투/필드에서 사용
- **수동 전투**: 전투 화면의 "사용" 버튼으로 즉시 사용
- **자동 전투**: 사전에 등록한 규칙(예: HP 30% 이하 → 회복 물약)에 따라 자동 사용
- 마을 상인(잡화상 보로)에서 구매로 획득

### 비목표 (이번 라운드 X)
- 버프/디버프 물약 — 1차는 회복류(HP/MP)만
- 제작(연금술) — 모델은 확장 가능하게 두되 구현은 추후
- 슬롯 제한·무게 시스템

---

## 데이터 모델

### 물약 정의 (정적)

```ts
// src/adventure/data/potions.ts
export type PotionId =
  | "potion_heal_s"   // 작은 회복약
  | "potion_heal_m"   // 회복약
  | "potion_mana_s";  // 작은 마나약

export type PotionEffect =
  | { kind: "heal_hp"; flat?: number; pct?: number }
  | { kind: "heal_mp"; flat?: number; pct?: number };

export type Potion = {
  id: PotionId;
  name: string;
  description: string;
  effect: PotionEffect;
  price: number;     // 잡화상 판매가
  icon?: string;     // /images/items/*.png
};

export const POTIONS: Record<PotionId, Potion> = { ... };
```

> `flat`과 `pct` 둘 다 주면 `flat + maxHp * pct` 합산. 둘 다 없으면 1회복(엣지). MP도 동일 패턴.

### 인벤토리 (보유 수량)

```ts
// localStorage key: "inventory.v1"
type InventoryState = {
  potions: Partial<Record<PotionId, number>>;
};
```

— 현재 장비 시스템은 캐릭터 객체에 `equipped`만 있고 "보유 아이템" 개념이 없음. **이번 작업으로 처음 도입**.
— 훅 `useInventory()` — 추가/감산/카운트 헬퍼 + localStorage 영속화 (기존 `useAdventureLog`/`useQuests` 패턴 재사용).

### 자동 사용 규칙

```ts
// localStorage key: "auto-potion-rules.v1"
type AutoUseTrigger =
  | { kind: "hp_below_pct"; pct: number }   // ex) 30
  | { kind: "mp_below_pct"; pct: number };

type AutoPotionRule = {
  enabled: boolean;
  potionId: PotionId;
  trigger: AutoUseTrigger;
};

type AutoPotionConfig = {
  rules: AutoPotionRule[];      // 위에서부터 우선순위
};
```

— 우선순위는 배열 순서. 첫 매칭 규칙이 발동하면 그 턴에는 다른 규칙은 평가하지 않음.
— **자동 전투 OFF인 경우엔 규칙은 무시**(수동 전투에는 영향 없음).

---

## 초기 물약 라인업 (1차 PR 범위)

| ID | 이름 | 효과 | 가격 |
|---|---|---|---|
| `potion_heal_s` | 작은 회복약 | HP +20 | 12 G |
| `potion_heal_m` | 회복약 | HP +50% | 40 G |
| `potion_mana_s` | 작은 마나약 | MP +15 | 20 G |

> 수치/가격은 초벌. 잡화상 보로 NPC에 상점 UI 붙이는 작업과 함께 밸런싱.

---

## 전투 엔진 통합

현재 `advanceTurn`은 phase가 `player`일 때 자동으로 공격하고 `enemy` phase로 넘어감. 물약은 **공격을 대체하는 행동(action)** 으로 모델링한다.

### 행동 타입 도입

```ts
// engine.ts
type PlayerAction =
  | { kind: "attack" }
  | { kind: "use_potion"; potionId: PotionId };
```

`advanceTurn`에 `intendedAction?: PlayerAction` 인자 추가. 기본값은 `{ kind: "attack" }`.

- `use_potion`: 그 턴에는 공격 대신 물약 사용. 효과 적용 후 phase = `enemy`.
- 회복 후에도 `playerHp <= 0`이면 사망 처리(엣지).

### 자동 사용 결정자 (selector)

```ts
function pickAutoAction(
  state: BattleState,
  player: PlayerCombat,
  inventory: InventoryState,
  config: AutoPotionConfig,
): PlayerAction {
  for (const rule of config.rules) {
    if (!rule.enabled) continue;
    if ((inventory.potions[rule.potionId] ?? 0) <= 0) continue;
    if (matchesTrigger(state, player, rule.trigger)) {
      return { kind: "use_potion", potionId: rule.potionId };
    }
  }
  return { kind: "attack" };
}
```

- `useBattle` 턴 루프 안에서 `phase === "player"` 일 때:
  - `autoBattle === true`면 `pickAutoAction`을 호출해 결과를 `advanceTurn`에 주입
  - `autoBattle === false`면 사용자가 명시적으로 "공격" 또는 "사용" 버튼을 누를 때까지 대기 (= 다음 단계: 수동 전투의 행동 입력)

### 수동 전투 (이번 작업의 부수 변경)

- 자동 진행 → **턴 단위 사용자 입력 대기**로 전환 필요. 현재 `useBattle`은 자동 루프이므로, `autoBattle === false`일 때는 player phase에서 멈추고 사용자 액션을 기다리는 형태로 분기.
- "사용" 버튼은 `BattleScene`에서 모달/드롭다운으로 보유 물약 노출 → 선택 시 `act({ kind: "use_potion", potionId })` 호출.

> 자동 전투의 자동 사용만이 **이 PR의 핵심**. 수동 사용 UI는 같은 엔진 위에 얹히는 단순 추가 작업이라 함께 작업하는 것이 자연스러움.

### 인벤토리 차감 책임

- 사용 결정은 selector / engine, 실제 보유 수량 차감은 **호출 측(useBattle 또는 BattleView)** 이 담당.
- 엔진은 순수 함수 유지 — 사이드이펙트 없음.

---

## UI 변경

### 1. 가방(인벤토리) 서브뷰 — 캐릭터 탭

- 캐릭터 탭에 "가방" 진입 카드 추가 (모험의 서/스킬과 동일 톤).
- 1차에는 물약만 — 이름, 설명, 보유 개수, 사용 버튼(필드 사용은 보류 / 비활성).

### 2. 자동 사용 규칙 설정 — 가방 또는 별도 서브뷰

- 규칙 행: `[ ] 작은 회복약  HP < [30]%일 때 사용`
- 추가/삭제 버튼, 위/아래 우선순위 이동.
- 토글 + 수치 슬라이더(또는 input).

### 3. 전투 화면 (BattleScene)

- 자동 전투 ON: 물약 자동 사용 시 로그에 `info` 종류로 기록 (`작은 회복약을 마셨다 (+20 HP)`).
- 자동 전투 OFF: 하단에 `공격` / `물약 사용 ▾` 버튼 (위 "수동 전투" 항목과 함께).

### 4. 잡화상 보로 — 상점 UI

- 마을 NPC `diola_merchant` (또는 시작 마을에 신규 상인을 둘지 결정 필요)에 상점 진입 추가.
- 가격, 보유 골드, 수량 입력. 구매 → `inventory.add(potionId, n)` + 골드 차감.

> 상점 UI는 분리해도 되지만, **물약을 살 수 없으면 시스템 검증이 안 되므로** 같이 묶는 편을 권장.

---

## 마일스톤 분할 (PR 단위 후보)

1. **PR 1 — 데이터/저장 토대**: `potions.ts`, `useInventory`, 가방 서브뷰(보유만 표시).
2. **PR 2 — 잡화상 상점**: 보로 NPC에 구매 UI, 골드 차감.
3. **PR 3 — 전투 엔진 행동 추상화**: `PlayerAction` 도입, `advanceTurn`에 `use_potion` 분기, 수동 전투 입력 대기 분기.
4. **PR 4 — 자동 사용 규칙 + 설정 UI**: `AutoPotionConfig`, selector, 설정 화면.
5. **PR 5 — 다듬기**: 로그 메시지, 토스트 알림(`item_used` 새 종류?), 도감(아이템 탭) 연동.

---

## 도감 연동 (모험의 서)

- `AdventureLogView`의 `items` 탭이 현재 placeholder. 인벤토리에 들어온 적 있는 물약 ID를 `log.items`로 누적 → 도감 카드 노출.
- 트리거: `useInventory.add()` 호출 시 첫 획득이면 `log.markItemSeen(id)`.

(별도 PR이어도 무방)

---

## 미해결 질문

- 자동 사용에 **턴 쿨다운**(예: "물약은 3턴에 한 번")을 둘지? — 1차는 무제한, 보유량으로만 자연스럽게 제한하는 게 단순.
- 패배 시점에 회복 물약 발동 우선순위 — `playerHp` 이미 0이 된 직후의 enemy phase 직전이라면, "죽기 직전 자동 회복"이 작동하도록 **enemy phase 결과 직전이 아니라 다음 player phase 시작 시점**에서 평가해야 자연스러움 (현재 설계가 그렇게 되어있는지 검증 필요).
- HP가 이미 가득 찬 상태에서 규칙이 발동하지 않도록 — `heal_hp` trigger는 `hp < maxHp` 추가 가드.
- 마나 시스템이 아직 전투에서 의미 없음(스킬 미구현). MP 물약은 일단 데이터/구매까지만 두고, 자동 사용 규칙에서는 1차에는 HP만 노출하는 것도 옵션.

---

## 메모리 / 도감 동기화

- `docs/items.md`에 **소비 아이템** 섹션 신설 — 코드 추가 시 항상 동기화 (기존 메모리 규칙).
- `MEMORY.md`에 "물약/소비 아이템 추가 시 동기화" 명시 (item 메모와 통합).
