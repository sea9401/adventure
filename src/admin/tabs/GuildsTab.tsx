"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../AdminContext";
import { Button } from "../ui/Field";
import { DangerAction } from "../ui/DangerAction";

type Overview = {
  weekStart: string;
  activeGuildCount: number;
  total: number;
  thisWeekCount: number;
  byStatus: Record<string, number>;
};

const STATUS_LABELS: Record<string, string> = {
  proposed: "후보",
  active: "진행 중",
  completed: "완료",
  dismissed: "포기",
  expired: "만료",
};

const STATUS_ORDER = ["proposed", "active", "completed", "dismissed", "expired"];

export function GuildsTab() {
  const { readOnly, showToast } = useAdmin();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/guilds");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as Overview);
    } catch (e) {
      showToast(`조회 실패: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // 마운트 시 1회 현황 로드 — refresh 내부의 setLoading 은 의도된 동작.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const post = async (action: string) => {
    if (readOnly) {
      showToast("보기 전용 모드 — 변경 불가");
      return;
    }
    try {
      const r = await fetch("/api/admin/guilds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const txt = await r.text();
      if (!r.ok) {
        showToast(`${action} 실패: ${txt}`);
        return;
      }
      let summary = `${action} 완료`;
      try {
        const j = JSON.parse(txt) as Record<string, unknown>;
        if (action === "reissue_week") {
          summary = `재발행 완료 — 삭제 ${j.deleted ?? 0}, 길드 ${j.guildsProcessed ?? 0}, 새 후보 ${j.instancesIssued ?? 0}`;
        } else if (action === "wipe_all") {
          summary = `전체 삭제 완료 — ${j.deleted ?? 0}건`;
        } else if (action === "expire_open") {
          summary = `만료 처리 — active ${j.expiredActive ?? 0}, proposed ${j.expiredProposed ?? 0}`;
        }
      } catch {
        /* keep default summary */
      }
      showToast(summary);
      await refresh();
    } catch (e) {
      showToast(`${action} 실패: ${e instanceof Error ? e.message : "unknown"}`);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">길드 의뢰 현황</h3>
          <Button onClick={() => void refresh()} disabled={loading}>
            {loading ? "조회 중…" : "새로고침"}
          </Button>
        </div>
        {data ? (
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-zinc-700 dark:text-zinc-300">
              <span>
                이번 주 시작:{" "}
                <span className="tabular-nums">
                  {new Date(data.weekStart).toLocaleString("ko-KR")}
                </span>
              </span>
              <span>
                활성 길드: <span className="tabular-nums">{data.activeGuildCount}</span>
              </span>
              <span>
                이번 주 인스턴스:{" "}
                <span className="tabular-nums">{data.thisWeekCount}</span>
              </span>
              <span>
                전체 인스턴스: <span className="tabular-nums">{data.total}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => (
                <span
                  key={s}
                  className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {STATUS_LABELS[s] ?? s}:{" "}
                  <span className="tabular-nums">{data.byStatus[s] ?? 0}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {loading ? "불러오는 중…" : "데이터 없음"}
          </p>
        )}
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">의뢰 초기화</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          <strong>이번 주 재발행</strong>: 이번 주에 발행된 길드 의뢰(후보·진행·완료
          모두)를 지우고, 모든 활성 길드에 새 후보 3건을 다시 추첨해 발행합니다.
          이미 완료해 보상을 받은 의뢰의 기록도 사라지지만, 지급된 보상 자체는 회수되지
          않습니다. <strong>전체 삭제</strong>는 모든 주의 인스턴스를 전부 비웁니다 —
          다음 주간 cron 이 돌 때까지 의뢰가 비어 있게 됩니다.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DangerAction
            trigger="이번 주 재발행"
            title="이번 주 길드 의뢰 재발행"
            description="이번 주 인스턴스를 삭제하고 활성 길드별로 후보 3건을 새로 추첨해 발행합니다. 진행 중이던 의뢰의 진척도도 초기화됩니다."
            confirmText="REISSUE"
            disabled={readOnly}
            onConfirm={() => void post("reissue_week")}
          />
          <DangerAction
            trigger="활성·후보 만료 처리"
            title="열린 의뢰 만료 처리"
            description="마감 cron 과 동일하게 동작합니다: 진행 중(미완료) + 후보(미수락) 의뢰를 모두 expired 로 바꿉니다. 재발행은 하지 않습니다."
            confirmText="EXPIRE"
            disabled={readOnly}
            onConfirm={() => void post("expire_open")}
          />
          <DangerAction
            trigger="전체 삭제 (위험)"
            title="모든 길드 의뢰 인스턴스 삭제"
            description="과거 기록을 포함한 전체 guild_quest_instances 를 비웁니다. 되돌릴 수 없습니다."
            confirmText="WIPE ALL"
            disabled={readOnly}
            onConfirm={() => void post("wipe_all")}
          />
        </div>
        {readOnly && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            보기 전용 모드 — 상단에서 편집 가능으로 전환해야 동작합니다.
          </p>
        )}
      </div>
    </section>
  );
}
