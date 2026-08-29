"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Assignment, Lecture, Member } from "@/lib/types";
import { draftBasePoints, proofBasePoints, suggestDurationTier } from "@/lib/scoring";

interface Props {
  assignment: Assignment;
  lecture: Lecture;
  draftMemberName: string;
  proofMemberName: string;
  onClose: () => void;
  onConfirm: (draftScore: number, proofScore: number, reason: string) => void;
}

export default function MergeScoreConfirmModal({ assignment, lecture, draftMemberName, proofMemberName, onClose, onConfirm }: Props) {
  // 병합된 강의(topic이 "A & B")거나, 실제 진행 시간을 입력해둔 강의면
  // 조기종료 등급 옵션을 보여준다 — scheduleActions.ts의 merge_next는 topic만
  // 합치고 subject는 안 건드리므로 subject가 아니라 topic으로 판단해야 한다.
  const isMerged = !!lecture.topic?.includes(" & ") || lecture.actualDurationMin !== undefined;
  const baseDraft = draftBasePoints(lecture.subjectType, lecture.durationHours);
  const baseProof = proofBasePoints(lecture.subjectType, lecture.durationHours, assignment.proofAtDraftLevel);

  // 실제 진행 시간이 입력돼 있으면 그 시간에 맞는 등급을 기본으로 골라준다 —
  // 그룹장은 확인만 하고, 다르면 다른 옵션을 눌러 바꾸면 된다.
  const suggested = lecture.actualDurationMin
    ? suggestDurationTier(lecture.durationHours, lecture.actualDurationMin)
    : null;

  const [selectedDraftScore, setSelectedDraftScore] = useState<number>(suggested?.draft ?? baseDraft);
  const [selectedProofScore, setSelectedProofScore] = useState<number>(suggested?.proof ?? baseProof);
  const [reason, setReason] = useState<string>(suggested?.reason ?? "정상 진행");

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
            <h2 className="text-base font-bold text-slate-800">점수 수동 확정 (그룹장)</h2>
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

          {lecture.actualDurationMin !== undefined && (
            <div className="rounded-xl bg-indigo-50 p-3 border border-indigo-100 text-xs text-indigo-800">
              ⏱ 실제 진행 시간 <b>{lecture.actualDurationMin}분</b> (예정 {lecture.durationHours * 60}분) 입력됨
              {suggested ? ` — 아래 "${suggested.reason}"를 자동으로 추천해뒀어요. 확인 후 그대로 확정하거나 다른 등급을 골라주세요.` : " — 정상 진행 범위라 추천 등급은 없어요."}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 mb-2">스코어링 옵션 선택 (자동 계산)</p>

            <button
              onClick={() => handleOption(baseDraft, baseProof, "정상 진행")}
              className={`w-full text-left rounded-xl p-3 border text-sm transition-all ${
                reason === "정상 진행" ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600" : "border-slate-200 hover:border-indigo-200"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-slate-900">정상 진행 (기본점수)</span>
                <span className="text-indigo-600 font-bold">초안 {baseDraft} / 검안 {baseProof}</span>
              </div>
              <p className="text-xs text-slate-500">정상적인 밀도로 수업이 진행된 경우</p>
            </button>

            {isMerged && (
              <>
                <button
                  onClick={() => handleOption(8, 5, "조기종료 - 밀도 유사")}
                  className={`w-full text-left rounded-xl p-3 border text-sm transition-all ${
                    reason === "조기종료 - 밀도 유사" ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600" : "border-slate-200 hover:border-indigo-200"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-900">8점 (밀도 유사)</span>
                    <span className="text-indigo-600 font-bold">초안 8.0 / 검안 5.0</span>
                  </div>
                  <p className="text-xs text-slate-500">조기 종료되었으나 수업 밀도가 2시간 분량인 경우</p>
                </button>

                <button
                  onClick={() => handleOption(6, 3, "조기종료 - 신규/양 적음")}
                  className={`w-full text-left rounded-xl p-3 border text-sm transition-all ${
                    reason === "조기종료 - 신규/양 적음" ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600" : "border-slate-200 hover:border-indigo-200"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-900">6점 (신규 작성이지만 양이 적음)</span>
                    <span className="text-indigo-600 font-bold">초안 6.0 / 검안 3.0</span>
                  </div>
                  <p className="text-xs text-slate-500">풀타임 고밀도 1시간 수업과 유사한 경우</p>
                </button>

                <button
                  onClick={() => handleOption(4, 2.5, "조기종료 - 간단 수정")}
                  className={`w-full text-left rounded-xl p-3 border text-sm transition-all ${
                    reason === "조기종료 - 간단 수정" ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600" : "border-slate-200 hover:border-indigo-200"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-900">4점 (단순 수정 위주)</span>
                    <span className="text-indigo-600 font-bold">초안 4.0 / 검안 2.5</span>
                  </div>
                  <p className="text-xs text-slate-500">이전 학습부가 있어 간단 수정만 한 경우</p>
                </button>

                <button
                  onClick={() => handleOption(2, 1, "조기종료 - 기출만 추가")}
                  className={`w-full text-left rounded-xl p-3 border text-sm transition-all ${
                    reason === "조기종료 - 기출만 추가" ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600" : "border-slate-200 hover:border-indigo-200"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-900">2점 (기출문제만 추가)</span>
                    <span className="text-indigo-600 font-bold">초안 2.0 / 검안 1.0</span>
                  </div>
                  <p className="text-xs text-slate-500">내용이 전년도와 동일하여 기출만 추가한 경우</p>
                </button>
              </>
            )}
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
