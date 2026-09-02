// <학습부배정표> 엑셀(.xlsx 바이트)을 파싱해서 강의+배정 목록을 만든다.
// scripts/import_timetable.py + scripts/extract_assignments.py(스크래치패드)에서
// 검증한 로직을 그대로 옮긴 것 — 파일 형식이 바뀌면 두 곳 다 같이 고쳐야 한다.
//
// 강의의 모양(과목/제목/교시/소요시간)은 <시간표> 시트를 정본으로 삼는다.
// <학습부배정> 시트의 C~G열은 시간표를 수식으로 복사해온 것이라 값은 같지만,
// 셀 병합(교시 합치기) 범위는 시간표와 다를 수 있어서(총대님이 보기 좋게 따로
// 병합해둔 경우) 소요시간 계산에는 쓰면 안 된다 — <학습부배정>은 오직 I~M열의
// 초안자/검안자 이름을 date+order로 매칭해 붙이는 용도로만 쓴다.

const XLSX = require("xlsx");

const HOLIDAYS = new Set(["추석", "한글날", "대체휴일", "성탄절", "신정", "개천절", "현충일"]);
const MEDICAL_INFORMATICS_KEYWORDS = [
  "의료정보", "병원정보시스템", "진료의사결정시스템", "컴퓨터 기반 의학교육", "의료데이터베이스", "전자의무기록",
];
const COURSE_ALIASES = {
  "알레르기-류마티스": "알레르기-류마티스학",
  "임상표현2(기침, 저혈압)": "임상표현2",
  "근골격계학": "근골격학",
};
const KNOWN_COURSES = {
  "혈액종양학": "major", "순환기학": "major", "호흡기학": "major", "생식의학": "major",
  "알레르기-류마티스학": "major", "내분비학": "major", "신경계학": "major", "감각계학": "major",
  "근골격학": "major", "PBL3": "minor", "법의학": "minor", "발열": "minor",
  "의료정보학": "minor", "임상표현2": "minor", "공휴일": "minor",
};

function norm(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeCourse(name) {
  name = name.trim();
  name = COURSE_ALIASES[name] || name;
  const stripped = name.replace(/\([^)]*\)/g, "").trim();
  return COURSE_ALIASES[stripped] || stripped || name;
}

function classifyEntry(raw) {
  if (HOLIDAYS.has(raw)) return "holiday";
  if (raw.indexOf("KAMC") !== -1) return "exam";
  if (/(총괄평가|피드백|과정형성평가)/.test(raw)) return "exam";
  return "lecture";
}

function resolveCourse(raw, block) {
  if (HOLIDAYS.has(raw)) return "공휴일";
  if (raw.indexOf("PBL") === 0) return "PBL3";
  if (raw === "법의학") return "법의학";
  if (raw.indexOf("발열") === 0) return "발열";
  if (MEDICAL_INFORMATICS_KEYWORDS.some((k) => raw.indexOf(k) !== -1)) return "의료정보학";
  if (raw.indexOf("과정형성평가") === 0) return block ? normalizeCourse(block) : null;
  const m = raw.match(/^(.+?)\s*(총괄평가|피드백)/);
  if (m) return normalizeCourse(m[1]);
  if (block) return normalizeCourse(block);
  return null;
}

function splitTopicProfessor(raw) {
  const m = raw.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (m && m[2].trim()) return [m[1].trim(), m[2].trim()];
  return [raw.trim(), ""];
}

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}
function isoDate(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * 수식으로 연결된 날짜 셀(예: =시간표!C3)은 SheetJS가 부동소수점 오차 때문에
 * 정확히 자정이 아닌 값(예: 8/31 00:00 대신 8/30 23:59:08)으로 파싱하기도 한다.
 * 하루(86400000ms) 단위로 반올림해서 오차를 제거한다.
 */
function snapToUTCDay(date) {
  const dayMs = 86400000;
  return new Date(Math.round(date.getTime() / dayMs) * dayMs);
}

function cellAt(sheet, r, c) {
  const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
  const cellObj = sheet[addr];
  if (!cellObj) return null;
  return cellObj.v === undefined ? null : cellObj.v;
}

function buildMergeMaps(sheet) {
  const merges = sheet["!merges"] || [];
  const anchorSpan = {};
  const memberAnchor = {};
  merges.forEach((m) => {
    const r0 = m.s.r + 1;
    const c0 = m.s.c + 1;
    const rows = m.e.r - m.s.r + 1;
    const cols = m.e.c - m.s.c + 1;
    anchorSpan[`${r0}_${c0}`] = { rows, cols };
    for (let r = r0; r < r0 + rows; r++) {
      for (let c = c0; c < c0 + cols; c++) {
        memberAnchor[`${r}_${c}`] = `${r0}_${c0}`;
      }
    }
  });
  return { anchorSpan, memberAnchor };
}

function loadSplitTitles(settingsSheet) {
  if (!settingsSheet) return new Set();
  const range = settingsSheet["!ref"] ? XLSX.utils.decode_range(settingsSheet["!ref"]) : null;
  if (!range) return new Set();
  const maxRow = range.e.r + 1;
  const titles = new Set();
  for (let r = 3; r <= maxRow; r++) {
    const n = norm(cellAt(settingsSheet, r, 20)); // T열
    if (n) titles.add(n);
  }
  return titles;
}

function loadMergeTitles(settingsSheet) {
  if (!settingsSheet) return new Set();
  const range = settingsSheet["!ref"] ? XLSX.utils.decode_range(settingsSheet["!ref"]) : null;
  if (!range) return new Set();
  const maxRow = range.e.r + 1;
  const maxCol = range.e.c + 1;
  
  let targetCol = -1;
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const v = norm(cellAt(settingsSheet, r, c));
      if (v && v.indexOf("제외할 강의명") !== -1) {
        targetCol = c;
        break;
      }
    }
    if (targetCol !== -1) break;
  }
  
  const titles = new Set();
  if (targetCol !== -1) {
    for (let r = 3; r <= maxRow; r++) {
      const n = norm(cellAt(settingsSheet, r, targetCol));
      if (n && n.indexOf("제외할 강의명") === -1) {
        titles.add(n);
      }
    }
  }
  return titles;
}

/** 각 주차 헤더 행에서 C~G열(월~금) 날짜를 읽어 연도 보정까지 적용한다. */
function readWeekDates(cell, headerRow) {
  const rawDates = {};
  for (let col = 3; col <= 8; col++) {
    const v = cell(headerRow, col);
    if (v instanceof Date) {
      const snapped = snapToUTCDay(v);
      rawDates[col] = { y: snapped.getUTCFullYear(), m: snapped.getUTCMonth() + 1, d: snapped.getUTCDate() };
    }
  }
  const cols = Object.keys(rawDates);
  if (cols.length === 0) return null;

  const minCol = Math.min(...cols.map(Number));
  const monday = rawDates[minCol];
  const yearShift = monday.y <= 2025 ? 1 : 0;

  const dates = {};
  cols.forEach((col) => {
    const dd = rawDates[col];
    dates[col] = { y: dd.y + yearShift, m: dd.m, d: dd.d };
  });

  const cm = dates[minCol];
  if (new Date(cm.y, cm.m - 1, cm.d).getDay() !== 1) {
    throw new Error(`보정 후 첫 날짜 ${isoDate(cm.y, cm.m, cm.d)}가 월요일이 아닙니다.`);
  }
  return dates;
}

/** <시간표> 시트 — 강의 모양의 정본. */
function parseTimetableSheet(sheet, splitTitles, mergeTitles) {
  const { anchorSpan, memberAnchor } = buildMergeMaps(sheet);
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const maxRow = range.e.r + 1;
  const cell = (r, c) => cellAt(sheet, r, c);

  const weekHeaderRows = [];
  for (let r = 1; r <= maxRow; r++) {
    if (cell(r, 3) instanceof Date) weekHeaderRows.push(r);
  }
  weekHeaderRows.push(maxRow + 1);

  let records = [];
  let previousBlock = null;

  for (let idx = 0; idx < weekHeaderRows.length - 1; idx++) {
    const headerRow = weekHeaderRows[idx];
    const endRow = weekHeaderRows[idx + 1];
    const dates = readWeekDates(cell, headerRow);
    if (!dates) continue;

    let block = null;
    for (let row = headerRow + 1; row < endRow; row++) {
      const label = norm(cell(row, 2));
      if (label && label.indexOf("13:00-14:00") !== -1) {
        for (let col = 3; col <= 8; col++) {
          const val = norm(cell(row, col));
          if (val) {
            block = val;
            break;
          }
        }
        break;
      }
    }
    if (block === null) block = previousBlock;
    else previousBlock = block;

    for (let row = headerRow + 1; row < endRow; row++) {
      const periodNo = cell(row, 1);
      const timeLabel = norm(cell(row, 2));
      if (typeof periodNo !== "number") continue;
      const tm = /^\(?(\d{2}):(\d{2})-/.exec(timeLabel || "");
      if (!tm) continue;
      const startHour = parseInt(tm[1], 10);
      const startMin = parseInt(tm[2], 10);

      for (let col = 3; col <= 8; col++) {
        const key = `${row}_${col}`;
        if ((memberAnchor[key] || key) !== key) continue;
        const raw = norm(cell(row, col));
        if (!raw || !dates[col]) continue;
        const span = anchorSpan[key] || { rows: 1, cols: 1 };
        if (span.cols > 1) continue;

        const course = resolveCourse(raw, block);
        if (!course || !(course in KNOWN_COURSES)) {
          throw new Error(`과목을 결정하지 못했습니다: ${isoDate(dates[col].y, dates[col].m, dates[col].d)} "${raw}" (block=${block})`);
        }

        const entryType = classifyEntry(raw);
        const [topic, professor] = splitTopicProfessor(raw);
        const endHour = startHour + span.rows;
        const dateIso = isoDate(dates[col].y, dates[col].m, dates[col].d);
        const order = Math.round(periodNo);

        records.push({
          raw,
          date: dateIso,
          order,
          period: span.rows === 1 ? `${order}교시` : `${order}~${order + span.rows - 1}교시`,
          subject: course,
          topic,
          professor,
          subjectType: KNOWN_COURSES[course],
          durationHours: span.rows,
          startTime: `${pad2(startHour)}:${pad2(startMin)}`,
          endTime: `${pad2(endHour)}:${pad2(startMin)}`,
          entryType,
          assignable: entryType === "lecture",
          split: splitTitles.has(raw),
        });
      }
    }
  }

  records.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));

  // <설정> R열에 지정된 "학습부 통합" 강의는 바로 앞 강의와 한 학습부로 합쳐진다.
  // 앱 안의 수동 "합치기"(merge_next, scheduleActions.ts) 기능과 같은 모양을
  // 내야 한다: 흡수되는 강의는 지우지 않고 status "shifted" + note를 달아
  // 그대로 남기고(화면에 흐리게/SHIFTED 배지로 표시됨, 배정은 "미배정" 처리),
  // 앞 강의 쪽엔 시간을 더하고 제목을 "A & B"로 합친다(과목명은 안 건드림 —
  // scheduleActions.ts의 merge_next도 topic만 합치지 subject는 그대로 둔다).
  const mergedRecords = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (mergeTitles.has(r.raw) && mergedRecords.length > 0) {
      let prevIndex = mergedRecords.length - 1;
      while (prevIndex >= 0 && (mergedRecords[prevIndex].date !== r.date || mergedRecords[prevIndex].shifted)) {
        prevIndex--;
      }
      if (prevIndex >= 0) {
        const prev = mergedRecords[prevIndex];
        const prevTopic = prev.topic && prev.topic !== prev.subject ? prev.topic : prev.subject;
        const curTopic = r.topic && r.topic !== r.subject ? r.topic : r.subject;
        if (!prevTopic.includes(curTopic)) prev.topic = `${prevTopic} & ${curTopic}`;
        prev.durationHours += r.durationHours;
        // 병합 대상이 바로 다음 교시가 아니라 떨어진 교시일 수도 있어서(예: 1교시 +
        // 3교시), endTime을 r의 실제 끝 시각이 아니라 prev.startTime + 합산
        // durationHours로 다시 계산한다 — 그래야 실제 소요시간과 화면 표시가 맞는다.
        const [startHour, startMin] = prev.startTime.split(":");
        prev.endTime = `${pad2(parseInt(startHour, 10) + prev.durationHours)}:${startMin}`;
        const lastOrder = r.order + r.durationHours - 1;
        prev.period = lastOrder === prev.order ? `${prev.order}교시` : `${prev.order}~${lastOrder}교시`;

        r.shifted = true;
        r.note = `${prev.period}로 병합됨`;
      }
    }
    mergedRecords.push(r);
  }

  // <설정> T열에 지정된 "학습부 분할" 강의는 팀 2개(4명)이므로 강의 자체를 복제한다.
  const expanded = [];
  mergedRecords.forEach((r) => {
    if (r.split && r.assignable) {
      [1, 2].forEach((team) => {
        const clone = Object.assign({}, r);
        clone.topic = `${r.topic} (${team}팀 배정)`;
        clone.team = team;
        expanded.push(clone);
      });
    } else {
      expanded.push(r);
    }
  });
  records = expanded;

  const counters = {};
  records.forEach((r) => {
    if (r.assignable) {
      counters[r.subject] = (counters[r.subject] || 0) + 1;
      r.sessionNumber = String(counters[r.subject]);
    }
  });

  // 결정적 id — src/lib/mockData.ts generateLectures()와 반드시 같은 규칙.
  const seen = {};
  records.forEach((r) => {
    const key = `${r.date}_${r.order}`;
    seen[key] = (seen[key] || 0) + 1;
    const base = `lec_${r.date.replace(/-/g, "")}_${r.order}`;
    r.id = seen[key] === 1 ? base : `${base}_${seen[key]}`;
  });

  return records;
}

/**
 * <학습부배정> 시트 — 오직 I~M열(초안자/검안자 이름)만 읽는다. C~G열은 date+order를
 * 찾는 키로만 쓰고, 이 시트 자체의 셀 병합 범위(소요시간)는 신뢰하지 않는다.
 * "통합"(짧은 두 교시가 한 팀으로 배정)은 I~M열 자체가 병합돼 있으므로 그 앵커를 따라간다.
 */
function parseAssignmentPairs(sheet) {
  const { memberAnchor } = buildMergeMaps(sheet);
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const maxRow = range.e.r + 1;
  const cell = (r, c) => cellAt(sheet, r, c);

  const weekHeaderRows = [];
  for (let r = 1; r <= maxRow; r++) {
    if (cell(r, 3) instanceof Date) weekHeaderRows.push(r);
  }
  weekHeaderRows.push(maxRow + 1);

  // key `${date}_${order}` -> pairs 배열 (분할 강의는 pair가 2개)
  const byKey = new Map();

  for (let idx = 0; idx < weekHeaderRows.length - 1; idx++) {
    const headerRow = weekHeaderRows[idx];
    const endRow = weekHeaderRows[idx + 1];
    const dates = readWeekDates(cell, headerRow);
    if (!dates) continue;

    for (let row = headerRow + 1; row < endRow; row++) {
      const periodNo = cell(row, 1);
      const timeLabel = norm(cell(row, 2));
      if (typeof periodNo !== "number") continue;
      if (!/^\(?(\d{2}):(\d{2})-/.test(timeLabel || "")) continue;
      const order = Math.round(periodNo);

      for (let col = 3; col <= 8; col++) {
        if (!dates[col]) continue;
        const raw = norm(cell(row, col));
        if (!raw) continue; // 실제 강의가 있는 칸만(평가/공휴일 포함 — 어차피 assignable만 나중에 씀)

        const asgKey = memberAnchor[`${row}_${col + 6}`] || `${row}_${col + 6}`;
        const [asgRowStr, asgColStr] = asgKey.split("_");
        const asgRaw = cell(parseInt(asgRowStr, 10), parseInt(asgColStr, 10));
        const names = String(asgRaw || "").split("\n").map((s) => s.replace(/[^가-힣]/g, '')).filter(Boolean);
        const pairs = [];
        for (let i = 0; i + 1 < names.length; i += 2) pairs.push([names[i], names[i + 1]]);
        if (pairs.length === 0) continue;

        const key = `${isoDate(dates[col].y, dates[col].m, dates[col].d)}_${order}`;
        const arr = byKey.get(key) ?? [];
        // 같은 (date,order)에 이미 항목이 있으면(같은 병합 영역 안의 다른 요일 칸을
        // 중복으로 다시 읽는 경우는 없지만, 방어적으로) 합치지 않고 그대로 둔다.
        if (arr.length === 0) byKey.set(key, pairs);
      }
    }
  }

  return byKey;
}

/** xlsx 바이트(Buffer) -> 강의 레코드 배열 (draftName/proofName 포함). */
function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const timetableSheet = wb.Sheets["시간표"];
  const assignmentSheet = wb.Sheets["학습부배정"];
  if (!timetableSheet) throw new Error("<시간표> 시트를 찾을 수 없습니다.");
  if (!assignmentSheet) throw new Error("<학습부배정> 시트를 찾을 수 없습니다.");

  const splitTitles = loadSplitTitles(wb.Sheets["설정"]);
  const mergeTitles = loadMergeTitles(wb.Sheets["설정"]);
  const lectures = parseTimetableSheet(timetableSheet, splitTitles, mergeTitles);
  const pairsByKey = parseAssignmentPairs(assignmentSheet);

  // 분할 강의(팀 2개)는 같은 date+order로 lecture 레코드가 2개 나오므로,
  // 같은 키의 pairs 배열을 등장 순서대로 하나씩 소비한다.
  const cursor = new Map();
  lectures.forEach((r) => {
    // 흡수된(shifted) 강의는 원래 자기 팀이 있었더라도 병합된 강의 쪽으로
    // 흡수됐다고 보고 "미배정" 처리한다 — scheduleActions.ts의 merge_next와 동일.
    if (!r.assignable || r.shifted) {
      r.draftName = null;
      r.proofName = null;
      return;
    }
    const key = `${r.date}_${r.order}`;
    const pairs = pairsByKey.get(key);
    const i = cursor.get(key) ?? 0;
    cursor.set(key, i + 1);
    const pair = pairs && pairs[i];
    r.draftName = pair ? pair[0] : null;
    r.proofName = pair ? pair[1] : null;
  });

  return lectures;
}

function buildPayload(records) {
  return records.map((r) => ({
    id: r.id,
    date: r.date,
    period: r.period,
    order: r.order,
    subject: r.subject,
    topic: r.topic,
    professor: r.professor,
    subjectType: r.subjectType,
    durationHours: r.durationHours,
    startTime: r.startTime,
    endTime: r.endTime,
    entryType: r.entryType,
    assignable: r.assignable,
    sessionNumber: r.sessionNumber || null,
    draftName: r.draftName ?? null,
    proofName: r.proofName ?? null,
    shifted: !!r.shifted,
    note: r.note ?? null,
  }));
}

module.exports = { parseWorkbook, buildPayload };
