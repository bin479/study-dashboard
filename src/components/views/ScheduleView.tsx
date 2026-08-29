"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Plus,
  Image,
} from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { applyScheduleAction, ScheduleActionType } from "@/lib/scheduleActions";
import { Lecture, Member } from "@/lib/types";
import { findGroupBySubject, findSubjectHeads, findGroupLeader } from "@/lib/roles";
import { STUDY_GROUPS } from "@/lib/studyGroups";
import { formatDayLabel, formatShortDate, isoDateFromToday, mondayOf, parseISODate } from "@/lib/dates";
import SchedulePreviewModal from "../SchedulePreviewModal";
import LectureDetailModal from "../LectureDetailModal";
import WallpaperModal from "../WallpaperModal";
import D1NoticeCard from "../D1NoticeCard";
import { Download, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";

const shortDate = formatShortDate;
const WEEKDAYS = ["월", "화", "수", "목", "금"];

function getLectureColor(lecture: Lecture, groupId: string | null) {
  if (lecture.entryType === "exam") return "bg-yellow-300 text-slate-900 font-bold border-yellow-400";
  if (lecture.entryType === "holiday") return "bg-rose-100 text-rose-800 border-rose-200";

  if (lecture.subject === "법의학") return "bg-amber-400 text-slate-900 font-bold border-amber-500";
  if (lecture.subject === "PBL3") return "bg-blue-200 text-slate-800 border-blue-300";

  // Use study group colors if assigned
  const group = findGroupBySubject(STUDY_GROUPS, lecture.subject);
  if (group) {
    switch(group.id) {
      case "g1": return "bg-red-50 text-red-900 border-red-200";
      case "g2": return "bg-orange-50 text-orange-900 border-orange-200";
      case "g3": return "bg-yellow-50 text-yellow-900 border-yellow-200";
      case "g4": return "bg-green-50 text-green-900 border-green-200";
      case "g5": return "bg-blue-50 text-blue-900 border-blue-200";
      default: return "bg-[#fbe4d5] text-slate-900 border-[#f4c8b2]";
    }
  }

  if (lecture.subjectType === "major") return "bg-indigo-50 text-indigo-900 border-indigo-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getTimeRow(time: string) {
  const h = parseInt(time.split(":")[0]);
  if (h < 9) return 2;
  return h - 9 + 2; // 09:00 -> row 2. 18:00 -> row 11
}

export default function ScheduleView() {
  const lectures = useDashboardStore((s) => s.lectures);
  const simulatedToday = useDashboardStore((s) => s.simulatedToday);
  const assignments = useDashboardStore((s) => s.assignments);
  const members = useDashboardStore((s) => s.members);
  const runScheduleAction = useDashboardStore((s) => s.runScheduleAction);
  const updateLectureInfo = useDashboardStore((s) => s.updateLectureInfo);
  const setBonus = useDashboardStore((s) => s.setBonus);
  const setDraftMember = useDashboardStore((s) => s.setDraftMember);
  const setActualDuration = useDashboardStore((s) => s.setActualDuration);
  const setProofMember = useDashboardStore((s) => s.setProofMember);
  const autoAssignAll = useDashboardStore((s) => s.autoAssignAll);
  const addLecture = useDashboardStore((s) => s.addLecture);
  const viewingGroupId = useDashboardStore((s) => s.viewingGroupId);
  const pastStates = useDashboardStore((s) => s.pastStates);
  const adminMode = useDashboardStore((s) => s.adminMode);
  const activityLog = useDashboardStore((s) => s.activityLog);
  const addActivityLog = useDashboardStore((s) => s.addActivityLog);

  const [sheetSyncBusy, setSheetSyncBusy] = useState(false);
  const handleSheetSyncNow = async () => {
    setSheetSyncBusy(true);
    try {
      const res = await fetch("/.netlify/functions/sheet-sync-now", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      addActivityLog({
        type: "sync",
        direction: "pull",
        source: "학습부배정표.xlsx",
        summary: `강의 ${data.lectures}건 반영 (배정 ${data.assignments}건, 삭제 ${data.removed}건) — 새로고침하면 보입니다.`,
        status: "success",
      });
      // Optionally reload the page to fetch the new data
      window.location.reload();
    } catch (e) {
      addActivityLog({
        type: "sync",
        direction: "pull",
        source: "학습부배정표.xlsx",
        summary: `동기화 실패: ${(e as Error).message}`,
        status: "error",
      });
    }
    setSheetSyncBusy(false);
  };

  const lastSyncLog = activityLog.find(log => log.type === "sync" && log.status === "success");

  const [pending, setPending] = useState<{ lectureId: string; action: ScheduleActionType } | null>(null);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const currentMember = members.find((m) => m.id === currentMemberId);
  const currentMemberRole = currentMember?.role;
  const currentMemberName = currentMember?.name;
  const isNormalUser = currentMemberRole !== "lead" && currentMemberRole !== "subjectHead";

  const ADMIN_ALLOWED_NAMES = ["한상희", "성민수", "김정후", "정지혜", "김승현", "심은엽", "이동제"];
  const canUseAdminMode = currentMemberName && ADMIN_ALLOWED_NAMES.includes(currentMemberName);
  const canUseSync = canUseAdminMode || currentMemberRole === "lead";

  const weeks = useMemo(() => {
    const byWeek = new Map<string, Map<string, Lecture[]>>();
    [...lectures]
      .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date.localeCompare(b.date)))
      .forEach((l) => {
        const wk = mondayOf(l.date);
        if (!byWeek.has(wk)) byWeek.set(wk, new Map());
        const days = byWeek.get(wk)!;
        if (!days.has(l.date)) days.set(l.date, []);
        days.get(l.date)!.push(l);
      });
    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monday, days], idx) => {
        const dayEntries = Array.from(days.entries()).sort(([a], [b]) => a.localeCompare(b));
        return {
          monday,
          index: idx,
          label: `${idx + 1}주`,
          range: `${shortDate(dayEntries[0][0])}~${shortDate(dayEntries[dayEntries.length - 1][0])}`,
          days: dayEntries,
        };
      });
  }, [lectures]);

  const currentWeekIndex = useMemo(() => {
    const today = mondayOf(isoDateFromToday(0, simulatedToday));
    const exact = weeks.findIndex((w) => w.monday === today);
    if (exact >= 0) return exact;
    const upcoming = weeks.findIndex((w) => w.monday >= today);
    return upcoming >= 0 ? upcoming : Math.max(0, weeks.length - 1);
  }, [weeks, simulatedToday]);

  const [weekIndex, setWeekIndex] = useState<number | null>(null);
  const activeWeekIndex = Math.min(weekIndex ?? currentWeekIndex, Math.max(0, weeks.length - 1));
  const activeWeek = weeks[activeWeekIndex];

  // Derive Monday to Friday dates for the active week
  const weekDates = useMemo(() => {
    if (!activeWeek) return [];
    const mon = parseISODate(activeWeek.monday);
    return Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(mon);
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    });
  }, [activeWeek]);

  const activeWeekHasVisibleLecture = useMemo(() => {
    if (!activeWeek) return false;
    if (!viewingGroupId) return activeWeek.days.length > 0;
    return activeWeek.days.some(([, dayLectures]) =>
      dayLectures.some((l) => findGroupBySubject(STUDY_GROUPS, l.subject)?.id === viewingGroupId)
    );
  }, [activeWeek, viewingGroupId]);

  const preview = useMemo(() => {
    if (!pending) return null;
    const result = applyScheduleAction(lectures, assignments, pending.lectureId, pending.action);
    const beforeLecture = lectures.find((l) => l.id === pending.lectureId)!;
    const afterLecture = result.lectures.find((l) => l.id === pending.lectureId)!;
    const otherAffectedLectures = result.lectures
      .filter((l) => l.id !== pending.lectureId)
      .map((after) => {
        const before = lectures.find((l) => l.id === after.id)!;
        return { before, after };
      })
      .filter(({ before, after }) => before.status !== after.status || before.note !== after.note);

    const affectedAssignments = assignments.filter((a) => a.lectureId === pending.lectureId);
    const roleTags = new Map<string, string[]>();
    const tag = (memberId: string | null, role: string) => {
      if (!memberId) return;
      const name = members.find((m) => m.id === memberId)?.name ?? "미배정";
      if (!roleTags.has(name)) roleTags.set(name, []);
      const roles = roleTags.get(name)!;
      if (!roles.includes(role)) roles.push(role);
    };
    affectedAssignments.forEach((a) => {
      tag(a.draftMemberId, "초안");
      tag(a.proofMemberId, "검안");
    });
    findSubjectHeads(members, beforeLecture.subject).forEach((m) => tag(m.id, "과목부장"));
    const groupLeader = findGroupLeader(members, STUDY_GROUPS, beforeLecture.subject);
    if (groupLeader) tag(groupLeader.id, "그룹장");
    const contactNames = Array.from(roleTags.entries()).map(([name, roles]) => `${name} (${roles.join("·")})`);

    return {
      beforeLecture,
      afterLecture,
      beforeAssignments: assignments,
      afterAssignments: result.assignments,
      otherAffectedLectures,
      changes: result.changes,
      affectedAssignmentIds: affectedAssignments.map((a) => a.id),
      contactNames,
    };
  }, [pending, lectures, assignments, members]);

  const toConfirmMerge = useMemo(() => {
    if (currentMemberRole !== "lead") return [];
    if (!currentMember || !currentMember.groupId) return [];
    
    return assignments.filter(a => {
      const lec = lectures.find(l => l.id === a.lectureId);
      if (!lec) return false;
      const group = findGroupBySubject(STUDY_GROUPS, lec.subject);
      if (group?.id !== currentMember.groupId) return false;
      
      const isMerged = lec.subject.includes("&");
      const isNotConfirmed = a.draftOverrideScore === undefined || a.draftOverrideScore === null;
      return isMerged && isNotConfirmed;
    });
  }, [assignments, currentMemberRole, currentMember, lectures]);

  const lectureNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    const subjectCounters = new Map<string, number>();
    const sorted = [...lectures]
      .filter(l => l.assignable && l.status !== "cancelled" && l.status !== "shifted")
      .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    for (const l of sorted) {
      const current = subjectCounters.get(l.subject) || 0;
      const next = current + 1;
      subjectCounters.set(l.subject, next);
      map.set(l.id, next);
    }
    return map;
  }, [lectures]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CalendarClock size={22} className="text-indigo-600" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-slate-900">실시간 시간표 &amp; 자동 배정 시뮬레이터</h1>
          <p className="text-sm text-slate-500">강의를 단축·연장·휴강 처리하면 배정조가 자동으로 롤오버됩니다.</p>
        </div>
        <div className="flex items-center gap-2">
          {canUseSync && (
            <div className="flex flex-col items-end">
              <button
                onClick={handleSheetSyncNow}
                disabled={sheetSyncBusy}
                className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 active:scale-95 transition-all hover:bg-slate-200 disabled:opacity-50"
              >
                <RefreshCw size={16} className={sheetSyncBusy ? "animate-spin" : ""} />
                {sheetSyncBusy ? "동기화 중..." : "동기화"}
              </button>
              {lastSyncLog && (
                <span className="text-[10px] text-slate-400 mt-1 pr-1">
                  최근: {new Date(lastSyncLog.timestamp).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setShowWallpaperModal(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-600 active:scale-95 transition-all hover:bg-indigo-100 h-[40px] mt-0"
            style={{ alignSelf: "flex-start" }}
          >
            <Download size={16} />
            배경화면 다운로드
          </button>
        </div>
      </div>

      {toConfirmMerge.length > 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
          <p className="mb-2 text-sm font-bold text-indigo-900">내 할 일 알림 (그룹장)</p>
          <div className="flex flex-col gap-2">
            {toConfirmMerge.map((a) => {
              const lec = lectures.find((l) => l.id === a.lectureId);
              return (
                <Link
                  key={a.id}
                  href={`/scoring?evaluateProof=${a.id}`}
                  className="group flex items-center justify-between rounded-lg bg-indigo-100/60 p-2 hover:bg-indigo-100 hover:shadow-sm transition border border-indigo-200 hover:border-indigo-300"
                >
                  <p className="text-xs font-medium text-indigo-700 sm:text-sm">
                    <span className="mr-2 inline-block rounded bg-indigo-500 px-2 py-0.5 text-[10px] text-white sm:text-xs">
                      수동 점수 확정 필요 (병합됨)
                    </span>
                    {lec ? `${lec.date} ${lec.subject}` : "강의 정보 없음"}
                  </p>
                  <ExternalLink size={14} className="text-indigo-400 group-hover:text-indigo-600" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

          {activeWeek && (
        <div className="sticky top-[92px] z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setWeekIndex(Math.max(0, activeWeekIndex - 1))}
              disabled={activeWeekIndex === 0}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-30"
              aria-label="이전 주"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-0 text-center">
              <p className="text-sm font-semibold text-slate-900">
                {activeWeek.label}
                <span className="ml-1.5 font-normal text-slate-400">{activeWeek.range}</span>
              </p>
              <p className="text-[11px] text-slate-400">전체 {weeks.length}주</p>
            </div>
            <button
              onClick={() => setWeekIndex(Math.min(weeks.length - 1, activeWeekIndex + 1))}
              disabled={activeWeekIndex >= weeks.length - 1}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-30"
              aria-label="다음 주"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <select
              value={activeWeekIndex}
              onChange={(e) => setWeekIndex(Number(e.target.value))}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              {weeks.map((w) => (
                <option key={w.monday} value={w.index}>
                  {w.label} ({w.range})
                </option>
              ))}
            </select>
            <button
              onClick={() => setWeekIndex(currentWeekIndex)}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600"
            >
              이번 주
            </button>
            {adminMode && (
              <>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => useDashboardStore.getState().undo()}
                    disabled={pastStates.length === 0}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white active:scale-95 transition-all"
                  >
                    ↩ 되돌리기
                  </button>
                  <button
                    onClick={() => {
                      const date = activeWeek?.days[0]?.[0] || new Date().toISOString().split("T")[0];
                      const newLecture: Lecture = {
                        id: `lec_${Math.random().toString(36).slice(2, 9)}`,
                        date,
                        period: "1교시",
                        startTime: "09:00",
                        endTime: "10:00",
                        durationHours: 1,
                        originalDurationHours: 1,
                        subject: "신규 과목",
                        topic: "",
                        professor: "",
                        sessionNumber: "",
                        entryType: "lecture",
                        subjectType: "major",
                        status: "scheduled",
                        note: "",
                        order: 1,
                        assignable: true,
                      };
                      useDashboardStore.getState().addLecture(newLecture, {
                        lectureId: newLecture.id,
                        draftMemberId: null,
                        proofMemberId: null,
                        draftStatus: "pending",
                        proofStatus: "pending",
                        recordingUploaded: false,
                        draftAdjustment: 0,
                        proofAdjustment: 0,
                        draftAdjustmentReason: "",
                        proofAdjustmentReason: "",
                        proofAtDraftLevel: false,
                        draftSubmittedAt: null,
                        proofSubmittedAt: null,
                        bonusPoints: 0,
                      });
                      useDashboardStore.getState().runScheduleAction(newLecture.id, "restore");
                    }}
                    className="flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white active:scale-95"
                  >
                    <Plus size={14} /> 수업 추가
                  </button>
                </div>
              </>
            )}
            <button
              onClick={() => setShowWallpaperModal(true)}
              className={`${adminMode ? "" : "ml-auto"} flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 active:scale-95 transition-colors`}
            >
              <Image size={14} /> 배경화면 다운로드
            </button>
          </div>
        </div>
      )}

      {activeWeek && !activeWeekHasVisibleLecture && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-8 text-center text-sm text-slate-400">
          이 주에는 {STUDY_GROUPS.find((g) => g.id === viewingGroupId)?.name ?? "이 그룹"}이 담당하는 강의가 없습니다.
        </p>
      )}

      {/* Grid Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="min-w-[800px] grid"
          style={{
            gridTemplateColumns: "80px repeat(5, minmax(140px, 1fr))",
            gridTemplateRows: "auto repeat(10, minmax(40px, auto))"
          }}
        >
          {/* Header Row */}
          <div className="bg-[#1f2937] text-white flex items-center justify-center text-sm font-semibold border-b border-r border-slate-700 py-2">
            {activeWeek?.label}
          </div>
          {weekDates.map((dateStr, i) => (
            <div key={dateStr} className="bg-slate-100 flex items-center justify-center text-sm font-bold border-b border-r border-slate-300 py-2">
              {shortDate(dateStr)} ({WEEKDAYS[i]})
            </div>
          ))}

          {/* Time Sidebar */}
          {[1, 2, 3, 4, "lunch", 5, 6, 7, 8, 9].map((period, i) => (
            <div key={i} className="flex flex-col items-center justify-center border-b border-r border-slate-200 bg-white py-1" style={{ gridColumn: 1, gridRow: i + 2 }}>
              {period === "lunch" ? (
                <span className="text-xs font-medium text-slate-500">13:00<br />|<br />14:00</span>
              ) : (
                <>
                  <span className="text-sm font-semibold text-slate-800">{period}</span>
                  <span className="text-[10px] text-slate-400">
                    ({i < 4 ? `0${i + 9}` : i + 9}:00)
                  </span>
                </>
              )}
            </div>
          ))}

          {/* Lunch Row Span */}
          <div className="flex items-center justify-center bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500" style={{ gridColumn: "2 / span 5", gridRow: 6 }}>
            점심시간 (13:00 - 14:00)
          </div>

          {/* Empty Dropzones */}
          {!isNormalUser && weekDates.map((dateStr, colIndex) => {
            return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((period) => {
              const startHour = period <= 4 ? 8 + period : 9 + period;
              const row = startHour - 9 + 2;
              return (
                <div
                  key={`drop-${dateStr}-${period}`}
                  className="border-b border-r border-slate-100/50"
                  style={{ gridColumn: colIndex + 2, gridRow: row, zIndex: 0 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData("text/plain");
                    if (draggedId) {
                      useDashboardStore.getState().moveLecture(draggedId, dateStr, period);
                    }
                  }}
                />
              );
            });
          })}

          {/* Lectures */}
          {weekDates.map((dateStr, colIndex) => {
            const dayLecturesMap = activeWeek?.days.find(([d]) => d === dateStr);
            const dayLectures = dayLecturesMap ? dayLecturesMap[1] : [];

            const notAbsorbed = dayLectures.filter((l) => l.status !== "shifted");
            const filteredLectures = viewingGroupId
              ? notAbsorbed.filter((l) => l.subject === "신규 과목" || findGroupBySubject(STUDY_GROUPS, l.subject)?.id === viewingGroupId)
              : notAbsorbed;

            const groupedLectures = new Map<string, Lecture[]>();
            filteredLectures.forEach(l => {
              const key = `${l.startTime}_${l.durationHours}`;
              if (!groupedLectures.has(key)) groupedLectures.set(key, []);
              groupedLectures.get(key)!.push(l);
            });

            return Array.from(groupedLectures.values()).map(group => {
              const lecture = group[0];
              const isSplit = group.length > 1;
              const startRow = lecture.startTime ? getTimeRow(lecture.startTime) : 2;
              const endRow = lecture.endTime ? getTimeRow(lecture.endTime) : startRow + lecture.durationHours;
              const isInactive = lecture.status === "cancelled" || lecture.status === "shifted";

              // Handle full-day events like holidays spanning all rows
              const actualEndRow = endRow > 11 ? 12 : endRow;

              return (
                <div
                  key={lecture.id}
                  draggable={!isNormalUser}
                  onDragStart={(e) => {
                    if (isNormalUser) return;
                    e.dataTransfer.setData("text/plain", lecture.id);
                  }}
                  onDragOver={(e) => {
                    if (isNormalUser) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (isNormalUser) return;
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData("text/plain");
                    if (draggedId && draggedId !== lecture.id) {
                      useDashboardStore.getState().swapLectures(draggedId, lecture.id);
                    }
                  }}
                  onClick={() => {
                    if (isNormalUser) return;
                    setSelectedLecture(lecture);
                  }}
                  className={`m-0.5 rounded-lg border p-1.5 transition-all flex flex-col justify-center items-center text-center overflow-hidden
                    ${!isNormalUser ? "cursor-pointer hover:brightness-95" : "cursor-default"}
                    ${getLectureColor(lecture, viewingGroupId)}
                    ${isInactive ? "opacity-50" : ""}
                  `}
                  style={{
                    gridColumn: colIndex + 2,
                    gridRow: `${startRow} / ${actualEndRow}`,
                    zIndex: 10
                  }}
                >
                  <div className="flex flex-col items-center justify-center w-full h-full overflow-hidden px-1">
                    <p className="text-[11px] font-bold leading-tight line-clamp-2">
                      {lecture.topic && lecture.topic !== lecture.subject
                        ? (isSplit ? lecture.topic.replace(/\s*\(\d+팀 배정\)/, "") : lecture.topic)
                        : `${lecture.subject}${lecture.sessionNumber ? ` ${lecture.sessionNumber}번` : ""}`}
                    </p>
                    {lecture.professor && (
                      <p className="text-[10px] mt-0.5 opacity-90 font-medium">
                        ({lecture.professor})
                      </p>
                    )}
                    {lecture.assignable && (
                      <div className="text-[9px] mt-1 opacity-85 font-medium leading-tight text-center">
                        {(() => {
                          const allRows = group.flatMap(l => {
                            const lAssignments = assignments.filter((a) => a.lectureId === l.id);
                            return lAssignments.map(a => ({ a, lId: l.id }));
                          });
                          if (allRows.length === 0) return <span>미배정</span>;
                          return allRows.map(({ a, lId }, idx) => {
                            const d = members.find(m => m.id === a.draftMemberId)?.name ?? "미배정";
                            const p = members.find(m => m.id === a.proofMemberId)?.name ?? "미배정";
                            const num = lectureNumberMap.get(lId);
                            return (
                              <div key={idx}>
                                {num ? <span className="font-bold text-indigo-700">[{num}번] </span> : ""}초:{d} / 검:{p}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                    {lecture.status !== "scheduled" && (
                      <span className="mt-1 inline-block rounded bg-black/10 px-1 text-[9px] font-bold uppercase">
                        {lecture.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            });
          })}
        </div>
      </div>

      {selectedLecture && (
        <LectureDetailModal
          lecture={selectedLecture}
          assignments={assignments.filter((a) => a.lectureId === selectedLecture.id)}
          members={members}
          onClose={() => setSelectedLecture(null)}
          onAction={(action) => setPending({ lectureId: selectedLecture.id, action })}
          onUpdateLecture={(info) => updateLectureInfo(selectedLecture.id, info)}
          onSetDraftMember={setDraftMember}
          onSetProofMember={setProofMember}
          onSetActualDuration={(minutes) => {
            setActualDuration(selectedLecture.id, minutes);
            setSelectedLecture(null);
          }}
        />
      )}

      {pending && preview && (
        <SchedulePreviewModal
          action={pending.action}
          beforeLecture={preview.beforeLecture}
          afterLecture={preview.afterLecture}
          beforeAssignments={preview.beforeAssignments}
          afterAssignments={preview.afterAssignments}
          otherAffectedLectures={preview.otherAffectedLectures}
          members={members}
          changes={preview.changes}
          contactNames={preview.contactNames}
          showEarlyEndBonus={pending.action === "reduce" || pending.action === "merge_next" || pending.action === "cancel"}
          onClose={() => setPending(null)}
          onConfirm={(earlyEndBonus) => {
            runScheduleAction(pending.lectureId, pending.action);
            if (earlyEndBonus) {
              preview.affectedAssignmentIds.forEach((id) => setBonus(id, earlyEndBonus));
            }
            setPending(null);
          }}
        />
      )}
      {showWallpaperModal && (
        <WallpaperModal onClose={() => setShowWallpaperModal(false)} weeks={weeks} />
      )}
    </div>
  );
}
