"use client";

import { useDashboardStore } from "@/lib/store";
import { useMemo } from "react";
import Link from "next/link";
import { Users, RefreshCw, Calculator, ChevronRight, MoreHorizontal } from "lucide-react";

const LINKS = [
  { href: "/roster", label: "멤버 명단", description: "역할·담당 과목 관리", icon: Users },
  { href: "/settlement", label: "매달 말일 정산", description: "가감점 집계 & 엑셀 내보내기", icon: Calculator },
  { href: "/sync", label: "Google Sheets 동기화", description: "시간표·명단·과제 큐 연동", icon: RefreshCw },
];

const ADMIN_LINKS = [
  ...LINKS,
  { href: "/feedbacks", label: "사용자 피드백 (개발자용)", description: "앱 내 의견/오류 신고 내역", icon: Users } // reusing icon or better icon
];

export default function MoreView() {
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const members = useDashboardStore((s) => s.members);
  const adminMode = useDashboardStore((s) => s.adminMode);
  
  const currentMember = members.find((m) => m.id === currentMemberId);
  const currentMemberName = currentMember?.name;
  const currentMemberRole = currentMember?.role;
  const canUseAdminMode = currentMemberName === "한상희" || currentMemberName === "성민수";

  const availableLinks = useMemo(() => {
    if (adminMode && canUseAdminMode) {
      if (currentMemberName === "성민수") return ADMIN_LINKS;
      return LINKS;
    }
    
    if (currentMemberRole === "lead") {
      return LINKS.filter(item => item.href === "/settlement");
    }
    
    return [];
  }, [adminMode, canUseAdminMode, currentMemberRole, currentMemberName]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MoreHorizontal size={22} className="text-indigo-600" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900">더보기</h1>
          <p className="text-sm text-slate-500">멤버 관리, 정산, 동기화 기능입니다.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {availableLinks.length > 0 ? availableLinks.map(({ href, label, description, icon: Icon }, idx) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-between px-4 py-4 active:bg-slate-50 ${
              idx !== availableLinks.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-xs text-slate-400">{description}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </Link>
        )) : (
          <div className="p-8 text-center text-sm text-slate-500">
            사용 가능한 메뉴가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
