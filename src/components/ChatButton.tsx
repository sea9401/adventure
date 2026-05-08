"use client";

import { useState } from "react";
import { ChatCircle } from "@phosphor-icons/react";
import { ChatPanel } from "./ChatPanel";

export function ChatButton({
  name,
  className,
}: {
  name: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="전체 채팅 열기"
        title="전체 채팅"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <ChatCircle size={20} weight="duotone" />
      </button>
      <ChatPanel
        open={open}
        onClose={() => setOpen(false)}
        name={name}
        className={className}
      />
    </>
  );
}
