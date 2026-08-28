// 구글 시트가 xlsx 호환 모드라 Apps Script를 못 붙이는 경우를 위한 대안 —
// Netlify가 일정 주기로 이 함수를 직접 호출한다(스케줄은 netlify.toml 참고).
// 서비스 계정으로 파일을 내려받아 파싱하고 Supabase에 반영한다.
//
// 필요한 환경변수 (Netlify 사이트 설정 > Environment variables):
//   GOOGLE_SERVICE_ACCOUNT_KEY — 구글 클라우드에서 발급받은 서비스 계정 JSON 키 전체를 그대로 붙여넣기
//   GOOGLE_DRIVE_FILE_ID       — 시트 URL의 /d/ 와 /edit 사이의 긴 문자열
//   SUPABASE_URL               (NEXT_PUBLIC_SUPABASE_URL과 동일한 값)
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase 프로젝트 설정 > API > service_role)
//
// 준비물: 구글 클라우드 콘솔에서 서비스 계정을 만들고, 그 서비스 계정 이메일
// (xxx@xxx.iam.gserviceaccount.com)을 시트 공유 설정에 "뷰어"로 추가해야 한다.

const { downloadXlsx } = require("./lib/googleDrive");
const { parseWorkbook, buildPayload } = require("./lib/parseWorkbook");
const { syncLecturesToSupabase } = require("./lib/supabaseSync");

exports.handler = async () => {
  try {
    const buffer = await downloadXlsx(process.env.GOOGLE_DRIVE_FILE_ID);
    const records = parseWorkbook(buffer);
    const payload = buildPayload(records);
    const result = await syncLecturesToSupabase(payload);
    console.log("sheet-sync-scheduled 성공:", result);
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (e) {
    console.error("sheet-sync-scheduled 실패:", e);
    return { statusCode: 500, body: e.message || String(e) };
  }
};
