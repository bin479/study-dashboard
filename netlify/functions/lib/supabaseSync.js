// 파싱된 강의 목록(draftName/proofName 포함)을 Supabase lectures/assignments
// 테이블에 반영한다. netlify/functions/sheet-sync.js(Apps Script 웹훅)와
// sheet-sync-scheduled.js(주기적 폴링) 양쪽에서 공용으로 쓴다.

const { createClient } = require("@supabase/supabase-js");

async function syncLecturesToSupabase(incoming) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.");
  }
  if (!Array.isArray(incoming) || incoming.length === 0) {
    throw new Error("lectures 배열이 비어 있습니다.");
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: members, error: membersError } = await supabase.from("members").select("id, name");
  if (membersError) throw new Error(`members 조회 실패: ${membersError.message}`);
  const idByName = new Map(members.map((m) => [m.name, m.id]));

  const lectureRows = incoming.map((l) => ({
    id: l.id,
    date: l.date,
    period: l.period,
    order: l.order,
    subject: l.subject,
    topic: l.topic ?? null,
    professor: l.professor ?? null,
    subjectType: l.subjectType,
    durationHours: l.durationHours,
    entryType: l.entryType,
    assignable: !!l.assignable,
    startTime: l.startTime ?? null,
    endTime: l.endTime ?? null,
    sessionNumber: l.sessionNumber ?? null,
  }));

  const assignmentRows = incoming
    .filter((l) => l.assignable)
    .map((l) => ({
      id: `asg_${l.id}`,
      lectureId: l.id,
      draftMemberId: l.draftName ? idByName.get(l.draftName) ?? null : null,
      proofMemberId: l.proofName ? idByName.get(l.proofName) ?? null : null,
    }));

  // 강의를 DB에서 모두 조회하여 변경된(또는 새로운) 행만 골라낸다
  const { data: existingLectures } = await supabase.from("lectures").select("id, date, period, order, subject, topic, professor, subjectType, durationHours, entryType, assignable, startTime, endTime, sessionNumber, status, note");
  const existingLecturesMap = new Map((existingLectures || []).map(l => [l.id, l]));

  const lecturesToUpsert = lectureRows.filter(l => {
    const ex = existingLecturesMap.get(l.id);
    if (!ex) return true;
    for (const key of Object.keys(l)) {
      if (l[key] !== ex[key]) return true;
    }
    return false;
  });

  if (lecturesToUpsert.length > 0) {
    const { error: lectureUpsertError } = await supabase.from("lectures").upsert(lecturesToUpsert, { onConflict: "id" });
    if (lectureUpsertError) throw new Error(`lectures upsert 실패: ${lectureUpsertError.message}`);
  }

  // 배정도 변경된 행만 골라낸다
  const { data: existingAssignments } = await supabase.from("assignments").select("id, draftMemberId, proofMemberId");
  const existingAssignmentsMap = new Map((existingAssignments || []).map(a => [a.id, a]));

  const assignmentsToUpsert = assignmentRows.filter(a => {
    const ex = existingAssignmentsMap.get(a.id);
    if (!ex) return true;
    return a.draftMemberId !== ex.draftMemberId || a.proofMemberId !== ex.proofMemberId;
  });

  for (let i = 0; i < assignmentsToUpsert.length; i += 500) {
    const chunk = assignmentsToUpsert.slice(i, i + 500);
    const { error } = await supabase.from("assignments").upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`assignments upsert 실패: ${error.message}`);
  }

  // 시트에서 사라진 강의(수업 삭제/개편된 경우) 처리 -> assignments도 FK
  // on delete cascade로 같이 지워진다.
  const incomingIds = new Set(lectureRows.map((r) => r.id));
  const staleIds = (existingLectures || []).map((r) => r.id).filter((id) => !incomingIds.has(id));
  if (staleIds.length > 0) {
    await supabase.from("lectures").delete().in("id", staleIds);
  }

  return { lectures: lectureRows.length, assignments: assignmentRows.length, removed: staleIds.length };
}

module.exports = { syncLecturesToSupabase };
