"use client";

import { useState } from "react";
import { Scissors, TimerReset, Ban, Pencil, Check, X, Megaphone, Copy, Trash2 } from "lucide-react";
import { Lecture, Assignment, Member } from "@/lib/types";
import { ScheduleActionType } from "@/lib/scheduleActions";
import { findGroupBySubject } from "@/lib/roles";
import { STUDY_GROUPS } from "@/lib/studyGroups";
import { useDashboardStore } from "@/lib/store";
import StatusBadge from "./StatusBadge";

function memberName(members: Member[], id: string | null): string {
  if (!id) return "미배정";
  return members.find((m) => m.id === id)?.name ?? "미배정";
}

function HandoffAnnouncer({ lecture, memberOptions }: { lecture: Lecture; memberOptions: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(memberOptions[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  if (memberOptions.length === 0) return null;

  const handleCopy = async () => {
    const name = memberOptions.find((m) => m.id === selected)?.name ?? "";
    const text = `📌 여기서부터 ${name}님 학습부 쓰겠습니다 (${lecture.period} ${lecture.subject})`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <div className="mt-2">
      {!open ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-medium text-indigo-600">
          <Megaphone size={13} /> 구간 인계 공지
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 p-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          >
            {memberOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button onClick={handleCopy} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white">
            <Copy size={12} /> {copied ? "복사됨" : "공지 복사"}
          </button>
          <button onClick={() => setOpen(false)} className="text-xs text-slate-400">닫기</button>
        </div>
      )}
    </div>
  );
}

interface Props {
  lecture: Lecture;
  assignments: Assignment[];
  members: Member[];
  onClose: () => void;
  onAction: (action: ScheduleActionType) => void;
  onUpdateLecture: (info: { subject?: string; professor?: string; startTime?: string; endTime?: string; sessionNumber?: string }) => void;
  onSetDraftMember: (assignmentId: string, memberId: string | null) => void;
  onSetProofMember: (assignmentId: string, memberId: string | null) => void;
  onSetActualDuration: (minutes: number) => void;
}

export default function LectureDetailModal({
  lecture,
  assignments,
  members,
  onClose,
  onAction,
  onUpdateLecture,
  onSetDraftMember,
  onSetProofMember,
  onSetActualDuration,
}: Props) {
  const isInactive = lecture.status === "cancelled" || lecture.status === "shifted";
  const group = findGroupBySubject(STUDY_GROUPS, lecture.subject);

  const [actualDurationInput, setActualDurationInput] = useState(
    lecture.actualDurationMin != null ? String(lecture.actualDurationMin) : ""
  );

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    subject: lecture.subject,
    professor: lecture.professor,
    startTime: lecture.startTime ?? "",
    endTime: lecture.endTime ?? "",
    sessionNumber: lecture.sessionNumber ?? "",
  });

  const handleSaveEdit = () => {
    onUpdateLecture(editForm);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="text-base font-semibold text-slate-900">강의 상세 정보</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-5">
          {editing ? (
            <div className="space-y-3 rounded-xl bg-slate-50 p-4">
              <input
                value={editForm.subject}
                onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="수업명"
              />
              <input
                value={editForm.professor}
                onChange={(e) => setEditForm((f) => ({ ...f, professor: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="교수님"
              />
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <span className="text-slate-400">~</span>
                <input
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <input
                value={editForm.sessionNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, sessionNumber: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="회차"
              />
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveEdit} className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white">저장</button>
                <button onClick={() => setEditing(false)} className="flex-1 rounded-lg bg-slate-200 py-2 text-sm font-semibold text-slate-700">취소</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-indigo-600">{lecture.period}</span>
                  <h3 className="text-lg font-bold text-slate-900">
                    {lecture.subject}
                    {lecture.sessionNumber && ` ${lecture.sessionNumber}번`}
                  </h3>
                  <button onClick={() => setEditing(true)} className="text-slate-300 hover:text-slate-500">
                    <Pencil size={15} />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {lecture.status !== "scheduled" && <StatusBadge status={lecture.status} />}
                  {group && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: group.color }}>
                      {group.name}
                    </span>
                  )}
                  {lecture.entryType === "lecture" ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${lecture.subjectType === "major" ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                      {lecture.subjectType === "major" ? "본과목" : "부과목"}
                    </span>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${lecture.entryType === "exam" ? "bg-violet-50 text-violet-600" : "bg-rose-50 text-rose-600"}`}>
                      {lecture.entryType === "exam" ? "평가" : "공휴일"}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm text-slate-600">
                  {lecture.professor && <span><span className="font-medium">교수:</span> {lecture.professor}<br /></span>}
                  <span className="font-medium">시간:</span> {lecture.durationHours}시간
                  {lecture.startTime && lecture.endTime && ` (${lecture.startTime}~${lecture.endTime})`}
                  {lecture.originalDurationHours && lecture.originalDurationHours !== lecture.durationHours && (
                    <span className="text-slate-400 text-xs"> (원래 {lecture.originalDurationHours}시간)</span>
                  )}
                </p>
                {lecture.note && <p className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">⚠ {lecture.note}</p>}
              </div>

              {lecture.assignable && (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">학습부 배정</h4>
                  {assignments.length === 0 && <p className="text-xs text-slate-400">배정된 조가 없습니다.</p>}
                  <div className="space-y-3">
                    {assignments.map((a) => (
                      <div key={a.id} className="rounded-xl bg-slate-50 p-3">
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-medium text-slate-500">
                            초안 담당
                            <select
                              value={a.draftMemberId ?? ""}
                              onChange={(e) => onSetDraftMember(a.id, e.target.value || null)}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
                            >
                              <option value="">미배정</option>
                              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </label>
                          <label className="text-xs font-medium text-slate-500">
                            검안 담당
                            <select
                              value={a.proofMemberId ?? ""}
                              onChange={(e) => onSetProofMember(a.id, e.target.value || null)}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
                            >
                              <option value="">미배정</option>
                              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </label>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge status={a.draftStatus} />
                          <StatusBadge status={a.proofStatus} />
                          {a.shiftedFromLectureId && <span className="text-xs text-amber-600">(롤오버됨)</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <HandoffAnnouncer
                      lecture={lecture}
                      memberOptions={Array.from(
                        new Map(
                          assignments.flatMap((a) => [a.draftMemberId, a.proofMemberId])
                            .filter((id): id is string => !!id)
                            .map((id) => [id, memberName(members, id)])
                        ).entries()
                      ).map(([id, name]) => ({ id, name }))}
                    />
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <label className="text-xs font-medium text-slate-500">
                      실제 진행 시간 (분) — 예정 {lecture.durationHours * 60}분
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={actualDurationInput}
                        onChange={(e) => setActualDurationInput(e.target.value)}
                        placeholder="예: 45"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
                      />
                      <button
                        onClick={() => {
                          const minutes = Number(actualDurationInput);
                          if (Number.isFinite(minutes) && minutes >= 0) onSetActualDuration(minutes);
                        }}
                        disabled={!actualDurationInput}
                        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        저장
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      예정 시간의 절반 미만이면 2팀 배정된 짝 강의는 자동으로 다음 배정으로 이월돼요. 정산 탭에서 점수 등급을 확인해주세요.
                    </p>
                  </div>
                </div>
              )}

              {(!isInactive && lecture.assignable) && (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">시간표 조작</h4>
                  <div className="grid grid-cols-5 gap-2">
                    <button onClick={() => { onAction("reduce"); onClose(); }} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-700 active:scale-95 transition-transform">
                      <Scissors size={16} /> 시간단축
                    </button>
                    <button onClick={() => { onAction("merge_next"); onClose(); }} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs font-semibold text-emerald-700 active:scale-95 transition-transform">
                      <Scissors size={16} /> 다음병합
                    </button>
                    <button onClick={() => { onAction("extend"); onClose(); }} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 p-2 text-xs font-semibold text-indigo-700 active:scale-95 transition-transform">
                      <TimerReset size={16} /> 연장
                    </button>
                    <button onClick={() => { onAction("unassign"); onClose(); }} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-600 active:scale-95 transition-transform">
                      <Ban size={16} /> 미배정
                    </button>
                    <button onClick={() => { useDashboardStore.getState().deleteLecture(lecture.id); onClose(); }} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs font-semibold text-rose-600 active:scale-95 transition-transform">
                      <Trash2 size={16} /> 삭제
                    </button>
                  </div>
                </div>
              )}

              {(lecture.status === "cancelled" || lecture.status === "unassigned" || lecture.status === "shifted" || lecture.status === "shortened" || lecture.status === "extended") && (
                <div className="pt-4 border-t border-slate-100">
                  <button onClick={() => { onAction("restore"); onClose(); }} className="w-full flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-700 active:scale-95 transition-transform">
                    <TimerReset size={18} /> 처리 취소 (일정 복구)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
