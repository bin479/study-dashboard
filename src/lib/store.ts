"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Assignment, ExamChecklistItem, Lecture, Member, MemberExtraScore, MemberRole, RestorationItem, ActivityLogEntry } from "./types";
import {
  generateAssignments,
  generateExamChecklist,
  generateLectures,
  generateMockMembers,
  generateRestorationItems,
} from "./mockData";
import { applyScheduleAction, ScheduleActionType } from "./scheduleActions";
import { parseLecturesCSV, parseMembersCSV, toGoogleSheetsCSVExportURL } from "./csv";
import { findGroupMembers, splitQuestionsEvenly } from "./roles";
import { STUDY_GROUPS } from "./studyGroups";
import { GROUP_DRAFT_SEQUENCES } from "./sequences";
import { getSupabase, isSupabaseConfigured } from "./supabaseClient";
import { signOutSupabase } from "./auth";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

function relinkAssignmentsChronologically(
  oldLectures: Lecture[],
  newLectures: Lecture[],
  assignments: Assignment[]
): Assignment[] {
  const nextAssignments = assignments.map((a) => ({ ...a }));
  const subjects = new Set(oldLectures.map((l) => l.subject));

  const sortKey = (l: Lecture) => `${l.date}T${l.startTime || "00:00"}_${String(l.order).padStart(3, "0")}`;

  const sortedOld = [...oldLectures].sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1));
  const sortedNew = [...newLectures].sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1));

  subjects.forEach((sub) => {
    const oldSubLecs = sortedOld.filter((l) => l.subject === sub);
    const newSubLecs = sortedNew.filter((l) => l.subject === sub);

    const oldAssList: Assignment[] = [];
    oldSubLecs.forEach((l) => {
      const ass = nextAssignments.find((a) => a.lectureId === l.id);
      if (ass) oldAssList.push(ass);
    });

    const newLecsThatNeedAss = newSubLecs.filter((l) =>
      oldAssList.some((a) => a.lectureId === l.id)
    );

    for (let i = 0; i < Math.min(oldAssList.length, newLecsThatNeedAss.length); i++) {
      oldAssList[i].lectureId = newLecsThatNeedAss[i].id;
    }

    if (oldAssList.length > newLecsThatNeedAss.length) {
      for (let i = newLecsThatNeedAss.length; i < oldAssList.length; i++) {
        const idx = nextAssignments.findIndex((a) => a.id === oldAssList[i].id);
        if (idx !== -1) nextAssignments.splice(idx, 1);
      }
    }
  });

  return nextAssignments;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

type WithId = { id: string };

/** 변경된 행 몇 개만 골라 Supabase에 upsert한다. 실패해도 로컬 상태는 이미 반영돼 있으니 조용히 로그만 남긴다. */
function syncRows<T extends object>(table: string, rows: T[]) {
  const supabase = getSupabase();
  if (!supabase || rows.length === 0) return;
  supabase
    .from(table)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(rows as any[])
    .then(({ error }) => {
      if (error) {
        useDashboardStore.getState().addActivityLog({
          type: "sync",
          direction: "push",
          source: table,
          summary: `동기화 실패: ${error.message}`,
          status: "error",
        });
      }
    });
}

function syncRow<T extends object>(table: string, row: T) {
  syncRows(table, [row]);
}

function deleteRow(table: string, id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  supabase
    .from(table)
    .delete()
    .eq("id", id)
    .then(({ error }) => {
      if (error) {
        useDashboardStore.getState().addActivityLog({
          type: "sync",
          direction: "push",
          source: table,
          summary: `삭제 실패: ${error.message}`,
          status: "error",
        });
      }
    });
}

/** oldArr -> newArr에서 실제로 내용이 바뀐 행만 골라낸다 (원격에 필요한 것만 보내려고). */
function diffChanged<T extends WithId>(oldArr: T[], newArr: T[]): T[] {
  const oldById = new Map(oldArr.map((x) => [x.id, x]));
  return newArr.filter((row) => {
    const prev = oldById.get(row.id);
    return !prev || JSON.stringify(prev) !== JSON.stringify(row);
  });
}

function seed() {
  const members = generateMockMembers();
  const lectures = generateLectures();
  const assignments = generateAssignments(lectures, members);
  const restorationItems = generateRestorationItems();
  const examChecklist = generateExamChecklist();
  return { members, lectures, assignments, restorationItems, examChecklist };
}

interface DashboardState {
  lectures: Lecture[];
  members: Member[];
  assignments: Assignment[];
  restorationItems: RestorationItem[];
  examChecklist: ExamChecklistItem[];
  memberExtraScores: MemberExtraScore[];
  activityLog: ActivityLogEntry[];
  sheetUrls: { lectures: string; members: string };
  noticeSettings: { draftRoom: string; proofRoom: string };
  viewingGroupId: string | null; // 상단 그룹 전환 스위처 — null이면 전체 보기
  simulatedToday: string | null; // 날짜 시뮬레이션 — null이면 실제 오늘
  currentMemberId: string | null; // 이름+PIN으로 로그인한 이 브라우저의 멤버
  hydrated: boolean;
  supabaseReady: boolean; // initFromSupabase가 원격 데이터 로드를 마쳤는지
  adminMode: boolean; // 관리자용 모드 활성화 여부

  setNoticeSettings: (settings: { draftRoom: string; proofRoom: string }) => void;
  setViewingGroupId: (groupId: string | null) => void;
  setSimulatedToday: (date: string | null) => void;
  setCurrentMemberId: (memberId: string | null) => void;
  setAdminMode: (mode: boolean) => void;
  logout: () => void;
  initFromSupabase: () => Promise<void>;

  setHydrated: () => void;
  resetToMockData: () => void;

  importLecturesCSV: (csvText: string, source: string) => void;
  importMembersCSV: (csvText: string, source: string) => void;
  pullLecturesFromSheet: (url: string) => Promise<void>;
  pullMembersFromSheet: (url: string) => Promise<void>;
  setSheetUrl: (kind: "lectures" | "members", url: string) => void;
  addActivityLog: (log: Omit<ActivityLogEntry, "id" | "timestamp">) => void;

  runScheduleAction: (lectureId: string, action: ScheduleActionType) => void;
  updateLectureInfo: (
    lectureId: string,
    info: { subject?: string; professor?: string; startTime?: string; endTime?: string; sessionNumber?: string }
  ) => void;

  markDraftSubmitted: (assignmentId: string, when?: string) => void;
  markProofSubmitted: (assignmentId: string, when?: string) => void;
  resetDraftSubmission: (assignmentId: string) => void;
  resetProofSubmission: (assignmentId: string) => void;
  toggleRecording: (assignmentId: string) => void;
  setBonus: (assignmentId: string, value: number) => void;
  resetAssignmentSubmission: (assignmentId: string) => void;
  setDraftAdjustment: (assignmentId: string, amount: number, reason: string) => void;
  setProofAdjustment: (assignmentId: string, amount: number, reason: string, applyDraftLevel: boolean) => void;
  toggleProofAtDraftLevel: (assignmentId: string) => void;
  setDraftMember: (assignmentId: string, memberId: string | null) => void;
  setProofMember: (assignmentId: string, memberId: string | null) => void;
  setDraftOverrideScore: (assignmentId: string, score: number | null) => void;
  toggleScorePublished: (assignmentId: string) => void;
  addExtraBonus: (assignmentId: string, type: "draft" | "proof", amount: number, reason: string) => void;
  addMemberExtraScores: (scores: Omit<MemberExtraScore, "id">[]) => void;
  removeMemberExtraScore: (id: string) => void;
  updateMemberExtraScore: (id: string, amount: number, reason: string) => void;
  removeMemberExtraScoresBySubject: (subject: string) => void;
  removeExtraBonus: (assignmentId: string, type: "draft" | "proof", bonusId: string) => void;
  autoAssignAll: (options?: { onlyUnassigned?: boolean }) => void;

  addRestorationItem: (item: Omit<RestorationItem, "id">) => void;
  updateRestorationItem: (id: string, patch: Partial<RestorationItem>) => void;
  removeRestorationItem: (id: string) => void;
  clearRestorationItems: () => void;
  autoSplitRestoration: (subject: string, totalQuestions: number, collectorMemberIds: string[]) => void;
  bulkUpdateRestorationItems: (subject: string, collectorMemberId: string | null, items: { number: number; explainerIds: string[] }[]) => void;
  importPivotTableAssignments: (subject: string, assignments: { collectorId: string; explainerId: string; questionNum: number }[]) => void;
  setRestorationItems: (items: RestorationItem[]) => void;

  setMemberRole: (memberId: string, role: MemberRole, subjects?: string[]) => void;
  toggleExamChecklistItem: (id: string) => void;

  swapLectures: (id1: string, id2: string) => void;
  moveLecture: (lectureId: string, targetDate: string, targetPeriod: number) => void;
  addLecture: (lecture: Lecture, assignment: Omit<Assignment, "id"> | null) => void;
  deleteLecture: (lectureId: string) => void;

  pastStates: { lectures: Lecture[]; assignments: Assignment[] }[];
  undo: () => void;
  
  savedRestorationStates: import("./types").SavedRestorationState[];
  saveRestorationState: (memo: string) => void;
  loadRestorationState: (id: string) => void;
  deleteRestorationState: (id: string) => void;

  generateTestSettlementData: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      ...seed(),
      memberExtraScores: [],
      activityLog: [],
      pastStates: [],
      savedRestorationStates: [],
      sheetUrls: { lectures: "", members: "" },
      noticeSettings: { draftRoom: "그룹2 톡방", proofRoom: "과목부장 톡방" },
      viewingGroupId: null,
      simulatedToday: null,
      currentMemberId: null,
      adminMode: false,
      hydrated: false,
      supabaseReady: false,

      setHydrated: () => set({ hydrated: true }),

      setNoticeSettings: (settings) => {
        set({ noticeSettings: settings });
        syncRow("app_settings", { id: 1, ...settings });
      },
      setViewingGroupId: (groupId) => set({ viewingGroupId: groupId }),
      setSimulatedToday: (date) => set({ simulatedToday: date }),
      setCurrentMemberId: (memberId) => set({ currentMemberId: memberId }),
      setAdminMode: (mode) => set({ adminMode: mode }),
      logout: () => {
        signOutSupabase();
        set({ currentMemberId: null });
      },

      initFromSupabase: async () => {
        if (!isSupabaseConfigured()) {
          set({ supabaseReady: true });
          return;
        }
        const supabase = getSupabase()!;

        const [membersRes, lecturesRes, assignmentsRes, restorationRes, checklistRes, settingsRes] =
          await Promise.all([
            supabase.from("members").select("*"),
            supabase.from("lectures").select("*"),
            supabase.from("assignments").select("*"),
            supabase.from("restoration_items").select("*"),
            supabase.from("exam_checklist").select("*"),
            supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
          ]);

        const firstError =
          membersRes.error ||
          lecturesRes.error ||
          assignmentsRes.error ||
          restorationRes.error ||
          checklistRes.error ||
          settingsRes.error;

        if (firstError || !membersRes.data?.length) {
          get().addActivityLog({
            type: "system",
            summary: firstError
              ? `Supabase 초기 로드 실패: ${firstError.message}`
              : "Supabase에 데이터가 없어 로컬 목업으로 시작합니다. scripts/seed-supabase.ts를 실행하세요.",
            status: firstError ? "error" : "success",
            groupId: "all"
          });
          set({ supabaseReady: true });
          return;
        }

        set({
          members: membersRes.data as Member[],
          lectures: lecturesRes.data as Lecture[],
          assignments: assignmentsRes.data as Assignment[],
          restorationItems: (restorationRes.data ?? []) as RestorationItem[],
          examChecklist: (checklistRes.data ?? []) as ExamChecklistItem[],
          noticeSettings: settingsRes.data
            ? { draftRoom: settingsRes.data.draftRoom, proofRoom: settingsRes.data.proofRoom }
            : get().noticeSettings,
          supabaseReady: true,
        });

        function upsertById<T extends WithId>(arr: T[], row: T): T[] {
          const idx = arr.findIndex((x) => x.id === row.id);
          if (idx === -1) return [...arr, row];
          const next = [...arr];
          next[idx] = row;
          return next;
        }

        const handleChange = <T extends WithId>(
          key: "members" | "lectures" | "assignments" | "restorationItems" | "examChecklist",
          payload: RealtimePostgresChangesPayload<Record<string, unknown>>
        ) => {
          set((state) => {
            const arr = state[key] as unknown as T[];
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as { id?: string }).id;
              return { [key]: arr.filter((x) => x.id !== oldId) } as never;
            }
            return { [key]: upsertById(arr, payload.new as T) } as never;
          });
        };

        supabase
          .channel("db-changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "members" }, (p) =>
            handleChange("members", p)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "lectures" }, (p) =>
            handleChange("lectures", p)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, (p) =>
            handleChange("assignments", p)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "restoration_items" }, (p) =>
            handleChange("restorationItems", p)
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "exam_checklist" }, (p) =>
            handleChange("examChecklist", p)
          )
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings" }, (p) => {
            const row = p.new as { draftRoom: string; proofRoom: string };
            set({ noticeSettings: { draftRoom: row.draftRoom, proofRoom: row.proofRoom } });
          })
          .subscribe();
      },

      resetToMockData: () =>
        set({
          ...seed(),
          activityLog: [],
        }),

      importLecturesCSV: (csvText, source) => {
        try {
          const lectures = parseLecturesCSV(csvText);
          set({ lectures });
          syncRows("lectures", lectures);
          get().addActivityLog({
            type: "system",
            summary: `${lectures.length}개 강의 항목을 가져왔습니다.`,
            status: "success",
            groupId: "all"
          });
        } catch (e) {
          get().addActivityLog({
            type: "system",
            summary: `강의 CSV 파싱 실패: ${(e as Error).message}`,
            status: "error",
            groupId: "all"
          });
        }
      },

      importMembersCSV: (csvText, source) => {
        try {
          const members = parseMembersCSV(csvText);
          set({ members });
          syncRows("members", members);
          get().addActivityLog({
            type: "system",
            summary: `${members.length}명의 멤버 명단을 가져왔습니다.`,
            status: "success",
            groupId: "all"
          });
        } catch (e) {
          get().addActivityLog({
            type: "system",
            summary: `멤버 CSV 파싱 실패: ${(e as Error).message}`,
            status: "error",
            groupId: "all"
          });
        }
      },

      pullLecturesFromSheet: async (url) => {
        const exportUrl = toGoogleSheetsCSVExportURL(url);
        try {
          const res = await fetch(exportUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          get().importLecturesCSV(text, exportUrl);
        } catch (e) {
          get().addActivityLog({
            type: "system",
            summary: `Google Sheets 연동 실패: ${(e as Error).message}. 시트가 "링크가 있는 모든 사용자"로 공유되어 있는지 확인하세요.`,
            status: "error",
            groupId: "all"
          });
        }
      },

      pullMembersFromSheet: async (url) => {
        const exportUrl = toGoogleSheetsCSVExportURL(url);
        try {
          const res = await fetch(exportUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          get().importMembersCSV(text, exportUrl);
        } catch (e) {
          get().addActivityLog({
            type: "system",
            summary: `Google Sheets 연동 실패: ${(e as Error).message}. 시트가 "링크가 있는 모든 사용자"로 공유되어 있는지 확인하세요.`,
            status: "error",
            groupId: "all"
          });
        }
      },

      setSheetUrl: (kind, url) =>
        set((state) => ({ sheetUrls: { ...state.sheetUrls, [kind]: url } })),

      addActivityLog: (log) =>
        set((state) => ({
          activityLog: [
            { id: uid("log"), timestamp: new Date().toISOString(), ...log },
            ...state.activityLog,
          ].slice(0, 100),
        })),

      runScheduleAction: (lectureId, action) => {
        const { lectures, assignments, pastStates } = get();
        set({ pastStates: [...pastStates, { lectures, assignments }].slice(-10) });

        const result = applyScheduleAction(lectures, assignments, lectureId, action);
        set({ lectures: result.lectures, assignments: result.assignments });
        syncRows("lectures", diffChanged(lectures, result.lectures));
        syncRows("assignments", diffChanged(assignments, result.assignments));
        get().autoAssignAll({ onlyUnassigned: true });
      },

      updateLectureInfo: (lectureId, info) => {
        const { lectures, assignments, pastStates } = get();
        set({ pastStates: [...pastStates, { lectures, assignments }].slice(-10) });

        set((state) => ({
          lectures: state.lectures.map((l) => (l.id === lectureId ? { ...l, ...info } : l)),
        }));
        syncRow("lectures", { id: lectureId, ...info });
      },

      markDraftSubmitted: (assignmentId, when) => {
        const draftSubmittedAt = when ?? new Date().toISOString();
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, draftSubmittedAt, draftStatus: "submitted" } : a
          ),
        }));
        syncRow("assignments", { id: assignmentId, draftSubmittedAt, draftStatus: "submitted" });
      },

      markProofSubmitted: (assignmentId, when) => {
        const proofSubmittedAt = when ?? new Date().toISOString();
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, proofSubmittedAt, proofStatus: "submitted" } : a
          ),
        }));
        syncRow("assignments", { id: assignmentId, proofSubmittedAt, proofStatus: "submitted" });
      },

      resetDraftSubmission: (assignmentId) => {
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, draftSubmittedAt: null, draftStatus: "pending" } : a
          ),
        }));
        syncRow("assignments", { id: assignmentId, draftSubmittedAt: null, draftStatus: "pending" });
      },

      resetProofSubmission: (assignmentId) => {
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, proofSubmittedAt: null, proofStatus: "pending" } : a
          ),
        }));
        syncRow("assignments", { id: assignmentId, proofSubmittedAt: null, proofStatus: "pending" });
      },

      toggleRecording: (assignmentId) => {
        const next = !get().assignments.find((a) => a.id === assignmentId)?.recordingUploaded;
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, recordingUploaded: next } : a
          ),
        }));
        syncRow("assignments", { id: assignmentId, recordingUploaded: next });
      },

      setBonus: (assignmentId, value) => {
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, bonusPoints: value } : a
          ),
        }));
        syncRow("assignments", { id: assignmentId, bonusPoints: value });
      },

      resetAssignmentSubmission: (assignmentId) => {
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId
              ? {
                  ...a,
                  draftSubmittedAt: null,
                  proofSubmittedAt: null,
                  draftStatus: "pending",
                  proofStatus: "pending",
                  recordingUploaded: false,
                }
              : a
          ),
        }));
        syncRow("assignments", {
          id: assignmentId,
          draftSubmittedAt: null,
          proofSubmittedAt: null,
          draftStatus: "pending",
          proofStatus: "pending",
          recordingUploaded: false,
        });
      },

      setDraftAdjustment: (assignmentId, amount, reason) => {
        set((state) => {
          const idx = state.assignments.findIndex((a) => a.id === assignmentId);
          if (idx === -1) return state;
          const newAssignments = [...state.assignments];
          const a = newAssignments[idx];
          
          if (a.draftAdjustment !== amount || a.draftAdjustmentReason !== reason) {
            a.draftAdjustment = amount;
            a.draftAdjustmentReason = reason;
            
            const currentMember = state.members.find(m => m.id === state.currentMemberId);
            const draftMember = state.members.find(m => m.id === a.draftMemberId);
            if (currentMember && currentMember.groupId) {
              const newLog: ActivityLogEntry = {
                id: uid("log"),
                timestamp: new Date().toISOString(),
                type: "evaluation",
                summary: `${currentMember.name} 과목부장이 ${draftMember?.name || "알 수 없음"}님의 초안을 평가했습니다.`,
                status: "success",
                groupId: currentMember.groupId
              };
              return { 
                assignments: newAssignments,
                activityLog: [newLog, ...state.activityLog].slice(0, 100)
              };
            }
          }
          return { assignments: newAssignments };
        });
      },

      setProofAdjustment: (assignmentId, amount, reason, applyDraftLevel) => {
        set((state) => {
          const idx = state.assignments.findIndex((a) => a.id === assignmentId);
          if (idx === -1) return state;
          const newAssignments = [...state.assignments];
          const a = newAssignments[idx];
          
          if (a.proofAdjustment !== amount || a.proofAdjustmentReason !== reason || a.proofAtDraftLevel !== applyDraftLevel) {
            a.proofAdjustment = amount;
            a.proofAdjustmentReason = reason;
            a.proofAtDraftLevel = applyDraftLevel;
            
            const currentMember = state.members.find(m => m.id === state.currentMemberId);
            const proofMember = state.members.find(m => m.id === a.proofMemberId);
            if (currentMember && currentMember.groupId) {
              const newLog: ActivityLogEntry = {
                id: uid("log"),
                timestamp: new Date().toISOString(),
                type: "evaluation",
                summary: `${currentMember.name} 과목부장이 ${proofMember?.name || "알 수 없음"}님의 검안을 평가했습니다.`,
                status: "success",
                groupId: currentMember.groupId
              };
              return { 
                assignments: newAssignments,
                activityLog: [newLog, ...state.activityLog].slice(0, 100)
              };
            }
          }
          return { assignments: newAssignments };
        });
      },

      toggleProofAtDraftLevel: (assignmentId) => {
        const next = !get().assignments.find((a) => a.id === assignmentId)?.proofAtDraftLevel;
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, proofAtDraftLevel: next } : a
          ),
        }));
        syncRow("assignments", { id: assignmentId, proofAtDraftLevel: next });
      },

      setDraftMember: (assignmentId, memberId) => {
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, draftMemberId: memberId } : a
          ),
        }));
        syncRow("assignments", { id: assignmentId, draftMemberId: memberId });
      },

      setProofMember: (assignmentId, memberId) => {
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, proofMemberId: memberId } : a
          ),
        }));
        syncRow("assignments", { id: assignmentId, proofMemberId: memberId });
      },

      setDraftOverrideScore: (assignmentId, score) => {
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, draftOverrideScore: score } : a
          ),
        }));
        syncRow("assignments", { id: assignmentId, draftOverrideScore: score });
      },

      toggleScorePublished: (assignmentId) =>
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId ? { ...a, scorePublished: !a.scorePublished } : a
          ),
        })),

      addMemberExtraScores: (scores) => {
        const today = new Date().toISOString().split("T")[0];
        const newScores = scores.map((s) => ({
          ...s,
          id: uid("extra"),
          date: s.date || today,
        }));
        set((state) => ({
          memberExtraScores: [...state.memberExtraScores, ...newScores],
        }));
      },

      removeMemberExtraScore: (id) => {
        set((state) => ({
          memberExtraScores: state.memberExtraScores.filter((s) => s.id !== id),
        }));
      },

      updateMemberExtraScore: (id, amount, reason) => {
        set((state) => ({
          memberExtraScores: state.memberExtraScores.map((s) =>
            s.id === id ? { ...s, amount, reason } : s
          ),
        }));
      },

      removeMemberExtraScoresBySubject: (subject) => {
        set((state) => ({
          memberExtraScores: state.memberExtraScores.filter((s) => !s.reason.includes(`[${subject}]`)),
        }));
      },

      addExtraBonus: (assignmentId, type, amount, reason) => {
        const id = uid("eb");
        set((state) => ({
          assignments: state.assignments.map((a) => {
            if (a.id !== assignmentId) return a;
            const field = type === "draft" ? "extraBonusesDraft" : "extraBonusesProof";
            return {
              ...a,
              [field]: [...(a[field] || []), { id, amount, reason }],
            };
          }),
        }));
        const state = get();
        const a = state.assignments.find((x) => x.id === assignmentId);
        if (a) syncRow("assignments", { id: assignmentId, extraBonusesDraft: a.extraBonusesDraft, extraBonusesProof: a.extraBonusesProof });
      },

      removeExtraBonus: (assignmentId, type, bonusId) => {
        set((state) => ({
          assignments: state.assignments.map((a) => {
            if (a.id !== assignmentId) return a;
            const field = type === "draft" ? "extraBonusesDraft" : "extraBonusesProof";
            return {
              ...a,
              [field]: (a[field] || []).filter((b) => b.id !== bonusId),
            };
          }),
        }));
        const state = get();
        const a = state.assignments.find((x) => x.id === assignmentId);
        if (a) syncRow("assignments", { id: assignmentId, extraBonusesDraft: a.extraBonusesDraft, extraBonusesProof: a.extraBonusesProof });
      },

      autoAssignAll: (options) => {
        const { members, assignments, lectures } = get();
        
        const uniqueAssignments: Assignment[] = [];
        const seenLectures = new Set<string>();
        const deletedAssignmentIds: string[] = [];
        
        assignments.forEach((a) => {
          if (seenLectures.has(a.lectureId)) {
            deletedAssignmentIds.push(a.id);
          } else {
            seenLectures.add(a.lectureId);
            uniqueAssignments.push(a);
          }
        });

        if (deletedAssignmentIds.length > 0) {
          deletedAssignmentIds.forEach((id) => deleteRow("assignments", id));
        }

        const lectureById = new Map(lectures.map((l) => [l.id, l]));

        const activeMembers = members.filter((m) => m.active);
        
        const missingAssignments: Assignment[] = [];
        lectures.forEach((l) => {
          if (l.assignable && l.status !== "cancelled" && l.status !== "shifted" && l.status !== "unassigned") {
            if (!seenLectures.has(l.id)) {
              const newAss: Assignment = {
                id: uid("ass"),
                lectureId: l.id,
                draftMemberId: null,
                proofMemberId: null,
                draftStatus: "pending",
                proofStatus: "pending",
                recordingUploaded: false,
                draftAdjustment: 0,
                proofAdjustment: 0,
                draftAdjustmentReason: "",
                proofAdjustmentReason: "",
                proofAtDraftLevel: false,
                draftSubmittedAt: null,
                proofSubmittedAt: null,
                bonusPoints: 0,
                scorePublished: false,
              };
              missingAssignments.push(newAss);
              uniqueAssignments.push(newAss);
              seenLectures.add(l.id);
            }
          }
        });

        if (missingAssignments.length > 0) {
          syncRows("assignments", missingAssignments);
        }

        const ordered = uniqueAssignments
          .filter((a) => {
            const l = lectureById.get(a.lectureId);
            return l && l.assignable && l.status !== "cancelled" && l.status !== "shifted" && l.status !== "unassigned";
          })
          .sort((a, b) => {
            const la = lectureById.get(a.lectureId)!;
            const lb = lectureById.get(b.lectureId)!;
            const keyA = `${la.date}__${String(la.order).padStart(3, "0")}`;
            const keyB = `${lb.date}__${String(lb.order).padStart(3, "0")}`;
            return keyA > keyB ? 1 : -1;
          });

        const poolCache = new Map<string, Member[]>();
        const cursors = new Map<string, number>();
        const groupCursors = new Map<string, number>();

        const poolFor = (subject: string): Member[] => {
          if (!poolCache.has(subject)) {
            let groupPool = findGroupMembers(activeMembers, STUDY_GROUPS, subject);
            const group = STUDY_GROUPS.find(g => g.subjects.includes(subject));
            
            if (group) {
              groupPool = groupPool.filter(m => !(m.groupId === group.id && m.role === "lead"));
            }
            
            poolCache.set(subject, groupPool.length >= 2 ? groupPool : activeMembers);
          }
          return poolCache.get(subject)!;
        };

        const groupPoolCache = new Map<string, string[]>();
        const getGroupPool = (groupId: string): string[] => {
          if (!groupPoolCache.has(groupId)) {
            const sequenceNames = GROUP_DRAFT_SEQUENCES[groupId] || [];
            const ids = sequenceNames.map(name => {
              const cleanName = name.replace(/\(\d+\)/g, '').trim();
              const m = activeMembers.find(x => x.name === cleanName);
              return m ? m.id : "";
            }).filter(id => id !== "");
            groupPoolCache.set(groupId, ids);
          }
          return groupPoolCache.get(groupId)!;
        };

        const nextIds = new Map<string, { draft: string | null; proof: string | null }>();
        ordered.forEach((a) => {
          if (options?.onlyUnassigned && (a.draftMemberId || a.proofMemberId)) return;
          const lecture = lectureById.get(a.lectureId)!;
          const group = STUDY_GROUPS.find(g => g.subjects.includes(lecture.subject));
          
          let draft: string | null = null;
          if (group) {
            const gPool = getGroupPool(group.id);
            if (gPool.length > 0) {
              const gCursor = groupCursors.get(group.id) ?? 0;
              draft = gPool[gCursor % gPool.length];
              groupCursors.set(group.id, gCursor + 1);
            }
          }

          const pool = poolFor(lecture.subject);
          const cursor = cursors.get(lecture.subject) ?? 0;
          const proof = pool.length > 0 ? pool[(cursor + 1) % pool.length].id : null;
          cursors.set(lecture.subject, cursor + 1);

          if (!draft && pool.length > 0) draft = pool[cursor % pool.length].id;

          nextIds.set(a.id, { draft, proof });
        });

        const nextAssignments = uniqueAssignments.map((a) => {
          const picked = nextIds.get(a.id);
          return picked ? { ...a, draftMemberId: picked.draft, proofMemberId: picked.proof } : a;
        });
        
        set({ assignments: nextAssignments });
        syncRows(
          "assignments",
          nextAssignments.filter((a) => nextIds.has(a.id))
        );
      },

      generateTestSettlementData: () => {
        const { members, assignments, addRestorationItem } = get();
        
        const newAssignments = assignments.map((a, i) => {
          if (i % 3 === 0) {
            return {
              ...a,
              draftAdjustment: 2,
              proofAdjustment: 1,
            };
          }
          if (i % 4 === 0) {
            return {
              ...a,
              draftAdjustment: -1,
            };
          }
          return a;
        });

        const groupMembers = members.filter(m => m.groupId === "g1");
        if (groupMembers.length >= 2) {
          addRestorationItem({
            subject: "테스트과목",
            collectorMemberId: groupMembers[0].id,
            explainerMemberIds: [groupMembers[1].id],
            questionRangeStart: 1,
            questionRangeEnd: 5,
            totalQuestions: 5,
            missingCount: 0,
            validExplanations: 5,
            submittedAt: new Date().toISOString(),
            dueAt: new Date().toISOString(),
            collectionBonus: 2.5,
            collectionBonusReason: "정상 완료",
            rewriteRequested: false,
            rewriteCompleted: false,
            explanationAdjustmentReason: "",
          });
        }

        set({ assignments: newAssignments });
      },

      addRestorationItem: (item) => {
        const row = { id: uid("res"), ...item };
        set((state) => ({
          restorationItems: [...state.restorationItems, row],
        }));
        syncRow("restoration_items", row);
      },

      updateRestorationItem: (id, patch) => {
        set((state) => ({
          restorationItems: state.restorationItems.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }));
        syncRow("restoration_items", { id, ...patch });
      },

      removeRestorationItem: (id) => {
        set((state) => ({
          restorationItems: state.restorationItems.filter((i) => i.id !== id),
        }));
        const supabase = getSupabase();
        if (supabase) supabase.from("restoration_items").delete().eq("id", id).then();
      },

      clearRestorationItems: () => {
        set({ restorationItems: [] });
        const supabase = getSupabase();
        if (supabase) supabase.from("restoration_items").delete().neq("id", "dummy").then();
      },
      
      setRestorationItems: (items) => {
        set({ restorationItems: items });
        const supabase = getSupabase();
        if (supabase) {
          supabase.from("restoration_items").delete().neq("id", "dummy").then(() => {
            if (items.length > 0) {
              supabase.from("restoration_items").insert(items).then();
            }
          });
        }
      },

      saveRestorationState: (memo) => {
        const { restorationItems, savedRestorationStates } = get();
        const newState = {
          id: uid("rstate"),
          savedAt: new Date().toISOString(),
          memo,
          items: restorationItems.map(item => ({...item}))
        };
        set({ savedRestorationStates: [newState, ...savedRestorationStates] });
      },
      
      loadRestorationState: (id) => {
        const { savedRestorationStates } = get();
        const state = savedRestorationStates.find(s => s.id === id);
        if (state) {
          get().setRestorationItems(state.items);
        }
      },
      
      deleteRestorationState: (id) => {
        set((state) => ({
          savedRestorationStates: state.savedRestorationStates.filter(s => s.id !== id)
        }));
      },

      autoSplitRestoration: (subject, totalQuestions, memberIds) => {
        const ranges = splitQuestionsEvenly(totalQuestions, memberIds);
        const newItems: RestorationItem[] = [];
        ranges.forEach(({ memberId, start, end }) => {
          for (let i = start; i <= end; i++) {
            newItems.push({
              id: uid("rst"),
              subject,
              collectorMemberId: memberId,
              explainerMemberIds: [],
              questionRangeStart: i,
              questionRangeEnd: i,
              totalQuestions: 1,
              missingCount: 0,
              validExplanations: 0,
              submittedAt: null,
              dueAt: null,
              collectionBonus: 0,
              collectionBonusReason: "",
              explanationAdjustmentReason: "",
              rewriteRequested: false,
              rewriteCompleted: false,
            });
          }
        });
        set((state) => ({ restorationItems: [...state.restorationItems, ...newItems] }));
        syncRows("restoration_items", newItems);
      },

      bulkUpdateRestorationItems: (subject, collectorMemberId, items) => {
        const updatedIds: string[] = [];
        let nextItems: RestorationItem[] = [];
        set((state) => {
          nextItems = state.restorationItems.map((r) => {
            if (r.subject === subject && r.collectorMemberId === collectorMemberId) {
              const found = items.find((i) => i.number === r.questionRangeStart);
              if (found) {
                updatedIds.push(r.id);
                return { ...r, explainerMemberIds: found.explainerIds, validExplanations: found.explainerIds.length > 0 ? 1 : 0 };
              }
            }
            return r;
          });
          return { restorationItems: nextItems };
        });
        syncRows("restoration_items", nextItems.filter(r => updatedIds.includes(r.id)));
      },

      importPivotTableAssignments: (subject, assignments) => {
        const newItems: RestorationItem[] = [];
        const updatedIds: string[] = [];
        
        set((state) => {
          const nextItems = [...state.restorationItems];
          
          assignments.forEach(assignment => {
            const existingIndex = nextItems.findIndex(r => r.subject === subject && r.questionRangeStart === assignment.questionNum && r.questionRangeEnd === assignment.questionNum);
            
            if (existingIndex !== -1) {
              // Update existing item
              const existing = nextItems[existingIndex];
              const newExplainerIds = Array.from(new Set([...existing.explainerMemberIds, assignment.explainerId]));
              nextItems[existingIndex] = {
                ...existing,
                collectorMemberId: assignment.collectorId, // Update collector if it changed
                explainerMemberIds: newExplainerIds,
                validExplanations: newExplainerIds.length > 0 ? 1 : 0
              };
              updatedIds.push(existing.id);
            } else {
              // Create new item
              const newItem: RestorationItem = {
                id: uid("rst"),
                subject,
                collectorMemberId: assignment.collectorId,
                explainerMemberIds: [assignment.explainerId],
                questionRangeStart: assignment.questionNum,
                questionRangeEnd: assignment.questionNum,
                totalQuestions: 1,
                missingCount: 0,
                validExplanations: 1,
                submittedAt: null,
                dueAt: null,
                collectionBonus: 0,
                collectionBonusReason: "",
                explanationAdjustmentReason: "",
                rewriteRequested: false,
                rewriteCompleted: false,
              };
              nextItems.push(newItem);
              newItems.push(newItem);
            }
          });
          
          return { restorationItems: nextItems };
        });
        
        if (updatedIds.length > 0) {
          const updatedItems = get().restorationItems.filter(r => updatedIds.includes(r.id));
          syncRows("restoration_items", updatedItems);
        }
        if (newItems.length > 0) {
          syncRows("restoration_items", newItems);
        }
      },

      setMemberRole: (memberId, role, subjects) => {
        set((state) => ({
          members: state.members.map((m) => (m.id === memberId ? { ...m, role, subjects } : m)),
        }));
        syncRow("members", { id: memberId, role, subjects: subjects ?? null });
      },

      toggleExamChecklistItem: (id) => {
        const next = !get().examChecklist.find((c) => c.id === id)?.done;
        set((state) => ({
          examChecklist: state.examChecklist.map((c) => (c.id === id ? { ...c, done: next } : c)),
        }));
        syncRow("exam_checklist", { id, done: next });
      },

      swapLectures: (id1, id2) => {
        const { lectures, assignments, pastStates } = get();
        const l1 = lectures.find((l) => l.id === id1);
        const l2 = lectures.find((l) => l.id === id2);
        if (!l1 || !l2) return;

        set({ pastStates: [...pastStates, { lectures, assignments }].slice(-10) });

        // swap time/position properties
        const l1Props = { date: l1.date, period: l1.period, startTime: l1.startTime, endTime: l1.endTime, order: l1.order, durationHours: l1.durationHours, originalDurationHours: l1.originalDurationHours };
        const l2Props = { date: l2.date, period: l2.period, startTime: l2.startTime, endTime: l2.endTime, order: l2.order, durationHours: l2.durationHours, originalDurationHours: l2.originalDurationHours };

        // We MUST re-link assignments for ALL subjects affected to maintain chronological rotation!
        const nextLectures = lectures.map((l) => {
          if (l.id === id1) return { ...l, ...l2Props };
          if (l.id === id2) return { ...l, ...l1Props };
          return l;
        });

        const nextAssignments = relinkAssignmentsChronologically(lectures, nextLectures, assignments);

        set({ lectures: nextLectures, assignments: nextAssignments });
        syncRows("lectures", diffChanged(lectures, nextLectures));
        syncRows("assignments", diffChanged(assignments, nextAssignments));
      },

      moveLecture: (lectureId, targetDate, targetPeriod) => {
        const { lectures, assignments, pastStates } = get();
        const lecture = lectures.find((l) => l.id === lectureId);
        if (!lecture) return;

        set({ pastStates: [...pastStates, { lectures, assignments }].slice(-10) });

        const startHour = targetPeriod <= 4 ? 8 + targetPeriod : 9 + targetPeriod;
        const endHour = startHour + lecture.durationHours;
        const startTime = `${String(startHour).padStart(2, "0")}:00`;
        const endTime = `${String(endHour).padStart(2, "0")}:00`;
        const periodStr = lecture.durationHours > 1 
          ? `${targetPeriod}~${targetPeriod + lecture.durationHours - 1}교시` 
          : `${targetPeriod}교시`;

        const updated = {
          ...lecture,
          date: targetDate,
          order: targetPeriod,
          startTime,
          endTime,
          period: periodStr,
        };

        const nextLectures = lectures.map((l) => (l.id === lectureId ? updated : l));
        const nextAssignments = relinkAssignmentsChronologically(lectures, nextLectures, assignments);
        
        set({ lectures: nextLectures, assignments: nextAssignments });
        syncRow("lectures", updated);
        syncRows("assignments", diffChanged(assignments, nextAssignments));
      },

      addLecture: (lecture, assignmentObj) => {
        const { lectures, assignments, pastStates } = get();
        set({ pastStates: [...pastStates, { lectures, assignments }].slice(-10) });

        const newLectures = [...lectures, lecture];
        
        let newAssignments = [...assignments];
        if (assignmentObj) {
          const newAssignment = { ...assignmentObj, id: uid("ass") } as Assignment;
          newAssignments = [...assignments, newAssignment];
        }

        set({ lectures: newLectures, assignments: newAssignments });
        syncRow("lectures", lecture);
        if (assignmentObj) {
          syncRow("assignments", newAssignments[newAssignments.length - 1]);
        }
        get().autoAssignAll({ onlyUnassigned: true });
      },

      deleteLecture: (lectureId) => {
        const { lectures, assignments, pastStates } = get();
        const lecture = lectures.find((l) => l.id === lectureId);
        if (!lecture) return;

        set({ pastStates: [...pastStates, { lectures, assignments }].slice(-10) });

        const nextLectures = lectures.filter((l) => l.id !== lectureId);
        const nextAssignments = relinkAssignmentsChronologically(lectures, nextLectures, assignments);

        set({ lectures: nextLectures, assignments: nextAssignments });
        
        // sync to supabase
        deleteRow("lectures", lectureId);
        const deletedAssignments = assignments.filter((a) => !nextAssignments.some((na) => na.id === a.id));
        deletedAssignments.forEach((a) => deleteRow("assignments", a.id));
        syncRows("assignments", diffChanged(assignments, nextAssignments));
      },

      undo: () => {
        const { pastStates, lectures, assignments } = get();
        if (pastStates.length === 0) return;
        
        const lastState = pastStates[pastStates.length - 1];
        const newPastStates = pastStates.slice(0, -1);
        
        set({ 
          lectures: lastState.lectures, 
          assignments: lastState.assignments,
          pastStates: newPastStates
        });
        
        // Sync the restored state to Supabase.
        const deletedLectures = lectures.filter((l) => !lastState.lectures.some((nl) => nl.id === l.id));
        deletedLectures.forEach((l) => deleteRow("lectures", l.id));

        const deletedAssignments = assignments.filter((a) => !lastState.assignments.some((na) => na.id === a.id));
        deletedAssignments.forEach((a) => deleteRow("assignments", a.id));

        syncRows("lectures", diffChanged(lectures, lastState.lectures));
        syncRows("assignments", diffChanged(assignments, lastState.assignments));
      },
    }),
    {
      name: "study-guide-dashboard",
      // 저장 스키마가 바뀔 때마다 올린다 (v3: 실제 시간표 도입 —
      // subject가 과목 블록명이 되고 topic/entryType/assignable이 추가됨.
      // v4: 실제 학습부원 105명 명단으로 교체 (기존 목업 12명 제거).
      // v5: 5개 학습부 그룹(그룹장·과목부장·전담 과목) 배정 추가.
      // v6: 그룹장 아래 인원을 조원이 아닌 과목부장(role: subjectHead)으로 정정, 김건아 추가.
      // 옛 payload는 새 필드가 없으므로 병합하지 않고 버린다.
      version: 8,
      migrate: () => ({ ...seed(), activityLog: [] }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
