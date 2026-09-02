// <?™ìŠµë¶€ë°°ì •?? ?‘ì?(.xlsx ë°”ì´?????Œì‹±?´ì„œ ê°•ì˜+ë°°ì • ëª©ë¡??ë§Œë“ ??
// scripts/import_timetable.py + scripts/extract_assignments.py(?¤í¬?˜ì¹˜?¨ë“œ)?ì„œ
// ê²€ì¦í•œ ë¡œì§??ê·¸ë?ë¡???¸´ ê²????Œì¼ ?•ì‹??ë°”ë€Œë©´ ??ê³???ê°™ì´ ê³ ì³???œë‹¤.
//
// ê°•ì˜??ëª¨ì–‘(ê³¼ëª©/?œëª©/êµì‹œ/?Œìš”?œê°„)?€ <?œê°„?? ?œíŠ¸ë¥??•ë³¸?¼ë¡œ ?¼ëŠ”??
// <?™ìŠµë¶€ë°°ì •> ?œíŠ¸??C~G?´ì? ?œê°„?œë? ?˜ì‹?¼ë¡œ ë³µì‚¬?´ì˜¨ ê²ƒì´??ê°’ì? ê°™ì?ë§?
// ?€ ë³‘í•©(êµì‹œ ?©ì¹˜ê¸? ë²”ìœ„???œê°„?œì? ?¤ë? ???ˆì–´??ì´ë??˜ì´ ë³´ê¸° ì¢‹ê²Œ ?°ë¡œ
// ë³‘í•©?´ë‘” ê²½ìš°) ?Œìš”?œê°„ ê³„ì‚°?ëŠ” ?°ë©´ ???œë‹¤ ??<?™ìŠµë¶€ë°°ì •>?€ ?¤ì§ I~M?´ì˜
// ì´ˆì•ˆ??ê²€?ˆì ?´ë¦„??date+orderë¡?ë§¤ì¹­??ë¶™ì´???©ë„ë¡œë§Œ ?´ë‹¤.

const XLSX = require("xlsx");

const HOLIDAYS = new Set(["ì¶”ì„", "?œê???, "?€ì²´íœ´??, "?±íƒ„??, "? ì •", "ê°œì²œ??, "?„ì¶©??]);
const MEDICAL_INFORMATICS_KEYWORDS = [
  "?˜ë£Œ?•ë³´", "ë³‘ì›?•ë³´?œìŠ¤??, "ì§„ë£Œ?˜ì‚¬ê²°ì •?œìŠ¤??, "ì»´í“¨??ê¸°ë°˜ ?˜í•™êµìœ¡", "?˜ë£Œ?°ì´?°ë² ?´ìŠ¤", "?„ì?˜ë¬´ê¸°ë¡",
];
const COURSE_ALIASES = {
  "?Œë ˆë¥´ê¸°-ë¥˜ë§ˆ?°ìŠ¤": "?Œë ˆë¥´ê¸°-ë¥˜ë§ˆ?°ìŠ¤??,
  "?„ìƒ?œí˜„2(ê¸°ì¹¨, ?€?ˆì••)": "?„ìƒ?œí˜„2",
  "ê·¼ê³¨ê²©ê³„??: "ê·¼ê³¨ê²©í•™",
};
const KNOWN_COURSES = {
  "?ˆì•¡ì¢…ì–‘??: "major", "?œí™˜ê¸°í•™": "major", "?¸í¡ê¸°í•™": "major", "?ì‹?˜í•™": "major",
  "?Œë ˆë¥´ê¸°-ë¥˜ë§ˆ?°ìŠ¤??: "major", "?´ë¶„ë¹„í•™": "major", "? ê²½ê³„í•™": "major", "ê°ê°ê³„í•™": "major",
  "ê·¼ê³¨ê²©í•™": "major", "PBL3": "minor", "ë²•ì˜??: "minor", "ë°œì—´": "minor",
  "?˜ë£Œ?•ë³´??: "minor", "?„ìƒ?œí˜„2": "minor", "ê³µíœ´??: "minor",
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
  if (/(ì´ê´„?‰ê?|?¼ë“œë°?ê³¼ì •?•ì„±?‰ê?)/.test(raw)) return "exam";
  return "lecture";
}

function resolveCourse(raw, block) {
  if (HOLIDAYS.has(raw)) return "ê³µíœ´??;
  if (raw.indexOf("PBL") === 0) return "PBL3";
  if (raw === "ë²•ì˜??) return "ë²•ì˜??;
  if (raw.indexOf("ë°œì—´") === 0) return "ë°œì—´";
  if (MEDICAL_INFORMATICS_KEYWORDS.some((k) => raw.indexOf(k) !== -1)) return "?˜ë£Œ?•ë³´??;
  if (raw.indexOf("ê³¼ì •?•ì„±?‰ê?") === 0) return block ? normalizeCourse(block) : null;
  const m = raw.match(/^(.+?)\s*(ì´ê´„?‰ê?|?¼ë“œë°?/);
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
 * ?˜ì‹?¼ë¡œ ?°ê²°??? ì§œ ?€(?? =?œê°„??C3)?€ SheetJSê°€ ë¶€?™ì†Œ?˜ì  ?¤ì°¨ ?Œë¬¸?? * ?•í™•???ì •???„ë‹Œ ê°??? 8/31 00:00 ?€??8/30 23:59:08)?¼ë¡œ ?Œì‹±?˜ê¸°???œë‹¤.
 * ?˜ë£¨(86400000ms) ?¨ìœ„ë¡?ë°˜ì˜¬ë¦¼í•´???¤ì°¨ë¥??œê±°?œë‹¤.
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
    const n = norm(cellAt(settingsSheet, r, 20)); // T??    if (n) titles.add(n);
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
      if (v && v.indexOf("?œì™¸??ê°•ì˜ëª?) !== -1) {
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
      if (n && n.indexOf("?œì™¸??ê°•ì˜ëª?) === -1) {
        titles.add(n);
      }
    }
  }
  return titles;
}

/** ê°?ì£¼ì°¨ ?¤ë” ?‰ì—??C~G????ê¸? ? ì§œë¥??½ì–´ ?°ë„ ë³´ì •ê¹Œì? ?ìš©?œë‹¤. */
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
    throw new Error(`ë³´ì • ??ì²?? ì§œ ${isoDate(cm.y, cm.m, cm.d)}ê°€ ?”ìš”?¼ì´ ?„ë‹™?ˆë‹¤.`);
  }
  return dates;
}

/** <?œê°„?? ?œíŠ¸ ??ê°•ì˜ ëª¨ì–‘???•ë³¸. */
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
          throw new Error(`ê³¼ëª©??ê²°ì •?˜ì? ëª»í–ˆ?µë‹ˆ?? ${isoDate(dates[col].y, dates[col].m, dates[col].d)} "${raw}" (block=${block})`);
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
          period: span.rows === 1 ? `${order}êµì‹œ` : `${order}~${order + span.rows - 1}êµì‹œ`,
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

  // <?¤ì •> R?´ì— ì§€?•ëœ "?™ìŠµë¶€ ?µí•©" ê°•ì˜??ë°”ë¡œ ??ê°•ì˜?€ ???™ìŠµë¶€ë¡??©ì³ì§„ë‹¤.
  // ???ˆì˜ ?˜ë™ "?©ì¹˜ê¸?(merge_next, scheduleActions.ts) ê¸°ëŠ¥ê³?ê°™ì? ëª¨ì–‘??  // ?´ì•¼ ?œë‹¤: ?¡ìˆ˜?˜ëŠ” ê°•ì˜??ì§€?°ì? ?Šê³  status "shifted" + noteë¥??¬ì•„
  // ê·¸ë?ë¡??¨ê¸°ê³??”ë©´???ë¦¬ê²?SHIFTED ë°°ì?ë¡??œì‹œ?? ë°°ì •?€ "ë¯¸ë°°?? ì²˜ë¦¬),
  // ??ê°•ì˜ ìª½ì—” ?œê°„???”í•˜ê³??œëª©??"A & B"ë¡??©ì¹œ??ê³¼ëª©ëª…ì? ??ê±´ë“œë¦???  // scheduleActions.ts??merge_next??topicë§??©ì¹˜ì§€ subject??ê·¸ë?ë¡??”ë‹¤).
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
        // ë³‘í•© ?€?ì´ ë°”ë¡œ ?¤ìŒ êµì‹œê°€ ?„ë‹ˆ???¨ì–´ì§?êµì‹œ???˜ë„ ?ˆì–´???? 1êµì‹œ +
        // 3êµì‹œ), endTime??r???¤ì œ ???œê°???„ë‹ˆ??prev.startTime + ?©ì‚°
        // durationHoursë¡??¤ì‹œ ê³„ì‚°?œë‹¤ ??ê·¸ë˜???¤ì œ ?Œìš”?œê°„ê³??”ë©´ ?œì‹œê°€ ë§ëŠ”??
        const [startHour, startMin] = prev.startTime.split(":");
        prev.endTime = `${pad2(parseInt(startHour, 10) + prev.durationHours)}:${startMin}`;
        const lastOrder = r.order + r.durationHours - 1;
        prev.period = lastOrder === prev.order ? `${prev.order}êµì‹œ` : `${prev.order}~${lastOrder}êµì‹œ`;

        r.shifted = true;
        r.note = `${prev.period}ë¡?ë³‘í•©??;
      }
    }
    mergedRecords.push(r);
  }

  // <?¤ì •> T?´ì— ì§€?•ëœ "?™ìŠµë¶€ ë¶„í• " ê°•ì˜???€ 2ê°?4ëª??´ë?ë¡?ê°•ì˜ ?ì²´ë¥?ë³µì œ?œë‹¤.
  const expanded = [];
  mergedRecords.forEach((r) => {
    if (r.split && r.assignable) {
      [1, 2].forEach((team) => {
        const clone = Object.assign({}, r);
        clone.topic = `${r.topic} (${team}?€ ë°°ì •)`;
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

  // ê²°ì •??id ??src/lib/mockData.ts generateLectures()?€ ë°˜ë“œ??ê°™ì? ê·œì¹™.
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
 * <?™ìŠµë¶€ë°°ì •> ?œíŠ¸ ???¤ì§ I~M??ì´ˆì•ˆ??ê²€?ˆì ?´ë¦„)ë§??½ëŠ”?? C~G?´ì? date+orderë¥? * ì°¾ëŠ” ?¤ë¡œë§??°ê³ , ???œíŠ¸ ?ì²´???€ ë³‘í•© ë²”ìœ„(?Œìš”?œê°„)??? ë¢°?˜ì? ?ŠëŠ”??
 * "?µí•©"(ì§§ì? ??êµì‹œê°€ ???€?¼ë¡œ ë°°ì •)?€ I~M???ì²´ê°€ ë³‘í•©???ˆìœ¼ë¯€ë¡?ê·??µì»¤ë¥??°ë¼ê°„ë‹¤.
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

  // key `${date}_${order}` -> pairs ë°°ì—´ (ë¶„í•  ê°•ì˜??pairê°€ 2ê°?
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
        if (!raw) continue; // ?¤ì œ ê°•ì˜ê°€ ?ˆëŠ” ì¹¸ë§Œ(?‰ê?/ê³µíœ´???¬í•¨ ???´ì°¨??assignableë§??˜ì¤‘???€)

        const asgKey = memberAnchor[`${row}_${col + 6}`] || `${row}_${col + 6}`;
        const [asgRowStr, asgColStr] = asgKey.split("_");
        const asgRaw = cell(parseInt(asgRowStr, 10), parseInt(asgColStr, 10));
        const names = String(asgRaw || "").split("\n").map((s) => s.replace(/[^°¡-ÆR]/g, '')).filter(Boolean);
        const pairs = [];
        for (let i = 0; i + 1 < names.length; i += 2) pairs.push([names[i], names[i + 1]]);
        if (pairs.length === 0) continue;

        const key = `${isoDate(dates[col].y, dates[col].m, dates[col].d)}_${order}`;
        const arr = byKey.get(key) ?? [];
        // ê°™ì? (date,order)???´ë? ??ª©???ˆìœ¼ë©?ê°™ì? ë³‘í•© ?ì—­ ?ˆì˜ ?¤ë¥¸ ?”ì¼ ì¹¸ì„
        // ì¤‘ë³µ?¼ë¡œ ?¤ì‹œ ?½ëŠ” ê²½ìš°???†ì?ë§? ë°©ì–´?ìœ¼ë¡? ?©ì¹˜ì§€ ?Šê³  ê·¸ë?ë¡??”ë‹¤.
        if (arr.length === 0) byKey.set(key, pairs);
      }
    }
  }

  return byKey;
}

/** xlsx ë°”ì´??Buffer) -> ê°•ì˜ ?ˆì½”??ë°°ì—´ (draftName/proofName ?¬í•¨). */
function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const timetableSheet = wb.Sheets["?œê°„??];
  const assignmentSheet = wb.Sheets["?™ìŠµë¶€ë°°ì •"];
  if (!timetableSheet) throw new Error("<?œê°„?? ?œíŠ¸ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.");
  if (!assignmentSheet) throw new Error("<?™ìŠµë¶€ë°°ì •> ?œíŠ¸ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.");

  const splitTitles = loadSplitTitles(wb.Sheets["?¤ì •"]);
  const mergeTitles = loadMergeTitles(wb.Sheets["?¤ì •"]);
  const lectures = parseTimetableSheet(timetableSheet, splitTitles, mergeTitles);
  const pairsByKey = parseAssignmentPairs(assignmentSheet);

  // ë¶„í•  ê°•ì˜(?€ 2ê°???ê°™ì? date+orderë¡?lecture ?ˆì½”?œê? 2ê°??˜ì˜¤ë¯€ë¡?
  // ê°™ì? ?¤ì˜ pairs ë°°ì—´???±ì¥ ?œì„œ?€ë¡??˜ë‚˜???Œë¹„?œë‹¤.
  const cursor = new Map();
  lectures.forEach((r) => {
    // ?¡ìˆ˜??shifted) ê°•ì˜???ë˜ ?ê¸° ?€???ˆì—ˆ?”ë¼??ë³‘í•©??ê°•ì˜ ìª½ìœ¼ë¡?    // ?¡ìˆ˜?ë‹¤ê³?ë³´ê³  "ë¯¸ë°°?? ì²˜ë¦¬?œë‹¤ ??scheduleActions.ts??merge_next?€ ?™ì¼.
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

