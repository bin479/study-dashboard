// êµ¬ê? ?œíŠ¸ê°€ xlsx ?¸í™˜ ëª¨ë“œ??Apps Scriptë¥?ëª?ë¶™ì´??ê²½ìš°ë¥??„í•œ ?€????// Netlifyê°€ ?¼ì • ì£¼ê¸°ë¡????¨ìˆ˜ë¥?ì§ì ‘ ?¸ì¶œ?œë‹¤(?¤ì?ì¤„ì? netlify.toml ì°¸ê³ ).
// ?œë¹„??ê³„ì •?¼ë¡œ ?Œì¼???´ë ¤ë°›ì•„ ?Œì‹±?˜ê³  Supabase??ë°˜ì˜?œë‹¤.
//
// ?„ìš”???˜ê²½ë³€??(Netlify ?¬ì´???¤ì • > Environment variables):
//   GOOGLE_SERVICE_ACCOUNT_KEY ??êµ¬ê? ?´ë¼?°ë“œ?ì„œ ë°œê¸‰ë°›ì? ?œë¹„??ê³„ì • JSON ???„ì²´ë¥?ê·¸ë?ë¡?ë¶™ì—¬?£ê¸°
//   GOOGLE_DRIVE_FILE_ID       ???œíŠ¸ URL??/d/ ?€ /edit ?¬ì´??ê¸?ë¬¸ìž??//   SUPABASE_URL               (NEXT_PUBLIC_SUPABASE_URLê³??™ì¼??ê°?
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase ?„ë¡œ?íŠ¸ ?¤ì • > API > service_role)
//
// ì¤€ë¹„ë¬¼: êµ¬ê? ?´ë¼?°ë“œ ì½˜ì†”?ì„œ ?œë¹„??ê³„ì •??ë§Œë“¤ê³? ê·??œë¹„??ê³„ì • ?´ë©”??// (xxx@xxx.iam.gserviceaccount.com)???œíŠ¸ ê³µìœ  ?¤ì •??"ë·°ì–´"ë¡?ì¶”ê??´ì•¼ ?œë‹¤.

const { downloadXlsx } = require("./lib/googleDrive");
const { parseWorkbook, buildPayload } = require("./lib/parseWorkbook");
const { syncLecturesToSupabase } = require("./lib/supabaseSync");

exports.handler = async () => {
  try {
    const buffer = await downloadXlsx('1QTkt93EVt3DFDoNwY4DqSHCOZADAEb28');
    const records = parseWorkbook(buffer);
    const payload = buildPayload(records);
    const result = await syncLecturesToSupabase(payload);
    console.log("sheet-sync-scheduled ?±ê³µ:", result);
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (e) {
    console.error("sheet-sync-scheduled ?¤íŒ¨:", e);
    return { statusCode: 500, body: e.message || String(e) };
  }
};

