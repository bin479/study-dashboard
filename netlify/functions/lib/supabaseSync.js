// ?Œì‹±??ê°•ì˜ ëª©ë¡(draftName/proofName ?¬í•¨)??Supabase lectures/assignments
// ?Œì´ë¸”ì— ë°˜ì˜?œë‹¤. netlify/functions/sheet-sync.js(Apps Script ?¹í›…)?€
// sheet-sync-scheduled.js(ì£¼ê¸°???´ë§) ?‘ìª½?ì„œ ê³µìš©?¼ë¡œ ?´ë‹¤.

const { createClient } = require("@supabase/supabase-js");

async function syncLecturesToSupabase(incoming) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ?˜ê²½ë³€?˜ê? ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??");
  }
  if (!Array.isArray(incoming) || incoming.length === 0) {
    throw new Error("lectures ë°°ì—´??ë¹„ì–´ ?ˆìŠµ?ˆë‹¤.");
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: members, error: membersError } = await supabase.from("members").select("id, name");
  if (membersError) throw new Error(`members ì¡°íšŒ ?¤íŒ¨: ${membersError.message}`);
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
    note: l.note ?? null,
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
  if (lectureUpsertError) throw new Error(`lectures upsert ?¤íŒ¨: ${lectureUpsertError.message}`);

  // ë°°ì •?€ draftMemberId/proofMemberIdë§?ê°±ì‹ ?œë‹¤ ??draftStatus/?œì¶œ?œê°/ê°€ê°ì  ??  // ?´ë? ì§„í–‰ ì¤‘ì¸ ?íƒœ??ê±´ë“œë¦¬ì? ?ŠëŠ”?? upsert??????ì»¬ëŸ¼ë§??´ì•„ ë³´ë‚´ë©?  // (PostgREST???”ì²­ ë³¸ë¬¸???†ëŠ” ì»¬ëŸ¼?€ UPDATE ??ê±´ë“œë¦¬ì? ?ŠëŠ”?? ê¸°ì¡´ ?‰ì„
  // ?ˆì „?˜ê²Œ ê°±ì‹ ?˜ë©´?œë„, ?†ë˜ ë°°ì •?€ ?¤í‚¤ë§ˆì˜ ì»¬ëŸ¼ ê¸°ë³¸ê°’ìœ¼ë¡??ˆë¡œ ?ê¸´??
  // ê°•ì˜ë³„ë¡œ select ??update/insert?˜ë˜ ?´ì „ ë°©ì‹?€ 283ê±?ê¸°ì? 500ë²??˜ëŠ”
  // ?œì°¨ ?”ì²­???˜ì–´ Netlify ?¨ìˆ˜ ?¤í–‰ ?œí•œ(10ì´????˜ê²¨ 504ê°€ ?¬ì—ˆ??
  for (let i = 0; i < assignmentRows.length; i += 500) {
    const chunk = assignmentRows.slice(i, i + 500);
    const { error } = await supabase.from("assignments").upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`assignments upsert ?¤íŒ¨: ${error.message}`);
  }

  // ?œíŠ¸?ì„œ ?¬ë¼ì§?ê°•ì˜(?˜ì—…???? œ/?¬í¸??ê²½ìš°) ?•ë¦¬ ??assignments??FK
  // on delete cascadeë¡?ê°™ì´ ì§€?Œì§„??
  const incomingIds = new Set(lectureRows.map((r) => r.id));
  const { data: existingLectures } = await supabase.from("lectures").select("id");
  const staleIds = (existingLectures ?? []).map((r) => r.id).filter((id) => !incomingIds.has(id));
  if (staleIds.length > 0) {
    await supabase.from("lectures").delete().in("id", staleIds);
  }

  return { lectures: lectureRows.length, assignments: assignmentRows.length, removed: staleIds.length };
}

module.exports = { syncLecturesToSupabase };


