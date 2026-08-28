"use client";

import { useState } from "react";
import { CalendarDays, RotateCcw } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { formatShortDate, isoDateFromToday } from "@/lib/dates";

export default function DateSimulator() {
  const simulatedToday = useDashboardStore((s) => s.simulatedToday);
  const setSimulatedToday = useDashboardStore((s) => s.setSimulatedToday);
  const [open, setOpen] = useState(false);

  const realToday = isoDateFromToday();
  const effectiveDate = simulatedToday ?? realToday;
  const isSimulated = simulatedToday !== null && simulatedToday !== realToday;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          isSimulated ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        <CalendarDays size={13} />
        {isSimulated ? `시뮬레이션 ${formatShortDate(effectiveDate)}` : `오늘 ${formatShortDate(effectiveDate)}`}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-1.5 text-[11px] font-medium text-slate-400">날짜 시뮬레이션</p>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setSimulatedToday(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <p className="mt-1.5 text-[11px] text-slate-400">
            D-1 공지·오늘 시간표·기본 주차가 이 날짜 기준으로 바뀝니다.
          </p>
          {isSimulated && (
            <button
              onClick={() => {
                setSimulatedToday(null);
                setOpen(false);
              }}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-600"
            >
              <RotateCcw size={12} /> 실제 오늘로 복귀
            </button>
          )}
        </div>
      )}
    </div>
  );
}
