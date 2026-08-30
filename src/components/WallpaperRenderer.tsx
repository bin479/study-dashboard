import { forwardRef } from "react";
import { Lecture, Assignment, Member } from "@/lib/types";
import { formatShortDate } from "@/lib/dates";
import { findGroupBySubject } from "@/lib/roles";
import { STUDY_GROUPS } from "@/lib/studyGroups";

interface Props {
  lectures: Lecture[];
  assignments: Assignment[];
  members: Member[];
  deviceModel: string;
  tabletLayout: "1col" | "2col";
  weeksCount: number;
  startWeekIndex: number;
  allWeeks: any[];
  hideAssignees?: boolean;
}

const WEEKDAYS = ["월", "화", "수", "목", "금"];

function getTimeRow(time: string) {
  const h = parseInt(time.split(":")[0]);
  if (h < 9) return 2;
  return h - 9 + 2; 
}

function getLectureColor(lecture: Lecture) {
  if (lecture.entryType === "exam") return "bg-yellow-300 text-slate-900 font-bold border-yellow-400";
  if (lecture.entryType === "holiday") return "bg-rose-100 text-rose-800 border-rose-200";
  if (lecture.subject === "일정") return "bg-amber-400 text-slate-900 font-bold border-amber-500";
  if (lecture.subject === "PBL3") return "bg-blue-200 text-slate-800 border-blue-300";

  const group = findGroupBySubject(STUDY_GROUPS, lecture.subject);
  if (group) return "bg-[#fbe4d5] text-slate-900 border-[#f4c8b2]";

  if (lecture.subjectType === "major") return "bg-indigo-50 text-indigo-900 border-indigo-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export const WallpaperRenderer = forwardRef<HTMLDivElement, Props>(({
  lectures,
  assignments,
  members,
  deviceModel,
  tabletLayout,
  weeksCount,
  startWeekIndex,
  allWeeks,
  hideAssignees = false,
}, ref) => {
  const selectedWeeks = allWeeks.slice(startWeekIndex, startWeekIndex + weeksCount);
  const memberName = (id: string | null) => members.find(m => m.id === id)?.name || "미배정";

  const getDeviceConfig = (model: string) => {
    switch (model) {
      case "phone_standard": return { width: '1170px', height: '2532px', topPadding: '480px', isTablet: false };
      case "phone_flip": return { width: '1080px', height: '2640px', topPadding: '500px', isTablet: false };
      case "phone_fold_out": return { width: '904px', height: '2316px', topPadding: '450px', isTablet: false };
      case "tablet_ipad": return { width: '2732px', height: '2048px', topPadding: '160px', isTablet: true };
      case "tablet_galaxy": return { width: '2560px', height: '1600px', topPadding: '160px', isTablet: true };
      case "tablet_fold_in": return { width: '2176px', height: '1812px', topPadding: '160px', isTablet: true };
      default: return { width: '1170px', height: '2532px', topPadding: '480px', isTablet: false };
    }
  };

  const config = getDeviceConfig(deviceModel);
  const is2Col = config.isTablet && tabletLayout === "2col";
  
  let scaleFactor = 1;
  if (!is2Col) {
    if (weeksCount === 2) scaleFactor = 0.85;
    if (weeksCount === 3) scaleFactor = 0.65;
    if (weeksCount === 4) scaleFactor = 0.50;
  } else {
    if (weeksCount > 2) scaleFactor = 0.85;
  }

  const renderWeek = (week: any) => {
    const weekDates = week.days.map((d: any) => d[0]);

    return (
      <div key={week.monday} className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
        <div 
          className="w-full flex-1 grid min-h-0" 
          style={{ 
            gridTemplateColumns: "80px repeat(5, minmax(0, 1fr))",
            gridTemplateRows: "auto repeat(10, minmax(0, 1fr))"
          }}
        >
          {/* Header Row */}
          <div className="bg-[#1f2937] text-white flex flex-col items-center justify-center text-[15px] font-bold border-b border-r border-slate-700 py-2">
            <span>{week.label}</span>
          </div>
          {weekDates.map((dateStr: string, i: number) => (
            <div key={dateStr} className="bg-slate-100 flex items-center justify-center text-sm font-bold border-b border-r border-slate-300 py-2">
              {formatShortDate(dateStr)} ({WEEKDAYS[i]})
            </div>
          ))}

          {/* Time Sidebar */}
          {[1,2,3,4, "lunch", 5,6,7,8,9].map((period, i) => (
            <div key={i} className="flex flex-col items-center justify-center border-b border-r border-slate-200 bg-white py-1.5" style={{ gridColumn: 1, gridRow: i + 2 }}>
              {period === "lunch" ? (
                <span className="text-xs font-medium text-slate-500 text-center">13:00<br/>|<br/>14:00</span>
              ) : (
                <>
                  <span className="text-[15px] font-bold text-slate-800">{period}</span>
                  <span className="text-[11px] text-slate-400">
                    ({i < 4 ? `0${i + 9}` : i + 9}:00)
                  </span>
                </>
              )}
            </div>
          ))}

          {/* Lunch Row Span */}
          <div className="flex items-center justify-center bg-slate-50 border-b border-slate-200 text-[13px] font-bold text-slate-500 tracking-wide" style={{ gridColumn: "2 / span 5", gridRow: 6 }}>
            점심시간 (13:00 - 14:00)
          </div>

          {/* Empty Background Cells */}
          {weekDates.map((dateStr: string, colIndex: number) => {
            return [1,2,3,4, 5,6,7,8,9].map((period) => {
              const startHour = period <= 4 ? 8 + period : 9 + period;
              const row = startHour - 9 + 2; 
              return (
                <div
                  key={`bg-${dateStr}-${period}`}
                  className="border-b border-r border-slate-100/50"
                  style={{ gridColumn: colIndex + 2, gridRow: row, zIndex: 0 }}
                />
              );
            });
          })}

          {/* Lectures */}
          {weekDates.map((dateStr: string, colIndex: number) => {
            const dayLecturesMap = week.days.find((d: any) => d[0] === dateStr);
            const dayLectures: Lecture[] = dayLecturesMap ? dayLecturesMap[1] : [];
            
            const notAbsorbed = dayLectures.filter((l) => l.status !== "shifted");
            const groupedLectures = new Map<string, Lecture[]>();
            notAbsorbed.forEach(l => {
              const key = `${l.startTime}_${l.durationHours}`;
              if (!groupedLectures.has(key)) groupedLectures.set(key, []);
              groupedLectures.get(key)!.push(l);
            });

            return Array.from(groupedLectures.values()).map(group => {
              const lecture = group[0];
              const isSplit = group.length > 1;
              const startRow = lecture.startTime ? getTimeRow(lecture.startTime) : 2;
              const endRow = lecture.endTime ? getTimeRow(lecture.endTime) : startRow + lecture.durationHours;
              const isInactive = lecture.status === "cancelled";
              const actualEndRow = endRow > 11 ? 12 : endRow; 
              
              const isShort = (actualEndRow - startRow) <= 1;
              
              const titleText = lecture.topic && lecture.topic !== lecture.subject 
                ? (isSplit ? lecture.topic.replace(/\s*\(\d+팀 배정\)/, "") : lecture.topic)
                : `${lecture.subject}${lecture.sessionNumber ? ` ${lecture.sessionNumber}번` : ""}`;
                
              const textLen = titleText.length;
              let titleSize = hideAssignees 
                ? (isShort ? 18 : 24)
                : (isShort ? 14 : 18);
              if (textLen > 12) titleSize -= 2;
              if (textLen > 18) titleSize -= 2;
              if (textLen > 25) titleSize -= 2;
              
              let detailsSize = hideAssignees
                ? Math.max(titleSize - 3, 12)
                : (isShort ? 10 : 13);
              if (isSplit) detailsSize -= 1;
              if (group.length > 2) detailsSize -= 1;

              titleSize = Math.max(8, Math.round(titleSize * scaleFactor));
              detailsSize = Math.max(6, Math.round(detailsSize * scaleFactor));

              return (
                <div
                  key={lecture.id}
                  className={`m-[3px] rounded-[10px] border ${scaleFactor < 0.8 ? 'p-0.5' : 'p-1'} flex flex-col justify-center items-center text-center overflow-hidden shadow-sm
                    ${getLectureColor(lecture)}
                    ${isInactive ? "opacity-50" : ""}
                  `}
                  style={{
                    gridColumn: colIndex + 2,
                    gridRow: `${startRow} / ${actualEndRow}`,
                    zIndex: 10
                  }}
                >
                  <div className="flex flex-col items-center justify-center w-full h-full px-0.5">
                    {isShort ? (
                      <>
                        <p style={{ fontSize: `${titleSize}px` }} className="font-bold leading-tight break-keep line-clamp-2">
                          {titleText} {lecture.professor && <span style={{ fontSize: `${detailsSize}px`, fontWeight: 'normal', opacity: 0.9 }}>({lecture.professor})</span>}
                        </p>
                        {!hideAssignees && lecture.assignable && (
                          <div style={{ fontSize: `${detailsSize}px` }} className="mt-0.5 opacity-85 font-medium leading-tight text-center tracking-tight flex flex-wrap justify-center gap-x-1 gap-y-0.5">
                            {(() => {
                              const allRows = group.flatMap(l => {
                                const lAssignments = assignments.filter((a) => a.lectureId === l.id);
                                return lAssignments.map(a => ({ a, lId: l.id }));
                              });
                              if (allRows.length === 0) return <span>미배정</span>;
                              return allRows.map(({ a }, idx) => (
                                <div key={idx}>초:{memberName(a.draftMemberId)} / 검:{memberName(a.proofMemberId)}</div>
                              ));
                            })()}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: `${titleSize}px` }} className="font-bold leading-tight break-keep line-clamp-3">
                          {titleText}
                        </p>
                        {lecture.professor && (
                          <p style={{ fontSize: `${detailsSize}px` }} className="mt-0.5 opacity-90 font-medium">
                            ({lecture.professor})
                          </p>
                        )}
                        {!hideAssignees && lecture.assignable && (
                          <div style={{ fontSize: `${detailsSize}px` }} className="mt-1 opacity-85 font-medium leading-tight text-center tracking-tight">
                            {(() => {
                              const allRows = group.flatMap(l => {
                                const lAssignments = assignments.filter((a) => a.lectureId === l.id);
                                return lAssignments.map(a => ({ a, lId: l.id }));
                              });
                              if (allRows.length === 0) return <span>미배정</span>;
                              return allRows.map(({ a }, idx) => (
                                <div key={idx} className={idx > 0 ? "mt-0.5" : ""}>초:{memberName(a.draftMemberId)} / 검:{memberName(a.proofMemberId)}</div>
                              ));
                            })()}
                          </div>
                        )}
                      </>
                    )}
                    {lecture.status !== "scheduled" && (
                      <span className="mt-1 inline-block rounded bg-black/10 px-1 py-0.5 text-[9px] font-bold uppercase">
                        {lecture.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            });
          })}
        </div>
      </div>
    );
  };

  let { width, height } = config;
  if (config.isTablet) {
    const w = parseInt(config.width);
    const h = parseInt(config.height);
    if (tabletLayout === "1col" && w > h) {
      width = `${h}px`;
      height = `${w}px`;
    } else if (tabletLayout === "2col" && w < h) {
      width = `${h}px`;
      height = `${w}px`;
    }
  }

  return (
    <div
      ref={ref}
      style={{
        width,
        height,
        backgroundColor: '#f8fafc',
        paddingLeft: config.isTablet ? '60px' : '40px',
        paddingRight: config.isTablet ? '60px' : '40px',
        paddingTop: config.topPadding,
        paddingBottom: '120px',
        overflow: 'hidden'
      }}
      className="font-sans box-border flex flex-col"
    >
      <div className="mb-10 text-center shrink-0">
        <h1 className="text-[42px] font-extrabold text-slate-800 tracking-tight">학습부 시간표</h1>
        <p className="text-[22px] text-slate-500 mt-2 font-medium">{selectedWeeks[0].range} ~ {selectedWeeks[selectedWeeks.length - 1].range}</p>
      </div>

      <div className={`flex-1 min-h-0 ${is2Col ? "grid grid-cols-2 gap-8" : "flex flex-col gap-6"}`}>
        {selectedWeeks.map(renderWeek)}
      </div>
    </div>
  );
});

WallpaperRenderer.displayName = "WallpaperRenderer";
