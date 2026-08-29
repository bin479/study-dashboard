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
  const toggleScorePublished = useDashboardStore((s) => s.toggleScorePublished);
  const viewingGroupId = useDashboardStore((s) => s.viewingGroupId);
  const viewingGroup = STUDY_GROUPS.find((g) => g.id === viewingGroupId);
  const adminMode = useDashboardStore((s) => s.adminMode);
  
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const currentMember = useMemo(() => members.find(m => m.id === currentMemberId), [members, currentMemberId]);
  const isSubjectHead = currentMember?.role === "subjectHead";
  const isLead = currentMember?.role === "lead";

  const searchParams = useSearchParams();

  const [tab, setTab] = useState<"leaderboard" | "detail">(() => {
    // 그룹장이나 과목부장(관리자 모드 off)일 경우 기본 탭을 상세 내역으로
    const currentMember = members.find(m => m.id === currentMemberId);
    if (currentMember && (currentMember.role === "lead" || currentMember.role === "subjectHead") && !useDashboardStore.getState().adminMode) {
      return "detail";
    }
    return "leaderboard";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [evaluatingDraftId, setEvaluatingDraftId] = useState<string | null>(null);
  const [evaluatingProofId, setEvaluatingProofId] = useState<string | null>(null);

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
          if (!currentMember?.subjects?.includes(lecture.subject)) return null;
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
      const todayLec = lectures.find((l) => l.date === todayDateStr && availableSubjects.includes(l.subject));
      
      if (todayLec) {
        setSelectedSubject(todayLec.subject);
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
          {(isSubjectHead || isLead) && !adminMode && availableSubjects.length > 1 && (
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
                      <div className="flex gap-4 text-right">
                        <div>
                          <p className="text-[10px] font-medium text-slate-400 text-right">초안</p>
                          <p className={`text-lg font-bold ${breakdown.draftTotal < 0 ? "text-rose-600" : "text-indigo-700"}`}>
                            {Math.round(breakdown.draftTotal * 10) / 10} pt
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium text-slate-400 text-right">검안</p>
                          <p className={`text-lg font-bold ${breakdown.proofTotal < 0 ? "text-rose-600" : "text-indigo-700"}`}>
                            {Math.round(breakdown.proofTotal * 10) / 10} pt
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-500">
                            초안 · {memberName(members, assignment.draftMemberId)}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEvaluatingDraftId(assignment.id)}
                              className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-indigo-600 shadow-sm border border-indigo-100 hover:bg-indigo-50"
                            >
                              초안 평가하기
                            </button>
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
                        <div className="mt-2 border-t border-slate-200 pt-2 flex items-center justify-between">
                          <p className="text-[11px] font-medium text-slate-400">총점 강제 확정 (Override)</p>
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
                        <div className="mt-2 border-t border-slate-200 pt-2 flex items-center justify-between">
                          <p className="text-[11px] font-medium text-slate-400">채점 내역 공개 (그룹장 승인)</p>
                          <button
                            onClick={() => toggleScorePublished(assignment.id)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                              assignment.scorePublished
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {assignment.scorePublished ? "승인됨 (공개 중)" : "승인 대기"}
                          </button>
                        </div>
                        <ExtraBonusEditor assignmentId={assignment.id} type="draft" bonuses={assignment.extraBonusesDraft} />
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-500">
                            검안 · {memberName(members, assignment.proofMemberId)}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEvaluatingProofId(assignment.id)}
                              className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-indigo-600 shadow-sm border border-indigo-100 hover:bg-indigo-50"
                            >
                              검안 평가하기
                            </button>
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
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {assignment.draftStatus === "submitted" &&
                            (assignment.proofStatus === "pending" || assignment.proofStatus === "shifted") ? (
                            <button
                              onClick={() => markProofSubmitted(assignment.id)}
                              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white active:scale-95"
                            >
                              <CheckCircle2 size={13} /> 검안 제출 처리
                            </button>
                          ) : assignment.proofSubmittedAt ? (
                            <button
                              onClick={() => resetProofSubmission(assignment.id)}
                              className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:line-through"
                              title="클릭 시 제출 해제"
                            >
                              {new Date(assignment.proofSubmittedAt).toLocaleString("ko-KR")}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">초안 제출 후 가능</span>
                          )}
                          <label className="flex items-center gap-1 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={assignment.proofAtDraftLevel}
                              onChange={() => toggleProofAtDraftLevel(assignment.id)}
                            />
                            초안 쓴 수준
                          </label>
                        </div>
                        <div className="mt-2 border-t border-slate-200 pt-2">
                          <p className="mb-1 text-[11px] font-medium text-slate-400">그룹장 가감점</p>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step={0.5}
                              value={assignment.proofAdjustment}
                              onChange={(e) =>
                                setProofAdjustment(assignment.id, Number(e.target.value), assignment.proofAdjustmentReason)
                              }
                              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            />
                            <input
                              type="text"
                              placeholder="사유"
                              value={assignment.proofAdjustmentReason}
                              onChange={(e) => setProofAdjustment(assignment.id, assignment.proofAdjustment, e.target.value)}
                              className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            />
                          </div>
                        </div>

                        <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-200 pt-2">
                          <label className="text-[11px] font-medium text-slate-400">검안 보너스 퀵 추가 (최대 +1.5점)</label>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => {
                                const existing = assignment.extraBonusesProof?.find(b => b.reason === "서식/가독성 개선");
                                if (existing) removeExtraBonus(assignment.id, "proof", existing.id);
                                else addExtraBonus(assignment.id, "proof", 0.5, "서식/가독성 개선");
                              }}
                              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                                assignment.extraBonusesProof?.some(b => b.reason === "서식/가독성 개선")
                                  ? "bg-indigo-600 text-white"
                                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                              }`}
                            >
                              서식/가독성 개선 +0.5
                            </button>
                            <button
                              onClick={() => {
                                const existing = assignment.extraBonusesProof?.find(b => b.reason === "구조화/시각화");
                                if (existing) removeExtraBonus(assignment.id, "proof", existing.id);
                                else addExtraBonus(assignment.id, "proof", 1.0, "구조화/시각화");
                              }}
                              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                                assignment.extraBonusesProof?.some(b => b.reason === "구조화/시각화")
                                  ? "bg-indigo-600 text-white"
                                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                              }`}
                            >
                              구조화/시각화 +1.0
                            </button>
                            <button
                              onClick={() => {
                                const existing = assignment.extraBonusesProof?.find(b => b.reason === "내용 보완");
                                if (existing) removeExtraBonus(assignment.id, "proof", existing.id);
                                else addExtraBonus(assignment.id, "proof", 1.0, "내용 보완");
                              }}
                              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                                assignment.extraBonusesProof?.some(b => b.reason === "내용 보완")
                                  ? "bg-indigo-600 text-white"
                                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                              }`}
                            >
                              내용 보완 +1.0
                            </button>
                          </div>
                          
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[10px] font-medium text-slate-400 hover:text-slate-600 outline-none">
                              평가 기준 자세히 보기
                            </summary>
                            <div className="mt-2 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-600 leading-relaxed shadow-sm">
                              <div>
                                <p className="font-bold text-slate-800">1. 서식 / 가독성 개선 (+0.5점)</p>
                                <p className="mb-1 text-slate-500">핵심 기준: 시각적 정렬, 폰트/스타일 통일, 불필요한 군더더기 제거로 가독성 향상</p>
                                <ul className="list-inside list-disc space-y-0.5">
                                  <li className="text-emerald-700"><span className="font-medium">인정 (O):</span> 개조식(불릿/번호) 깔끔 변환, 말투(구어체) 전면 교정, 레이아웃/줄간격 일관된 정돈, 키워드 볼드체/형광펜 일관 적용</li>
                                  <li className="text-rose-700"><span className="font-medium">불인정 (X):</span> 단순 줄바꿈/폰트 크기만 변경, 일부 문서에만 적용되고 일관성 없는 경우</li>
                                </ul>
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">2. 구조화 / 시각화 (+1.0점)</p>
                                <p className="mb-1 text-slate-500">핵심 기준: 질환·약물·기전을 표, 알고리즘, 다이어그램으로 재구성하여 학습 효율 획기적 향상</p>
                                <ul className="list-inside list-disc space-y-0.5">
                                  <li className="text-emerald-700"><span className="font-medium">인정 (O):</span> 감별진단/약물 비교 표 정리, 순서도/다이어그램 직접 제작, 슬라이드 이미지에 레이블/판독 포인트 매핑</li>
                                  <li className="text-rose-700"><span className="font-medium">불인정 (X):</span> 기존 슬라이드 표/그림 단순 캡처, 텍스트 2~3줄짜리 아주 단순한 박스 처리</li>
                                </ul>
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">3. 내용 보완 (+1.0점)</p>
                                <p className="mb-1 text-slate-500">핵심 기준: 교수님 설명, 오개념, 누락된 기출 등을 실질적으로 채워 넣은 경우</p>
                                <ul className="list-inside list-disc space-y-0.5">
                                  <li className="text-emerald-700"><span className="font-medium">인정 (O):</span> 누락된 교수님 설명/임상 팁 추가, 오개념 바로잡기, 최신 가이드라인 변경점/기출 연계 해설 추가</li>
                                  <li className="text-rose-700"><span className="font-medium">불인정 (X):</span> 단순 오탈자 교정 몇 개, 수업에서 다루지 않은 과도한 외부 전공의 수준 지식 불필요하게 덧붙임</li>
                                </ul>
                              </div>
                            </div>
                          </details>
                        </div>

                        <ExtraBonusEditor assignmentId={assignment.id} type="proof" bonuses={assignment.extraBonusesProof} />
                      </div>
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
              setProofAdjustment(row.assignment.id, adjustment, reason);
            }}
          />
        );
      })()}
    </div>
  );
}
