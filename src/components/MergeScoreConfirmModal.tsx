"use client";

import { useState } from "react";
import { CheckCircle2, X, HelpCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Assignment, Lecture } from "@/lib/types";
import { getDefaultTier, getAvailableTiers } from "@/lib/scoring";

interface Props {
  assignment: Assignment;
  lecture: Lecture;
  draftMemberName: string;
  proofMemberName: string;
  onClose: () => void;
  onConfirm: (draftScore: number, proofScore: number, reason: string) => void;
}

export default function MergeScoreConfirmModal({ assignment, lecture, draftMemberName, proofMemberName, onClose, onConfirm }: Props) {
  const isMerged = !!lecture.topic?.includes(" & ") || lecture.actualDurationMin != null;
  const defaultTier = getDefaultTier(lecture.subjectType, lecture.durationHours);
  const availableTiers = getAvailableTiers(lecture.subjectType, lecture.durationHours);

  const [selectedDraftScore, setSelectedDraftScore] = useState<number>(defaultTier.draft);
  const [selectedProofScore, setSelectedProofScore] = useState<number>(defaultTier.proof);
  const [reason, setReason] = useState<string>(defaultTier.reason);
  const [showHelp, setShowHelp] = useState(false);

  const handleOption = (draft: number, proof: number, text: string) => {
    setSelectedDraftScore(draft);
    setSelectedProofScore(proof);
    setReason(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 fade-in duration-200">
        <div className="border-b border-slate-100 px-5 py-4 flex justify-between items-center bg-indigo-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-800">기본 점수 확정</h2>
            <p className="text-xs text-slate-500 mt-0.5">{lecture.subject}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-500">배정 정보</span>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{lecture.durationHours}시간 · {lecture.subjectType === "major" ? "메이저" : "마이너"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">초안: <span className="font-medium text-slate-900">{draftMemberName}</span></span>
              <span className="text-slate-600">검안: <span className="font-medium text-slate-900">{proofMemberName}</span></span>
            </div>
          </div>

          {lecture.actualDurationMin != null && (
            <div className="rounded-xl bg-indigo-50 p-3 border border-indigo-100 text-xs text-indigo-800">
              ⏱ 실제 진행 시간 <b>{lecture.actualDurationMin}분</b> (예정 {lecture.durationHours * 60}분) 입력됨
              — 아래의 상세 체크리스트에서 상황에 맞는 항목을 선택해 점수를 확정해주세요.
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100/50 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <HelpCircle size={14} className="text-indigo-600" />
                <span>어떤 상황일 때 선택하나요? (기준 안내)</span>
              </div>
              {showHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showHelp && (
              <div className="px-4 pb-4 pt-1 text-xs text-slate-600 space-y-3 border-t border-slate-100">
                {availableTiers.map((t) => (
                  <div key={t.id}>
                    <p className="font-semibold text-indigo-700 mb-0.5">{t.reason}</p>
                    <p className="leading-relaxed opacity-90">{t.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 mb-2">스코어링 상세 옵션 선택</p>

            {availableTiers.map((tier) => (
               <button
                 key={tier.id}
                 onClick={() => handleOption(tier.draft, tier.proof, tier.reason)}
                 className={`w-full text-left rounded-xl p-3 border text-sm transition-all ${
                   reason === tier.reason ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600" : "border-slate-200 hover:border-indigo-200"
                 }`}
               >
                 <div className="flex justify-between items-center mb-1">
                   <span className="font-semibold text-slate-900">{tier.reason}</span>
                   <span className="text-indigo-600 font-bold">초안 {tier.draft} / 검안 {tier.proof}</span>
                 </div>
               </button>
            ))}
          </div>

          <button
            onClick={() => onConfirm(selectedDraftScore, selectedProofScore, reason)}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white transition active:scale-95 hover:bg-indigo-700 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={18} />
            최종 점수 확정하기
          </button>
        </div>
      </div>
    </div>
  );
}
