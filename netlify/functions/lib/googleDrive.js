// êµ¬ê? ?œë¹„??ê³„ì •?¼ë¡œ (ë·°ì–´ ê¶Œí•œë§??ˆëŠ”) ?œë¼?´ë¸Œ ?Œì¼???ë³¸ ë°”ì´?¸ë? ?´ë ¤ë°›ëŠ”??
// ?Œì¼??ì§„ì§œ êµ¬ê??œíŠ¸ê°€ ?„ë‹ˆ???…ë¡œ?œëœ xlsx ê·¸ë?ë¡œë¼???¸í™˜ ëª¨ë“œ) ?™ì‘?œë‹¤ ??// Drive API??alt=media???€?¥ëœ ?ë³¸ ë°”ì´?¸ë? ê·¸ë?ë¡??¤íŠ¸ë¦¬ë°?´ì¤„ ë¿?
// ë³„ë„ ë³€?˜ì´ ?„ìš” ?†ê¸° ?Œë¬¸?´ë‹¤.

const { JWT } = require("google-auth-library");

async function downloadXlsx(fileId) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY ?˜ê²½ë³€?˜ê? ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??");
  if (!fileId) throw new Error("GOOGLE_DRIVE_FILE_ID ?˜ê²½ë³€?˜ê? ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??");

  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEYê°€ ?¬ë°”ë¥?JSON???„ë‹™?ˆë‹¤.");
  }

  const client = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const res = await client.request({
    url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    responseType: "arraybuffer",
  });

  return Buffer.from(res.data);
}

module.exports = { downloadXlsx };


