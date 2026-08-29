"use client";

import { useRef, useState } from "react";
import { RefreshCw, Download, Upload, ArrowDownToLine, ArrowUpFromLine, Info, RotateCcw, Zap } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { downloadCSV, lecturesToCSV, membersToCSV, assignmentsToCSV } from "@/lib/csv";

function SyncBlock({
  title,
  description,
  sheetUrl,
  onSheetUrlChange,
  onPull,
  onUploadFile,
  onExport,
}: {
  title: string;
  description: string;
  sheetUrl: string;
  onSheetUrlChange: (url: string) => void;
  onPull: () => void;
  onUploadFile: (file: File) => void;
  onExport: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={sheetUrl}
          onChange={(e) => onSheetUrlChange(e.target.value)}
          placeholder="Google Sheets 공유 링크 붙여넣기"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          onClick={onPull}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white active:scale-95"
        >
          <ArrowDownToLine size={15} /> 가져오기
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600"
        >
          <Upload size={15} /> CSV 파일 업로드
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadFile(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={onExport}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600"
        >
          <ArrowUpFromLine size={15} /> CSV 내보내기 (Push)
        </button>
      </div>
    </div>
  );
}

export default function SyncView() {
  const sheetUrls = useDashboardStore((s) => s.sheetUrls);
  const setSheetUrl = useDashboardStore((s) => s.setSheetUrl);
  const pullLecturesFromSheet = useDashboardStore((s) => s.pullLecturesFromSheet);
  const pullMembersFromSheet = useDashboardStore((s) => s.pullMembersFromSheet);
  const importLecturesCSV = useDashboardStore((s) => s.importLecturesCSV);
  const importMembersCSV = useDashboardStore((s) => s.importMembersCSV);
  const activityLog = useDashboardStore((s) => s.activityLog);
  const addActivityLog = useDashboardStore((s) => s.addActivityLog);
  const lectures = useDashboardStore((s) => s.lectures);
  const members = useDashboardStore((s) => s.members);
  const assignments = useDashboardStore((s) => s.assignments);
  const resetToMockData = useDashboardStore((s) => s.resetToMockData);

  const [busy, setBusy] = useState<string | null>(null);
  const [sheetSyncBusy, setSheetSyncBusy] = useState(false);

  const handleSheetSyncNow = async () => {
    setSheetSyncBusy(true);
    try {
      const res = await fetch("/.netlify/functions/sheet-sync-now", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      addActivityLog({
        type: "sync",
        direction: "pull",
        source: "학습부배정표.xlsx",
        summary: `강의 ${data.lectures}건 반영 (배정 ${data.assignments}건, 삭제 ${data.removed}건) — 새로고침하면 보입니다.`,
        status: "success",
      });
    } catch (e) {
      addActivityLog({
        type: "sync",
        direction: "pull",
        source: "학습부배정표.xlsx",
        summary: `동기화 실패: ${(e as Error).message}`,
        status: "error",
      });
    }
    setSheetSyncBusy(false);
  };

  const readFile = (file: File, onText: (text: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => onText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const handlePull = async (kind: "lectures" | "members") => {
    setBusy(kind);
    if (kind === "lectures") await pullLecturesFromSheet(sheetUrls.lectures);
    else await pullMembersFromSheet(sheetUrls.members);
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <RefreshCw size={22} className="text-indigo-600" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Google Sheets 연동 &amp; CSV 동기화</h1>
          <p className="text-sm text-slate-500">시간표·멤버 명단·과제 큐를 시트 또는 CSV로 가져오고 내보냅니다.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-800">
        <Info size={15} className="mt-0.5 shrink-0" />
        <p>
          가져오기는 &quot;링크가 있는 모든 사용자&quot;로 공유된 Google 시트의 CSV export를 실시간으로 읽어옵니다(단방향 pull).
          쓰기(push)는 Google Sheets API OAuth 연결이 필요하므로, 이 데모에서는 CSV 내보내기로 대체되어 있습니다 — Apps
          Script 웹훅을 연결하면 완전한 2-way sync로 확장할 수 있습니다.
        </p>
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">학습부배정표 (구글 시트) 동기화</p>
        <p className="mt-0.5 text-xs text-slate-500">
          5분마다 자동으로 동기화되지만, 방금 시트를 고쳤다면 여기서 바로 반영할 수 있습니다.
        </p>
        <button
          onClick={handleSheetSyncNow}
          disabled={sheetSyncBusy}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          <Zap size={15} /> {sheetSyncBusy ? "동기화 중…" : "지금 동기화"}
        </button>
      </div>

      <SyncBlock
        title="강의 시간표 (Timetable)"
        description="컬럼: id, date, period, order, subject, professor, subjectType(major/minor), durationHours"
        sheetUrl={sheetUrls.lectures}
        onSheetUrlChange={(url) => setSheetUrl("lectures", url)}
        onPull={() => handlePull("lectures")}
        onUploadFile={(f) => readFile(f, (text) => importLecturesCSV(text, f.name))}
        onExport={() => {
          downloadCSV("timetable.csv", lecturesToCSV(lectures));
          addActivityLog({ type: "sync", direction: "push", source: "timetable.csv", summary: `${lectures.length}개 강의 항목을 내보냈습니다.`, status: "success" });
        }}
      />

      <SyncBlock
        title="멤버 로스터 (Member Roster)"
        description="컬럼: id, name, role(lead/student/admin), cohort, active(true/false)"
        sheetUrl={sheetUrls.members}
        onSheetUrlChange={(url) => setSheetUrl("members", url)}
        onPull={() => handlePull("members")}
        onUploadFile={(f) => readFile(f, (text) => importMembersCSV(text, f.name))}
        onExport={() => {
          downloadCSV("roster.csv", membersToCSV(members));
          addActivityLog({ type: "sync", direction: "push", source: "roster.csv", summary: `${members.length}명의 멤버를 내보냈습니다.`, status: "success" });
        }}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">과제 큐 (Assignment Queue)</p>
        <p className="mt-0.5 text-xs text-slate-500">현재 초안/검안 배정 상태를 CSV로 내보냅니다.</p>
        <button
          onClick={() => {
            downloadCSV("assignments.csv", assignmentsToCSV(assignments));
            addActivityLog({ type: "sync", direction: "push", source: "assignments.csv", summary: `${assignments.length}건의 배정을 내보냈습니다.`, status: "success" });
          }}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
        >
          <Download size={15} /> 과제 큐 CSV 다운로드
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">동기화 로그</p>
          <button
            onClick={resetToMockData}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-rose-600"
          >
            <RotateCcw size={12} /> 목업 데이터로 초기화
          </button>
        </div>
        {activityLog.length === 0 && <p className="text-xs text-slate-400">아직 동기화 기록이 없습니다.</p>}
        <div className="space-y-2">
          {activityLog.filter(log => log.type === "sync").map((log) => (
            <div key={log.id} className="flex items-start gap-2 text-xs">
              {log.direction === "pull" ? (
                <ArrowDownToLine size={13} className="mt-0.5 shrink-0 text-indigo-500" />
              ) : (
                <ArrowUpFromLine size={13} className="mt-0.5 shrink-0 text-slate-400" />
              )}
              <div>
                <p className={log.status === "error" ? "text-rose-600" : "text-slate-600"}>{log.summary}</p>
                <p className="text-[10px] text-slate-400">
                  {new Date(log.timestamp).toLocaleString("ko-KR")} · {log.source}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {busy && <p className="text-center text-xs text-slate-400">동기화 중…</p>}
    </div>
  );
}
