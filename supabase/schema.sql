-- 학습부 스터디 대시보드 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 한 번 실행하면 됩니다.
--
-- 컬럼명은 앱 코드(src/lib/types.ts)의 camelCase 필드명과 그대로 맞췄습니다
-- (Postgres에서 대소문자를 보존하려면 큰따옴표로 감싸야 함) — 그래야 클라이언트
-- 코드에서 별도 변환 없이 객체를 그대로 upsert할 수 있습니다.

create extension if not exists pgcrypto;

-- ── members ────────────────────────────────────────────────────────────────
create table if not exists members (
  id text primary key,
  "studentId" text,
  name text not null,
  role text not null default 'student',
  cohort text,
  active boolean not null default true,
  subjects text[],
  "groupId" text
);

-- 이름+PIN 로그인용. pinHash는 절대 클라이언트에 직접 노출하지 않고
-- 아래 RPC 함수(claim_member / verify_member_pin)로만 검증한다.
create table if not exists member_claims (
  "memberId" text primary key references members(id) on delete cascade,
  "pinHash" text,
  "claimedByAuthUid" uuid
);

-- ── lectures ───────────────────────────────────────────────────────────────
create table if not exists lectures (
  id text primary key,
  date date not null,
  period text not null,
  "order" int not null,
  subject text not null,
  topic text,
  professor text,
  "subjectType" text not null default 'major',
  "durationHours" numeric not null default 1,
  status text not null default 'scheduled',
  "entryType" text not null default 'lecture',
  assignable boolean not null default true,
  "originalDurationHours" numeric,
  note text,
  "startTime" text,
  "endTime" text,
  "sessionNumber" text,
  "actualDurationMin" numeric
);

-- ── assignments ────────────────────────────────────────────────────────────
create table if not exists assignments (
  id text primary key,
  "lectureId" text references lectures(id) on delete cascade,
  "draftMemberId" text references members(id),
  "proofMemberId" text references members(id),
  "draftStatus" text not null default 'pending',
  "proofStatus" text not null default 'pending',
  "draftSubmittedAt" timestamptz,
  "proofSubmittedAt" timestamptz,
  "recordingUploaded" boolean not null default false,
  "bonusPoints" numeric not null default 0,
  "shiftedFromLectureId" text,
  "draftAdjustment" numeric not null default 0,
  "draftAdjustmentReason" text not null default '',
  "proofAdjustment" numeric not null default 0,
  "proofAdjustmentReason" text not null default '',
  "proofAtDraftLevel" boolean not null default false
);

-- ── restoration_items ──────────────────────────────────────────────────────
create table if not exists restoration_items (
  id text primary key,
  "lectureId" text references lectures(id) on delete cascade,
  "collectorMemberId" text references members(id),
  "explainerMemberId" text references members(id),
  "questionRangeStart" int,
  "questionRangeEnd" int,
  "totalQuestions" int,
  "missingCount" int not null default 0,
  "validExplanations" int not null default 0,
  "submittedAt" timestamptz,
  "dueAt" timestamptz,
  "collectionBonus" numeric not null default 0,
  "collectionBonusReason" text not null default '',
  "explanationAdjustmentReason" text not null default '',
  "rewriteRequested" boolean not null default false,
  "rewriteCompleted" boolean not null default false
);

-- ── exam_checklist ─────────────────────────────────────────────────────────
create table if not exists exam_checklist (
  id text primary key,
  role text not null default 'subjectHead',
  label text not null,
  done boolean not null default false
);

-- ── app_settings (단일 행, 팀 전체 공유 설정) ─────────────────────────────────
create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  "draftRoom" text not null default '그룹2 톡방',
  "proofRoom" text not null default '과목부장 톡방'
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

-- ── RLS ────────────────────────────────────────────────────────────────────
-- 읽기는 전체 공개(로그인 전에도 시간표를 볼 수 있어야 함).
-- 쓰기는 인증된 세션만 — 익명 로그인(anonymous sign-in)도 authenticated로
-- 취급되므로, "이름+PIN 클레임"을 마친 사람만 쓸 수 있다.
-- member_claims는 별도 정책이 없어 기본적으로 완전히 비공개이며,
-- 아래 SECURITY DEFINER 함수를 통해서만 접근된다.

alter table members enable row level security;
alter table lectures enable row level security;
alter table assignments enable row level security;
alter table restoration_items enable row level security;
alter table exam_checklist enable row level security;
alter table app_settings enable row level security;
alter table member_claims enable row level security;

create policy "public read" on members for select using (true);
create policy "auth write" on members for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "public read" on lectures for select using (true);
create policy "auth write" on lectures for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "public read" on assignments for select using (true);
create policy "auth write" on assignments for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "public read" on restoration_items for select using (true);
create policy "auth write" on restoration_items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "public read" on exam_checklist for select using (true);
create policy "auth write" on exam_checklist for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "public read" on app_settings for select using (true);
create policy "auth write" on app_settings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- member_claims: 의도적으로 select/insert/update 정책을 만들지 않는다 (완전 비공개).

-- ── PIN 인증 RPC (SECURITY DEFINER — pinHash를 클라이언트에 노출하지 않고 검증) ──

create or replace function is_member_claimed(p_member_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from member_claims
    where "memberId" = p_member_id and "pinHash" is not null
  );
$$;

create or replace function claim_member(p_member_id text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  existing text;
begin
  select "pinHash" into existing from member_claims where "memberId" = p_member_id;
  if existing is not null then
    return false; -- 이미 등록됨 — verify_member_pin을 써야 함
  end if;
  insert into member_claims ("memberId", "pinHash", "claimedByAuthUid")
  -- pgcrypto가 어느 스키마에 설치되었든 찾을 수 있도록 extensions 추가
  values (p_member_id, crypt(p_pin, gen_salt('bf')), auth.uid())
  on conflict ("memberId") do update
    set "pinHash" = excluded."pinHash", "claimedByAuthUid" = excluded."claimedByAuthUid"
    where member_claims."pinHash" is null;
  return true;
end;
$$;

create or replace function verify_member_pin(p_member_id text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored text;
begin
  select "pinHash" into stored from member_claims where "memberId" = p_member_id;
  if stored is null then
    return false;
  end if;
  if stored = crypt(p_pin, stored) then
    update member_claims set "claimedByAuthUid" = auth.uid() where "memberId" = p_member_id;
    return true;
  end if;
  return false;
end;
$$;

grant execute on function is_member_claimed(text) to anon, authenticated;
grant execute on function claim_member(text, text) to anon, authenticated;
grant execute on function verify_member_pin(text, text) to anon, authenticated;

create or replace function reset_member_pin(p_member_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from member_claims where "memberId" = p_member_id;
$$;

grant execute on function reset_member_pin(text) to anon, authenticated;

-- ── Realtime — 변경사항이 실시간으로 다른 브라우저에 반영되게 ────────────────
alter publication supabase_realtime add table
  members, lectures, assignments, restoration_items, exam_checklist, app_settings;
