"use client";

import { Assignment, Lecture, Member } from "@/lib/types";
import { X } from "lucide-react";

interface Props {
  assignment: Assignment;
  lecture: Lecture | undefined;
  type: "draft" | "proof";
  onClose: () => void;
}

export default function ScoreReportModal({ assignment, lecture, type, onClose }: Props) {
  const reasonText = type === "draft" ? assignment.draftAdjustmentReason : assignment.proofAdjustmentReason;
  const isDraft = type === "draft";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            {lecture ? `${lecture.date} ${lecture.subject}` : "강의 정보 없음"}
            <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {isDraft ? "초안" : "검안"} 채점 내역
            </span>
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 max-h-[60vh] overflow-y-auto">
          {reasonText ? (
            <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700 leading-relaxed">
              {reasonText}
            </pre>
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">
              상세 채점 내역이 등록되지 않았습니다.
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-900"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
