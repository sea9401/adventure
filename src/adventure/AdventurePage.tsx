"use client";

import { useEffect, useState } from "react";

import ChatWidget from "@/components/game/ChatWidget";
import FeedbackButton from "@/components/FeedbackButton";
import { NamePromptModal } from "@/components/modals/NamePromptModal";
import { OfflineSummaryModal } from "@/components/modals/OfflineSummaryModal";
import { useGame } from "@/lib/game/store";
import type { LogEntry } from "@/lib/game/types";

import { AdventureView } from "./AdventureView";
import { BattleView } from "./BattleView";
import { CharacterView } from "./CharacterView";
import { VillageView } from "./VillageView";

type View = "adventure" | "battle" | "village" | "character";

export default function AdventurePage() {
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("adventure");
  const [offlineSummary, setOfflineSummary] = useState<{
    elapsedSec: number;
    goldGained: number;
    hpRecovered: number;
    finalizedDispatch?: LogEntry;
  } | null>(null);

  useEffect(() => {
    // SSR/hydration 게이트 — 클라이언트 마운트 후에만 store 데이터 사용
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  // 오프라인 요약 — 마운트 시 lastSeenAt 이후 경과 시간 체크
  useEffect(() => {
    if (!hydrated) return;
    const compute = async () => {
      const before = useGame.getState();
      const lastSeen = before.lastSeenAt ?? 0;
      const elapsed = Date.now() - lastSeen;
      if (lastSeen === 0 || elapsed < 30_000) return;

      const preGold = before.resources.gold;
      const preHp = before.character.currentHp;
      const preLogLen = before.log.length;
      const hadDispatch = before.dispatch;

      before.tick();
      if (hadDispatch && Date.now() >= hadDispatch.endsAt) {
        await before.finalizeDispatch();
      }

      const after = useGame.getState();
      const goldGained = Math.floor(after.resources.gold - preGold);
      const hpRecovered = Math.floor(after.character.currentHp - preHp);
      const finalizedDispatch = after.log.length > preLogLen ? after.log[0] : undefined;

      if (goldGained > 0 || hpRecovered > 0 || finalizedDispatch) {
        setOfflineSummary({
          elapsedSec: Math.floor(elapsed / 1000),
          goldGained,
          hpRecovered,
          finalizedDispatch,
        });
      }
    };
    compute();
  }, [hydrated]);

  const state = useGame();

  // 테마 동기화
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    if ((state.theme ?? "dark") === "light") html.classList.add("light");
    else html.classList.remove("light");
  }, [state.theme]);

  // tick + dispatch 자동 정산
  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => {
      state.tick();
      if (state.dispatch && Date.now() >= state.dispatch.endsAt) {
        state.finalizeDispatch();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [hydrated, state]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-canvas text-fg-faint flex items-center justify-center">
        불러오는 중...
      </div>
    );
  }

  const isDark = (state.theme ?? "dark") === "dark";

  return (
    <div className="min-h-screen bg-canvas text-fg pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg font-semibold tracking-wide shrink-0">모험 RPG</span>
          <div className="text-sm text-fg min-w-0 truncate">
            <span className="font-medium text-fg-strong">{state.character.name}</span>
            <span className="text-fg-faint ml-2">Lv.{state.character.level}</span>
          </div>
        </div>
        <button
          onClick={() => state.toggleTheme()}
          aria-label={isDark ? "라이트 모드" : "다크 모드"}
          title={isDark ? "라이트 모드로" : "다크 모드로"}
          className="text-lg w-9 h-9 inline-flex items-center justify-center rounded-md hover:bg-panel-2 transition-colors shrink-0"
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </header>

      <nav className="border-b border-line px-4 sm:px-6 flex gap-1 max-w-2xl mx-auto">
        <button
          onClick={() => setView("adventure")}
          className={`px-4 py-2 text-sm border-b-2 transition-colors ${
            view === "adventure"
              ? "border-fg-strong text-fg-strong"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          모험
        </button>
        <button
          onClick={() => setView("battle")}
          className={`px-4 py-2 text-sm border-b-2 transition-colors ${
            view === "battle"
              ? "border-fg-strong text-fg-strong"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          전투
        </button>
        <button
          onClick={() => setView("village")}
          className={`px-4 py-2 text-sm border-b-2 transition-colors ${
            view === "village"
              ? "border-fg-strong text-fg-strong"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          마을
        </button>
        <button
          onClick={() => setView("character")}
          className={`px-4 py-2 text-sm border-b-2 transition-colors ${
            view === "character"
              ? "border-fg-strong text-fg-strong"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          캐릭터
        </button>
      </nav>

      <main className="p-4 sm:p-8 max-w-2xl mx-auto space-y-4">
        {view === "adventure" && <AdventureView />}
        {view === "battle" && <BattleView />}
        {view === "village" && <VillageView />}
        {view === "character" && <CharacterView />}
      </main>

      <ChatWidget />
      {offlineSummary && (
        <OfflineSummaryModal
          summary={{ ...offlineSummary, ironGained: 0 }}
          onClose={() => setOfflineSummary(null)}
        />
      )}
      {(!state.character.name || state.character.name === "모험가") && (
        <NamePromptModal onSubmit={(name) => state.setCharacterName(name)} />
      )}
      {process.env.NEXT_PUBLIC_FEEDBACK_ENABLED === "1" && <FeedbackButton />}
    </div>
  );
}
