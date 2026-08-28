import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * 환경변수가 없으면 null을 반환한다 — Supabase 없이도(로컬 mock 시드로) 앱이
 * 그대로 동작해야 하므로, 여기서 에러를 던지지 않는다.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (typeof window !== "undefined") {
      console.warn(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않아 로컬 mock 데이터로 동작합니다."
      );
    }
    client = null;
    return client;
  }

  client = createClient(url, anonKey);
  return client;
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}
