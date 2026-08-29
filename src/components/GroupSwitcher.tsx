"use client";

import { useEffect } from "react";
import { useDashboardStore } from "@/lib/store";
import { STUDY_GROUPS } from "@/lib/studyGroups";

export default function GroupSwitcher() {
  const viewingGroupId = useDashboardStore((s) => s.viewingGroupId);
  const setViewingGroupId = useDashboardStore((s) => s.setViewingGroupId);
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const members = useDashboardStore((s) => s.members);

  const mem = members.find((m) => m.id === currentMemberId);
  const currentMemberRole = mem?.role;
  const isNormalUser = currentMemberRole !== "lead" && currentMemberRole !== "subjectHead";
  const adminMode = useDashboardStore((s) => s.adminMode);

  useEffect(() => {
    if (isNormalUser && viewingGroupId !== null) {
      setViewingGroupId(null);
    }
    // 관리자가 아닌 그룹장/과목부장은 자기 그룹 외에는 접근 불가 (전체보기도 불가)
    if ((currentMemberRole === "lead" || currentMemberRole === "subjectHead") && !adminMode) {
      if (viewingGroupId !== mem?.groupId && mem?.groupId) {
        setViewingGroupId(mem.groupId);
      }
    }
  }, [isNormalUser, viewingGroupId, setViewingGroupId, currentMemberRole, adminMode, mem?.groupId]);

  if (isNormalUser) {
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <span className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-white">
          전체 보기
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {/* 관리자 모드가 켜져 있거나, 일반 조원일 때만(위에서 처리됨) 전체보기를 허용 */}
      {(!(currentMemberRole === "lead" || currentMemberRole === "subjectHead") || adminMode) && (
        <button
          onClick={() => setViewingGroupId(null)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            viewingGroupId === null ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          전체 보기
        </button>
      )}
      {STUDY_GROUPS.filter(g => {
        if ((currentMemberRole === "lead" || currentMemberRole === "subjectHead") && !adminMode) {
          return g.id === mem?.groupId;
        }
        return true;
      }).map((g) => {
        const active = viewingGroupId === g.id;
        return (
          <button
            key={g.id}
            onClick={() => setViewingGroupId(g.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active ? "text-white" : "bg-slate-100 text-slate-500"
            }`}
            style={active ? { backgroundColor: g.color } : undefined}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? "#fff" : g.color }} />
            {g.name}
          </button>
        );
      })}
    </div>
  );
}
