import { StudyGroup } from "./types";

/** 5개 학습부 그룹과 각 그룹이 전담하는 과목. */
export const STUDY_GROUPS: StudyGroup[] = [
  { id: "g1", name: "그룹1", color: "#ef4444", subjects: ["혈액종양학", "신경계학"] },
  { id: "g2", name: "그룹2", color: "#f97316", subjects: ["순환기학", "임상표현2"] },
  { id: "g3", name: "그룹3", color: "#eab308", subjects: ["호흡기학", "내분비학", "법의학", "의료정보학"] },
  { id: "g4", name: "그룹4", color: "#22c55e", subjects: ["생식의학", "근골격학", "발열"] },
  { id: "g5", name: "그룹5", color: "#3b82f6", subjects: ["알레르기-류마티스학", "감각계학", "PBL3"] },
];

/** 그룹장 (이름으로 매칭 — 로스터에 학번이 없어 이름 기준). */
export const GROUP_LEADER_NAMES: Record<string, string> = {
  g1: "김미현",
  g2: "고겸은",
  g3: "김성수",
  g4: "홍재영",
  g5: "성민수",
};

/**
 * 그룹별 과목부장 (그룹장 아래, 그룹장 제외) — role: "subjectHead", 담당 과목은
 * 그 그룹의 subjects 전체. "조원"이 아니라 전원 과목부장이다.
 */
export const GROUP_SUBJECT_HEAD_NAMES: Record<string, string[]> = {
  g1: ["오철민", "임유진", "서정우", "박강희", "강현성", "고승우", "전혜인", "성지민", "박주용"],
  g2: ["김수빈", "서지우", "김민준", "김선우", "김건아", "최희정", "노상우", "강지윤"],
  g3: ["한현구", "권홍록", "안현서", "이아름", "김전일", "오상우", "안성민", "박지영"],
  g4: ["기원우", "허승훈", "박정연", "박상완", "김치준", "조기상", "김나예", "정윤영"],
  g5: ["한유진", "고재연", "강동현", "이장규", "국서원", "최창우", "김지연", "서희태"],
};
