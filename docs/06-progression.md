# 진행 시스템

> 코드: `src/lib/game/data.ts` (MONUMENT\_\*, ACHIEVEMENTS, upgradeCost), `src/lib/game/logic.ts` (getCodexBonus, getMonumentBonus), `src/app/CodexPanel.tsx`

## 영지 (Estate)

5종 건물 + 마을 회관:

| 건물                   | 효과                    | 공식                     |
| ---------------------- | ----------------------- | ------------------------ |
| 농장 (Farm)            | 골드 자동 생산          | `lv × 0.1125` /sec       |
| 광산 (Mine)            | 철 자동 생산            | `lv × 0.0625` /sec       |
| 여관 (Inn)             | HP 자동 회복            | `0.25 + lv × 0.375` /sec |
| 훈련소 (Training)      | EXP 자동 획득           | `lv × 0.1` /sec          |
| 명예의 전당 (Monument) | 보스 트로피 → 영구 스탯 | 별도 (아래 참조)         |

> 영지 산출량은 활성 사냥 우대 정체성에 맞춰 이전(0.45 / 0.25 / 0.4)의 25%로 하향. mid-tier 사냥(설원~해적 정박지) 1시간 ≈ 영지(Lv 50) 1~3일치.

레벨 캡:

- 일반 건물: `townHall × MAX_BUILDING_LEVEL_PER_HALL` (= townHall × 5)
- 마을 회관: 20
- 명예의 전당: 25 (자체 캡)

업그레이드 비용 (`upgradeCost`)은 건물별 / 레벨별로 정의.

## 명예의 전당 (Monument)

보스 처치 누적 횟수에 비례한 영구 스탯 보너스.

### 트로피 정의

각 보스마다 `perKill` 보너스 (per-kill 단위):

| 보스           | 트로피 perKill |
| -------------- | -------------- |
| 거대 슬라임 왕 | HP +1          |
| 늑대 우두머리  | SPD +0.05      |
| 거미 여왕      | STR +0.5       |
| 잠든 가디언    | VIT +0.5       |
| 거대 전갈      | AGI +0.5       |
| 서리 거인      | HP +1.5        |
| 해적 선장      | STR +0.5       |
| 유령 선장      | MATK +0.5      |
| 심연 감시자    | AGI +1         |
| 균열의 수호자  | VIT +1         |
| 심연의 군주    | STR +1, VIT +1 |
| 산군 (코옵)    | (정의된 값)    |
| 그리폰 (코옵)  | (정의된 값)    |
| 크라켄 (코옵)  | (정의된 값)    |

### 적용 공식

```
final_bonus = sum(killCount × perKill) × MONUMENT_LEVEL_FACTOR(lv)
MONUMENT_LEVEL_FACTOR(lv) = lv × 0.05  // lv 1 = 5%, lv 25 = 125%
```

캡: 보스당 100킬 (`MONUMENT_KILL_CAP`).

주속성(STR/VIT/MATK)에 부여되어 자동으로 ATK/DEF/INT에 환산됨.

## 기록의 서 (Codex)

영구 진행도 시스템. 자료 등록 시 점수 적립.

### 등록

| 종류      | 비용                              | 동작                                                              |
| --------- | --------------------------------- | ----------------------------------------------------------------- |
| 재료 등록 | 재료 × 10 (`CODEX_MATERIAL_COST`) | 같은 재료 최대 3회 등록 가능 (`CODEX_MATERIAL_MAX_REGISTRATIONS`) |
| 장비 등록 | 장비 × 1 (`CODEX_EQUIPMENT_COST`) | 1개 차감하여 영구 등록                                            |

### 점수 / 포인트

```
entries = 등록한 재료 수 + 등록한 장비 수
earnedPoints = floor(entries / 5)   // CODEX_ENTRIES_PER_POINT
availablePoints = earnedPoints − 사용 포인트
```

### 포인트 분배 (CODEX_STAT_PER_POINT)

| 스탯 | 포인트당 보너스 |
| ---- | --------------- |
| HP   | +100            |
| STR  | +10             |
| VIT  | +10             |
| MDEF | +10             |
| SPD  | +0.2            |
| AGI  | +1              |
| MATK | +10             |

`allocateCodexPoint(stat)` / `unallocateCodexPoint(stat)` / `resetCodexAllocation()` 로 자유롭게 재분배.

## 업적

3개 카테고리:

| Category | 라벨   | 종류                                        |
| -------- | ------ | ------------------------------------------- |
| `first`  | 첫걸음 | 첫 탐험 / 첫 보스 / 첫 제작 등 단발         |
| `boss`   | 보스   | 보스별 누적 처치 (티어드: 10/100/1000회 등) |
| `combat` | 전투   | 처치 / 레벨 등 누적                         |
| `etc`    | 기타   | 만능 모험가 / 골드 누적 / 철 누적           |

### 종류

- **`single`**: 한 번 달성 (조건 + 보상 1회)
- **`tiered`**: 누적 단계별 (1단계, 2단계 ...)

### 보상

`gold`, `iron`, `materials` 중 하나 이상.

### 표시

- 업적 달성 시 `_achievementToast` 토스트 (5초)
- `claimedTiers` 배열로 받은 단계 추적
- 메인 페이지 업적 탭에서 카테고리별로 확인

## 마일스톤 토스트

레벨 50/100/130/160/200 도달 시 안내 토스트 (`_milestoneToast`):

| Lv  | 메시지                                       |
| --- | -------------------------------------------- |
| 50  | 탐험 가능 영역 확장, 후반 1차 스킬 학습 가능 |
| 100 | 1차 만렙. 2차 전직 안내                      |
| 130 | 각성자. 심연 입구 권장                       |
| 160 | 심연 도전자. 심연 균열 가능                  |
| 200 | 최종 만렙                                    |
