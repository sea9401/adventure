"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";

export function NamePromptModal({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [pending, setPending] = useState("");
  const trimmed = pending.trim();
  const valid = trimmed.length > 0 && trimmed !== "모험가";

  const submit = () => {
    if (valid) onSubmit(trimmed);
  };

  return (
    <ModalShell
      onClose={() => {}}
      size="sm"
      zIndex={100}
      closeOnBackdrop={false}
      showCloseButton={false}
    >
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-fg-strong">캐릭터 이름을 정해주세요</h2>
          <p className="text-xs text-fg-faint mt-1">
            채팅 닉네임으로도 사용됩니다. (1~20자, &quot;모험가&quot; 불가)
          </p>
        </div>
        <input
          autoFocus
          value={pending}
          onChange={(e) => setPending(e.target.value.slice(0, 20))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="이름 입력"
          maxLength={20}
          className="w-full bg-panel-2 border border-line-2 rounded px-3 py-2 text-sm text-fg-strong focus:outline-none focus:border-fg-faint"
        />
        <button
          onClick={submit}
          disabled={!valid}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-30"
        >
          확인
        </button>
      </div>
    </ModalShell>
  );
}
