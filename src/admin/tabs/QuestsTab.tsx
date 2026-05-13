"use client";

import { useEffect, useState } from "react";
import { loadBundle, writeBundleKey } from "../storage-bundle";
import { useAdmin } from "../AdminContext";
import { Button, NumberInput, Select } from "../ui/Field";
import { DangerAction } from "../ui/DangerAction";
import { QUESTS, questTargetSummary, questTargetTotal } from "@/adventure/data/quests";
import {
  defaultQuestEntry,
  type QuestProgressMap,
  type QuestState,
} from "@/adventure/quests/storage";

const STATES: { value: QuestState; label: string }[] = [
  { value: "available", label: "available" },
  { value: "active", label: "active" },
  { value: "ready", label: "ready" },
  { value: "completed", label: "completed" },
];

export function QuestsTab() {
  const { readOnly, bump, bumpVersion, showToast } = useAdmin();
  const [map, setMap] = useState<QuestProgressMap>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMap(loadBundle().data.quests ?? {});
  }, [bumpVersion]);

  const persist = (next: QuestProgressMap) => {
    setMap(next);
    writeBundleKey("quests", next);
    bump();
    showToast("저장됨.");
  };

  const upsert = (id: string, patch: Partial<QuestProgressMap[string]>) => {
    const cur = map[id] ?? defaultQuestEntry();
    persist({ ...map, [id]: { ...cur, ...patch } });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <DangerAction
          disabled={readOnly}
          trigger="모든 퀘스트 초기화"
          title="퀘스트 진행도 전체 삭제"
          description="모든 퀘스트의 상태/진행도/누적 완료 카운트를 지웁니다."
          confirmText="RESET"
          onConfirm={() => persist({})}
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              {["퀘스트", "지역", "반복", "상태", "진행도", "누적", "액션"].map((h) => (
                <th key={h} className="px-2 py-1 text-left text-xs font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {QUESTS.map((q) => {
              const entry = map[q.id] ?? defaultQuestEntry();
              return (
                <tr
                  key={q.id}
                  className="border-t border-zinc-200 align-top dark:border-zinc-800"
                >
                  <td className="px-2 py-1">
                    <div className="text-sm font-medium">{q.title}</div>
                    <div className="font-mono text-[11px] text-zinc-500">
                      {q.id} · {questTargetSummary(q.target)}
                    </div>
                  </td>
                  <td className="px-2 py-1">{q.regionId}</td>
                  <td className="px-2 py-1">{q.repeatable ? "✓" : "—"}</td>
                  <td className="px-2 py-1 w-32">
                    <Select<QuestState>
                      value={entry.state}
                      disabled={readOnly}
                      options={STATES}
                      onChange={(state) => upsert(q.id, { state })}
                    />
                  </td>
                  <td className="px-2 py-1 w-24">
                    <NumberInput
                      value={entry.progress}
                      min={0}
                      max={questTargetTotal(q.target)}
                      disabled={readOnly}
                      onChange={(progress) => upsert(q.id, { progress })}
                    />
                  </td>
                  <td className="px-2 py-1 w-20">
                    <NumberInput
                      value={entry.completedCount}
                      min={0}
                      disabled={readOnly}
                      onChange={(completedCount) =>
                        upsert(q.id, { completedCount })
                      }
                    />
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        disabled={readOnly}
                        onClick={() =>
                          upsert(q.id, {
                            state: "ready",
                            progress: questTargetTotal(q.target),
                          })
                        }
                      >
                        즉시 ready
                      </Button>
                      <Button
                        disabled={readOnly}
                        onClick={() =>
                          upsert(q.id, {
                            state: "completed",
                            progress: questTargetTotal(q.target),
                            completedCount: entry.completedCount + 1,
                            lastCompletedAt: Date.now(),
                          })
                        }
                      >
                        즉시 완료
                      </Button>
                      <Button
                        disabled={readOnly}
                        onClick={() =>
                          upsert(q.id, {
                            state: "available",
                            progress: 0,
                          })
                        }
                      >
                        리셋
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
