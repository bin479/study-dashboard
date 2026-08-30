"use client";

import { useState } from "react";
import { Assignment, Lecture, Member } from "@/lib/types";
import { draftBasePoints, SCORING_RULES } from "@/lib/scoring";

interface Props {
  assignment: Assignment;
  lecture: Lecture;
  draftMemberName: string;
  onClose: () => void;
  onSave: (adjustment: number, reason: string) => void;
}

export default function DraftEvaluationModal({ assignment, lecture, draftMemberName, onClose, onSave }: Props) {
  const baseScore = draftBasePoints(lecture.subjectType, lecture.durationHours);

  // Form State
  const [similarity, setSimilarity] = useState<"90+" | "70-80" | "50-" | "rev" | "new">("90+");
  const [readabilityBonus, setReadabilityBonus] = useState<number>(0);
  const [recordingMissing, setRecordingMissing] = useState<boolean>(!assignment.recordingUploaded);
  const [missingPastExamsCount, setMissingPastExamsCount] = useState<number>(0);
  const [newContentMissing, setNewContentMissing] = useState<"none" | "minor" | "major" | "critical">("none");
  const [formatPenalty, setFormatPenalty] = useState<number>(0);
  const [spreadsheetMissing, setSpreadsheetMissing] = useState<boolean>(false);
  const [marksChecked, setMarksChecked] = useState<boolean>(true);

    const isMajor1Hr = lecture.subjectType === "major" && lecture.durationHours === 1;
    const newBonus = isMajor1Hr ? 3.0 : 6.0;

    let bonus = 0;
    if (similarity === "70-80") bonus += 1.0;
    else if (similarity === "50-") bonus += 2.5; // Average of 2~3
    else if (similarity === "rev") bonus += 2.0;
    else if (similarity === "new") bonus += newBonus;

    bonus += readabilityBonus;

    let penalty = 0;
    if (recordingMissing) penalty -= 1.0;
    penalty -= missingPastExamsCount * 1.0;
    
    if (newContentMissing === "minor") penalty -= 0.5;
    else if (newContentMissing === "major") penalty -= 2.0; // Average of 1~3
    else if (newContentMissing === "critical") penalty -= 10.0;

    penalty -= Math.abs(formatPenalty);
    if (spreadsheetMissing) penalty -= 0.5;

    return { bonus, penalty, total: bonus + penalty };
  };

  const generateReport = () => {
    const { bonus, penalty, total } = calculateAdjustment();
    const isMajor1Hr = lecture.subjectType === "major" && lecture.durationHours === 1;
    const newBonus = isMajor1Hr ? 3.0 : 6.0;

    // Similarity Text
    let simText = "90% 이상 동일 (가산점 없음)";
    if (similarity === "70-80") simText = "70~80% (변동사항 충실 반영, +1.0점)";
    if (similarity === "50-") simText = "50% 미만 (+2.5점)";
    if (similarity === "rev") simText = "전면 개정 재작업 (+2.0점)";
    if (similarity === "new") simText = `교수 변경 또는 신규 전면 작성 (+${newBonus.toFixed(1)}점)`;

    let penaltyText = `[감점 내역: 총 ${penalty}점]\n`;
    const deductions = [];
    if (recordingMissing) deductions.push(`녹음 파일 미제출: -1.0점`);
    if (missingPastExamsCount > 0) deductions.push(`기출문제 누락: -${missingPastExamsCount}.0점 (${missingPastExamsCount}개)`);
    if (newContentMissing === "minor") deductions.push(`신규 설명 내용 경미한 누락: -0.5점`);
    if (newContentMissing === "major") deductions.push(`신규 설명 핵심 누락: -2.0점`);
    if (newContentMissing === "critical") deductions.push(`신규 설명 50%이상 미반영: -10.0점`);
    if (formatPenalty > 0) deductions.push(`서식 불량: -${formatPenalty}점`);
    if (spreadsheetMissing) deductions.push(`기출 스프레드시트 업데이트 누락: -0.5점`);
    
    if (deductions.length === 0) {
      penaltyText += "없음\n";
    } else {
      penaltyText += deductions.join("\n") + "\n";
    }

    const shortDeductions = deductions.map(d => d.split(":")[0] + "(" + d.split(":")[1].trim().split("점")[0] + ")").join(", ");
    
    const finalScore = baseScore + total;

    return `[학습부 초안 평가 보고]
과목 / 교시: ${lecture.subject} ${lecture.period} / ${draftMemberName}
기본 점수: +${baseScore.toFixed(1)}점

[체크리스트 확인]
녹음 파일 제출 여부: ${recordingMissing ? "X (미제출)" : "O (정상)"}
내용 일치도: ${simText}
서식 및 가독성 (클로바노트 단순 복붙 등): ${formatPenalty > 0 ? "불량" : (readabilityBonus > 0 ? "우수 (+" + readabilityBonus + "점)" : "이상 없음")}
피마 / 25마 표시: ${marksChecked ? "반영 완료" : "미반영"}

${penaltyText}
[최종 산정 결과]
최종 스코어링: ${finalScore > 0 ? "+" : ""}${finalScore.toFixed(1)}점 (+${baseScore.toFixed(1)}점 ${total >= 0 ? "+" : ""}${total.toFixed(1)}점)
시트 비고란 기입 문구: ${shortDeductions || "특이사항 없음"}  
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
        <h2 className="mb-4 text-lg font-bold text-slate-800">초안 평가서 작성 ({draftMemberName})</h2>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">1. 내용 일치도 및 가산점</h3>
            <div>
              <label className="text-xs font-medium text-slate-500">내용 일치도</label>
              <select
                value={similarity}
                onChange={(e) => setSimilarity(e.target.value as any)}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="90+">90% 이상 동일 (가산점 없음)</option>
                <option value="70-80">70~80% - 변동사항 충실 반영 (+1.0점)</option>
                <option value="50-">50% 미만 (+2.5점)</option>
                <option value="rev">강의안 전면 개정 재작업 (+2.0점)</option>
                <option value="new">교수 변경 또는 신규 전면 작성 (+{lecture.subjectType === "major" && lecture.durationHours === 1 ? "3.0" : "6.0"}점)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">가독성 향상 (점수 직접 입력 0 ~ 1.5)</label>
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
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">2. 감점 항목</h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={recordingMissing}
                  onChange={(e) => setRecordingMissing(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                녹음 파일 미제출 (-1.0점)
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={spreadsheetMissing}
                  onChange={(e) => setSpreadsheetMissing(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                기출 스프레드시트 반영 누락 (-0.5점)
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={!marksChecked}
                  onChange={(e) => setMarksChecked(!e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                피마 / 25마 표시 누락
              </label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500">본문 기출문제 누락 개수 (개당 -1.0점)</label>
                <input
                  type="number"
                  min="0"
                  value={missingPastExamsCount}
                  onChange={(e) => setMissingPastExamsCount(Number(e.target.value))}
                  className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">서식 불량/복붙 감점 (0 ~ -8.0)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="8"
                  value={formatPenalty}
                  onChange={(e) => setFormatPenalty(Number(e.target.value))}
                  className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">신규 설명 누락</label>
              <select
                value={newContentMissing}
                onChange={(e) => setNewContentMissing(e.target.value as any)}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="none">없음 (0점)</option>
                <option value="minor">경미한 누락 (-0.5점)</option>
                <option value="major">핵심 누락 (-2.0점)</option>
                <option value="critical">50%이상 미반영 (-10.0점)</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 font-mono text-[11px] text-slate-600 whitespace-pre-wrap">
            {generateReport()}
          </div>
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <button
            onClick={() => {
              onSave(0, "");
              onClose();
            }}
            className="rounded-xl px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            초안 평가 리셋
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              닫기
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
    </div>
  );
}
