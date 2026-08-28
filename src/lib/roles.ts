import { Member, MemberRole, StudyGroup } from "./types";

export const ROLE_LABELS: Record<MemberRole, string> = {
  student: "초안자",
  lead: "그룹장",
  subjectHead: "과목부장",
  admin: "관리자",
};

/** 이 과목의 과목부장 전체를 찾는다 (그룹당 여러 명일 수 있다). */
export function findSubjectHeads(members: Member[], subject: string): Member[] {
  return members.filter((m) => m.role === "subjectHead" && m.subjects?.includes(subject));
}

/** 이 과목을 전담하는 학습부 그룹을 찾는다. */
export function findGroupBySubject(groups: StudyGroup[], subject: string): StudyGroup | undefined {
  return groups.find((g) => g.subjects.includes(subject));
}

/** 이 과목을 전담하는 그룹의 그룹장을 찾는다. */
export function findGroupLeader(
  members: Member[],
  groups: StudyGroup[],
  subject: string
): Member | undefined {
  const group = findGroupBySubject(groups, subject);
  if (!group) return undefined;
  return members.find((m) => m.role === "lead" && m.groupId === group.id);
}

/** 이 과목을 전담하는 그룹의 조원 전체(그룹장 포함) — 자동배정 등에서 사용. */
export function findGroupMembers(members: Member[], groups: StudyGroup[], subject: string): Member[] {
  const group = findGroupBySubject(groups, subject);
  if (!group) return [];
  return members.filter((m) => m.groupId === group.id);
}

/** 총 문항 수를 인원 수만큼 균등 분배한다 (나머지는 마지막 사람에게). */
export function splitQuestionsEvenly(
  total: number,
  memberIds: string[]
): { memberId: string; start: number; end: number }[] {
  if (memberIds.length === 0 || total <= 0) return [];
  const base = Math.floor(total / memberIds.length);
  const remainder = total % memberIds.length;
  let cursor = 1;
  return memberIds.map((memberId, idx) => {
    const count = base + (idx === memberIds.length - 1 ? remainder : 0);
    const start = cursor;
    const end = cursor + count - 1;
    cursor += count;
    return { memberId, start, end };
  });
}
