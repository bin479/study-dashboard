"use client";

import { useEffect, useRef } from "react";
import { ReactNode } from "react";
import { useDashboardStore } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { GROUP_SUBJECT_HEAD_NAMES } from "@/lib/studyGroups";
import LoginGate from "./LoginGate";

export default function AppGate({ children }: { children: ReactNode }) {
  const supabaseReady = useDashboardStore((s) => s.supabaseReady);
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const initFromSupabase = useDashboardStore((s) => s.initFromSupabase);
  const members = useDashboardStore((s) => s.members);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    initFromSupabase();
  }, [initFromSupabase]);

  useEffect(() => {
    if (supabaseReady && currentMemberId) {
      const member = members.find((m) => m.id === currentMemberId);
      if (member?.role === "subjectHead") {
        const groupId = Object.entries(GROUP_SUBJECT_HEAD_NAMES).find(([_, names]) => names.includes(member.name))?.[0];
        if (groupId) {
          useDashboardStore.getState().setViewingGroupId(groupId);
        }
      } else if (member?.role === "lead" && member.groupId) {
        useDashboardStore.getState().setViewingGroupId(member.groupId);
      }
    }
  }, [supabaseReady, currentMemberId, members]);

  if (!supabaseReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">
        불러오는 중…
      </div>
    );
  }

  if (!currentMemberId) {
    return <LoginGate />;
  }

  return <>{children}</>;
}
