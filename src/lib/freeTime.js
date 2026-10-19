// src/lib/freeTime.js
// Pure helpers: turn timetable events into compact busy slots, then find the
// windows where everyone is free at once.

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const FULL_DAY_NAMES = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday',
};

// The campus day the comparison covers (first period starts 07:30, last ends 18:30).
export const DAY_START = 7 * 60 + 30;
export const DAY_END = 18 * 60 + 30;

const TIME_RE = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/;

/**
 * Timetable events (from recordsToEvents) -> compact, shareable busy slots:
 * { d: 'Mon', s: 450, e: 500, m: 'COS 132', a: 'Lecture', g: 'G01' }  (s/e in minutes from midnight)
 */
export function toBusyEvents(events) {
  const out = [];
  const seen = new Set();
  for (const ev of events || []) {
    if (!WEEKDAYS.includes(ev.day)) continue;
    let s;
    let e;
    const m = TIME_RE.exec(ev.fullTime || '');
    if (m) {
      s = Number(m[1]) * 60 + Number(m[2]);
      e = Number(m[3]) * 60 + Number(m[4]);
    } else {
      const [h, mi] = String(ev.time || '').split(':').map(Number);
      if (Number.isNaN(h)) continue;
      s = h * 60 + (mi || 0);
      e = s + (ev.duration || 1) * 60;
    }
    if (!(e > s)) continue;
    const key = `${ev.day}|${s}|${e}|${ev.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ d: ev.day, s, e, m: ev.title, a: ev.activityLabel || '', g: ev.group || '' });
  }
  return out.sort((x, y) => WEEKDAYS.indexOf(x.d) - WEEKDAYS.indexOf(y.d) || x.s - y.s);
}

export function fmtTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function fmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/**
 * people: [{ name: 'You', events: busySlots }, { name: 'Alex', events: busySlots }, ...]
 * Returns { days: { Mon: { windows, minutes }, ... }, totalMinutes, longest }.
 * Each window: { start, end, minutes, wholeDay, after: [...], before: [...] } where
 * after/before list the classes that bound the window ({ who, module, activity }).
 */
export function freeTogether(people, minMinutes = 60) {
  const days = {};
  let totalMinutes = 0;
  let longest = null;

  for (const day of WEEKDAYS) {
    const tagged = [];
    for (const p of people) {
      for (const ev of p.events || []) {
        if (ev.d === day) tagged.push({ who: p.name, module: ev.m, activity: ev.a, s: ev.s, e: ev.e });
      }
    }

    // Union of everyone's busy time, clamped to the campus day.
    const busy = tagged
      .map((t) => [Math.max(t.s, DAY_START), Math.min(t.e, DAY_END)])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [s, e] of busy) {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    }

    const gaps = [];
    let cursor = DAY_START;
    for (const [s, e] of merged) {
      if (s > cursor) gaps.push([cursor, s]);
      cursor = Math.max(cursor, e);
    }
    if (cursor < DAY_END) gaps.push([cursor, DAY_END]);

    const windows = gaps
      .filter(([s, e]) => e - s >= minMinutes)
      .map(([s, e]) => ({
        start: s,
        end: e,
        minutes: e - s,
        wholeDay: s === DAY_START && e === DAY_END,
        // Boundaries of a gap are real class edges, so match on exact times.
        after: s > DAY_START
          ? tagged.filter((t) => t.e === s).map(({ who, module, activity }) => ({ who, module, activity }))
          : [],
        before: e < DAY_END
          ? tagged.filter((t) => t.s === e).map(({ who, module, activity }) => ({ who, module, activity }))
          : [],
      }));

    const minutes = windows.reduce((sum, w) => sum + w.minutes, 0);
    totalMinutes += minutes;
    for (const w of windows) {
      if (!longest || w.minutes > longest.minutes) longest = { ...w, day };
    }
    days[day] = { windows, minutes };
  }

  return { days, totalMinutes, longest };
}

function describeClasses(list) {
  const seen = new Set();
  const parts = [];
  for (const x of list) {
    const owner = x.who === 'You' ? 'your' : `${x.who}'s`;
    const label = `${owner} ${x.module}${x.activity ? ` ${x.activity.toLowerCase()}` : ''}`;
    if (!seen.has(label)) {
      seen.add(label);
      parts.push(label);
    }
  }
  if (parts.length > 3) return `${parts.slice(0, 3).join(', ')} +${parts.length - 3} more`;
  if (parts.length > 1) return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return parts[0] || '';
}

/** "After Alex's INF 214 lecture · Until your COS 132 tutorial" */
export function describeWindow(w) {
  if (w.wholeDay) return 'No classes for any of you';
  const from = w.after.length ? `After ${describeClasses(w.after)}` : 'From the start of the day';
  const to = w.before.length ? `until ${describeClasses(w.before)}` : 'to the end of the day';
  return `${from}, ${to}`;
}

/** Plain-text version of the result, for pasting into a chat. */
export function summaryText({ names, semester, result }) {
  const lines = [`Free together (${names.join(' + ')}, ${semester}):`];
  for (const day of WEEKDAYS) {
    const d = result.days[day];
    if (!d.windows.length) continue;
    const slots = d.windows.map((w) => (w.wholeDay ? 'all day' : `${fmtTime(w.start)}-${fmtTime(w.end)}`));
    lines.push(`${FULL_DAY_NAMES[day]}: ${slots.join(', ')}`);
  }
  if (lines.length === 1) lines.push('No shared free time of that length.');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Availability grid, group windows and same-class detection           */
/* ------------------------------------------------------------------ */

/**
 * Exact availability for 2+ people. For each weekday the campus day is cut at every
 * class start/end, so each segment has a constant set of busy people. Adjacent
 * segments with the same busy people are merged.
 * Returns { total, days: { Mon: { segments, events }, ... } } where a segment is
 * { start, end, free, freeNames, busy: [{ who, module, activity }] }.
 */
export function availabilityGrid(people) {
  const total = people.length;
  const allNames = people.map((p) => p.name);
  const days = {};

  for (const day of WEEKDAYS) {
    const events = [];
    for (const p of people) {
      for (const ev of p.events || []) {
        if (ev.d !== day) continue;
        const s = Math.max(ev.s, DAY_START);
        const e = Math.min(ev.e, DAY_END);
        if (e > s) events.push({ who: p.name, module: ev.m, activity: ev.a, s, e });
      }
    }

    const cuts = [...new Set([DAY_START, DAY_END, ...events.flatMap((t) => [t.s, t.e])])].sort((a, b) => a - b);
    const segments = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i];
      const end = cuts[i + 1];
      const busy = events
        .filter((t) => t.s < end && t.e > start)
        .map(({ who, module, activity }) => ({ who, module, activity }));
      const busyNames = [...new Set(busy.map((b) => b.who))];
      const sig = busyNames.slice().sort().join('|');
      const last = segments[segments.length - 1];
      if (last && last.sig === sig) {
        last.end = end;
        for (const b of busy) {
          if (!last.busy.some((x) => x.who === b.who && x.module === b.module && x.activity === b.activity)) {
            last.busy.push(b);
          }
        }
      } else {
        segments.push({
          start,
          end,
          sig,
          busy,
          free: total - busyNames.length,
          freeNames: allNames.filter((n) => !busyNames.includes(n)),
        });
      }
    }
    days[day] = { segments, events };
  }
  return { total, days };
}

/**
 * Windows where at least `minFree` people are free for at least `minMinutes`, best first
 * (most people free, then longest). minFree = grid.total gives "everyone free".
 * Each window carries after/before (like freeTogether) so describeWindow() works.
 */
export function bestWindows(grid, minFree, minMinutes = 60) {
  const out = [];
  const pick = ({ who, module, activity }) => ({ who, module, activity });
  for (const day of WEEKDAYS) {
    const { segments, events } = grid.days[day];
    for (const seg of segments) {
      const minutes = seg.end - seg.start;
      if (seg.free < minFree || minutes < minMinutes) continue;
      const everyone = seg.free === grid.total;
      out.push({
        day,
        start: seg.start,
        end: seg.end,
        minutes,
        free: seg.free,
        total: grid.total,
        freeNames: seg.freeNames,
        busy: seg.busy,
        wholeDay: everyone && seg.start === DAY_START && seg.end === DAY_END,
        after: everyone && seg.start > DAY_START ? events.filter((t) => t.e === seg.start).map(pick) : [],
        before: everyone && seg.end < DAY_END ? events.filter((t) => t.s === seg.end).map(pick) : [],
      });
    }
  }
  return out.sort(
    (a, b) =>
      b.free - a.free ||
      b.minutes - a.minutes ||
      WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) ||
      a.start - b.start
  );
}

/** Plain-text list of windows (everyone or "3 of 4"), for pasting into a chat. */
export function windowsText({ names, semester, windows }) {
  const lines = [`Free together (${names.join(' + ')}, ${semester}):`];
  for (const day of WEEKDAYS) {
    const ws = windows.filter((w) => w.day === day).sort((a, b) => a.start - b.start);
    if (!ws.length) continue;
    const slots = ws.map((w) => {
      const t = w.wholeDay ? 'all day' : `${fmtTime(w.start)}-${fmtTime(w.end)}`;
      if (w.free === w.total) return t;
      const missing = names.filter((n) => !w.freeNames.includes(n));
      return `${t} (not ${missing.join(', ')})`;
    });
    lines.push(`${FULL_DAY_NAMES[day]}: ${slots.join(', ')}`);
  }
  if (lines.length === 1) lines.push('No shared free time of that length.');
  return lines.join('\n');
}

/**
 * Classes two or more people are in together: same module, same day, same time
 * (and same group when both timetables carry one).
 * -> [{ d, s, e, m, a, g, who: ['You', 'Alex'] }]
 */
export function sharedClasses(people) {
  const map = new Map();
  for (const p of people) {
    for (const ev of p.events || []) {
      const key = `${ev.d}|${ev.s}|${ev.e}|${ev.m}|${ev.g || ''}`;
      let c = map.get(key);
      if (!c) {
        c = { d: ev.d, s: ev.s, e: ev.e, m: ev.m, a: ev.a || '', g: ev.g || '', who: [] };
        map.set(key, c);
      }
      if (!c.who.includes(p.name)) c.who.push(p.name);
    }
  }
  return [...map.values()]
    .filter((c) => c.who.length > 1)
    .sort((x, y) => WEEKDAYS.indexOf(x.d) - WEEKDAYS.indexOf(y.d) || x.s - y.s);
}

/**
 * Modules (per activity) that 2+ people take, clustered by who attends at the same times.
 * together = everyone who takes it attends the same slots; otherwise the clusters show
 * who is in which group, e.g. "You, Alex in G01 / Sam in G02".
 * -> [{ m, a, together, clusters: [{ who, g, slots: ['Mon|450|500', ...] }] }]
 */
export function moduleOverlap(people) {
  const map = new Map();
  for (const p of people) {
    for (const ev of p.events || []) {
      const key = `${ev.m}|${ev.a || ''}`;
      if (!map.has(key)) map.set(key, { m: ev.m, a: ev.a || '', per: new Map() });
      const entry = map.get(key);
      if (!entry.per.has(p.name)) entry.per.set(p.name, { g: ev.g || '', slots: new Set() });
      entry.per.get(p.name).slots.add(`${ev.d}|${ev.s}|${ev.e}`);
    }
  }
  const out = [];
  for (const { m, a, per } of map.values()) {
    if (per.size < 2) continue;
    const clusters = new Map();
    for (const [who, { g, slots }] of per) {
      const sorted = [...slots].sort();
      const sig = sorted.join(';');
      if (!clusters.has(sig)) clusters.set(sig, { who: [], g, slots: sorted });
      clusters.get(sig).who.push(who);
    }
    out.push({ m, a, together: clusters.size === 1, clusters: [...clusters.values()] });
  }
  return out.sort((x, y) => x.m.localeCompare(y.m) || x.a.localeCompare(y.a));
}

/** 'Mon|450|500' -> { d: 'Mon', s: 450, e: 500 } */
export function parseSlot(slot) {
  const [d, s, e] = String(slot).split('|');
  return { d, s: Number(s), e: Number(e) };
}
