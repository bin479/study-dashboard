"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarClock,
  Trophy,
  Users,
  RefreshCw,
  ClipboardList,
  Stethoscope,
  Calculator,
  MoreHorizontal,
} from "lucide-react";
import { ReactNode, useMemo, useEffect } from "react";
import { useDashboardStore } from "@/lib/store";

const DESKTOP_NAV_ITEMS = [
  { href: "/", label: "홈", icon: LayoutDashboard },
  { href: "/schedule", label: "시간표", icon: CalendarClock },
  { href: "/scoring", label: "스코어링", icon: Trophy },
  { href: "/restoration", label: "복원", icon: ClipboardList },
  { href: "/roster", label: "멤버", icon: Users },
  { href: "/settlement", label: "정산", icon: Calculator },
];

const MOBILE_NAV_ITEMS = [
  { href: "/", label: "홈", icon: LayoutDashboard },
  { href: "/schedule", label: "시간표", icon: CalendarClock },
  { href: "/scoring", label: "스코어링", icon: Trophy },
  { href: "/restoration", label: "복원", icon: ClipboardList },
  { href: "/more", label: "더보기", icon: MoreHorizontal },
];

const MORE_PATHS = ["/more", "/roster", "/settlement", "/sync"];

// Zustand persist 값이 로컬스토리지에서 복원되기 전까지는 서버 렌더와 값이 다를 수 있으므로
// 클라이언트에서만 그린다 (다른 뷰 컴포넌트들과 동일한 패턴).
const GroupSwitcher = dynamic(() => import("./GroupSwitcher"), {
  ssr: false,
  loading: () => <div className="h-[26px]" />,
});
const DateSimulator = dynamic(() => import("./DateSimulator"), {
  ssr: false,
  loading: () => <div className="h-[26px] w-24" />,
});
const CurrentUserBadge = dynamic(() => import("./CurrentUserBadge"), { ssr: false });
const AppGate = dynamic(() => import("./AppGate"), { ssr: false });

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const members = useDashboardStore((s) => s.members);
  const adminMode = useDashboardStore((s) => s.adminMode);

  const currentMember = useMemo(() => members.find((m) => m.id === currentMemberId), [members, currentMemberId]);
  const currentMemberRole = currentMember?.role;
  const currentMemberName = currentMember?.name;
  
  const ADMIN_ALLOWED_NAMES = ["한상희", "성민수", "김정후", "정지혜", "김승현", "심은엽", "이동제"];
  const canUseAdminMode = currentMemberName && ADMIN_ALLOWED_NAMES.includes(currentMemberName);

  // 로컬 스토리지에 캐시된 이전 멤버(김성후 등) 강제 삭제
  useEffect(() => {
    if (members.some(m => m.name === "김성후")) {
      useDashboardStore.setState(s => ({
        members: s.members.filter(m => m.name !== "김성후")
      }));
    }
  }, [members]);

  const desktopNav = useMemo(() => {
    if (adminMode && canUseAdminMode) return DESKTOP_NAV_ITEMS;
    
    if (currentMemberRole === "lead") {
      return DESKTOP_NAV_ITEMS.filter(item => !["/roster", "/sync"].includes(item.href));
    }
    if (currentMemberRole === "subjectHead") {
      return DESKTOP_NAV_ITEMS.filter(item => !["/restoration", "/roster", "/settlement", "/sync"].includes(item.href));
    }
    
    return DESKTOP_NAV_ITEMS.filter(item => !["/scoring", "/restoration", "/roster", "/settlement", "/sync"].includes(item.href));
  }, [adminMode, canUseAdminMode, currentMemberRole]);

  const mobileNav = useMemo(() => {
    if (adminMode && canUseAdminMode) return MOBILE_NAV_ITEMS;
    
    if (currentMemberRole === "lead") {
      return MOBILE_NAV_ITEMS;
    }
    if (currentMemberRole === "subjectHead") {
      return MOBILE_NAV_ITEMS.filter(item => item.href !== "/more" && item.href !== "/restoration");
    }
    
    return MOBILE_NAV_ITEMS.filter(item => item.href !== "/scoring" && item.href !== "/restoration" && item.href !== "/more");
  }, [adminMode, canUseAdminMode, currentMemberRole]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 items-center justify-center rounded-xl overflow-hidden">
              <img src="/chosun_logo.png" alt="조선대학교 의과대학 로고" className="h-full w-auto object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-slate-900">조선대학교 의과대학</p>
              <p className="hidden sm:block text-xs leading-tight text-slate-500">학습 대시보드</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CurrentUserBadge />
            {currentMemberId && (
              <nav className="hidden items-center gap-1 md:flex">
              {desktopNav.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
              </nav>
            )}
          </div>
        </div>
        {currentMemberId && (
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-2.5 sm:px-6">
            <div className="min-w-0 flex-1">
              <GroupSwitcher />
            </div>
            <DateSimulator />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6 md:pb-10">
        <AppGate>{children}</AppGate>
      </main>

      {currentMemberId && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-6xl grid-cols-5">
            {mobileNav.map(({ href, label, icon: Icon }) => {
              const active = href === "/more" ? MORE_PATHS.includes(pathname) : pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                    active ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Icon size={20} className={active ? "scale-110 transition-transform" : ""} />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
