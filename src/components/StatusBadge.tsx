import { LectureStatus, SubmissionStatus } from "@/lib/types";

type Status = SubmissionStatus | LectureStatus;

const STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600 ring-slate-300",
  submitted: "bg-emerald-50 text-emerald-700 ring-emerald-300",
  delayed: "bg-rose-50 text-rose-700 ring-rose-300",
  shifted: "bg-amber-50 text-amber-700 ring-amber-300",
  scheduled: "bg-slate-100 text-slate-600 ring-slate-300",
  shortened: "bg-amber-50 text-amber-700 ring-amber-300",
  extended: "bg-indigo-50 text-indigo-700 ring-indigo-300",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-300",
  unassigned: "bg-slate-200 text-slate-500 ring-slate-300",
  postponed: "bg-rose-50 text-rose-700 ring-rose-300",
};

const LABELS: Record<string, string> = {
  pending: "대기",
  submitted: "제출완료",
  delayed: "지연",
  shifted: "이동됨",
  scheduled: "예정",
  shortened: "단축",
  extended: "연장",
  cancelled: "휴강",
  unassigned: "미배정",
  postponed: "연기",
};

export default function StatusBadge({ status, className = "" }: { status: Status; className?: string }) {
  const style = STYLES[status] ?? "bg-slate-100 text-slate-600 ring-slate-300";
  const label = LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style} ${className}`}
    >
      {label}
    </span>
  );
}
