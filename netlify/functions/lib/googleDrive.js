// 구글 서비스 계정으로 (뷰어 권한만 있는) 드라이브 파일의 원본 바이트를 내려받는다.
// 파일이 진짜 구글시트가 아니라 업로드된 xlsx 그대로라도(호환 모드) 동작한다 —
// Drive API의 alt=media는 저장된 원본 바이트를 그대로 스트리밍해줄 뿐,
// 별도 변환이 필요 없기 때문이다.

const { JWT } = require("google-auth-library");

async function downloadXlsx(fileId) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다.");
  if (!fileId) throw new Error("GOOGLE_DRIVE_FILE_ID 환경변수가 설정되지 않았습니다.");

  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY가 올바른 JSON이 아닙니다.");
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
