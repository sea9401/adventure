"use client";

import { useEffect, useState } from "react";
import { loadBundle, writeBundleKey } from "../storage-bundle";
import { useAdmin } from "../AdminContext";
import { Button, Checkbox, NumberInput, TextInput } from "../ui/Field";
import { DangerAction } from "../ui/DangerAction";
import { MONSTERS } from "@/adventure/data/monsters";
import { NPCS } from "@/adventure/data/npcs";
import { WORLD_MAP } from "@/adventure/data/world";
import {
  emptyAdventureLog,
  type AdventureLog,
} from "@/adventure/log/storage";

export function LogTab() {
  const { readOnly, bump, bumpVersion, showToast } = useAdmin();
  const [log, setLog] = useState<AdventureLog>(emptyAdventureLog());
  const [query, setQuery] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLog(loadBundle().data.log ?? emptyAdventureLog());
  }, [bumpVersion]);

  const persist = (next: AdventureLog) => {
    setLog(next);
    writeBundleKey("log", next);
    bump();
    showToast("저장됨.");
  };

  const setMonster = (
    name: string,
    patch: Partial<AdventureLog["monsters"][string]>,
  ) => {
    const cur = log.monsters[name] ?? { encountered: false, kills: 0 };
    persist({
      ...log,
      monsters: { ...log.monsters, [name]: { ...cur, ...patch } },
    });
  };

  const allMonsterNames = Object.keys(MONSTERS);
  const monsterRows = allMonsterNames.filter((name) =>
    !query.trim() ? true : name.toLowerCase().includes(query.toLowerCase()),
  );

  const markAllEncountered = () => {
    const next = { ...log, monsters: { ...log.monsters } };
    for (const name of allMonsterNames) {
      const cur = next.monsters[name] ?? { encountered: false, kills: 0 };
      next.monsters[name] = {
        ...cur,
        encountered: true,
        firstSeenAt: cur.firstSeenAt ?? Date.now(),
      };
    }
    persist(next);
  };

  const markAllKilled50 = () => {
    const next = { ...log, monsters: { ...log.monsters } };
    for (const name of allMonsterNames) {
      const cur = next.monsters[name] ?? { encountered: false, kills: 0 };
      next.monsters[name] = {
        ...cur,
        encountered: true,
        kills: Math.max(50, cur.kills),
        firstSeenAt: cur.firstSeenAt ?? Date.now(),
        lastKilledAt: Date.now(),
      };
    }
    persist(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="grow"><TextInput value={query} onChange={setQuery} placeholder="검색…" /></div>
        <Button disabled={readOnly} onClick={markAllEncountered}>
          모든 몬스터 조우 처리
        </Button>
        <Button disabled={readOnly} onClick={markAllKilled50}>
          모든 몬스터 50킬
        </Button>
        <DangerAction
          disabled={readOnly}
          trigger="모험의 서 초기화"
          title="도감 전부 비우기"
          description="몬스터·마을·NPC 기록을 모두 삭제합니다."
          confirmText="WIPE LOG"
          onConfirm={() => persist(emptyAdventureLog())}
        />
      </div>

      <section>
        <h2 className="text-sm font-semibold">몬스터</h2>
        <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {["이름", "조우", "처치 수", "첫 조우", "마지막 처치", "액션"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-2 py-1 text-left text-xs font-semibold"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {monsterRows.map((name) => {
                const e = log.monsters[name] ?? {
                  encountered: false,
                  kills: 0,
                };
                return (
                  <tr
                    key={name}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-2 py-1">{name}</td>
                    <td className="px-2 py-1">
                      <Checkbox
                        checked={!!e.encountered}
                        disabled={readOnly}
                        onChange={(v) =>
                          setMonster(name, {
                            encountered: v,
                            firstSeenAt: v
                              ? (e.firstSeenAt ?? Date.now())
                              : undefined,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1 w-28">
                      <NumberInput
                        value={e.kills}
                        min={0}
                        disabled={readOnly}
                        onChange={(kills) =>
                          setMonster(name, {
                            kills,
                            encountered: kills > 0 || e.encountered,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1 text-xs text-zinc-500">
                      {e.firstSeenAt
                        ? new Date(e.firstSeenAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-2 py-1 text-xs text-zinc-500">
                      {e.lastKilledAt
                        ? new Date(e.lastKilledAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          disabled={readOnly}
                          onClick={() => setMonster(name, { kills: e.kills + 1, encountered: true, lastKilledAt: Date.now() })}
                        >
                          +1킬
                        </Button>
                        <Button
                          disabled={readOnly}
                          onClick={() => setMonster(name, { kills: 10, encountered: true })}
                        >
                          10킬
                        </Button>
                        <Button
                          disabled={readOnly}
                          onClick={() => setMonster(name, { kills: 50, encountered: true })}
                        >
                          50킬
                        </Button>
                        <Button
                          disabled={readOnly}
                          onClick={() => setMonster(name, { encountered: false, kills: 0 })}
                        >
                          미발견
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">마을</h2>
        <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {["id", "이름", "방문", "대화한 NPC 수"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1 text-left text-xs font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORLD_MAP.regions
                .filter((r) => r.tags?.includes("town"))
                .map((r) => {
                  const t = log.towns[r.id] ?? {
                    visited: false,
                    npcsTalkedTo: [],
                  };
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="px-2 py-1 font-mono text-xs">{r.id}</td>
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1">
                        <Checkbox
                          checked={!!t.visited}
                          disabled={readOnly}
                          onChange={(v) =>
                            persist({
                              ...log,
                              towns: {
                                ...log.towns,
                                [r.id]: {
                                  ...t,
                                  visited: v,
                                  firstVisitedAt: v
                                    ? (t.firstVisitedAt ?? Date.now())
                                    : undefined,
                                },
                              },
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        {t.npcsTalkedTo?.length ?? 0}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">NPC</h2>
        <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {["id", "이름", "지역", "대화 횟수"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1 text-left text-xs font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NPCS.map((n) => {
                const e = log.npcs[n.id] ?? { talkCount: 0 };
                return (
                  <tr
                    key={n.id}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-2 py-1 font-mono text-xs">{n.id}</td>
                    <td className="px-2 py-1">{n.name}</td>
                    <td className="px-2 py-1">{n.region}</td>
                    <td className="px-2 py-1 w-24">
                      <NumberInput
                        value={e.talkCount}
                        min={0}
                        disabled={readOnly}
                        onChange={(talkCount) =>
                          persist({
                            ...log,
                            npcs: {
                              ...log.npcs,
                              [n.id]: {
                                ...e,
                                talkCount,
                                firstTalkAt:
                                  e.firstTalkAt ?? (talkCount > 0 ? Date.now() : undefined),
                              },
                            },
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
