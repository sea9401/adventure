# Changelog

날짜·해시는 git log 기준. 카테고리 태그:
🏗️ infra · 👤 character · 🗺️ adventure · ⚔️ battle · 🏘️ town · 🤝 npc · 🔔 notify · 🎨 ui · 📦 data · 📝 docs

## 2026-05-13

신규 지역 퀘스트 라인 확장 — `feat/unhyang-quests` (PR #37, merge `41ee2b6`).

- 📦 **신규 지역 퀘스트 라인 확장** (quest-expansion-plan M1~M6 전 항목). 운향 메인(백운·만월) + 천공 성지 메인(해무) + 운향/바람골/봉황령/화산 사이드 의뢰·길드 게시판 + 마을 간 연계(마린↔백운·산하↔노라·지미↔도연·만월↔볼드) + 보스 누적 사냥 hunter ×3 + 순례자 미상 대사 분기 + 히든 퀘스트 8종(`hidden-mole-king`·`-deepest-vein`·`-blacksmith-duel`·`-giants-origin`·`-volcano-relic`·`-lucky-collector`·`-hooded-cipher`·`-pilgrim-trail`).
- 🤝 신규 NPC 3명: 떠돌이 음유시인 / 사미승 운하 / 문지기 청람 (초상화 placeholder — 추후 webp 추가).
- 👤 신규 칭호 8종: `mountain_friend`·`ridge_crosser`·`herbalists_courier`·`boss_hunter`·`caravan_warden`·`lucky_finder`·`cipher_bearer` + (`giant_slayer` 유지).
- 📦 신규 아이템 2종: 월광검(`moonlight_blade`)·용암 정수(`lava_essence`) — 히든 의뢰 보상, rare·비거래. 운봉/봉황 무기 4종씩 만월·해무 의뢰로 확정 루트 추가(보스 `recipe_one_of` 병행).
- 🏗️ 신규 헬퍼: `questLineDialogue`(다단계 의뢰 NPC 공용)·`inventory/ownership`(장비 보유·unique 카운트)·`PilgrimMarkDialogue`(통과 지역 표식 surfacing). 신규 다이얼로그 컴포넌트 ~7개. 기존에 데이터만 있고 노출 안 되던 NPC 의뢰(운향·바람골·천공) 전부 대화에 연결(버그 수정).
- 🏗️ `integrity.test.ts` 보강 — quest target(monsterName/materialId)·requiresQuestCompleted·id 유일성 정합성 검사.
- ⚔️ 보상 보정 — 화산 지대(reqLv 52~55) 사이드·게시판·연금 의뢰 EXP 상향 (1500~2200 → 2300~2900). `L^2.5` 곡선에서 후반 의뢰 EXP가 레벨업 필요량의 2.2~3.3%로 가라앉던 걸 봉황령 tier(~3.7%)에 맞춤. 메인 라인·hunter·히든 보상은 설계대로 유지.
- 🗺️ 봉황령→화산 레벨 공백(reqLv ~42 → 52) 보강 — reqLv 44~50 의뢰 8종 추가: 바람골 게시판 4종(`windvale-board-ridge-knights`·`-flame-lizards-large`·`-ridge-eagles-large`·`-lava-foothills`)·운향 게시판 1종(`unhyang-board-phoenix-ridge-grand`)·한솔 라인 2종(`windvale-pathfinder-deep-ridge`→`-foothills`)·도연 1종(`unhyang-guide-ridge-storm`). 각 ~4%/레벨로 봉황령 tier와 연속.

### 부러진 영웅검 복원 의뢰

- 🤝 **만월 — 부러진 영웅검 복원**(storyQuest `hero_sword_restoration`). 만월 재회(`manwol_bold_reunion_done`) + 천공 성지 보스(`volcano_heart_defeated`) 이후 해금. 폐허 늑대 드랍 unique `hero_broken_sword`(윗동강)를 맡기면 → 운봉석 ×16(검신) → 화염 능선 재료(용암 핵 ×6·화염 비늘 ×8·봉황 깃털 ×3, 날밑) → 벼리기 → 완성. flag 릴레이: `hero_sword_started`→`_ore_done`→`_core_done`→`_forging`→`_restored`. 윗동강 미보유 + 보스 처치 상태면 만월이 떡밥 대사. 윗동강은 드랍 품질 0~2 어느 칸이든 회수, 장착 중이면 안내.
- 📦 신규 아이템 `hero_sword`(영웅검) — 공격력 +18 / 힘 +5, `legendary`, 거래 불가. (서사 최종 보상답게 다른 무기 대비 확실히 위 — 같은 날 +16/속-1 에서 상향.)
- 👤 신규 칭호 `hero_sword_heir`(영웅검의 계승자) — `hero_sword_restored` flag, useTitleGrants.
- 🔔 완성 보상: 영웅검 + 골드 400 + 명성 8 + 칭호.

### 캐릭터 생성 모달 → 전용 `/create` 페이지

- 🏗️ 첫 진입 시 뜨던 캐릭터 생성 모달(`NameSetupModal`, fixed overlay) 제거 → 전용 라우트 `/create`. 폼은 `components/CreateCharacterForm`(모달 chrome 없는 순수 폼)으로 추출, `/create` 가 `SaveProvider` + `CreateCharacterPage` 로 감싸 렌더. 캐릭터 있으면 `/create→/`, 없으면 `/→/create` (needsSetup 단일 기준, 상호배타 → 루프 없음). 인증은 기존 미들웨어가 그대로 가드. 회원가입/온보딩 단계 확장 여지.

### 기존 장비 → 한 단계 위 장비 업그레이드 레시피 11종

- 📦 그동안 못박힌 야구방망이·요정의 가호 둘뿐이던 "장비 자체를 재료로 한 단계 위 장비 제작" 패턴을 11종 추가. 베이스 1개를 `equip` 재료로 소비 + 같은 구간 재료. 결과물도 제작 품질 등급 굴림.
  - 초반/중반(uncommon, 거래 가능): 낡은 가죽갑옷→**덧댄 가죽갑옷**(들개 0.5%) · 산적의 단검→**두목의 단검**(산적 0.3%) · 님프의 반지→**호수 님프의 가호**(호수 님프 0.2%) · 골렘의 망치→**재단조한 골렘 망치**(부서진 골렘 1.5%) · 망령의 망토→**망령왕의 망토**(떠도는 망령 0.2%) · 봉황 망토→**봉황 비행깃 망토**(불꽃 독수리 0.4%).
  - 유실된 명품 업그레이드(unique, **거래 불가** — "손에 맞춰진 보물"): 굳은 용암핵 망치→**용암핵 대망치**(용암 슬라임 0.5%) · 하늘가르개→**창천의 발톱**(초원 매 0.3%) · 거미여왕의 비단갑→**거미여왕의 비단 정갑**(거미 0.2%) · 박쥐떼의 길잡이→**박쥐떼의 인도자**(박쥐 0.3%) · 두더지왕의 드릴→**두더지왕의 굴착드릴**(광맥의 수호자 5%).
- 🏗️ `integrity.test.ts` 보강 — recipe id 유일성 + recipe `ingredients`의 materialId/itemId 존재 + equip→equip 자기참조(무한 루프) 금지 검사 추가 (기존엔 결과 itemId만 검증).
- 📝 `docs/items.md` — `(… 업그레이드)` 표기 안내 + 무기/방어구/장신구 표에 11종 추가, rarity 표 갱신.

## 2026-05-06

- `a271480` 🏗️ adventure-rpg 프로젝트 분리 — exten에서 adventure UI만 추출.

## 2026-05-07

### 인프라 / 셋업
- `7d64af6` 🏗️ 프로젝트 초기화 — exten 코드 전부 삭제, git/vercel 연결만 유지.
- `9ca93b0` 🏗️ shadcn/ui 초기 설정 + 타입 좁힘.
- `0ecab6f` 🏗️ 캐릭터 탭의 1차/2차 전직 Panel 제거 (게임 컨셉 재시작).
- `05aa8fa` 🏗️ Next.js 16 셋업 + 메인 화면 스켈레톤.

### 캐릭터 / 프로필
- `cb0b692` 👤 헤더에 이름·레벨 + 라이트/다크 토글.
- `9a52da0` 👤 캐릭터 간략 정보창 + 무기/방어구/장신구 슬롯.
- `123fd00` 👤 기본 장비 — 나뭇가지 / 천 옷 / 엄마가 준 부적.
- `37374ab` 👤 이름 설정 모달 + HP 바 빨강.
- `8ed55e8` 👤 장비 호버/탭 툴팁.
- `3c8f392` 👤 메인 탭(모험/마을/캐릭터) + 5대 스탯(힘/민첩/활력/속도/행운).
- `38b30c3` 👤 능력치 별도 패널.
- `1b217ee` 👤 캐릭터 탭 내용을 '내 정보' 풀다운으로 묶기.
- `d668e0f` 👤 외형(남/여) 선택 + 캐릭터 이미지.
- `ec45820` 👤 내 정보 탭에 CharacterMini 재사용.
- `7c43495` 👤 모험가 카드 (소속·전적·명성·골드).
- `2e2f609` 👤 스킬 탭 (빈 상태 안내).
- `38374f2` 👤 EXP 바 (MP 아래) + StatBar 라벨 폭 확대.
- `79d0a8c` 👤 모험의 서 placeholder 항목.
- `6b073ca` 👤 풀다운 → sub-view 네비게이션 패턴으로 전환.

### 모험 / 지도
- `d686d43` 🗺️ 모험 탭에 간략 캐릭터 정보.
- `1ee5d1c` / `7543241` 🗺️ 모험 탭 카드 다듬기.
- `747c7e2` / `5e4c1e8` / `4389d2c` 🗺️ 캐릭터 이미지 자리 / 패딩 조정.
- `c298039` 🗺️ 전투·지도 진입 카드 추가, placeholder 제거.
- `bf3af89` 🗺️ SVG 월드맵 v1 — 노드 6개 / 엣지 7개 + 클릭 이동 + localStorage 진행 저장.
- `d1b003f` 🗺️ 노드에 biome 색 + 도달 가능 노드에 amber 펄스.
- `f0b9615` 🗺️ 우상단 위치 표시를 currentRegion.name과 동기화.
- `dbc958b` 🗺️ 캐릭터 정보 밑에 현재 지역 맵 이미지.
- `8d169b6` 🗺️ 지역 이미지를 전체 화면 배경으로 적용.

### 전투
- `78638a8` ⚔️ 마을에서도 적 목록 + 몬스터 스탯 데이터.
- `595563e` ⚔️ 평야 적 개편 + 칩 스타일.
- `12da3dd` ⚔️ 자동 전투 v1 — 턴제 자동 진행 + 자동 토글 + 영속화.
- `987715b` ⚔️ 평야 외 EXP 0 처리 + MonsterTag.
- `d1f5612` ⚔️ 평야 4종 EXP 하향 (1~3).
- `4f74441` ⚔️ 광맥 골렘 / 수룡 / 고대 망령 / 타락한 기사 4종 삭제.
- `2797472` ⚔️ 적 카드 세로 레이아웃 + 아바타 96px.
- `ece328e` ⚔️ 적 목록에 이미지.
- `d24693a` ⚔️ 몬스터 처치 시 골드 드롭 제거.

### 마을 / 시설
- `d8bc2aa` / `9d246ae` 🏘️ 훈련장 — 3시간 훈련 → 단련 포인트 → 스탯 분배.
- `9941c1f` 🏘️ 훈련 시간 3 → 4시간.
- `aa411fb` 🏘️ 모험가 길드 진입 카드 + placeholder 서브뷰.
- `e458f2a` 🏘️ 치유소 카드 + 회복 서브뷰.

### NPC / 세계관
- `4525e70` 📦 디올라 마을 추가 + 마을 region에 town 태그.
- `e6693f1` 📦 마을에 적정 레벨 + 시작 마을에 주정뱅이 추가.
- (디올라 NPC v1 코드는 `ece328e` 등에 묶여 푸시됨.)

### 알림 / 로그
- `0f06a49` 🔔 우상단 알림 종 + 토스트 + 캐릭터 탭 '최근 기록' 서브뷰.
- `98be20f` 👤 헤더 우상단에 보유 골드 인라인 표시.

### UI · 디자인
- `5b7798b` 🎨 메인 화면 텍스트 한 단계 키움.
- `e73d8f9` / `01d65e9` / `2353ed1` 🎨 폰트 실험 (Comfortaa + Gowun Dodum).
- `4812305` 🎨 폰트를 Geist + Geist Mono로 복귀.
- `177f48d` / `e56c9d5` / `299858f` 🎨 탭 스타일 다듬기.
- `e8f892c` 🎨 상단 탭 폰트 확대 (text-sm → text-base, font-semibold).
- `4a61a60` 🎨 게임 내 이모지 → Phosphor 아이콘 일괄 교체.
- `b91d41e` 🎨 진입 카드/장비 아이콘에 테마 색상 적용.
- `dc16a19` 🎨 카드 배경 /40 → /90 (배경 이미지 위 가독성).
- `95b8571` 🎨 헤더·탭바도 /90 처리.
- `e867c6c` / `ce44671` 🎨 탭바 풀폭 배경 시도 후 초기 형태로 revert.

### 문서
- `6609f8c` 📝 battle-plan에 자동 반복 토글 / 0.5초 턴 간격 명세 보강.
