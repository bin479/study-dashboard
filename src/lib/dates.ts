/**
 * 날짜 유틸 — 모두 **로컬 시각** 기준이다.
 *
 * `Date.toISOString()`은 UTC로 변환하므로 한국(UTC+9)에서 오전 9시 이전에는
 * 하루 전 날짜가 나온다. D-1 공지는 바로 그 시간대에 보내는 일이 많아
 * "내일"이 "오늘"로 밀리는 문제가 있었다. 그래서 여기서는 항상 로컬 필드로 조립한다.
 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** Date -> "YYYY-MM-DD" (로컬 기준) */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 오늘로부터 offsetDays 만큼 떨어진 날짜의 "YYYY-MM-DD" (로컬 기준).
 * `base`를 주면 실제 오늘 대신 그 날짜를 기준으로 계산한다 — 날짜 시뮬레이션(store의
 * simulatedToday)에서 "다른 날짜였다면 어떻게 보일지" 미리 볼 때 쓴다.
 */
export function isoDateFromToday(offsetDays = 0, base?: string | null): string {
  const date = base ? parseISODate(base) : new Date();
  date.setDate(date.getDate() + offsetDays);
  return toLocalISODate(date);
}

/** "YYYY-MM-DD"를 로컬 자정 Date로 파싱한다 (UTC 해석 방지). */
export function parseISODate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/** "2026-08-31" -> "8/31 월요일" */
export function formatDateWithWeekday(dateStr: string, offsetDays = 0): string {
  const date = parseISODate(dateStr);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAYS[date.getDay()]}요일`;
}

/** "2026-08-31" -> "08/31" */
export function formatMMDD(dateStr: string): string {
  const date = parseISODate(dateStr);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

/** "2026-08-31" -> "8/31" */
export function formatShortDate(dateStr: string): string {
  const date = parseISODate(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** "2026-08-31" -> "8/31 (월)" */
export function formatDayLabel(dateStr: string): string {
  const date = parseISODate(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()} (${WEEKDAYS[date.getDay()]})`;
}

/** 해당 날짜가 속한 주의 월요일 (로컬 기준) */
export function mondayOf(dateStr: string): string {
  const date = parseISODate(dateStr);
  const offset = (date.getDay() + 6) % 7; // 월요일 = 0
  date.setDate(date.getDate() - offset);
  return toLocalISODate(date);
}
