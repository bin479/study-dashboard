export type SubjectType = "major" | "minor";

export type LectureStatus =
  | "scheduled"
  | "shortened"
  | "extended"
  | "cancelled"
  | "unassigned"
  | "postponed"
  | "shifted";

/** 강의(학습부 대상) / 평가(총괄평가·피드백 등) / 공휴일 */
export type LectureEntryType = "lecture" | "exam" | "holiday";

export interface Lecture {
  id: string;
  date: string; // ISO date, YYYY-MM-DD
  period: string; // e.g. "1교시", "2~3교시"
  order: number; // sort order within the day
  subject: string; // 과목 블록명, 예: "혈액종양학"
  topic?: string; // 개별 강의 제목, 예: "종양의 이해"
  professor: string;
  subjectType: SubjectType;
  durationHours: number;
  status: LectureStatus;
  entryType: LectureEntryType;
  assignable: boolean; // 평가·공휴일은 false — 초안/검안 배정 제외
  originalDurationHours?: number;
  note?: string;
  startTime?: string; // "HH:MM" 24h
  endTime?: string; // "HH:MM" 24h
  sessionNumber?: string; // 과목별 학습부 회차 번호, 예: "24"
  originalSessionNumber?: string;
  originalTopic?: string;
  actualDurationMin?: number; // 실제 진행 시간(분) — 그룹장/과목부장이 직접 입력
}

export type MemberRole = "student" | "lead" | "subjectHead" | "admin";

export interface Member {
  id: string;
  studentId?: string; // 학번
  name: string;
  role: MemberRole;
  cohort?: string;
  active: boolean;
  subjects?: string[]; // subjects this member is 과목부장 for
  groupId?: string; // 소속 학습부 그룹 (StudyGroup.id)
}

/** 학습부 그룹 — 특정 과목들을 전담하는 조. 그룹장은 Member.role === "lead" && groupId 로 찾는다. */
export interface StudyGroup {
  id: string;
  name: string; // "그룹1"
  color: string; // 배지 색상
  subjects: string[]; // 이 그룹이 전담하는 과목 블록명
}

export type SubmissionStatus = "pending" | "submitted" | "delayed" | "shifted";

export interface ExtraBonus {
  id: string;
  amount: number;
  reason: string;
}

export interface MemberExtraScore {
  id: string;
  memberId: string;
  amount: number;
  reason: string;
  date: string; // ISO date YYYY-MM-DD
}

export interface Assignment {
  id: string;
  lectureId: string;
  draftMemberId: string | null;
  proofMemberId: string | null;
  draftStatus: SubmissionStatus;
  proofStatus: SubmissionStatus;
  draftSubmittedAt: string | null; // ISO datetime
  proofSubmittedAt: string | null; // ISO datetime
  recordingUploaded: boolean;
  bonusPoints: number;
  shiftedFromLectureId?: string;
  draftAdjustment: number; // 과목부장이 매기는 초안 가감점
  draftAdjustmentReason: string;
  proofAdjustment: number; // 그룹장이 매기는 검안 가감점
  proofAdjustmentReason: string;
  proofAtDraftLevel: boolean; // 검안자가 초안 쓴 수준이면 초안 스코어링 적용
  extraBonusesDraft?: ExtraBonus[];
  extraBonusesProof?: ExtraBonus[];
  draftOverrideScore?: number | null; // 그룹장이 수동으로 입력한 초안 확정 점수
  proofOverrideScore?: number | null; // 그룹장이 수동으로 입력한 검안 확정 점수
  draftScorePublished?: boolean; // 그룹장이 초안 채점 내역을 초안자에게 공개했는지
  proofScorePublished?: boolean; // 그룹장이 검안 채점 내역을 검안자에게 공개했는지
  overrideDraftDaysLate?: number | null; // 수동으로 지정한 초안 지연 일수
  overrideProofDaysLate?: number | null; // 수동으로 지정한 검안 지연 일수
}

export interface RestorationItem {
  id: string;
  subject: string;
  collectorMemberId: string | null; // 수합자
  explainerMemberIds: string[]; // 해설자 (여러 명 가능)
  questionRangeStart: number;
  questionRangeEnd: number;
  totalQuestions: number;
  missingCount: number;
  validExplanations: number;
  submittedAt: string | null;
  dueAt: string | null;
  collectionBonus: number; // 그룹장이 매기는 수합 가점
  collectionBonusReason: string;
  explanationBonusManual?: number; // 퀵 수정을 위한 수동 가감점
  explanationAdjustmentReason: string;
  rewriteRequested: boolean;
  rewriteCompleted: boolean;
}

export interface ExamChecklistItem {
  id: string;
  role: "subjectHead" | "groupLeader";
  label: string;
  done: boolean;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  type: "sync" | "evaluation" | "system";
  direction?: "pull" | "push"; // For sync logs
  source?: string;
  summary: string;
  status: "success" | "error" | "info";
  groupId?: string; // For evaluation logs
}

export interface SavedRestorationState {
  id: string;
  savedAt: string; // ISO datetime
  memo: string; // User input memo/subject
  items: RestorationItem[];
}
