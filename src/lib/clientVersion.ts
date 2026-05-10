// 클라이언트/서버 모두가 import 하는 build version 상수.
// - 클라이언트: 번들에 baked-in. 마지막 페이지 로드 시점의 값.
// - 서버: 런타임에 import. 현재 deploy 의 값.
// 두 값이 다르면 클라이언트가 옛 JS 를 들고 있는 것 → /api/presence 응답으로
// 신호 받아 location.reload 로 강제 갱신.
//
// 모든 활성 유저 강제 리로드가 필요한 변경을 deploy 하기 전에 이 값을 bump.
// 예: 단일 세션 enforce 추가, 데이터 contract 변경, 등.
export const APP_BUILD_VERSION = "2026-05-10-single-session";
