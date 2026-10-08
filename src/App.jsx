import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { createRoot } from 'react-dom/client';
import { generateTimetable, isMatchingSemester } from './lib/timetableGenerator.js';
import { parsePdf } from './lib/pdfParser.js';
import { LandingPage } from './pages/LandingPage.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { LegalPage } from './pages/LegalPage.jsx';
import { BooksPage } from './pages/BooksPage.jsx';
import { PortalGuideModal } from './components/PortalGuideModal.jsx';
import { getSession, onSessionChange, signOut } from './lib/auth.js';
import { loadTimetable, saveTimetable } from './lib/timetableStore.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_MAP = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' };
const PERIODS = ['07:30', '08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30'];

// Desaturated module palette with distinct border and ink colors
const MODULE_THEMES = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', label: 'blue' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', label: 'green' },
  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'amber' },
  { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', label: 'purple' },
  { bg: '#f0fdfa', border: '#99f6e4', text: '#115e59', label: 'teal' },
  { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239', label: 'rose' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', label: 'orange' },
  { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155', label: 'slate' },
];

function getModuleTheme(moduleCode, moduleThemesMap) {
  return moduleThemesMap[moduleCode] || MODULE_THEMES[0];
}

function timeToMinutes(tStr) {
  if (!tStr) return 0;
  const parts = tStr.trim().split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function findMatchingPeriod(startTimeStr) {
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
function recordsToEvents(records, moduleThemesMap) {
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

// Consistent 1.5px stroke SVG Icons (Clean, Professional, Anti-UI Slop)
const Icons = {
  Calendar: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  ),
  Table: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v18H3z"></path>
      <path d="M3 9h18"></path>
      <path d="M3 15h18"></path>
      <path d="M9 3v18"></path>
    </svg>
  ),
  Upload: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
  ),
  Download: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  ),
  FileText: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  ),
  AlertCircle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  Sun: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  ),
  Sunset: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 18a5 5 0 0 0-10 0"></path>
      <line x1="12" y1="2" x2="12" y2="9"></line>
      <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line>
      <line x1="1" y1="18" x2="3" y2="18"></line>
      <line x1="21" y1="18" x2="23" y2="18"></line>
      <line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line>
      <line x1="23" y1="22" x2="1" y2="22"></line>
      <polyline points="8 6 12 2 16 6"></polyline>
    </svg>
  ),
  Coffee: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
      <line x1="6" y1="1" x2="6" y2="4"></line>
      <line x1="10" y1="1" x2="10" y2="4"></line>
      <line x1="14" y1="1" x2="14" y2="4"></line>
    </svg>
  ),
  Zap: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  ),
  Shuffle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8"></polyline>
      <line x1="4" y1="20" x2="21" y2="3"></line>
      <polyline points="21 16 21 21 16 21"></polyline>
      <line x1="15" y1="15" x2="21" y2="21"></line>
      <line x1="4" y1="4" x2="9" y2="9"></line>
    </svg>
  ),
  Sparkles: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  ),
};

function App() {
  // Views reachable via a URL hash, independent of sign-in state - so a shared or
  // bookmarked #terms / #privacy link opens straight to that page.
  const HASH_VIEWS = ['generator', 'terms', 'privacy', 'books'];
  // Friendly aliases: #textbooks opens the marketplace, same as #books.
  const HASH_ALIASES = { textbooks: 'books' };
  const resolveHash = (raw) => HASH_ALIASES[raw] || raw;

  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = resolveHash(window.location.hash.replace('#', ''));
      if (HASH_VIEWS.includes(hash)) return hash;
    }
    return 'landing';
  });

  const navigateTo = (view) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      window.location.hash = view === 'landing' ? '#landing' : `#${view}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleHash = () => {
      const hash = resolveHash(window.location.hash.replace('#', ''));
      if (HASH_VIEWS.includes(hash)) {
        setCurrentView(hash);
      } else if (hash === 'landing' || hash === '') {
        setCurrentView('landing');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Signed-in student (null when signed out). The generator is only reachable with a session.
  // Supabase's session check is async (it may need to refresh a token), so this starts null
  // and authChecked tracks whether that first check has come back yet.
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Fires immediately with whatever session Supabase already has, then again on every
  // sign-in / sign-out / token refresh - including signing out in another tab.
  useEffect(() => {
    return onSessionChange((next) => {
      setSession(next);
      setAuthChecked(true);
    });
  }, []);

  const handleSignOut = async () => {
    // Make sure the latest timetable edit reaches the database before the session ends.
    await flushSave();
    await signOut();
    setSession(null);
    if (typeof window !== 'undefined') {
      window.location.hash = '#landing';
      // Reload so the parsed PDF and generated timetable are cleared from memory.
      window.location.reload();
    }
  };

  const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'table'
  const [uploadState, setUploadState] = useState('idle'); // 'idle' | 'processing' | 'done'
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isDraggingMain, setIsDraggingMain] = useState(false);
  const [showPortalGuide, setShowPortalGuide] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('ALL');
  const [selectedSemester, setSelectedSemester] = useState(null); // null | 'S1' | 'S2'

  // Student's active enrolled modules
  const [enrolledModules, setEnrolledModules] = useState([]);
  const [setupEnrolledModules, setSetupEnrolledModules] = useState([]);

  // Modules that allow mixing lecture groups across periods (e.g. L1 from G01, L2 from G02)
  const [mixableModules, setMixableModules] = useState([]);
  const [setupMixableModules, setSetupMixableModules] = useState([]);

  // Selected group allocations: { [unitKey]: groupCode }
  const [selectedGroups, setSelectedGroups] = useState({});

  // 4 Optimization Preferences: 'morning' | 'afternoon' | 'free_day' | 'early_friday'
  const [schedulePreference, setSchedulePreference] = useState('morning');
  const [setupSemester, setSetupSemester] = useState('S2');
  const [setupPreference, setSetupPreference] = useState('morning');
  const [generatorResult, setGeneratorResult] = useState(null);

  // Active solution index when multiple clash-free solutions are found
  const [solutionIndex, setSolutionIndex] = useState(0);

  // Loading overlay shown while the solver runs (initial generation + preference/semester/module switches)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState('Generating your timetable…');

  const gridRef = useRef(null);
  const fileInputRef = useRef(null);

  const records = parsedData?.records || [];

  // Semester distribution stats
  const semesterStats = useMemo(() => {
    let s1 = 0;
    let s2 = 0;
    let other = 0;
    records.forEach((r) => {
      const s = (r.semester || '').toUpperCase().trim();
      if (s.startsWith('S1') || s.startsWith('Q1') || s.startsWith('Q2') || s === '1') {
        s1++;
      } else if (s.startsWith('S2') || s.startsWith('Q3') || s.startsWith('Q4') || s === '2') {
        s2++;
      } else {
        other++;
      }
    });
    return { s1, s2, other, total: records.length };
  }, [records]);

  // All distinct modules in the dataset for the chosen setup semester
  const availableModulesForSemester = useMemo(() => {
    const targetSem = setupSemester || 'S2';
    const matching = records.filter(r => isMatchingSemester(r.semester, targetSem));
    return Array.from(new Set(matching.map(r => r.module))).sort();
  }, [records, setupSemester]);

  // Consistent module themes map
  const moduleThemesMap = useMemo(() => {
    const map = {};
    let idx = 0;
    records.forEach((r) => {
      if (!map[r.module]) {
        map[r.module] = MODULE_THEMES[idx % MODULE_THEMES.length];
        idx++;
      }
    });
    return map;
  }, [records]);

  // Modules and their breakdown of activities (L, P, T) and available groups (per period if mixed)
  const moduleActivityGroups = useMemo(() => {
    const semesterSubset = selectedSemester
      ? records.filter((r) => isMatchingSemester(r.semester, selectedSemester) && enrolledModules.includes(r.module))
      : records;

    const map = {};
    semesterSubset.forEach((r) => {
      if (!map[r.module]) {
        map[r.module] = { L: {}, P: new Set(), T: new Set(), other: new Set() };
      }
      const act = r.activity || 'L';
      const grp = r.group || 'G01';
      const period = r.period || (act + '1');
      if (act === 'L') {
        if (!map[r.module].L[period]) map[r.module].L[period] = new Set();
        map[r.module].L[period].add(grp);
      } else if (map[r.module][act]) {
        map[r.module][act].add(grp);
      } else {
        map[r.module].other.add(grp);
      }
    });

    return Object.keys(map).sort().map((mod) => {
      const isMixed = mixableModules.includes(mod);
      const lecturePeriods = {};
      Object.keys(map[mod].L || {}).sort().forEach(p => {
        lecturePeriods[p] = Array.from(map[mod].L[p]).sort();
      });

      const allLectureGroups = Array.from(
        new Set(Object.values(map[mod].L || {}).flatMap(s => Array.from(s)))
      ).sort();

      const activities = {};
      if (isMixed && Object.keys(lecturePeriods).length > 1) {
        Object.entries(lecturePeriods).forEach(([p, grps]) => {
          activities[p] = { label: `Lecture (${p})`, unitKey: `${mod}_L_${p}`, groups: grps, isPeriod: true };
        });
      } else if (allLectureGroups.length > 0) {
        activities.L = { label: 'Lecture', unitKey: `${mod}_L`, groups: allLectureGroups, isPeriod: false };
      }

      ['P', 'T'].forEach((act) => {
        const list = Array.from(map[mod][act] || []).sort();
        if (list.length > 0) {
          activities[act] = {
            label: act === 'P' ? 'Practical' : 'Tutorial',
            unitKey: `${mod}_${act}`,
            groups: list,
            isPeriod: false
          };
        }
      });

      const otherList = Array.from(map[mod].other || []).sort();
      if (otherList.length > 0) {
        activities.other = {
          label: 'Other',
          unitKey: `${mod}_other`,
          groups: otherList,
          isPeriod: false
        };
      }

      return {
        module: mod,
        isMixed,
        theme: moduleThemesMap[mod] || MODULE_THEMES[0],
        activities,
        hasMultipleLecturePeriods: Object.keys(lecturePeriods).length > 1
      };
    });
  }, [records, selectedSemester, enrolledModules, mixableModules, moduleThemesMap]);

  // Run solver for a specific module list, semester, preference, and mixable list.
  // Deferred one tick so the loading overlay has a chance to paint before the
  // (synchronous, potentially slow) CSP solve blocks the main thread.
  const runSolver = (targetModules, targetSemester, targetPref, targetMixable, label) => {
    setGeneratingLabel(label || 'Generating your timetable…');
    setIsGenerating(true);

    setTimeout(() => {
      const mods = targetModules && targetModules.length > 0 ? targetModules : availableModulesForSemester;
      const sem = targetSemester || selectedSemester || 'S2';
      const pref = targetPref || schedulePreference || 'morning';
      const mixMods = targetMixable !== undefined ? targetMixable : mixableModules;

      const res = generateTimetable(records, mods, pref, sem, mixMods);
      setGeneratorResult(res);
      setSchedulePreference(pref);
      setSelectedSemester(sem);
      setEnrolledModules(mods);
      setMixableModules(mixMods);
      setSolutionIndex(0);

      if (res.selectedGroupsMap && Object.keys(res.selectedGroupsMap).length > 0) {
        setSelectedGroups(res.selectedGroupsMap);
      }
      setIsGenerating(false);
    }, 50);
  };

  // Auto-generate and populate timetable with chosen semester, preference, and mixable modules
  const handleApplySetup = () => {
    const sem = setupSemester || 'S2';
    const pref = setupPreference || 'morning';
    const mods = setupEnrolledModules.length > 0 ? setupEnrolledModules : availableModulesForSemester;
    const mixMods = setupMixableModules.filter(m => mods.includes(m));
    runSolver(mods, sem, pref, mixMods, 'Generating your timetable…');
  };

  // Switch between schedule preferences (Morning / Afternoon / Free Day / Early Fri)
  const handleTogglePreference = (newPref) => {
    if (!selectedSemester || !records.length) return;
    runSolver(enrolledModules, selectedSemester, newPref, mixableModules, 'Updating preference…');
  };

  const handleSwitchSemester = (newSem) => {
    const matching = records.filter(r => isMatchingSemester(r.semester, newSem));
    const newMods = Array.from(new Set(matching.map(r => r.module))).sort();
    const newMix = mixableModules.filter(m => newMods.includes(m));
    runSolver(newMods, newSem, schedulePreference, newMix, 'Switching semester…');
  };

  // Toggle mixable status for a module in active timetable
  const handleToggleMixableModule = (mod) => {
    let nextMix;
    if (mixableModules.includes(mod)) {
      nextMix = mixableModules.filter(m => m !== mod);
    } else {
      nextMix = [...mixableModules, mod].sort();
    }
    setMixableModules(nextMix);
    runSolver(enrolledModules, selectedSemester, schedulePreference, nextMix, 'Updating timetable…');
  };

  // Switch solution from the clash-free solution list
  const handleSelectSolution = (index) => {
    if (!generatorResult?.allSolutions || !generatorResult.allSolutions[index]) return;
    setSolutionIndex(index);
    const sol = generatorResult.allSolutions[index];
    if (sol.selectedGroupsMap) {
      setSelectedGroups(sol.selectedGroupsMap);
    }
  };

  // Toggle module on/off in the active timetable
  const handleToggleModule = (mod) => {
    let nextMods;
    if (enrolledModules.includes(mod)) {
      nextMods = enrolledModules.filter(m => m !== mod);
    } else {
      nextMods = [...enrolledModules, mod].sort();
    }
    const nextMix = mixableModules.filter(m => nextMods.includes(m));
    setEnrolledModules(nextMods);
    setMixableModules(nextMix);
    runSolver(nextMods, selectedSemester, schedulePreference, nextMix, 'Updating timetable…');
  };

  // Manually override group for an activity or period unitKey
  const handleManualGroupChange = (unitKey, groupCode) => {
    setSelectedGroups(prev => ({
      ...prev,
      [unitKey]: groupCode
    }));
  };

  // Events filtered for grid view based on semester, module filter, and EXACT group allocation per unitKey
  const events = useMemo(() => {
    if (!records.length || !selectedSemester || !enrolledModules.length) return [];

    let subset = records.filter((r) => 
      isMatchingSemester(r.semester, selectedSemester) && 
      enrolledModules.includes(r.module)
    );

    // Module focus filter
    if (selectedModuleFilter !== 'ALL') {
      subset = subset.filter((r) => r.module === selectedModuleFilter);
    }

    // STRICT SINGLE-GROUP FILTER:
    // If module is mixed and activity is 'L', check unitKey `${module}_L_${period}`
    // Otherwise check `${module}_${activity}`
    subset = subset.filter((r) => {
      const act = r.activity || 'L';
      const isMixed = mixableModules.includes(r.module) && act === 'L';
      const period = r.period || (act + '1');
      const unitKey = isMixed ? `${r.module}_${act}_${period}` : `${r.module}_${act}`;
      const chosenGroup = selectedGroups[unitKey] || selectedGroups[`${r.module}_${act}`] || selectedGroups[`${r.module}_${act}_${period}`];
      if (chosenGroup) {
        return r.group === chosenGroup;
      }
      return true;
    });

    return recordsToEvents(subset, moduleThemesMap);
  }, [records, selectedSemester, enrolledModules, selectedModuleFilter, selectedGroups, mixableModules, moduleThemesMap]);

  const schedule = useMemo(() => {
    const grid = Array.from({ length: PERIODS.length }, () =>
      Array.from({ length: DAYS.length }, () => [])
    );

    events.forEach((event) => {
      const dayIndex = DAYS.indexOf(event.day);
      const periodIndex = PERIODS.indexOf(event.time);
      if (dayIndex >= 0 && periodIndex >= 0) {
        grid[periodIndex][dayIndex].push(event);
      }
    });
    return grid;
  }, [events]);

  const totalClashes = useMemo(() => {
    let count = 0;
    schedule.forEach((row) => {
      row.forEach((slot) => {
        const distinctMod = new Set(slot.map((e) => e.title));
        if (distinctMod.size > 1) {
          count++;
        }
      });
    });
    return count;
  }, [schedule]);

  const handleFile = async (file) => {
    if (!file) return;
    const name = file.name || '';
    const isPdf = file.type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
    const startsWithRequired = name.toUpperCase().startsWith('UP_MOD_XLS');
    if (!isPdf || !startsWithRequired) {
      setUploadError('Filename must start with UP_MOD_XLS and have a .pdf extension.');
      return;
    }
    setSelectedFileName(file.name);
    setUploadError('');

    try {
      setUploadState('processing');
      setSelectedEvent(null);
      setParsedData(null);
      setSelectedSemester(null);
      setSelectedGroups({});

      // Parse 100% in-browser
      const data = await parsePdf(file);

      setParsedData(data);
      setUploadState('done');
      setSelectedModuleFilter('ALL');

      // Auto-detect dominant semester
      let s1Count = 0, s2Count = 0;
      data.records.forEach(r => {
        const s = (r.semester || '').toUpperCase().trim();
        if (s.startsWith('S1') || s.startsWith('Q1') || s.startsWith('Q2')) s1Count++;
        if (s.startsWith('S2') || s.startsWith('Q3') || s.startsWith('Q4')) s2Count++;
      });
      const detectedSem = s2Count >= s1Count ? 'S2' : 'S1';
      setSetupSemester(detectedSem);

      const semMatching = data.records.filter(r => isMatchingSemester(r.semester, detectedSem));
      const detectedMods = Array.from(new Set(semMatching.map(r => r.module))).sort();
      setSetupEnrolledModules(detectedMods);
      setSetupMixableModules(detectedMods);
      setMixableModules(detectedMods);
    } catch (e) {
      console.error('Client-side PDF parse error:', e);
      setUploadError('Error parsing PDF: ' + (e.message || 'unknown error'));
      setUploadState('idle');
    }
  };

  const onFileInputChange = (e) => {
    const f = e.target.files && e.target.files[0];
    handleFile(f);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(f);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const downloadFile = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!gridRef.current) return;
    setIsExporting(true);
    try {
      // Render at roughly 200 dpi for A4 landscape (~2200px wide), never more.
      // A fixed scale of 2 on a wide screen made enormous canvases.
      const gridWidth = gridRef.current.offsetWidth || 1;
      const scale = Math.min(2, 2200 / gridWidth);
      const canvas = await html2canvas(gridRef.current, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 20) / imgHeight);
      const w = imgWidth * ratio;
      const h = imgHeight * ratio;
      const x = (pdfWidth - w) / 2;
      const y = (pdfHeight - h) / 2;

      pdf.addImage(imgData, 'JPEG', x, y, w, h, undefined, 'FAST');
      const semSuffix = selectedSemester ? `_${selectedSemester}` : '';
      pdf.save(`UP_Timetable${semSuffix}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredTableRecords = useMemo(() => {
    if (!searchFilter.trim()) return records;
    const q = searchFilter.toLowerCase();
    return records.filter(
      (r) =>
        r.module.toLowerCase().includes(q) ||
        r.venue.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q) ||
        r.day.toLowerCase().includes(q) ||
        r.activity.toLowerCase().includes(q)
    );
  }, [records, searchFilter]);

  const curSolution = generatorResult?.allSolutions?.[solutionIndex] || generatorResult?.bestSolution;

  // ---------------------------------------------------------------------------
  // Saved timetable (per account)
  // The parsed PDF + the choices that produced the timetable are stored in Supabase
  // and restored on login. On restore we re-run the solver instead of storing its
  // output: smaller rows, and the result always matches the current solver code.
  // ---------------------------------------------------------------------------
  // Keyed on email, not the session object: the session object changes on every
  // token refresh and would otherwise re-trigger the load and overwrite live edits.
  const userKey = session?.email || null;
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [persistReady, setPersistReady] = useState(false); // saved copy loaded (or none exists)
  const saveTimerRef = useRef(null);
  const pendingSaveRef = useRef(null); // latest payload not yet written
  const lastSavedRef = useRef({ pd: null, json: '' }); // what the database already has

  const buildSettings = (v) => ({
    fileName: v.fileName,
    semester: v.semester,
    preference: v.preference,
    enrolledModules: v.enrolledModules,
    mixableModules: v.mixableModules,
    selectedGroups: v.selectedGroups,
    solutionIndex: v.solutionIndex,
  });

  const flushSave = async () => {
    clearTimeout(saveTimerRef.current);
    const payload = pendingSaveRef.current;
    if (!payload) return;
    pendingSaveRef.current = null;
    setSaveStatus('saving');
    try {
      await saveTimetable(payload);
      lastSavedRef.current = { pd: payload.parsedData, json: JSON.stringify(payload.settings) };
      setSaveStatus('saved');
    } catch (e) {
      console.error('Saving timetable failed:', e);
      pendingSaveRef.current = payload; // keep it so Retry has something to send
      setSaveStatus('error');
    }
  };

  // Load the saved timetable once per signed-in user.
  useEffect(() => {
    if (!userKey) return;
    let cancelled = false;
    setPersistReady(false);
    setGeneratingLabel('Loading your saved timetable…');
    setIsGenerating(true);

    (async () => {
      let saved = null;
      try {
        saved = await loadTimetable();
      } catch (e) {
        console.error('Could not load saved timetable:', e);
      }
      if (cancelled) return;

      const pd = saved?.parsedData;
      const s = saved?.settings;
      if (!pd?.records?.length || !s?.semester || !s?.enrolledModules?.length) {
        setIsGenerating(false);
        setPersistReady(true);
        return;
      }

      // Deferred one tick so the loading overlay paints before the solver blocks the thread.
      setTimeout(() => {
        if (cancelled) return;
        try {
          const pref = s.preference || 'morning';
          const mods = s.enrolledModules;
          const mix = s.mixableModules || [];
          const res = generateTimetable(pd.records, mods, pref, s.semester, mix);
          const idx = Math.min(s.solutionIndex || 0, Math.max(0, (res.allSolutions?.length || 1) - 1));
          const groups =
            s.selectedGroups && Object.keys(s.selectedGroups).length
              ? s.selectedGroups
              : res.selectedGroupsMap || {};
          const fileName = s.fileName || pd.originalName || '';

          // Mark this exact state as already saved so restoring doesn't trigger a re-save.
          lastSavedRef.current = {
            pd,
            json: JSON.stringify(buildSettings({
              fileName, semester: s.semester, preference: pref,
              enrolledModules: mods, mixableModules: mix, selectedGroups: groups, solutionIndex: idx,
            })),
          };

          setParsedData(pd);
          setUploadState('done');
          setSelectedFileName(fileName);
          setSetupSemester(s.semester);
          setSetupPreference(pref);
          setSetupEnrolledModules(mods);
          setSetupMixableModules(mix);
          setGeneratorResult(res);
          setSchedulePreference(pref);
          setSelectedSemester(s.semester);
          setEnrolledModules(mods);
          setMixableModules(mix);
          setSolutionIndex(idx);
          setSelectedGroups(groups);
          setSaveStatus('saved');
        } catch (e) {
          console.error('Could not restore saved timetable:', e);
        }
        setIsGenerating(false);
        setPersistReady(true);
      }, 50);
    })();

    return () => { cancelled = true; };
  }, [userKey]);

  // Debounced autosave whenever the generated timetable or its settings change.
  useEffect(() => {
    if (!persistReady || isGenerating) return;
    if (!parsedData || !selectedSemester || enrolledModules.length === 0) return;

    const settings = buildSettings({
      fileName: selectedFileName,
      semester: selectedSemester,
      preference: schedulePreference,
      enrolledModules,
      mixableModules,
      selectedGroups,
      solutionIndex,
    });
    const json = JSON.stringify(settings);
    if (lastSavedRef.current.pd === parsedData && lastSavedRef.current.json === json) return;

    pendingSaveRef.current = { parsedData, settings };
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, 1500);
    return () => clearTimeout(saveTimerRef.current);
  }, [
    persistReady, isGenerating, parsedData, selectedFileName, selectedSemester,
    schedulePreference, enrolledModules, mixableModules, selectedGroups, solutionIndex,
  ]);

  // Don't lose a pending edit when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  if (currentView === 'terms' || currentView === 'privacy') {
    return <LegalPage page={currentView} onNavigate={navigateTo} />;
  }

  if (currentView === 'landing') {
    return (
      <LandingPage
        onLaunchGenerator={() => navigateTo('generator')}
        onNavigate={navigateTo}
      />
    );
  }

  if (currentView === 'books') {
    return (
      <BooksPage
        session={session}
        authChecked={authChecked}
        onNavigate={navigateTo}
      />
    );
  }

  // Anything that isn't a known view goes home, rather than falling through into the generator.
  if (currentView !== 'generator') {
    return <LandingPage onLaunchGenerator={() => navigateTo('generator')} onNavigate={navigateTo} />;
  }

  // Avoid flashing the sign-in screen at an already-signed-in student while Supabase's
  // first session check is still in flight.
  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Loading…</span>
      </div>
    );
  }

  // Everything past this point needs a signed-in UP student.
  if (!session) {
    return (
      <AuthPage
        onAuthenticated={(newSession) => {
          setSession(newSession);
          window.scrollTo({ top: 0 });
        }}
        onBack={() => navigateTo('landing')}
        onNavigate={navigateTo}
      />
    );
  }

  return (
    <div className="app-shell">
      <PortalGuideModal open={showPortalGuide} onClose={() => setShowPortalGuide(false)} />
      <style>{`
        :root {
          --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --font-mono: 'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
          --bg-canvas: #f1f5f9;
          --bg-surface: #ffffff;
          --bg-subtle: #f8fafc;
          --border-color: #e2e8f0;
          --border-subtle: #edf2f7;
          --text-primary: #0f172a;
          --text-secondary: #475569;
          --text-muted: #64748b;
          --accent-blue: #0284c7;
          --accent-blue-subtle: #f0f9ff;
          --success: #16a34a;
          --success-bg: #f0fdf4;
          --success-border: #bbf7d0;
          --danger: #dc2626;
          --danger-bg: #fef2f2;
          --danger-border: #fecaca;
          --action-primary: #0f172a;
          --action-primary-hover: #1e293b;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: var(--font-sans);
          font-size: 14px;
          background: var(--bg-canvas);
          color: var(--text-primary);
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
        }

        .app-shell {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        /* Top Header Bar */
        .header-bar {
          height: 58px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo-mark {
          width: 34px;
          height: 34px;
          background: #0f172a;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #1e293b;
          flex-shrink: 0;
        }

        .brand-text-block {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .brand-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .brand-title-main {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .brand-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          background: #0284c7;
          color: #ffffff;
          padding: 2px 6px;
          border-radius: 3px;
          text-transform: uppercase;
        }

        .header-brand-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          background: #f0f9ff;
          color: #0369a1;
          padding: 2px 7px;
          border-radius: 4px;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        .brand-subtext {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }

        .header-tabs {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .tab-item {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          border: 1px solid transparent;
          padding: 7px 12px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.1s ease;
        }

        .tab-item:hover {
          color: var(--text-primary);
          background: var(--bg-subtle);
        }

        .tab-item.active {
          color: var(--text-primary);
          background: var(--bg-subtle);
          border-color: var(--border-color);
          font-weight: 600;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .user-menu {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-left: 12px;
          margin-left: 2px;
          border-left: 1px solid var(--border-color);
        }
        .user-chip {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary);
        }

        /* Buttons & Segmented Controls */
        .btn {
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          color: var(--text-primary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          transition: all 0.1s ease;
        }

        .btn:hover {
          background: var(--bg-subtle);
          border-color: #cbd5e1;
        }

        .btn-primary {
          background: var(--action-primary);
          color: #ffffff;
          border-color: var(--action-primary);
        }

        .btn-primary:hover {
          background: var(--action-primary-hover);
          border-color: var(--action-primary-hover);
        }

        .btn-sm {
          font-size: 12px;
          padding: 4px 8px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .segmented-group {
          display: inline-flex;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 2px;
          gap: 2px;
        }

        .segmented-btn {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 9px;
          border-radius: 3px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .segmented-btn:hover {
          color: var(--text-primary);
        }

        .segmented-btn.active {
          background: var(--bg-surface);
          color: var(--text-primary);
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        /* Workstation Layout */
        .workspace-grid {
          display: grid;
          grid-template-columns: 320px 1fr;
          flex: 1;
          min-height: calc(100vh - 58px);
        }

        .sidebar-rail {
          background: var(--bg-surface);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          max-height: calc(100vh - 58px);
        }

        .sidebar-section {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .sidebar-heading {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Dropzone Component */
        .dropzone {
          border: 1px dashed var(--border-color);
          background: var(--bg-subtle);
          border-radius: 4px;
          padding: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dropzone:hover {
          border-color: #94a3b8;
          background: #e2e8f0;
        }

        .dropzone-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          margin-top: 4px;
        }

        .dropzone-hint {
          font-size: 11px;
          font-family: var(--font-mono);
          color: var(--text-muted);
          margin-top: 2px;
        }

        /* Large drag-and-drop zone shown in the main canvas before a PDF is uploaded */
        .main-dropzone {
          width: 100%;
          max-width: 480px;
          box-sizing: border-box;
          border: 2px dashed #94a3b8;
          background: var(--bg-subtle);
          border-radius: 12px;
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #0e3868;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
        }

        .main-dropzone:hover {
          border-color: #0e3868;
          background: #eef4fb;
        }

        .main-dropzone.dragging {
          border-color: #0e3868;
          background: #dbeafe;
          transform: scale(1.01);
        }

        .main-dropzone.processing {
          pointer-events: none;
          opacity: 0.7;
        }

        .main-dropzone-title {
          font-size: 15px;
          font-weight: 700;
          color: #0e3868;
        }

        .main-dropzone-or {
          font-size: 12px;
          color: var(--text-muted);
        }

        .portal-guide-trigger {
          display: block;
          width: 100%;
          text-align: center;
          background: none;
          border: none;
          padding: 8px 0 0;
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 600;
          color: #2563eb;
          cursor: pointer;
        }
        .portal-guide-trigger:hover { text-decoration: underline; }

        .file-status-card {
          margin-top: 10px;
          padding: 8px 10px;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .file-status-name {
          font-family: var(--font-mono);
          font-weight: 500;
          color: var(--text-primary);
          word-break: break-all;
        }

        .file-status-count {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .alert-error {
          margin-top: 10px;
          padding: 8px 10px;
          background: var(--danger-bg);
          border: 1px solid var(--danger-border);
          color: var(--danger);
          font-size: 13px;
          border-radius: 4px;
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }

        /* Schedule Status Banner in Sidebar */
        .schedule-status-banner {
          background: var(--success-bg);
          border: 1px solid var(--success-border);
          padding: 10px 12px;
          border-radius: 4px;
          font-size: 12px;
        }

        .schedule-status-banner.has-clash-banner {
          background: var(--danger-bg);
          border-color: var(--danger-border);
        }

        .schedule-status-title {
          font-weight: 600;
          color: var(--success);
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 3px;
        }

        .schedule-status-title.has-clash-title {
          color: var(--danger);
        }

        .schedule-status-meta {
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.4;
        }

        /* Solution Carousel Navigator */
        .solution-navigator {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 6px 10px;
          margin-top: 10px;
          gap: 8px;
        }

        .solution-nav-info {
          font-size: 12px;
          font-family: var(--font-mono);
          font-weight: 600;
          color: var(--text-primary);
          text-align: center;
        }

        .enrolled-module-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .enrolled-module-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 10px 12px;
          transition: all 0.1s ease;
        }

        .enrolled-module-card.focused {
          border-color: #0284c7;
          background: #f0f9ff;
        }

        .enrolled-module-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
        }

        .module-swatch {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          border: 1px solid rgba(0, 0, 0, 0.15);
        }

        .mix-toggle-pill {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid var(--border-color);
          background: var(--bg-subtle);
          color: var(--text-muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.1s ease;
        }

        .mix-toggle-pill:hover {
          color: var(--text-primary);
          border-color: #94a3b8;
        }

        .mix-toggle-pill.active {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #0284c7;
          font-weight: 600;
        }

        .activity-selectors-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 6px;
          border-top: 1px solid var(--border-subtle);
          padding-top: 6px;
        }

        .activity-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
        }

        .activity-label {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
        }

        .group-select {
          font-family: var(--font-mono);
          font-size: 12px;
          padding: 3px 6px;
          border-radius: 3px;
          border: 1px solid var(--border-color);
          background: var(--bg-subtle);
          color: var(--text-primary);
          cursor: pointer;
        }

        /* Setup Workflow Screen (Module Selection + Mixing + Preference) */
        .setup-workflow-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 32px 28px;
          max-width: 980px;
          margin: 30px auto;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        }

        .setup-workflow-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .setup-workflow-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          margin-top: 8px;
          margin-bottom: 6px;
        }

        .setup-workflow-desc {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .setup-steps-grid-3 {
          display: grid;
          grid-template-columns: 1.1fr 1fr 1.1fr;
          gap: 16px;
        }

        .setup-step-card {
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .setup-step-number {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-blue);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .setup-step-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .setup-step-subdesc {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .module-checkbox-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 6px;
          max-height: 200px;
          overflow-y: auto;
          padding: 6px;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 4px;
        }

        .module-checkbox-label {
          font-family: var(--font-mono);
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border-radius: 3px;
          cursor: pointer;
          border: 1px solid transparent;
        }

        .module-checkbox-label:hover {
          background: var(--bg-subtle);
        }

        .module-checkbox-label.selected {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1e40af;
          font-weight: 600;
        }

        .setup-options-group {
          display: flex;
          gap: 8px;
        }

        .setup-options-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .setup-option-btn {
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          padding: 10px 12px;
          border-radius: 4px;
          cursor: pointer;
          text-align: left;
          transition: all 0.1s ease;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .setup-option-btn:hover {
          border-color: #94a3b8;
        }

        .setup-option-btn.active {
          border-color: #0284c7;
          background: #f0f9ff;
          box-shadow: 0 0 0 1px #0284c7;
        }

        /* Main Workspace Canvas */
        .main-canvas {
          background: var(--bg-canvas);
          display: flex;
          flex-direction: column;
          overflow-x: auto;
        }

        .canvas-toolbar {
          padding: 10px 20px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .canvas-meta {
          font-size: 13px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .status-chip {
          font-family: var(--font-mono);
          font-size: 12px;
          background: #e0f2fe;
          color: #0369a1;
          padding: 3px 8px;
          border-radius: 3px;
          border: 1px solid #bae6fd;
        }

        .clash-warning-box {
          margin: 14px 20px 0;
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          font-size: 13px;
          color: #991b1b;
        }

        .clash-warning-box strong {
          display: block;
          margin-bottom: 4px;
        }

        .clash-item-bullet {
          font-family: var(--font-mono);
          font-size: 12px;
          margin-left: 18px;
          margin-top: 3px;
        }

        /* Timetable Schedule Grid */
        .timetable-container {
          padding: 20px;
          flex: 1;
        }

        .timetable-board {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          overflow: hidden;
        }

        .timetable-grid {
          display: grid;
          grid-template-columns: 74px repeat(5, minmax(150px, 1fr));
          border-collapse: collapse;
          width: 100%;
        }

        .grid-header-cell {
          background: var(--bg-subtle);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          text-align: center;
        }

        .time-col-cell {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          background: var(--bg-subtle);
          padding: 10px 8px;
          border-bottom: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          text-align: center;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        .slot-cell {
          border-bottom: 1px solid var(--border-subtle);
          border-right: 1px solid var(--border-subtle);
          padding: 6px;
          min-height: 94px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          background: var(--bg-surface);
          position: relative;
        }

        .slot-cell.has-clash {
          background: #fff1f2 !important;
          outline: 2px solid #ef4444;
          outline-offset: -2px;
          z-index: 2;
        }

        .clash-indicator-badge {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 2px 6px;
          border-radius: 3px;
          margin-bottom: 2px;
          align-self: flex-start;
          line-height: 1.2;
        }

        .clash-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ef4444;
          display: inline-block;
          flex-shrink: 0;
        }

        .clash-summary-chip {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          background: #fef2f2;
          color: #dc2626;
          padding: 3px 8px;
          border-radius: 3px;
          border: 1px solid #fecaca;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        /* Class Block Cards */
        .class-block {
          border-radius: 4px;
          padding: 8px 10px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: transform 0.05s ease, border-color 0.1s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 74px;
        }

        .class-block.class-block-clashing {
          border-left: 4px solid #ef4444 !important;
        }

        .class-block:hover {
          border-color: #64748b !important;
        }

        .class-block-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 6px;
        }

        .class-module-title {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.25;
        }

        .class-act-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          opacity: 0.85;
          border: 1px solid currentColor;
          border-radius: 2px;
          padding: 0 4px;
          line-height: 1.2;
        }

        .class-block-body {
          margin-top: 5px;
        }

        .class-venue {
          font-size: 12px;
          font-weight: 500;
          line-height: 1.3;
          color: var(--text-primary);
        }

        .class-group {
          font-size: 11px;
          font-family: var(--font-mono);
          opacity: 0.85;
          margin-top: 2px;
        }

        /* Inspector Drawer / Modal */
        .inspector-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }

        .inspector-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          width: min(480px, 100%);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          overflow: hidden;
        }

        .inspector-header {
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-subtle);
        }

        .inspector-title {
          font-family: var(--font-mono);
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .inspector-close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
        }

        .inspector-close-btn:hover {
          color: var(--text-primary);
          background: var(--border-color);
        }

        .inspector-grid {
          padding: 18px;
          display: grid;
          grid-template-columns: 110px 1fr;
          row-gap: 12px;
          font-size: 13px;
        }

        .inspector-key {
          color: var(--text-muted);
          font-weight: 500;
        }

        .inspector-val {
          color: var(--text-primary);
          font-weight: 500;
        }

        .inspector-val.mono {
          font-family: var(--font-mono);
        }

        .inspector-footer {
          padding: 12px 18px;
          border-top: 1px solid var(--border-color);
          background: var(--bg-subtle);
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        /* Tabular View Page */
        .table-view-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-width: 1440px;
          width: 100%;
          margin: 0 auto;
        }

        .table-summary-bar {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .summary-left {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: var(--text-primary);
        }

        .summary-badge {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          color: var(--success);
          background: var(--success-bg);
          border: 1px solid var(--success-border);
          padding: 3px 8px;
          border-radius: 3px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .search-control {
          position: relative;
          width: 100%;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          display: flex;
        }

        .table-search-input {
          width: 100%;
          padding: 10px 14px 10px 36px;
          font-family: var(--font-sans);
          font-size: 13px;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          outline: none;
        }

        .table-search-input:focus {
          border-color: #94a3b8;
        }

        .data-table-wrap {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          overflow-x: auto;
          max-height: calc(100vh - 240px);
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          text-align: left;
        }

        .data-table th {
          background: var(--bg-subtle);
          color: var(--text-secondary);
          font-weight: 600;
          padding: 10px 14px;
          position: sticky;
          top: 0;
          border-bottom: 1px solid var(--border-color);
          white-space: nowrap;
          z-index: 10;
        }

        .data-table td {
          padding: 10px 14px;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-primary);
          white-space: nowrap;
        }

        .data-table tr:hover td {
          background: var(--bg-subtle);
        }

        .badge-tag {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid var(--border-color);
          background: var(--bg-subtle);
          color: var(--text-secondary);
        }

        .badge-l {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1e40af;
        }

        .badge-p {
          background: #fffbeb;
          border-color: #fde68a;
          color: #92400e;
        }

        .badge-t {
          background: #faf5ff;
          border-color: #e9d5ff;
          color: #6b21a8;
        }

        .font-mono {
          font-family: var(--font-mono);
        }

        @media (max-width: 860px) {
          .user-chip {
            display: none;
          }
          .workspace-grid {
            grid-template-columns: 1fr;
          }
          .sidebar-rail {
            border-right: none;
            border-bottom: 1px solid var(--border-color);
          }
          .setup-steps-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Top Utility Header */}
      <header className="header-bar">
        <div
          className="header-brand"
          onClick={() => navigateTo('landing')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigateTo('landing'); }}
          title="Back to StudyStack Landing Page"
        >
          <div className="brand-logo-mark" aria-hidden="true" style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: 2, overflow: 'hidden' }}>
            <img src="/studystack-mark.png" alt="StudyStack" width="28" height="28" style={{ objectFit: 'contain', display: 'block' }} />
          </div>
          <div className="brand-text-block">
            <div className="brand-title-row">
              <span className="brand-title-main" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: '#0e3868' }}>StudyStack</span>
              <span className="header-brand-badge">Timetable Generator</span>
            </div>
          </div>
        </div>

        <nav className="header-tabs">
          <button
            className="tab-item"
            onClick={() => navigateTo('landing')}
            title="Return to StudyStack Home"
          >
            <span>← Home</span>
          </button>
          <button
            className={`tab-item ${activeTab === 'grid' ? 'active' : ''}`}
            onClick={() => setActiveTab('grid')}
          >
            <Icons.Calendar />
            <span>Weekly timetable</span>
          </button>
          <button
            className={`tab-item ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            <Icons.Table />
            <span>Parsed records</span>
            {records.length > 0 && <span className="badge-tag" style={{ marginLeft: 4 }}>{records.length}</span>}
          </button>
        </nav>

        <div className="header-actions">
          {records.length > 0 && activeTab === 'grid' && selectedSemester && (
            <>
              {/* 4-Item Quick Preference Switcher */}
              <div className="segmented-group">
                <button
                  className={`segmented-btn ${schedulePreference === 'morning' ? 'active' : ''}`}
                  onClick={() => handleTogglePreference('morning')}
                  title="Earlier classes first"
                  disabled={isGenerating}
                >
                  <Icons.Sun />
                  <span>Morning</span>
                </button>
                <button
                  className={`segmented-btn ${schedulePreference === 'afternoon' ? 'active' : ''}`}
                  onClick={() => handleTogglePreference('afternoon')}
                  title="Later classes first"
                  disabled={isGenerating}
                >
                  <Icons.Sunset />
                  <span>Afternoon</span>
                </button>
                <button
                  className={`segmented-btn ${schedulePreference === 'free_day' ? 'active' : ''}`}
                  onClick={() => handleTogglePreference('free_day')}
                  title="Maximize days with 0 classes or lightest day"
                  disabled={isGenerating}
                >
                  <Icons.Coffee />
                  <span>Free day</span>
                </button>
                <button
                  className={`segmented-btn ${schedulePreference === 'early_friday' ? 'active' : ''}`}
                  onClick={() => handleTogglePreference('early_friday')}
                  title="Finish Friday as early as possible"
                  disabled={isGenerating}
                >
                  <Icons.Zap />
                  <span>Early Fri</span>
                </button>
              </div>

              {/* Semester Switcher */}
              <div className="segmented-group">
                <button
                  className={`segmented-btn ${selectedSemester === 'S1' ? 'active' : ''}`}
                  onClick={() => handleSwitchSemester('S1')}
                  disabled={isGenerating}
                >
                  S1
                </button>
                <button
                  className={`segmented-btn ${selectedSemester === 'S2' ? 'active' : ''}`}
                  onClick={() => handleSwitchSemester('S2')}
                  disabled={isGenerating}
                >
                  S2
                </button>
              </div>

              <button
                className="btn btn-primary"
                onClick={downloadPdf}
                disabled={isExporting}
              >
                <Icons.Download />
                <span>{isExporting ? 'Generating PDF…' : 'Export PDF'}</span>
              </button>
            </>
          )}

          <div className="user-menu">
            {saveStatus !== 'idle' && (
              <span
                role="status"
                style={{
                  fontSize: 12,
                  color: saveStatus === 'error' ? 'var(--danger)' : 'var(--text-muted)',
                }}
              >
                {saveStatus === 'saving' && 'Saving…'}
                {saveStatus === 'saved' && 'Saved to your account'}
                {saveStatus === 'error' && (
                  <>
                    Couldn't save{' '}
                    <button className="btn btn-sm" onClick={flushSave}>Retry</button>
                  </>
                )}
              </span>
            )}
            <span className="user-chip" title={session.email}>u{session.studentNumber}</span>
            <button className="btn btn-sm" onClick={handleSignOut} title={`Signed in as ${session.email}`}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'grid' ? (
        <div className="workspace-grid">
          {/* Left Control Rail */}
          <aside className="sidebar-rail">
            <div className="sidebar-section">
              <div className="sidebar-heading">
                <span>Source document</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={onFileInputChange}
              />

              <div
                className="dropzone"
                role="button"
                tabIndex={0}
                aria-label="Upload UP module PDF — click or drop file here"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onClick={() => {
                  setUploadError('');
                  fileInputRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setUploadError('');
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Icons.Upload />
                <div className="dropzone-label">
                  {uploadState === 'processing'
                    ? 'Extracting schedule entries…'
                    : uploadState === 'done'
                    ? 'Replace PDF file'
                    : 'Upload UP module PDF'}
                </div>
                <div className="dropzone-hint">UP_MOD_XLS*.pdf</div>
              </div>

              <button
                type="button"
                className="portal-guide-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPortalGuide(true);
                }}
              >
                Where do I get this file?
              </button>

              {selectedFileName && (
                <div className="file-status-card">
                  <div className="file-status-name">{selectedFileName}</div>
                  <div className="file-status-count">
                    <Icons.FileText />
                    <span>{records.length} schedule entries</span>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="alert-error">
                  <Icons.AlertCircle />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            {records.length > 0 && selectedSemester && (
              <>
                <div className="sidebar-section">
                  <div className={`schedule-status-banner ${totalClashes > 0 ? 'has-clash-banner' : ''}`}>
                    <div className={`schedule-status-title ${totalClashes > 0 ? 'has-clash-title' : ''}`}>
                      {totalClashes > 0 ? <Icons.AlertCircle /> : <Icons.Check />}
                      <span>
                        {totalClashes > 0
                          ? `${totalClashes} Clashing Slot${totalClashes === 1 ? '' : 's'}`
                          : schedulePreference === 'free_day'
                          ? 'Free Day Optimization'
                          : schedulePreference === 'early_friday'
                          ? 'Early Friday Optimization'
                          : schedulePreference === 'afternoon'
                          ? 'Afternoon Schedule'
                          : 'Morning Schedule'}
                      </span>
                    </div>
                    <div className="schedule-status-meta">
                      {totalClashes > 0 ? (
                        <span>Showing best allocation with minimal clashes ({events.length} sessions)</span>
                      ) : schedulePreference === 'free_day' ? (
                        <strong>{curSolution?.freeDayPrompt || curSolution?.summaryPrompt} ({events.length} sessions)</strong>
                      ) : schedulePreference === 'morning' ? (
                        <strong>{curSolution?.morningPrompt || (curSolution?.latestEndTimeFormatted ? `Latest class ends at ${curSolution.latestEndTimeFormatted}` : curSolution?.summaryPrompt)} ({events.length} sessions)</strong>
                      ) : schedulePreference === 'afternoon' ? (
                        <strong>{curSolution?.afternoonPrompt || (curSolution?.earliestStartTimeFormatted ? `Earliest class starts at ${curSolution.earliestStartTimeFormatted}` : curSolution?.summaryPrompt)} ({events.length} sessions)</strong>
                      ) : schedulePreference === 'early_friday' ? (
                        <strong>{curSolution?.earlyFridayPrompt || (curSolution?.fridayEndFormatted ? `Done by ${curSolution.fridayEndFormatted} on Friday` : curSolution?.summaryPrompt)} ({events.length} sessions)</strong>
                      ) : (
                        <span>{events.length} sessions · Avg start {curSolution?.avgStartTimeFormatted || '08:30'}</span>
                      )}
                    </div>
                  </div>

                  {/* Solution Carousel Selector */}
                  {generatorResult?.allSolutions && generatorResult.allSolutions.length > 1 && (
                    <div className="solution-navigator">
                      <button
                        className="btn btn-sm"
                        disabled={solutionIndex === 0}
                        onClick={() => handleSelectSolution(solutionIndex - 1)}
                        title="Previous clash-free option"
                      >
                        <Icons.ChevronLeft />
                      </button>
                      <span className="solution-nav-info">
                        Option {solutionIndex + 1} of {generatorResult.allSolutions.length}
                      </span>
                      <button
                        className="btn btn-sm"
                        disabled={solutionIndex >= generatorResult.allSolutions.length - 1}
                        onClick={() => handleSelectSolution(solutionIndex + 1)}
                        title="Next clash-free option"
                      >
                        <Icons.ChevronRight />
                      </button>
                    </div>
                  )}
                </div>

                <div className="sidebar-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="sidebar-heading">
                    <span>Enrolled modules ({enrolledModules.length})</span>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setSelectedSemester(null); // Re-open configuration
                      }}
                      title="Add or remove enrolled modules"
                    >
                      Edit modules
                    </button>
                  </div>

                  <div className="enrolled-module-list">
                    {moduleActivityGroups.map((item) => (
                      <div
                        key={item.module}
                        className={`enrolled-module-card ${selectedModuleFilter === item.module ? 'focused' : ''}`}
                      >
                        <div className="enrolled-module-row">
                          <div 
                            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}
                            onClick={() => setSelectedModuleFilter(selectedModuleFilter === item.module ? 'ALL' : item.module)}
                            title="Click to focus on this module in the grid"
                          >
                            <span
                              className="module-swatch"
                              style={{ background: item.theme.border }}
                            />
                            <strong className="font-mono" style={{ fontSize: 12 }}>
                              {item.module}
                            </strong>
                          </div>

                          {item.hasMultipleLecturePeriods && (
                            <button
                              type="button"
                              className={`mix-toggle-pill ${item.isMixed ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleMixableModule(item.module);
                              }}
                              title={item.isMixed ? 'Lecture groups are mixed across periods. Click to lock to single group.' : 'Click to allow mixing lecture groups across periods'}
                            >
                              <Icons.Shuffle />
                              <span>{item.isMixed ? 'Mixed' : 'Mix'}</span>
                            </button>
                          )}

                          <button
                            className="btn btn-sm"
                            style={{ padding: '2px 5px', fontSize: 10, lineHeight: 1 }}
                            onClick={() => handleToggleModule(item.module)}
                            title="Remove this module from timetable"
                          >
                            <Icons.Close />
                          </button>
                        </div>

                        {/* Interactive Group Selectors per Activity / Period */}
                        <div className="activity-selectors-grid">
                          {Object.entries(item.activities).map(([key, actInfo]) => {
                            const chosen = selectedGroups[actInfo.unitKey] || actInfo.groups[0];
                            return (
                              <div key={key} className="activity-row">
                                <span className="activity-label">
                                  {actInfo.label}:
                                </span>
                                <select
                                  className="group-select"
                                  value={chosen}
                                  onChange={(e) => handleManualGroupChange(actInfo.unitKey, e.target.value)}
                                >
                                  {actInfo.groups.map(g => (
                                    <option key={g} value={g}>{g}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </aside>

          {/* Main Canvas */}
          <main className="main-canvas">
            {records.length > 0 && selectedSemester && (
              <>
                <div className="canvas-toolbar">
                  <div className="canvas-meta">
                    <span>Displaying</span>
                    <strong className="font-mono">{events.length}</strong>
                    <span>sessions for</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {selectedSemester === 'S1' ? 'Semester 1' : 'Semester 2'}
                    </strong>
                    <span>
                      ({schedulePreference === 'free_day'
                        ? 'Free day preference'
                        : schedulePreference === 'early_friday'
                        ? 'Early Friday preference'
                        : schedulePreference === 'afternoon'
                        ? 'Afternoon preference'
                        : 'Morning preference'})
                    </span>

                    {totalClashes > 0 && (
                      <span className="clash-summary-chip">
                        <Icons.AlertCircle />
                        <span>{totalClashes} clashing slot{totalClashes === 1 ? '' : 's'}</span>
                      </span>
                    )}

                    {selectedModuleFilter !== 'ALL' && (
                      <span className="status-chip">
                        Focus: {selectedModuleFilter}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selectedModuleFilter !== 'ALL' && (
                      <button
                        className="btn btn-sm"
                        onClick={() => setSelectedModuleFilter('ALL')}
                      >
                        Reset module focus
                      </button>
                    )}
                  </div>
                </div>

                {generatorResult?.hasClashes && generatorResult.uniqueClashMessages?.length > 0 && (
                  <div className="clash-warning-box">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--danger)' }}>
                      <Icons.AlertCircle />
                      <span>Schedule Conflict Detected:</span>
                    </div>
                    <span>No conflict-free group combination exists with all {enrolledModules.length} modules selected. Conflicting sessions:</span>
                    {generatorResult.uniqueClashMessages.map((msg, i) => (
                      <div key={i} className="clash-item-bullet">• {msg}</div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="timetable-container">
              {records.length > 0 ? (
                selectedSemester ? (
                  <div className="timetable-board" ref={gridRef}>
                    <div className="timetable-grid">
                      <div className="grid-header-cell" style={{ background: '#f8fafc' }}>
                        Time
                      </div>
                      {DAYS.map((day) => (
                        <div className="grid-header-cell" key={day}>
                          {day}
                        </div>
                      ))}

                      {PERIODS.map((period, rowIndex) => (
                        <React.Fragment key={period}>
                          <div className="time-col-cell">{period}</div>
                          {DAYS.map((day, colIndex) => {
                            const slotEvents = schedule[rowIndex][colIndex] || [];
                            const distinctMod = new Set(slotEvents.map((e) => e.title));
                            const hasClash = distinctMod.size > 1;

                            return (
                              <div
                                className={`slot-cell ${hasClash ? 'has-clash' : ''}`}
                                key={`${period}-${day}`}
                              >
                                {hasClash && (
                                  <div className="clash-indicator-badge">
                                    <span className="clash-dot" />
                                    <span>Clash ({slotEvents.length})</span>
                                  </div>
                                )}
                                {slotEvents.map((event) => (
                                  <div
                                    key={event.id}
                                    className={`class-block ${hasClash ? 'class-block-clashing' : ''}`}
                                    style={{
                                      background: event.theme.bg,
                                      borderColor: event.theme.border,
                                    }}
                                    onClick={() => setSelectedEvent(event)}
                                  >
                                    <div className="class-block-header">
                                      <span
                                        className="class-module-title"
                                        style={{ color: event.theme.text }}
                                      >
                                        {event.title}
                                      </span>
                                      <span className="class-act-badge">
                                        {event.activityCode || 'L'}
                                      </span>
                                    </div>
                                    <div className="class-block-body">
                                      <div className="class-venue">{event.room}</div>
                                      <div className="class-group">
                                        {event.group} · {event.semester}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Module Selection & Configuration Screen */
                  <div className="setup-workflow-card">
                    <div className="setup-workflow-header">
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                        <img src="/studystack-mark.png" alt="StudyStack" width="36" height="36" style={{ objectFit: 'contain' }} />
                      </div>
                      <span className="brand-tag" style={{ background: '#0e3868' }}>Auto Timetable Generator</span>
                      <h2 className="setup-workflow-title">Select Modules & Preferences</h2>
                      <p className="setup-workflow-desc">
                        {records.length} schedule entries extracted. Customize your enrolled modules, group mixing flexibility, and optimization goal.
                      </p>
                    </div>

                    <div className="setup-steps-grid setup-steps-grid-3">
                      {/* Step 1: Semester & Module Checkboxes */}
                      <div className="setup-step-card">
                        <div className="setup-step-number">Step 1</div>
                        <div className="setup-step-label">Semester & Modules</div>
                        
                        <div className="setup-options-group">
                          <button
                            type="button"
                            className={`setup-option-btn ${setupSemester === 'S1' ? 'active' : ''}`}
                            onClick={() => {
                              setSetupSemester('S1');
                              const m = records.filter(r => isMatchingSemester(r.semester, 'S1'));
                              const mods = Array.from(new Set(m.map(r => r.module))).sort();
                              setSetupEnrolledModules(mods);
                              setSetupMixableModules(mods);
                            }}
                          >
                            <strong style={{ fontSize: 12 }}>Semester 1</strong>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {semesterStats.s1} entries
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`setup-option-btn ${setupSemester === 'S2' ? 'active' : ''}`}
                            onClick={() => {
                              setSetupSemester('S2');
                              const m = records.filter(r => isMatchingSemester(r.semester, 'S2'));
                              const mods = Array.from(new Set(m.map(r => r.module))).sort();
                              setSetupEnrolledModules(mods);
                              setSetupMixableModules(mods);
                            }}
                          >
                            <strong style={{ fontSize: 12 }}>Semester 2</strong>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {semesterStats.s2} entries
                            </span>
                          </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                            Enrolled ({setupEnrolledModules.length} of {availableModulesForSemester.length}):
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              if (setupEnrolledModules.length === availableModulesForSemester.length) {
                                setSetupEnrolledModules([]);
                              } else {
                                setSetupEnrolledModules(availableModulesForSemester);
                              }
                            }}
                          >
                            {setupEnrolledModules.length === availableModulesForSemester.length ? 'Clear' : 'Select All'}
                          </button>
                        </div>

                        <div className="module-checkbox-grid">
                          {availableModulesForSemester.map(mod => {
                            const isChecked = setupEnrolledModules.includes(mod);
                            return (
                              <label key={mod} className={`module-checkbox-label ${isChecked ? 'selected' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSetupEnrolledModules(prev => [...prev, mod].sort());
                                    } else {
                                      setSetupEnrolledModules(prev => prev.filter(m => m !== mod));
                                    }
                                  }}
                                />
                                <span>{mod}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Step 2: Mix Lecture Groups */}
                      <div className="setup-step-card">
                        <div className="setup-step-number">Step 2</div>
                        <div className="setup-step-label">Mix Lecture Groups</div>
                        <div className="setup-step-subdesc">
                          Allow selecting different groups per lecture period (e.g. L1 from G01, L2 from G03) to eliminate clashes & free up days.
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                            Mixable ({setupMixableModules.filter(m => setupEnrolledModules.includes(m)).length} of {setupEnrolledModules.length}):
                          </span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setSetupMixableModules(setupEnrolledModules)}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setSetupMixableModules([])}
                            >
                              None
                            </button>
                          </div>
                        </div>

                        <div className="module-checkbox-grid">
                          {setupEnrolledModules.map(mod => {
                            const isChecked = setupMixableModules.includes(mod);
                            return (
                              <label key={mod} className={`module-checkbox-label ${isChecked ? 'selected' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSetupMixableModules(prev => [...prev, mod].sort());
                                    } else {
                                      setSetupMixableModules(prev => prev.filter(m => m !== mod));
                                    }
                                  }}
                                />
                                <span>{mod}</span>
                              </label>
                            );
                          })}
                          {setupEnrolledModules.length === 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                              Select enrolled modules in Step 1 first
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 3: Preference */}
                      <div className="setup-step-card">
                        <div className="setup-step-number">Step 3</div>
                        <div className="setup-step-label">Optimization Goal</div>
                        <div className="setup-options-grid-2">
                          <button
                            type="button"
                            className={`setup-option-btn ${setupPreference === 'morning' ? 'active' : ''}`}
                            onClick={() => setSetupPreference('morning')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Icons.Sun />
                              <strong style={{ fontSize: 12 }}>Morning</strong>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              Earlier classes first
                            </span>
                          </button>

                          <button
                            type="button"
                            className={`setup-option-btn ${setupPreference === 'afternoon' ? 'active' : ''}`}
                            onClick={() => setSetupPreference('afternoon')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Icons.Sunset />
                              <strong style={{ fontSize: 12 }}>Afternoon</strong>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              Later classes first
                            </span>
                          </button>

                          <button
                            type="button"
                            className={`setup-option-btn ${setupPreference === 'free_day' ? 'active' : ''}`}
                            onClick={() => setSetupPreference('free_day')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Icons.Coffee />
                              <strong style={{ fontSize: 12 }}>Free day</strong>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              Maximize free days & light days
                            </span>
                          </button>

                          <button
                            type="button"
                            className={`setup-option-btn ${setupPreference === 'early_friday' ? 'active' : ''}`}
                            onClick={() => setSetupPreference('early_friday')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Icons.Zap />
                              <strong style={{ fontSize: 12 }}>Early Friday</strong>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              Finishes Friday early
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 24, textAlign: 'center' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '10px 24px', fontSize: 13, fontWeight: 600 }}
                        disabled={setupEnrolledModules.length === 0 || isGenerating}
                        onClick={handleApplySetup}
                      >
                        <Icons.Sparkles />
                        <span>{isGenerating ? 'Generating…' : `Generate conflict-free timetable (${setupEnrolledModules.length} modules)`}</span>
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="timetable-board" style={{ padding: '64px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img
                    src="/studystack-logo-cropped.png"
                    alt="StudyStack Logo"
                    style={{ height: 72, width: 'auto', objectFit: 'contain', marginBottom: 16 }}
                  />
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0e3868', marginBottom: 6, letterSpacing: '-0.02em' }}>
                    Welcome to StudyStack
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.6 }}>
                    Upload your official University of Pretoria module timetable PDF (<code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>UP_MOD_XLS*.pdf</code>) to automatically resolve clashes and generate your schedule.
                  </div>
                  <div
                    className={`main-dropzone${isDraggingMain ? ' dragging' : ''}${uploadState === 'processing' ? ' processing' : ''}`}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setIsDraggingMain(true);
                    }}
                    onDragOver={(e) => {
                      onDragOver(e);
                      setIsDraggingMain(true);
                    }}
                    onDragLeave={(e) => {
                      // Ignore leave events fired when moving onto a child element
                      if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingMain(false);
                    }}
                    onDrop={(e) => {
                      setIsDraggingMain(false);
                      onDrop(e);
                    }}
                    onClick={() => {
                      setUploadError('');
                      fileInputRef.current?.click();
                    }}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <div className="main-dropzone-title">
                      {uploadState === 'processing'
                        ? 'Extracting schedule entries…'
                        : isDraggingMain
                        ? 'Drop your PDF here'
                        : 'Drag & drop your UP module PDF here'}
                    </div>
                    <div className="main-dropzone-or">or</div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '11px 24px', fontSize: 14, fontWeight: 600, background: '#0e3868', borderColor: '#0e3868' }}
                    >
                      <Icons.Upload />
                      <span>Select UP module PDF</span>
                    </button>
                    <div className="dropzone-hint">UP_MOD_XLS*.pdf</div>
                  </div>

                  {uploadError && (
                    <div className="alert-error" style={{ marginTop: 12, maxWidth: 480 }}>
                      <Icons.AlertCircle />
                      <span>{uploadError}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="portal-guide-trigger"
                    style={{ marginTop: 12 }}
                    onClick={() => setShowPortalGuide(true)}
                  >
                    Where do I get this file?
                  </button>
                </div>
              )}
            </div>
          </main>
        </div>
      ) : (
        /* Tabular View */
        <div className="table-view-container">
          {parsedData ? (
            <div className="table-summary-bar">
              <div className="summary-left">
                <span className="summary-badge">
                  <Icons.Check /> Parsed
                </span>
                <span>
                  <strong>{records.length}</strong> total records from{' '}
                  <span className="font-mono">{parsedData.originalName}</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn"
                  onClick={() =>
                    downloadFile(
                      parsedData.csvContent,
                      `${parsedData.originalName.replace(/\.[^.]+$/, '')}.csv`,
                      'text/csv'
                    )
                  }
                >
                  <Icons.Download />
                  <span>Download CSV</span>
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    downloadFile(
                      JSON.stringify(parsedData.records, null, 2),
                      `${parsedData.originalName.replace(/\.[^.]+$/, '')}.json`,
                      'application/json'
                    )
                  }
                >
                  <Icons.Download />
                  <span>Download JSON</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="table-summary-bar">
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                No active dataset. Upload a schedule PDF to inspect extracted table rows.
              </span>
              <button
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icons.Upload />
                <span>Upload PDF</span>
              </button>
            </div>
          )}

          <div className="search-control">
            <span className="search-icon">
              <Icons.Search />
            </span>
            <input
              type="text"
              className="table-search-input"
              placeholder="Filter parsed records by module code, venue, group, day, or activity…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Semester</th>
                  <th>Group</th>
                  <th>Language</th>
                  <th>Activity</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Venue</th>
                  <th>Campus</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableRecords.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono" style={{ fontWeight: 600 }}>
                      {r.module}
                    </td>
                    <td className="font-mono">{r.semester}</td>
                    <td className="font-mono">{r.group}</td>
                    <td className="font-mono">{r.language}</td>
                    <td>
                      <span className={`badge-tag badge-${(r.activity || '').toLowerCase()}`}>
                        {r.activity === 'L'
                          ? 'Lecture'
                          : r.activity === 'P'
                          ? 'Practical'
                          : r.activity === 'T'
                          ? 'Tutorial'
                          : r.activity || '–'}
                      </span>
                    </td>
                    <td>{r.day}</td>
                    <td className="font-mono">{r.time}</td>
                    <td>{r.venue}</td>
                    <td>{r.campus}</td>
                  </tr>
                ))}
                {!filteredTableRecords.length && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        textAlign: 'center',
                        padding: 36,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {records.length === 0
                        ? 'No data parsed yet. Upload a schedule PDF to view rows.'
                        : 'No records matching the filter query.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Class Details Inspector Sheet */}
      {selectedEvent && (
        <div
          className="inspector-overlay"
          role="presentation"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="inspector-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspector-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setSelectedEvent(null); }}
            tabIndex={-1}
          >
            <div className="inspector-header">
              <h3 id="inspector-title" className="inspector-title">{selectedEvent.title}</h3>
              <button
                className="inspector-close-btn"
                onClick={() => setSelectedEvent(null)}
                title="Close inspector"
                aria-label="Close"
              >
                <Icons.Close />
              </button>
            </div>
            <div className="inspector-grid">
              <span className="inspector-key">Activity</span>
              <span className="inspector-val">
                {selectedEvent.activityLabel} ({selectedEvent.activityCode || 'L'})
              </span>

              <span className="inspector-key">Time</span>
              <span className="inspector-val mono">
                {selectedEvent.day} · {selectedEvent.fullTime || selectedEvent.time}
              </span>

              <span className="inspector-key">Venue(s)</span>
              <span className="inspector-val">{selectedEvent.venues?.join(', ') || selectedEvent.room}</span>

              <span className="inspector-key">Group / Sem</span>
              <span className="inspector-val mono">
                {selectedEvent.group} (Semester: {selectedEvent.semester})
              </span>

              <span className="inspector-key">Campus</span>
              <span className="inspector-val">{selectedEvent.campus || selectedEvent.raw?.campus || '–'}</span>

              <span className="inspector-key">Language</span>
              <span className="inspector-val mono">
                {selectedEvent.language || selectedEvent.raw?.language || '–'}
              </span>
            </div>
            <div className="inspector-footer">
              <button className="btn btn-sm" onClick={() => setSelectedEvent(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Solver Loading Overlay - shown during initial generation and any preference/semester/module change */}
      {isGenerating && (
        <div
          className="generating-overlay"
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.35)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--bg, #fff)',
              borderRadius: 14,
              padding: '28px 36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
              minWidth: 220,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '3px solid var(--bg-subtle, #e5e7eb)',
                borderTopColor: '#0e3868',
                animation: 'generating-spin 0.7s linear infinite',
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted, #475569)' }}>
              {generatingLabel}
            </span>
          </div>
          <style>{`
            @keyframes generating-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

