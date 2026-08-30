import React, { useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { Download, X } from "lucide-react";
import { WallpaperRenderer } from "./WallpaperRenderer";
import { useDashboardStore } from "@/lib/store";

interface Props {
  onClose: () => void;
  weeks: any[];
}

export default function WallpaperModal({ onClose, weeks }: Props) {
  const lectures = useDashboardStore((s) => s.lectures);
  const assignments = useDashboardStore((s) => s.assignments);
  const members = useDashboardStore((s) => s.members);

  const [deviceModel, setDeviceModel] = useState("phone_standard");
  const [tabletLayout, setTabletLayout] = useState<"1col" | "2col">("2col");
  const [weeksCount, setWeeksCount] = useState(1);
  const [startWeekIndex, setStartWeekIndex] = useState(0);
  const [hideAssignees, setHideAssignees] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const wallpaperRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!wallpaperRef.current) return;
    try {
      setIsExporting(true);
      // Wait for layout
      await new Promise((r) => setTimeout(r, 100));
      const dataUrl = await toJpeg(wallpaperRef.current, {
        quality: 0.95,
        backgroundColor: "#f8fafc",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `시간표_배경화면.jpg`;
      a.click();
    } catch (e) {
      console.error(e);
      alert("배경화면 생성 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  const isTablet = deviceModel.startsWith("tablet_");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="text-lg font-bold text-slate-800">배경화면 다운로드</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">기기 모델</label>
            <select
              value={deviceModel}
              onChange={(e) => setDeviceModel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <optgroup label="스마트폰">
                <option value="phone_standard">일반 스마트폰 (19.5:9)</option>
                <option value="phone_flip">Galaxy Z Flip (22:9)</option>
                <option value="phone_fold_out">Galaxy Z Fold 외부 (23.1:9)</option>
              </optgroup>
              <optgroup label="태블릿 (가로 모드)">
                <option value="tablet_ipad">iPad (4:3)</option>
                <option value="tablet_galaxy">Galaxy Tab (16:10)</option>
                <option value="tablet_fold_in">Galaxy Z Fold 내부 (1.2:1)</option>
              </optgroup>
            </select>
          </div>

          {isTablet && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">태블릿 레이아웃</label>
              <select
                value={tabletLayout}
                onChange={(e) => setTabletLayout(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="1col">1단 배치 (세로형)</option>
                <option value="2col">2단 배치 (가로형)</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">시작 주차</label>
              <select
                value={startWeekIndex}
                onChange={(e) => setStartWeekIndex(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {weeks.map((w, i) => (
                  <option key={w.monday} value={i}>{w.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">표시할 주차 수</label>
              <select
                value={weeksCount}
                onChange={(e) => setWeeksCount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value={1}>1주</option>
                <option value={2}>2주</option>
                <option value={3}>3주</option>
                <option value={4}>4주</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="hideAssignees"
              checked={hideAssignees}
              onChange={(e) => setHideAssignees(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="hideAssignees" className="text-sm font-semibold text-slate-700 select-none">
              초안자/검안자 제외하고 과목명 크게 보기
            </label>
          </div>
        </div>

        <div className="border-t border-slate-100 p-4">
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
          >
            {isExporting ? "이미지 생성 중..." : <><Download size={18} /> 고해상도 이미지 저장</>}
          </button>
        </div>
      </div>

      {/* Off-screen renderer */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
        <WallpaperRenderer
          ref={wallpaperRef}
          lectures={lectures}
          assignments={assignments}
          members={members}
          deviceModel={deviceModel}
          tabletLayout={tabletLayout}
          weeksCount={weeksCount}
          startWeekIndex={startWeekIndex}
          allWeeks={weeks}
          hideAssignees={hideAssignees}
        />
      </div>
    </div>
  );
}
