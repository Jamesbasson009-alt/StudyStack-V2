/**
 * Shared parsing core for UP module timetable PDFs.
 *
 * This file has NO dependency on pdfjs-dist. It only knows how to turn
 * already-extracted text items ({ str, x, y, page }) into timetable
 * records. Both the browser parser (pdfParser.js) and the Node test
 * script (test-parser.mjs) extract text items using their own pdfjs
 * entry point, then hand the items to this module — so the column
 * boundaries, row-grouping, and record-building logic exists in exactly
 * one place.
 */

/**
 * Escapes a single CSV field value.
 * Wraps in double quotes when the value contains commas, quotes, or newlines.
 * Also strips leading formula-injection characters (e.g. =CMD(...) in Excel).
 * @param {*} value
 * @returns {string}
 */
export function csvEscape(value) {
  const str = String(value == null ? '' : value);
  const safe = str.replace(/^[=+\-@\t\r]/, "'$&");
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export const DAYS_SET = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
export const MODULE_RE = /^[A-Z]{2,4}\s+\d{3}$/;

// Column X boundaries detected from the UP PDF table layout. Re-derive these
// if UP changes its export format.
export const COLUMNS = {
  module:    { min: 30,  max: 90  },  // Module code (e.g. "ALL 121")
  offered:   { min: 90,  max: 135 },  // Semester (e.g. "S2")
  group:     { min: 135, max: 175 },  // Group (e.g. "G01")
  lang:      { min: 175, max: 215 },  // Language + Activity (e.g. "E L")
  period:    { min: 215, max: 260 },  // Period label (e.g. "L1", "P1")
  day:       { min: 260, max: 325 },  // Day (e.g. "Monday")
  time:      { min: 325, max: 400 },  // Time range (e.g. "09:30 - 10:20")
  venue:     { min: 400, max: 555 },  // Venue name
  campus:    { min: 555, max: 640 },  // Campus (e.g. "HATFIELD")
  studyProg: { min: 640, max: 999 },  // Study prog — ignored
};

export function classifyColumn(x) {
  for (const [col, range] of Object.entries(COLUMNS)) {
    if (x >= range.min && x < range.max) return col;
  }
  return null;
}

/**
 * Groups raw extracted text items into horizontal visual rows by y-clustering.
 * @param {Array<{str: string, x: number, y: number, page?: number}>} items
 */
export function groupIntoRows(items, yTolerance = 4) {
  const rows = [];
  let currentRow = [];
  let currentY = null;

  for (const item of items) {
    if (currentY === null || Math.abs(item.y - currentY) <= yTolerance) {
      currentRow.push(item);
      if (currentY === null) currentY = item.y;
    } else {
      if (currentRow.length) {
        currentRow.sort((a, b) => a.x - b.x);
        rows.push(currentRow);
      }
      currentRow = [item];
      currentY = item.y;
    }
  }
  if (currentRow.length) {
    currentRow.sort((a, b) => a.x - b.x);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Parses grouped rows into timetable records with context propagation
 * (continuation rows like "L2 Thursday ..." inherit module/semester/group/
 * language/activity/campus from the last full row).
 */
export function parseRows(rows) {
  const records = [];
  let ctx = null;

  for (const row of rows) {
    const cellsByCol = {};
    for (const item of row) {
      const col = classifyColumn(item.x);
      if (col) {
        if (!cellsByCol[col]) cellsByCol[col] = [];
        cellsByCol[col].push(item.str);
      }
    }

    const moduleText = (cellsByCol.module || []).join(' ');
    if (moduleText === 'Module' || moduleText === 'Lectures') continue;

    const langText = (cellsByCol.lang || []).join(' ').trim();
    const dayText = (cellsByCol.day || []).join(' ').trim();
    const timeText = (cellsByCol.time || []).join(' ').trim();
    const venueText = (cellsByCol.venue || []).join(' ').trim();
    const campusText = (cellsByCol.campus || []).join(' ').trim();
    const periodText = (cellsByCol.period || []).join(' ').trim();

    if (!DAYS_SET.has(dayText) || !timeText) continue;

    let module, semester, group, language, activity;

    if (MODULE_RE.test(moduleText.trim())) {
      module = moduleText.trim();
      semester = (cellsByCol.offered || []).join(' ').trim();
      group = (cellsByCol.group || []).join(' ').trim();

      const langParts = langText.split(/\s+/);
      if (langParts.length >= 2) {
        language = langParts[0];
        activity = langParts[1];
      } else if (langParts.length === 1) {
        language = langParts[0];
        activity = '';
      } else {
        language = '';
        activity = '';
      }

      ctx = { module, semester, group, language, activity, campus: campusText || '' };
    } else if (ctx) {
      module = ctx.module;
      semester = ctx.semester;
      group = ctx.group;
      language = ctx.language;
      activity = ctx.activity;
    } else {
      continue;
    }

    const campus = campusText || (ctx ? ctx.campus : '') || '';
    if (campusText && ctx) {
      ctx.campus = campusText;
    }

    const act = (activity || 'L').toUpperCase().trim();
    const period = periodText || (act ? act + '1' : 'L1');

    records.push({
      module,
      semester,
      group,
      language,
      activity: act,
      period,
      day: dayText,
      time: timeText,
      venue: venueText,
      campus,
    });
  }

  return records;
}

/**
 * Builds an escaped CSV string from parsed records (protects against
 * CSV/formula injection via csvEscape — previously defined but unused).
 */
export function buildCsv(records) {
  const header = 'module,semester,group,language,activity,day,time,venue,campus';
  const rows = records.map(r =>
    [r.module, r.semester, r.group, r.language, r.activity, r.day, r.time, r.venue, r.campus]
      .map(csvEscape)
      .join(',')
  );
  return [header, ...rows].join('\n');
}
