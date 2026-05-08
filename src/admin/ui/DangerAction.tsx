"use client";

import { useState } from "react";
import { Button, TextInput } from "./Field";

// 파괴적 액션을 2단계 확인으로 감싼다. 사용자가 confirmText 와 동일한 문자열을
// 정확히 입력해야 onConfirm 이 실행됨.
export function DangerAction({
  trigger,
  title,
  description,
  confirmText,
  onConfirm,
  disabled,
}: {
  trigger: string;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const close = () => {
    setOpen(false);
    setInput("");
  };

  return (
    <>
      <Button variant="danger" disabled={disabled} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              계속하려면 아래에{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                {confirmText}
              </code>
              {" "}을(를) 입력하세요.
            </p>
            <div className="mt-2">
              <TextInput
                value={input}
                onChange={setInput}
                placeholder={confirmText}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={close}>취소</Button>
              <Button
                variant="danger"
                disabled={input !== confirmText}
                onClick={() => {
                  onConfirm();
                  close();
                }}
              >
                실행
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
