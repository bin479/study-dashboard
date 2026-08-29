// 대시보드의 "지금 동기화" 버튼이 호출하는 엔드포인트. sheet-sync-scheduled.js와
// 완전히 동일한 로직(서비스 계정으로 xlsx 다운로드 → 파싱 → Supabase 반영)을
// 즉시, 요청받은 시점에 1회 실행한다. 5분 주기 자동 동기화는 그대로 별도로 돈다.

const { downloadXlsx } = require("./lib/googleDrive");
const { parseWorkbook, buildPayload } = require("./lib/parseWorkbook");
const { syncLecturesToSupabase } = require("./lib/supabaseSync");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const buffer = await downloadXlsx(process.env.GOOGLE_DRIVE_FILE_ID);
    const records = parseWorkbook(buffer);
    const payload = buildPayload(records);
    const result = await syncLecturesToSupabase(payload);
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message || String(e) }) };
  }
};
