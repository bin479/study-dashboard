import { Assignment, Lecture } from "./types";
import { STUDY_GROUPS } from "./studyGroups";
export type ScheduleActionType = "reduce" | "merge_next" | "extend" | "cancel" | "unassign" | "restore";

export interface ScheduleActionResult {
  lectures: Lecture[];
  assignments: Assignment[];
  changes: string[];
}

function sortKey(l: Lecture): string {
  return `${l.date}__${String(l.order).padStart(3, "0")}`;
}

function calcEndTime(startTime: string | undefined, durationHours: number): string | undefined {
  if (!startTime) return undefined;
  const [h, m] = startTime.split(":").map(Number);
  const totalMinutes = h * 60 + m + durationHours * 60;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function findNextLectureSameSubject(
  lectures: Lecture[],
  current: Lecture,
  excludeIds: Set<string>
): Lecture | undefined {
  return lectures
    .filter(
      (l) =>
        l.subject === current.subject &&
        l.id !== current.id &&
        !excludeIds.has(l.id) &&
        l.status !== "cancelled" &&
        l.status !== "unassigned" &&
        l.status !== "shifted" &&
        sortKey(l) > sortKey(current)
    )
    .sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1))[0];
}

function findImmediateNextLecture(lectures: Lecture[], current: Lecture): Lecture | undefined {
  return lectures
    .filter(
      (l) =>
        l.id !== current.id &&
        l.status !== "cancelled" &&
        l.status !== "unassigned" &&
        l.status !== "shifted" &&
        sortKey(l) > sortKey(current)
    )
    .sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1))[0];
}

/**
 * Pure function computing the resulting lectures/assignments for a schedule
 * disruption action. Used for both the before/after preview and the commit.
 */
export function applyScheduleAction(
  lectures: Lecture[],
  assignments: Assignment[],
  lectureId: string,
  action: ScheduleActionType
): ScheduleActionResult {
  const changes: string[] = [];
  const nextLectures = lectures.map((l) => ({ ...l }));
  const nextAssignments = assignments.map((a) => ({ ...a }));

  const lecture = nextLectures.find((l) => l.id === lectureId);
  if (!lecture) return { lectures: nextLectures, assignments: nextAssignments, changes };

  // 1. 단순 시간 단축 (배정조 유지, 점수만 삭감)
  if (action === "reduce") {
    if (lecture.durationHours <= 1) {
      changes.push(`⚠ 1시간 수업은 더 이상 단축할 수 없습니다. 대신 [미배정]이나 모달 밖에서 [휴강] 처리를 이용해 주세요.`);
      return { lectures: nextLectures, assignments: nextAssignments, changes };
    }
    const originalDuration = lecture.originalDurationHours ?? lecture.durationHours;
    lecture.originalDurationHours = originalDuration;
    lecture.durationHours = lecture.durationHours - 1;
    lecture.endTime = calcEndTime(lecture.startTime, lecture.durationHours);
    lecture.status = "shortened";
    changes.push(
      `${lecture.period} ${lecture.subject}: ${originalDuration}h → ${lecture.durationHours}h (단축)`
    );
  }

  // 2. 휴강 및 연강 병합 후 단축 (배정조 롤오버 및 연쇄 이동 발생)
  if (action === "cancel" || action === "unassign" || action === "merge_next") {
    const pending = nextAssignments.filter(
      (a) => a.lectureId === lectureId && a.draftStatus === "pending" && a.proofStatus === "pending"
    );

    const sourceGroup = STUDY_GROUPS.find(g => g.subjects.includes(lecture.subject));
    let futureLectures: Lecture[] = [];

    if (sourceGroup) {
      const groupLectures = nextLectures
        .filter((l) => sourceGroup.subjects.includes(l.subject) && l.id !== lecture.id && l.status !== "cancelled" && l.status !== "unassigned" && l.status !== "shifted" && sortKey(l) > sortKey(lecture))
        .sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1));
      
      const fallbackLectures = nextLectures
        .filter((l) => l.subject === "임상표현2" && l.id !== lecture.id && l.status !== "cancelled" && l.status !== "unassigned" && l.status !== "shifted" && sortKey(l) > sortKey(lecture) && !groupLectures.some(gl => gl.id === l.id))
        .sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1));

      futureLectures = [...groupLectures, ...fallbackLectures];
    } else {
      futureLectures = nextLectures
        .filter((l) => l.subject === lecture.subject && l.id !== lecture.id && l.status !== "cancelled" && l.status !== "unassigned" && l.status !== "shifted" && sortKey(l) > sortKey(lecture))
        .sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1));
    }

    if (action === "cancel") {
      lecture.status = "cancelled";
      changes.push(`${lecture.period} ${lecture.subject}: 휴강 처리`);
    } else if (action === "unassign") {
      lecture.status = "unassigned";
      changes.push(`${lecture.period} ${lecture.subject}: 배정 제외 (미배정)`);
    } else if (action === "merge_next") {
      // 다음 수업 병합
      if (futureLectures.length > 0) {
        const target = futureLectures[0];
        target.status = "shifted"; // 다음 강의는 흡수됨
        target.note = `${lecture.period}로 병합됨`;
        
        const originalDuration = lecture.originalDurationHours ?? lecture.durationHours;
        lecture.originalDurationHours = originalDuration;
        // 병합되었으므로 제목을 7~8번 등으로 변경 (중복 방지)
        const session1 = lecture.sessionNumber ? `${lecture.sessionNumber}` : "";
        const session2 = target.sessionNumber ? `${target.sessionNumber}` : "";
        if (session1 && session2) {
          const sessions = session1.split("~");
          if (!sessions.includes(session2)) {
            lecture.originalSessionNumber = lecture.originalSessionNumber ?? lecture.sessionNumber;
            lecture.sessionNumber = `${session1}~${session2}`;
          }
        }
        
        // Topic도 병합된 이름으로 변경 (중복 방지)
        const sourceTopic = lecture.topic && lecture.topic !== lecture.subject ? lecture.topic : lecture.subject;
        const targetTopic = target.topic && target.topic !== target.subject ? target.topic : target.subject;
        if (!sourceTopic.includes(targetTopic)) {
          lecture.originalTopic = lecture.originalTopic ?? lecture.topic;
          lecture.topic = `${sourceTopic} & ${targetTopic}`;
        }
        
        changes.push(`${lecture.period} ${lecture.subject}: 다음 강의(${target.period}) 흡수 및 단축 완료`);
      } else {
        changes.push(`⚠ 병합할 다음 강의를 찾지 못했습니다.`);
      }
    }

    if (futureLectures.length > 0) {
      let cascadeCount = 0;
      for (let i = futureLectures.length - 2; i >= 0; i--) {
        const sourceLecture = futureLectures[i];
        const targetLecture = futureLectures[i + 1];

        // Find all assignments for the source lecture
        const sourceAssignments = nextAssignments.filter(
          (a) => a.lectureId === sourceLecture.id
        );

        // Delete all assignments for the target lecture (only on the last shift, as previous shifts overwrite)
        if (i === futureLectures.length - 2) {
          const targetExisting = nextAssignments.filter(
            (a) => a.lectureId === targetLecture.id
          );
          targetExisting.forEach(a => {
            const idx = nextAssignments.findIndex(x => x.id === a.id);
            if (idx > -1) nextAssignments.splice(idx, 1);
          });
        }

        if (sourceAssignments.length > 0) {
          sourceAssignments.forEach((a) => {
            a.shiftedFromLectureId = sourceLecture.id;
            a.lectureId = targetLecture.id;
            a.draftStatus = "shifted";
            a.proofStatus = "shifted";
          });
          cascadeCount++;
        }
      }

      if (action === "merge_next" && futureLectures.length === 1) {
        const absorbedAssignments = nextAssignments.filter(
          (a) => a.lectureId === futureLectures[0].id
        );
        absorbedAssignments.forEach((a) => {
          a.draftMemberId = null;
          a.proofMemberId = null;
          a.draftStatus = "pending";
          a.proofStatus = "pending";
        });
        if (absorbedAssignments.length > 0) {
          changes.push(`흡수된 강의의 기존 배정조는 다음 배정 강의가 없어 미배정 처리되었습니다.`);
        }
      }

      const target = futureLectures[0];
      if (action === "cancel" || action === "unassign") {
        const pending = nextAssignments.filter(
          (a) => a.lectureId === lectureId && a.draftStatus === "pending" && a.proofStatus === "pending"
        );
        if (pending.length > 0) {
          pending.forEach((a) => {
            a.shiftedFromLectureId = lecture.id;
            a.lectureId = target.id;
            a.draftStatus = "shifted";
            a.proofStatus = "shifted";
          });
          changes.push(`해당 수업 배정조(${pending.length}팀)가 연쇄적으로 다음 배정으로 밀렸습니다. (총 ${cascadeCount + 1}팀 변동)`);
        } else if (cascadeCount > 0) {
          changes.push(`연쇄 이동: 뒤이어 오는 ${cascadeCount}개 강의의 배정조가 한 칸씩 뒤로 밀려났습니다.`);
        }
      } else if (action === "merge_next") {
        changes.push(`병합된 다음 강의(${target.period})의 기존 배정조부터 한 칸씩 밀려납니다.`);
        if (cascadeCount > 0) {
          changes.push(`연쇄 이동: 뒤이어 오는 ${cascadeCount}개 강의의 배정조가 한 칸씩 뒤로 밀려났습니다.`);
        }
      }
    } else {
      if (action === "cancel" || action === "unassign") {
        const pending = nextAssignments.filter(
          (a) => a.lectureId === lectureId && a.draftStatus === "pending" && a.proofStatus === "pending"
        );
        if (pending.length > 0) {
          pending.forEach((a) => {
            a.draftMemberId = null;
            a.proofMemberId = null;
          });
          changes.push(`해당 수업 배정조(${pending.length}팀)의 다음 배정 강의가 없어 미배정 처리되었습니다.`);
        }
      }
    }
  }

  if (action === "extend") {
    const originalDuration = lecture.originalDurationHours ?? lecture.durationHours;
    lecture.originalDurationHours = originalDuration;
    lecture.durationHours = lecture.durationHours + 1;
    lecture.endTime = calcEndTime(lecture.startTime, lecture.durationHours);
    lecture.status = "extended";
    changes.push(
      `${lecture.period} ${lecture.subject}: ${originalDuration}h → ${lecture.durationHours}h (연장)`
    );
    // extend does NOT cascade assignments. The lecture simply becomes longer, but keeps the same team.
  }

  if (action === "restore") {
    const wasCancelledOrUnassignedOrShifted = lecture.status === "cancelled" || lecture.status === "unassigned" || lecture.status === "shifted";

    lecture.status = "scheduled";
    lecture.note = "";
    if (lecture.originalDurationHours !== undefined) {
      lecture.durationHours = lecture.originalDurationHours;
      lecture.endTime = calcEndTime(lecture.startTime, lecture.durationHours);
      lecture.originalDurationHours = undefined;
    }
    if (lecture.originalSessionNumber !== undefined) {
      lecture.sessionNumber = lecture.originalSessionNumber;
      lecture.originalSessionNumber = undefined;
    }
    if (lecture.originalTopic !== undefined) {
      lecture.topic = lecture.originalTopic;
      lecture.originalTopic = undefined;
    }
    
    changes.push(`${lecture.period} ${lecture.subject}: 처리 철회 및 일정 복구 완료`);

    if (wasCancelledOrUnassignedOrShifted) {
      const sourceGroup = STUDY_GROUPS.find(g => g.subjects.includes(lecture.subject));
      let futureLectures: Lecture[] = [];

      if (sourceGroup) {
        const groupLectures = nextLectures
          .filter((l) => sourceGroup.subjects.includes(l.subject) && l.id !== lecture.id && l.status !== "cancelled" && l.status !== "unassigned" && l.status !== "shifted" && sortKey(l) > sortKey(lecture))
          .sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1));
        
        const fallbackLectures = nextLectures
          .filter((l) => l.subject === "임상표현2" && l.id !== lecture.id && l.status !== "cancelled" && l.status !== "unassigned" && l.status !== "shifted" && sortKey(l) > sortKey(lecture) && !groupLectures.some(gl => gl.id === l.id))
          .sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1));

        futureLectures = [...groupLectures, ...fallbackLectures];
      } else {
        futureLectures = nextLectures
          .filter((l) => l.subject === lecture.subject && l.id !== lecture.id && l.status !== "cancelled" && l.status !== "unassigned" && l.status !== "shifted" && sortKey(l) > sortKey(lecture))
          .sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1));
      }

      if (futureLectures.length > 0) {
      // First, pull from immediate next lecture to the restored lecture
      const nextLecture = futureLectures[0];
      const pulled = nextAssignments.filter(
        (a) => a.lectureId === nextLecture.id
      );
      if (pulled.length > 0) {
        pulled.forEach((a) => {
          a.shiftedFromLectureId = undefined;
          a.lectureId = lecture.id;
          a.draftStatus = "pending";
          a.proofStatus = "pending";
        });
        changes.push(`배정조 당겨오기: ${nextLecture.date} ${nextLecture.period} 배정조가 복구된 ${lecture.period}(으)로 이동`);
      }

      // Then, cascade pull-forward for the rest of the lectures
      let cascadeCount = 0;
      for (let i = 1; i < futureLectures.length; i++) {
        const sourceLecture = futureLectures[i];
        const targetLecture = futureLectures[i - 1];

        const sourceAssignments = nextAssignments.filter(
          (a) => a.lectureId === sourceLecture.id
        );

        if (sourceAssignments.length > 0) {
          sourceAssignments.forEach((a) => {
            a.shiftedFromLectureId = undefined;
            a.lectureId = targetLecture.id;
            a.draftStatus = "pending";
            a.proofStatus = "pending";
          });
          cascadeCount++;
        }
      }
      
      // The very last lecture in futureLectures gave away its assignment, so it needs a new blank one
      const lastFutureLecture = futureLectures[futureLectures.length - 1];
      if (lastFutureLecture.assignable) {
        nextAssignments.push({
          id: `ass_${Math.random().toString(36).slice(2, 9)}`,
          lectureId: lastFutureLecture.id,
          draftMemberId: null,
          proofMemberId: null,
          draftStatus: "pending",
          proofStatus: "pending",
          recordingUploaded: false,
          draftAdjustment: 0,
          proofAdjustment: 0,
          draftAdjustmentReason: "",
          proofAdjustmentReason: "",
          proofAtDraftLevel: false,
          draftSubmittedAt: null,
          proofSubmittedAt: null,
          bonusPoints: 0,
        });
      }

      if (cascadeCount > 0) {
        changes.push(`연쇄 당겨오기: 뒤이어 오는 ${cascadeCount}개 강의의 배정조가 한 칸씩 앞으로 당겨졌습니다.`);
      }
    } else {
      const immediateNext = findImmediateNextLecture(nextLectures, lecture);
      if (immediateNext) {
        changes.push(`⚠ 당겨올 다음 배정조를 찾지 못했습니다.`);
      }
    }
  }
}

  return { lectures: nextLectures, assignments: nextAssignments, changes };
}
