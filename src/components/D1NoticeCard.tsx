"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Megaphone, Mic, Settings2 } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { buildD1NoticeLines, generateD1NoticeText } from "@/lib/notice";
import { formatDateWithWeekday, isoDateFromToday } from "@/lib/dates";
import { findGroupBySubject } from "@/lib/roles";
import { STUDY_GROUPS } from "@/lib/studyGroups";
import StatusBadge from "./StatusBadge";

const isoDate = isoDateFromToday;

export default function D1NoticeCard() {
  const lectures = useDashboardStore((s) => s.lectures);
  const assignments = useDashboardStore((s) => s.assignments);
  const members = useDashboardStore((s) => s.members);
  const noticeSettings = useDashboardStore((s) => s.noticeSettings);
  const setNoticeSettings = useDashboardStore((s) => s.setNoticeSettings);
  const viewingGroupId = useDashboardStore((s) => s.viewingGroupId);
  const simulatedToday = useDashboardStore((s) => s.simulatedToday);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const tomorrow = useMemo(() => isoDate(1, simulatedToday), [simulatedToday]);
  const isSimulated = simulatedToday !== null && simulatedToday !== isoDateFromToday();
  const scopedLectures = useMemo(
    () =>
      viewingGroupId
        ? lectures.filter((l) => findGroupBySubject(STUDY_GROUPS, l.subject)?.id === viewingGroupId)
        : lectures,
    [lectures, viewingGroupId]
  );
  const viewingGroup = STUDY_GROUPS.find((g) => g.id === viewingGroupId);
  const lines = useMemo(
    () => buildD1NoticeLines(scopedLectures, assignments, members, tomorrow),
    [scopedLectures, assignments, members, tomorrow]
  );
  const currentDraftRoom = viewingGroup
    ? noticeSettings.groupSettings[viewingGroup.id]?.draftRoom ?? `${viewingGroup.name} 톡방`
    : noticeSettings.draftRoom;
  const currentProofRoom = viewingGroup
    ? noticeSettings.groupSettings[viewingGroup.id]?.proofRoom ?? noticeSettings.proofRoom
    : noticeSettings.proofRoom;

  const noticeText = useMemo(
    () => generateD1NoticeText(scopedLectures, assignments, members, tomorrow, { ...noticeSettings, draftRoom: currentDraftRoom, proofRoom: currentProofRoom }),
    [scopedLectures, assignments, members, tomorrow, noticeSettings, currentDraftRoom, currentProofRoom]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(noticeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text via textarea prompt not needed for typical browsers
    }
  };

  return (
    <section className="sticky top-[92px] z-20 mb-6 overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200/50">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Megaphone size={18} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-100">
              D-1 카카오톡 공지{viewingGroup && ` · ${viewingGroup.name}`}
              {isSimulated && " · 시뮬레이션"}
            </p>
            <p className="text-lg font-semibold leading-tight">{formatDateWithWeekday(tomorrow)} 학습부 작성 안내</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-xl bg-white/15 p-2.5 text-white transition active:scale-95"
            aria-label="톡방 이름 설정"
          >
            <Settings2 size={16} />
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition active:scale-95 sm:px-4"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span className="hidden sm:inline">{copied ? "복사됨" : "카톡 공지 복사"}</span>
            <span className="sm:hidden">{copied ? "완료" : "복사"}</span>
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mx-4 mb-3 space-y-2 rounded-xl bg-white/10 p-3 sm:mx-5">
          <label className="block text-xs text-indigo-100">
            초안 업로드 톡방 이름 {viewingGroup && <span className="opacity-70">({viewingGroup.name} 전용)</span>}
            <input
              value={currentDraftRoom}
              onChange={(e) => {
                if (viewingGroup) {
                  setNoticeSettings({
                    ...noticeSettings,
                    groupSettings: {
                      ...noticeSettings.groupSettings,
                      [viewingGroup.id]: {
                        draftRoom: e.target.value,
                        proofRoom: currentProofRoom,
                      },
                    },
                  });
                } else {
                  setNoticeSettings({ ...noticeSettings, draftRoom: e.target.value });
                }
              }}
              className="mt-1 w-full rounded-lg bg-white/90 px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs text-indigo-100">
            검안 업로드 톡방 이름 {viewingGroup && <span className="opacity-70">({viewingGroup.name} 전용)</span>}
            <input
              value={currentProofRoom}
              onChange={(e) => {
                if (viewingGroup) {
                  setNoticeSettings({
                    ...noticeSettings,
                    groupSettings: {
                      ...noticeSettings.groupSettings,
                      [viewingGroup.id]: {
                        draftRoom: currentDraftRoom,
                        proofRoom: e.target.value,
                      },
                    },
                  });
                } else {
                  setNoticeSettings({ ...noticeSettings, proofRoom: e.target.value });
                }
              }}
              className="mt-1 w-full rounded-lg bg-white/90 px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
        </div>
      )}

      <div className="space-y-2 bg-white/10 px-4 pb-4 sm:px-5">
        {lines.length === 0 && (
          <p className="rounded-lg bg-white/10 px-3 py-3 text-sm text-indigo-100">
            내일 배정된 강의가 없습니다.
          </p>
        )}
        {lines.map(({ lecture, pairs, timeLabel, assignments: lectureAssignments }) => (
          <div key={lecture.id} className="rounded-xl bg-white/95 px-3 py-2.5 text-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="text-sm font-semibold">
                [{timeLabel}] {lecture.subject}
                {lecture.sessionNumber && <span> {lecture.sessionNumber}번</span>} 학습부
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {lecture.status !== "scheduled" && <StatusBadge status={lecture.status} />}
                {lectureAssignments.some((a) => a.recordingUploaded) && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-300">
                    <Mic size={12} /> 녹음
                  </span>
                )}
              </div>
            </div>
            <div className="mt-1 space-y-0.5">
              {pairs.map((p, i) => (
                <p key={i} className="text-xs text-slate-500">
                  초안 <span className="font-medium text-slate-700">{p.draftName}</span> · 검안{" "}
                  <span className="font-medium text-slate-700">{p.proofName}</span>
                </p>
              ))}
            </div>
          </div>
        ))}
        <div className="pt-1 text-xs text-indigo-100">
          <p>초안기한: {formatDateWithWeekday(isoDate(2, simulatedToday))} 오전 9시 ({currentDraftRoom}으로)</p>
          <p>검안기한: 초안 업로드 이후 48시간 ({currentProofRoom}으로)</p>
        </div>
      </div>
    </section>
  );
}
