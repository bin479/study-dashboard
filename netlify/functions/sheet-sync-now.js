// ?€?œë³´?œì˜ "ì§€ê¸??™ê¸°?? ë²„íŠ¼???¸ì¶œ?˜ëŠ” ?”ë“œ?¬ì¸?? sheet-sync-scheduled.js?€
// ?„ì „???™ì¼??ë¡œì§(?œë¹„??ê³„ì •?¼ë¡œ xlsx ?¤ìš´ë¡œë“œ ???Œì‹± ??Supabase ë°˜ì˜)??// ì¦‰ì‹œ, ?”ì²­ë°›ì? ?œì ??1???¤í–‰?œë‹¤. 5ë¶?ì£¼ê¸° ?ë™ ?™ê¸°?”ëŠ” ê·¸ë?ë¡?ë³„ë„ë¡??ˆë‹¤.

const { downloadXlsx } = require("./lib/googleDrive");
const { parseWorkbook, buildPayload } = require("./lib/parseWorkbook");
const { syncLecturesToSupabase } = require("./lib/supabaseSync");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const buffer = await downloadXlsx('1QTkt93EVt3DFDoNwY4DqSHCOZADAEb28');
    const records = parseWorkbook(buffer);
    const payload = buildPayload(records);
    const result = await syncLecturesToSupabase(payload);
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message || String(e) }) };
  }
};

