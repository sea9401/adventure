# 기능 정리

지금까지 구현된 시스템들을 카테고리별로 모은 인덱스. 자세한 설계는 옆에 표시한 계획 문서 참조.

## 1. 캐릭터 시스템

- **프로필 생성** — 이름 + 외형(남/여) 모달로 첫 진입 시 설정. `characterProfile.v1` 키로 영속.
- **기본 능력치** — 레벨, HP / MP / EXP 바, 골드(헤더 + 모험가 카드).
- **5대 스탯** — 힘·민첩·활력·속도·행운 (`STAT_KEYS`).
- **장비 보너스** — 장비의 `bonus`가 `character.stats`에 합산되어 표시.
- **장비 슬롯** — 무기 / 방어구 / 장신구. 호버(데스크탑) / 탭(모바일) 시 능력치·설명 툴팁.
- **CharacterMini** — 모험·캐릭터 탭 공용 간략 카드 (초상화 + 이름·레벨 + HP/MP/EXP 바 + 장비 칩 3개).
- **모험가 카드** — 소속 / 전투 전적 / 명성 / 보유 골드 (캐릭터 탭 > 내 정보).

### 캐릭터 탭 서브뷰
- **내 정보** — CharacterMini + 모험가 카드 + 능력치 그리드.
- **가방** — 장비 / 재료 / 포션 3탭. 장비 탭에서 직접 장착 가능.
- **스킬** — 보유 스킬 목록. 비어 있으면 안내 ("모험을 통해 새로운 스킬을 배워보세요.").
- **모험의 서** — 몬스터 / 아이템 / NPC / 마을 / 장소 / 기타 6탭 도감.
- **최근 기록** — 알림 히스토리.

## 2. 모험 / 지도

- **월드맵(SVG)** — 7개 region (시작 마을 / 평야 / 동굴 / 외곽 숲 / 안개 호수 / 디올라 마을 / 옛 폐허), 8개 엣지.
- **이동** — 인접 region만 클릭 가능, amber 펄스로 도달 가능 표시. `mapProgress`로 현재/방문 영속.
- **biome 색** — 노드별 환경 색.
- **위치 동기화** — 헤더 우상단 `MapPin` + 지역명, 모험 탭 진입 카드/배경 이미지가 모두 `currentRegion`에 바인딩.
- **배경 이미지** — `/images/ui/{regionId}.png` 전체 화면 fixed 배경, 반투명 오버레이 + UI 카드 90% 불투명.
- **town 태그** — `RegionTag = "town"`이면 전투 진입 대신 NPC 둘러보기 화면.

> 설계: `docs/svg-map-plan.md`

## 3. 전투 시스템

- **자동 전투 v1** — 턴제, 0.5초 간격 자동 진행. "자동 전투" 토글이 ON이면 한 판 끝나고 같은 지역에서 새 적과 자동 재시작.
- **선공** — 플레이어 고정.
- **승리/패배 처리** — 승리 시 EXP. 패배 시 HP 회복 + 시작 마을 강제 이동 + 자동 전투 자동 OFF.
- **몬스터 데이터** — `src/adventure/data/monsters.ts`. HP/공격력/방어력/속도/EXP/태그/이미지.
- **EXP 분배** — 평야 4종(슬라임/두더쥐/들개/주정뱅이)만 EXP, 그 외 0.
- **레벨업** — `lib/leveling.ts` (`MAX_LEVEL`, `requiredExpToNext`, `applyExpGain`).
- **수동 행동** — 자동 OFF 시 공격 / 포션 사용 선택.
- **자동 포션 규칙** — `AutoPotionSection`에서 종류별 발동 조건(HP < x%) 설정. 자동 전투 중에만 동작.
- **UI** — 적 카드(세로, 아바타 96px) + HP 바 + 전투 로그 + 결과 화면.

> 설계: `docs/battle-system-plan.md`, `docs/potion-system-plan.md`

## 4. 마을 / 시설

마을 탭은 EntryCard → 서브뷰 네비게이션 패턴.

- **훈련장** — 6시간 훈련 → 단련 포인트 +1 → 원하는 스탯 +1 분배. `training.v1`로 영속.
- **치유소** — HP/MP 전부 회복 (현재 무료).
- **상점** — 포션 / 재료 구매. 보유 cap 시각화 (`보유 X / Y`).
- **제작소** — 등록된 제작서로 장비/포션 제작. 재료 부족분 적색 강조. `crafting.v1`로 알려진 제작서 영속.
- **모험가 길드** — 지역별 의뢰 게시판. 수주/진행/보상 상태 흐름.

## 5. NPC (디올라 마을 v1 + 시작 마을)

- **명단** — 디올라 6명(촌장 마린 / 어부 카이 / 여관 주인 노라 / 잡화상 보로 / 꼬마 리오 / 후드를 쓴 손님) + 시작 마을의 훈련 교관 스미스 / 대장장이 볼드 등.
- **TownView** — region이 town 태그이면 NPC 카드 리스트 + 지역 설명. NPC 카드 클릭 시 대화 모달.
- **NpcDialogue** — 모달, UserCircle 역할별 색 + 인사말 + 떠나기 버튼.
- **NPC 전속 퀘스트** — `quests.ts`의 `giverNpcId` 필드. 길드 게시판에는 노출되지 않고 해당 NPC와의 대화에서만 진행 (예: 훈련 교관의 슬라임/들개/두더쥐 과제).
- **스토리 퀘스트** — `storyQuests.ts`. 멀티스테이지 NPC 진행용 메타데이터.
- **데이터** — `src/adventure/data/npcs.ts`. `region` 필드로 역참조.

> 설계: `docs/diola-npcs-plan.md`

## 6. 의뢰 / 퀘스트

- **길드 의뢰** — `quests.ts`. 몬스터 처치형 (`target.monsterName`, `target.count`). 수주 → 진행 → 보상 받기 → (반복 가능 시) 다시 수주.
- **반복 의뢰** — `repeatable: true`로 무한 반복 + 누적 완료 횟수 표시.
- **레벨 게이트** — `requiredLevel` 미달 시 수주 버튼 잠금.
- **저장** — `quest-progress.v1`. 상태(`available`/`active`/`ready`/`completed`) + 진행도 + 누적 완료 횟수.

## 7. 인벤토리 / 아이템

- **장비** — `ITEMS` 상수. 슬롯(무기/방어구/장신구), 표시 stats, 능력치 보너스, 설명. `findItemId`로 직렬화 후 역추적.
- **재료** — `MATERIALS`. 상점 판매 여부, 가격, 설명.
- **포션** — `POTIONS`. 종류별 보유 상한 `POTION_MAX_PER_TYPE = 10`. 회복은 평탄(flat) + 비율(pct) 조합. `computeHealAmount`로 계산.
- **저장** — `inventory.v1`. 장비/재료/포션 카운트맵.
- **자동 포션 규칙** — `auto-potion-rules.v1`.

## 8. 알림 / 로그

- **NotificationBell** — 헤더 우상단 종 아이콘 + 안 읽음 카운트 배지.
- **NotificationToast** — 신규 알림 우하단 토스트.
- **최근 기록** — 캐릭터 탭의 서브뷰. 알림 히스토리 표시.
- **종류** — `battle_win`, `battle_lose`, `training_done`, `quest_ready`, `quest_complete`, `info`.
- **저장** — localStorage `notifications.v1`. `MAX_NOTIFICATIONS` 상한.

## 9. 모험의 서 (도감)

- **몬스터** — 처치 수에 따라 4단계 reveal (실루엣 → 이름·HP → ATK·DEF·SPD → EXP). `getRevealStage`.
- **NPC** — 대화 1회 이상이면 등록. 대화 횟수 누적.
- **마을 / 장소** — 방문 시 등록. 마을은 만난 사람 수, 장소는 만난 몬스터 수 진행도.
- **기타 (스탯)** — 스탯이 `STAT_REVEAL_THRESHOLD` 이상일 때 부수 효과(`STAT_CONVERSIONS`) 공개.
- **저장** — `adventure-log.v1`.

## 10. UI · 디자인

- **테마** — 라이트/다크 토글 (헤더), `theme` 키로 영속, OS 선호도 폴백.
- **폰트** — Geist + Geist Mono (라틴). Comfortaa·Gowun Dodum 시도 후 복귀.
- **아이콘** — Phosphor Icons로 통일. 컨텍스트별 색상:
  - Sword(전투/무기) rose / Shield sky / Diamond violet
  - Compass(지도) emerald / Barbell(훈련장) orange / Hammer(제작소) amber / Scroll(길드) yellow / FirstAid(치유소) rose / Storefront(상점) / Backpack(가방) / BookOpen(모험의 서)
  - User(내 정보) blue / Sparkle(스킬) amber
  - Coins(골드) yellow fill
- **카드 표면** — 화이트/90%, 다크/90% (배경 이미지 가독성).
- **상단 탭바** — 모험 / 마을 / 캐릭터, 언더라인 스타일.
- **헤더 구성** — 게임 제목, 캐릭터 이름·레벨, 위치 핀(현재 region), 골드, 알림 종, 테마 토글.
- **네비게이션 패턴** — 탭 안의 항목은 풀다운 대신 EntryCard → 서브뷰 화면 전환 + ← 뒤로.
- **공용 UI** — `components/ui`에 `Card`, `EmptyState`, `TabBar` 추출.

## 11. 데이터 / 도감 소스

- `src/adventure/data/world.ts` — region / edge / 태그 / 권장 레벨.
- `src/adventure/data/monsters.ts` — 몬스터 스탯 + 이미지.
- `src/adventure/data/npcs.ts` — NPC 명단.
- `src/adventure/data/items.ts` — 장비 카탈로그.
- `src/adventure/data/materials.ts` — 재료.
- `src/adventure/data/potions.ts` — 포션 + 보유 상한.
- `src/adventure/data/recipes.ts` — 제작서.
- `src/adventure/data/quests.ts` — 의뢰.
- `src/adventure/data/storyQuests.ts` — NPC 스토리 퀘스트 메타.
- `src/adventure/data/stats.ts` — 스탯 reveal 임계값.
- `docs/items.md` — 아이템 도감 (코드 변경 시 동기화).

## 12. 인프라 · 도구

- Next.js 16 App Router + Tailwind CSS v4 + TypeScript.
- localStorage 키 모음 (전부 `.v1` suffix):
  - `characterProfile.v1` — 이름/외형
  - `character.v1` — HP/MP/EXP/골드 + 장비
  - `training.v1` — 훈련 상태·단련 포인트·할당
  - `battle-settings.v1` — 자동 전투 토글
  - `inventory.v1` — 가방 (장비/재료/포션)
  - `auto-potion-rules.v1` — 자동 포션 규칙
  - `crafting.v1` — 알려진 제작서
  - `quest-progress.v1` — 의뢰 진행도
  - `adventure-log.v1` — 모험의 서
  - `map.v1` — 맵 진행 (현재 위치 + 방문)
  - `notifications.v1` — 알림 히스토리
  - `theme` — 테마
- `/icons` — Phosphor 아이콘 미리보기 페이지 (개발용).

## 13. 계획 문서

- `docs/svg-map-plan.md` — SVG 월드맵 설계.
- `docs/battle-system-plan.md` — 자동 전투 v1 명세.
- `docs/potion-system-plan.md` — 포션 시스템 설계.
- `docs/adventure-log-plan.md` — 모험의 서 설계.
- `docs/diola-npcs-plan.md` — 디올라 NPC v1~v5 마일스톤.
- `docs/items.md` — 아이템 도감.
