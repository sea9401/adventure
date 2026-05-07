# 기능 정리

지금까지 구현된 시스템들을 카테고리별로 모은 인덱스. 자세한 설계는 옆에 표시한 계획 문서 참조.

## 1. 캐릭터 시스템

- **프로필 생성** — 이름 + 외형(남/여) 모달로 첫 진입 시 설정. `characterProfile.v1` 키로 영속.
- **기본 능력치** — 레벨, HP / MP / EXP 바, 골드(헤더 + 모험가 카드).
- **5대 스탯** — 힘·민첩·활력·속도·행운 (`STAT_KEYS`).
- **장비 슬롯** — 무기 / 방어구 / 장신구. 호버(데스크탑) / 탭(모바일) 시 능력치·설명 툴팁.
- **CharacterMini** — 모험·캐릭터 탭 공용 간략 카드 (초상화 + 이름·레벨 + HP/MP/EXP 바 + 장비 칩 3개).
- **모험가 카드** — 소속 / 전투 전적 / 명성 / 보유 골드 (캐릭터 탭 > 내 정보).

### 캐릭터 탭 서브뷰
- **내 정보** — CharacterMini + 모험가 카드 + 능력치 그리드.
- **스킬** — 보유 스킬 목록. 비어 있으면 안내 ("모험을 통해 새로운 스킬을 배워보세요.").
- **모험의 서** — placeholder.
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
- **몬스터 데이터** — `src/adventure/data/monsters.ts`. HP/공격력/방어력/EXP/태그.
- **EXP 분배** — 평야 4종(슬라임/두더쥐/들개/주정뱅이)만 EXP, 그 외 0.
- **UI** — 적 카드(세로, 아바타 96px) + HP 바 + 전투 로그 + 결과 화면.

> 설계: `docs/battle-system-plan.md`

## 4. 마을 / 시설

마을 탭은 EntryCard → 서브뷰 네비게이션 패턴.

- **훈련장** — 4시간 훈련 → 단련 포인트 +1 → 원하는 스탯 +1 분배. `training.v1`로 영속.
- **치유소** — 회복 서브뷰.
- **제작소** — placeholder ("곧 제작 메뉴가 열립니다").
- **모험가 길드** — placeholder ("곧 의뢰 게시판이 열립니다").

## 5. NPC (디올라 마을 v1)

- **명단 6명** — 촌장 마린 / 어부 카이 / 여관 주인 노라 / 잡화상 보로 / 꼬마 리오 / 후드를 쓴 손님.
- **TownView** — region이 town 태그이면 NPC 카드 리스트 + 지역 설명. NPC 카드 클릭 시 대화 모달.
- **NpcDialogue** — 모달, UserCircle 역할별 색 + 인사말 + 떠나기 버튼.
- **데이터** — `src/adventure/data/npcs.ts`. `region` 필드로 역참조.
- **현재 v1** — 정적 인사말만. v2 이후 서비스/의뢰/호감도.

> 설계: `docs/diola-npcs-plan.md`

## 6. 알림 / 로그

- **NotificationBell** — 헤더 우상단 종 아이콘 + 안 읽음 카운트 배지.
- **NotificationToast** — 신규 알림 우하단 토스트.
- **최근 기록** — 캐릭터 탭의 서브뷰. 알림 히스토리 표시.
- **종류** — `battle_win`, `battle_lose` 등.
- **저장** — localStorage. `MAX_NOTIFICATIONS` 상한.

## 7. UI · 디자인

- **테마** — 라이트/다크 토글 (헤더), `theme` 키로 영속, OS 선호도 폴백.
- **폰트** — Geist + Geist Mono (라틴). Comfortaa·Gowun Dodum 시도 후 복귀.
- **아이콘** — Phosphor Icons로 통일. 컨텍스트별 색상:
  - Sword(전투/무기) rose / Shield sky / Diamond violet
  - Compass(지도) emerald / Barbell(훈련장) orange / Hammer(제작소) amber / Scroll(길드) yellow / FirstAid(치유소)
  - User(내 정보) blue / Sparkle(스킬) amber
  - Coins(골드) yellow fill
- **카드 표면** — 화이트/90%, 다크/90% (배경 이미지 가독성).
- **상단 탭바** — 모험 / 마을 / 캐릭터, 언더라인 스타일.
- **헤더 구성** — 게임 제목, 캐릭터 이름·레벨, 위치 핀(현재 region), 골드, 알림 종, 테마 토글.
- **네비게이션 패턴** — 탭 안의 항목은 풀다운 대신 EntryCard → 서브뷰 화면 전환 + ← 뒤로.

## 8. 데이터 / 도감

- `src/adventure/data/world.ts` — region / edge / 태그 / 권장 레벨.
- `src/adventure/data/monsters.ts` — 몬스터 스탯.
- `src/adventure/data/npcs.ts` — NPC 명단.
- `docs/items.md` — 아이템 도감 (코드 변경 시 동기화).

## 9. 인프라 · 도구

- Next.js 16 App Router + Tailwind CSS v4 + TypeScript.
- localStorage 키 모음:
  - `characterProfile.v1` — 이름/외형
  - `character.v1` — HP/MP/EXP/골드 동적 상태
  - `training.v1` — 훈련 상태·단련 포인트·할당
  - `battle-settings.v1` — 자동 전투 토글
  - 지도 진행(맵 모듈에서 관리)
  - 알림(`notifications` 모듈)
- `/icons` — Phosphor 아이콘 미리보기 페이지 (개발용).

## 10. 계획 문서

- `docs/svg-map-plan.md` — SVG 월드맵 설계.
- `docs/battle-system-plan.md` — 자동 전투 v1 명세.
- `docs/diola-npcs-plan.md` — 디올라 NPC v1~v5 마일스톤.
- `docs/items.md` — 아이템 도감.
