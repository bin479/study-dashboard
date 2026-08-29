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
    status: l.shifted ? "shifted" : "scheduled",
  }));

  const assignmentRows = incoming
    .filter((l) => l.assignable)
    .map((l) => ({
      id: `asg_${l.id}`,
      lectureId: l.id,
      draftMemberId: l.draftName ? idByName.get(l.draftName) ?? null : null,
      proofMemberId: l.proofName ? idByName.get(l.proofName) ?? null : null,
    }));

  const { error: lectureUpsertError } = await supabase.from("lectures").upsert(lectureRows, { onConflict: "id" });
  if (lectureUpsertError) throw new Error(`lectures upsert 실패: ${lectureUpsertError.message}`);

  // 배정은 draftMemberId/proofMemberId만 갱신한다 — draftStatus/제출시각/가감점 등
  // 이미 진행 중인 상태는 건드리지 않는다. upsert에 이 두 컬럼만 담아 보내면
  // (PostgREST는 요청 본문에 없는 컬럼은 UPDATE 시 건드리지 않는다) 기존 행을
  // 안전하게 갱신하면서도, 없던 배정은 스키마의 컬럼 기본값으로 새로 생긴다.
  // 강의별로 select 후 update/insert하던 이전 방식은 283건 기준 500번 넘는
  // 순차 요청이 되어 Netlify 함수 실행 제한(10초)을 넘겨 504가 났었다.
  for (let i = 0; i < assignmentRows.length; i += 500) {
    const chunk = assignmentRows.slice(i, i + 500);
    const { error } = await supabase.from("assignments").upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`assignments upsert 실패: ${error.message}`);
  }

  // 시트에서 사라진 강의(수업이 삭제/재편된 경우) 정리 — assignments는 FK
  // on delete cascade로 같이 지워진다.
  const incomingIds = new Set(lectureRows.map((r) => r.id));
  const { data: existingLectures } = await supabase.from("lectures").select("id");
  const staleIds = (existingLectures ?? []).map((r) => r.id).filter((id) => !incomingIds.has(id));
  if (staleIds.length > 0) {
    await supabase.from("lectures").delete().in("id", staleIds);
  }

  return { lectures: lectureRows.length, assignments: assignmentRows.length, removed: staleIds.length };
}

module.exports = { syncLecturesToSupabase };
