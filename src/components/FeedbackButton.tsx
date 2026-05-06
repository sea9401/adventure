"use client";

import { useState } from "react";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="피드백 보내기"
        className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)] right-4 z-40 rounded-full bg-panel-2 hover:bg-panel border border-line-2 hover:border-fg-muted text-fg-strong w-12 h-12 flex items-center justify-center shadow-lg transition-colors"
        title="피드백 보내기"
      >
        💬
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
