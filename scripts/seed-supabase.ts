/**
 * 최초 1회, Supabase 스키마(schema.sql)를 적용한 뒤 실행해서 목업 데이터
 * (실제 학사 시간표 + 106명 명단 + 그룹 배정)를 DB에 채워넣는다.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-supabase.ts
 *
 * anon key가 아니라 service role key를 써야 한다 (RLS를 우회해서 대량 삽입).
 * service role key는 Supabase 대시보드 > Project Settings > API에 있고,
 * 서버 밖으로(git, 클라이언트 코드) 절대 나가면 안 된다 — 이 스크립트에서만 로컬로 쓴다.
 */
import { createClient } from "@supabase/supabase-js";
import { generateAssignments, generateExamChecklist, generateLectures, generateMockMembers, generateRestorationItems } from "../src/lib/mockData";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const members = generateMockMembers();
  const lectures = generateLectures();
  const assignments = generateAssignments(lectures, members);
  const restorationItems = generateRestorationItems();
  const examChecklist = generateExamChecklist();

  const steps: [string, unknown[]][] = [
    ["members", members],
    ["lectures", lectures],
    ["assignments", assignments],
    ["restoration_items", restorationItems],
    ["exam_checklist", examChecklist],
  ];

  for (const [table, rows] of steps) {
    if (rows.length === 0) {
      console.log(`- ${table}: 0건, 건너뜀`);
      continue;
    }
    // Postgrest 요청 크기 제한을 피하려고 500개씩 나눠서 보낸다.
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from(table).upsert(chunk);
      if (error) {
        console.error(`✗ ${table} (${i}~${i + chunk.length}): ${error.message}`);
        process.exit(1);
      }
    }
    console.log(`✓ ${table}: ${rows.length}건`);
  }

  console.log("\n완료. 앱을 새로고침하면 이 데이터로 시작합니다.");
}

main();
