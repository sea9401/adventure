"use client";

import { useEffect } from "react";
import { X } from "@phosphor-icons/react";

type Section = { title: string; body: string };

// 메뉴얼 — 시스템 레벨 안내만. 몬스터/NPC/장소/스탯 환산처럼 게임을 진행해야
// 풀리는 정보는 *모험의 서* 가 다루므로 여기에 넣지 않는다.
const SECTIONS: Section[] = [
  {
    title: "모험의 흐름",
    body:
      "마을에서 출발해 지도를 따라 새로운 지역을 탐험합니다. 지역에서 만난 몬스터와 전투해 승리하면 EXP·골드·아이템을 얻고, 새로운 적·사람·장소는 모험의 서에 자동으로 기록됩니다.",
  },
  {
    title: "레벨과 스탯",
    body:
      "전투와 퀘스트로 EXP가 쌓이고, 레벨업 시 HP/MP가 회복됩니다. 마을 훈련장에서 스탯 포인트를 분배해 캐릭터를 원하는 방향으로 키울 수 있어요.",
  },
  {
    title: "퀘스트와 보상",
    body:
      "길드 게시판이나 마을 사람들과의 대화로 의뢰를 받습니다. 조건을 충족한 뒤 의뢰주에게 돌아가면 골드·명성·EXP·아이템 등을 보상으로 받을 수 있습니다.",
  },
  {
    title: "마을 시설",
    body:
      "치료소에서 HP/MP를 회복하고, 상점에서 장비와 포션을 사고팝니다. 훈련장에서는 스탯을 분배하고, 길드에서는 의뢰를 수락·완료할 수 있습니다.",
  },
  {
    title: "자동 사냥",
    body:
      "일부 지역에서는 자동 사냥을 켤 수 있습니다. 자리를 비워도 오프라인 시뮬레이션으로 진행되니, 다시 돌아왔을 때 그동안의 결과를 확인할 수 있어요.",
  },
  {
    title: "모험의 서",
    body:
      "캐릭터 탭의 도감입니다. 만난 몬스터·사람·장소가 누적 기록되며, 일부 정보는 충분히 만나거나 일정 기준을 넘어야 점진적으로 공개됩니다.",
  },
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="help-modal-title"
              className="text-xl font-semibold text-zinc-900 dark:text-zinc-100"
            >
              도움말
            </h2>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              게임의 기본 흐름과 시스템을 간단히 안내합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <ul className="mt-5 space-y-4">
          {SECTIONS.map((s) => (
            <li key={s.title}>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {s.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {s.body}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-zinc-400 dark:text-zinc-500">
          더 자세한 정보(몬스터·NPC·장소·스탯 효과 등)는{" "}
          <span className="font-medium text-zinc-500 dark:text-zinc-400">
            모험의 서
          </span>
          에서 직접 만나며 풀어보세요.
        </p>
      </div>
    </div>
  );
}
