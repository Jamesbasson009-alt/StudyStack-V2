import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { createRoot } from 'react-dom/client';
import { generateTimetable, isMatchingSemester } from './lib/timetableGenerator.js';
import { parsePdf } from './lib/pdfParser.js';
import { LandingPage } from './pages/LandingPage.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { EmailConfirmedPage } from './pages/EmailConfirmedPage.jsx';
import { BooksPage } from './pages/BooksPage.jsx';
import { LegalPage } from './pages/LegalPage.jsx';
import { clearAuthLanding, getAuthLanding, getSession, onSessionChange, signOut } from './lib/auth.js';
import { loadTimetable, saveTimetable } from './lib/timetableStore.js';
import { DAYS, PERIODS, MODULE_THEMES, recordsToEvents } from './lib/timetableEvents.js';
import { useHashRoute } from './lib/useHashRoute.js';
import { Icons } from './components/Icons.jsx';
import { EventInspector } from './components/EventInspector.jsx';
import { GeneratingOverlay } from './components/GeneratingOverlay.jsx';
import { PortalGuideModal } from './components/PortalGuideModal.jsx';
import { FriendsModal, useFriendsShare } from './components/FriendsModal.jsx';

function App() {
  const { currentView, navigateTo } = useHashRoute();

  // Auth: the signed-in student (or null), and whether the stored session has finished loading.
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  // Set when this visit came from the link in a confirmation email (see EmailConfirmedPage).
  const [authLanding, setAuthLanding] = useState(() => getAuthLanding());

  useEffect(() => {
    let live = true;
    getSession().then((s) => {
      if (live) {
        setSession(s);
        setAuthReady(true);
      }
    });
    const stop = onSessionChange((s) => {
      setSession(s);
      setAuthReady(true);
    });
    return () => {
      live = false;
      stop();
    };
  }, []);

  const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'table'
  const [uploadState, setUploadState] = useState('idle'); // 'idle' | 'processing' | 'done'
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
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

  const [guideOpen, setGuideOpen] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [hydrated, setHydrated] = useState(false); // saved timetable has been loaded (or there was none)

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

  // Run solver for a specific module list, semester, preference, and mixable list
  const runSolverNow = (targetModules, targetSemester, targetPref, targetMixable) => {
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
    return res;
  };

  // Shows the spinner, then runs the solver on the next tick so the overlay can paint first.
  const runSolver = (targetModules, targetSemester, targetPref, targetMixable, label = 'Updating timetable…') => {
    setBusyLabel(label);
    setTimeout(() => {
      try {
        runSolverNow(targetModules, targetSemester, targetPref, targetMixable);
      } finally {
        setBusyLabel('');
      }
    }, 40);
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
    runSolver(enrolledModules, selectedSemester, newPref, mixableModules);
  };

  const handleSwitchSemester = (newSem) => {
    const matching = records.filter(r => isMatchingSemester(r.semester, newSem));
    const newMods = Array.from(new Set(matching.map(r => r.module))).sort();
    const newMix = mixableModules.filter(m => newMods.includes(m));
    runSolver(newMods, newSem, schedulePreference, newMix);
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
    runSolver(enrolledModules, selectedSemester, schedulePreference, nextMix);
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
    runSolver(nextMods, selectedSemester, schedulePreference, nextMix);
  };

  // Manually override group for an activity or period unitKey
  const handleManualGroupChange = (unitKey, groupCode) => {
    setSelectedGroups(prev => ({
      ...prev,
      [unitKey]: groupCode
    }));
  };

  // Every session for the chosen modules and groups. This is what gets shared with friends,
  // so it ignores the "focus on one module" filter used by the grid.
  const baseEvents = useMemo(() => {
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

  const events = useMemo(
    () => (selectedModuleFilter === 'ALL' ? baseEvents : baseEvents.filter((e) => e.title === selectedModuleFilter)),
    [baseEvents, selectedModuleFilter]
  );

  // Friends: sharing link, friend list, free-time comparison.
  const share = useFriendsShare({
    userKey: session?.email || null,
    events: baseEvents,
    semester: selectedSemester,
    ready: records.length > 0 && Boolean(selectedSemester),
  });

  // Restore the signed-in student's saved timetable.
  useEffect(() => {
    if (!session?.email) {
      setHydrated(false);
      return undefined;
    }
    let live = true;
    (async () => {
      try {
        const saved = await loadTimetable();
        if (!live || !saved?.parsedData?.records?.length) return;
        const s = saved.settings || {};
        setParsedData(saved.parsedData);
        setSelectedFileName(s.fileName || saved.parsedData.originalName || '');
        setUploadState('done');
        initSetup(saved.parsedData.records);
        if (s.semester) {
          setSelectedSemester(s.semester);
          setEnrolledModules(s.enrolledModules || []);
          setMixableModules(s.mixableModules || []);
          setSelectedGroups(s.selectedGroups || {});
          setSchedulePreference(s.preference || 'morning');
          setSetupPreference(s.preference || 'morning');
        }
      } catch (e) {
        console.error('Could not load saved timetable:', e);
      } finally {
        if (live) setHydrated(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [session?.email]);

  // Save changes back (debounced). Waits for the restore above so it never overwrites it with nothing.
  useEffect(() => {
    if (!hydrated || !session?.email || !parsedData?.records?.length) return undefined;
    const t = setTimeout(() => {
      saveTimetable({
        parsedData,
        settings: {
          fileName: selectedFileName,
          semester: selectedSemester,
          preference: schedulePreference,
          enrolledModules,
          mixableModules,
          selectedGroups,
        },
      }).catch((e) => console.error('Could not save timetable:', e));
    }, 1200);
    return () => clearTimeout(t);
  }, [hydrated, session?.email, parsedData, selectedFileName, selectedSemester, schedulePreference, enrolledModules, mixableModules, selectedGroups]);

  const handleSignOut = async () => {
    await signOut();
    setParsedData(null);
    setSelectedSemester(null);
    setEnrolledModules([]);
    setMixableModules([]);
    setSelectedGroups({});
    setGeneratorResult(null);
    setSelectedFileName('');
    setUploadState('idle');
    setHydrated(false);
    navigateTo('landing');
  };

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

  // Picks the dominant semester and pre-selects its modules on the setup screen.
  const initSetup = (recs) => {
    let s1Count = 0, s2Count = 0;
    recs.forEach((r) => {
      const s = (r.semester || '').toUpperCase().trim();
      if (s.startsWith('S1') || s.startsWith('Q1') || s.startsWith('Q2')) s1Count++;
      if (s.startsWith('S2') || s.startsWith('Q3') || s.startsWith('Q4')) s2Count++;
    });
    const detectedSem = s2Count >= s1Count ? 'S2' : 'S1';
    setSetupSemester(detectedSem);
    const detectedMods = Array.from(
      new Set(recs.filter((r) => isMatchingSemester(r.semester, detectedSem)).map((r) => r.module))
    ).sort();
    setSetupEnrolledModules(detectedMods);
    // Mixing lecture groups is opt-in: nothing is selected until the student chooses modules.
    setSetupMixableModules([]);
    setMixableModules([]);
  };

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

      initSetup(data.records);
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
      const el = gridRef.current;
      const fullWidth = el.scrollWidth;
      const fullHeight = el.scrollHeight;
      const canvas = await html2canvas(el, {
        scale: window.innerWidth < 700 ? 1.5 : 2, // keeps phones from running out of canvas memory
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: fullWidth,
        height: fullHeight,
        windowWidth: Math.max(fullWidth, window.innerWidth),
        onclone: (_doc, node) => {
          // On narrow screens the board scrolls sideways; un-clip it so the export has every day.
          node.style.overflow = 'visible';
          node.style.width = `${fullWidth}px`;
        },
      });
      const imgData = canvas.toDataURL('image/png');
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

      pdf.addImage(imgData, 'PNG', x, y, w, h);
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

  // The page the confirmation email links to. It comes first, even if the person is already signed in.
  if (authLanding) {
    const leaveLanding = (view) => {
      clearAuthLanding();
      setAuthLanding(null);
      navigateTo(view);
    };
    return (
      <EmailConfirmedPage
        landing={authLanding}
        onContinue={() => leaveLanding('generator')}
        onSignIn={() => leaveLanding('auth')}
      />
    );
  }

  // Public pages: they don't need to wait for the stored session.
  if (currentView === 'books') {
    return <BooksPage session={session} authChecked={authReady} onNavigate={navigateTo} />;
  }
  if (currentView === 'terms' || currentView === 'privacy') {
    return <LegalPage page={currentView} onNavigate={navigateTo} />;
  }

  // Wait for the stored session to load so a signed-in person never sees a flash of the sign-in form.
  if (!authReady && currentView !== 'landing') return null;

  // The generator needs an account; anyone who isn't signed in is sent to sign in first.
  if (!session && (currentView === 'auth' || currentView === 'generator')) {
    return (
      <AuthPage
        onAuthenticated={(s) => {
          setSession(s);
          navigateTo('generator');
        }}
        onBack={() => navigateTo('landing')}
        onNavigate={navigateTo}
      />
    );
  }

  if (currentView === 'landing') {
    return (
      <LandingPage
        onLaunchGenerator={() => navigateTo(session ? 'generator' : 'auth')}
        onNavigate={navigateTo}
      />
    );
  }

  return (
    <div className="app-shell">
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
          min-height: 100dvh;
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
          min-height: calc(100dvh - 58px);
        }

        .sidebar-rail {
          background: var(--bg-surface);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          max-height: calc(100vh - 58px);
          max-height: calc(100dvh - 58px);
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
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
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

        /* Keep the time column and header in view while the days scroll sideways. */
        .time-col-cell, .timetable-grid > .grid-header-cell:first-child {
          position: sticky;
          left: 0;
          z-index: 3;
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
          .workspace-grid {
            grid-template-columns: 1fr;
            min-height: 0;
          }
          .sidebar-rail {
            border-right: none;
            border-bottom: 1px solid var(--border-color);
            max-height: none;
            overflow-y: visible;
          }
          /* Once a timetable exists, show it first and the module controls underneath. */
          .workspace-grid.has-timetable .main-canvas { order: -1; }
          .workspace-grid.has-timetable .sidebar-rail {
            border-bottom: none;
            border-top: 1px solid var(--border-color);
          }
          .setup-steps-grid {
            grid-template-columns: 1fr;
          }

          /* Header: brand, then tabs, then actions, each row scrolling sideways if it must. */
          .header-bar {
            height: auto;
            min-height: 52px;
            flex-wrap: wrap;
            gap: 6px 8px;
            padding: 8px 12px;
            position: static;
          }
          .header-tabs, .header-actions {
            flex: 1 1 100%;
            overflow-x: auto;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          .header-tabs::-webkit-scrollbar, .header-actions::-webkit-scrollbar { display: none; }
          .header-tabs > *, .header-actions > * { flex-shrink: 0; }
          .tab-item { min-height: 40px; white-space: nowrap; }
          .segmented-btn { min-height: 34px; white-space: nowrap; }
          .btn { min-height: 38px; }

          .canvas-toolbar { padding: 10px 12px; }
          .timetable-container { padding: 12px; }
          .table-view-container { padding: 12px; }
          .data-table-wrap { max-height: none; }
          .setup-workflow-card { padding: 20px 16px; margin: 12px; }

          /* 16px stops iOS Safari zooming the page when a field gets focus. */
          .table-search-input, .group-select { font-size: 16px; }
        }

        @media (max-width: 640px) {
          .timetable-grid { grid-template-columns: 52px repeat(5, minmax(132px, 1fr)); }
          .time-col-cell { padding: 10px 4px; font-size: 11px; }
          .setup-options-grid-2 { grid-template-columns: 1fr; }

          /* Class details open as a bottom sheet instead of a floating card. */
          .inspector-overlay { align-items: flex-end; padding: 0; }
          .inspector-panel {
            width: 100%;
            max-height: 85vh;
            max-height: 85dvh;
            overflow-y: auto;
            border-radius: 14px 14px 0 0;
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          .inspector-close-btn { padding: 10px; }
          .inspector-grid { grid-template-columns: 96px 1fr; }
        }

        .account-chip {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary);
          padding: 0 4px;
          white-space: nowrap;
        }
        .guide-link {
          background: none;
          border: none;
          padding: 0;
          margin-top: 8px;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          color: #2563eb;
          cursor: pointer;
        }
        .guide-link:hover { text-decoration: underline; }
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
              <span className="brand-tag" style={{ background: '#0e3868' }}>UP</span>
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
                >
                  <Icons.Sun />
                  <span>Morning</span>
                </button>
                <button
                  className={`segmented-btn ${schedulePreference === 'afternoon' ? 'active' : ''}`}
                  onClick={() => handleTogglePreference('afternoon')}
                  title="Later classes first"
                >
                  <Icons.Sunset />
                  <span>Afternoon</span>
                </button>
                <button
                  className={`segmented-btn ${schedulePreference === 'free_day' ? 'active' : ''}`}
                  onClick={() => handleTogglePreference('free_day')}
                  title="Maximize days with 0 classes or lightest day"
                >
                  <Icons.Coffee />
                  <span>Free day</span>
                </button>
                <button
                  className={`segmented-btn ${schedulePreference === 'early_friday' ? 'active' : ''}`}
                  onClick={() => handleTogglePreference('early_friday')}
                  title="Finish Friday as early as possible"
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
                >
                  S1
                </button>
                <button
                  className={`segmented-btn ${selectedSemester === 'S2' ? 'active' : ''}`}
                  onClick={() => handleSwitchSemester('S2')}
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

          <button className="btn" onClick={share.openModal} title="Share your timetable and find free time with friends">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Friends</span>
            {share.friends.length > 0 && <span className="badge-tag">{share.friends.length}</span>}
          </button>

          {session ? (
            <>
              <span className="account-chip" title={session.email}>u{session.studentNumber}</span>
              <button className="btn" onClick={handleSignOut}>Sign out</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => navigateTo('auth')}>Sign in</button>
          )}
        </div>
      </header>

      {activeTab === 'grid' ? (
        <div className={`workspace-grid${records.length > 0 && selectedSemester ? ' has-timetable' : ''}`}>
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
              <button type="button" className="guide-link" onClick={() => setGuideOpen(true)}>
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
                              setSetupMixableModules([]);
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
                              setSetupMixableModules([]);
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
                        disabled={setupEnrolledModules.length === 0}
                        onClick={handleApplySetup}
                      >
                        <Icons.Sparkles />
                        <span>Generate conflict-free timetable ({setupEnrolledModules.length} modules)</span>
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
                  <button
                    className="btn btn-primary"
                    style={{ padding: '11px 24px', fontSize: 14, fontWeight: 600, background: '#0e3868', borderColor: '#0e3868' }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icons.Upload />
                    <span>Select UP module PDF</span>
                  </button>
                  <button type="button" className="guide-link" onClick={() => setGuideOpen(true)}>
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
      <FriendsModal share={share} />
      <PortalGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <GeneratingOverlay show={Boolean(busyLabel)} label={busyLabel} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

