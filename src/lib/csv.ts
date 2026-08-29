import Papa from "papaparse";
import { Assignment, Lecture, Member, SubjectType, SubmissionStatus } from "./types";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function parseLecturesCSV(csvText: string): Lecture[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  // Extract merge list from columns that contain '제외할 강의명'
  const mergeKeys = Object.keys(data[0] || {}).filter(k => k.includes("제외할 강의명"));
  const mergeList = new Set<string>();
  if (mergeKeys.length > 0) {
    data.forEach(row => {
      mergeKeys.forEach(k => {
        const val = row[k]?.trim();
        if (val) mergeList.add(val);
      });
    });
  }

  const lectures: Lecture[] = [];

  data.forEach((row, idx) => {
    if (!row.subject && !row.topic && !row.professor) return; // skip empty rows

    const entryType = (row.entryType?.trim() as Lecture["entryType"]) || "lecture";
    const subjectName = row.subject?.trim() || "";
    const prof = row.professor?.trim() ? `(${row.professor?.trim()})` : "";
    const subjectProf = `${subjectName}${prof}`; // e.g. "식품알레르기(문도식)"

    const newLec: Lecture = {
      id: row.id?.trim() || uid("lec"),
      date: row.date?.trim(),
      period: row.period?.trim() || `${idx + 1}교시`,
      order: Number(row.order) || idx + 1,
      subject: subjectName,
      topic: row.topic?.trim() || undefined,
      professor: row.professor?.trim() || "",
      subjectType: (row.subjectType?.trim().toLowerCase() === "minor" ? "minor" : "major") as SubjectType,
      durationHours: Number(row.durationHours) || 1, // Defaulting to 1 for safer auto-merge math, usually CSV sets this to 2
      status: "scheduled" as const,
      entryType,
      assignable: row.assignable ? row.assignable.trim().toLowerCase() !== "false" : entryType === "lecture",
      startTime: row.startTime?.trim() || undefined,
      endTime: row.endTime?.trim() || undefined,
      sessionNumber: row.sessionNumber?.trim() || undefined,
    };

    if (mergeList.has(subjectProf) && lectures.length > 0) {
      // Find previous assignable lecture on the same date to merge into
      let prevIndex = lectures.length - 1;
      while (prevIndex >= 0 && (lectures[prevIndex].date !== newLec.date || !lectures[prevIndex].assignable)) {
        prevIndex--;
      }

      if (prevIndex >= 0) {
        const prev = lectures[prevIndex];
        prev.subject = `${prev.subject} & ${subjectName}`;
        prev.durationHours += newLec.durationHours;
        
        newLec.status = "shifted";
        newLec.assignable = false;
        lectures.push(newLec);
      } else {
        lectures.push(newLec);
      }
    } else {
      lectures.push(newLec);
    }
  });

  return lectures;
}

export function parseMembersCSV(csvText: string): Member[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  return data.map((row) => ({
    id: row.id?.trim() || uid("mem"),
    studentId: row.studentId?.trim() || undefined,
    name: row.name?.trim() || "",
    role: (row.role?.trim() as Member["role"]) || "student",
    cohort: row.cohort?.trim(),
    active: row.active ? row.active.trim().toLowerCase() !== "false" : true,
    groupId: row.groupId?.trim() || undefined,
  }));
}

export function parseAssignmentsCSV(csvText: string): Partial<Assignment>[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  return data.map((row) => ({
    id: row.id?.trim() || uid("asg"),
    lectureId: row.lectureId?.trim(),
    draftMemberId: row.draftMemberId?.trim() || null,
    proofMemberId: row.proofMemberId?.trim() || null,
    draftStatus: (row.draftStatus?.trim() as SubmissionStatus) || "pending",
    proofStatus: (row.proofStatus?.trim() as SubmissionStatus) || "pending",
    draftSubmittedAt: row.draftSubmittedAt?.trim() || null,
    proofSubmittedAt: row.proofSubmittedAt?.trim() || null,
    recordingUploaded: row.recordingUploaded?.trim().toLowerCase() === "true",
    bonusPoints: Number(row.bonusPoints) || 0,
  }));
}

export function lecturesToCSV(lectures: Lecture[]): string {
  return Papa.unparse(
    lectures.map((l) => ({
      id: l.id,
      date: l.date,
      period: l.period,
      order: l.order,
      subject: l.subject,
      topic: l.topic ?? "",
      professor: l.professor,
      subjectType: l.subjectType,
      durationHours: l.durationHours,
      startTime: l.startTime ?? "",
      endTime: l.endTime ?? "",
      sessionNumber: l.sessionNumber ?? "",
      entryType: l.entryType,
      assignable: l.assignable,
      status: l.status,
    }))
  );
}

export function membersToCSV(members: Member[]): string {
  return Papa.unparse(members);
}

export function assignmentsToCSV(assignments: Assignment[]): string {
  return Papa.unparse(assignments);
}

export function downloadCSV(filename: string, csvText: string) {
  const blob = new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface SettlementRow {
  studentId: string;
  memberName: string;
  draftAdjustment: number;
  proofAdjustment: number;
  collectionBonus: number;
  restorationMissingPenalty: number;
  explanationAdjustment: number;
  total: number;
}

export async function downloadStudyExcel(filename: string, rows: SettlementRow[]) {
  const XLSX = await import("xlsx");
  const data = rows.map((r) => {
    const sum = r.draftAdjustment + r.proofAdjustment;
    return {
      "학번": r.studentId,
      "이름": r.memberName,
      "초안": r.draftAdjustment || "",
      "검안": r.proofAdjustment || "",
      "비고": "",
      "총합": sum,
    };
  });
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "학습부");
  XLSX.writeFile(workbook, filename);
}

export async function downloadRestorationExcel(filename: string, rows: SettlementRow[]) {
  const XLSX = await import("xlsx");
  const data = rows.map((r) => {
    const restorationTotal = r.collectionBonus + r.restorationMissingPenalty;
    const sum = r.explanationAdjustment + restorationTotal;
    return {
      "학번": r.studentId,
      "이름": r.memberName,
      "해설": r.explanationAdjustment || "",
      "복원": restorationTotal || "",
      "비고": "",
      "총합": sum,
    };
  });
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "복원해설");
  XLSX.writeFile(workbook, filename);
}

/** Converts a normal Google Sheets share URL to its CSV export URL, if possible. */
export function toGoogleSheetsCSVExportURL(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return url;
  const id = match[1];
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}
