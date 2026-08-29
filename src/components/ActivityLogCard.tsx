"use client";

import { useDashboardStore } from "@/lib/store";
import { ArrowDownToLine, ArrowUpFromLine, Activity, Pencil } from "lucide-react";
import { useMemo } from "react";

export default function ActivityLogCard() {
  const activityLog = useDashboardStore((s) => s.activityLog);
  const adminMode = useDashboardStore((s) => s.adminMode);
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const members = useDashboardStore((s) => s.members);
  
  const currentMember = members.find((m) => m.id === currentMemberId);
  const isSungmin = currentMember?.name === "성민수";

  const displayLogs = useMemo(() => {
    return activityLog.filter((log) => {
      if (log.type === "sync") return isSungmin; // 동기화 로그는 성민수에게만 표시
      if (log.type === "evaluation") {
        // 과목부장의 초안 평가 로그는 동일 그룹에게만 표시
        if (isSungmin) return true; // 성민수는 전체 로그도 볼 수 있음? (아니면 자기 그룹만?) 일단 자기 그룹 + 관리자
        return log.groupId === currentMember?.groupId;
      }
      return false;
    });
  }, [activityLog, isSungmin, currentMember?.groupId]);
  
  if (!isSungmin && displayLogs.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-800">최근 활동 로그</h2>
        </div>
      </div>
      
      {displayLogs.length === 0 && <p className="text-xs text-slate-400">아직 활동 기록이 없습니다.</p>}
      
      <div className="space-y-3">
        {displayLogs.slice(0, 5).map((log) => (
          <div key={log.id} className="flex items-start gap-2 text-xs">
            {log.type === "sync" ? (
              log.direction === "pull" ? (
                <ArrowDownToLine size={13} className="mt-0.5 shrink-0 text-indigo-500" />
              ) : (
                <ArrowUpFromLine size={13} className="mt-0.5 shrink-0 text-slate-400" />
              )
            ) : (
              <Pencil size={13} className="mt-0.5 shrink-0 text-emerald-500" />
            )}
            <div>
              <p className={log.status === "error" ? "text-rose-600 font-medium" : "text-slate-600"}>{log.summary}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {new Date(log.timestamp).toLocaleString("ko-KR")} {log.source ? `· ${log.source}` : ""}
              </p>
            </div>
          </div>
        ))}
        {displayLogs.length > 5 && (
          <p className="pt-2 text-center text-xs text-slate-400">
            그 외 {displayLogs.length - 5}개의 기록이 있습니다.
          </p>
        )}
      </div>
    </div>
  );
}
