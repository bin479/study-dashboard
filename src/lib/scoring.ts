import { Assignment, Lecture, RestorationItem, SubjectType } from "./types";

export const SCORING_RULES = {
  draftPerHour: { major: 4, minor: 2 }, // 2hr major = 8pts, 2hr minor = 4pts
  proofFlat: { major: 5, minor: 2.5 },
  proofDeadlineHours: 48,
  proofLatePenaltyPerDay: -0.5,
  restorationMissingPenaltyPerItem: -1,
  restorationMissingPenaltyCap: -10,
  restorationExplanationBonus: 1,
  rewritePenalty: -3,
  bonusMin: 0.5,
  bonusMax: 6,
  bonusStep: 0.5,
  earlyEndBonusOptions: [4, 5, 6],
  minorQualityBonus: 1.5,
} as const;

export function getExamDateForSubject(subject: string, lectures: Lecture[]): string {
    let targetDate = new Date().toISOString().split("T")[0];
    const subjectLectures = lectures.filter(l => l.subject === subject);
    
    if (subject === "PBL") {
       if (subjectLectures.length > 0) {
           targetDate = subjectLectures.reduce((max, l) => l.date > max ? l.date : max, subjectLectures[0].date);
       }
    } else {
       const examLecture = subjectLectures.find(l => 
           l.entryType === "exam" || l.topic?.includes("총괄평가") || l.topic?.includes("평가")
       );
       if (examLecture) {
           targetDate = examLecture.date;
       } else if (subjectLectures.length > 0) {
           targetDate = subjectLectures.reduce((max, l) => l.date > max ? l.date : max, subjectLectures[0].date);
       }
    }
    return targetDate;
}

export function draftBasePoints(subjectType: SubjectType, durationHours: number): number {
  return SCORING_RULES.draftPerHour[subjectType] * durationHours;
}

export function proofBasePoints(
  subjectType: SubjectType,
  durationHours: number,
  atDraftLevel: boolean
): number {
  if (atDraftLevel) return draftBasePoints(subjectType, durationHours);
  
  if (subjectType === "major") {
    return durationHours === 1 ? 3 : 5;
  } else {
    return durationHours === 1 ? 1.5 : 2.5;
  }
}

/** 
 * 체크리스트 기반 점수 산정 룰 (2시간 메이저 조기 종료)
 */
export const CHECKLIST_TIERS_2HR_MAJOR = [
  { id: "2hr_major_normal", draft: 8, proof: 5, reason: "밀도 정상(8점)", description: "일반적인 2시간 분량의 메이저 수업. 밀도가 정상적이거나 수업 시간이 꽉 차게 진행된 경우 선택합니다." },
  { id: "2hr_major_new_short", draft: 6, proof: 4, reason: "신규 작성 & 적은 양(6점)", description: "전년도 기출이나 기존 자료가 없어서 처음부터 새로 작성해야 했지만, 절대적인 수업 분량이나 시간이 적었던 경우 선택합니다." },
  { id: "2hr_major_simple", draft: 4, proof: 2.5, reason: "단순 수정(4점)", description: "전년도 자료와 거의 유사하여 단순 수정 위주로 작업이 이루어진 경우 선택합니다." },
  { id: "2hr_major_past", draft: 2, proof: 1, reason: "기출 추가(2점)", description: "수업 내용의 변동 없이 단순히 기출문제만 몇 개 추가하는 정도로 작업이 마무리된 경우 선택합니다." },
] as const;

/** 
 * 체크리스트 기반 점수 산정 룰 (1시간 메이저 수업)
 */
export const CHECKLIST_TIERS_1HR_MAJOR = [
  { id: "1hr_major_normal", draft: 4, proof: 3, reason: "일반/단순 분량(4점)", description: "일반적인 1시간 수업이거나 내용이 단순하여 작업량이 많지 않았던 경우 선택합니다." },
  { id: "1hr_major_high_density", draft: 6, proof: 4, reason: "풀타임 고밀도(6점)", description: "1시간 수업이지만 휴식 없이 풀타임으로 꽉 채워 진행되었고, 밀도가 매우 높아 작업량이 2시간 수업과 맞먹는 경우 선택합니다." },
] as const;

/**
 * 체크리스트 기반 점수 산정 룰 (2시간 마이너 수업)
 */
export const CHECKLIST_TIERS_2HR_MINOR = [
  { id: "2hr_minor_normal", draft: 4, proof: 2.5, reason: "마이너 2시간 기본(4점)", description: "PBL, 세미나 등 일반적인 마이너 2시간 과목의 기본 배점입니다." },
] as const;

/**
 * 체크리스트 기반 점수 산정 룰 (1시간 마이너 수업)
 */
export const CHECKLIST_TIERS_1HR_MINOR = [
  { id: "1hr_minor_normal", draft: 2, proof: 1.5, reason: "마이너 1시간 기본(2점)", description: "PBL, 세미나 등 일반적인 마이너 1시간 과목의 기본 배점입니다." },
] as const;

/**
 * 수업의 타입(메이저/마이너)과 배정 시간(1시간/2시간)을 기반으로 해당 수업에 적용될 수 있는 티어 목록을 반환합니다.
 */
export function getAvailableTiers(subjectType: SubjectType, durationHours: number) {
  if (subjectType === "minor") {
    return durationHours === 1 ? CHECKLIST_TIERS_1HR_MINOR : CHECKLIST_TIERS_2HR_MINOR;
  } else {
    return durationHours === 1 ? CHECKLIST_TIERS_1HR_MAJOR : CHECKLIST_TIERS_2HR_MAJOR;
  }
}

/**
 * 수업의 타입과 배정 시간을 기반으로 "기본적으로 선택될(예상되는)" 디폴트 티어를 반환합니다.
 */
export function getDefaultTier(subjectType: SubjectType, durationHours: number) {
  const tiers = getAvailableTiers(subjectType, durationHours);
  return tiers[0];
}

/** Draft deadline: lecture date, next day 09:00 local. */
export function draftDeadline(lecture: Lecture): Date {
  const d = new Date(`${lecture.date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function proofDeadline(draftSubmittedAt: string): Date {
  const d = new Date(draftSubmittedAt);
  d.setHours(d.getHours() + SCORING_RULES.proofDeadlineHours);
  return d;
}

function daysLate(deadline: Date, submittedAt: Date): number {
  const diffMs = submittedAt.getTime() - deadline.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** Exponential penalty: day1 -1, day2 -2, day3 -4 ... cumulative = -(2^n - 1) */
export function draftLatePenalty(lecture: Lecture, submittedAt: Date | null): number {
  if (!submittedAt) return 0;
  const late = daysLate(draftDeadline(lecture), submittedAt);
  if (late <= 0) return 0;
  return -(Math.pow(2, late) - 1);
}

export function proofLatePenalty(draftSubmittedAt: string | null, proofSubmittedAt: Date | null): number {
  if (!draftSubmittedAt || !proofSubmittedAt) return 0;
  const late = daysLate(proofDeadline(draftSubmittedAt), proofSubmittedAt);
  if (late <= 0) return 0;
  return late * SCORING_RULES.proofLatePenaltyPerDay;
}

export interface AssignmentScoreBreakdown {
  draftBase: number;
  draftPenalty: number;
  draftAdjustment: number;
  proofBase: number;
  proofPenalty: number;
  proofAdjustment: number;
  bonus: number;
  extraBonusesDraftTotal: number;
  extraBonusesProofTotal: number;
  total: number;
  draftTotal: number;
  proofTotal: number;
  draftDaysLate: number;
  proofDaysLate: number;
}

export function scoreAssignment(lecture: Lecture, assignment: Assignment): AssignmentScoreBreakdown {
  const draftSubmitted = assignment.draftSubmittedAt ? new Date(assignment.draftSubmittedAt) : null;
  const proofSubmitted = assignment.proofSubmittedAt ? new Date(assignment.proofSubmittedAt) : null;

  // Base points are only earned once the work is actually submitted — a
  // pending/shifted assignment has no submission yet, so it scores 0.
  let draftBase = draftSubmitted ? draftBasePoints(lecture.subjectType, lecture.durationHours) : 0;
  let proofBase = proofSubmitted
    ? proofBasePoints(lecture.subjectType, lecture.durationHours, assignment.proofAtDraftLevel)
    : 0;

  if (assignment.draftOverrideScore != null) {
    draftBase = assignment.draftOverrideScore;
  }
  if (assignment.proofOverrideScore != null) {
    proofBase = assignment.proofOverrideScore;
  }

  const draftDeadlineDate = draftDeadline(lecture);
  let draftDaysLate = draftSubmitted ? Math.max(0, Math.ceil((draftSubmitted.getTime() - draftDeadlineDate.getTime()) / 86400000)) : 0;
  if (assignment.overrideDraftDaysLate != null) {
    draftDaysLate = assignment.overrideDraftDaysLate;
  }
  let proofDaysLate =
    assignment.draftSubmittedAt && proofSubmitted
      ? Math.max(0, Math.ceil((proofSubmitted.getTime() - proofDeadline(assignment.draftSubmittedAt).getTime()) / 86400000))
      : 0;
  if (assignment.overrideProofDaysLate != null) {
    proofDaysLate = assignment.overrideProofDaysLate;
  }

  const draftPenalty = draftSubmitted && draftDaysLate > 0 ? -(Math.pow(2, draftDaysLate) - 1) : 0;
  const proofPenalty = proofSubmitted && proofDaysLate > 0 ? proofDaysLate * SCORING_RULES.proofLatePenaltyPerDay : 0;

  const bonus = assignment.bonusPoints || 0;
  const draftAdjustment = assignment.draftAdjustment || 0;
  const proofAdjustment = assignment.proofAdjustment || 0;
  
  const extraBonusesDraftTotal = (assignment.extraBonusesDraft || []).reduce((sum, b) => sum + b.amount, 0);
  const extraBonusesProofTotal = (assignment.extraBonusesProof || []).reduce((sum, b) => sum + b.amount, 0);

  const draftTotal = draftBase + draftPenalty + draftAdjustment + extraBonusesDraftTotal;
  const proofTotal = proofBase + proofPenalty + proofAdjustment + bonus + extraBonusesProofTotal;
  const total = draftTotal + proofTotal;

  return {
    draftBase,
    draftPenalty,
    draftAdjustment,
    proofBase,
    proofPenalty,
    proofAdjustment,
    bonus,
    extraBonusesDraftTotal,
    extraBonusesProofTotal,
    draftTotal,
    proofTotal,
    total,
    draftDaysLate,
    proofDaysLate,
  };
}

export function restorationPenalty(missingCount: number): number {
  const raw = missingCount * SCORING_RULES.restorationMissingPenaltyPerItem;
  return Math.max(SCORING_RULES.restorationMissingPenaltyCap, raw);
}

export interface RestorationScoreBreakdown {
  missingPenalty: number;
  explanationBonus: number;
  collectionBonus: number;
  rewritePenalty: number;
  total: number;
}

export function scoreRestoration(item: RestorationItem): RestorationScoreBreakdown {
  const missingPenalty = restorationPenalty(item.missingCount);
  const explanationBonus = (item.validExplanations * SCORING_RULES.restorationExplanationBonus) + (item.explanationBonusManual || 0);
  const collectionBonus = item.collectionBonus || 0;
  const rewritePenalty = item.rewriteRequested && !item.rewriteCompleted ? SCORING_RULES.rewritePenalty : 0;
  return {
    missingPenalty,
    explanationBonus,
    collectionBonus,
    rewritePenalty,
    total: missingPenalty + explanationBonus + collectionBonus + rewritePenalty,
  };
}
