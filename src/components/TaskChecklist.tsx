"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckSquare, Square, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useDashboardStore } from "@/lib/store";
import { isoDateFromToday } from "@/lib/dates";
import { findGroupBySubject } from "@/lib/roles";
import { STUDY_GROUPS } from "@/lib/studyGroups";

export default function TaskChecklist() {
  const lectures = useDashboardStore((s) => s.lectures);
  const simulatedToday = useDashboardStore((s) => s.simulatedToday);

  const today = useMemo(() => isoDateFromToday(0, simulatedToday), [simulatedToday]);
  const tomorrow = useMemo(() => isoDateFromToday(1, simulatedToday), [simulatedToday]);

  const viewingGroupId = useDashboardStore((s) => s.viewingGroupId);

  const hasExamToday = useMemo(() => lectures.some(l => 
    l.date === today && 
    l.entryType === "exam" &&
    (!viewingGroupId || findGroupBySubject(STUDY_GROUPS, l.subject)?.id === viewingGroupId)
  ), [lectures, today, viewingGroupId]);

  const hasExamTomorrow = useMemo(() => lectures.some(l => 
    l.date === tomorrow && 
    l.entryType === "exam" &&
    (!viewingGroupId || findGroupBySubject(STUDY_GROUPS, l.subject)?.id === viewingGroupId)
  ), [lectures, tomorrow, viewingGroupId]);

  const hasExamThisMonth = useMemo(() => lectures.some(l => 
    l.date.startsWith(today.slice(0, 7)) && 
    l.entryType === "exam" &&
    (!viewingGroupId || findGroupBySubject(STUDY_GROUPS, l.subject)?.id === viewingGroupId)
  ), [lectures, today, viewingGroupId]);

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("dashboard_tasks");
    if (saved) {
      try {
        setCheckedItems(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("dashboard_tasks", JSON.stringify(next));
      return next;
    });
  };

  const tasks = [];

  if (hasExamToday) {
    tasks.push({
      id: `exam_today_${today}_recruit`,
      label: "해설자 모집 후 해설방 파기",
      isExamToday: true,
    });
  }

  if (hasExamTomorrow) {
    tasks.push({
      id: `exam_tomorrow_${tomorrow}_room`,
      label: "과목부장 초대해서 복원수합방 파기",
      isExamTomorrow: true,
    });
    tasks.push({
      id: `exam_tomorrow_${tomorrow}_assign`,
      label: "n분의 1해서 수합할 문제 배정 하기",
      link: "/restoration",
      isExamTomorrow: true,
    });
  }

  // Monthly tasks
  if (hasExamThisMonth) {
    const currentMonth = today.slice(0, 7); // YYYY-MM
    tasks.push({
      id: `monthly_${currentMonth}_settlement`,
      label: "시험 월말 마감 결산 (점수/패널티 등)",
      isMonthly: true,
    });
  }

  if (!mounted) return null;

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">✅ 잊지 마세요! 할 일 체크리스트</h2>
      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white py-4 text-center text-sm text-slate-400">
            현재 표시할 체크리스트가 없습니다.
          </p>
        )}
        {tasks.map(task => (
          <div
            key={task.id}
            className={`flex items-center justify-between rounded-xl border p-3 shadow-sm transition-colors ${
              checkedItems[task.id]
                ? "border-slate-200 bg-slate-50 text-slate-400"
                : task.isExamToday 
                  ? "border-rose-200 bg-rose-50 text-rose-800" 
                  : task.isExamTomorrow 
                    ? "border-indigo-200 bg-indigo-50 text-indigo-800" 
                    : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            <div 
              className="flex flex-1 items-center gap-3 cursor-pointer"
              onClick={() => toggleCheck(task.id)}
            >
              {checkedItems[task.id] ? (
                <CheckSquare size={18} className="text-slate-400 shrink-0" />
              ) : (
                <Square size={18} className={task.isExamToday ? "text-rose-500 shrink-0" : task.isExamTomorrow ? "text-indigo-500 shrink-0" : "text-slate-400 shrink-0"} />
              )}
              <div>
                <p className={`text-sm font-medium ${checkedItems[task.id] ? "line-through" : ""}`}>
                  {task.label}
                </p>
                {!checkedItems[task.id] && (
                  <p className="text-xs opacity-70">
                    {task.isExamToday ? "오늘 시험이 있습니다!" : task.isExamTomorrow ? "내일 시험 대비 사전준비" : "월간 마감 체크리스트"}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex shrink-0 items-center gap-2 ml-3">
              {task.link && !checkedItems[task.id] && (
                <Link href={task.link} className="flex items-center gap-1 rounded-lg bg-white/50 px-2 py-1 text-xs font-semibold hover:bg-white/80">
                  이동 <ChevronRight size={14} />
                </Link>
              )}
              
              {!checkedItems[task.id] && (
                <button 
                  onClick={() => toggleCheck(task.id)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  했나요?
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
