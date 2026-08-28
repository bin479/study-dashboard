"use client";

import { LogOut } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export default function CurrentUserBadge() {
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const members = useDashboardStore((s) => s.members);
  const logout = useDashboardStore((s) => s.logout);
  const adminMode = useDashboardStore((s) => s.adminMode);
  const setAdminMode = useDashboardStore((s) => s.setAdminMode);

  if (!currentMemberId) return null;

  const currentMember = members.find((m) => m.id === currentMemberId);
  const name = currentMember?.name ?? "익명";
  const role = currentMember?.role;
  const canUseAdminMode = role === "lead" || name === "한상희";

  return (
    <div className="flex items-center gap-1.5">
      {canUseAdminMode && (
        <button
          onClick={() => setAdminMode(!adminMode)}
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            adminMode ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500 hover:bg-slate-300"
          }`}
          title="관리자 모드 토글"
        >
          {adminMode ? "관리자 ON" : "관리자 OFF"}
        </button>
      )}
      <button
        onClick={logout}
        className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
        title="로그아웃"
      >
        {name}님
        <LogOut size={12} />
      </button>
    </div>
  );
}
