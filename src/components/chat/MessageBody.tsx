"use client";

import { useMemo } from "react";
import { parseChatContent } from "@/lib/chat-item-link";
import { ChatItemChip } from "../ChatItemChip";

// 메시지 본문 — [[item:...]] 토큰을 인라인 아이템 칩으로 치환. 토큰이 없으면 평문 그대로.
export function MessageBody({ content }: { content: string }) {
  const segments = useMemo(() => parseChatContent(content), [content]);
  if (segments.length === 1 && segments[0].type === "text") return <>{content}</>;
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <ChatItemChip key={i} link={seg} />
        ),
      )}
    </>
  );
}
