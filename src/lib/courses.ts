import { SubjectType } from "./types";

export interface CourseInfo {
  name: string;
  type: SubjectType;
  credits: number;
  /** 난이도 — 숫자 척도가 아닌 값("P/NP", "new")도 있어 문자열로 둔다. */
  difficulty: string;
}

/**
 * 2026학년도 본과 2학년 2학기 과목 목록.
 * 학점·난이도는 표시용 메타데이터이며, 점수 계산에는 `type`(메이저/마이너)만 쓰인다.
 */
export const COURSES: Record<string, CourseInfo> = {
  혈액종양학: { name: "혈액종양학", type: "major", credits: 3, difficulty: "3" },
  순환기학: { name: "순환기학", type: "major", credits: 3.5, difficulty: "4" },
  호흡기학: { name: "호흡기학", type: "major", credits: 2, difficulty: "5" },
  생식의학: { name: "생식의학", type: "major", credits: 3, difficulty: "3" },
  "알레르기-류마티스학": { name: "알레르기-류마티스학", type: "major", credits: 1.5, difficulty: "4" },
  내분비학: { name: "내분비학", type: "major", credits: 2, difficulty: "3.5" },
  신경계학: { name: "신경계학", type: "major", credits: 3, difficulty: "5" },
  감각계학: { name: "감각계학", type: "major", credits: 3, difficulty: "3" },
  근골격학: { name: "근골격학", type: "major", credits: 2, difficulty: "2" },
  PBL3: { name: "PBL3", type: "minor", credits: 1, difficulty: "P/NP" },
  법의학: { name: "법의학", type: "minor", credits: 1, difficulty: "2" },
  발열: { name: "발열", type: "minor", credits: 1, difficulty: "new" },
  의료정보학: { name: "의료정보학", type: "minor", credits: 1, difficulty: "1" },
  임상표현2: { name: "임상표현2", type: "minor", credits: 1, difficulty: "1" },
  공휴일: { name: "공휴일", type: "minor", credits: 0, difficulty: "-" },
};

export function courseInfo(name: string): CourseInfo | undefined {
  return COURSES[name];
}

export const COURSE_NAMES = Object.keys(COURSES).filter((n) => n !== "공휴일");

/** 메이저/마이너 과목 이름 목록 — 과목부장 배정 UI 등에서 사용. */
export const MAJOR_COURSES = COURSE_NAMES.filter((n) => COURSES[n].type === "major");
export const MINOR_COURSES = COURSE_NAMES.filter((n) => COURSES[n].type === "minor");
