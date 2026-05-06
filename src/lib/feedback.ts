// 피드백 데이터 모델 + 클라이언트 전송 헬퍼

export type FeedbackType = "bug" | "suggestion" | "general";

export type FeedbackContext = {
  nickname?: string;
  level?: number;
  className?: string;
  tab?: string;
  version?: string;
  userAgent?: string;
};

export type FeedbackEntry = {
  id: string;
  at: number;
  type: FeedbackType;
  text: string;
  contact?: string;
  context: FeedbackContext;
  ipHash: string;
  status: "new" | "read" | "resolved" | "dismissed";
};

export type FeedbackInput = {
  type: FeedbackType;
  text: string;
  contact?: string;
  context: FeedbackContext;
};

export async function sendFeedback(
  input: FeedbackInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: string;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}
