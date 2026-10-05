/**
 * Timetable Generation Algorithm for University Timetable Workstation
 * 
 * Implements backtracking search to find optimal conflict-free group assignments
 * with user-selectable preference modes:
 * - "morning": Minimizes average start time across all selected meetings
 * - "afternoon": Maximizes average start time across all selected meetings
 * - "free_day": Maximizes completely free weekdays and minimizes classes on the lightest day
 * - "early_friday": Minimizes Friday end time (finishes Friday as early as possible)
 * 
 * Supports module-level lecture group mixing (e.g. taking L1 from Group 1, L2 from Group 3).
 * Also provides a minimum-clash fallback when zero-clash solutions are impossible.
 */

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * Converts "HH:MM" 24-hour string to minutes from midnight
 * @param {string} tStr - e.g. "09:30"
 * @returns {number} minutes from midnight (e.g. 570)
 */
export function timeToMinutes(tStr) {
  if (!tStr) return 0;
  const parts = tStr.trim().split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h * 60 + m;
}

/**
 * Formats minutes from midnight to "HH:MM"
 * @param {number} totalMinutes 
 * @returns {string} e.g. "09:30"
 */
export function minutesToTime(totalMinutes) {
  const rounded = Math.round(totalMinutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Parses "HH:MM - HH:MM" into start and end minutes
 * @param {string} timeRangeStr 
 * @returns {{ startStr: string, endStr: string, startMinutes: number, endMinutes: number, durationMinutes: number }}
 */
export function parseTimeRange(timeRangeStr) {
  if (!timeRangeStr) {
    return { startStr: '00:00', endStr: '00:00', startMinutes: 0, endMinutes: 0, durationMinutes: 0 };
  }
  const parts = timeRangeStr.split(' - ').map(s => s.trim());
  const startStr = parts[0] || '00:00';
  const endStr = parts[1] || startStr;
  const startMinutes = timeToMinutes(startStr);
  const endMinutes = timeToMinutes(endStr);
  return {
    startStr,
    endStr,
    startMinutes,
    endMinutes,
    durationMinutes: Math.max(0, endMinutes - startMinutes)
  };
}

/**
 * Checks if a record's semester matches the target semester filter
 * @param {string} itemSemester 
 * @param {string} targetSemester - 'S1', 'S2', or 'ALL'
 * @returns {boolean}
 */
export function isMatchingSemester(itemSemester, targetSemester) {
  if (!targetSemester || targetSemester === 'ALL') return true;
  const s = (itemSemester || '').toUpperCase().trim();
  if (targetSemester === 'S1') {
    return s.startsWith('S1') || s.startsWith('Q1') || s.startsWith('Q2') || s.startsWith('Y') || s.startsWith('J') || s === '1';
  }
  if (targetSemester === 'S2') {
    return s.startsWith('S2') || s.startsWith('Q3') || s.startsWith('Q4') || s.startsWith('Y') || s.startsWith('J') || s === '2';
  }
  return s === targetSemester;
}

/**
 * Checks if two weekly meetings intersect in time on the same day
 * @param {{ day: string, startMinutes: number, endMinutes: number }} m1 
 * @param {{ day: string, startMinutes: number, endMinutes: number }} m2 
 * @returns {boolean}
 */
export function doMeetingsOverlap(m1, m2) {
  if (!m1 || !m2) return false;
  if (m1.day !== m2.day) return false;
  // Two intervals [s1, e1) and [s2, e2) overlap if s1 < e2 and s2 < e1
  return m1.startMinutes < m2.endMinutes && m2.startMinutes < m1.endMinutes;
}

/**
 * Calculates overlap duration in minutes between two meetings
 */
export function getOverlapMinutes(m1, m2) {
  if (!m1 || !m2 || m1.day !== m2.day) return 0;
  const start = Math.max(m1.startMinutes, m2.startMinutes);
  const end = Math.min(m1.endMinutes, m2.endMinutes);
  return Math.max(0, end - start);
}

/**
 * Checks if any meeting in candidateOption overlaps with any already-selected meeting
 * @param {{ module: string, activity: string, group: string, meetings: Array }} candidateOption 
 * @param {Array} chosenMeetings 
 * @returns {{ clashes: boolean, m1?: Object, m2?: Object }}
 */
export function checkOptionOverlap(candidateOption, chosenMeetings) {
  for (const m1 of candidateOption.meetings) {
    for (const m2 of chosenMeetings) {
      if (doMeetingsOverlap(m1, m2)) {
        return {
          clashes: true,
          m1: { ...m1, module: candidateOption.module, activity: candidateOption.activity, group: candidateOption.group, period: candidateOption.period },
          m2
        };
      }
    }
  }
  return { clashes: false };
}

/**
 * Builds decision units for backtracking search.
 * 
 * If a module is in mixableModules, its lecture activity ('L') is split per period (L1, L2, L3),
 * allowing the algorithm to independently select the best group for each lecture slot.
 * 
 * @param {Array} records 
 * @param {Array<string>} enrolledModules 
 * @param {string} semester 
 * @param {Array<string>} mixableModules 
 */
export function buildDecisionUnits(records, enrolledModules, semester = 'S2', mixableModules = []) {
  if (!records || records.length === 0 || !enrolledModules || enrolledModules.length === 0) {
    return [];
  }

  const mixSet = new Set(mixableModules || []);

  // Filter records for the target modules and matching semester
  const filtered = records.filter(r => 
    enrolledModules.includes(r.module) && 
    isMatchingSemester(r.semester, semester)
  );

  // Map: module -> activity -> rows
  const modActMap = {};
  for (const r of filtered) {
    const mod = r.module;
    const act = (r.activity || 'L').toUpperCase().trim();
    const grp = (r.group || 'G01').trim();
    const period = (r.period || '').trim() || (act + '1');
    const day = (r.day || '').trim();
    const time = (r.time || '').trim();

    if (!modActMap[mod]) modActMap[mod] = {};
    if (!modActMap[mod][act]) modActMap[mod][act] = [];

    modActMap[mod][act].push({
      ...r,
      period,
      day,
      time,
      group: grp,
      timeInfo: parseTimeRange(time)
    });
  }

  const activityOrder = ['L', 'P', 'T'];
  const decisionUnits = [];

  for (const mod of enrolledModules) {
    if (!modActMap[mod]) continue;

    const presentActs = Object.keys(modActMap[mod]).sort((a, b) => {
      const idxA = activityOrder.indexOf(a);
      const idxB = activityOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const isMixable = mixSet.has(mod);

    for (const act of presentActs) {
      const rows = modActMap[mod][act];

      // If lecture mixing is enabled for this module, split by period label (L1, L2, L3)
      if (isMixable && act === 'L') {
        const periodMap = {};
        for (const r of rows) {
          const p = r.period || 'L1';
          if (!periodMap[p]) periodMap[p] = {};
          const grp = r.group;
          const key = `${r.day}|${r.time}`;
          if (!periodMap[p][grp]) periodMap[p][grp] = {};
          if (!periodMap[p][grp][key]) {
            periodMap[p][grp][key] = {
              day: r.day,
              time: r.time,
              startMinutes: r.timeInfo.startMinutes,
              endMinutes: r.timeInfo.endMinutes,
              durationMinutes: r.timeInfo.durationMinutes,
              venues: r.venue ? [r.venue.trim()] : [],
              campus: r.campus || '',
              language: r.language || '',
              semester: r.semester || '',
              period: p
            };
          } else if (r.venue && !periodMap[p][grp][key].venues.includes(r.venue.trim())) {
            periodMap[p][grp][key].venues.push(r.venue.trim());
          }
        }

        const sortedPeriods = Object.keys(periodMap).sort();
        if (sortedPeriods.length > 1) {
          for (const p of sortedPeriods) {
            const groupOptions = [];
            for (const grp of Object.keys(periodMap[p]).sort()) {
              const meetings = Object.values(periodMap[p][grp]);
              groupOptions.push({
                module: mod,
                activity: act,
                period: p,
                unitKey: `${mod}_${act}_${p}`,
                group: grp,
                meetings
              });
            }
            if (groupOptions.length > 0) {
              decisionUnits.push({
                module: mod,
                activity: act,
                period: p,
                unitKey: `${mod}_${act}_${p}`,
                isMixed: true,
                options: groupOptions
              });
            }
          }
        } else {
          // Single lecture period: treat as standard unit
          const groupMap = {};
          for (const r of rows) {
            const grp = r.group;
            const key = `${r.period}|${r.day}|${r.time}`;
            if (!groupMap[grp]) groupMap[grp] = {};
            if (!groupMap[grp][key]) {
              groupMap[grp][key] = {
                day: r.day,
                time: r.time,
                startMinutes: r.timeInfo.startMinutes,
                endMinutes: r.timeInfo.endMinutes,
                durationMinutes: r.timeInfo.durationMinutes,
                venues: r.venue ? [r.venue.trim()] : [],
                campus: r.campus || '',
                language: r.language || '',
                semester: r.semester || '',
                period: r.period
              };
            } else if (r.venue && !groupMap[grp][key].venues.includes(r.venue.trim())) {
              groupMap[grp][key].venues.push(r.venue.trim());
            }
          }

          const groupOptions = [];
          for (const grp of Object.keys(groupMap).sort()) {
            const meetings = Object.values(groupMap[grp]);
            groupOptions.push({
              module: mod,
              activity: act,
              period: act,
              unitKey: `${mod}_${act}`,
              group: grp,
              meetings
            });
          }

          if (groupOptions.length > 0) {
            decisionUnits.push({
              module: mod,
              activity: act,
              period: act,
              unitKey: `${mod}_${act}`,
              isMixed: false,
              options: groupOptions
            });
          }
        }
      } else {
        // Standard: all meetings for a group stay together
        const groupMap = {};
        for (const r of rows) {
          const grp = r.group;
          const key = `${r.period}|${r.day}|${r.time}`;
          if (!groupMap[grp]) groupMap[grp] = {};
          if (!groupMap[grp][key]) {
            groupMap[grp][key] = {
              day: r.day,
              time: r.time,
              startMinutes: r.timeInfo.startMinutes,
              endMinutes: r.timeInfo.endMinutes,
              durationMinutes: r.timeInfo.durationMinutes,
              venues: r.venue ? [r.venue.trim()] : [],
              campus: r.campus || '',
              language: r.language || '',
              semester: r.semester || '',
              period: r.period
            };
          } else if (r.venue && !groupMap[grp][key].venues.includes(r.venue.trim())) {
            groupMap[grp][key].venues.push(r.venue.trim());
          }
        }

        const groupOptions = [];
        for (const grp of Object.keys(groupMap).sort()) {
          const meetings = Object.values(groupMap[grp]);
          groupOptions.push({
            module: mod,
            activity: act,
            period: act,
            unitKey: `${mod}_${act}`,
            group: grp,
            meetings
          });
        }

        if (groupOptions.length > 0) {
          decisionUnits.push({
            module: mod,
            activity: act,
            period: act,
            unitKey: `${mod}_${act}`,
            isMixed: false,
            options: groupOptions
          });
        }
      }
    }
  }

  return decisionUnits;
}

/**
 * Normalizes user preference string
 * @param {string} pref 
 * @returns {'morning' | 'afternoon' | 'free_day' | 'early_friday'}
 */
export function normalizePreference(pref) {
  const p = (pref || '').toLowerCase().trim();
  // 'fri'/'early' must be checked before 'day': "friday" itself contains
  // the substring "day", so with the checks in the other order an
  // "early_friday" preference string was always misdetected as "free_day"
  // and that mode never actually ran.
  if (p.includes('fri') || p.includes('early')) return 'early_friday';
  if (p.includes('free') || p.includes('day')) return 'free_day';
  if (p.includes('afternoon') || p.includes('late')) return 'afternoon';
  return 'morning';
}

/**
 * Computes full statistical metrics and prompt text for an assignment solution
 */
export function computeSolutionStats(currentMeetings, currentAssignment, normPreference = 'morning') {
  const totalStartMin = currentMeetings.reduce((sum, m) => sum + m.startMinutes, 0);
  const avgStartMin = currentMeetings.length > 0 ? totalStartMin / currentMeetings.length : 0;
  const totalDurationMin = currentMeetings.reduce((sum, m) => sum + (m.durationMinutes || 50), 0);

  const dayStats = {};
  for (const d of WEEKDAYS) {
    dayStats[d] = { count: 0, lectures: 0, practicals: 0, tutorials: 0, durationMinutes: 0 };
  }

  for (const m of currentMeetings) {
    if (dayStats[m.day]) {
      dayStats[m.day].count++;
      if (m.activity === 'L') dayStats[m.day].lectures++;
      else if (m.activity === 'P') dayStats[m.day].practicals++;
      else if (m.activity === 'T') dayStats[m.day].tutorials++;
      dayStats[m.day].durationMinutes += (m.durationMinutes || 50);
    }
  }

  const freeDays = WEEKDAYS.filter(d => dayStats[d].count === 0);
  const freeDaysCount = freeDays.length;

  // Find lightest day
  let lightestDay = 'Friday';
  let minCount = Infinity;
  for (const d of WEEKDAYS) {
    if (dayStats[d].count < minCount) {
      minCount = dayStats[d].count;
      lightestDay = d;
    }
  }

  const lightestDayStat = dayStats[lightestDay];
  const fridayMeetings = currentMeetings.filter(m => m.day === 'Friday');
  const fridayEndMinutes = fridayMeetings.length > 0 
    ? Math.max(...fridayMeetings.map(m => m.endMinutes || (m.startMinutes + (m.durationMinutes || 50))))
    : 0;

  const allStartMinutes = currentMeetings.map(m => m.startMinutes).filter(m => typeof m === 'number' && !isNaN(m));
  const allEndMinutes = currentMeetings.map(m => m.endMinutes || (m.startMinutes + (m.durationMinutes || 50))).filter(m => typeof m === 'number' && !isNaN(m));

  const earliestStartMinutes = allStartMinutes.length > 0 ? Math.min(...allStartMinutes) : 0;
  const earliestStartTimeFormatted = minutesToTime(earliestStartMinutes);

  const latestEndMinutes = allEndMinutes.length > 0 ? Math.max(...allEndMinutes) : 0;
  const latestEndTimeFormatted = minutesToTime(latestEndMinutes);

  const latestStartMinutes = allStartMinutes.length > 0 ? Math.max(...allStartMinutes) : 0;
  const latestStartTimeFormatted = minutesToTime(latestStartMinutes);

  const fridayEndFormatted = fridayMeetings.length === 0 ? 'Free day' : minutesToTime(fridayEndMinutes);

  const selectedGroupsMap = {};
  currentAssignment.forEach(opt => {
    selectedGroupsMap[opt.unitKey] = opt.group;
    selectedGroupsMap[`${opt.module}_${opt.activity}`] = opt.group;
    if (opt.period) {
      selectedGroupsMap[`${opt.module}_${opt.activity}_${opt.period}`] = opt.group;
    }
  });

  let freeDayPrompt = '';
  if (freeDaysCount > 0) {
    freeDayPrompt = `Free day: ${freeDays.join(', ')} (0 classes)`;
  } else {
    const actCount = lightestDayStat.count;
    const isOnlyLectures = lightestDayStat.lectures === actCount;
    const isOnlyPracticals = lightestDayStat.practicals === actCount;
    const isOnlyTutorials = lightestDayStat.tutorials === actCount;
    const noun = isOnlyLectures 
      ? (actCount === 1 ? 'lecture' : 'lectures')
      : isOnlyPracticals
      ? (actCount === 1 ? 'practical' : 'practicals')
      : isOnlyTutorials
      ? (actCount === 1 ? 'tutorial' : 'tutorials')
      : (actCount === 1 ? 'class' : 'classes');

    freeDayPrompt = `Freest day is ${lightestDay} with ${actCount} ${noun}`;
  }

  const morningPrompt = currentMeetings.length > 0
    ? `Latest class ends at ${latestEndTimeFormatted}`
    : `No classes scheduled`;

  const afternoonPrompt = currentMeetings.length > 0
    ? `Earliest class starts at ${earliestStartTimeFormatted}`
    : `No classes scheduled`;

  const earlyFridayPrompt = fridayMeetings.length === 0
    ? `Friday is free (0 classes)`
    : `Done by ${fridayEndFormatted} on Friday`;

  let summaryPrompt = freeDayPrompt;
  if (normPreference === 'morning') summaryPrompt = morningPrompt;
  else if (normPreference === 'afternoon') summaryPrompt = afternoonPrompt;
  else if (normPreference === 'early_friday') summaryPrompt = earlyFridayPrompt;

  return {
    assignment: currentAssignment.map(a => ({
      module: a.module,
      activity: a.activity,
      period: a.period,
      unitKey: a.unitKey,
      group: a.group,
      meetings: a.meetings
    })),
    meetings: [...currentMeetings],
    selectedGroupsMap,
    avgStartMinutes: avgStartMin,
    avgStartTimeFormatted: minutesToTime(avgStartMin),
    earliestStartMinutes,
    earliestStartTimeFormatted,
    latestEndMinutes,
    latestEndTimeFormatted,
    latestStartMinutes,
    latestStartTimeFormatted,
    totalWeeklyHours: (totalDurationMin / 60).toFixed(1),
    totalMeetingsCount: currentMeetings.length,
    dayStats,
    freeDaysCount,
    freeDays,
    lightestDay,
    lightestDaySessions: minCount,
    freeDayPrompt,
    morningPrompt,
    afternoonPrompt,
    earlyFridayPrompt,
    summaryPrompt,
    fridayEndMinutes,
    fridayEndFormatted,
    fridaySessionsCount: fridayMeetings.length
  };
}

/**
 * Lightweight version of computeSolutionStats(): computes only the fields
 * needed to RANK a solution for a given preference, skipping the expensive
 * prompt-string building and selectedGroupsMap construction that
 * computeSolutionStats does. This is what runs inside the hot backtracking
 * loop — every leaf node was previously paying for work (day-by-day prompt
 * text, group maps, etc.) that's only ever needed for the ~200 solutions we
 * actually keep, which made each leaf far more expensive than it needed to
 * be and meant the "10,000 valid solutions found" cap (see MAX_VALID_SOLUTIONS
 * below) was hit well before the node budget ever came into play.
 */
function computeCoreStats(currentMeetings) {
  const dayCounts = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
  for (const m of currentMeetings) {
    if (dayCounts[m.day] !== undefined) dayCounts[m.day]++;
  }
  const freeDays = WEEKDAYS.filter(d => dayCounts[d] === 0);

  let lightestDay = 'Friday';
  let lightestDaySessions = Infinity;
  for (const d of WEEKDAYS) {
    if (dayCounts[d] < lightestDaySessions) {
      lightestDaySessions = dayCounts[d];
      lightestDay = d;
    }
  }

  const totalStart = currentMeetings.reduce((s, m) => s + m.startMinutes, 0);
  const avgStartMinutes = currentMeetings.length > 0 ? totalStart / currentMeetings.length : 0;

  const fridayMeetings = currentMeetings.filter(m => m.day === 'Friday');
  const fridayEndMinutes = fridayMeetings.length > 0
    ? Math.max(...fridayMeetings.map(m => m.endMinutes))
    : 0;

  return {
    freeDays,
    freeDaysCount: freeDays.length,
    lightestDay,
    lightestDaySessions,
    avgStartMinutes,
    fridayEndMinutes,
    fridaySessionsCount: fridayMeetings.length
  };
}

/**
 * Single source of truth for "is solution A better than solution B", given
 * core stats (see computeCoreStats). This is the SAME ranking logic used
 * for the final `allValidSolutions` ordering — it used to be duplicated
 * (once as an inline sort comparator at the very end, once informally in
 * scoreOptionForOrdering for search-order heuristics), which is exactly how
 * the two could drift out of sync. It's also what powers the branch-and-
 * bound pruning below: once we know a partial schedule's best-possible
 * completion can't beat the worst of our currently-kept top solutions, we
 * skip the whole subtree instead of enumerating it leaf by leaf.
 * Returns <0 if `a` should rank before `b` (a is better).
 */
function compareCoreStats(a, b, normPreference) {
  if (normPreference === 'free_day') {
    if (b.freeDaysCount !== a.freeDaysCount) return b.freeDaysCount - a.freeDaysCount;
    if (a.lightestDaySessions !== b.lightestDaySessions) return a.lightestDaySessions - b.lightestDaySessions;

    const dayScore = (sol) => {
      if (sol.freeDays.includes('Friday')) return 100;
      if (sol.freeDays.includes('Monday')) return 90;
      if (sol.freeDays.length > 0) return 80;
      if (sol.lightestDay === 'Friday') return 50;
      if (sol.lightestDay === 'Monday') return 40;
      if (sol.lightestDay === 'Wednesday') return 30;
      return 20;
    };
    const scoreDiff = dayScore(b) - dayScore(a);
    if (scoreDiff !== 0) return scoreDiff;

    return a.avgStartMinutes - b.avgStartMinutes;
  }

  if (normPreference === 'early_friday') {
    if (a.fridayEndMinutes !== b.fridayEndMinutes) return a.fridayEndMinutes - b.fridayEndMinutes;
    if (a.fridaySessionsCount !== b.fridaySessionsCount) return a.fridaySessionsCount - b.fridaySessionsCount;
    return a.avgStartMinutes - b.avgStartMinutes;
  }

  if (normPreference === 'afternoon') return b.avgStartMinutes - a.avgStartMinutes;

  // morning (default)
  return a.avgStartMinutes - b.avgStartMinutes;
}

/**
 * Finds best-effort assignment when 0 zero-clash solutions exist.
 * Minimizes total overlapping clash minutes across all units.
 */
function findMinimumClashAssignment(decisionUnits, normPreference) {
  const chosenOptions = [];
  const chosenMeetings = [];
  const selectedGroupsMap = {};
  const clashTracker = [];

  for (const unit of decisionUnits) {
    let bestOpt = unit.options[0];
    let bestScore = Infinity;

    for (const opt of unit.options) {
      let clashMinutes = 0;
      for (const m1 of opt.meetings) {
        for (const m2 of chosenMeetings) {
          clashMinutes += getOverlapMinutes(m1, m2);
        }
      }

      let score = clashMinutes * 1000;
      if (normPreference === 'free_day') {
        const fridayMeetings = opt.meetings.filter(m => m.day === 'Friday');
        score += fridayMeetings.length * 100;
      } else if (normPreference === 'afternoon') {
        const avgStart = opt.meetings.reduce((s, m) => s + m.startMinutes, 0) / (opt.meetings.length || 1);
        score -= avgStart;
      } else {
        const avgStart = opt.meetings.reduce((s, m) => s + m.startMinutes, 0) / (opt.meetings.length || 1);
        score += avgStart;
      }

      if (score < bestScore) {
        bestScore = score;
        bestOpt = opt;
      }
    }

    if (bestOpt) {
      chosenOptions.push(bestOpt);
      selectedGroupsMap[bestOpt.unitKey] = bestOpt.group;
      if (!bestOpt.unitKey.includes('_L_')) {
        selectedGroupsMap[`${unit.module}_${unit.activity}`] = bestOpt.group;
      }

      for (const m of bestOpt.meetings) {
        const mWithMeta = { 
          ...m, 
          module: unit.module, 
          activity: unit.activity, 
          period: bestOpt.period,
          group: bestOpt.group 
        };

        for (const existing of chosenMeetings) {
          if (doMeetingsOverlap(mWithMeta, existing)) {
            clashTracker.push({
              moduleA: unit.module,
              activityA: unit.activity,
              periodA: bestOpt.period,
              groupA: bestOpt.group,
              meetingA: mWithMeta,
              moduleB: existing.module,
              activityB: existing.activity,
              periodB: existing.period,
              groupB: existing.group,
              meetingB: existing,
              conflictReason: `${unit.module} (${bestOpt.period || unit.activity} · ${bestOpt.group}) on ${mWithMeta.day} ${mWithMeta.time} overlaps with ${existing.module} (${existing.period || existing.activity} · ${existing.group}) on ${existing.day} ${existing.time}`
            });
          }
        }
        chosenMeetings.push(mWithMeta);
      }
    }
  }

  const stats = computeSolutionStats(chosenMeetings, chosenOptions, normPreference);

  return {
    ...stats,
    selectedGroupsMap: stats.selectedGroupsMap,
    clashes: clashTracker,
    hasClashes: clashTracker.length > 0
  };
}

/**
 * Generates conflict-free timetables using backtracking search.
 * 
 * @param {Array} records - Raw timetable dataset
 * @param {Array<string>} enrolledModules - Array of module codes
 * @param {string} preferenceMode - "morning", "afternoon", "free_day", or "early_friday"
 * @param {string} semester - "S1", "S2", or "ALL"
 * @param {Array<string>} mixableModules - Array of module codes where lecture groups can be mixed
 * @param {number} maxSolutionsToKeep - Limit on solutions to keep (default 200)
 */
export function generateTimetable(records, enrolledModules, preferenceMode = 'morning', semester = 'S2', mixableModules = [], maxSolutionsToKeep = 200) {
  const normPreference = normalizePreference(preferenceMode);
  const decisionUnits = buildDecisionUnits(records, enrolledModules, semester, mixableModules);

  if (decisionUnits.length === 0) {
    return {
      success: false,
      preference: normPreference,
      semester,
      enrolledModules,
      mixableModules,
      totalUnits: 0,
      totalValidSolutions: 0,
      selectedGroupsMap: {},
      bestSolution: null,
      allSolutions: [],
      clashes: [],
      summaryPrompt: '',
      message: 'No session records found for the requested modules in the chosen semester.'
    };
  }

  // Enumerating EVERY zero-clash combination is exponential in the number of
  // decision units. Mixing a lecture's periods (L1, L2, L3...) into separate
  // units instead of one multiplies that branching factor per mixed module,
  // so a handful of mixed modules can blow up to billions of leaf nodes.
  //
  // The search is bounded primarily by NODE_BUDGET, not wall-clock time.
  // A time budget makes LOADING TIME consistent across devices, but as a
  // side effect it makes RESULT QUALITY inconsistent — a slower laptop
  // visits fewer nodes in the same window and quietly comes back with a
  // worse timetable, with no indication anything was cut short. A node
  // budget flips that trade-off: every device explores the same amount of
  // the search tree and converges on essentially the same quality of
  // result, they just take different amounts of wall-clock time to get
  // there (slower devices load longer, not worse). TIME_BUDGET_MS below is
  // now only a backstop — generous enough that it should basically never
  // trigger except on truly pathological inputs (many mixed modules with
  // many groups each) — so the browser can't hang indefinitely; it no
  // longer defines result quality.
  //
  // Searching the most-constrained unit first (fewest group options) is the
  // standard CSP heuristic for pruning large trees quickly, so we reorder
  // before searching rather than relying on decisionUnits' natural order.
  //
  // Capping WHICH solutions get found matters as much as capping HOW MANY.
  // Group options were previously tried in plain alphabetical order, so the
  // first N solutions found were an arbitrary slice of the search space —
  // fine for "morning"/"afternoon" (good and bad start times are scattered
  // evenly), but "free_day" needs many units to simultaneously avoid one
  // specific day, which alphabetical-order exploration essentially never
  // stumbles into before the cap hits. scoreOptionForOrdering() ranks each
  // unit's options by how well they serve the chosen preference, so the
  // search dives toward promising schedules first — the node budget then
  // mostly just skips the long, uninteresting tail of the tree instead of
  // missing the good branches.
  //
  // For every preference except "free_day", that score only looks at an
  // option's OWN meetings — never at currentMeetings — so it's identical
  // every time a given unit is visited. Re-sorting it from scratch at every
  // single node (as before) was pure wasted CPU that ate straight into the
  // node budget for zero benefit: cheaper nodes mean more of them fit under
  // NODE_BUDGET in the same time, which is exactly what lets slower devices
  // still reach a well-optimised timetable instead of stalling partway
  // through. So those units' options are sorted once, below, and reused for
  // the whole search. "free_day" is the one preference where the best
  // option genuinely depends on which days are already in use elsewhere in
  // the current partial assignment, so it keeps sorting dynamically at
  // each node.
  // NOTE on a previous bug: there used to be a MAX_VALID_SOLUTIONS = 10000
  // cap that stopped the search the instant 10,000 valid (clash-free) leaf
  // combinations had been found, regardless of NODE_BUDGET. Because DFS
  // enumerates in an order where the LAST unit's options cycle fastest and
  // the first (most-constrained) units barely change, 10,000 valid leaves
  // could be reached while only ever trying the first unit's best/near-best
  // choice — so raising NODE_BUDGET had no effect (that cap was never the
  // thing actually stopping the search) and the true optimum, which often
  // needs an early unit to take a different option, was never explored.
  // computeSolutionStats() was also being run in full (day-by-day prompt
  // strings, group maps, everything) for every one of those 10,000 leaves,
  // even though only ~200 are ever kept — wasted work on every node.
  // Fix: leaves are now scored with the cheap computeCoreStats()/
  // compareCoreStats() and only promoted into a bounded top-K list (see
  // topSolutions below); the 10,000-solution cap is gone entirely, and for
  // free_day a real branch-and-bound cutoff (below) prunes subtrees that
  // provably can't beat the worst solution still in that top-K, so the
  // node budget is spent exploring genuinely different combinations
  // instead of re-deriving near-duplicates of the first one found.
  const NODE_BUDGET = 10000000; // primary control on result quality — the same for every device
  const TIME_CHECK_INTERVAL_NODES = 2000; // amortize performance.now() overhead across many nodes
  const TIME_BUDGET_MS = 5000; // backstop — with pruning in place this should rarely trigger, but caps worst-case loading at ~5s

  const searchStartTime = performance.now();

  const usesDynamicOrdering = normPreference === 'free_day';
  const searchUnits = [...decisionUnits]
    .sort((a, b) => a.options.length - b.options.length)
    .map(unit => {
      if (usesDynamicOrdering) return unit;
      const options = [...unit.options].sort(
        (a, b) => scoreOptionForOrdering(a, []) - scoreOptionForOrdering(b, [])
      );
      return { ...unit, options };
    });

  function scoreOptionForOrdering(option, currentMeetings) {
    const meetings = option.meetings;
    const avgStart = meetings.reduce((s, m) => s + m.startMinutes, 0) / (meetings.length || 1);

    if (normPreference === 'afternoon') {
      return -avgStart;
    }

    if (normPreference === 'early_friday') {
      const fridayMeetings = meetings.filter(m => m.day === 'Friday');
      if (fridayMeetings.length === 0) return -1; // doesn't touch Friday at all — best case
      return Math.max(...fridayMeetings.map(m => m.endMinutes));
    }

    if (normPreference === 'free_day') {
      // Prefer options that reuse days already in use rather than spreading
      // onto a currently-untouched day (greedily concentrates classes onto
      // fewer days). Extra penalty for newly touching Friday/Monday, since
      // those are the days most valuable to keep free (matches the final
      // solution-ranking tie-break below).
      const usedDays = new Set(currentMeetings.map(m => m.day));
      const optionDays = new Set(meetings.map(m => m.day));
      let newDays = 0, touchesNewFriday = 0, touchesNewMonday = 0;
      for (const d of optionDays) {
        if (!usedDays.has(d)) {
          newDays++;
          if (d === 'Friday') touchesNewFriday = 1;
          if (d === 'Monday') touchesNewMonday = 1;
        }
      }
      return newDays * 1000 + touchesNewFriday * 500 + touchesNewMonday * 100 + avgStart / 1440;
    }

    // morning (default)
    return avgStart;
  }

  // Bounded, always-sorted (best-first) list of the best `maxSolutionsToKeep`
  // solutions seen so far, by compareCoreStats(). Unlike the old unbounded
  // array, this costs the same small, fixed amount of memory regardless of
  // how many valid combinations exist in total, and never itself decides
  // when to stop searching — only NODE_BUDGET / TIME_BUDGET_MS do that now.
  const topSolutions = [];
  let validLeavesFound = 0;
  const clashTracker = [];
  let nodesVisited = 0;
  let searchLimited = false;

  function considerLeafSolution(meetings, assignment) {
    validLeavesFound++;
    const core = computeCoreStats(meetings);

    if (topSolutions.length < maxSolutionsToKeep) {
      let lo = 0, hi = topSolutions.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (compareCoreStats(core, topSolutions[mid].core, normPreference) < 0) hi = mid; else lo = mid + 1;
      }
      topSolutions.splice(lo, 0, { core, assignment: assignment.slice(), meetings: meetings.slice() });
      return;
    }

    if (compareCoreStats(core, topSolutions[topSolutions.length - 1].core, normPreference) < 0) {
      let lo = 0, hi = topSolutions.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (compareCoreStats(core, topSolutions[mid].core, normPreference) < 0) hi = mid; else lo = mid + 1;
      }
      topSolutions.splice(lo, 0, { core, assignment: assignment.slice(), meetings: meetings.slice() });
      topSolutions.pop();
    }
  }

  // Mutated in place (push/pop) instead of cloned at every recursive call.
  // The old version spread these into new arrays on every successful branch,
  // which costs O(depth) per node — with many decision units that dominates
  // total search time. considerLeafSolution() already copies whatever it
  // needs to keep before returning, so it's safe to keep mutating these
  // arrays immediately afterward.
  const currentAssignment = [];
  const currentMeetings = [];

  function backtrack(unitIndex) {
    if (searchLimited) return;

    nodesVisited++;
    if (
      nodesVisited > NODE_BUDGET ||
      (nodesVisited % TIME_CHECK_INTERVAL_NODES === 0 && performance.now() - searchStartTime > TIME_BUDGET_MS)
    ) {
      searchLimited = true;
      return;
    }

    // Branch-and-bound: once a day is touched by a meeting it can never
    // become free again, so (5 - daysUsedSoFar) is a hard ceiling on the
    // freeDaysCount any completion of this partial schedule could reach.
    // Once we're holding a full top-K, a branch whose ceiling can't beat
    // the worst solution still in that list can be skipped entirely rather
    // than enumerated leaf by leaf — this is what lets one strong candidate
    // found early prune away the vast majority of the remaining tree.
    if (normPreference === 'free_day' && topSolutions.length >= maxSolutionsToKeep) {
      const worstKept = topSolutions[topSolutions.length - 1].core;
      const usedDays = new Set(currentMeetings.map(m => m.day)).size;
      const bestPossibleFreeDays = WEEKDAYS.length - usedDays;
      if (bestPossibleFreeDays < worstKept.freeDaysCount) {
        return;
      }
    }

    if (unitIndex === searchUnits.length) {
      considerLeafSolution(currentMeetings, currentAssignment);
      return;
    }

    const unit = searchUnits[unitIndex];
    const orderedOptions = usesDynamicOrdering
      ? [...unit.options].sort(
          (a, b) => scoreOptionForOrdering(a, currentMeetings) - scoreOptionForOrdering(b, currentMeetings)
        )
      : unit.options; // pre-sorted once above — see comment on NODE_BUDGET

    for (const option of orderedOptions) {
      if (searchLimited) return;

      const overlapCheck = checkOptionOverlap(option, currentMeetings);

      if (!overlapCheck.clashes) {
        const addedMeetings = option.meetings.map(m => ({
          ...m,
          module: option.module,
          activity: option.activity,
          period: option.period,
          group: option.group
        }));

        currentMeetings.push(...addedMeetings);
        currentAssignment.push(option);

        backtrack(unitIndex + 1);

        currentAssignment.pop();
        currentMeetings.length -= addedMeetings.length;
      } else {
        if (clashTracker.length < 50) {
          clashTracker.push({
            moduleA: option.module,
            activityA: option.activity,
            periodA: option.period,
            groupA: option.group,
            meetingA: overlapCheck.m1,
            moduleB: overlapCheck.m2.module,
            activityB: overlapCheck.m2.activity,
            periodB: overlapCheck.m2.period,
            groupB: overlapCheck.m2.group,
            meetingB: overlapCheck.m2,
            conflictReason: `${option.module} (${option.period || option.activity} · ${option.group}) on ${overlapCheck.m1.day} ${overlapCheck.m1.time} overlaps with ${overlapCheck.m2.module} (${overlapCheck.m2.period || overlapCheck.m2.activity} · ${overlapCheck.m2.group}) on ${overlapCheck.m2.day} ${overlapCheck.m2.time}`
          });
        }
      }
    }
  }

  backtrack(0);

  const searchTimeMs = Math.round(performance.now() - searchStartTime);
  // If we never hit NODE_BUDGET or TIME_BUDGET_MS, backtrack(0) only
  // returned because it had genuinely finished the whole tree — the top
  // solution is therefore PROVABLY optimal, not just "best of what we had
  // time to look at". This is the confidence signal: report it alongside
  // how many nodes that took, rather than leaving it implicit.
  const isGuaranteedOptimal = !searchLimited;

  if (topSolutions.length === 0) {
    const fallback = findMinimumClashAssignment(decisionUnits, normPreference);
    const uniqueClashMessages = Array.from(new Set(fallback.clashes.map(c => c.conflictReason)));

    return {
      success: false,
      hasClashes: true,
      preference: normPreference,
      semester,
      enrolledModules,
      mixableModules,
      totalUnits: decisionUnits.length,
      totalValidSolutions: 0,
      searchLimited,
      isGuaranteedOptimal,
      nodesVisited,
      searchTimeMs,
      selectedGroupsMap: fallback.selectedGroupsMap,
      bestSolution: fallback,
      allSolutions: [fallback],
      clashes: fallback.clashes,
      uniqueClashMessages: uniqueClashMessages.slice(0, 8),
      summaryPrompt: fallback.summaryPrompt,
      message: searchLimited
        ? `Search limit reached (${nodesVisited.toLocaleString()} nodes, ~${searchTimeMs}ms) before finding a conflict-free combination across all ${enrolledModules.length} modules — this combination of mixed modules may just be too large to fully explore. Displaying best allocation with minimal clashes.`
        : `Explored the full search space (${nodesVisited.toLocaleString()} nodes) with no completely conflict-free combination found across all ${enrolledModules.length} modules (${decisionUnits.length} activities). Displaying best allocation with minimal clashes.`
    };
  }

  // topSolutions is already kept sorted best-first (see considerLeafSolution),
  // so build the full stats (prompt strings, selectedGroupsMap, etc.) only
  // for the handful of solutions we're actually going to show.
  const allValidSolutions = topSolutions.map(entry =>
    computeSolutionStats(entry.meetings, entry.assignment, normPreference)
  );

  const best = allValidSolutions[0];

  return {
    success: true,
    hasClashes: false,
    preference: normPreference,
    semester,
    enrolledModules,
    mixableModules,
    totalUnits: decisionUnits.length,
    totalValidSolutions: validLeavesFound,
    searchLimited,
    isGuaranteedOptimal,
    nodesVisited,
    searchTimeMs,
    selectedGroupsMap: best.selectedGroupsMap,
    bestSolution: best,
    allSolutions: allValidSolutions,
    clashes: [],
    summaryPrompt: best.summaryPrompt,
    message: isGuaranteedOptimal
      ? `Explored the full search space (${nodesVisited.toLocaleString()} nodes, ~${searchTimeMs}ms, ${validLeavesFound.toLocaleString()} conflict-free combinations found) — this is provably the best possible ${normPreference} schedule across all ${enrolledModules.length} modules.`
      : `Search capped after ${nodesVisited.toLocaleString()} nodes (~${searchTimeMs}ms) — showing the best of ${validLeavesFound.toLocaleString()} conflict-free combinations found so far. A better ${normPreference} schedule may exist beyond this budget.`
  };
}

export default {
  generateTimetable,
  buildDecisionUnits,
  computeSolutionStats,
  doMeetingsOverlap,
  parseTimeRange,
  timeToMinutes,
  minutesToTime,
  isMatchingSemester,
  normalizePreference,
  WEEKDAYS
};