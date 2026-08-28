"use client";

import { useMemo, useState, useRef } from "react";
import { CheckSquare, Square, ClipboardList, Plus, Search, HelpCircle, FileText, Download, Upload, Trash2, ChevronDown, ChevronUp, Split } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { scoreRestoration } from "@/lib/scoring";
import { findSubjectHeads, findGroupLeader } from "@/lib/roles";
import { STUDY_GROUPS } from "@/lib/studyGroups";
import RestorationCollectionEvalModal from "../RestorationCollectionEvalModal";
import RestorationExplanationEvalModal from "../RestorationExplanationEvalModal";
import { RestorationItem } from "@/lib/types";

export default function RestorationView() {
  const lectures = useDashboardStore((s) => s.lectures);
  const members = useDashboardStore((s) => s.members);
  const restorationItems = useDashboardStore((s) => s.restorationItems);
  const addRestorationItem = useDashboardStore((s) => s.addRestorationItem);
  const updateRestorationItem = useDashboardStore((s) => s.updateRestorationItem);
  const removeRestorationItem = useDashboardStore((s) => s.removeRestorationItem);
  const clearRestorationItems = useDashboardStore((s) => s.clearRestorationItems);
  const setRestorationItems = useDashboardStore((s) => s.setRestorationItems);
  const addMemberExtraScores = useDashboardStore((s) => s.addMemberExtraScores);
  const savedRestorationStates = useDashboardStore((s) => s.savedRestorationStates);
  const saveRestorationState = useDashboardStore((s) => s.saveRestorationState);
  const loadRestorationState = useDashboardStore((s) => s.loadRestorationState);
  const deleteRestorationState = useDashboardStore((s) => s.deleteRestorationState);

  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isLoadStateModalOpen, setIsLoadStateModalOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [excelImportText, setExcelImportText] = useState("");
  const adminMode = useDashboardStore((s) => s.adminMode);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSplitRestoration = useDashboardStore((s) => s.autoSplitRestoration);
  const bulkUpdateRestorationItems = useDashboardStore((s) => s.bulkUpdateRestorationItems);
  const examChecklist = useDashboardStore((s) => s.examChecklist);
  const toggleExamChecklistItem = useDashboardStore((s) => s.toggleExamChecklistItem);

  const viewingGroupId = useDashboardStore((s) => s.viewingGroupId);
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);

  const [activeRole, setActiveRole] = useState<"subjectHead" | "groupLeader">(() => {
    const mem = useDashboardStore.getState().members.find(m => m.id === useDashboardStore.getState().currentMemberId);
    return mem?.role === "lead" ? "groupLeader" : "subjectHead";
  });

  const subjectOptions = useMemo(() => {
    const allSubjects = Array.from(new Set(lectures.map((l) => l.subject)));
    if (!viewingGroupId) return allSubjects;
    const group = STUDY_GROUPS.find((g) => g.id === viewingGroupId);
    if (!group) return allSubjects;
    return allSubjects.filter((s) => group.subjects.includes(s));
  }, [lectures, viewingGroupId]);

  const [form, setForm] = useState({
    subject: subjectOptions[0] ?? "",
    explainerSearch: "",
    questionRangeStart: 1,
    questionRangeEnd: 20,
  });

  const [splitForm, setSplitForm] = useState<{ subject: string; total: number }>({
    subject: subjectOptions[0] ?? "",
    total: 40,
  });

  const [bulkText, setBulkText] = useState("1번 김철수\n또는 엑셀 표(순번, 이름, 문제1, 문제2...)를 그대로 복붙하세요.");
  const [collectorSearch, setCollectorSearch] = useState("");

  const [evalCollectionItem, setEvalCollectionItem] = useState<{ item: RestorationItem; totalQuestions: number } | null>(null);
  const [evalExplanationItem, setEvalExplanationItem] = useState<RestorationItem | null>(null);
  const [groupLeaderTab, setGroupLeaderTab] = useState<"collection" | "explanation">("collection");

  const currentCollector = useMemo(() => {
    if (!form.subject) return null;
    const heads = findSubjectHeads(members, form.subject);
    return heads.length > 0 ? heads[0] : null;
  }, [form.subject, members]);

  const handleAdd = () => {
    if (!form.subject || !currentCollector) return;
    let explainerId: string | null = null;
    if (form.explainerSearch) {
      const found = members.find((m) => m.name === form.explainerSearch || m.name.includes(form.explainerSearch));
      if (found) explainerId = found.id;
    }
    addRestorationItem({
      subject: form.subject,
      collectorMemberId: currentCollector.id,
      explainerMemberIds: explainerId ? [explainerId] : [],
      questionRangeStart: form.questionRangeStart,
      questionRangeEnd: form.questionRangeEnd,
      totalQuestions: form.questionRangeEnd - form.questionRangeStart + 1,
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
  };

  const handleAutoSplit = () => {
    if (!splitForm.subject || splitForm.total <= 0) return;
    const group = STUDY_GROUPS.find(g => g.subjects.includes(splitForm.subject));
    
    // 강제로 해당 과목을 담당하는 "그룹"의 멤버 중 과목부장만 색출
    let heads = members.filter(m => m.groupId === group?.id && m.role === "subjectHead");
    
    const headIds = heads.map((h) => h.id);
    if (headIds.length === 0) {
      alert("해당 과목의 과목부장이 없습니다.");
      return;
    }
    autoSplitRestoration(splitForm.subject, splitForm.total, headIds);
  };

  const handleBulkAdd = () => {
    if (!form.subject || !currentCollector) return;
    
    const lines = bulkText.split("\n").filter((l) => l.trim() !== "");
    const parsedItems: { number: number; explainerIds: string[] }[] = [];
    
    // 탭으로 구분된 엑셀 복붙 형식인지 확인
    const isTsv = lines.some(l => l.includes("\t"));

    if (isTsv) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 헤더 줄 무시
        if (!line.trim() || line.includes("순번") || line.includes("이름") || line.includes("문제")) continue;
        
        const parts = line.split("\t").map(s => s.trim());
        if (parts.length < 2) continue;

        // "문항 -> 여러 명 배정" 형식인지 확인 (예: 1 \t 2 \t 김철수, 이영희)
        // 특징: 0번, 1번 값이 숫자이고, 2번째 값 이상에 한글(이름)이 있음
        const isQuestionToAssignees = !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1])) && parts.length >= 3 && /[가-힣]/.test(parts[2]);

        if (isQuestionToAssignees) {
          const qNum = parseInt(parts[0], 10);
          const namesString = parts.slice(2).join(" ");
          const names = namesString.split(/[\s,]+/).filter(n => n.trim() !== "");
          const explainerIds = names.map(n => members.find(m => m.name === n)?.id).filter(Boolean) as string[];
          if (!isNaN(qNum) && explainerIds.length > 0) {
            parsedItems.push({ number: qNum, explainerIds });
          }
        } else {
          // 기존 "사람 -> 여러 문항" 형식 (예: 1 \t 김철수 \t 1 \t 2)
          let nameIndex = 1;
          if (isNaN(parseInt(parts[0], 10)) && /[가-힣]/.test(parts[0])) {
            nameIndex = 0;
          }
          
          const name = parts[nameIndex];
          if (!name) continue;
          
          const explainerIds = [members.find((m) => m.name === name)?.id].filter(Boolean) as string[];
          
          for (let j = nameIndex + 1; j < parts.length; j++) {
            const qStr = parts[j];
            if (!qStr) continue;
            const qNums = qStr.match(/\d+/g);
            if (qNums) {
              qNums.forEach(qStrNum => {
                parsedItems.push({ number: parseInt(qStrNum, 10), explainerIds });
              });
            }
          }
        }
      }
    } else {
      // 기존 파싱 로직 (예: "1번 김철수", "2~4번 이영희")
      for (const line of lines) {
        const match = line.match(/(\d+)(?:[~-](\d+))?[^\w가-힣]*([가-힣\s,]+)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : start;
          const namesString = match[3];
          const names = namesString.split(/[\s,]+/).filter(n => n.trim() !== "");
          const explainerIds = names.map(n => members.find((m) => m.name === n)?.id).filter(Boolean) as string[];
          
          for (let i = start; i <= end; i++) {
            parsedItems.push({ number: i, explainerIds });
          }
        }
      }
    }
    
    if (parsedItems.length === 0) {
      alert("파싱된 항목이 없습니다. 형식을 확인해 주세요 (엑셀 표 복붙 또는 '1번 김철수' 형식)");
      return;
    }
    
    bulkUpdateRestorationItems(form.subject, currentCollector.id, parsedItems);
    setBulkText("");
  };

  const handleExcelImport = () => {
    if (!excelImportText.trim()) return;
    
    // 시험 날짜 찾기
    let targetDate = new Date().toISOString().split("T")[0];
    const subjectLectures = lectures.filter(l => l.subject === form.subject);
    
    if (form.subject === "PBL") {
       // PBL은 가장 마지막 날짜를 시험 날짜로 간주
       if (subjectLectures.length > 0) {
           targetDate = subjectLectures.reduce((max, l) => l.date > max ? l.date : max, subjectLectures[0].date);
       }
    } else {
       // 나머지는 entryType이 exam이거나, topic에 총괄평가가 포함된 항목
       const examLecture = subjectLectures.find(l => 
           l.entryType === "exam" || l.topic?.includes("총괄평가") || l.topic?.includes("평가")
       );
       if (examLecture) {
           targetDate = examLecture.date;
       } else if (subjectLectures.length > 0) {
           // 평가 강의가 없으면 해당 과목의 마지막 강의 날짜를 사용
           targetDate = subjectLectures.reduce((max, l) => l.date > max ? l.date : max, subjectLectures[0].date);
       }
    }

    const lines = excelImportText.trim().split("\n");
    const parsedScores = [];
    
    let nameCol = -1;
    let reasonCols: { index: number, name: string }[] = [];
    
    for (const line of lines) {
      const parts = line.split("\t").map((s) => s.trim());
      if (parts.length === 0) continue;

      // 헤더 줄 인식 (이름 + 감점/미복원/실패/총계 등이 포함된 줄)
      if (parts.some(p => p.includes("이름")) && parts.some(p => p.includes("감점") || p.includes("미복원") || p.includes("실패") || p.includes("총계"))) {
        nameCol = parts.findIndex(p => p.includes("이름"));
        
        // 감점 사유 열 찾기 (총계를 제외하고 개별 사유를 우선적으로)
        ["복원미흡", "사진미복원", "선지미복원", "완전실패"].forEach(reason => {
           const idx = parts.findIndex(p => p.includes(reason));
           if (idx !== -1) reasonCols.push({ index: idx, name: reason });
        });
        
        // 개별 사유가 없으면 총계(합계) 열을 사용
        if (reasonCols.length === 0) {
           const totalIdx = parts.findIndex(p => p.includes("총계") || p.includes("점수"));
           if (totalIdx !== -1) {
              reasonCols.push({ index: totalIdx, name: "복원 감점 (총계)" });
           }
        }
        continue;
      }
      
      if (nameCol !== -1 && reasonCols.length > 0) {
         // 피벗 테이블 데이터 줄 파싱
         let member = null;
         
         // 1. 지정된 이름 열에서 해설자 찾기 시도
         if (parts[nameCol]) {
             const nameMatch = parts[nameCol].match(/[가-힣]{2,4}/);
             if (nameMatch) {
                 member = members.find(m => m.name === nameMatch[0]);
             }
         }
         
         // 2. 못 찾았으면 줄 전체를 스캔하여 해설자 찾기 (구조가 틀어졌을 경우 대비)
         if (!member) {
             for (const p of parts) {
                 const nameMatch = p.match(/[가-힣]{2,4}/);
                 if (nameMatch) {
                     const possibleMember = members.find(m => m.name === nameMatch[0]);
                     if (possibleMember) {
                         member = possibleMember;
                         break;
                     }
                 }
             }
         }
         
         if (!member) continue;
         
         // 감점 사유별 점수 추가
         for (const rc of reasonCols) {
            const val = parseFloat(parts[rc.index]);
            if (!isNaN(val) && val !== 0) {
               parsedScores.push({
                   memberId: member.id,
                   amount: val,
                   reason: `[${form.subject}] ${rc.name}`,
                   date: targetDate
               });
            }
         }
      } else {
         // 기본 형식 (이름 \t 점수 \t 사유)
         if (parts.length >= 2) {
            const rawName = parts[0];
            const nameMatch = rawName.match(/[가-힣]{2,4}/);
            if (nameMatch) {
               const name = nameMatch[0];
               const score = parseFloat(parts[1]);
               if (!isNaN(score) && score !== 0) {
                  const member = members.find(m => m.name === name);
                  if (member) {
                     parsedScores.push({
                         memberId: member.id,
                         amount: score,
                         reason: `[${form.subject}] ${parts.length > 2 ? parts.slice(2).join(" ") : "엑셀 일괄 등록"}`,
                         date: targetDate
                     });
                  }
               }
            }
         }
      }
    }
    
    if (parsedScores.length === 0) {
      alert("파싱할 수 있는 유효한 데이터가 없습니다. 이름과 점수가 포함되어 있는지 확인하세요.");
      return;
    }
    
    addMemberExtraScores(parsedScores);
    setExcelImportText("");
    alert(`${parsedScores.length}건의 복원 감점 내역이 자동으로 반영되었습니다.`);
    setIsExcelImportOpen(false);
  };


  const handleSaveState = () => {
    const defaultMemo = `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} 저장본`;
    const memo = window.prompt("저장할 현황의 메모나 과목명을 입력하세요:", defaultMemo);
    if (memo !== null) {
      saveRestorationState(memo || defaultMemo);
      alert("현황이 저장되었습니다. '현황 불러오기'에서 확인할 수 있습니다.");
    }
  };

  const handleDownloadFile = () => {
    const dataStr = JSON.stringify(restorationItems, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restoration_state_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadState = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          if (confirm("현재 상태를 불러온 데이터로 덮어씌웁니다. 계속하시겠습니까?")) {
            setRestorationItems(json);
          }
        } else {
          alert("유효하지 않은 파일 형식입니다.");
        }
      } catch (err) {
        alert("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setActiveRole("subjectHead")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            activeRole === "subjectHead"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          👨‍💻 과목부장 모드 (실무)
        </button>
        <button
          onClick={() => setActiveRole("groupLeader")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            activeRole === "groupLeader"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          👑 그룹장 모드 (총괄)
        </button>
      </div>

      <div className="flex items-center gap-2">
        <ClipboardList size={22} className="text-indigo-600" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900">기출 복원 채점</h1>
          <p className="text-sm text-slate-500">
            수합자·해설자를 나눠 배정하고 누락/유효 해설을 입력하면 점수가 자동 계산됩니다.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleSaveState}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download size={14} /> 현황 저장
          </button>
          <button
            onClick={() => setIsLoadStateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Upload size={14} /> 현황 불러오기
          </button>
          
          <button
            onClick={handleDownloadFile}
            title="파일 백업용 다운로드"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <FileText size={14} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="백업 파일 업로드"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Upload size={14} />
          </button>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleLoadState} />
          <button
            onClick={() => {
              if (confirm("정말 모든 복원 문항 배정을 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다)")) {
                clearRestorationItems();
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 transition-colors"
          >
            <Trash2 size={14} /> 전체 배정 초기화
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setIsChecklistOpen(!isChecklistOpen)}
          className="flex w-full items-center justify-between bg-slate-50 p-4 transition-colors hover:bg-slate-100"
        >
          <p className="text-sm font-semibold text-slate-700">
            {activeRole === "subjectHead" ? "✅ 과목부장 실무 체크리스트" : "✅ 그룹장 총괄 체크리스트"}
          </p>
          {isChecklistOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        
        {isChecklistOpen && (
          <div className="p-4 pt-2 border-t border-slate-100 space-y-2">
            {examChecklist
              .filter((item) => item.role === activeRole)
              .map((item) => (
              <button
                key={item.id}
                onClick={() => toggleExamChecklistItem(item.id)}
                className="flex w-full items-center gap-2 text-left text-sm"
              >
                {item.done ? (
                  <CheckSquare size={17} className="shrink-0 text-indigo-600" />
                ) : (
                  <Square size={17} className="shrink-0 text-slate-300" />
                )}
                <span className={item.done ? "text-slate-400 line-through" : "text-slate-700"}>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeRole === "subjectHead" && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <label className="mb-1 block text-sm font-semibold text-slate-700">🔍 내 문항만 필터링 (이름 검색)</label>
              <input
                type="text"
                value={collectorSearch}
                onChange={(e) => setCollectorSearch(e.target.value)}
                placeholder="본인 이름을 입력하세요 (예: 김철수)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setIsBulkAddOpen(!isBulkAddOpen)}
              className="flex w-full items-center justify-between bg-slate-50 p-4 transition-colors hover:bg-slate-100"
            >
              <p className="text-sm font-semibold text-slate-700">📝 복원 명단 일괄 등록 (자동 파싱)</p>
              {isBulkAddOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>
            
            {isBulkAddOpen && (
              <div className="p-4 pt-2 border-t border-slate-100">
                <div className="mb-2 flex flex-col sm:grid sm:grid-cols-4 gap-3">
                  <select
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="col-span-2 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  >
                    {subjectOptions.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                  <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 flex items-center">
                    수합: {currentCollector ? currentCollector.name : "미배정"}
                  </div>
                </div>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"1번 김철수\n2~4번 이영희\n(복붙 시 자동 인식)"}
                  className="w-full h-32 rounded-lg border border-slate-200 p-3 text-sm leading-relaxed text-slate-700"
                />
                <button
                  onClick={handleBulkAdd}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95"
                >
                  <Plus size={16} /> 파싱 및 생성
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {activeRole === "groupLeader" && (
        <>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm mb-4">
            <h3 className="font-bold text-amber-800 mb-2">📌 그룹장 안내사항 (# 시험 월말까지)</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-amber-700">
              <li>해설 수합 후 해설 검토 후 재작성 요청</li>
              <li className="list-none pl-5 text-amber-600 font-medium">* 재작성 X 시 -3점, 가점은 1문제당 +1</li>
              <li>검토 후 pdf, 한글 드라이브에 업로드 (재시 없으면 여유롭게)</li>
              <li className="list-none pl-5 text-amber-600 font-medium">* 오탈자, 사진 누락 검토</li>
              <li>복원 수합자, 해설자들 스코어링 기입</li>
              <li>복원 감점 사항 학습부장이 넘기면 구글 시트에 기입</li>
            </ul>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setGroupLeaderTab("collection")}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                groupLeaderTab === "collection"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              📥 과목부장 수합·배정 통제
            </button>
            <button
              onClick={() => setGroupLeaderTab("explanation")}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                groupLeaderTab === "explanation"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              📝 해설 품질 평가
            </button>
          </div>
        </>
      )}

      {activeRole === "groupLeader" && groupLeaderTab === "collection" && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Split size={15} /> 시험 전날: 문제 n등분 자동 배정
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <select
            value={splitForm.subject}
            onChange={(e) => setSplitForm((f) => ({ ...f, subject: e.target.value }))}
            className="col-span-2 rounded-lg border border-slate-200 px-2 py-2 text-sm sm:col-span-1"
          >
            {subjectOptions.map((subj) => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={splitForm.total}
            onChange={(e) => setSplitForm((f) => ({ ...f, total: Number(e.target.value) }))}
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
            placeholder="총 문항 수"
          />
        </div>
        <button
          onClick={handleAutoSplit}
          className="mt-3 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-40"
        >
          <Split size={16} /> 과목부장에게 개별 {splitForm.total}문항 쪼개어 자동 배정
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-4">
        <button
          onClick={() => setIsExcelImportOpen(!isExcelImportOpen)}
          className="flex w-full items-center justify-between bg-slate-50 p-4 transition-colors hover:bg-slate-100"
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <FileText size={16} /> 복원 감점자 엑셀 붙여넣기 (일괄 등록)
          </p>
          {isExcelImportOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        
        {isExcelImportOpen && (
          <div className="p-4 pt-2 border-t border-slate-100">
            <p className="mb-2 text-[11px] text-slate-500">
              구글 시트의 피벗 테이블(이름, 복원미흡 등 헤더 포함) 전체를 복사해서 붙여넣으세요. 이 기능은 감점자만 기록하여 정산에 저장합니다 (수합 명단 건드리지 않음).
            </p>
            
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">적용 대상 과목 선택</label>
              <select
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {subjectOptions.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>
            
            <textarea
              value={excelImportText}
              onChange={(e) => setExcelImportText(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-3 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
              rows={5}
              placeholder="헤더행 포함 피벗 테이블 복사/붙여넣기..."
            />
            <button
              onClick={handleExcelImport}
              disabled={!excelImportText.trim()}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-95 disabled:opacity-40"
            >
              <CheckSquare size={16} /> 복원 감점자 기록 저장하기
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
          <FileText size={16} className="text-indigo-600" /> 방금 저장된 {form.subject} 감점 기록 (정산 반영 완료)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 rounded-tl-lg">이름</th>
                <th className="px-3 py-2">감점 점수</th>
                <th className="px-3 py-2">감점 사유</th>
                <th className="px-3 py-2 rounded-tr-lg">기록일</th>
              </tr>
            </thead>
            <tbody>
              {useDashboardStore.getState().memberExtraScores
                .filter(s => s.reason.includes(`[${form.subject}]`))
                .sort((a, b) => b.id.localeCompare(a.id))
                .slice(0, 10)
                .map(score => {
                  const m = members.find(m => m.id === score.memberId);
                  return (
                    <tr key={score.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{m?.name || "알수없음"}</td>
                      <td className="px-3 py-2 text-rose-600 font-bold">{score.amount}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{score.reason}</td>
                      <td className="px-3 py-2 text-slate-400 text-xs">{score.date}</td>
                    </tr>
                  );
                })}
              {useDashboardStore.getState().memberExtraScores.filter(s => s.reason.includes(`[${form.subject}]`)).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-xs border-b-0">
                    현재 선택된 과목에 저장된 감점 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

        </>
      )}

      <div className="space-y-4">
        {activeRole === "groupLeader" ? (
          // === 그룹장 모드 ===
          groupLeaderTab === "collection" ? (
            // 1) 수합 평가 탭
            Array.from(new Set(restorationItems.map((i) => i.subject))).map((subject) => {
              const itemsForSubject = restorationItems.filter((i) => i.subject === subject);
              const collectors = Array.from(new Set(itemsForSubject.map((i) => i.collectorMemberId)));

              return (
                <div key={subject} className="mb-6">
                  <h3 className="text-md font-bold text-slate-800 mb-3 border-b pb-2 border-slate-200">
                    📘 {subject}
                  </h3>
                  <div className="space-y-4">
                    {collectors.map((collectorId) => {
                      if (!collectorId) return null;
                      const collector = members.find((m) => m.id === collectorId);
                      const itemsForCollector = itemsForSubject.filter((i) => i.collectorMemberId === collectorId);
                      const representativeItem = itemsForCollector[0];
                      if (!representativeItem) return null;
                      
                      const collectionScore = itemsForCollector.reduce((sum, item) => sum + (item.collectionBonus || 0), 0);
                      const minQ = Math.min(...itemsForCollector.map(i => i.questionRangeStart));
                      const maxQ = Math.max(...itemsForCollector.map(i => i.questionRangeStart));
                      const rangeText = minQ === maxQ ? `${minQ}번` : `${minQ}번 ~ ${maxQ}번`;

                      return (
                        <div key={collectorId} className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden flex justify-between items-center p-4">
                          <div>
                            <h4 className="font-bold text-slate-800">
                              수합 담당: {collector?.name || "알 수 없음"} 
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                              총 {itemsForCollector.length}문항 할당됨 ({rangeText})
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-medium">부여된 수합 점수</p>
                              <p className={`text-lg font-bold ${collectionScore > 0 ? "text-indigo-600" : "text-slate-600"}`}>
                                {collectionScore > 0 ? "+" : ""}{collectionScore.toFixed(1)} pt
                              </p>
                            </div>
                            <button
                              onClick={() => setEvalCollectionItem({ item: representativeItem, totalQuestions: itemsForCollector.length })}
                              className="rounded-lg bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200 transition"
                            >
                              과목부장 수합 평가
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            // 2) 해설 품질 평가 탭
            <div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-6">
                <p className="mb-3 text-sm font-semibold text-slate-700">개별 복원 배정 추가</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <select
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="col-span-2 rounded-lg border border-slate-200 px-2 py-2 text-sm sm:col-span-1"
                  >
                    {subjectOptions.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 flex items-center">
                    수합 {currentCollector ? currentCollector.name : "미배정"}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      list="explainer-list"
                      value={form.explainerSearch}
                      onChange={(e) => setForm((f) => ({ ...f, explainerSearch: e.target.value }))}
                      placeholder="해설자 검색 (이름)"
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    />
                    <datalist id="explainer-list">
                      {members.map((m) => (
                        <option key={m.id} value={m.name} />
                      ))}
                    </datalist>
                  </div>
                  <input
                    type="number"
                    value={form.questionRangeStart}
                    onChange={(e) => setForm((f) => ({ ...f, questionRangeStart: Number(e.target.value) }))}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    placeholder="시작 번호"
                  />
                  <input
                    type="number"
                    value={form.questionRangeEnd}
                    onChange={(e) => setForm((f) => ({ ...f, questionRangeEnd: Number(e.target.value) }))}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    placeholder="끝 번호"
                  />
                </div>
                <button
                  onClick={handleAdd}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95"
                >
                  <Plus size={16} /> 배정 추가
                </button>
              </div>

              {Array.from(new Set(restorationItems.map((i) => i.subject))).map((subject) => {
                const itemsForSubject = restorationItems.filter((i) => i.subject === subject);
                
                // Group by Explainer
                const explainerIds = new Set<string>();
                itemsForSubject.forEach(item => {
                  if (item.explainerMemberIds && item.explainerMemberIds.length > 0) {
                    item.explainerMemberIds.forEach(id => explainerIds.add(id));
                  }
                });
                
                if (explainerIds.size === 0) return null;

                return (
                  <div key={subject} className="mb-6">
                    <h3 className="text-md font-bold text-slate-800 mb-3 border-b pb-2 border-slate-200">
                      📘 {subject}
                    </h3>
                    <div className="space-y-4">
                      {Array.from(explainerIds).map((explainerId) => {
                        const explainerName = explainerId === "unassigned" ? "미지정" : members.find((m) => m.id === explainerId)?.name || "알 수 없음";
                        const itemsForExplainer = itemsForSubject.filter((i) => 
                          (explainerId === "unassigned" && (!i.explainerMemberIds || i.explainerMemberIds.length === 0)) ||
                          (i.explainerMemberIds && i.explainerMemberIds.includes(explainerId))
                        );

                        if (itemsForExplainer.length === 0) return null;

                        const explainerMin = Math.min(...itemsForExplainer.map(i => i.questionRangeStart));
                        const explainerMax = Math.max(...itemsForExplainer.map(i => i.questionRangeEnd ?? i.questionRangeStart));
                        const explainerRangeText = explainerMin === explainerMax ? `${explainerMin}번` : `${explainerMin}번 ~ ${explainerMax}번`;

                      return (
                          <div key={explainerId} className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
                            <div className="bg-slate-50 p-4 border-b border-slate-200">
                              <h4 className="font-bold text-slate-800">
                                해설 담당: {explainerName} <span className="text-sm font-medium text-slate-500 ml-1">({explainerRangeText})</span>
                              </h4>
                            </div>
                            
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {itemsForExplainer.map((item) => {
                                const breakdown = scoreRestoration(item);
                                return (
                                  <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:shadow-md transition relative flex flex-col justify-between">
                                    <div>
                                      <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-slate-700 text-sm">
                                          {item.questionRangeStart === (item.questionRangeEnd ?? item.questionRangeStart) 
                                            ? `${item.questionRangeStart}번` 
                                            : `${item.questionRangeStart}번 ~ ${item.questionRangeEnd}번`}
                                        </span>
                                        <span className={`text-xs font-bold ${breakdown.total < 0 ? "text-rose-600" : "text-indigo-600"}`}>
                                          총점: {breakdown.explanationBonus + breakdown.rewritePenalty > 0 ? "+" : ""}{breakdown.explanationBonus + breakdown.rewritePenalty} pt
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-medium text-slate-500">가감점 퀵 수정</span>
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            step={0.5}
                                            value={item.explanationBonusManual || 0}
                                            onChange={(e) => updateRestorationItem(item.id, { explanationBonusManual: Number(e.target.value) })}
                                            className="w-16 rounded border border-slate-200 px-2 py-1 text-xs text-right font-bold text-indigo-600 focus:border-indigo-500 outline-none"
                                          />
                                          <span className="text-[11px] text-slate-400">pt</span>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => setEvalExplanationItem(item)}
                                        className="w-full rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-100 transition mt-auto"
                                      >
                                        상세 평가 (사유 작성)
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // === 과목부장 모드 (개별 문항 리스트) ===
          (() => {
            const filteredItems = restorationItems.filter((item) => {
              if (!collectorSearch.trim()) return true;
              const collector = members.find((m) => m.id === item.collectorMemberId);
              return collector?.name.includes(collectorSearch.trim());
            });

            const subjects = Array.from(new Set(filteredItems.map((i) => i.subject)));

            return subjects.map((subject) => {
              const subjectItems = filteredItems
                .filter((i) => i.subject === subject)
                .sort((a, b) => a.questionRangeStart - b.questionRangeStart);

              return (
                <div key={subject} className="mb-6">
                  <h3 className="text-md font-bold text-slate-800 mb-3 border-b pb-2 border-slate-200">
                    📘 {subject}
                  </h3>
                  <div className="space-y-3">
                    {subjectItems.map((item) => {
                      const explainerNames = (item.explainerMemberIds || [])
                        .map((id) => members.find((m) => m.id === id)?.name)
                        .filter(Boolean)
                        .join(", ");
                      const breakdown = scoreRestoration(item);
                      
                      return (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
                          <div className="flex-1 w-full">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                                {item.subject}
                              </span>
                              <span className="font-bold text-slate-800">{item.questionRangeStart}번</span>
                            </div>
                            
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">해설자 지정 (이름, 쉼표 구분)</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={explainerNames}
                                    placeholder="예: 김철수, 이영희"
                                    onChange={(e) => {
                                      const names = e.target.value.split(",").map((n) => n.trim()).filter((n) => n);
                                      const foundIds = names.map((n) => members.find((m) => m.name === n)?.id).filter(Boolean) as string[];
                                      updateRestorationItem(item.id, { 
                                        explainerMemberIds: foundIds,
                                        validExplanations: foundIds.length > 0 ? 1 : 0 
                                      });
                                    }}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                  상태 (감점) <span className="font-normal text-rose-500">{breakdown.missingPenalty ? `(${breakdown.missingPenalty}pt)` : ""}</span>
                                </label>
                                <select
                                  value={item.missingCount}
                                  onChange={(e) => updateRestorationItem(item.id, { missingCount: Number(e.target.value) })}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                >
                                  <option value={0}>정상 (0점)</option>
                                  <option value={1}>선지누락/사소한오류 (-1점)</option>
                                  <option value={5}>미흡 (-5점)</option>
                                  <option value={10}>완전실패 (-10점)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex sm:flex-col items-center justify-end w-full sm:w-auto gap-3 sm:border-l sm:border-slate-100 sm:pl-4">
                            <button
                              onClick={() => removeRestorationItem(item.id)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              title="항목 삭제"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>

      {evalCollectionItem && (
        <RestorationCollectionEvalModal
          item={evalCollectionItem.item}
          totalQuestions={evalCollectionItem.totalQuestions}
          collectorName={members.find((m) => m.id === evalCollectionItem.item.collectorMemberId)?.name ?? "알 수 없음"}
          onClose={() => setEvalCollectionItem(null)}
          onSave={(bonus, reason) => {
            updateRestorationItem(evalCollectionItem.item.id, {
              collectionBonus: bonus,
              collectionBonusReason: reason,
            });
          }}
        />
      )}

      {evalExplanationItem && (
        <RestorationExplanationEvalModal
          item={evalExplanationItem}
          explainerName={(evalExplanationItem.explainerMemberIds || [])
            .map((id) => members.find((m) => m.id === id)?.name)
            .filter(Boolean)
            .join(", ") || "알 수 없음"}
          onClose={() => setEvalExplanationItem(null)}
          onSave={(validCount, req, comp, pen, reason) => {
            updateRestorationItem(evalExplanationItem.id, {
              validExplanations: validCount,
              rewriteRequested: req,
              rewriteCompleted: comp,
              explanationAdjustmentReason: reason,
            });
          }}
        />
      )}

      {isLoadStateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">저장된 현황 불러오기</h2>
            
            <div className="max-h-[60vh] overflow-y-auto space-y-2 mb-4">
              {savedRestorationStates.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-6">저장된 현황이 없습니다.</p>
              ) : (
                savedRestorationStates.map(state => (
                  <div key={state.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50 hover:border-indigo-200 transition-colors group">
                    <button 
                      onClick={() => {
                        if (confirm(`'${state.memo}' 현황을 불러오시겠습니까? 현재 화면의 배정 내역은 덮어씌워집니다.`)) {
                          loadRestorationState(state.id);
                          setIsLoadStateModalOpen(false);
                        }
                      }}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-bold text-slate-800">{state.memo}</p>
                      <p className="text-xs text-slate-500 mt-1">{new Date(state.savedAt).toLocaleString()}</p>
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm("이 저장본을 삭제하시겠습니까?")) deleteRestorationState(state.id);
                      }}
                      className="p-2 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => setIsLoadStateModalOpen(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
