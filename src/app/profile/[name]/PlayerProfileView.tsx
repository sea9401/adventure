"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatCircleText } from "@phosphor-icons/react";
import { ITEMS } from "@/adventure/data/items";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { Card } from "@/components/ui/Card";
import { SendMessageModal } from "@/adventure/marketplace/SendMessageModal";

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
};

const SLOT_LABEL: Record<keyof ProfileData["equipped"], string> = {
  weapon: "무기",
  armor: "방어구",
  accessory: "장신구",
};

export function PlayerProfileView({ name }: { name: string }) {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pmOpen, setPmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 이름이 바뀌면 다시 로딩 상태로 — 직전 데이터가 잠깐 보이는 것 방지.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-3 bg-zinc-50 p-4 dark:bg-zinc-950">
      <SubViewHeader
        title="모험가 정보"
        onBack={goBack}
        right={
          data && !data.isSelf ? (
            <button
              type="button"
              onClick={() => setPmOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <ChatCircleText size={16} weight="bold" />
              쪽지 보내기
            </button>
          ) : undefined
        }
      />

      {loading && (
        <Card as="section" padding="md">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">불러오는 중…</p>
        </Card>
      )}
      {error && (
        <Card as="section" padding="md">
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </Card>
      )}
      {data && <ProfileBody data={data} />}

      {pmOpen && data && (
        <SendMessageModal
          initialRecipient={data.name}
          onClose={() => setPmOpen(false)}
        />
      )}
    </div>
  );
}

function ProfileBody({ data }: { data: ProfileData }) {
  const equipmentEntries = (Object.keys(data.equipped) as Array<keyof ProfileData["equipped"]>)
    .map((slot) => ({ slot, id: data.equipped[slot] }))
    .filter((e): e is { slot: keyof ProfileData["equipped"]; id: string } => !!e.id);

  return (
    <>
      {/* 헤더 — 이름·레벨·클래스·칭호·명성·전투·길드 */}
      <Card as="section" padding="md">
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
      </Card>

      {/* 장비 3종 */}
      <Card as="section" padding="md">
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
      </Card>
    </>
  );
}
