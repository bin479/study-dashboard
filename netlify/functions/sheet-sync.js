// Google Apps Script(구글 시트 웹훅)가 시트가 바뀔 때마다 호출하는 엔드포인트.
// (참고: 원본 파일이 구글시트가 아니라 xlsx 호환 모드로만 열려있으면 Apps Script
// 자체를 못 붙이므로, 그 경우엔 이 파일 대신 sheet-sync-scheduled.js를 쓴다.)
//
// google-apps-script/Code.gs 가 <시간표>+<학습부배정>+<설정> 시트를 파싱해서
// 강의 목록(초안자/검안자 이름 포함)을 이 함수로 POST하면, lib/supabaseSync.js가
// 이름을 members 테이블의 id로 매칭해 Supabase lectures/assignments 테이블에 반영한다.
//
// 필요한 환경변수 (Netlify 사이트 설정 > Environment variables):
//   SUPABASE_URL              (NEXT_PUBLIC_SUPABASE_URL과 동일한 값)
//   SUPABASE_SERVICE_ROLE_KEY (Supabase 프로젝트 설정 > API > service_role — RLS 우회용, 절대 클라이언트에 노출 금지)
//   SHEET_SYNC_SECRET         (직접 정한 임의의 긴 문자열 — Apps Script의 SECRET과 동일해야 함)

const { syncLecturesToSupabase } = require("./lib/supabaseSync");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secret = event.headers["x-sync-secret"] || event.headers["X-Sync-Secret"];
  if (!secret || secret !== process.env.SHEET_SYNC_SECRET) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  try {
    const result = await syncLecturesToSupabase(payload.lectures);
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (e) {
    return { statusCode: 500, body: e.message || String(e) };
  }
};
