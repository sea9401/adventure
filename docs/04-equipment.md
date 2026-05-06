# 장비 시스템

> 코드: `src/lib/game/data.ts` (EQUIPMENT, SETS, EQUIPMENT_SLOT_LABELS, getEquipmentResourceCost), `src/lib/game/types.ts` (EquipmentDef, EquipmentBonus)

## 슬롯

총 6개 슬롯, 각 1개씩 장착 가능:

| 슬롯     | 라벨 |
| -------- | ---- |
| `head`   | 머리 |
| `body`   | 갑옷 |
| `gloves` | 장갑 |
| `boots`  | 신발 |
| `weapon` | 무기 |
| `ring`   | 반지 |

## 보너스 종류 (EquipmentBonus)

```ts
{
  hp?, atk?, def?, mdef?, spd?, agi?, int?,
  str?, vit?, matk?,         // 주속성 (각각 ATK/DEF/INT에 +1 환산)
  crit?,                     // 0~1 (0.05 = +5% 크리율)
  dotAmp?,                   // 0~1 (0.10 = +10% DOT 증폭)
}
```

## 등급 (이름 색상)

| 등급               | 색상                                               | 조건                      | 특징                            |
| ------------------ | -------------------------------------------------- | ------------------------- | ------------------------------- |
| 일반 (세트)        | 기본                                               | `setId` 정의              | 제작 가능, 세트 효과            |
| 보스 유니크 (제작) | `text-fuchsia-300` (다크) / `fuchsia-700` (라이트) | `bossLabel` + 세트 미소속 | 보스 재료로 제작                |
| 보스 유니크 (드랍) | `text-orange-300` / `orange-700`                   | `dropOnly: true`          | 제작 불가, 보스 처치 시 1% 드랍 |

CSS 변수: `--rarity-craft`, `--rarity-drop` (globals.css). `BattleLogTurn.tsx`/`page.tsx`의 `getEquipmentNameColor`에서 분류.

## 세트 (9종)

| Set ID        | 이름           | 피스 |
| ------------- | -------------- | ---- |
| `plains_set`  | 평야 세트      | 2    |
| `forest_set`  | 가죽 세트      | 4    |
| `cave_set`    | 동굴 세트      | 4    |
| `ruins_set`   | 낡은 유적 세트 | 5    |
| `desert_set`  | 사막 세트      | 5    |
| `snow_set`    | 설원 세트      | 5    |
| `pirate_set`  | 해적 세트      | 2    |
| `ghost_set`   | 유령선 세트    | 5    |
| `griffon_set` | 그리폰 세트    | 5    |

세트 효과는 N피스 장착 시 누적 발동 (예: 낡은 유적 세트 2/3/4/5피스마다 추가 보너스).

## 제작

세트 기반 제작 비용:

```ts
gold = SET_BASE.gold × SLOT_MULT
iron = SET_BASE.iron × SLOT_MULT

SLOT_MULT = head:1, body:1.5, gloves:1, boots:1, weapon:2, ring:0.8
```

세트 베이스 비용은 세트별 (`EQUIPMENT_SET_BASE_COST`). 추가로 보스 재료 등이 `cost` 필드에 정의됨.

`dropOnly: true` 장비는 cost: {} (빈 비용)이며 제작 패널에서 숨김 처리 (`page.tsx`의 craft tab).

## 보스 유니크 드랍

11개 필드 보스 각각 1개씩 고유 드랍 (1% 확률):

| 보스           | 유니크 장비     | 슬롯   | 주효과           |
| -------------- | --------------- | ------ | ---------------- |
| 거대 슬라임 왕 | 슬라임 슈트     | body   | HP/DEF/VIT       |
| 늑대 우두머리  | 알파의 발톱     | gloves | ATK/AGI/CRI/STR  |
| 거미 여왕      | 여왕의 맹세     | ring   | INT/MATK/DOT     |
| 잠든 가디언    | 수호자의 면류관 | head   | HP/DEF/VIT       |
| 거대 전갈      | 독사의 부츠     | boots  | SPD/AGI/DOT/STR  |
| 서리 거인      | 빙하의 망토     | body   | HP/DEF/VIT       |
| 해적 선장      | 발도자의 신검   | weapon | ATK/STR/CRI      |
| 유령 선장      | 해적왕의 반지   | ring   | INT/MATK/MDEF    |
| 심연 감시자    | 심연의 가면     | head   | HP/MDEF/INT/MATK |
| 균열의 수호자  | 심연의 장갑     | gloves | ATK/STR/DEF/VIT  |
| 심연의 군주    | 공허 단절검     | weapon | ATK/STR/AGI/CRI  |

드랍 시점:

- `Boss.uniqueDrop = { id, chance: 0.01 }` 정의
- `resolveBossDispatch` 마지막에 `Math.random() < chance` 통과 시 `BossDispatchResult.droppedUniqueEquipment` 채움
- `store.ts`가 `equipmentInventory`에 추가 + `_uniqueDropToast` 알림 + `LogEntry.droppedUniqueEquipment` 기록

## 인벤토리

`equipmentInventory: Record<EquipmentId, number>` 형태로 보관 (개수 카운트). 장착 / 도감 등록 / 추후 분해 시 차감.

## 도감 등록

`registerCodexEquipment(id)` 호출 시 인벤토리 1개 차감하여 등록. 등록된 장비는 영구 표시되며 도감 점수에 카운트 (자세한 내용은 [06-progression.md](./06-progression.md)).
