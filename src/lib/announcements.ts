// 공지 사항 — 운영자 어투의 패치 노트. 큐레이션 수동, 사용자에게 보여줄 변경분만 추려서 게시.
// 최신 항목이 위. id 는 날짜 기반으로 안정적으로 부여 (RSS·앵커 등에 대비).

export type AnnouncementCategory = "feature" | "balance" | "fix";

export type AnnouncementItem = {
  category: AnnouncementCategory;
  text: string;
};

export type Announcement = {
  id: string;
  date: string;
  title: string;
  intro?: string;
  items: AnnouncementItem[];
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "2026-05-09-diola",
    date: "2026-05-09",
    title: "디올라와 그 너머 업데이트",
    intro:
      "디올라 마을 콘텐츠와 새 장비, 거래·기록 시스템 정비를 한꺼번에 적용했습니다.",
    items: [
      {
        category: "feature",
        text: "디올라 트라이얼 라인 '안개 너머의 길' 이 열렸습니다. 후드 손님과 마을 사람들의 신뢰를 얻고 옛 폐허로 향해 보세요.",
      },
      {
        category: "feature",
        text: "디올라 길드 게시판에 반복 의뢰 4종이 추가됐습니다.",
      },
      {
        category: "feature",
        text: "신규 장비 3종 — 비단 로브 · 박쥐가죽 후드 · 수정 단검.",
      },
      {
        category: "feature",
        text: "마켓플레이스에 제작서 공유가 추가됐습니다. 등록한 매물은 24시간 후 자동 유찰됩니다.",
      },
      {
        category: "feature",
        text: "광장에 옵트인 랭킹 시스템이 추가됐습니다 — 모험가 명부에 등록해 레벨 / 명성 / 전투 횟수 순위를 확인할 수 있어요.",
      },
      {
        category: "feature",
        text: "캐릭터 탭에 '의뢰 수첩' 이 추가됐습니다. 진행 중인 의뢰와 완료한 의뢰를 한눈에 확인할 수 있습니다.",
      },
      {
        category: "feature",
        text: "모험의 서 NPC 탭이 마을별 하위 탭으로 분류됩니다.",
      },
      {
        category: "feature",
        text: "최근 기록이 시스템 / 전투 로그 두 탭으로 분리됐습니다 (각 그룹당 10개 보관).",
      },
      {
        category: "feature",
        text: "일부 NPC(잡화상 보로 · 여관 주인 노라 · 꼬마 리오 · 후드를 쓴 손님) 초상화가 추가됐습니다.",
      },
      {
        category: "balance",
        text: "낡은 못 드랍률을 5% → 10% 로 상향했습니다. 리오의 수집 요구량은 50개 → 20개로 줄였어요.",
      },
      {
        category: "balance",
        text: "망령의 망토 옵션을 방어력 +2 / 민첩 +1 / 속도 +2 로 강화했습니다.",
      },
      {
        category: "balance",
        text: "끈끈이 망토가 '비단 로브' 로 개명되며 옵션이 방어력 +2 / 행운 +4 로 조정됐습니다.",
      },
      {
        category: "balance",
        text: "활력의 반지에 '요정의 가호' 효과가 추가됐습니다.",
      },
      {
        category: "fix",
        text: "캐릭터 정보의 '전투 전적' 이 항상 0으로 표시되던 문제를 수정했습니다.",
      },
      {
        category: "fix",
        text: "자동 사냥이 게임 내 탭 이동 중에도 정상적으로 누적되도록 수정했습니다.",
      },
      {
        category: "fix",
        text: "모바일 헤더에서 팝업과 토스트가 화면 밖으로 잘리던 문제를 수정했습니다.",
      },
    ],
  },
];
