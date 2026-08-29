"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Mic, MicOff, Search, Trophy, CheckCircle2, Plus, X } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { scoreAssignment, SCORING_RULES } from "@/lib/scoring";
import { Assignment, Member } from "@/lib/types";
import { findGroupBySubject } from "@/lib/roles";
import { STUDY_GROUPS } from "@/lib/studyGroups";
import { GROUP_DRAFT_SEQUENCES } from "@/lib/sequences";
import StatusBadge from "../StatusBadge";
import DraftEvaluationModal from "../DraftEvaluationModal";
import ProofEvaluationModal from "../ProofEvaluationModal";
import MergeScoreConfirmModal from "../MergeScoreConfirmModal";

const BONUS_OPTIONS = Array.from(
  { length: (SCORING_RULES.bonusMax - SCORING_RULES.bonusMin) / SCORING_RULES.bonusStep + 1 },
  (_, i) => Math.round((SCORING_RULES.bonusMin + i * SCORING_RULES.bonusStep) * 10) / 10
);

function memberName(members: Member[], id: string | null): string {
  if (!id) return "미배정";
  return members.find((m) => m.id === id)?.name ?? "미배정";
}

export default function ScoringView() {
  const lectures = useDashboardStore((s) => s.lectures);
  const assignments = useDashboardStore((s) => s.assignments);
  const members = useDashboardStore((s) => s.members);
  const markDraftSubmitted = useDashboardStore((s) => s.markDraftSubmitted);
  const markProofSubmitted = useDashboardStore((s) => s.markProofSubmitted);
  const toggleRecording = useDashboardStore((s) => s.toggleRecording);
  const setBonus = useDashboardStore((s) => s.setBonus);
  const resetDraftSubmission = useDashboardStore((s) => s.resetDraftSubmission);
  const resetProofSubmission = useDashboardStore((s) => s.resetProofSubmission);
  const addExtraBonus = useDashboardStore((s) => s.addExtraBonus);
  const removeExtraBonus = useDashboardStore((s) => s.removeExtraBonus);
  const setDraftAdjustment = useDashboardStore((s) => s.setDraftAdjustment);
  const setProofAdjustment = useDashboardStore((s) => s.setProofAdjustment);
  const toggleProofAtDraftLevel = useDashboardStore((s) => s.toggleProofAtDraftLevel);
  const setDraftOverrideScore = useDashboardStore((s) => s.setDraftOverrideScore);
  const toggleDraftScorePublished = useDashboardStore((s) => s.toggleDraftScorePublished);
  const toggleProofScorePublished = useDashboardStore((s) => s.toggleProofScorePublished);
  const viewingGroupId = useDashboardStore((s) => s.viewingGroupId);
  const viewingGroup = STUDY_GROUPS.find((g) => g.id === viewingGroupId);
  const adminMode = useDashboardStore((s) => s.adminMode);
  
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const currentMember = useMemo(() => members.find(m => m.id === currentMemberId), [members, currentMemberId]);
  const isSubjectHead = currentMember?.role === "subjectHead";
  const isLead = currentMember?.role === "lead";

  const searchParams = useSearchParams();

  const [tab, setTab] = useState<"leaderboard" | "detail">(() => {
    const currentMember = members.find(m => m.id === currentMemberId);
    if (currentMember && (currentMember.role === "lead" || currentMember.role === "subjectHead")) {
      return "detail";
    }
    return "leaderboard";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [evaluatingDraftId, setEvaluatingDraftId] = useState<string | null>(null);
  const [evaluatingProofId, setEvaluatingProofId] = useState<string | null>(null);
  const [confirmingAssignment, setConfirmingAssignment] = useState<Assignment | null>(null);

  const setViewingGroupId = useDashboardStore((s) => s.setViewingGroupId);
  const simulatedToday = useDashboardStore((s) => s.simulatedToday);

  useEffect(() => {
    const draftId = searchParams.get("evaluateDraft");
    const proofId = searchParams.get("evaluateProof");
    const targetId = draftId || proofId;

    if (targetId) {
      // 해당 과제의 그룹으로 viewingGroupId 자동 변경
      const assignment = assignments.find(a => a.id === targetId);
      if (assignment) {
        const lecture = lectures.find(l => l.id === assignment.lectureId);
        if (lecture) {
          const group = findGroupBySubject(STUDY_GROUPS, lecture.subject);
          if (group && group.id !== viewingGroupId) {
            setViewingGroupId(group.id);
          }
        }
      }

      setTab("detail");
      if (draftId) setEvaluatingDraftId(draftId);
      if (proofId) setEvaluatingProofId(proofId);

      // 스크롤 이동
      setTimeout(() => {
        const el = document.getElementById(`assignment-${targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
    }
  }, [searchParams]);

  const ExtraBonusEditor = ({ assignmentId, type, bonuses }: { assignmentId: string, type: "draft" | "proof", bonuses: { id: string, amount: number, reason: string }[] | undefined }) => {
    const [amount, setAmount] = useState(0.5);
    const [reason, setReason] = useState("");

    return (
      <div className="mt-2 border-t border-slate-200 pt-2">
        <p className="mb-1 text-[11px] font-medium text-slate-400">기타 가산점 추가</p>
        <div className="flex flex-col gap-1.5">
          {(bonuses || []).map(b => (
            <div key={b.id} className="flex items-center justify-between rounded bg-white px-2 py-1 shadow-sm border border-slate-100 text-[11px]">
              <span className="text-slate-600 font-medium">+{b.amount}pt <span className="text-slate-400">({b.reason})</span></span>
              <button onClick={() => removeExtraBonus(assignmentId, type, b.id)} className="text-slate-400 hover:text-rose-500"><X size={12} /></button>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <input type="number" step={0.5} value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs" />
            <input type="text" placeholder="사유 기입" value={reason} onChange={e => setReason(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs" />
            <button
              onClick={() => {
                if (reason.trim()) {
                  addExtraBonus(assignmentId, type, amount, reason);
                  setReason("");
                }
              }}
              className="rounded-lg bg-indigo-50 p-1 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
              disabled={!reason.trim()}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const rows = useMemo(() => {
    return assignments
      .map((a) => {
        const lecture = lectures.find((l) => l.id === a.lectureId);
        if (!lecture) return null;
        
        if (isSubjectHead && !adminMode) {
          if (viewingGroupId && findGroupBySubject(STUDY_GROUPS, lecture.subject)?.id !== viewingGroupId) return null;
          if (a.proofMemberId !== currentMemberId) return null;
        } else {
          if (viewingGroupId && findGroupBySubject(STUDY_GROUPS, lecture.subject)?.id !== viewingGroupId) return null;
        }
        
        return { assignment: a, lecture, breakdown: scoreAssignment(lecture, a) };
      })
      .filter(Boolean) as { assignment: Assignment; lecture: (typeof lectures)[number]; breakdown: ReturnType<typeof scoreAssignment> }[];
  }, [assignments, lectures, viewingGroupId, isSubjectHead, adminMode, currentMember]);

  const scopedMembers = useMemo(
    () => {
      if (!viewingGroupId) return members;
      const draftSeq = GROUP_DRAFT_SEQUENCES[viewingGroupId] || [];
      return members.filter((m) =>
        m.groupId === viewingGroupId || draftSeq.some(name => name.replace(/\(\d+\)/g, "").trim() === m.name)
      );
    },
    [members, viewingGroupId]
  );

  const availableSubjects = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => s.add(r.lecture.subject));
    return Array.from(s);
  }, [rows]);

  const prevConfig = useRef({ date: simulatedToday, group: viewingGroupId });

  useEffect(() => {
    const configChanged = prevConfig.current.date !== simulatedToday || prevConfig.current.group !== viewingGroupId;
    
    if (availableSubjects.length > 0 && (selectedSubject === null || configChanged)) {
      const todayDateStr = simulatedToday || new Date().toISOString().split("T")[0];
      
      // Find lecture exactly on today or the closest upcoming one
      const relevantLectures = lectures
        .filter(l => availableSubjects.includes(l.subject) && l.date >= todayDateStr)
        .sort((a, b) => a.date.localeCompare(b.date));
        
      const targetLec = relevantLectures[0];
      
      if (targetLec) {
        setSelectedSubject(targetLec.subject);
      } else if (configChanged) {
        setSelectedSubject(null);
      }

      if (configChanged) {
        prevConfig.current = { date: simulatedToday, group: viewingGroupId };
      }
    }
  }, [availableSubjects, lectures, simulatedToday, viewingGroupId, selectedSubject]);

  const leaderboard = useMemo(() => {
    const totals = new Map<string, number>();
    rows.forEach(({ assignment, breakdown }) => {
      if (assignment.draftMemberId) {
        totals.set(
          assignment.draftMemberId,
          (totals.get(assignment.draftMemberId) ?? 0) + breakdown.draftTotal
        );
      }
      if (assignment.proofMemberId) {
        totals.set(
          assignment.proofMemberId,
          (totals.get(assignment.proofMemberId) ?? 0) + breakdown.proofTotal
        );
      }
    });
    return scopedMembers
      .map((m) => ({ member: m, total: Math.round((totals.get(m.id) ?? 0) * 10) / 10 }))
      .sort((a, b) => b.total - a.total);
  }, [rows, scopedMembers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy size={22} className="text-indigo-600" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            스코어링 &amp; 페널티 자동 계산{viewingGroup && ` · ${viewingGroup.name}`}
          </h1>
          <p className="text-sm text-slate-500">
            본과목 2시간 8점 · 부과목 2시간 4점 · 검안 본과목 5점 / 부과목 2.5점 · 지연 시 페널티 자동 적용
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          placeholder="이름 또는 학번으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {!(isSubjectHead && !adminMode) && (
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
          {(["leaderboard", "detail"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 transition ${tab === t ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                }`}
            >
              {t === "leaderboard" ? "리더보드" : "상세 내역"}
            </button>
          ))}
        </div>
      )}

      {((isSubjectHead && !adminMode) ? "detail" : tab) === "leaderboard" && (
        <div className="space-y-6">
          {(() => {
            const sq = searchQuery.trim().toLowerCase();
            const filteredLeaderboard = leaderboard.filter(
              (x) =>
                !sq ||
                x.member.name.toLowerCase().includes(sq) ||
                (x.member.studentId && x.member.studentId.toLowerCase().includes(sq))
            );

            if (!viewingGroup) {
              return (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {filteredLeaderboard.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>
                  )}
                  {filteredLeaderboard.map(({ member, total }, idx) => (
                    <div
                      key={member.id}
                      onClick={() => {
                        setSearchQuery(member.name);
                        setTab("detail");
                      }}
                      className={`flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-slate-50 ${idx !== leaderboard.length - 1 ? "border-b border-slate-100" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${idx === 0
                              ? "bg-amber-100 text-amber-700"
                              : idx === 1
                                ? "bg-slate-200 text-slate-600"
                                : idx === 2
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-slate-50 text-slate-400"
                            }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{member.name}</p>
                          <p className="text-xs text-slate-400">{member.cohort}</p>
                        </div>
                      </div>
                      <p className={`text-base font-bold ${total < 0 ? "text-rose-600" : "text-slate-900"}`}>{total} pt</p>
                    </div>
                  ))}
                </div>
              );
            }

            const subjectHeads = filteredLeaderboard.filter(x =>
              x.member.groupId === viewingGroup.id && (x.member.role === "subjectHead" || x.member.role === "lead")
            ).sort((a, b) => {
              if (a.member.role === "lead" && b.member.role !== "lead") return -1;
              if (a.member.role !== "lead" && b.member.role === "lead") return 1;
              return 0;
            });

            const drafters = filteredLeaderboard.filter(x => {
              if (x.member.name === "성민수") return true;
              return !(x.member.groupId === viewingGroup.id && (x.member.role === "subjectHead" || x.member.role === "lead"));
            });

            const renderList = (list: typeof leaderboard, title: string) => (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-700 px-1">{title}</h2>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {list.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">인원이 없습니다.</p>}
                  {list.map(({ member, total }, idx) => (
                    <div
                      key={member.id}
                      onClick={() => {
                        setSearchQuery(member.name);
                        setTab("detail");
                      }}
                      className={`flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-slate-50 ${idx !== list.length - 1 ? "border-b border-slate-100" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${idx === 0
                              ? "bg-amber-100 text-amber-700"
                              : idx === 1
                                ? "bg-slate-200 text-slate-600"
                                : idx === 2
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-slate-50 text-slate-400"
                            }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{member.name}</p>
                          <p className="text-xs text-slate-400">{member.cohort}</p>
                        </div>
                      </div>
                      <p className={`text-base font-bold ${total < 0 ? "text-rose-600" : "text-slate-900"}`}>{total} pt</p>
                    </div>
                  ))}
                </div>
              </div>
            );

            return (
              <>
                {renderList(subjectHeads, "과목부장 및 그룹장")}
                {renderList(drafters, "초안자")}
              </>
            );
          })()}
        </div>
      )}

      {((isSubjectHead && !adminMode) ? "detail" : tab) === "detail" && (
        <div className="space-y-3">
          {(isSubjectHead || isLead) && availableSubjects.length > 1 && (
            <div className="flex flex-wrap gap-2 pb-2">
              <button
                onClick={() => setSelectedSubject(null)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${selectedSubject === null ? "bg-indigo-600 text-white shadow" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                전체 과목
              </button>
              {availableSubjects.map(subj => (
                <button
                  key={subj}
                  onClick={() => setSelectedSubject(subj)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${selectedSubject === subj ? "bg-indigo-600 text-white shadow" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {subj}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const filteredRows = rows.filter(({ assignment, lecture }) => {
              if (selectedSubject && lecture.subject !== selectedSubject) return false;
              const sq = searchQuery.trim().toLowerCase();
              if (!sq) return true;
              
              const draftMem = members.find((m) => m.id === assignment.draftMemberId);
              const proofMem = members.find((m) => m.id === assignment.proofMemberId);
              
              const matchDraft = draftMem && (
                draftMem.name.toLowerCase().includes(sq) ||
                (draftMem.studentId && draftMem.studentId.toLowerCase().includes(sq))
              );
              
              const matchProof = proofMem && (
                proofMem.name.toLowerCase().includes(sq) ||
                (proofMem.studentId && proofMem.studentId.toLowerCase().includes(sq))
              );
              
              return matchDraft || matchProof;
            });

            if (filteredRows.length === 0) {
              return <p className="py-8 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>;
            }

            const groupedRows = filteredRows.reduce((acc, row) => {
              const subj = row.lecture.subject;
              if (!acc[subj]) acc[subj] = [];
              acc[subj].push(row);
              return acc;
            }, {} as Record<string, typeof rows>);

            return Object.entries(groupedRows).map(([subject, subjectRows]) => (
              <div key={subject} className="space-y-3">
                <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-slate-100/80 px-4 py-2 text-sm font-bold text-slate-700 backdrop-blur-md">
                  <span>{subject}</span>
                  <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm">{subjectRows.length}건</span>
                </div>
                {subjectRows.map(({ assignment, lecture, breakdown }) => (
                  <div id={`assignment-${assignment.id}`} key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {lecture.period} {lecture.subject}
                        </p>
                        <p className="text-xs text-slate-500">
                          {lecture.date} · {lecture.professor} · {lecture.durationHours}h
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-4 text-right">
                          <div>
                            <p className="text-[10px] font-medium text-slate-400 text-right">초안</p>
                            <p className={`text-lg font-bold ${breakdown.draftTotal < 0 ? "text-rose-600" : "text-indigo-700"}`}>
                              {Math.round(breakdown.draftTotal * 10) / 10} pt
                            </p>
                          </div>
                          {(() => {
                            const canSeeProof = isLead || assignment.proofScorePublished;
                            return (
                              <div>
                                <p className="text-[10px] font-medium text-slate-400 text-right">검안</p>
                                <p className={`text-lg font-bold ${!canSeeProof ? "text-slate-400" : breakdown.proofTotal < 0 ? "text-rose-600" : "text-indigo-700"}`}>
                                  {canSeeProof ? `${Math.round(breakdown.proofTotal * 10) / 10} pt` : "? pt"}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                        {isLead && lecture.actualDurationMin != null && !assignment.proofScorePublished && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            ⏱ 실제 {lecture.actualDurationMin}분 · 확인 필요
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-500">
                            초안 · {memberName(members, assignment.draftMemberId)}
                          </p>
                          <div className="flex items-center gap-2">
                            {(adminMode || ((isLead || isSubjectHead) && assignment.draftMemberId !== currentMemberId)) && (
                              <button
                                onClick={() => setEvaluatingDraftId(assignment.id)}
                                className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-indigo-600 shadow-sm border border-indigo-100 hover:bg-indigo-50"
                              >
                                초안 평가하기
                              </button>
                            )}
                            <StatusBadge status={assignment.draftStatus} />
                          </div>
                        </div>
                        <p className="text-xs text-slate-600">기본 {breakdown.draftBase} pt</p>
                        {breakdown.draftPenalty !== 0 && (
                          <p className="text-xs font-medium text-rose-600">
                            지연 {breakdown.draftDaysLate}일 · 페널티 {breakdown.draftPenalty} pt
                          </p>
                        )}
                        {assignment.draftAdjustmentReason && (
                          <div className="mt-2 rounded border border-slate-200 bg-white p-2">
                            <p className="font-mono text-[10px] text-slate-600 whitespace-pre-wrap">{assignment.draftAdjustmentReason}</p>
                          </div>
                        )}
                        
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {assignment.draftStatus === "pending" || assignment.draftStatus === "shifted" ? (
                            <button
                              onClick={() => markDraftSubmitted(assignment.id)}
                              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white active:scale-95"
                            >
                              <CheckCircle2 size={13} /> 초안 제출 처리
                            </button>
                          ) : (
                            <button
                              onClick={() => resetDraftSubmission(assignment.id)}
                              className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:line-through"
                              title="클릭 시 제출 해제"
                            >
                              {assignment.draftSubmittedAt && new Date(assignment.draftSubmittedAt).toLocaleString("ko-KR")}
                            </button>
                          )}
                          <button
                            onClick={() => toggleRecording(assignment.id)}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${assignment.recordingUploaded
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                              }`}
                          >
                            {assignment.recordingUploaded ? <Mic size={13} /> : <MicOff size={13} />}
                            녹음 {assignment.recordingUploaded ? "업로드됨" : "미업로드"}
                          </button>
                        </div>
                        <div className="mt-2 border-t border-slate-200 pt-2">
                          <p className="mb-1 text-[11px] font-medium text-slate-400">과목부장 가감점</p>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step={0.5}
                              value={assignment.draftAdjustment}
                              onChange={(e) =>
                                setDraftAdjustment(assignment.id, Number(e.target.value), assignment.draftAdjustmentReason)
                              }
                              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            />
                            <input
                              type="text"
                              placeholder="사유"
                              value={assignment.draftAdjustmentReason}
                              onChange={(e) => setDraftAdjustment(assignment.id, assignment.draftAdjustment, e.target.value)}
                              className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            />
                          </div>
                        </div>

                        {isLead && (
                          <>
                            <div className="mt-2 border-t border-slate-200 pt-2 flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-medium text-slate-400">총점 강제 확정 (수동 입력)</p>
                                <input
                                  type="number"
                                  step={0.5}
                                  placeholder="점수"
                                  value={assignment.draftOverrideScore ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDraftOverrideScore(assignment.id, val === "" ? null : Number(val));
                                  }}
                                  className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs text-right font-semibold text-indigo-700 placeholder:font-normal"
                                />
                              </div>
                              <button
                                onClick={() => setConfirmingAssignment(assignment)}
                                className="w-full rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 text-xs font-bold text-indigo-700 active:scale-95 transition-all hover:bg-indigo-100"
                              >
                                체크리스트로 채점하기
                              </button>
                            </div>
                            <div className="mt-2 border-t border-slate-200 pt-2 flex items-center justify-between">
                              <p className="text-[11px] font-medium text-slate-400">초안자에게 채점 내역 공개</p>
                              <button
                                onClick={() => toggleDraftScorePublished(assignment.id)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                                  assignment.draftScorePublished
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                }`}
                              >
                                {assignment.draftScorePublished ? "승인됨 (공개 중)" : "승인 대기"}
                              </button>
                            </div>
                            <ExtraBonusEditor assignmentId={assignment.id} type="draft" bonuses={assignment.extraBonusesDraft} />
                          </>
                        )}
                      </div>

                      {(() => {
                        const canSeeProof = isLead || assignment.proofScorePublished;
                        if (!canSeeProof) {
                          return (
                            <div className="flex h-full min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-slate-400">
                              <p className="text-sm font-semibold text-slate-500">검안 및 채점 내역 비공개</p>
                              <p className="mt-1 text-xs">그룹장의 최종 승인 후 열람 가능합니다</p>
                            </div>
                          );
                        }
                        return (
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="mb-1.5 flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-500">
                                검안 · {memberName(members, assignment.proofMemberId)}
                              </p>
                              <div className="flex items-center gap-2">
                                {isLead && (
                                  <button
                                    onClick={() => setEvaluatingProofId(assignment.id)}
                                    className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-indigo-600 shadow-sm border border-indigo-100 hover:bg-indigo-50"
                                  >
                                    검안 평가하기
                                  </button>
                                )}
                                <StatusBadge status={assignment.proofStatus} />
                              </div>
                            </div>
                            <p className="text-xs text-slate-600">
                              기본 {breakdown.proofBase} pt{assignment.proofAtDraftLevel && " (초안 수준 적용)"}
                            </p>
                            {breakdown.proofPenalty !== 0 && (
                              <p className="text-xs font-medium text-rose-600">
                                지연 {breakdown.proofDaysLate}일 · 페널티 {breakdown.proofPenalty} pt
                              </p>
                            )}
                            {assignment.proofAdjustmentReason && (
                              <div className="mt-2 rounded border border-slate-200 bg-white p-2">
                                <p className="font-mono text-[10px] text-slate-600 whitespace-pre-wrap">{assignment.proofAdjustmentReason}</p>
                              </div>
                            )}
                            {isLead && (
                              <div className="mt-2 border-t border-slate-200 pt-2 flex items-center justify-between">
                                <p className="text-[11px] font-medium text-slate-400">검안자에게 채점 내역 공개</p>
                                <button
                                  onClick={() => toggleProofScorePublished(assignment.id)}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                                    assignment.proofScorePublished
                                      ? "bg-indigo-600 text-white"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  }`}
                                >
                                  {assignment.proofScorePublished ? "승인됨 (공개 중)" : "승인 대기"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      )}
      {evaluatingDraftId && (() => {
        const row = rows.find(r => r.assignment.id === evaluatingDraftId);
        if (!row) return null;
        return (
          <DraftEvaluationModal
            assignment={row.assignment}
            lecture={row.lecture}
            draftMemberName={memberName(members, row.assignment.draftMemberId)}
            onClose={() => setEvaluatingDraftId(null)}
            onSave={(adjustment, reason) => {
              setDraftAdjustment(row.assignment.id, adjustment, reason);
            }}
          />
        );
      })()}
      {evaluatingProofId && (() => {
        const row = rows.find(r => r.assignment.id === evaluatingProofId);
        if (!row) return null;
        return (
          <ProofEvaluationModal
            assignment={row.assignment}
            lecture={row.lecture}
            proofMemberName={memberName(members, row.assignment.proofMemberId)}
            onClose={() => setEvaluatingProofId(null)}
            onSave={(adjustment, reason) => {
              setProofAdjustment(row.assignment.id, adjustment, reason, row.assignment.proofAtDraftLevel);
            }}
          />
        );
      })()}
      {confirmingAssignment && (
        <MergeScoreConfirmModal
          assignment={confirmingAssignment}
          lecture={lectures.find(l => l.id === confirmingAssignment.lectureId)!}
          draftMemberName={members.find(m => m.id === confirmingAssignment.draftMemberId)?.name ?? "미배정"}
          proofMemberName={members.find(m => m.id === confirmingAssignment.proofMemberId)?.name ?? "미배정"}
          onClose={() => setConfirmingAssignment(null)}
          onConfirm={(draft, proof, reason) => {
            useDashboardStore.getState().setOverrideScores(confirmingAssignment.id, draft, proof);
            setConfirmingAssignment(null);
          }}
        />
      )}
    </div>
  );
}
