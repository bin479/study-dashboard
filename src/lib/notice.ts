import { Assignment, Lecture, Member } from "./types";
import { formatDateWithWeekday } from "./dates";

function memberName(members: Member[], id: string | null): string {
  if (!id) return "미배정";
  return members.find((m) => m.id === id)?.name ?? "미배정";
}

/** "09:00"~"11:00" → "오전 9-11시" (분 단위 시각을 12시간제 시간대 라벨로 변환) */
function formatTimeRange(startTime?: string, endTime?: string): string | null {
  if (!startTime || !endTime) return null;
  const startHour = Number(startTime.split(":")[0]);
  const endHour = Number(endTime.split(":")[0]);
  if (Number.isNaN(startHour) || Number.isNaN(endHour)) return null;
  const period = startHour < 12 ? "오전" : "오후";
  const to12 = (h: number) => (h % 12 === 0 ? 12 : h % 12);
  return `${period} ${to12(startHour)}-${to12(endHour)}시`;
}

export interface D1NoticeLine {
  lecture: Lecture;
  assignments: Assignment[];
  pairs: { draftName: string; proofName: string }[];
  timeLabel: string;
}

export function buildD1NoticeLines(
  lectures: Lecture[],
  assignments: Assignment[],
  members: Member[],
  targetDate: string
): D1NoticeLine[] {
  return lectures
    .filter((l) => l.date === targetDate && l.status !== "cancelled" && l.status !== "shifted")
    .sort((a, b) => a.order - b.order)
    .map((lecture) => {
      const lectureAssignments = assignments.filter((a) => a.lectureId === lecture.id);
      return {
        lecture,
        assignments: lectureAssignments,
        pairs:
          lectureAssignments.length > 0
            ? lectureAssignments.map((a) => ({
                draftName: memberName(members, a.draftMemberId),
                proofName: memberName(members, a.proofMemberId),
              }))
            : [{ draftName: "미배정", proofName: "미배정" }],
        timeLabel: formatTimeRange(lecture.startTime, lecture.endTime) ?? lecture.period,
      };
    });
}

export interface NoticeRoomSettings {
  draftRoom: string;
  proofRoom: string;
}

export function generateD1NoticeText(
  lectures: Lecture[],
  assignments: Assignment[],
  members: Member[],
  targetDate: string,
  rooms: NoticeRoomSettings
): string {
  const lines = buildD1NoticeLines(lectures, assignments, members, targetDate);
  const header = `📍${formatDateWithWeekday(targetDate)} 학습부 작성 안내드립니다.📍`;

  const body = lines
    .map((l) => {
      const statusTag =
        l.lecture.status === "shortened" ? " (단축)" : l.lecture.status === "extended" ? " (연장)" : "";
      const sessionTag = l.lecture.sessionNumber ? ` ${l.lecture.sessionNumber}번` : "";
      const title = `[${l.timeLabel}] ${l.lecture.subject}${sessionTag} 학습부${statusTag}`;
      const pairLines = l.pairs.map((p) => `초안: ${p.draftName}\n검안: ${p.proofName}`).join("\n");
      return `${title}\n${pairLines}`;
    })
    .join("\n\n");

  const footer = `초안기한: ${formatDateWithWeekday(targetDate, 1)} 오전 9시 (${rooms.draftRoom}으로)\n검안기한: 초안 업로드 이후 48시간 (${rooms.proofRoom}으로)\n\n※ 시간표를 변경하면 꼭 구글 스프레드 시트에 반영해주세요!`;

  if (lines.length === 0) {
    return `${header}\n\n배정된 강의가 없습니다.\n\n${footer}`;
  }
  return `${header}\n\n${body}\n\n${footer}`;
}

