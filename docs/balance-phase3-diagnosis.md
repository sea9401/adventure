# 밸런스 Phase 3 진단 (2026-05-24)

## 1. 회피 메타

- 측정 셋업
  - `node --import tsx scripts/sim-progression.ts`
  - 5빌드: STR/DEX/SPD/LUK/BAL, 레벨별 적정 장비, 1h `offlineSim` + 지역 보스 100회 WR.
  - 마일스톤: Lv6/18/20/40/55/70/80/90.
  - 주의: progression의 Lv80 DEX 스킬은 4슬롯 제한 때문에 `EVADE+COUNTER+PRECISION+SHADOW_CLONE`이며, `ANALYSIS` 활성 폭발은 region sweep/ablation에서 별도 측정했다.

- 결과 표

| 레벨/지역 | STR exp/h, WR | DEX exp/h, WR | SPD exp/h, WR | LUK exp/h, WR | BAL exp/h, WR | DEX 격차 |
|---|---:|---:|---:|---:|---:|---:|
| Lv55 화산 지대 | 2,965 / 0% | 5,318 / 10% | 3,777 / 0% | 2,927 / 0% | 2,706 / 0% | 비DEX 최고 대비 1.4x |
| Lv70 별의 첨탑 | 3,372 / 0% | 7,584 / 25% | 3,518 / 0% | 3,531 / 0% | 3,950 / 0% | 비DEX 최고 대비 1.9x |
| Lv80 선인의 폐도 | 2,707 / 0% | 47,638 / 14% | 1,231 / 0% | 1,555 / 0% | 1,584 / 0% | 비DEX 최고 대비 17.6x |
| Lv90 창공의 옥좌 | 712 / 0% | 7,149 / 17% | 356 / 0% | 1,068 / 0% | 0 / 0% | 비DEX 최고 대비 6.7x |

- 해석
  - DEX 우위는 Lv55부터 보이고, Lv70에서 이미 보스 WR이 DEX만 25%다.
  - 핵심 이상치는 Lv80이다. progression 기준에서도 DEX는 47,638 exp/h로 비DEX 최고 STR 2,707 exp/h의 17.6배다.
  - Lv90에서는 모든 빌드가 벽에 걸리지만 DEX만 7,149 exp/h와 보스 WR 17%를 유지한다.
  - progression의 DEX Lv80은 `ANALYSIS`가 빠진 보수 측정이다. `ANALYSIS` 활성 Lv80 DEX는 region sweep에서 선인의 폐도 320,942 exp/h, ablation에서 321,207 exp/h까지 올라갔다.
  - 정수 단위 차이는 seed 없는 노이즈 가능성이 있으나, Lv80 DEX와 비DEX의 6x~17x 격차 및 ANALYSIS 활성/비활성 4x 이상 격차는 2x 기준을 넘어서 신뢰 가능하다.

- 권장 다음 단계
  - 우선 DEX 회피 루프를 Phase 3 1순위로 본다.
  - Lv65+ `ANALYSIS`의 누적 DEF/ATK 감소량 또는 발동 빈도를 낮춰 Lv80 선인의 폐도 exp/h를 현재 321k에서 120k 이하로 제한하는 방향을 먼저 sim한다.

## 2. 부활 amp

- 측정 셋업
  - `node --import tsx scripts/sim-dex65-ablation.ts`
  - Lv80 DEX, `skyfolk_ruins`, 1h `offlineSim`.
  - 장비: `aether_lance` / `star_robe` / `corridor_mantle`.
  - 스킬은 slice 함정을 피하기 위해 케이스별 명시 배열을 사용했다.
  - 추가 추적: `node --import tsx scripts/sim-analysis-trace.ts`.

- 결과 표

| 셋업 | battles | wins | revives | exp |
|---|---:|---:|---:|---:|
| `EVADE+COUNTER+CLONE+ANALYSIS` | 1,241 | 1,241 | 0 | 317,385 |
| `EVADE+COUNTER+PRECISION+ANALYSIS` | 1,260 | 1,260 | 0 | 321,207 |
| `EVADE+COUNTER+PRECISION+CLONE` | 299 | 296 | 3 | 76,066 |
| `EVADE+COUNTER+PRECISION` | 40 | 37 | 3 | 9,578 |
| `EVADE+COUNTER+ANALYSIS` | 1,218 | 1,218 | 0 | 310,771 |
| `EVADE+COUNTER` | 89 | 86 | 3 | 21,721 |

| trace 대상 | ANALYSIS | 10회 승 | 평균 턴 | 평균 받은 피해 |
|---|---|---:|---:|---:|
| 천공인 사관 | 있음 | 10/10 | 17.4 | 13 |
| 천공인 사관 | 없음 | 10/10 | 14.5 | 9 |
| 천공인 전사 | 있음 | 10/10 | 21.9 | 24 |
| 천공인 전사 | 없음 | 10/10 | 20.9 | 36 |
| 폐허의 거상 | 있음 | 10/10 | 26.6 | 25 |
| 폐허의 거상 | 없음 | 10/10 | 27.6 | 92 |

- 해석
  - 부활 amp는 실재한다. `revives 0`인 ANALYSIS 케이스는 1,218~1,260 wins/h이고, `revives 3`인 비ANALYSIS 케이스는 37~296 wins/h다.
  - 다만 이번 출력은 "revives 1 차이 -> wins 2~3배"가 아니라 "revives 0 vs 3 + ANALYSIS 생존성"이 동시에 나타난다. revives만의 순수 기여와 ANALYSIS의 전투 턴/피해 기여가 섞여 있다.
  - trace에서 폐허의 거상 상대 평균 받은 피해가 ANALYSIS 없음 92, 있음 25로 줄었다. 단일 상세 로그도 ANALYSIS 있음 최종 페널티가 ATK -21 / DEF -21까지 누적됐다.
  - `EVADE+COUNTER+ANALYSIS`가 `EVADE+COUNTER` 대비 1,218 vs 86 wins/h로 14.2배라서, 폭발의 주 원인은 부활 페널티 단독보다 ANALYSIS로 사망 구간을 0으로 만드는 생존 임계 통과에 가깝다.

- 권장 다음 단계
  - revive 페널티 자체를 먼저 바꾸기보다, ANALYSIS가 revives를 3에서 0으로 떨어뜨리는 임계점을 낮추는 쪽을 우선 검증한다.
  - 별도 후속 sim으로 revive 페널티만 20분에서 10분/5분으로 낮춘 대조군을 추가하면 부활 amp의 순수 효과를 분리할 수 있다.

## 3. Lv75→80 절벽

- 측정 셋업
  - `node --import tsx scripts/sim-region-sweep.ts`
  - Lv80 DEX 메타 빌드, `EVADE+COUNTER+PRECISION+ANALYSIS`, `analysisPerTurn=3`.
  - 본토+별빛 전 지역 중 enemies가 있는 지역 29개를 1h `offlineSim`으로 측정.

- 결과 표

| 권장Lv | regionId | 지역명 | wins | revives | exp/h |
|---:|---|---|---:|---:|---:|
| 70 | `starspire` | 별의 첨탑 | 1,447 | 0 | 249,752 |
| 75 | `scalefall_barrows` | 용비늘 묘지 | 1,857 | 0 | 397,704 |
| 75 | `star_corridor` | 별빛 회랑 | 1,288 | 0 | 268,323 |
| 80 | `skyfolk_ruins` | 선인의 폐도 | 1,259 | 0 | 320,942 |
| 85 | `throne_road` | 옥좌의 길 | 47 | 3 | 14,790 |
| 90 | `apex_throne` | 창공의 옥좌 | 9 | 3 | 3,106 |
| 100 | `starfall_cave` | 별빛 갱도 | 0 | 3 | 0 |
| 102 | `starlit_canyon` | 별빛 협곡 | 0 | 3 | 0 |
| 104 | `starlit_reef` | 별빛 산호초 | 0 | 3 | 0 |
| 106 | `starlit_keep` | 별빛 성채 | 0 | 3 | 0 |

- 해석
  - "Lv75 별빛회랑이 효율 1위"는 재현되지 않았다. 같은 Lv75의 용비늘 묘지가 397,704 exp/h로 1위이고, 별빛 회랑은 268,323 exp/h로 3위다.
  - Lv80 선인의 폐도는 320,942 exp/h로 2위이며, Lv75 용비늘 묘지보다 낮지만 Lv70 별의 첨탑보다 높다.
  - 진짜 절벽은 Lv80 이후다. Lv85 옥좌의 길은 14,790 exp/h, Lv90 창공의 옥좌는 3,106 exp/h로 급락하고 revives가 3으로 고정된다.
  - Lv75→80 자체는 상승 또는 고효율 구간이며, Lv80→85에서 수익이 약 21.7배 하락한다. 정수 노이즈로 설명하기 어려운 규모다.

- 권장 다음 단계
  - "Lv75→80 절벽" 후보는 "Lv80→85 절벽"으로 재명명하는 것이 맞다.
  - Lv85 `throne_road`의 몬스터 체력/공격 또는 exp 보상을 조정해 Lv80 DEX 메타 기준 최소 120k exp/h 이상이 나오도록 재측정한다.

## 4. 종합

- 우선순위
  1. 회피 메타 + ANALYSIS: Lv80에서 비DEX 대비 최소 17.6x, ANALYSIS 활성 시 321k exp/h까지 폭발.
  2. Lv80→85 절벽: Lv80 선인의 폐도 320,942 exp/h에서 Lv85 옥좌의 길 14,790 exp/h로 급락.
  3. 부활 amp: revives 0 vs 3에서 wins/h가 4x~33x 차이나지만, ANALYSIS 효과와 섞여 있어 순수 revive 문제는 추가 격리가 필요.

- 다음 작업 1개 제안
  - `ANALYSIS`를 먼저 너프하는 단일 PR을 제안한다. 구체적으로 `analysisPerTurn` 효과를 현재 3에서 1로 낮춘 대조 sim을 만들고, 목표치를 Lv80 `skyfolk_ruins` DEX `EVADE+COUNTER+PRECISION+ANALYSIS` 기준 321,207 exp/h -> 120,000 exp/h 이하, revives 0~1 범위로 둔다.

## 5. 후속 측정 (2026-05-24, post-#535 머지)

#535 (ANALYSIS divisor 30→50 + cap 30%) 머지 직후 같은 sim 재실행.

| 셋업 | pre-#535 | post-#535 | 변화 |
|---|---:|---:|---:|
| `EVADE+COUNTER+PRECISION+ANALYSIS` (Lv80 폐도 메타) | 321,207 | **107,284** | **-66.6%** |
| `EVADE+COUNTER+CLONE+ANALYSIS` | 317,385 | 62,584 | -80.3% |
| `EVADE+COUNTER+ANALYSIS` (2슬롯+ANALYSIS) | 310,771 | 36,855 | -88.1% |

region-sweep 의 폐도 결과 106,978 exp 와 ablation 의 107,284 exp 가 거의 일치 — stochastic 노이즈 작아 신뢰 가능.

- **목표 121k 이하 달성** (107k). 추가 너프 (`analysisPerTurn` 3→1) 불필요.
- Lv75 농사 메타는 여전. 용비늘 묘지 381k / 별빛 회랑 266k > Lv80 폐도 107k. 만렙도 Lv75 농사가 효율 1위인 구조는 별건.
- Lv80→85 절벽 그대로. Lv80 폐도 107k → Lv85 옥좌의 길 3.5k (약 30×). #535 가 폐도를 너프해 격차는 좁혀졌으나 절벽 자체는 그대로.

**결정**:
1. `analysisPerTurn` 너프 PR-B 보류 — 불필요
2. 다음 후보: Lv80→85 절벽 (옥좌의 길 몬스터 HP/exp 조정) 또는 잔여 Phase 후보 (LUK 행운의 별⊕만개·STR/VIT compound sustain)
