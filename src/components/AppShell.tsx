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
import { ReactNode, useMemo, useEffect, useState } from "react";
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
const FeedbackModal = dynamic(() => import("./FeedbackModal"), { ssr: false });

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const members = useDashboardStore((s) => s.members);
  const adminMode = useDashboardStore((s) => s.adminMode);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const currentMember = useMemo(() => members.find((m) => m.id === currentMemberId), [members, currentMemberId]);
  const currentMemberRole = currentMember?.role;
  const currentMemberName = currentMember?.name;
  
  const ADMIN_ALLOWED_NAMES = ["한상희", "성민수"];
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
    let items = DESKTOP_NAV_ITEMS;
    if (currentMemberName === "성민수" && adminMode && canUseAdminMode) {
      items = [...items, { href: "/feedbacks", label: "피드백", icon: ClipboardList }];
    }

    if (adminMode && canUseAdminMode) return items;
    
    if (currentMemberRole === "lead") {
      return items.filter(item => !["/roster", "/sync", "/feedbacks"].includes(item.href));
    }
    if (currentMemberRole === "subjectHead") {
      return items.filter(item => !["/restoration", "/roster", "/settlement", "/sync", "/feedbacks"].includes(item.href));
    }
    if (currentMemberName === "김정후") {
      return items.filter(item => !["/scoring", "/restoration", "/roster", "/sync", "/feedbacks"].includes(item.href));
    }
    
    return items.filter(item => !["/scoring", "/restoration", "/roster", "/settlement", "/sync", "/feedbacks"].includes(item.href));
  }, [adminMode, canUseAdminMode, currentMemberRole, currentMemberName]);

  const mobileNav = useMemo(() => {
    let items = MOBILE_NAV_ITEMS;
    // 성민수만 볼 수 있으므로 더보기 탭 내에 피드백이 있음 (MoreView.tsx)
    // 모바일은 더보기 탭이 이미 있으므로 따로 안 빼도 됨
    if (adminMode && canUseAdminMode) return items;
    
    if (currentMemberRole === "lead") {
      return items;
    }
    if (currentMemberRole === "subjectHead") {
      return items.filter(item => item.href !== "/more" && item.href !== "/restoration");
    }
    if (currentMemberName === "김정후") {
      return items.filter(item => item.href !== "/scoring" && item.href !== "/restoration");
    }
    
    return items.filter(item => item.href !== "/scoring" && item.href !== "/restoration" && item.href !== "/more");
  }, [adminMode, canUseAdminMode, currentMemberRole, currentMemberName]);

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

      {currentMemberId && (
        <>
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:scale-110 hover:bg-indigo-700 active:scale-95 md:bottom-8 md:right-8"
            aria-label="피드백 보내기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M12 15h.01"/><path d="M12 12V8"/></svg>
          </button>
          
          {showFeedbackModal && (
            <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
          )}
        </>
      )}
    </div>
  );
}
