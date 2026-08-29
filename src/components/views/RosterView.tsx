"use client";

import { useMemo, useState } from "react";
import { Users, UserPlus, ShieldCheck, RotateCcw } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { Member, MemberRole } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/roles";
import { COURSE_NAMES } from "@/lib/courses";
import { STUDY_GROUPS } from "@/lib/studyGroups";
import { GROUP_DRAFT_SEQUENCES } from "@/lib/sequences";
import { resetMemberPin, claimMember } from "@/lib/auth";

const ROLE_OPTIONS: MemberRole[] = ["student", "lead", "subjectHead", "admin"];

export default function RosterView() {
  const members = useDashboardStore((s) => s.members);
  const assignments = useDashboardStore((s) => s.assignments);
  const setMemberRole = useDashboardStore((s) => s.setMemberRole);
  const adminMode = useDashboardStore((s) => s.adminMode);
  
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const currentMember = members.find((m) => m.id === currentMemberId);
  const adminEditMode = adminMode && currentMember?.name === "성민수";
  const canResetPin = adminMode && (currentMember?.name === "성민수" || currentMember?.name === "한상희");

  // 상단 GroupSwitcher와 같은 값을 공유한다 — 여기서 그룹을 고르면 대시보드 전체가 그 그룹 시야로 바뀐다.
  const groupFilter = useDashboardStore((s) => s.viewingGroupId);
  const setGroupFilter = useDashboardStore((s) => s.setViewingGroupId);

  const [filter, setFilter] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"all" | "subjectHead" | "student">("all");
  const [isResettingAll, setIsResettingAll] = useState(false);

  const groupById = useMemo(() => new Map(STUDY_GROUPS.map((g) => [g.id, g])), []);

  const isDraftMember = (member: Member, groupId: string) => {
    const draftSeq = GROUP_DRAFT_SEQUENCES[groupId] || [];
    return draftSeq.some((name) => name.replace(/\(\d+\)/g, "").trim() === member.name);
  };

  const isAnyDraftWriter = (member: Member) => {
    return STUDY_GROUPS.some(g => isDraftMember(member, g.id));
  };

  const visible = members.filter((m) => {
    const matchesText = m.name.includes(filter) || (m.studentId?.includes(filter) ?? false);
    if (!matchesText) return false;
    if (unassignedOnly) return !m.groupId;
    
    if (roleFilter === "subjectHead" && m.role !== "subjectHead") return false;
    if (roleFilter === "student" && !isAnyDraftWriter(m) && m.role !== "student") return false;

    if (groupFilter === null) return true;
    return m.groupId === groupFilter || isDraftMember(m, groupFilter);
  });

  const sortedVisible = [...visible].sort((a, b) => {
    if (groupFilter !== null) {
      const isALeaderOfThisGroup = a.role === "lead" && a.groupId === groupFilter;
      const isBLeaderOfThisGroup = b.role === "lead" && b.groupId === groupFilter;
      if (isALeaderOfThisGroup && !isBLeaderOfThisGroup) return -1;
      if (!isALeaderOfThisGroup && isBLeaderOfThisGroup) return 1;
    }

    const roleWeight = (role: string) => {
      if (role === "lead") return 1;
      if (role === "subjectHead") return 2;
      return 3;
    };
    return roleWeight(a.role) - roleWeight(b.role);
  });

  const assignmentCount = (memberId: string) =>
    assignments.filter((a) => a.draftMemberId === memberId || a.proofMemberId === memberId).length;

  const handleResetPin = async (memberId: string, memberName: string) => {
    if (!window.confirm(`${memberName} 님의 PIN을 0000으로 강제 초기화하시겠습니까?\n초기화 후 해당 조원은 0000으로 로그인할 수 있습니다.`)) return;
    
    const ok = await resetMemberPin(memberId);
    if (ok) {
      await claimMember(memberId, "0000");
      alert(`${memberName} 님의 PIN이 0000으로 초기화되었습니다.`);
    } else {
      alert("PIN 초기화에 실패했습니다. 관리자 권한이나 네트워크 상태를 확인해주세요.");
    }
  };

  const handleResetAllPins = async () => {
    if (!window.confirm("정말로 '모든 사용자'의 PIN을 0000으로 초기화하시겠습니까?\n이 작업은 되돌릴 수 없으며 시간이 다소 소요될 수 있습니다.")) return;
    if (!window.confirm("마지막 경고입니다.\n명단에 있는 모든 사용자의 비밀번호가 0000으로 바뀝니다.\n계속하시겠습니까?")) return;
    
    setIsResettingAll(true);
    let successCount = 0;
    for (const member of members) {
      const ok = await resetMemberPin(member.id);
      if (ok) {
        await claimMember(member.id, "0000");
        successCount++;
      }
    }
    setIsResettingAll(false);
    alert(`초기화 완료: 총 ${members.length}명 중 ${successCount}명의 비밀번호가 0000으로 변경되었습니다.`);
  };

  // 과목명이 정확히 일치해야 과목부장 조회(findSubjectHead)가 동작하므로
  // 자유 입력 대신 실제 과목 목록에서 고르게 한다.
  const toggleSubject = (member: Member, subject: string) => {
    const current = member.subjects ?? [];
    const next = current.includes(subject)
      ? current.filter((s) => s !== subject)
      : [...current, subject];
    setMemberRole(member.id, member.role, next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users size={22} className="text-indigo-600" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">학습부 멤버 명단</h1>
            <p className="text-sm text-slate-500">{members.length}명 · 5개 그룹으로 편성되어 있습니다.</p>
          </div>
        </div>
        {canResetPin && (
          <button
            onClick={handleResetAllPins}
            disabled={isResettingAll}
            className="flex w-fit items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition"
          >
            <RotateCcw size={14} className={isResettingAll ? "animate-spin" : ""} /> 
            {isResettingAll ? "전체 초기화 진행중..." : "모든 조원 PIN 0000으로 강제 초기화"}
          </button>
        )}
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="이름 또는 학번으로 검색"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm"
      />

      <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible no-scrollbar">
        <button
          onClick={() => {
            setGroupFilter(null);
            setUnassignedOnly(false);
          }}
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
            groupFilter === null && !unassignedOnly ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          전체 {members.length}
        </button>
        {STUDY_GROUPS.map((g) => {
          const count = members.filter((m) => m.groupId === g.id || isDraftMember(m, g.id)).length;
          const active = groupFilter === g.id && !unassignedOnly;
          return (
            <button
              key={g.id}
              onClick={() => {
                setGroupFilter(g.id);
                setUnassignedOnly(false);
              }}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                active ? "text-white" : "bg-slate-100 text-slate-600"
              }`}
              style={active ? { backgroundColor: g.color } : undefined}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: active ? "#fff" : g.color }} />
              {g.name} {count}
            </button>
          );
        })}
        <button
          onClick={() => setUnassignedOnly((v) => !v)}
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
            unassignedOnly ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          미배정 {members.filter((m) => !m.groupId).length}
        </button>
        <div className="w-px bg-slate-200 mx-1 shrink-0"></div>
        <button
          onClick={() => setRoleFilter(roleFilter === "subjectHead" ? "all" : "subjectHead")}
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
            roleFilter === "subjectHead" ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300" : "bg-slate-50 text-slate-500 border border-slate-200"
          }`}
        >
          과목부장만 보기
        </button>
        <button
          onClick={() => setRoleFilter(roleFilter === "student" ? "all" : "student")}
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
            roleFilter === "student" ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300" : "bg-slate-50 text-slate-500 border border-slate-200"
          }`}
        >
          초안자만 보기
        </button>
      </div>

      {groupFilter && !unassignedOnly && (
        <div className="space-y-1.5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            담당 과목: <span className="font-medium text-slate-700">{groupById.get(groupFilter)?.subjects.join(", ")}</span>
          </p>
          <p className="text-xs text-slate-500 break-words leading-relaxed">
            초안자 배정 순서: <span className="font-medium text-indigo-600">{GROUP_DRAFT_SEQUENCES[groupFilter]?.join(" → ") || "설정된 순서가 없습니다"}</span>
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {sortedVisible.map((m, idx) => {
          const group = m.groupId ? groupById.get(m.groupId) : undefined;
          return (
            <div
              key={m.id}
              className={`px-4 py-3 ${idx !== sortedVisible.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
                    {m.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      {m.name}
                      <div className="flex gap-1 ml-1 flex-wrap">
                        {m.role === "lead" && (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 border border-rose-200">
                            <ShieldCheck size={10} /> 그룹장 {m.groupId ? `(${groupById.get(m.groupId)?.subjects.join(", ")})` : ""}
                          </span>
                        )}
                        {m.role === "subjectHead" && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                            과목부장 {m.subjects && m.subjects.length > 0 ? `(${m.subjects.join(", ")})` : ""}
                          </span>
                        )}
                        {(isAnyDraftWriter(m) || m.role === "student") && (() => {
                          const draftSubjects = STUDY_GROUPS.filter(g => isDraftMember(m, g.id)).flatMap(g => g.subjects);
                          const text = draftSubjects.length > 0 ? `(${draftSubjects.join(", ")})` : "";
                          return (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                              초안자 {text}
                            </span>
                          );
                        })()}
                      </div>
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                      {m.cohort}
                      {m.studentId && ` · ${m.studentId}`}
                      {(() => {
                        const memberGroupIds = new Set<string>();
                        if (m.groupId) memberGroupIds.add(m.groupId);
                        STUDY_GROUPS.forEach(g => {
                          if (isDraftMember(m, g.id)) memberGroupIds.add(g.id);
                        });
                        
                        return Array.from(memberGroupIds).map(gId => {
                          const g = groupById.get(gId);
                          if (!g) return null;
                          return (
                            <span
                              key={g.id}
                              className="ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-white"
                              style={{ backgroundColor: g.color }}
                            >
                              {g.name}
                            </span>
                          );
                        });
                      })()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700">{assignmentCount(m.id)}건</p>
                  <p className="text-xs text-slate-400">{m.active ? "활동중" : "비활동"}</p>
                </div>
              </div>
              <div className="mt-2 pl-12">
                <div className="flex items-center justify-between gap-2">
                  {adminEditMode ? (
                    <select
                      value={m.role}
                      onChange={(e) => setMemberRole(m.id, e.target.value as MemberRole, m.subjects)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-medium text-slate-600">{ROLE_LABELS[m.role]}</span>
                  )}
                  
                  {canResetPin && (
                    <button
                      onClick={() => handleResetPin(m.id, m.name)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
                      title="비밀번호(PIN) 강제 초기화"
                    >
                      <RotateCcw size={12} />
                      PIN 초기화
                    </button>
                  )}
                </div>
                {m.role === "subjectHead" && (
                  <div className="mt-1.5">
                    <p className="mb-1 text-[11px] text-slate-400">담당 과목</p>
                    <div className="flex flex-wrap gap-1">
                      {COURSE_NAMES.map((subject) => {
                        const on = m.subjects?.includes(subject) ?? false;
                        return (
                          <button
                            key={subject}
                            onClick={() => adminEditMode && toggleSubject(m, subject)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                              on ? "bg-indigo-100 text-indigo-700" : (adminEditMode ? "bg-slate-100 text-slate-400 hover:bg-slate-200" : "bg-slate-100 text-slate-400")
                            } ${!adminEditMode && "cursor-default"}`}
                          >
                            {subject}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            const state = useDashboardStore.getState();
            const memberGroupByName = new Map<string, string>();
            Object.entries(GROUP_DRAFT_SEQUENCES).forEach(([groupId, names]) => {
              names.forEach((name) => {
                const cleanName = name.replace(/\(\d+\)/g, '').trim();
                if (!memberGroupByName.has(cleanName)) {
                  memberGroupByName.set(cleanName, groupId);
                }
              });
            });

            state.members.forEach((m) => {
              if (!m.groupId) {
                const seqGroup = memberGroupByName.get(m.name);
                if (seqGroup) {
                  state.setMemberRole(m.id, m.role, m.subjects); // using setMemberRole to trigger sync, but wait, setMemberRole takes role and subjects.
                }
              }
            });
            // better: just update members directly in state
            useDashboardStore.setState((s) => ({
              members: s.members.map((m) => {
                if (!m.groupId) {
                  const seqGroup = memberGroupByName.get(m.name);
                  if (seqGroup) return { ...m, groupId: seqGroup };
                }
                return m;
              })
            }));
            // force sync
            alert("미배정 인원의 그룹 자동 매핑이 완료되었습니다. (원격 동기화는 수동 변경 시 적용됩니다)");
          }}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-indigo-300 bg-white py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
        >
          <UserPlus size={16} /> 미배정 인원 그룹 자동 매핑
        </button>
        <a
          href="/sync"
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <UserPlus size={16} /> 외부 명단 동기화
        </a>
      </div>
    </div>
  );
}
