"use client";

import { useMemo, useState } from "react";
import { Calculator, Download } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { downloadStudyExcel, downloadRestorationExcel, SettlementRow } from "@/lib/csv";
import { getExamDateForSubject, scoreRestoration, restorationPenalty, scoreAssignment } from "@/lib/scoring";
import { STUDY_GROUPS } from "@/lib/studyGroups";
import { getMemberGroupId } from "@/lib/mockData";

function defaultStartDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function defaultEndDate(): string {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export default function SettlementView() {
  const lectures = useDashboardStore((s) => s.lectures);
  const members = useDashboardStore((s) => s.members);
  const assignments = useDashboardStore((s) => s.assignments);
  const restorationItems = useDashboardStore((s) => s.restorationItems);
  const memberExtraScores = useDashboardStore((s) => s.memberExtraScores);
  const addActivityLog = useDashboardStore((s) => s.addActivityLog);
  const adminMode = useDashboardStore((s) => s.adminMode);
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  
  const currentMember = useMemo(() => members.find(m => m.id === currentMemberId), [members, currentMemberId]);
  const viewingGroupId = useDashboardStore((s) => s.viewingGroupId);
  const viewingGroup = STUDY_GROUPS.find((g) => g.id === viewingGroupId);

  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [viewType, setViewType] = useState<"all" | "study" | "restoration">("all");

  const { allRows, displayRows } = useMemo(() => {
    // Filter lectures by date range
    const targetSubjects = viewingGroup ? new Set(viewingGroup.subjects) : null;

    const inRange = new Set(
      lectures
        .filter((l) => {
          if (l.date < startDate || l.date > endDate) return false;
          if (targetSubjects && !targetSubjects.has(l.subject)) return false;
          return true;
        })
        .map((l) => l.id)
    );

    const participatingMembers = new Set<string>();

    assignments
      .filter((a) => inRange.has(a.lectureId))
      .forEach((a) => {
        if (a.draftMemberId) participatingMembers.add(a.draftMemberId);
        if (a.proofMemberId) participatingMembers.add(a.proofMemberId);
      });

    const acc = new Map<string, SettlementRow>();
    
    // Initialize with all members
    members.forEach((m) => {
      acc.set(m.id, {
        studentId: m.studentId ?? "",
        memberName: m.name,
        draftAdjustment: 0,
        proofAdjustment: 0,
        collectionBonus: 0,
        restorationMissingPenalty: 0,
        explanationAdjustment: 0,
        total: 0,
      });
    });
    const ensure = (memberId: string): SettlementRow => {
      if (!acc.has(memberId)) {
        acc.set(memberId, {
          studentId: members.find((m) => m.id === memberId)?.studentId ?? "",
          memberName: members.find((m) => m.id === memberId)?.name ?? "(삭제된 멤버)",
          draftAdjustment: 0,
          proofAdjustment: 0,
          collectionBonus: 0,
          restorationMissingPenalty: 0,
          explanationAdjustment: 0,
          total: 0,
        });
      }
      return acc.get(memberId)!;
    };

    assignments
      .filter((a) => inRange.has(a.lectureId))
      .forEach((a) => {
        const lecture = lectures.find((l) => l.id === a.lectureId);
        if (!lecture) return;
        const breakdown = scoreAssignment(lecture, a);

        if (a.draftMemberId) {
          participatingMembers.add(a.draftMemberId);
          if (breakdown.draftTotal) ensure(a.draftMemberId).draftAdjustment += breakdown.draftTotal;
        }
        if (a.proofMemberId) {
          participatingMembers.add(a.proofMemberId);
          if (breakdown.proofTotal) ensure(a.proofMemberId).proofAdjustment += breakdown.proofTotal;
        }
      });

    restorationItems
      .forEach((r) => {
        if (targetSubjects && !targetSubjects.has(r.subject)) return;
        
        // 시험 날짜 기준으로 정산 기간 포함 여부 확인
        const examDate = getExamDateForSubject(r.subject, lectures);
        if (examDate < startDate || examDate > endDate) return;

        const breakdown = scoreRestoration(r);
        if (r.collectorMemberId) {
          participatingMembers.add(r.collectorMemberId);
          const row = ensure(r.collectorMemberId);
          row.collectionBonus += breakdown.collectionBonus;
          row.restorationMissingPenalty += restorationPenalty(r.missingCount);
        }
        if (r.explainerMemberIds && r.explainerMemberIds.length > 0) {
          r.explainerMemberIds.forEach(id => {
            participatingMembers.add(id);
            const row = ensure(id);
            row.explanationAdjustment += breakdown.explanationBonus + breakdown.rewritePenalty;
          });
        }
      });

    memberExtraScores
      .filter((s) => s.date >= startDate && s.date <= endDate)
      .forEach((s) => {
        const row = ensure(s.memberId);
        row.collectionBonus += s.amount;
      });

    const allRows = Array.from(acc.entries())
      .map(([memberId, r]) => {
        let typeTotal = 0;
        if (viewType === "all") {
          typeTotal = r.draftAdjustment + r.proofAdjustment + r.collectionBonus + r.restorationMissingPenalty + r.explanationAdjustment;
        } else if (viewType === "study") {
          typeTotal = r.draftAdjustment + r.proofAdjustment;
        } else if (viewType === "restoration") {
          typeTotal = r.collectionBonus + r.restorationMissingPenalty + r.explanationAdjustment;
        }

        return {
          memberId,
          ...r,
          total: Math.round(typeTotal * 10) / 10,
        };
      })
      .sort((a, b) => a.studentId.localeCompare(b.studentId));

    const displayRows = allRows.filter((r) => {
      const member = members.find((m) => m.id === r.memberId);
      const actualGroupId = member ? (member.groupId || getMemberGroupId(member.name)) : null;
      if (!viewingGroupId) return true;
      if (actualGroupId === viewingGroupId) return true;
      if (participatingMembers.has(r.memberId)) return true;
      if (r.total !== 0) return true;
      return false;
    });

    return { allRows, displayRows };
  }, [lectures, members, assignments, restorationItems, memberExtraScores, startDate, endDate, viewingGroupId, viewType]);

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "";
    const [_, m, d] = dateStr.split("-");
    return `${Number(m)}월 ${d}일`;
  };

  const getFilenameDate = () => `${formatDateString(startDate)}~${formatDateString(endDate)}`;

  const handleExportStudy = () => {
    const groupName = viewingGroup ? viewingGroup.name : "전체";
    const filename = `${groupName}_학습부_${getFilenameDate()}.xlsx`;
    // 엑셀 내보내기는 그룹 필터링과 무관하게 전체 명단(allRows)을 사용
    downloadStudyExcel(filename, allRows);
    addActivityLog({
      type: "sync",
      direction: "push",
      source: filename,
      summary: `학습부 전체 명단 정산 내역 ${allRows.length}건을 내보냈습니다.`,
      status: "success",
    });
  };

  const handleExportRestoration = () => {
    const groupName = viewingGroup ? viewingGroup.name : "전체";
    const filename = `${groupName}_복원해설_${getFilenameDate()}.xlsx`;
    // 엑셀 내보내기는 그룹 필터링과 무관하게 전체 명단(allRows)을 사용
    downloadRestorationExcel(filename, allRows);
    addActivityLog({
      type: "sync",
      direction: "push",
      source: filename,
      summary: `복원해설 전체 명단 정산 내역 ${allRows.length}건을 내보냈습니다.`,
      status: "success",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator size={22} className="text-indigo-600" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            기간별 정산{viewingGroup && ` · ${viewingGroup.name}`}
          </h1>
          <p className="text-sm text-slate-500">
            초안(과목부장)·검안(그룹장)·복원 가감점을 선택한 기간별로 집계해 엑셀 파일로 내보냅니다.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm"
        />
        <span className="text-slate-400">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm"
        />
        <button
          onClick={handleExportStudy}
          disabled={allRows.length === 0}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-40"
        >
          <Download size={16} /> 학습부 엑셀
        </button>
        <button
          onClick={handleExportRestoration}
          disabled={allRows.length === 0}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-40"
        >
          <Download size={16} /> 복원해설 엑셀
        </button>
      </div>

      {/* 뷰 타입 선택 탭 */}
      <div className="flex w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:w-auto">
        <button
          onClick={() => setViewType("all")}
          className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${
            viewType === "all" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          통합 보기
        </button>
        <div className="w-px bg-slate-200" />
        <button
          onClick={() => setViewType("study")}
          className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${
            viewType === "study" ? "bg-slate-100 text-indigo-700" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          학습부 가감점
        </button>
        <div className="w-px bg-slate-200" />
        <button
          onClick={() => setViewType("restoration")}
          className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${
            viewType === "restoration" ? "bg-slate-100 text-blue-700" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          복원 가감점
        </button>
      </div>

      {displayRows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
          선택한 기간에 집계할 가감점이 없습니다.
        </p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {displayRows.map((r) => (
              <div key={r.memberName} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{r.memberName}</p>
                  <p className={`text-lg font-bold ${r.total < 0 ? "text-rose-600" : "text-indigo-700"}`}>
                    {r.total} pt
                  </p>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
                  {(viewType === "all" || viewType === "study") && (
                    <>
                      <dt>초안 가감점</dt>
                      <dd className="text-right text-slate-700">{r.draftAdjustment}</dd>
                      <dt>검안 가감점</dt>
                      <dd className="text-right text-slate-700">{r.proofAdjustment}</dd>
                    </>
                  )}
                  {(viewType === "all" || viewType === "restoration") && (
                    <>
                      <dt>복원 수합 가점</dt>
                      <dd className="text-right text-slate-700">{r.collectionBonus}</dd>
                      <dt>복원 미흡 감점</dt>
                      <dd className="text-right text-slate-700">{r.restorationMissingPenalty}</dd>
                      <dt>복원 해설 가감점</dt>
                      <dd className="text-right text-slate-700">{r.explanationAdjustment}</dd>
                    </>
                  )}
                </dl>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">이름</th>
                  {(viewType === "all" || viewType === "study") && (
                    <>
                      <th className="px-3 py-2.5 text-right font-medium">초안 가감점</th>
                      <th className="px-3 py-2.5 text-right font-medium">검안 가감점</th>
                    </>
                  )}
                  {(viewType === "all" || viewType === "restoration") && (
                    <>
                      <th className="px-3 py-2.5 text-right font-medium">복원 수합 가점</th>
                      <th className="px-3 py-2.5 text-right font-medium">복원 미흡 감점</th>
                      <th className="px-3 py-2.5 text-right font-medium">복원 해설 가감점</th>
                    </>
                  )}
                  <th className="px-4 py-2.5 text-right font-medium">합계</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, idx) => (
                  <tr key={r.memberName} className={idx !== displayRows.length - 1 ? "border-b border-slate-100" : ""}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.memberName}</td>
                    {(viewType === "all" || viewType === "study") && (
                      <>
                        <td className="px-3 py-2.5 text-right text-slate-600">{r.draftAdjustment}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{r.proofAdjustment}</td>
                      </>
                    )}
                    {(viewType === "all" || viewType === "restoration") && (
                      <>
                        <td className="px-3 py-2.5 text-right text-slate-600">{r.collectionBonus}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{r.restorationMissingPenalty}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{r.explanationAdjustment}</td>
                      </>
                    )}
                    <td
                      className={`px-4 py-2.5 text-right font-bold ${r.total < 0 ? "text-rose-600" : "text-indigo-700"}`}
                    >
                      {r.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
