"use client";

import { useState } from "react";
import { X, ArrowRight, Scissors, TimerReset, Ban, Users, Copy, Check } from "lucide-react";
import { Assignment, Lecture, Member } from "@/lib/types";
import { ScheduleActionType } from "@/lib/scheduleActions";
import StatusBadge from "./StatusBadge";



function memberName(members: Member[], id: string | null): string {
  if (!id) return "미배정";
  return members.find((m) => m.id === id)?.name ?? "미배정";
}

function LectureCard({
  lecture,
  assignments,
  members,
  tone,
}: {
  lecture: Lecture;
  assignments: Assignment[];
  members: Member[];
  tone: "before" | "after";
}) {
  const rows = assignments.filter((a) => a.lectureId === lecture.id);
  return (
    <div
      className={`flex-1 rounded-xl border p-3 ${
        tone === "before" ? "border-slate-200 bg-slate-50" : "border-indigo-200 bg-indigo-50/60"
      }`}
    >
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {tone === "before" ? "Before" : "After"}
      </p>
      <p className="text-sm font-semibold text-slate-800">
        {lecture.period} {lecture.subject}
      </p>
      <p className="text-xs text-slate-500">
        {lecture.professor} · {lecture.durationHours}시간
      </p>
      <div className="mt-2">
        <StatusBadge status={lecture.status} />
      </div>
      <div className="mt-2 space-y-1">
        {rows.length === 0 && <p className="text-xs text-slate-400">배정된 조 없음</p>}
        {rows.map((a) => (
          <p key={a.id} className="text-xs text-slate-600">
            초안 <span className="font-medium">{memberName(members, a.draftMemberId)}</span> / 검안{" "}
            <span className="font-medium">{memberName(members, a.proofMemberId)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

const ACTION_META: Record<ScheduleActionType, { label: string; icon: typeof Scissors; color: string }> = {
  reduce: { label: "시간 단축 (-1시간)", icon: Scissors, color: "text-amber-600" },
  merge_next: { label: "다음 강의 병합", icon: Scissors, color: "text-emerald-600" },
  extend: { label: "연장 (+1시간)", icon: TimerReset, color: "text-indigo-600" },
  cancel: { label: "휴강/연기", icon: Ban, color: "text-rose-600" },
  unassign: { label: "미배정(배정 제외)", icon: Ban, color: "text-slate-600" },
  restore: { label: "처리 취소 (복원)", icon: TimerReset, color: "text-teal-600" },
};

export default function SchedulePreviewModal({
  action,
  beforeLecture,
  afterLecture,
  beforeAssignments,
  afterAssignments,
  otherAffectedLectures,
  members,
  changes,
  contactNames,
  showEarlyEndBonus,
  onConfirm,
  onClose,
}: {
  action: ScheduleActionType;
  beforeLecture: Lecture;
  afterLecture: Lecture;
  beforeAssignments: Assignment[];
  afterAssignments: Assignment[];
  otherAffectedLectures: { before: Lecture; after: Lecture }[];
  members: Member[];
  changes: string[];
  contactNames: string[];
  showEarlyEndBonus: boolean;
  onConfirm: (earlyEndBonus?: number) => void;
  onClose: () => void;
}) {
  const meta = ACTION_META[action];
  const Icon = meta.icon;
  const [earlyEndBonus, setEarlyEndBonus] = useState<number | null>(null);
  const [contactCopied, setContactCopied] = useState(false);

  const bonusOptions = beforeLecture.durationHours <= 1 
    ? [
        { label: "6점 (1시간 꽉 채움, 밀도 높음)", value: 2 },
        { label: "4점 (1시간 기본 / 분량 적음)", value: 0 },
      ]
    : [
        { label: "8점 (밀도 유사, 기본점수 유지)", value: 4 },
        { label: "6점 (신규 작성이지만 양이 적음)", value: 2 },
        { label: "4점 (이전 학습부가 있어 간단 수정)", value: 0 },
        { label: "2점 (기출문제만 추가)", value: -2 },
      ];

  const copyContacts = async () => {
    try {
      await navigator.clipboard.writeText(`연락 대상: ${contactNames.join(", ")}`);
      setContactCopied(true);
      setTimeout(() => setContactCopied(false), 1500);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 px-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={20} className={meta.color} />
            <h2 className="text-base font-semibold text-slate-900">{meta.label} 미리보기</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <LectureCard lecture={beforeLecture} assignments={beforeAssignments} members={members} tone="before" />
          <div className="flex justify-center py-1 sm:py-0">
            <ArrowRight size={18} className="text-slate-400" />
          </div>
          <LectureCard lecture={afterLecture} assignments={afterAssignments} members={members} tone="after" />
        </div>

        {otherAffectedLectures.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">영향받는 다른 강의</p>
            {otherAffectedLectures.map(({ before, after }) => (
              <div key={before.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <LectureCard lecture={before} assignments={beforeAssignments} members={members} tone="before" />
                <div className="flex justify-center py-1 sm:py-0">
                  <ArrowRight size={18} className="text-slate-400" />
                </div>
                <LectureCard lecture={after} assignments={afterAssignments} members={members} tone="after" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">변경 사항</p>
          <ul className="space-y-1">
            {changes.map((c, i) => (
              <li key={i} className="text-sm text-slate-600">
                • {c}
              </li>
            ))}
          </ul>
        </div>

        {contactNames.length > 0 && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Users size={13} /> 연락 대상
              </p>
              <button onClick={copyContacts} className="flex items-center gap-1 text-xs font-medium text-indigo-600">
                {contactCopied ? <Check size={12} /> : <Copy size={12} />} {contactCopied ? "복사됨" : "복사"}
              </button>
            </div>
            <p className="text-sm text-slate-600">{contactNames.join(", ")}</p>
          </div>
        )}

        {showEarlyEndBonus && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">조기종료 보너스</p>
            <div className="flex flex-col gap-1.5">
              {bonusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEarlyEndBonus(earlyEndBonus === opt.value ? null : opt.value)}
                  className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                    earlyEndBonus === opt.value ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(earlyEndBonus ?? undefined)}
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98]"
          >
            변경 확정
          </button>
        </div>
      </div>
    </div>
  );
}
