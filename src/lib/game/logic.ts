// === lib/game/logic.ts — 도메인 모듈 배럴 ===
// doc 27 §4 적용 완료. 모든 게임 로직은 도메인별 모듈로 분리됐고
// 본 파일은 전체 모듈을 re-export하는 배럴 역할만 담당.
//
// 기존 `from "@/lib/game/logic"` import 경로 100% 호환을 위한 보존.
// 새 코드는 직접 경로(`from "@/lib/game/combat/resolve-dispatch"` 등) 사용 권장.

export * from "./equipment-helpers";
export * from "./monument";
export * from "./stats";
export * from "./codex";
export * from "./skills";
export * from "./helpers";
export * from "./progression";
export * from "./estate-tick";
export * from "./achievements";
export * from "./initial-state";
export * from "./combat/element";
export * from "./combat/damage";
export * from "./combat/estimate";
export * from "./combat/resolve-dispatch";
export * from "./combat/resolve-boss-dispatch";
export * from "./combat/simulate-coop";
