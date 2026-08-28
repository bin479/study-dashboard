import { getSupabase } from "./supabaseClient";

/** 이 브라우저에 유효한 Supabase 세션(익명 포함)이 있으면 재사용하고, 없으면 새로 만든다. */
export async function ensureSession(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data } = await supabase.auth.getSession();
  if (data.session) return true;

  const { error } = await supabase.auth.signInAnonymously();
  return !error;
}

/** 이 멤버가 이미 PIN을 등록했는지 (등록 폼 vs 로그인 폼 분기용). */
export async function isMemberClaimed(memberId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("is_member_claimed", { p_member_id: memberId });
  if (error) return false;
  return Boolean(data);
}

/** 처음 로그인하는 멤버의 PIN을 등록한다. 이미 등록돼 있으면 false. */
export async function claimMember(memberId: string, pin: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;
  await ensureSession();
  const { data, error } = await supabase.rpc("claim_member", { p_member_id: memberId, p_pin: pin });
  if (error) return false;
  return Boolean(data);
}

/** 등록된 PIN과 대조한다. 맞으면 이 브라우저의 익명 세션을 그 멤버로 연결한다. */
export async function verifyMemberPin(memberId: string, pin: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;
  await ensureSession();
  const { data, error } = await supabase.rpc("verify_member_pin", { p_member_id: memberId, p_pin: pin });
  if (error) return false;
  return Boolean(data);
}

export async function signOutSupabase(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}
