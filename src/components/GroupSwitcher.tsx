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
  }, [isNormalUser, viewingGroupId, setViewingGroupId]);

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
      <button
        onClick={() => setViewingGroupId(null)}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          viewingGroupId === null ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        전체 보기
      </button>
      {STUDY_GROUPS.filter(g => {
        if (currentMemberRole === "lead" && !adminMode) {
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
