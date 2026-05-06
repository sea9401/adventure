# 모험 탭 — 캐릭터 요약 + 마을 지도 계획

## 0. 목표

모험 탭을 "지금 어디 있고 / 어디로 갈 수 있는지"가 한눈에 보이는 거점 화면으로 바꾼다.
지금은 "캐릭터 요약 + 평원 던전 카드" 2단 구성이지만, 평원 던전 카드를 **마을 지도** 로 대체.
던전 진입은 "현재 머무는 마을" 카드 안에서 일어난다 (마을 = 던전 + NPC + 상점의 거점).

```
[모험 탭]
├─ 캐릭터 요약 (1줄: 직업·Lv·HP바·골드/철)
└─ 마을 지도
    ├─ 현재 위치: 평원 마을
    │   ├─ 던전: 평원 (들어가기)
    │   └─ (추후) 상점 / NPC
    └─ 이동 가능한 마을 노드들
```

---

## 1. 캐릭터 요약 — "간략" 이 핵심

기존 `AdventureView.tsx` 의 캐릭터 패널은 그대로 두면 정보 중복 (캐릭터 탭에 풀 정보 있음).
**한 줄짜리 strip** 으로 줄인다.

```
사슴 · 무직 Lv.1   HP ████░░ 23/30   💰 120  ⛓ 5
```

- HP 바는 얇게 (h-1).
- 캐릭터 탭으로 갈 수 있는 작은 화살표는 안 둔다 (탭이 이미 위에 있음).

---

## 2. 마을 목록 — 이름·특색

5개 시작. 너무 많으면 텅 빈 마을이 늘어나 정체성이 흐려짐.
**평원 → 강가/숲 → 산 → 사막** 정도가 클래식 RPG 진행 톤.

| ID          | 이름            | 컨셉                      | 시그니처 던전  | 해금 조건             |
| ----------- | --------------- | ------------------------- | -------------- | --------------------- |
| `plains`    | **평원 마을**   | 시작점, 농경지            | 평원 (현재)    | —                     |
| `riverside` | **강가 마을**   | 어업·무역 (건너가는 길목) | 늪지대         | 평원 보스 1회 처치    |
| `woodland`  | **숲속 마을**   | 사냥꾼·약초 (자연 친화)   | 깊은 숲        | 평원 보스 1회 처치    |
| `highland`  | **산기슭 마을** | 광부·대장간 (장비 강화)   | 폐광           | 강가 OR 숲속 보스 1회 |
| `dunes`     | **사막 변두리** | 상인·도적 (위험)          | 모래 폭풍 협곡 | 산기슭 보스 1회       |

> 이름·컨셉은 가안. 사용자 확정 필요.

각 마을은 **시그니처 특색 1개** 를 둔다 (전부 다 채울 필요 없음, 점진 추가):

- 강가 = 낚시 미니자원? 또는 "강 너머" 던전 입장료(골드)
- 숲속 = 약초 채집 → 휴식 시 HP 회복량 증가
- 산기슭 = 대장간 NPC (장비 강화)
- 사막 = 도적단 침입 이벤트 (전투 시작 전 골드 도박)

→ 우선은 **마을 이름 + 던전 + 해금 조건** 만 구현하고, 시그니처 특색은 마을마다 별도 PR 로.

---

## 3. 지도 표현 방식 — 3가지 옵션

### A. 카드 그리드 (가장 단순) ⭐ 추천 시작점

```
┌───────────────────────────────────────────┐
│  [평원 마을] (현재)                       │
│   평원 던전                               │
└───────────────────────────────────────────┘
┌──────────────┐  ┌──────────────┐
│ [강가 마을]  │  │ [숲속 마을]  │
│ 늪지대       │  │ 깊은 숲      │
└──────────────┘  └──────────────┘
┌──────────────┐
│ [산기슭]🔒   │ ← 잠금 (조건 표시)
└──────────────┘
```

- 구현 난이도 ★ (div + grid)
- 위치감은 약하지만 모바일에서 안정적
- "지도" 라기보단 "마을 목록" 에 가까움

### B. 노드 + 연결선 미니맵 ⭐ 진짜 RPG 느낌

```
       (산기슭)🔒
          │
   (강가)─┴─(숲속)
       \  │  /
       (평원)●  ← 현재
          │
       (사막)🔒🔒
```

- 절대 위치 (`position: absolute` + `top/left %`) + SVG 선
- 각 노드는 클릭 가능한 점/원
- 모바일에서도 스크롤 없이 한 화면 (max-w-2xl 안)
- 구현 난이도 ★★ (좌표 데이터 + SVG)

### C. 텍스트 ASCII 맵

```
.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.
 ~ 강가     숲속   ~
.~     \   /     .
 ~  ●평원       ~
.    /          .
 ~ 사막🔒        ~
.~.~.~.~.~.~.~.~.~.~.~.~.~.~.
```

- 텍스트 RPG 정체성에 잘 맞음
- 다만 모바일 가독성·반응형이 까다로움 (고정폭 폰트 필요)
- 구현 난이도 ★★

→ **추천 진행: A 로 일단 출시 → 마을 5개 다 채워지면 B 로 업그레이드.**
A → B 마이그레이션은 어차피 데이터 모델만 같으면 컴포넌트 교체로 끝남.

---

## 4. 이동 방식

### 4-1. 자유 이동 (해금된 마을은 언제든 이동 가능)

- 카드/노드 클릭 → 즉시 `currentTownId` 업데이트
- 이동 비용 없음, 애니메이션 없음 (텍스트 RPG 톤 유지)
- "여행 시간" 같은 idle 메커니즘은 **두지 않음** — 슬로우 템포 ≠ 의미 없는 대기

### 4-2. 해금 (점진 해제)

- 각 마을은 `unlockCondition: { kind: "boss_kill", townId, count }` 형식
- 해금 안 된 마을은 회색 + 자물쇠 + 조건 텍스트 (예: `평원 보스 1회 필요`)
- 보스 처치 시 자동 해금, "새로운 마을이 열렸습니다" 토스트

### 4-3. 시작 시 위치

- 신규 캐릭터: `currentTownId = "plains"`
- 기존 캐릭터 (persist v2 이상): 마이그레이션에서 `currentTownId = "plains"` 부여

---

## 5. 데이터 모델

```ts
// src/adventure/data/towns.ts
export type TownId = "plains" | "riverside" | "woodland" | "highland" | "dunes";

export type UnlockCondition =
  | { kind: "always" }
  | { kind: "boss_kill"; townId: TownId; count: number };

export interface Town {
  id: TownId;
  name: string;          // "평원 마을"
  flavor: string;        // 1줄 설명
  dungeonId: string;     // REGIONS 의 region.id 와 매칭
  unlock: UnlockCondition;
  // 옵션 B 용 좌표 (지금은 안 써도 미리 둠)
  pos: { x: number; y: number }; // 0..100 %
}

export const TOWNS: Town[] = [
  { id: "plains",    name: "평원 마을",   ..., pos: { x: 50, y: 60 } },
  { id: "riverside", name: "강가 마을",   ..., pos: { x: 25, y: 40 } },
  ...
];
```

스토어 추가:

```ts
// game store
currentTownId: TownId;     // persist
unlockedTownIds: TownId[]; // persist, 초깃값 ["plains"]

setTown(id: TownId): void;
```

해금 처리는 `finalizeDispatch` 또는 보스 처치 직후 hook 에서:

```ts
if (boss killed) {
  for (const town of TOWNS) {
    if (town.unlock.kind === "boss_kill" &&
        town.unlock.townId === justKilledTownId &&
        meetsCount &&
        !unlockedTownIds.includes(town.id)) {
      unlockedTownIds.push(town.id);
    }
  }
}
```

---

## 6. 파일 구조

```
src/adventure/
  AdventurePage.tsx         (변경 없음)
  AdventureView.tsx         (현재 위치 마을의 던전 카드만 렌더로 슬림화)
  VillageMap.tsx            (NEW — 옵션 A 카드 그리드)
  TownCard.tsx              (NEW — 마을 1개 카드, 잠금 상태 처리)
  CharacterStrip.tsx        (NEW — 한 줄 캐릭터 요약)
  data/
    towns.ts                (NEW)
```

`AdventureView.tsx` 는:

```tsx
<>
  <CharacterStrip />
  <VillageMap />
  <CurrentTownDungeon /> {/* = 기존 평원 던전 카드, 단 현재 마을 기준으로 동작 */}
</>
```

---

## 7. 작업 단계

1. **데이터 정의** — `data/towns.ts` (5개 마을, 잠금 조건)
2. **스토어** — `currentTownId`, `unlockedTownIds`, `setTown`, persist v3 마이그레이션
3. **CharacterStrip** — 한 줄 요약
4. **TownCard / VillageMap (옵션 A)** — 카드 그리드, 잠금 표시
5. **CurrentTownDungeon** — `AdventureView` 의 평원 던전 카드를 `currentTownId.dungeonId` 기반으로 일반화
6. **해금 hook** — 보스 처치 시 `unlockedTownIds` 업데이트, 토스트
7. **(나중에) 옵션 B 미니맵** — 5개 마을 컨텐츠 다 채워진 뒤

각 단계는 독립 PR 가능. 1~5 까지가 MVP.

---

## 8. 사용자 결정 필요

- [ ] 마을 5개 / 이름 5개 — `평원 / 강가 / 숲속 / 산기슭 / 사막` 으로 갈지
- [ ] 지도 옵션 A (카드 그리드) 로 시작할지, B (미니맵) 부터 할지
- [ ] 자유 이동 OK 인지, "이동 비용" 같은 마찰을 둘지
- [ ] 시그니처 특색은 마을마다 따로 PR 로 미루는 게 맞는지
