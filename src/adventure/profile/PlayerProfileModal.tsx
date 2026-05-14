"use client";

import { useEffect, useState } from "react";
import { X, ChatCircleText } from "@phosphor-icons/react";
import { ITEMS } from "@/adventure/data/items";
import { TITLES } from "@/adventure/data/titles";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { SendMessageModal } from "@/adventure/marketplace/SendMessageModal";

// 다른 모험가의 공개 프로필 모달. 랭킹 행 클릭 / 채팅 이름 클릭에서 진입.
// 본인 프로필도 동일 API 로 표시 가능하지만 "쪽지 보내기" 버튼은 숨김.
type ProfileData = {
  name: string;
  isSelf: boolean;
  level: number;
  className: string;
  titleName: string | null;
  fame: number;
  battleCount: number;
  guild: { name: string; grade: string } | null;
  equipped: {
    weapon: string | null;
    armor: string | null;
    accessory: string | null;
  };
  obtainedTitles: string[];
  activeSkills: string[];
  activeFeats: string[];
};

const SLOT_LABEL: Record<keyof ProfileData["equipped"], string> = {
  weapon: "무기",
  armor: "방어구",
  accessory: "장신구",
};

export function PlayerProfileModal({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  useEscapeKey(onClose);
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pmOpen, setPmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/profile/by-name?name=${encodeURIComponent(name)}`)
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 404) throw new Error("해당 이름의 모험가를 찾을 수 없습니다.");
          throw new Error(`HTTP ${r.status}`);
        }
        const json = (await r.json()) as ProfileData;
        if (!cancelled) setData(json);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "프로필 조회 실패");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-start justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              모험가 정보
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          {loading && (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              불러오는 중…
            </p>
          )}
          {error && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          {data && <ProfileBody data={data} />}

          <div className="mt-4 flex items-center justify-end gap-2">
            {data && !data.isSelf && (
              <button
                type="button"
                onClick={() => setPmOpen(true)}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <ChatCircleText size={16} weight="bold" />
                쪽지 보내기
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {pmOpen && data && (
        <SendMessageModal
          initialRecipient={data.name}
          onClose={() => setPmOpen(false)}
        />
      )}
    </>
  );
}

function ProfileBody({ data }: { data: ProfileData }) {
  const equipmentEntries = (Object.keys(data.equipped) as Array<keyof ProfileData["equipped"]>)
    .map((slot) => ({ slot, id: data.equipped[slot] }))
    .filter((e): e is { slot: keyof ProfileData["equipped"]; id: string } => !!e.id);

  return (
    <div className="mt-3 space-y-3">
      {/* 헤더 — 이름·레벨·클래스·칭호 */}
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {data.name}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Lv. {data.level}
          </span>
          {data.className && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              · {data.className}
            </span>
          )}
        </div>
        {data.titleName && (
          <div className="mt-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            「{data.titleName}」
          </div>
        )}
        <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-zinc-600 dark:text-zinc-300">
          <div>
            명성 <span className="font-medium">{data.fame.toLocaleString()}</span>
          </div>
          <div>
            전투 <span className="font-medium">{data.battleCount.toLocaleString()}</span>
          </div>
        </div>
        {data.guild && (
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            소속 길드{" "}
            <span className="font-medium">{data.guild.name}</span>{" "}
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
              [{data.guild.grade}]
            </span>
          </div>
        )}
      </div>

      {/* 장비 3종 */}
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          장착 장비
        </div>
        {equipmentEntries.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            장착 중인 장비 없음.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {equipmentEntries.map(({ slot, id }) => {
              const item = ITEMS[id as keyof typeof ITEMS];
              return (
                <li
                  key={slot}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {SLOT_LABEL[slot]}
                  </span>
                  <span className="text-zinc-800 dark:text-zinc-100">
                    {item?.name ?? id}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 장착 스킬 + 특기 */}
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          장착 스킬·특기
        </div>
        {data.activeSkills.length === 0 && data.activeFeats.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            장착 중인 스킬·특기 없음.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {data.activeSkills.map((s) => (
              <span
                key={`s-${s}`}
                className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-950 dark:text-sky-300"
              >
                {s}
              </span>
            ))}
            {data.activeFeats.map((s) => (
              <span
                key={`f-${s}`}
                className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-950 dark:text-violet-300"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 보유 칭호 */}
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          보유 칭호 ({data.obtainedTitles.length})
        </div>
        {data.obtainedTitles.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            아직 획득한 칭호 없음.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {data.obtainedTitles.map((id) => {
              const t = TITLES[id];
              if (!t) return null;
              return (
                <span
                  key={id}
                  title={t.condition}
                  className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                >
                  {t.name}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
