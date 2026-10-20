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
import { onSessionChange, signOut } from './lib/auth.js';
import { loadTimetable, saveTimetable } from './lib/timetableStore.js';
import { FriendsModal, useFriendsShare } from './components/FriendsModal.jsx';
import { Icons } from './components/Icons.jsx';
import { EventInspector } from './components/EventInspector.jsx';
import { GeneratingOverlay } from './components/GeneratingOverlay.jsx';
import { useHashRoute } from './lib/useHashRoute.js';
import { GENERATOR_CSS } from './styles/generatorStyles.js';
import { DAYS, PERIODS, MODULE_THEMES, recordsToEvents } from './lib/timetableEvents.js';


function App() {
  const { currentView, navigateTo } = useHashRoute();

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

  // Collapsible sidebar module cards state
  const [expandedModules, setExpandedModules] = useState({});
  // Setup workflow group mixing accordion toggle
  const [showSetupMixOptions, setShowSetupMixOptions] = useState(false);

  const toggleModuleExpanded = (mod, e) => {
    if (e) e.stopPropagation();
    setExpandedModules((prev) => ({ ...prev, [mod]: !prev[mod] }));
  };

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

  // Every enrolled event for the chosen semester and EXACT group allocation per unitKey,
  // ignoring the module focus filter. This is what gets shared with friends, so focusing
  // the grid on one module never shrinks the timetable they see.
  const allEvents = useMemo(() => {
    if (!records.length || !selectedSemester || !enrolledModules.length) return [];

    let subset = records.filter((r) => 
      isMatchingSemester(r.semester, selectedSemester) && 
      enrolledModules.includes(r.module)
    );

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
  }, [records, selectedSemester, enrolledModules, selectedGroups, mixableModules, moduleThemesMap]);

  // Events shown in the grid: the same, narrowed by the module focus filter.
  const events = useMemo(
    () => (selectedModuleFilter === 'ALL' ? allEvents : allEvents.filter((e) => e.title === selectedModuleFilter)),
    [allEvents, selectedModuleFilter]
  );

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
      setSetupMixableModules([]);
      setMixableModules([]);
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

  // Friends: share link, friend list, and the free-together views. Must run before the early
  // returns below. `ready` holds sharing back until the saved timetable has been restored
  // and the solver has finished, so an empty timetable is never published.
  const friendsShare = useFriendsShare({
    userKey,
    events: allEvents,
    semester: selectedSemester,
    ready: persistReady && !isGenerating,
  });

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
      <style>{GENERATOR_CSS}</style>

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
            <button
              className="btn btn-primary"
              onClick={downloadPdf}
              disabled={isExporting}
            >
              <Icons.Download />
              <span>{isExporting ? 'Generating PDF…' : 'Export PDF'}</span>
            </button>
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
                {saveStatus === 'saved' && 'Saved'}
                {saveStatus === 'error' && (
                  <>
                    Couldn't save{' '}
                    <button className="btn btn-sm" onClick={flushSave}>Retry</button>
                  </>
                )}
              </span>
            )}
            <button
              className="btn btn-sm"
              onClick={friendsShare.openModal}
              disabled={records.length === 0}
              title={records.length === 0 ? 'Upload your timetable PDF first' : 'Share your timetable and compare with friends'}
            >
              Friends
            </button>
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
                {/* Timetable Preferences & Semester Controls in Sidebar */}
                <div className="sidebar-controls-section">
                  <div className="sidebar-ctrl-row">
                    <span className="sidebar-ctrl-label">Semester</span>
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
                  </div>

                  <div>
                    <div className="sidebar-ctrl-label" style={{ marginBottom: 6 }}>Optimization Goal</div>
                    <div className="sidebar-pref-group">
                      <button
                        type="button"
                        className={`sidebar-pref-btn ${schedulePreference === 'morning' ? 'active' : ''}`}
                        onClick={() => handleTogglePreference('morning')}
                        disabled={isGenerating}
                        title="Earlier classes first"
                      >
                        <Icons.Sun />
                        <span>Morning</span>
                      </button>
                      <button
                        type="button"
                        className={`sidebar-pref-btn ${schedulePreference === 'afternoon' ? 'active' : ''}`}
                        onClick={() => handleTogglePreference('afternoon')}
                        disabled={isGenerating}
                        title="Later classes first"
                      >
                        <Icons.Sunset />
                        <span>Afternoon</span>
                      </button>
                      <button
                        type="button"
                        className={`sidebar-pref-btn ${schedulePreference === 'free_day' ? 'active' : ''}`}
                        onClick={() => handleTogglePreference('free_day')}
                        disabled={isGenerating}
                        title="Maximize free days"
                      >
                        <Icons.Coffee />
                        <span>Free day</span>
                      </button>
                      <button
                        type="button"
                        className={`sidebar-pref-btn ${schedulePreference === 'early_friday' ? 'active' : ''}`}
                        onClick={() => handleTogglePreference('early_friday')}
                        disabled={isGenerating}
                        title="Finish Friday as early as possible"
                      >
                        <Icons.Zap />
                        <span>Early Fri</span>
                      </button>
                    </div>
                  </div>

                  {/* Schedule Status Banner */}
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
                    {moduleActivityGroups.map((item) => {
                      const isExpanded = !!expandedModules[item.module];
                      const acts = Object.keys(item.activities);
                      const actCount = acts.length;

                      return (
                        <div
                          key={item.module}
                          className={`enrolled-module-card ${selectedModuleFilter === item.module ? 'focused' : ''}`}
                        >
                          <div
                            className="enrolled-module-row"
                            onClick={() => setSelectedModuleFilter(selectedModuleFilter === item.module ? 'ALL' : item.module)}
                            title="Click to focus on this module in the grid"
                          >
                            <div className="module-main-info">
                              <span
                                className="module-swatch"
                                style={{ background: item.theme.border }}
                              />
                              <strong className="module-code-text">{item.module}</strong>
                              <span className="module-act-summary">{actCount} group{actCount === 1 ? '' : 's'}</span>
                            </div>

                            <div className="module-card-actions" onClick={(e) => e.stopPropagation()}>
                              {item.hasMultipleLecturePeriods && (
                                <button
                                  type="button"
                                  className={`mix-toggle-pill ${item.isMixed ? 'active' : ''}`}
                                  onClick={() => handleToggleMixableModule(item.module)}
                                  title={item.isMixed ? 'Lecture groups are mixed across periods. Click to lock to single group.' : 'Click to allow mixing lecture groups across periods'}
                                >
                                  <Icons.Shuffle />
                                  <span>{item.isMixed ? 'Mixed' : 'Mix'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className={`module-expand-btn ${isExpanded ? 'expanded' : ''}`}
                                onClick={(e) => toggleModuleExpanded(item.module, e)}
                                title={isExpanded ? 'Hide groups' : 'Configure groups'}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                              </button>

                              <button
                                className="btn btn-sm"
                                style={{ padding: '2px 5px', fontSize: 10, lineHeight: 1 }}
                                onClick={() => handleToggleModule(item.module)}
                                title="Remove this module from timetable"
                              >
                                <Icons.Close />
                              </button>
                            </div>
                          </div>

                          {/* Collapsible Group Selectors */}
                          {isExpanded && (
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </aside>

          {/* Main Canvas */}
          <main className="main-canvas">
            {records.length > 0 && selectedSemester && (
              <>
                {(selectedModuleFilter !== 'ALL' || totalClashes > 0) && (
                  <div className="canvas-toolbar">
                    <div className="canvas-meta">
                      {selectedModuleFilter !== 'ALL' && (
                        <span className="status-chip">
                          Focus: <strong>{selectedModuleFilter}</strong>
                        </span>
                      )}
                      {totalClashes > 0 && (
                        <span className="clash-summary-chip">
                          <Icons.AlertCircle />
                          <span>{totalClashes} clashing slot{totalClashes === 1 ? '' : 's'}</span>
                        </span>
                      )}
                    </div>

                    {selectedModuleFilter !== 'ALL' && (
                      <button
                        className="btn btn-sm"
                        onClick={() => setSelectedModuleFilter('ALL')}
                      >
                        Reset module focus
                      </button>
                    )}
                  </div>
                )}

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
                        <img src="/studystack-mark.png" alt="StudyStack" width="38" height="38" style={{ objectFit: 'contain' }} />
                      </div>
                      <span className="brand-tag" style={{ background: '#0e3868' }}>Auto Timetable Generator</span>
                      <h2 className="setup-workflow-title">Customize Your Schedule</h2>
                      <p className="setup-workflow-desc">
                        {records.length} schedule entries extracted. Select your modules and optimization goal to generate a conflict-free timetable.
                      </p>
                    </div>

                    {/* Step 1: Semester & Modules */}
                    <div className="setup-step-section">
                      <div className="setup-step-header">
                        <div className="setup-step-title-group">
                          <span className="setup-step-badge">Step 1</span>
                          <span className="setup-step-title">Choose Semester & Enrolled Modules</span>
                        </div>
                        <div className="segmented-group">
                          <button
                            type="button"
                            className={`segmented-btn ${setupSemester === 'S1' ? 'active' : ''}`}
                            onClick={() => {
                              setSetupSemester('S1');
                              const m = records.filter(r => isMatchingSemester(r.semester, 'S1'));
                              const mods = Array.from(new Set(m.map(r => r.module))).sort();
                              setSetupEnrolledModules(mods);
                              setSetupMixableModules([]);
                            }}
                          >
                            Semester 1 ({semesterStats.s1})
                          </button>
                          <button
                            type="button"
                            className={`segmented-btn ${setupSemester === 'S2' ? 'active' : ''}`}
                            onClick={() => {
                              setSetupSemester('S2');
                              const m = records.filter(r => isMatchingSemester(r.semester, 'S2'));
                              const mods = Array.from(new Set(m.map(r => r.module))).sort();
                              setSetupEnrolledModules(mods);
                              setSetupMixableModules([]);
                            }}
                          >
                            Semester 2 ({semesterStats.s2})
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Enrolled Modules ({setupEnrolledModules.length} of {availableModulesForSemester.length} selected):
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setSetupEnrolledModules(availableModulesForSemester)}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setSetupEnrolledModules([])}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="module-checkbox-grid">
                        {availableModulesForSemester.map((mod) => {
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

                    {/* Step 2: Optimization Goal */}
                    <div className="setup-step-section">
                      <div className="setup-step-header">
                        <div className="setup-step-title-group">
                          <span className="setup-step-badge">Step 2</span>
                          <span className="setup-step-title">Optimization Preference</span>
                        </div>
                      </div>
                      <div className="setup-goals-grid">
                        <div
                          className={`setup-goal-card ${setupPreference === 'morning' ? 'active' : ''}`}
                          onClick={() => setSetupPreference('morning')}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="setup-goal-title-row">
                            <Icons.Sun />
                            <span className="setup-goal-title">Morning Schedule</span>
                          </div>
                          <span className="setup-goal-desc">Prioritizes earlier classes so you finish earlier in the afternoon.</span>
                        </div>

                        <div
                          className={`setup-goal-card ${setupPreference === 'afternoon' ? 'active' : ''}`}
                          onClick={() => setSetupPreference('afternoon')}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="setup-goal-title-row">
                            <Icons.Sunset />
                            <span className="setup-goal-title">Afternoon Schedule</span>
                          </div>
                          <span className="setup-goal-desc">Sleep in later and attend afternoon class sessions.</span>
                        </div>

                        <div
                          className={`setup-goal-card ${setupPreference === 'free_day' ? 'active' : ''}`}
                          onClick={() => setSetupPreference('free_day')}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="setup-goal-title-row">
                            <Icons.Coffee />
                            <span className="setup-goal-title">Free Day Maximizer</span>
                          </div>
                          <span className="setup-goal-desc">Packs classes together to create entire days with 0 classes or light days.</span>
                        </div>

                        <div
                          className={`setup-goal-card ${setupPreference === 'early_friday' ? 'active' : ''}`}
                          onClick={() => setSetupPreference('early_friday')}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="setup-goal-title-row">
                            <Icons.Zap />
                            <span className="setup-goal-title">Early Friday Finish</span>
                          </div>
                          <span className="setup-goal-desc">Finishes Friday as early as possible for weekend travel or study.</span>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Group Mixing Flexibility (Optional) */}
                    <div className="setup-mix-accordion">
                      <button
                        type="button"
                        className="setup-mix-trigger"
                        onClick={() => setShowSetupMixOptions(prev => !prev)}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icons.Shuffle />
                            <strong style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
                              Group Mixing Flexibility (Optional)
                            </strong>
                            <span className="badge-tag">
                              {setupMixableModules.filter(m => setupEnrolledModules.includes(m)).length} of {setupEnrolledModules.length} enabled
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            Allow choosing different lecture groups across periods (e.g. L1 from G01, L2 from G02) to resolve clashes.
                          </div>
                        </div>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            transform: showSetupMixOptions ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s ease',
                            color: 'var(--text-muted)'
                          }}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>

                      {showSetupMixOptions && (
                        <div className="setup-mix-content">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              Choose which modules allow group mixing:
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => setSetupMixableModules(setupEnrolledModules)}
                              >
                                Enable All
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => setSetupMixableModules([])}
                              >
                                Disable All
                              </button>
                            </div>
                          </div>

                          <div className="module-checkbox-grid">
                            {setupEnrolledModules.map((mod) => {
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
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center', gridColumn: '1 / -1' }}>
                                Select enrolled modules above first
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Generate CTA Button */}
                    <div style={{ marginTop: 24, textAlign: 'center' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '12px 32px', fontSize: 14, fontWeight: 700, borderRadius: 8, boxShadow: '0 4px 14px rgba(14, 56, 104, 0.25)' }}
                        disabled={setupEnrolledModules.length === 0 || isGenerating}
                        onClick={handleApplySetup}
                      >
                        <Icons.Sparkles />
                        <span>{isGenerating ? 'Generating…' : `Generate Conflict-Free Timetable (${setupEnrolledModules.length} Modules) →`}</span>
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
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0e3868', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    Create Your UP Timetable
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.5 }}>
                    Upload your module schedule PDF from the student portal. StudyStack will automatically resolve all clashes and find your optimal weekly schedule.
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

      <EventInspector event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      <FriendsModal share={friendsShare} />

      <GeneratingOverlay show={isGenerating} label={generatingLabel} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

