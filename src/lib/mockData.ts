import { Assignment, ExamChecklistItem, Lecture, Member, RestorationItem } from "./types";
import { TIMETABLE_LECTURES } from "./timetableData";
import { REAL_ROSTER } from "./rosterData";
import { REAL_ASSIGNMENTS } from "./assignmentData";
import { GROUP_LEADER_NAMES, GROUP_SUBJECT_HEAD_NAMES, STUDY_GROUPS } from "./studyGroups";

/**
 * 실제 학습부원 명단(106명, 학번 기준)에 5개 그룹 배정을 적용한다.
 * 이름으로 매칭하므로, 로스터에 없는 이름은 조용히 건너뛴다.
 * 그룹장은 role: "lead", 그 아래 인원은 전원 role: "subjectHead"이며
 * 담당 과목은 소속 그룹이 전담하는 과목 전체다.
 */
import { GROUP_DRAFT_SEQUENCES } from "./sequences";

export function getMemberGroupId(name: string): string | undefined {
  const leaderOf = Object.entries(GROUP_LEADER_NAMES).find(([_, n]) => n === name);
  if (leaderOf) return leaderOf[0];

  const shGroup = Object.entries(GROUP_SUBJECT_HEAD_NAMES).find(([_, names]) => names.includes(name));
  if (shGroup) return shGroup[0];

  const seqGroup = Object.entries(GROUP_DRAFT_SEQUENCES).find(([_, names]) => 
    names.map(n => n.replace(/\(\d+\)/g, '').trim()).includes(name)
  );
  if (seqGroup) return seqGroup[0];

  return undefined;
}

export function generateMockMembers(): Member[] {
  const subjectsByGroup = new Map(STUDY_GROUPS.map((g) => [g.id, g.subjects]));
  const leaderByName = new Map(Object.entries(GROUP_LEADER_NAMES).map(([g, name]) => [name, g]));
  const subjectHeadGroupByName = new Map<string, string>();
  Object.entries(GROUP_SUBJECT_HEAD_NAMES).forEach(([groupId, names]) => {
    names.forEach((name) => subjectHeadGroupByName.set(name, groupId));
  });

  const memberGroupByName = new Map<string, string>();
  Object.entries(GROUP_DRAFT_SEQUENCES).forEach(([groupId, names]) => {
    names.forEach((name) => {
      const cleanName = name.replace(/\(\d+\)/g, '').trim();
      if (!memberGroupByName.has(cleanName)) {
        memberGroupByName.set(cleanName, groupId);
      }
    });
  });

  return REAL_ROSTER.map((m, i) => {
    const leaderOf = leaderByName.get(m.name);
    if (leaderOf) {
      return { id: `mem_${i}`, ...m, role: "lead" as const, groupId: leaderOf };
    }
    const subjectHeadGroup = subjectHeadGroupByName.get(m.name);
    if (subjectHeadGroup) {
      return {
        id: `mem_${i}`,
        ...m,
        role: "subjectHead" as const,
        groupId: subjectHeadGroup,
        subjects: subjectsByGroup.get(subjectHeadGroup) ?? [],
      };
    }
    const sequenceGroup = memberGroupByName.get(m.name);
    if (sequenceGroup) {
      return { id: `mem_${i}`, ...m, groupId: sequenceGroup };
    }
    return { id: `mem_${i}`, ...m };
  });
}

/**
 * 실제 학사 시간표(2026학년도 2학기)를 강의 목록으로 변환한다.
 * id는 date+order에서 결정적으로 만든다(같은 date+order가 2개면 _2를 붙임 —
 * 학습부 분할 강의) — 구글 시트 웹훅 동기화가 매번 같은 id로 upsert할 수 있어야
 * 새 강의가 생기는 게 아니라 기존 강의가 갱신되기 때문이다. Apps Script 쪽
 * (google-apps-script/Code.gs)도 반드시 같은 규칙으로 id를 만들어야 한다.
 */
export function generateLectures(): Lecture[] {
  const seen = new Map<string, number>();
  return TIMETABLE_LECTURES.map((seed) => {
    const key = `${seed.date}_${seed.order}`;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    const base = `lec_${seed.date.replace(/-/g, "")}_${seed.order}`;
    return {
      ...seed,
      id: occurrence === 1 ? base : `${base}_${occurrence}`,
      status: "scheduled" as const,
    };
  });
}

/**
 * 배정 대상 강의마다 배정을 만든다. <학습부배정> 시트에 실제 초안자/검안자가
 * 있으면 이름으로 매칭해 채우고, 없으면 비워 둔다(시간표 화면에서 직접/자동 배정).
 */
export function generateAssignments(lectures: Lecture[], members: Member[]): Assignment[] {
  const idByName = new Map(members.map((m) => [m.name, m.id]));
  // 학습부 분할 강의(팀 2개)는 같은 date+order로 pair가 2개 이어서 나오므로,
  // 같은 키를 가진 강의들이 timetableData.ts에 등장하는 순서대로 하나씩 소비한다.
  const realByKey = new Map<string, typeof REAL_ASSIGNMENTS>();
  REAL_ASSIGNMENTS.forEach((r) => {
    const key = `${r.date}_${r.order}`;
    const arr = realByKey.get(key) ?? [];
    arr.push(r);
    realByKey.set(key, arr);
  });

  return lectures
    .filter((lecture) => lecture.assignable)
    .map((lecture) => {
      const arr = realByKey.get(`${lecture.date}_${lecture.order}`);
      const real = arr?.shift();
      const draftMemberId = real ? idByName.get(real.draftName) ?? null : null;
      const proofMemberId = real ? idByName.get(real.proofName) ?? null : null;
      return {
        id: `asg_${lecture.id}`,
        lectureId: lecture.id,
        draftMemberId,
        proofMemberId,
        draftStatus: "pending" as const,
        proofStatus: "pending" as const,
        draftSubmittedAt: null,
        proofSubmittedAt: null,
        recordingUploaded: false,
        bonusPoints: 0,
        draftAdjustment: 0,
        draftAdjustmentReason: "",
        proofAdjustment: 0,
        proofAdjustmentReason: "",
        proofAtDraftLevel: false,
      };
    });
}

export function generateRestorationItems(): RestorationItem[] {
  return [];
}

export function generateExamChecklist(): ExamChecklistItem[] {
  return [
    { id: "chk_sh_1", role: "subjectHead", label: "학습부장/그룹장으로부터 구글 폼 권한 인계", done: false },
    { id: "chk_sh_2", role: "subjectHead", label: "구글 폼 제출 문제·선지를 복원 한글(HWP) 양식으로 이관", done: false },
    { id: "chk_sh_3", role: "subjectHead", label: "문제 및 선지 문맥 다듬기 (단순 복붙 지양, 2~3일 내 완료)", done: false },
    { id: "chk_sh_4", role: "subjectHead", label: "복원 불량/미제출 인원 학번, 이름, 사유 체크 및 보고", done: false },
    { id: "chk_sh_5", role: "subjectHead", label: "정제된 과목별 복원 파일 그룹장에게 최종 제출", done: false },

    { id: "chk_gl_1", role: "groupLeader", label: "복원 명단 확인 및 복원수합방 개설 (과목부장 초대)", done: false },
    { id: "chk_gl_2", role: "groupLeader", label: "전체 문제 수 비례하여 과목부장들에게 1/n 균등 배정", done: false },
    { id: "chk_gl_3", role: "groupLeader", label: "과목부장 보고 명단 기반 복원 감점 규정 적용 및 검토", done: false },
    { id: "chk_gl_4", role: "groupLeader", label: "해설자 모집 및 해설방 개설 (인당 5~8문제 배정)", done: false },
    { id: "chk_gl_5", role: "groupLeader", label: "해설 품질 검토 및 미흡 시 재작성 요청 (불응 시 -3점)", done: false },
    { id: "chk_gl_6", role: "groupLeader", label: "단일 파일 병합 후 PDF/HWP 드라이브 업로드", done: false },
    { id: "chk_gl_7", role: "groupLeader", label: "복원/해설 스코어링 종합 계산 및 시트 최종 기입", done: false },
  ];
}
