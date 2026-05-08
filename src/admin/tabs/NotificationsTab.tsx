"use client";

import { useEffect, useState } from "react";
import { loadBundle, writeBundleKey } from "../storage-bundle";
import { useAdmin } from "../AdminContext";
import { Button, NumberInput, Select, TextInput } from "../ui/Field";
import {
  formatRelative,
  genNotificationId,
  type AppNotification,
  type NotificationKind,
  type NotificationStorage,
} from "@/lib/notifications";

const KINDS: { value: NotificationKind; label: string }[] = [
  { value: "battle_win", label: "battle_win" },
  { value: "battle_lose", label: "battle_lose" },
  { value: "training_done", label: "training_done" },
  { value: "quest_ready", label: "quest_ready" },
  { value: "quest_complete", label: "quest_complete" },
  { value: "info", label: "info" },
];

const empty = (): NotificationStorage => ({ list: [], lastReadAt: 0 });

export function NotificationsTab() {
  const { readOnly, bump, bumpVersion, showToast } = useAdmin();
  const [data, setData] = useState<NotificationStorage>(empty());
  const [draftKind, setDraftKind] = useState<NotificationKind>("info");
  const [draftText, setDraftText] = useState("테스트 알림");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(loadBundle().data.notifications ?? empty());
  }, [bumpVersion]);

  const persist = (next: NotificationStorage) => {
    setData(next);
    writeBundleKey("notifications", next);
    bump();
    showToast("저장됨.");
  };

  const inject = () => {
    if (!draftText.trim()) return;
    const item: AppNotification = {
      id: genNotificationId(),
      timestamp: Date.now(),
      kind: draftKind,
      text: draftText.trim(),
    };
    persist({ ...data, list: [item, ...data.list].slice(0, 20) });
  };

  const remove = (id: string) => {
    persist({ ...data, list: data.list.filter((n) => n.id !== id) });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">테스트 알림 주입</h2>
        <div className="mt-2 grid items-end gap-2 md:grid-cols-[160px_1fr_auto]">
          <Select<NotificationKind>
            value={draftKind}
            options={KINDS}
            disabled={readOnly}
            onChange={setDraftKind}
          />
          <TextInput
            value={draftText}
            onChange={setDraftText}
            disabled={readOnly}
          />
          <Button disabled={readOnly} onClick={inject}>
            추가
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">읽음 표시 시각</h2>
          <Button
            disabled={readOnly}
            onClick={() =>
              persist({ ...data, lastReadAt: Date.now() })
            }
          >
            지금으로 갱신 (모두 읽음)
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <NumberInput
            value={data.lastReadAt}
            min={0}
            disabled={readOnly}
            onChange={(lastReadAt) => persist({ ...data, lastReadAt })}
          />
          <span className="text-xs text-zinc-500">
            {data.lastReadAt
              ? new Date(data.lastReadAt).toLocaleString()
              : "(0)"}
          </span>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">목록 ({data.list.length}/20)</h2>
          <Button
            disabled={readOnly || data.list.length === 0}
            onClick={() =>
              persist({ list: [], lastReadAt: Date.now() })
            }
          >
            전체 삭제
          </Button>
        </div>
        <div className="mt-2 overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {["시간", "종류", "텍스트", ""].map((h) => (
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
              {data.list.map((n) => (
                <tr
                  key={n.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-2 py-1 text-xs text-zinc-500">
                    {formatRelative(n.timestamp)}
                  </td>
                  <td className="px-2 py-1 font-mono text-xs">{n.kind}</td>
                  <td className="px-2 py-1">{n.text}</td>
                  <td className="px-2 py-1 text-right">
                    <Button
                      disabled={readOnly}
                      onClick={() => remove(n.id)}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
              {data.list.length === 0 ? (
                <tr>
                  <td
                    className="px-2 py-3 text-center text-xs text-zinc-500"
                    colSpan={4}
                  >
                    알림이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
