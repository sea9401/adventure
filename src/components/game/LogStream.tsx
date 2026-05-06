"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { BossDispatchResult, DispatchResult, ElementKind } from "@/lib/game/types";
import { HpBar } from "./HpBar";

// 원소 인디케이터 — 현재 스택 (cap 3) + 잔존 턴 수 표시
function ElementIndicator({
  stacks,
  lingerTurns,
}: {
  stacks?: ElementKind[];
  lingerTurns?: number;
}) {
  if (!stacks) return null;
  const slots: (ElementKind | null)[] = [stacks[0] ?? null, stacks[1] ?? null, stacks[2] ?? null];
  const emoji = (k: ElementKind | null) =>
    k === "fire" ? "🔥" : k === "ice" ? "❄️" : k === "lightning" ? "⚡" : "⚪";
  const color = (k: ElementKind | null) =>
    k === "fire"
      ? "text-red-400"
      : k === "ice"
        ? "text-cyan-300"
        : k === "lightning"
          ? "text-violet-400"
          : "text-fg-faint";
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-fg-faint">원소</span>
      <div className="flex gap-0.5">
        {slots.map((k, i) => (
          <span key={i} className={color(k)}>
            {emoji(k)}
          </span>
        ))}
      </div>
      {lingerTurns !== undefined && lingerTurns > 0 && (
        <span className="text-amber-300/70 ml-1">✨ 잔존 {lingerTurns}T</span>
      )}
    </div>
  );
}

// 자동 스크롤 + 사용자 의도 존중 헬퍼.
// 사용자가 위로 스크롤한 상태에서는 자동 스크롤 일시 중단 (모바일에서 로그를 거슬러 읽을 때 어지러움 방지).
function useAutoScroll(deps: ReadonlyArray<unknown>) {
  const ref = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distFromBottom < 24);
  }, []);
  useEffect(() => {
    if (pinned && ref.current) {
      ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, pinned]);
  return { ref, onScroll };
}

// 토큰 prefix 이모지별 색상 매핑
function colorizeLogText(text: string): ReactNode {
  if (text === "—") return <span className="text-fg-dim">—</span>;
  return text.split(" · ").map((token, i, arr) => {
    let cls = "text-fg";
    // 원소술사 (24 plan) — 원소 부여 / 콤보 발동을 distinct하게 강조
    if (token.includes("불의 원소")) cls = "text-red-400";
    else if (token.includes("얼음 원소")) cls = "text-cyan-300";
    else if (token.includes("번개 원소")) cls = "text-violet-400";
    else if (
      token.includes("지옥불") ||
      token.includes("절대영도") ||
      token.includes("뇌신강림") ||
      token.includes("마그마 폭발") ||
      token.includes("플라즈마") ||
      token.includes("빙뢰 폭풍") ||
      token.includes("원소 조화") ||
      token.includes("원소 조합")
    )
      cls = "text-amber-300 font-medium";
    else if (
      token.startsWith("⚔") ||
      token.startsWith("🔥") ||
      token.startsWith("☠") ||
      token.startsWith("⚖") ||
      token.startsWith("🔁") ||
      token.startsWith("⚒") ||
      (token.startsWith("💀") && token.includes("처치"))
    )
      cls = "text-emerald-400";
    else if (token.startsWith("🛡")) cls = "text-red-400";
    else if (token.startsWith("✨") || token.startsWith("💨")) cls = "text-sky-400";
    else if (token.startsWith("💗") || token.startsWith("🩸")) cls = "text-green-400";
    else if (token.startsWith("⚡") || token.startsWith("🌪")) cls = "text-amber-400";
    else if (token.startsWith("💀")) cls = "text-red-500 font-medium";
    else if (token.startsWith("✋")) cls = "text-fg-faint";
    return (
      <span key={i}>
        <span className={cls}>{token}</span>
        {i < arr.length - 1 && <span className="text-fg-dim"> · </span>}
      </span>
    );
  });
}

export function DispatchLogStream({
  result,
  startedAt,
  characterMaxHp,
  totalDurationMs,
}: {
  result: DispatchResult;
  startedAt: number;
  characterMaxHp: number;
  totalDurationMs: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const elapsedMs = Math.max(0, now - startedAt);
  const frac = Math.min(1, elapsedMs / totalDurationMs);
  const visibleCount = Math.floor(frac * result.log.length);
  const visible = result.log.slice(0, visibleCount);
  const last = visible[visible.length - 1];
  const { ref: scrollRef, onScroll } = useAutoScroll([visible.length]);

  if (visible.length === 0) {
    return <div className="mt-3 text-xs text-fg-faint italic">탐험 시작...</div>;
  }
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs">
        <div className="text-fg-faint">캐릭터 HP</div>
        <div className="text-fg font-medium">
          {last.playerHpAfter} / {characterMaxHp}
        </div>
        <HpBar pct={last.playerHpAfter / Math.max(1, characterMaxHp)} />
        {(last.elements?.length ?? 0) > 0 || (last.elementLingerTurns ?? 0) > 0 ? (
          <div className="mt-1">
            <ElementIndicator stacks={last.elements} lingerTurns={last.elementLingerTurns} />
          </div>
        ) : null}
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-32 overflow-y-auto bg-canvas border border-line rounded p-2 text-xs space-y-0.5"
      >
        {visible.map((entry, i) => {
          const isLatest = i === visible.length - 1;
          return (
            <div
              key={i}
              className={`break-words ${isLatest ? "bg-panel/60 -mx-2 px-2 rounded" : ""}`}
            >
              <span className="text-fg-dim mr-2">T{entry.turn}</span>
              {colorizeLogText(entry.text)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BossLogStream({
  result,
  startedAt,
  boss,
  characterMaxHp,
  totalDurationMs = 30000,
}: {
  result: BossDispatchResult;
  startedAt: number;
  boss: { name: string; hp: number };
  characterMaxHp: number;
  totalDurationMs?: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, now - startedAt);
  const frac = Math.min(1, elapsedMs / totalDurationMs);
  const visibleCount = Math.floor(frac * result.log.length);
  const visible = result.log.slice(0, visibleCount);
  const last = visible[visible.length - 1];
  const { ref: scrollRef, onScroll } = useAutoScroll([visible.length]);

  if (visible.length === 0) {
    return <div className="mt-3 text-xs text-fg-faint italic">전투 시작...</div>;
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-fg-faint">캐릭터 HP</div>
          <div className="text-fg font-medium">
            {last.playerHpAfter} / {characterMaxHp}
          </div>
          <HpBar pct={last.playerHpAfter / Math.max(1, characterMaxHp)} />
        </div>
        <div>
          <div className="text-fg-faint">{boss.name} HP</div>
          <div className="text-amber-300 font-medium">
            {last.bossHpAfter} / {boss.hp}
          </div>
          <HpBar pct={last.bossHpAfter / Math.max(1, boss.hp)} />
        </div>
      </div>
      {(last.elements?.length ?? 0) > 0 || (last.elementLingerTurns ?? 0) > 0 ? (
        <ElementIndicator stacks={last.elements} lingerTurns={last.elementLingerTurns} />
      ) : null}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-32 overflow-y-auto bg-canvas border border-line rounded p-2 text-xs space-y-0.5"
      >
        {visible.map((entry, i) => {
          const isLatest = i === visible.length - 1;
          return (
            <div
              key={i}
              className={`break-words ${isLatest ? "bg-panel/60 -mx-2 px-2 rounded" : ""}`}
            >
              <span className="text-fg-dim mr-2">T{entry.turn}</span>
              {colorizeLogText(entry.text)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
