/**
 * 학습부배정표 구글 시트 → 대시보드 자동 동기화.
 *
 * 설치 방법:
 *   1. 이 구글 시트에서 확장 프로그램 > Apps Script 를 연다.
 *   2. 기본 생성된 Code.gs 내용을 전부 지우고 이 파일 내용을 붙여넣는다.
 *   3. 아래 WEBHOOK_URL, SECRET 값을 채운다 (SECRET은 Netlify 환경변수
 *      SHEET_SYNC_SECRET과 반드시 똑같은 값이어야 한다).
 *   4. 함수 선택 드롭다운에서 createTrigger 를 고르고 ▶ 실행 — 처음 한 번은
 *      권한 승인 화면이 뜨는데, 본인 계정으로 허용하면 된다.
 *   5. 이후로는 시트를 수정할 때마다 자동으로 syncNow()가 실행되어 대시보드에 반영된다.
 *
 * 확인: 실행할 때마다 남는 로그는 Apps Script 편집기 왼쪽 "실행" 메뉴에서 볼 수 있다.
 *       과목을 못 알아본 강의가 있으면 에러가 나면서 그 강의명이 로그에 그대로 찍힌다.
 */

const WEBHOOK_URL = "https://YOUR-SITE.netlify.app/.netlify/functions/sheet-sync"; // 실제 Netlify 사이트 주소로 교체
const SECRET = "REPLACE_WITH_A_LONG_RANDOM_SECRET"; // Netlify 환경변수 SHEET_SYNC_SECRET과 동일한 값

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

function norm_(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeCourse_(name) {
  name = name.trim();
  name = COURSE_ALIASES[name] || name;
  const stripped = name.replace(/\([^)]*\)/g, "").trim();
  return COURSE_ALIASES[stripped] || stripped || name;
}

function classifyEntry_(raw) {
  if (HOLIDAYS.has(raw)) return "holiday";
  if (raw.indexOf("KAMC") !== -1) return "exam";
  if (/(총괄평가|피드백|과정형성평가)/.test(raw)) return "exam";
  return "lecture";
}

function resolveCourse_(raw, block) {
  if (HOLIDAYS.has(raw)) return "공휴일";
  if (raw.indexOf("PBL") === 0) return "PBL3";
  if (raw === "법의학") return "법의학";
  if (raw.indexOf("발열") === 0) return "발열";
  if (MEDICAL_INFORMATICS_KEYWORDS.some((k) => raw.indexOf(k) !== -1)) return "의료정보학";
  if (raw.indexOf("과정형성평가") === 0) return block ? normalizeCourse_(block) : null;
  const m = raw.match(/^(.+?)\s*(총괄평가|피드백)/);
  if (m) return normalizeCourse_(m[1]);
  if (block) return normalizeCourse_(block);
  return null;
}

function splitTopicProfessor_(raw) {
  const m = raw.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (m && m[2].trim()) return [m[1].trim(), m[2].trim()];
  return [raw.trim(), ""];
}

function pad2_(n) {
  return n < 10 ? "0" + n : "" + n;
}
function isoDate_(y, m, d) {
  return `${y}-${pad2_(m)}-${pad2_(d)}`;
}

function buildMergeMaps_(sheet) {
  const ranges = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).getMergedRanges();
  const anchorSpan = {};
  const memberAnchor = {};
  ranges.forEach((rng) => {
    const r0 = rng.getRow();
    const c0 = rng.getColumn();
    const rows = rng.getNumRows();
    const cols = rng.getNumColumns();
    anchorSpan[`${r0}_${c0}`] = { rows, cols };
    for (let r = r0; r < r0 + rows; r++) {
      for (let c = c0; c < c0 + cols; c++) {
        memberAnchor[`${r}_${c}`] = `${r0}_${c0}`;
      }
    }
  });
  return { anchorSpan, memberAnchor };
}

function loadSplitTitles_(ss) {
  const sheet = ss.getSheetByName("설정");
  if (!sheet) return new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return new Set();
  const values = sheet.getRange(3, 20, lastRow - 2, 1).getValues(); // T열
  const titles = new Set();
  values.forEach(([v]) => {
    const n = norm_(v);
    if (n) titles.add(n);
  });
  return titles;
}

/** <학습부배정> 시트 하나만 읽는다 — C~G열(강의)과 I~M열(초안/검안)이 같은 행 구조를 공유한다. */
function parseSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("학습부배정");
  if (!sheet) throw new Error("<학습부배정> 시트를 찾을 수 없습니다.");
  const splitTitles = loadSplitTitles_(ss);
  const { anchorSpan, memberAnchor } = buildMergeMaps_(sheet);

  const maxRow = sheet.getLastRow();
  const maxCol = sheet.getLastColumn();
  const values = sheet.getRange(1, 1, maxRow, maxCol).getValues();
  const cell = (r, c) => (r < 1 || r > maxRow || c < 1 || c > maxCol ? null : values[r - 1][c - 1]);

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

    const rawDates = {};
    for (let col = 3; col <= 8; col++) {
      const v = cell(headerRow, col);
      if (v instanceof Date) rawDates[col] = { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
    }
    const cols = Object.keys(rawDates);
    if (cols.length === 0) continue;

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
      throw new Error(`보정 후 첫 날짜 ${isoDate_(cm.y, cm.m, cm.d)}가 월요일이 아닙니다.`);
    }

    let block = null;
    for (let row = headerRow + 1; row < endRow; row++) {
      const label = norm_(cell(row, 2));
      if (label && label.indexOf("13:00-14:00") !== -1) {
        for (let col = 3; col <= 8; col++) {
          const val = norm_(cell(row, col));
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
      const timeLabel = norm_(cell(row, 2));
      if (typeof periodNo !== "number") continue;
      const tm = /^\(?(\d{2}):(\d{2})-/.exec(timeLabel || "");
      if (!tm) continue;
      const startHour = parseInt(tm[1], 10);
      const startMin = parseInt(tm[2], 10);

      for (let col = 3; col <= 8; col++) {
        const key = `${row}_${col}`;
        if ((memberAnchor[key] || key) !== key) continue; // 병합 영역의 앵커가 아님
        const raw = norm_(cell(row, col));
        if (!raw || !dates[col]) continue;
        const span = anchorSpan[key] || { rows: 1, cols: 1 };
        if (span.cols > 1) continue; // 여러 요일에 걸친 배너

        const course = resolveCourse_(raw, block);
        if (!course || !(course in KNOWN_COURSES)) {
          throw new Error(`과목을 결정하지 못했습니다: ${isoDate_(dates[col].y, dates[col].m, dates[col].d)} "${raw}" (block=${block})`);
        }

        const entryType = classifyEntry_(raw);
        const [topic, professor] = splitTopicProfessor_(raw);
        const endHour = startHour + span.rows;
        const dateIso = isoDate_(dates[col].y, dates[col].m, dates[col].d);
        const order = Math.round(periodNo);

        // 배정 칸은 +6열(I=C+6 ... M=G+6). 학습부배정 시트는 배정 칸을 자체적으로
        // 병합하기도 하므로(통합 — 짧은 연속 두 교시가 한 팀으로 배정), 배정 칸의
        // 병합 앵커를 따로 따라가야 한다.
        const asgKey = memberAnchor[`${row}_${col + 6}`] || `${row}_${col + 6}`;
        const [asgRowStr, asgColStr] = asgKey.split("_");
        const asgRaw = cell(parseInt(asgRowStr, 10), parseInt(asgColStr, 10));
        const names = String(asgRaw || "").split("\n").map((s) => s.trim()).filter(Boolean);
        const pairs = [];
        for (let i = 0; i + 1 < names.length; i += 2) pairs.push([names[i], names[i + 1]]);

        records.push({
          date: dateIso,
          order,
          period: span.rows === 1 ? `${order}교시` : `${order}~${order + span.rows - 1}교시`,
          subject: course,
          topic,
          professor,
          subjectType: KNOWN_COURSES[course],
          durationHours: span.rows,
          startTime: `${pad2_(startHour)}:${pad2_(startMin)}`,
          endTime: `${pad2_(endHour)}:${pad2_(startMin)}`,
          entryType,
          assignable: entryType === "lecture",
          split: splitTitles.has(raw),
          pairs,
        });
      }
    }
  }

  records.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));

  // <설정> T열에 지정된 "학습부 분할" 강의는 팀 2개(4명)이므로 강의 자체를 복제한다.
  const expanded = [];
  records.forEach((r) => {
    if (r.split && r.assignable) {
      [1, 2].forEach((team) => {
        const clone = Object.assign({}, r);
        clone.topic = `${r.topic} (${team}팀 배정)`;
        clone.pairs = r.pairs[team - 1] ? [r.pairs[team - 1]] : [];
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

  // 결정적 id — src/lib/mockData.ts의 generateLectures()와 반드시 같은 규칙이어야
  // 웹훅 동기화가 기존 강의를 갱신하지, 매번 새 강의를 만들지 않는다.
  const seen = {};
  records.forEach((r) => {
    const key = `${r.date}_${r.order}`;
    seen[key] = (seen[key] || 0) + 1;
    const base = `lec_${r.date.replace(/-/g, "")}_${r.order}`;
    r.id = seen[key] === 1 ? base : `${base}_${seen[key]}`;
  });

  return records;
}

function buildPayload_(records) {
  return records.map((r) => {
    const pair = r.pairs[0];
    return {
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
      draftName: pair ? pair[0] : null,
      proofName: pair ? pair[1] : null,
    };
  });
}

/** 시트가 바뀔 때마다(또는 수동으로) 실행되는 진입점. */
function syncNow() {
  const records = parseSheet_();
  const payload = buildPayload_(records);
  const res = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: { "x-sync-secret": SECRET },
    payload: JSON.stringify({ lectures: payload }),
    muteHttpExceptions: true,
  });
  Logger.log(`${res.getResponseCode()} ${res.getContentText()}`);
}

/** 처음 설치할 때 한 번만 실행 — 이후 시트 변경 시 자동으로 syncNow()가 돈다. */
function createTrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "syncNow") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncNow").forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onChange().create();
  Logger.log("트리거 설치 완료 — 이제 시트를 수정하면 자동으로 동기화됩니다.");
}
