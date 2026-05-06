import type { LogEntry } from "@/lib/game/types";
import { ModalShell } from "@/components/ui/ModalShell";

function formatElapsedDuration(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  if (h < 24) return remMin === 0 ? `${h}시간` : `${h}시간 ${remMin}분`;
  const day = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${day}일` : `${day}일 ${remH}시간`;
}

export function OfflineSummaryModal({
  summary,
  onClose,
}: {
  summary: {
    elapsedSec: number;
    goldGained: number;
    ironGained: number;
    hpRecovered: number;
    finalizedDispatch?: LogEntry;
  };
  onClose: () => void;
}) {
  return (
    <ModalShell
      onClose={onClose}
      size="sm"
      zIndex={90}
      closeOnBackdrop={false}
      showCloseButton={false}
    >
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-fg-strong">자리 비운 동안의 변화</h2>
          <p className="text-xs text-fg-faint mt-1">
            {formatElapsedDuration(summary.elapsedSec)} 동안 자리를 비웠습니다.
          </p>
        </div>
        <div className="space-y-1.5 text-sm">
          {summary.goldGained > 0 && (
            <div className="flex justify-between">
              <span className="text-fg-faint">영지 골드</span>
              <span className="text-amber-400 font-medium">
                +{summary.goldGained.toLocaleString()}
              </span>
            </div>
          )}
          {summary.ironGained > 0 && (
            <div className="flex justify-between">
              <span className="text-fg-faint">영지 철</span>
              <span className="text-fg font-medium">+{summary.ironGained.toLocaleString()}</span>
            </div>
          )}
          {summary.hpRecovered > 0 && (
            <div className="flex justify-between">
              <span className="text-fg-faint">HP 회복</span>
              <span className="text-emerald-400 font-medium">+{summary.hpRecovered}</span>
            </div>
          )}
          {summary.finalizedDispatch && (
            <div className="border-t border-line pt-2 mt-2 space-y-1">
              <p className="text-xs text-fg-faint">완료된 탐험</p>
              <p className="text-fg-strong">
                {summary.finalizedDispatch.regionName}
                {summary.finalizedDispatch.isBoss && (
                  <span className="text-amber-400 text-xs ml-2">★ 보스</span>
                )}
              </p>
              <p className="text-xs text-fg-muted">
                {summary.finalizedDispatch.isBoss
                  ? summary.finalizedDispatch.bossDefeated
                    ? `${summary.finalizedDispatch.bossName} 처치!`
                    : "보스 격퇴 실패"
                  : `${summary.finalizedDispatch.totalKills}킬 · 골드 +${
                      summary.finalizedDispatch.gained.gold ?? 0
                    }`}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-medium"
        >
          확인
        </button>
      </div>
    </ModalShell>
  );
}
