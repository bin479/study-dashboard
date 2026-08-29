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

const BONUS_ITEMS = [
  {
    key: "format" as const,
    points: 0.5,
    title: "서식 및 가독성 개선",
    examples: [
      "줄글 나열을 불릿 포인트(-, *)로 체계화",
      "들여쓰기, 폰트, 서식을 표준 양식에 맞게 전면 정돈",
      "중요 키워드·야마 강조 서식 적용",
    ],
  },
  {
    key: "structure" as const,
    points: 1.0,
    title: "구조화 및 시각화",
    examples: [
      "비교/대조 표(Table), 진단 기준(Criteria), 병기 분류 표 신설",
      "진단/치료 알고리즘 및 병태생리 순서도 플로우차트화",
      "해부학/영상자료(CT, MRI, X-ray)에 화살표·라벨링 추가",
    ],
  },
  {
    key: "content" as const,
    points: 1.0,
    title: "내용 충실 보완",
    examples: [
      "초안의 누락된 설명 및 교수님 구두 설명 맥락 복원·추가",
      "수치, 약물명, 병태생리 인과관계 등 의학적 오류 교정",
      "수업 범위와 연계된 전년도 기출(피마/야마) 및 해설 보강",
    ],
  },
];

const CORRECTION_TIERS = [
  {
    value: "normal" as const,
    title: "정상 교정 완료 (감점 없음)",
    example: "오탈자·사소한 오류를 빠짐없이 확인하고 수정함. 내용상 틀린 부분이나 자료와 다른 부분을 바로잡음.",
  },
  {
    value: "minor_neglect" as const,
    title: "경미한 방치 (-0.5점)",
    example: "오탈자 몇 개나 사소한 표기 오류를 놓침 — 전체 이해에는 지장이 없는 수준.",
  },
  {
    value: "major_neglect" as const,
    title: "심각한 방치 (-5.0 ~ -8.0점)",
    example:
      "초안에 핵심 누락, 심각한 오류, 기출 미반영, 클로바노트 단순 복붙 등의 문제가 있음에도 재작성 요구 등 적절한 조치 없이 그대로 검안 통과시킨 경우.",
  },
] as const;

export default function ProofEvaluationModal({ assignment, lecture, proofMemberName, onClose, onSave }: Props) {
  const baseScore = proofBasePoints(lecture.subjectType, lecture.durationHours, assignment.proofAtDraftLevel);

  // Form State
  const [daysLate, setDaysLate] = useState<number>(0);
  const [correctionLevel, setCorrectionLevel] = useState<"normal" | "minor_neglect" | "major_neglect">("normal");
  const [majorNeglectPenalty, setMajorNeglectPenalty] = useState<number>(5.0);
  const [formatBonus, setFormatBonus] = useState(false);
  const [structureBonus, setStructureBonus] = useState(false);
  const [contentBonus, setContentBonus] = useState(false);
  const [rewritten, setRewritten] = useState<boolean>(false);
  const [submissionPathOk, setSubmissionPathOk] = useState<boolean>(true);

  const bonusChecks: Record<(typeof BONUS_ITEMS)[number]["key"], boolean> = {
    format: formatBonus,
    structure: structureBonus,
    content: contentBonus,
  };
  const rawBonusSum = BONUS_ITEMS.reduce((sum, item) => sum + (bonusChecks[item.key] ? item.points : 0), 0);
  const cappedBonus = Math.min(rawBonusSum, 1.5);

  const calculateAdjustment = () => {
    let bonus = cappedBonus;
    if (rewritten) bonus += 8.0;

    let penalty = 0;
    penalty -= daysLate * 0.5;

    if (correctionLevel === "minor_neglect") penalty -= 0.5;
    if (correctionLevel === "major_neglect") penalty -= majorNeglectPenalty;

    return { bonus, penalty, total: bonus + penalty };
  };

  const generateReport = () => {
    const { bonus, penalty, total } = calculateAdjustment();
    const checkedBonusLabels = BONUS_ITEMS.filter((item) => bonusChecks[item.key]).map(
      (item) => `${item.title}(+${item.points})`
    );

    let correctionText = "정상 교정 완료";
    if (correctionLevel === "minor_neglect") correctionText = "경미한 방치 (-0.5점)";
    if (correctionLevel === "major_neglect") correctionText = `심각한 방치 (-${majorNeglectPenalty.toFixed(1)}점)`;

    const deductions = [];
    if (daysLate > 0) deductions.push(`검안 ${daysLate}일 지연(-${daysLate * 0.5})`);
    if (correctionLevel === "minor_neglect") deductions.push(`경미한 방치(-0.5)`);
    if (correctionLevel === "major_neglect") deductions.push(`심각한 방치(-${majorNeglectPenalty.toFixed(1)})`);
    if (checkedBonusLabels.length > 0) deductions.push(`가산점 - ${checkedBonusLabels.join(", ")} (합계 min(${rawBonusSum.toFixed(1)}, 1.5)=${cappedBonus.toFixed(1)})`);
    if (rewritten) deductions.push(`전면 재작성(+8.0)`);
    if (!submissionPathOk) deductions.push(`제출 경로 미준수 (개인톡 미제출)`);

    const finalScore = baseScore + total;

    return `[학습부 검안 평가 보고]
과목 / 교시: ${lecture.subject} ${lecture.period} / 검안자: ${proofMemberName}
기본 점수: +${baseScore.toFixed(1)}점 (${lecture.subjectType === "major" ? "메이저" : "마이너"} ${lecture.durationHours}시간 기준)

[평가 체크리스트]
제출 기한 (48시간 이내): ${daysLate === 0 ? "O (정상)" : `X (${daysLate}일 지연, -${(daysLate * 0.5).toFixed(1)}점)`}
초안 오류·누락 교정 여부: ${correctionText}
가산점 항목 (최대 +1.5점): ${checkedBonusLabels.length > 0 ? `${checkedBonusLabels.join(", ")} → 합계 +${cappedBonus.toFixed(1)}점` : "해당 없음"}
초안 대체 재작성 여부: ${rewritten ? "전면 재작성 (+8.0점 추가)" : "해당 없음"}
제출 경로 준수 (그룹장 개인톡 제출): ${submissionPathOk ? "O (정상)" : "X (미준수)"}

[최종 산정]
최종 스코어링: 기본점 + min(가산점 합계, 1.5) - 감점 = ${finalScore > 0 ? "+" : ""}${finalScore.toFixed(1)}점
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
            <h3 className="font-semibold text-slate-700">1. 가산점 항목 (합계 최대 +1.5점)</h3>
            <div className="space-y-2">
              {BONUS_ITEMS.map((item) => {
                const checked = bonusChecks[item.key];
                const setChecked =
                  item.key === "format" ? setFormatBonus : item.key === "structure" ? setStructureBonus : setContentBonus;
                return (
                  <label
                    key={item.key}
                    className={`block w-full cursor-pointer rounded-xl border p-2.5 text-left text-sm transition ${
                      checked ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600" : "border-slate-200 hover:border-indigo-200"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-indigo-600">+{item.points.toFixed(1)}점</span>
                        <span className="ml-2 font-medium text-slate-800">{item.title}</span>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-500">
                          {item.examples.map((ex) => (
                            <li key={ex}>{ex}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </label>
                );
              })}
              <p className="text-right text-xs text-slate-500">
                가산점 합계: {rawBonusSum.toFixed(1)}점 → 적용 <span className="font-semibold text-indigo-600">min({rawBonusSum.toFixed(1)}, 1.5) = +{cappedBonus.toFixed(1)}점</span>
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={rewritten}
                  onChange={(e) => setRewritten(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                ★ 전면 재작성 예외 인정 (+8.0점 추가, 1.5점 한도 예외)
              </label>
              <p className="mt-1 pl-6 text-xs text-slate-500">
                초안 미흡(내용 50% 이상 누락 등)으로 검안자가 초안 수준으로 전면 재작성한 경우. 기본 검안 점수 + 초안 작성 점수(+8점)를 합산 부여.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">2. 감점 항목</h3>
            <div>
              <label className="text-xs font-medium text-slate-500">
                제출 기한 지연 일수 (-0.5점 x n일 — 마감: 초안 업로드 후 48시간 이내, 시험 전주 금요일은 24시간 이내)
              </label>
              <input
                type="number"
                min="0"
                value={daysLate}
                onChange={(e) => setDaysLate(Number(e.target.value))}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">부실 검안 및 방치 페널티</label>
              <div className="mt-1 space-y-1.5">
                {CORRECTION_TIERS.map((tier) => (
                  <div key={tier.value}>
                    <button
                      type="button"
                      onClick={() => setCorrectionLevel(tier.value)}
                      className={`w-full rounded-xl border p-2.5 text-left text-sm transition ${
                        correctionLevel === tier.value
                          ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                          : "border-slate-200 hover:border-indigo-200"
                      }`}
                    >
                      <span className="font-semibold text-slate-900">{tier.title}</span>
                      <p className="mt-0.5 text-xs text-slate-500">{tier.example}</p>
                    </button>
                    {tier.value === "major_neglect" && correctionLevel === "major_neglect" && (
                      <div className="mt-1.5 flex items-center gap-2 pl-2.5">
                        <label className="text-xs font-medium text-slate-500">감점 폭 (5.0 ~ 8.0)</label>
                        <input
                          type="number"
                          min={5}
                          max={8}
                          step={0.5}
                          value={majorNeglectPenalty}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setMajorNeglectPenalty(Math.min(8, Math.max(5, v)));
                          }}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        />
                        <span className="text-xs text-slate-400">점 감점</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={submissionPathOk}
                  onChange={(e) => setSubmissionPathOk(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                제출 경로 준수 확인
              </label>
              <p className="mt-1 pl-6 text-xs text-slate-500">최종 검안 완료본은 그룹장에게 개인톡으로 정상 제출해야 합니다.</p>
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
            검안 평가 리셋
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
