// Pure helpers: timetable constants, module colour themes, and the conversion from
// parsed PDF records into visual timetable events.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const DAY_MAP = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' };
export const PERIODS = ['07:30', '08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30'];

// Desaturated module palette with distinct border and ink colors
export const MODULE_THEMES = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', label: 'blue' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', label: 'green' },
  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'amber' },
  { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', label: 'purple' },
  { bg: '#f0fdfa', border: '#99f6e4', text: '#115e59', label: 'teal' },
  { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239', label: 'rose' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', label: 'orange' },
  { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155', label: 'slate' },
];

export function getModuleTheme(moduleCode, moduleThemesMap) {
  return moduleThemesMap[moduleCode] || MODULE_THEMES[0];
}

export function timeToMinutes(tStr) {
  if (!tStr) return 0;
  const parts = tStr.trim().split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export function findMatchingPeriod(startTimeStr) {
  if (!startTimeStr) return PERIODS[0];
  const clean = startTimeStr.trim();
  if (PERIODS.includes(clean)) return clean;
  const targetMin = timeToMinutes(clean);
  let bestPeriod = PERIODS[0];
  let minDiff = Infinity;
  for (const p of PERIODS) {
    const pMin = timeToMinutes(p);
    const diff = Math.abs(pMin - targetMin);
    if (diff < minDiff) {
      minDiff = diff;
      bestPeriod = p;
    }
  }
  return bestPeriod;
}

/**
 * Converts selected records into visual timetable events.
 * Crucially deduplicates parallel lab venues (e.g. Informatorium CBT Lab 1, 2, 3 at same time)
 * into a single event with merged venue list.
 */
export function recordsToEvents(records, moduleThemesMap) {
  const activityLabels = { L: 'Lecture', P: 'Practical', T: 'Tutorial' };

  // Group by (module, activity, group, day, time) to merge multi-lab sessions
  const mergedMap = {};

  for (const r of records) {
    const dayShort = DAY_MAP[r.day];
    if (!dayShort) continue;

    const act = r.activity || 'L';
    const key = `${r.module}_${act}_${r.group}_${dayShort}_${r.time}`;

    if (!mergedMap[key]) {
      const parts = r.time.split(' - ');
      const startTime = parts[0]?.trim();
      let duration = 1;
      if (parts.length === 2) {
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = parts[1].split(':').map(Number);
        const diffMin = (eh * 60 + em) - (sh * 60 + sm);
        duration = Math.max(1, Math.round(diffMin / 60));
      }

      const startSlot = findMatchingPeriod(startTime);
      const actLabel = activityLabels[act] || act;
      const theme = getModuleTheme(r.module, moduleThemesMap);

      mergedMap[key] = {
        id: key,
        title: r.module,
        venues: r.venue ? [r.venue.trim()] : [],
        activityLabel: actLabel,
        activityCode: act,
        group: r.group,
        semester: r.semester,
        campus: r.campus || '',
        language: r.language || '',
        day: dayShort,
        time: startSlot,
        fullTime: r.time,
        duration,
        theme,
        raw: r,
      };
    } else {
      if (r.venue && !mergedMap[key].venues.includes(r.venue.trim())) {
        mergedMap[key].venues.push(r.venue.trim());
      }
    }
  }

  return Object.values(mergedMap).map(e => ({
    ...e,
    room: e.venues.length > 2 ? `${e.venues[0]} (+${e.venues.length - 1} labs)` : e.venues.join(', ')
  }));
}

