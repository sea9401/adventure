// 퀘스트 완료 시 자동 적용 효과의 순수 데이터 정의 — 클라(useQuestActions)와
// 서버(lib/server/questReward) 가 공용. 적용 로직(grantTitle/storyFlags.set)은
// 각 측에서 자신 환경에 맞게 호출한다.

export type QuestSideEffect =
  | { kind: "grantTitle"; titleId: string }
  | { kind: "setFlag"; flag: string };

// 의뢰 ID → 완료 시 즉시 적용할 효과들 (전제 조건 없음).
export const QUEST_COMPLETION_DIRECT: Record<
  string,
  readonly QuestSideEffect[]
> = {
  // 마린의 영혼 결정 의뢰 = "안개 너머의 길" 라인의 클로저.
  "diola-marin-soul-crystals": [{ kind: "grantTitle", titleId: "diola_friend" }],
  // 운향 메인 라인 "잠들지 않는 산" — 백운의 운봉의 거인 의뢰 완수.
  "unhyang-baekun-peak-giant": [
    { kind: "grantTitle", titleId: "mountain_friend" },
    { kind: "setFlag", flag: "unhyang_main_cleared" },
  ],
  // 해안 지선 메인 라인 "수심의 것" — 여울의 보스 의뢰 완수.
  "saltmarsh-yeoul-deep-one": [{ kind: "grantTitle", titleId: "saltmarsh_friend" }],
  // 여울의 보스 재도전 3종.
  "saltmarsh-yeoul-challenge-pristine": [
    { kind: "grantTitle", titleId: "pristine_diver" },
  ],
  "saltmarsh-yeoul-challenge-no-potion": [
    { kind: "grantTitle", titleId: "dry_diver" },
  ],
  "saltmarsh-yeoul-challenge-abyssal-set": [
    { kind: "grantTitle", titleId: "abyssal_envoy" },
  ],
  // 서편 옛길 메인 라인 "옛 성문지기" — 무진의 보스 의뢰 완수.
  "dustford-mujin-gatekeeper": [{ kind: "grantTitle", titleId: "dustford_friend" }],
  "dustford-mujin-challenge-pristine": [
    { kind: "grantTitle", titleId: "pristine_warden" },
  ],
  "dustford-mujin-challenge-no-potion": [
    { kind: "grantTitle", titleId: "bare_hands_warden" },
  ],
  "dustford-mujin-challenge-garrison-set": [
    { kind: "grantTitle", titleId: "last_garrison" },
  ],
  // 천공 성지 메인 라인 "능선 너머의 봉인" — 해무의 마지막 자물쇠 완수.
  "skyreach-haemu-flame-scale": [
    { kind: "grantTitle", titleId: "ridge_crosser" },
    { kind: "setFlag", flag: "skyreach_main_cleared" },
  ],
  // 별바다 노수호자 유성 게이트 의뢰.
  "star-haven-skyfolk-gate": [
    { kind: "setFlag", flag: "skyfolk_gate_cleared" },
  ],
  "star-haven-apex-gate": [{ kind: "setFlag", flag: "apex_gate_cleared" }],
  // 별바다 유성 — 후반 3코옵 보스 도전 의뢰 9종.
  "star-haven-keeper-challenge-witness": [
    { kind: "grantTitle", titleId: "starlight_witness" },
  ],
  "star-haven-keeper-challenge-strike": [
    { kind: "grantTitle", titleId: "starlight_striker" },
  ],
  "star-haven-keeper-challenge-survive": [
    { kind: "grantTitle", titleId: "starlight_steadfast" },
  ],
  "star-haven-king-challenge-witness": [
    { kind: "grantTitle", titleId: "ruin_witness" },
  ],
  "star-haven-king-challenge-strike": [
    { kind: "grantTitle", titleId: "ruin_striker" },
  ],
  "star-haven-king-challenge-survive": [
    { kind: "grantTitle", titleId: "ruin_steadfast" },
  ],
  "star-haven-arbiter-challenge-witness": [
    { kind: "grantTitle", titleId: "throne_witness" },
  ],
  "star-haven-arbiter-challenge-strike": [
    { kind: "grantTitle", titleId: "throne_striker" },
  ],
  "star-haven-arbiter-challenge-survive": [
    { kind: "grantTitle", titleId: "throne_steadfast" },
  ],
  // 마을 간 연계.
  "diola-marin-mountain-trade": [
    { kind: "setFlag", flag: "diola_unhyang_trade_done" },
  ],
  // 무진의 옛길 정리 — 옛 변경 성채 봉인 해제. MujinDialogue 에서 클라가
  // setFlag 하던 것을 서버 side-effect 로 이전(EPIC #3-2).
  "dustford-mujin-clear-road": [
    { kind: "setFlag", flag: "oldwall_keep_unsealed" },
  ],
  "unhyang-sanha-nora-herbs": [
    { kind: "setFlag", flag: "sanha_nora_herbs_sent" },
    { kind: "grantTitle", titleId: "herbalists_courier" },
  ],
  "village-jimmy-doyeon-timber": [
    { kind: "setFlag", flag: "jimmy_doyeon_timber_done" },
  ],
};

// "이 의뢰들이 모두 completed 되면 효과 적용". 방금 완료한 의뢰는 멤버에 포함돼 있고,
// 나머지가 모두 completed 인지로 판정한다.
export const QUEST_COMPLETION_GROUPS: readonly {
  members: readonly string[];
  effects: readonly QuestSideEffect[];
}[] = [
  // 교역로 정리 2종(협곡 절벽 늑대 + 산기슭 산양) 둘 다 완료 → 디올라 연계 입구 개방.
  {
    members: ["unhyang-baekun-cliff-wolves", "unhyang-baekun-highland-goats"],
    effects: [{ kind: "setFlag", flag: "mountain_trade_open" }],
  },
  // 보스 누적 사냥 의뢰 3종 모두 완수 → '거대한 사냥꾼' 칭호.
  {
    members: ["deep-cave-hunter", "peak-giant-hunter", "volcano-heart-hunter"],
    effects: [{ kind: "grantTitle", titleId: "boss_hunter" }],
  },
  // 바람골 노을의 호위 의뢰 2종 모두 완수.
  {
    members: [
      "windvale-merchant-escort-raiders",
      "windvale-merchant-escort-hawks",
    ],
    effects: [{ kind: "grantTitle", titleId: "caravan_warden" }],
  },
];
