"use client";

import { useState } from "react";
import { Assignment, Lecture } from "@/lib/types";
import { proofBasePoints } from "@/lib/scoring";

interface Props {
  assignment: Assignment;
  lecture: Lecture;
  proofMemberName: string;
  onClose: () => void;
  onSave: (adjustment: number, reason: string) => void;
}

export default function ProofEvaluationModal({ assignment, lecture, proofMemberName, onClose, onSave }: Props) {
  const baseScore = proofBasePoints(lecture.subjectType, lecture.durationHours, assignment.proofAtDraftLevel);

  // Form State
  const [daysLate, setDaysLate] = useState<number>(0);
  const [correctionLevel, setCorrectionLevel] = useState<"normal" | "minor_neglect" | "major_neglect">("normal");
  const [readabilityBonus, setReadabilityBonus] = useState<number>(0);
  const [rewritten, setRewritten] = useState<boolean>(false);

  const calculateAdjustment = () => {
    let bonus = 0;
    bonus += readabilityBonus;
    if (rewritten) bonus += 8.0;

    let penalty = 0;
    penalty -= daysLate * 0.5;
    
    if (correctionLevel === "minor_neglect") penalty -= 0.5;
    if (correctionLevel === "major_neglect") penalty -= 1.0;

    return { bonus, penalty, total: bonus + penalty };
  };

  const generateReport = () => {
    const { bonus, penalty, total } = calculateAdjustment();
    
    let correctionText = "정상 교정 완료";
    if (correctionLevel === "minor_neglect") correctionText = "경미한 방치 (-0.5점)";
    if (correctionLevel === "major_neglect") correctionText = "심각한 방치 (-1.0점)";

    const deductions = [];
    if (daysLate > 0) deductions.push(`검안 ${daysLate}일 지연(-${daysLate * 0.5})`);
    if (correctionLevel === "minor_neglect") deductions.push(`경미한 방치(-0.5)`);
    if (correctionLevel === "major_neglect") deductions.push(`심각한 방치(-1.0)`);
    if (readabilityBonus > 0) deductions.push(`표 정리 가독성 개선(+${readabilityBonus})`);
    if (rewritten) deductions.push(`전면 재작성(+8.0)`);
    
    const finalScore = baseScore + total;

    return `[학습부 검안 평가 보고]
과목 / 교시: ${lecture.subject} ${lecture.period} / 검안자: ${proofMemberName}
기본 점수: +${baseScore.toFixed(1)}점 (${lecture.subjectType === "major" ? "메이저" : "마이너"} ${lecture.durationHours}시간 기준)

[평가 체크리스트]
제출 기한 (48시간 이내): ${daysLate === 0 ? "O (정상)" : `X (${daysLate}일 지연, -${(daysLate * 0.5).toFixed(1)}점)`}
초안 오류·누락 교정 여부: ${correctionText}
가독성/서식 개선 (가산점): ${readabilityBonus > 0 ? `특별한 개선 여부 (+${readabilityBonus}점)` : "해당 없음"}
초안 대체 재작성 여부: ${rewritten ? "전면 재작성 (+8.0점 추가)" : "해당 없음"}

[최종 산정]
최종 스코어링: 기본점 + 가산점 - 감점 = ${finalScore > 0 ? "+" : ""}${finalScore.toFixed(1)}점
시트 비고란 기입 문구: ${deductions.join(", ") || "특이사항 없음"}  
`;
  };

  const handleSave = () => {
    const { total } = calculateAdjustment();
    onSave(total, generateReport());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="mb-4 text-lg font-bold text-slate-800">검안 평가서 작성 ({proofMemberName})</h2>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">1. 가산점 항목</h3>
            <div>
              <label className="text-xs font-medium text-slate-500">가독성/서식 개선 (점수 직접 입력 0 ~ 1.5)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="1.5"
                value={readabilityBonus}
                onChange={(e) => setReadabilityBonus(Number(e.target.value))}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={rewritten}
                  onChange={(e) => setRewritten(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                초안 대체 전면 재작성 (+8.0점 추가)
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">2. 감점 항목</h3>
            <div>
              <label className="text-xs font-medium text-slate-500">제출 지연 일수 (-0.5점 x n일)</label>
              <input
                type="number"
                min="0"
                value={daysLate}
                onChange={(e) => setDaysLate(Number(e.target.value))}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">초안 오류·누락 교정 여부</label>
              <select
                value={correctionLevel}
                onChange={(e) => setCorrectionLevel(e.target.value as any)}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="normal">정상 교정 완료 (감점 없음)</option>
                <option value="minor_neglect">경미한 방치 (-0.5점)</option>
                <option value="major_neglect">심각한 방치 (-1.0점)</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 font-mono text-[11px] text-slate-600 whitespace-pre-wrap">
            {generateReport()}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95"
          >
            평가 저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
