"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, ListChecks, ArrowRight, Trophy, ChevronRight, ExternalLink, Award } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import D1NoticeCard from "../D1NoticeCard";
import StatusBadge from "../StatusBadge";
import TaskChecklist from "../TaskChecklist";
import ScoreReportModal from "../ScoreReportModal";
import { isoDateFromToday } from "@/lib/dates";
import { findGroupBySubject } from "@/lib/roles";
import { STUDY_GROUPS } from "@/lib/studyGroups";
import { Assignment } from "@/lib/types";
import ActivityLogCard from "../ActivityLogCard";

export default function HomeView() {
  const lectures = useDashboardStore((s) => s.lectures);
  const assignments = useDashboardStore((s) => s.assignments);
  const members = useDashboardStore((s) => s.members);
  const viewingGroupId = useDashboardStore((s) => s.viewingGroupId);
  const simulatedToday = useDashboardStore((s) => s.simulatedToday);
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const currentMember = useMemo(() => members.find(m => m.id === currentMemberId), [members, currentMemberId]);

  const today = useMemo(() => isoDateFromToday(0, simulatedToday), [simulatedToday]);

  const lectureIdsInGroup = useMemo(() => {
    if (!viewingGroupId) return null;
    const ids = new Set(
      lectures.filter((l) => findGroupBySubject(STUDY_GROUPS, l.subject)?.id === viewingGroupId).map((l) => l.id)
    );
    return ids;
  }, [lectures, viewingGroupId]);

  const scopedAssignments = useMemo(
    () => (lectureIdsInGroup ? assignments.filter((a) => lectureIdsInGroup.has(a.lectureId)) : assignments),
    [assignments, lectureIdsInGroup]
  );

  const stats = useMemo(() => {
    const pendingDrafts = scopedAssignments.filter((a) => a.draftStatus === "pending").length;
    const delayed = scopedAssignments.filter((a) => a.draftStatus === "delayed" || a.proofStatus === "delayed").length;
    const shifted = scopedAssignments.filter((a) => a.shiftedFromLectureId).length;
    return { pendingDrafts, delayed, shifted };
  }, [scopedAssignments]);

  const todayLectures = useMemo(
    () =>
      lectures
        .filter(
          (l) =>
            l.date === today &&
            l.status !== "cancelled" &&
            l.status !== "shifted" &&
            (!lectureIdsInGroup || lectureIdsInGroup.has(l.id))
        )
        .sort((a, b) => a.order - b.order),
    [lectures, today, lectureIdsInGroup]
  );

  const hasConsecutiveLectures = useMemo(() => {
    let lastProfessor = null;
    let totalHours = 0;
    for (const lecture of todayLectures) {
      if (lecture.professor === lastProfessor) {
        totalHours += lecture.durationHours;
      } else {
        lastProfessor = lecture.professor;
        totalHours = lecture.durationHours;
      }
      if (totalHours >= 3 && lecture.professor !== "미정" && lecture.professor !== "") {
        return true;
      }
    }
    return false;
  }, [todayLectures]);

  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? "미배정" : "미배정");
  const currentMemberRole = members.find((m) => m.id === currentMemberId)?.role;
  const isSubjectHead = currentMemberRole === "subjectHead";
  const isLead = currentMemberRole === "lead";
  const isNormalUser = !isSubjectHead && !isLead;

  const [reportModalData, setReportModalData] = useState<{ assignment: any, type: "draft" | "proof", lecture: any } | null>(null);
  const [showMyReports, setShowMyReports] = useState(false);

  const myPublishedReports = useMemo(() => {
    if (!currentMemberId) return [];
    type ReportItem = { type: "draft" | "proof"; assignment: Assignment; date: string };
    const drafts: ReportItem[] = assignments
      .filter((a) => a.draftMemberId === currentMemberId && a.draftScorePublished)
      .map((a) => ({ type: "draft" as const, assignment: a, date: lectures.find((l) => l.id === a.lectureId)?.date || "" }));
    const proofs: ReportItem[] = assignments
      .filter((a) => a.proofMemberId === currentMemberId && a.proofScorePublished)
      .map((a) => ({ type: "proof" as const, assignment: a, date: lectures.find((l) => l.id === a.lectureId)?.date || "" }));
    return [...drafts, ...proofs].sort((a, b) => b.date.localeCompare(a.date));
  }, [assignments, currentMemberId, lectures]);

  const myTasks = useMemo(() => {
    if (!currentMemberId) return [];

    let drafts = assignments.filter(a => a.draftMemberId === currentMemberId && (a.draftStatus === "pending" || a.draftStatus === "shifted"));
    let proofs = assignments.filter(a => a.proofMemberId === currentMemberId && (a.proofStatus === "pending" || a.proofStatus === "delayed"));
    let toEvaluate: Assignment[] = [];
    let toConfirmMerge: Assignment[] = [];

    if (isLead) {
      const mem = members.find((m) => m.id === currentMemberId);
      if (mem && mem.groupId) {
        toEvaluate = assignments.filter(a => {
          const lec = lectures.find(l => l.id === a.lectureId);
          if (!lec) return false;
          const group = findGroupBySubject(STUDY_GROUPS, lec.subject);
          if (group?.id !== mem.groupId) return false;
          
          const draftEvaluated = !!a.draftAdjustmentReason;
          const proofNotEvaluated = !a.proofAdjustmentReason;
          return draftEvaluated && proofNotEvaluated;
        });

        toConfirmMerge = assignments.filter(a => {
          const lec = lectures.find(l => l.id === a.lectureId);
          if (!lec) return false;
          const group = findGroupBySubject(STUDY_GROUPS, lec.subject);
          if (group?.id !== mem.groupId) return false;
          
          const isMerged = lec.subject.includes("&");
          const isNotConfirmed = a.draftOverrideScore === undefined || a.draftOverrideScore === null;
          return isMerged && isNotConfirmed;
        });
      }
    }

    type TaskItem = { type: 'draft' | 'proof' | 'evaluate' | 'confirm'; assignment: Assignment; date: string };
    
    const allTasks: TaskItem[] = [
      ...drafts.map(a => ({ type: 'draft' as const, assignment: a, date: lectures.find(l => l.id === a.lectureId)?.date || "" })),
      ...proofs.map(a => ({ type: 'proof' as const, assignment: a, date: lectures.find(l => l.id === a.lectureId)?.date || "" })),
      ...toEvaluate.map(a => ({ type: 'evaluate' as const, assignment: a, date: lectures.find(l => l.id === a.lectureId)?.date || "" })),
      ...toConfirmMerge.map(a => ({ type: 'confirm' as const, assignment: a, date: lectures.find(l => l.id === a.lectureId)?.date || "" }))
    ];

    return allTasks.sort((a, b) => a.date.localeCompare(b.date));
  }, [assignments, currentMemberId, isLead, lectures, members]);

  return (
    <div className="space-y-6">
      {myTasks.length > 0 && (
        <div className={`rounded-2xl border border-indigo-200 bg-indigo-50 shadow-sm ${isSubjectHead ? 'p-6 sm:p-8' : 'p-4'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`flex items-center justify-center rounded-full bg-indigo-600 text-white shadow ${isSubjectHead ? 'h-8 w-8' : 'h-6 w-6'}`}>
              <AlertTriangle size={isSubjectHead ? 16 : 14} />
            </span>
            <p className={`font-bold text-indigo-900 ${isSubjectHead ? 'text-lg' : 'text-sm'}`}>내 할 일 알림</p>
          </div>
          <div className={`flex flex-col gap-2 ${isSubjectHead ? 'pl-10 mt-4' : 'pl-8 mt-2'}`}>
            {myTasks.map((item, idx) => {
              const a = item.assignment;
              const lec = lectures.find(l => l.id === a.lectureId);
              
              if (item.type === 'draft') {
                if (isSubjectHead) {
                  return (
                    <div key={`draft-${a.id}-${idx}`} className="group flex items-center justify-between rounded-lg bg-white/60 p-2 border border-transparent">
                      <p className={`font-medium text-indigo-700 text-sm`}>
                        <span className="mr-2 inline-block rounded bg-indigo-200 px-2 py-0.5 text-xs">초안</span>
                        {lec ? `${lec.date} ${lec.subject}` : "강의 정보 없음"}
                      </p>
                    </div>
                  );
                }
                if (isLead || isNormalUser) {
                  return (
                    <button key={`draft-${a.id}-${idx}`} onClick={() => {
                      if (a.draftScorePublished) setReportModalData({ assignment: a, type: "draft", lecture: lec });
                      else alert("승인(채점 확정)이 완료되지 않아 아직 채점 내역을 볼 수 없습니다.");
                    }} className="group flex items-center justify-between rounded-lg bg-white/60 p-2 hover:bg-white hover:shadow-sm transition border border-transparent hover:border-indigo-100 w-full text-left">
                      <p className="font-medium text-indigo-700 text-xs">
                        <span className="mr-2 inline-block rounded bg-indigo-200 px-2 py-0.5 text-[10px] sm:text-xs">초안</span>
                        {lec ? `${lec.date} ${lec.subject}` : "강의 정보 없음"}
                      </p>
                      <ExternalLink size={14} className="text-indigo-300 group-hover:text-indigo-500" />
                    </button>
                  );
                }
                return (
                  <Link key={`draft-${a.id}-${idx}`} href={`/scoring?evaluateDraft=${a.id}`} className="group flex items-center justify-between rounded-lg bg-white/60 p-2 hover:bg-white hover:shadow-sm transition border border-transparent hover:border-indigo-100">
                    <p className="font-medium text-indigo-700 text-xs">
                      <span className="mr-2 inline-block rounded bg-indigo-200 px-2 py-0.5 text-[10px] sm:text-xs">초안</span>
                      {lec ? `${lec.date} ${lec.subject}` : "강의 정보 없음"}
                    </p>
                    <ExternalLink size={14} className="text-indigo-300 group-hover:text-indigo-500" />
                  </Link>
                );
              }

              if (item.type === 'proof') {
                if (isLead || isNormalUser) {
                  return (
                    <button key={`proof-${a.id}-${idx}`} onClick={() => {
                      if (a.proofScorePublished) setReportModalData({ assignment: a, type: "proof", lecture: lec });
                      else alert("승인(채점 확정)이 완료되지 않아 아직 채점 내역을 볼 수 없습니다.");
                    }} className="group flex items-center justify-between rounded-lg bg-white/60 p-2 hover:bg-white hover:shadow-sm transition border border-transparent hover:border-indigo-100 w-full text-left">
                      <p className="font-medium text-indigo-700 text-xs">
                        <span className="mr-2 inline-block rounded bg-indigo-200 px-2 py-0.5 text-[10px] sm:text-xs">검안</span>
                        {lec ? `${lec.date} ${lec.subject}` : "강의 정보 없음"}
                      </p>
                      <ExternalLink size={14} className="text-indigo-300 group-hover:text-indigo-500" />
                    </button>
                  );
                }
                const href = isSubjectHead ? `/scoring?evaluateDraft=${a.id}` : `/scoring?evaluateProof=${a.id}`;
                return (
                  <Link key={`proof-${a.id}-${idx}`} href={href} className="group flex items-center justify-between rounded-lg bg-white/60 p-2 hover:bg-white hover:shadow-sm transition border border-transparent hover:border-indigo-100">
                    <p className={`font-medium text-indigo-700 ${isSubjectHead ? 'text-sm' : 'text-xs'}`}>
                      <span className="mr-2 inline-block rounded bg-indigo-200 px-2 py-0.5 text-[10px] sm:text-xs">검안</span>
                      {lec ? `${lec.date} ${lec.subject}` : "강의 정보 없음"}
                    </p>
                    <ExternalLink size={14} className="text-indigo-300 group-hover:text-indigo-500" />
                  </Link>
                );
              }

              if (item.type === 'evaluate') {
                return (
                  <Link key={`eval-${a.id}-${idx}`} href={`/scoring?evaluateProof=${a.id}`} className="group flex items-center justify-between rounded-lg bg-white/60 p-2 hover:bg-white hover:shadow-sm transition border border-transparent hover:border-indigo-100">
                    <p className={`font-medium text-indigo-700 ${isSubjectHead ? 'text-sm' : 'text-xs'}`}>
                      <span className="mr-2 inline-block rounded bg-indigo-200 px-2 py-0.5 text-[10px] sm:text-xs">평가 대기</span>
                      {lec ? `${lec.date} ${lec.subject}` : "강의 정보 없음"}
                    </p>
                    <ExternalLink size={14} className="text-indigo-300 group-hover:text-indigo-500" />
                  </Link>
                );
              }

              if (item.type === 'confirm') {
                return (
                  <Link key={`confirm-${a.id}-${idx}`} href={`/scoring?evaluateProof=${a.id}`} className="group flex items-center justify-between rounded-lg bg-indigo-100/60 p-2 hover:bg-indigo-100 hover:shadow-sm transition border border-indigo-200 hover:border-indigo-300">
                    <p className={`font-medium text-indigo-700 ${isSubjectHead ? 'text-sm' : 'text-xs'}`}>
                      <span className="mr-2 inline-block rounded bg-indigo-500 px-2 py-0.5 text-[10px] sm:text-xs text-white">수동 점수 확정 필요 (병합됨)</span>
                      {lec ? `${lec.date} ${lec.subject}` : "강의 정보 없음"}
                    </p>
                    <ExternalLink size={14} className="text-indigo-400 group-hover:text-indigo-600" />
                  </Link>
                );
              }

              return null;
            })}
          </div>
        </div>
      )}

      {reportModalData && (
        <ScoreReportModal
          assignment={reportModalData.assignment}
          lecture={reportModalData.lecture}
          type={reportModalData.type}
          onClose={() => setReportModalData(null)}
        />
      )}

      {currentMemberId && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            onClick={() => setShowMyReports((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Award size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">학습부 평가 점수 보기</p>
                <p className="text-xs text-slate-500">공개된 내 초안·검안 평가 {myPublishedReports.length}건</p>
              </div>
            </div>
            <ChevronRight size={18} className={`text-slate-300 transition-transform ${showMyReports ? "rotate-90" : ""}`} />
          </button>
          {showMyReports && (
            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              {myPublishedReports.length === 0 && (
                <p className="py-2 text-center text-xs text-slate-400">아직 공개된 평가 내역이 없습니다.</p>
              )}
              {myPublishedReports.map((item, idx) => {
                const lec = lectures.find((l) => l.id === item.assignment.lectureId);
                return (
                  <button
                    key={`myreport-${item.type}-${item.assignment.id}-${idx}`}
                    onClick={() => setReportModalData({ assignment: item.assignment, type: item.type, lecture: lec })}
                    className="group flex w-full items-center justify-between rounded-lg bg-slate-50 p-2 text-left hover:bg-slate-100 transition"
                  >
                    <p className="text-xs font-medium text-slate-700">
                      <span className="mr-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                        {item.type === "draft" ? "초안" : "검안"}
                      </span>
                      {lec ? `${lec.date} ${lec.subject}` : "강의 정보 없음"}
                    </p>
                    <ExternalLink size={13} className="text-slate-300 group-hover:text-slate-500" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isLead && <D1NoticeCard />}

      {isLead && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3 text-center shadow-sm">
            <Clock size={16} className="mx-auto mb-1 text-slate-400" />
            <p className="text-lg sm:text-xl font-bold text-slate-900">{stats.pendingDrafts}</p>
            <p className="text-[11px] sm:text-xs text-slate-500">초안 대기</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3 text-center shadow-sm">
            <AlertTriangle size={16} className="mx-auto mb-1 text-rose-400" />
            <p className="text-lg sm:text-xl font-bold text-rose-600">{stats.delayed}</p>
            <p className="text-[11px] sm:text-xs text-slate-500">지연 건</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3 text-center shadow-sm">
            <ListChecks size={16} className="mx-auto mb-1 text-amber-400" />
            <p className="text-lg sm:text-xl font-bold text-amber-600">{stats.shifted}</p>
            <p className="text-[11px] sm:text-xs text-slate-500">롤오버됨</p>
          </div>
        </div>
      )}

      {!isSubjectHead && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">오늘의 시간표</h2>
            <Link href="/schedule" className="flex items-center gap-0.5 text-xs font-medium text-indigo-600">
              전체 보기 <ArrowRight size={13} />
            </Link>
          </div>

          {hasConsecutiveLectures && (
            <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 shadow-sm">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-semibold">연강 주의</p>
                <p className="text-xs text-rose-700">동일 교수님의 3시간 이상 연강이 있습니다. 단축 수업 및 학습부 배분에 유의하세요.</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {todayLectures.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white py-6 text-center text-sm text-slate-400">
                오늘 예정된 강의가 없습니다.
              </p>
            )}
            {todayLectures.map((lecture) => {
              const a = assignments.find((x) => x.lectureId === lecture.id);
              return (
                <div
                  key={lecture.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {lecture.period} {lecture.subject}
                      <span className="ml-1 font-normal text-slate-400">({lecture.professor})</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      초안 {memberName(a?.draftMemberId ?? null)} · 검안 {memberName(a?.proofMemberId ?? null)}
                    </p>
                  </div>
                  <StatusBadge status={lecture.status} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!isNormalUser && (
        <>
          <TaskChecklist />

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/schedule"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.98]"
            >
              <p className="text-sm font-semibold text-slate-800">일정 변경 시뮬레이터</p>
              <p className="mt-0.5 text-xs text-slate-500">단축·연장·휴강 처리 &amp; 자동 롤오버</p>
            </Link>
            <Link
              href="/scoring"
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Trophy size={24} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">스코어링</p>
                <p className="mt-0.5 text-xs text-slate-500">초안·검안·지연 패널티 점수</p>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </Link>
          </div>

          {currentMember?.name === "성민수" && (
            <div className="mt-4">
              <ActivityLogCard />
            </div>
          )}
        </>
      )}
    </div>
  );
}
