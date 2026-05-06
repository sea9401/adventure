// Vercel Analytics 커스텀 이벤트 헬퍼.
// 클라이언트에서만 호출. 서버에서 호출 시 noop.
import { track as vercelTrack } from "@vercel/analytics";

type Props = Record<string, string | number | boolean | null>;

export const track = (event: string, props?: Props): void => {
  if (typeof window === "undefined") return;
  try {
    vercelTrack(event, props);
  } catch {
    // 분석 실패가 본 흐름에 영향 X
  }
};
