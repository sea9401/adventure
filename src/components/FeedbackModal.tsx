"use client";

import { useState } from "react";
import { useGame } from "@/lib/game/store";
import { sendFeedback, type FeedbackType } from "@/lib/feedback";
import { ModalShell } from "@/components/ui/ModalShell";

const TYPES: { id: FeedbackType; label: string }[] = [
  { id: "bug", label: "버그" },
  { id: "suggestion", label: "제안" },
  { id: "general", label: "기타" },
];

const MAX_TEXT = 1000;
const MAX_CONTACT = 100;

export default function FeedbackModal({ onClose }: { onClose: () => void }) {
  const character = useGame((s) => s.character);
  const [type, setType] = useState<FeedbackType>("general");
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const onSubmit = async () => {
    if (busy) return;
    if (!text.trim()) {
      setStatus({ kind: "err", text: "내용을 입력해주세요" });
      return;
    }
    setBusy(true);
    setStatus(null);
    const userAgent =
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : undefined;
    const r = await sendFeedback({
      type,
      text: text.trim(),
      contact: contact.trim() || undefined,
      context: {
        nickname: character.name,
        level: character.level,
        className: character.advancedClass ?? character.currentClass,
        userAgent,
      },
    });
    setBusy(false);
    if (r.ok) {
      setStatus({ kind: "ok", text: "보내주셨습니다. 감사합니다!" });
      setText("");
      setContact("");
      setTimeout(onClose, 1500);
    } else {
      setStatus({ kind: "err", text: r.error ?? "전송 실패" });
    }
  };

  return (
    <ModalShell title="의견 보내기" onClose={onClose} size="md" zIndex={200}>
      <div className="p-4 space-y-3">
        <div>
          <div className="text-xs text-fg-muted mb-1">종류</div>
          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`text-xs px-3 py-1.5 rounded-md border ${
                  type === t.id
                    ? "border-fg-strong text-fg-strong bg-panel"
                    : "border-line-2 text-fg-muted hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs text-fg-muted">내용</span>
            <span className="text-[10px] text-fg-faint tabular-nums">
              {text.length}/{MAX_TEXT}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
            rows={5}
            className="w-full bg-canvas border border-line rounded-md px-2 py-1.5 text-sm resize-none"
            placeholder="버그 / 제안 / 의견을 자유롭게 적어주세요"
          />
        </div>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs text-fg-muted">연락처 (선택)</span>
            <span className="text-[10px] text-fg-faint tabular-nums">
              {contact.length}/{MAX_CONTACT}
            </span>
          </div>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value.slice(0, MAX_CONTACT))}
            type="text"
            className="w-full bg-canvas border border-line rounded-md px-2 py-1.5 text-sm"
            placeholder="이메일 / 디스코드 등"
          />
        </div>
        <p className="text-[10px] text-fg-faint">
          전송 시 캐릭터 이름·레벨·직업이 자동 첨부됩니다.
        </p>
        {status && (
          <div className={`text-xs ${status.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>
            {status.text}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-line-2">
        <button onClick={onClose} className="text-fg-muted hover:text-fg text-sm px-3 py-1.5">
          취소
        </button>
        <button
          onClick={onSubmit}
          disabled={busy || !text.trim()}
          className="bg-fg-strong text-canvas px-4 py-1.5 text-sm rounded-md disabled:opacity-30"
        >
          {busy ? "보내는 중..." : "보내기"}
        </button>
      </div>
    </ModalShell>
  );
}
