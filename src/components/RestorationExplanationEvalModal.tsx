"use client";

import { useState } from "react";
import { RestorationItem } from "@/lib/types";

interface Props {
  item: RestorationItem;
  explainerName: string;
  onClose: () => void;
  onSave: (validExplanations: number, rewriteRequested: boolean, rewriteCompleted: boolean, penalty: number, reason: string) => void;
}

export default function RestorationExplanationEvalModal({ item, explainerName, onClose, onSave }: Props) {
  const [hasAnswer, setHasAnswer] = useState(true);
  const [hasDetail, setHasDetail] = useState(true);
  const [hasTheory, setHasTheory] = useState(true);
  const [hasPastExams, setHasPastExams] = useState(true);
  const [isValid, setIsValid] = useState(true);
  const [deadlineMet, setDeadlineMet] = useState(true);
  
  const [actionLevel, setActionLevel] = useState<"normal" | "rewrite_request" | "rewrite_fail">("normal");

  const generateReport = () => {
    let actionText = "정상 완료 (문제당 +1.0점 부여)";
    if (actionLevel === "rewrite_request") actionText = "1차 부실 -> 재작성 요청 완료";
    if (actionLevel === "rewrite_fail") actionText = "재작성 거부/2차 부실 -> 해설 점수 취소 및 -3.0점 감점 처리";

    return `[과목명: ${item.subject} / 문제 번호: ${item.questionRangeStart}~${item.questionRangeEnd}번 / 해설자: ${explainerName}]

필수 구성 요소 충족:
[${hasAnswer ? "O" : "X"}] 정답 명시
[${hasDetail ? "O" : "X"}] 상세 풀이 및 오답 선지 해설
[${hasTheory ? "O" : "X"}] 관련 이론/가이드라인 요약
[${hasPastExams ? "O" : "X"}] 관련 족보/기출 연계 표기
[${isValid ? "O" : "X"}] 해설의 유효성 (시험 재시 대비 및 실질적 문제 풀이에 도움이 되는가?)
[${deadlineMet ? "O" : "X"}] 제출 기한 준수 (시험 해당 주 이내 완료 여부)

부실 해설 조치 여부:
${actionText}
`;
  };

  const handleSave = () => {
    let validExplanations = item.validExplanations;
    let rewriteRequested = item.rewriteRequested;
    let rewriteCompleted = item.rewriteCompleted;
    let penalty = 0;

    if (actionLevel === "normal") {
      validExplanations = item.totalQuestions;
      rewriteRequested = false;
      rewriteCompleted = false;
    } else if (actionLevel === "rewrite_request") {
      validExplanations = 0; // Not valid yet
      rewriteRequested = true;
      rewriteCompleted = false;
    } else if (actionLevel === "rewrite_fail") {
      validExplanations = 0;
      rewriteRequested = true;
      rewriteCompleted = false; // Never completed
      // Penalty will be handled by the scoring system automatically if rewriteRequested && !rewriteCompleted
    }

    onSave(validExplanations, rewriteRequested, rewriteCompleted, penalty, generateReport());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="mb-4 text-lg font-bold text-slate-800">해설 품질 평가 작성 ({explainerName})</h2>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">필수 구성 요소 충족</h3>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={hasAnswer}
                  onChange={(e) => setHasAnswer(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                정답 명시
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={hasDetail}
                  onChange={(e) => setHasDetail(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                상세 풀이 및 오답 선지 해설
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={hasTheory}
                  onChange={(e) => setHasTheory(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                관련 이론/가이드라인 요약
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={hasPastExams}
                  onChange={(e) => setHasPastExams(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                관련 족보/기출 연계 표기
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isValid}
                  onChange={(e) => setIsValid(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                해설의 유효성: 시험 재시 대비 및 실질적 문제 풀이에 도움이 되는 설명인가?
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={deadlineMet}
                  onChange={(e) => setDeadlineMet(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                제출 기한 준수: 시험 해당 주 이내 완료 여부
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">부실 해설 조치 여부</h3>
            <div className="flex flex-col gap-2 mt-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="actionLevel"
                  checked={actionLevel === "normal"}
                  onChange={() => setActionLevel("normal")}
                  className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                정상 완료 (문제당 +1.0점 부여)
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="actionLevel"
                  checked={actionLevel === "rewrite_request"}
                  onChange={() => setActionLevel("rewrite_request")}
                  className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                1차 부실 (재작성 요청 완료)
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-rose-600 cursor-pointer">
                <input
                  type="radio"
                  name="actionLevel"
                  checked={actionLevel === "rewrite_fail"}
                  onChange={() => setActionLevel("rewrite_fail")}
                  className="text-rose-600 focus:ring-rose-500 h-4 w-4"
                />
                재작성 거부/2차 부실 (해설 점수 취소 및 -3.0점 감점 처리)
              </label>
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
            평가 적용하기
          </button>
        </div>
      </div>
    </div>
  );
}
