"use client";

import { useEffect, useRef, useState } from "react";
import type { BattleState } from "./engine";
import { MONSTERS } from "../data/monsters";
import {
  formatRelative,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";
import { Card } from "@/components/ui/Card";
import { avatarImageSrc, type Gender } from "@/adventure/profile/avatars";

export type BattlePlayerStatus = {
  gender: Gender;
  mp: number;
  maxMp: number;
  exp: number;
  maxExp: number;
};

const RECENT_KIND_COLOR: Record<NotificationKind, string> = {
  battle_win: "text-emerald-700 dark:text-emerald-400",
  battle_lose: "text-rose-700 dark:text-rose-400",
  training_done: "text-amber-700 dark:text-amber-400",
  quest_ready: "text-yellow-700 dark:text-yellow-400",
  quest_complete: "text-violet-700 dark:text-violet-400",
  milestone: "text-fuchsia-700 dark:text-fuchsia-400",
  expedition: "text-teal-700 dark:text-teal-400",
  loot: "text-lime-700 dark:text-lime-400",
  item: "text-blue-700 dark:text-blue-400",
  info: "text-zinc-600 dark:text-zinc-400",
};

const RECENT_NOTIFICATIONS_VISIBLE = 3;

function HpBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="flex items-center gap-3 text-[15px]">
      <span className="w-20 shrink-0 truncate text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
        {value}/{max}
      </span>
    </div>
  );
}

// 데미지 받은 순간 짧게 빨간 링 + 흔들림. hpDelta 가 변할 때마다 트리거.
function useDamageFlash(hp: number): boolean {
  const [flashing, setFlashing] = useState(false);
  const lastHpRef = useRef(hp);
  useEffect(() => {
    if (hp < lastHpRef.current) {
      setFlashing(true);
      const id = setTimeout(() => setFlashing(false), 350);
      lastHpRef.current = hp;
      return () => clearTimeout(id);
    }
    lastHpRef.current = hp;
  }, [hp]);
  return flashing;
}

const FLASH_CLASS =
  "ring-2 ring-rose-500 ring-offset-1 ring-offset-white animate-pulse dark:ring-offset-zinc-950";

// 텍스트 안의 데미지·회복 수치(예: "35 피해", "HP +12", "ATK +3") 를 굵게 강조한다.
// 시각적 우선순위 — 한 줄에서 가장 중요한 숫자가 먼저 눈에 들어와야 한다.
function emphasizeNumbers(text: string): React.ReactNode[] {
  const re = /(\d+)\s*피해|HP\s*[+-]\s*\d+|MP\s*[+-]\s*\d+|ATK\s*[+-]\s*\d+|DEF\s*[+-]\s*\d+|SPD\s*[+-]\s*\d+|[+-]\s*\d+%?/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <strong key={m.index} className="font-semibold">
        {m[0]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

// "[라벨1 + 라벨2] 본문" → { labels: ["라벨1", "라벨2"], body: "본문" }
function parseLabel(text: string): { labels: string[]; body: string } {
  const m = text.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!m) return { labels: [], body: text };
  const labels = m[1].split(/\s*\+\s*/).filter(Boolean);
  return { labels, body: m[2] };
}

// 결정적 이벤트 — 처치/사망/등장 — 인포 라인 안에서도 가운데에 살짝 강조.
function isClimaxInfo(text: string): boolean {
  return (
    text.includes("쓰러뜨렸다") ||
    text.includes("쓰러졌다") ||
    text.includes("나타났다") ||
    text.includes("선공") ||
    text.includes("능력 [")
  );
}

function AttackBubble({
  side,
  text,
}: {
  side: "left" | "right";
  text: string;
}) {
  const isPlayer = side === "left";
  const { labels, body } = parseLabel(text);
  const isCrit = labels.some((l) => l === "크리" || l === "크리티컬");
  // 빈 본문은 라벨만으로 의미가 있는 경우 (드물지만 안전망).
  const displayBody = body || labels.join(" + ");
  const bubbleColor = isPlayer
    ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-200"
    : "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-200";
  const labelColor = isPlayer
    ? "bg-emerald-200/70 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
    : "bg-rose-200/70 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200";
  return (
    <div className={`flex ${isPlayer ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-lg border px-2.5 py-1.5 text-sm leading-snug shadow-sm ${bubbleColor} ${
          isCrit ? "ring-1 ring-amber-400/70" : ""
        }`}
      >
        {(labels.length > 0 || isCrit) && (
          <div className="mb-0.5 flex flex-wrap gap-1">
            {isCrit && (
              <span className="text-xs leading-none text-amber-500 dark:text-amber-400">
                ★
              </span>
            )}
            {labels.map((l, idx) => (
              <span
                key={idx}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${labelColor}`}
              >
                {l}
              </span>
            ))}
          </div>
        )}
        <div>{body ? emphasizeNumbers(displayBody) : displayBody}</div>
      </div>
    </div>
  );
}

function InfoLine({ text, side }: { text: string; side: "left" | "right" | null }) {
  const { labels, body } = parseLabel(text);
  const climax = isClimaxInfo(text);
  // 진영 컬러 — 발화자 턴에 따라 왼쪽(나) / 오른쪽(적) 으로 살짝 띈다.
  // climax (처치/등장/선공) 는 좌/우 무관하게 가운데 강조.
  const align =
    climax || side === null
      ? "justify-center"
      : side === "left"
        ? "justify-start"
        : "justify-end";
  return (
    <div
      className={`flex items-center gap-1.5 px-1 text-xs ${align} ${
        climax
          ? "py-1 text-center font-medium text-zinc-700 dark:text-zinc-200"
          : "text-zinc-500 dark:text-zinc-400"
      }`}
    >
      {labels.map((l, idx) => (
        <span
          key={idx}
          className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {l}
        </span>
      ))}
      <span className={climax ? "" : "italic"}>{body ? emphasizeNumbers(body) : body}</span>
    </div>
  );
}

// 턴 시작 구분선. 가운데 라벨 + 양 옆 선.
function TurnMarker({ text }: { text: string }) {
  return (
    <div className="my-2 flex items-center gap-2 text-zinc-400 dark:text-zinc-600">
      <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {text}
      </span>
      <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
    </div>
  );
}

function EnemyAvatar({ name, hp }: { name: string; hp: number }) {
  const image = MONSTERS[name]?.image;
  const flash = useDamageFlash(hp);
  const ringClass = flash ? ` ${FLASH_CLASS}` : "";
  if (!image) {
    return (
      <div
        aria-hidden
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-2xl text-zinc-400 transition-all dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500${ringClass}`}
      >
        ?
      </div>
    );
  }
  return (
    <div
      className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 transition-all dark:border-zinc-700 dark:bg-zinc-800${ringClass}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}

function PlayerAvatar({
  gender,
  name,
  hp,
}: {
  gender: Gender;
  name: string;
  hp: number;
}) {
  const [errored, setErrored] = useState(false);
  const flash = useDamageFlash(hp);
  const ringClass = flash ? ` ${FLASH_CLASS}` : "";
  if (errored) {
    return (
      <div
        aria-hidden
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-2xl text-zinc-400 transition-all dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500${ringClass}`}
      >
        ?
      </div>
    );
  }
  return (
    <div
      className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 transition-all dark:border-zinc-700 dark:bg-zinc-800${ringClass}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarImageSrc(gender)}
        alt={name}
        onError={() => setErrored(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export function BattleScene({
  state,
  playerName,
  playerStatus,
  recentNotifications,
}: {
  state: BattleState;
  playerName: string;
  playerStatus: BattlePlayerStatus;
  recentNotifications?: AppNotification[];
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log]);

  const recents = (recentNotifications ?? []).slice(
    0,
    RECENT_NOTIFICATIONS_VISIBLE,
  );

  return (
    <div className="space-y-4">
      <Card padding="lg">
        <div className="flex items-center gap-4">
          <EnemyAvatar name={state.enemy.name} hp={state.enemyHp} />
          <div className="flex-1">
            <HpBar
              label={state.enemy.name}
              value={state.enemyHp}
              max={state.enemy.hp}
              color="bg-rose-500"
            />
          </div>
        </div>
        <div className="mt-4 flex items-start gap-4">
          <PlayerAvatar
            gender={playerStatus.gender}
            name={playerName}
            hp={state.playerHp}
          />
          <div className="flex-1 space-y-2.5">
            <HpBar
              label={playerName}
              value={state.playerHp}
              max={state.playerMaxHp}
              color="bg-emerald-500"
            />
            <HpBar
              label="MP"
              value={playerStatus.mp}
              max={playerStatus.maxMp}
              color="bg-sky-500"
            />
            <HpBar
              label="EXP"
              value={playerStatus.exp}
              max={playerStatus.maxExp}
              color="bg-amber-400"
            />
          </div>
        </div>
      </Card>

      <div
        ref={logRef}
        className="no-scrollbar h-[28rem] space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90"
      >
        {state.log.map((entry, i) => {
          if (entry.kind === "phase_trigger") {
            return (
              <div
                key={i}
                className="my-1 rounded border border-amber-400/60 bg-amber-100/70 px-2 py-1 text-sm text-amber-900 shadow-sm dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200"
              >
                <span className="mr-1">⚠</span>
                <span className="font-semibold">{entry.text}</span>
              </div>
            );
          }
          if (entry.kind === "turn_marker") {
            return <TurnMarker key={i} text={entry.text} />;
          }
          if (entry.kind === "info") {
            // info 의 좌/우 — entry.turn 우선 (서버가 태그). 옛 로그 (turn 미동봉) 는 가운데.
            const side = entry.turn === "enemy" ? "right" : entry.turn === "player" ? "left" : null;
            return <InfoLine key={i} text={entry.text} side={side} />;
          }
          // player_attack — 왼쪽 초록 버블 / enemy_attack — 오른쪽 빨강 버블.
          return (
            <AttackBubble
              key={i}
              side={entry.kind === "player_attack" ? "left" : "right"}
              text={entry.text}
            />
          );
        })}
      </div>

      {recents.length > 0 && (
        <Card padding="md">
          <div className="mb-2 text-[12px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            최근 활동
          </div>
          <ul className="space-y-1.5">
            {recents.map((n) => (
              <li
                key={n.id}
                className="flex items-baseline justify-between gap-2 text-[13px]"
              >
                <span className={`truncate ${RECENT_KIND_COLOR[n.kind]}`}>
                  {n.text}
                </span>
                <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {formatRelative(n.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
