"use client";

import { useState } from "react";
import { RestorationItem } from "@/lib/types";

interface Props {
  item: RestorationItem;
  totalQuestions: number;
  collectorName: string;
  onClose: () => void;
  onSave: (collectionBonus: number, reason: string) => void;
}

export default function RestorationCollectionEvalModal({ item, totalQuestions, collectorName, onClose, onSave }: Props) {
  const [deadlineMet, setDeadlineMet] = useState(true);
  const [contextRefined, setContextRefined] = useState(true);
  const [issueReported, setIssueReported] = useState(true);
  // Default to 1 point per problem collected (or just pass totalQuestions)
  const [bonus, setBonus] = useState<number>(item.collectionBonus || totalQuestions);

  const generateReport = () => {
    return `[과목명: ${item.subject} / 수합 담당 과목부장: ${collectorName}]
[${deadlineMet ? "O" : "X"}] 수합 기한 준수 (2~3일 이내)
[${contextRefined ? "O" : "X"}] 문장 정제 및 편집
[${issueReported ? "O" : "X"}] 이상자 명단 첨부

[스코어링 계산]
총 수합 문제 수: ${totalQuestions}문제
산정 기준: 문제당 +1점 추가 (기본 설정)
수합 부여 점수: +${bonus.toFixed(1)}점
`;
  };

  const handleSave = () => {
    onSave(bonus, generateReport());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="mb-4 text-lg font-bold text-slate-800">수합 평가 작성 ({collectorName})</h2>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">체크리스트</h3>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={deadlineMet}
                  onChange={(e) => setDeadlineMet(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                수합 기한 준수: 복원 제출 완료 후 2~3일 이내에 수합 완료했는가?
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={contextRefined}
                  onChange={(e) => setContextRefined(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                문장 정제 및 편집: 단순 복붙에 그치지 않고 문제와 선지 문맥을 매끄럽게 다듬었는가?
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={issueReported}
                  onChange={(e) => setIssueReported(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                이상자 명단 첨부: 복원 불량/미흡 인원의 학번, 이름, 사유를 수합 파일에 명시했는가?
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">수합 부여 점수</h3>
            <p className="text-xs text-slate-500">
              산정 기준: 문제당 +1점 / 현재 할당 문항: {totalQuestions}문항
            </p>
            <input
              type="number"
              step="0.5"
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value))}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
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
            평가 리셋하기
          </button>
          <div className="flex gap-3">
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
    </div>
  );
}
