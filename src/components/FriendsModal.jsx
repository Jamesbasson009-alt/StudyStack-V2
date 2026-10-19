// src/components/FriendsModal.jsx
// Overhauled "Share with friends" experience:
// 1. Two-tab layout: "Friends & Sharing" and "Free Together"
// 2. Streamlined setup: asks for name once, one-click toggle, prominent share link card
// 3. Friend cards with avatar initials, comparison toggle, status, and clean remove
// 4. Free Together: Defaults to Best Times, interactive Week Grid, and Same Class overlaps
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addFriendByCode,
  extractCode,
  loadFriends,
  loadMyShare,
  removeFriendByCode,
  rotateMyShare,
  setShareEnabled,
  shareUrl,
  upsertMyShare,
} from '../lib/shareStore.js';
import {
  DAY_END,
  DAY_START,
  FULL_DAY_NAMES,
  WEEKDAYS,
  availabilityGrid,
  bestWindows,
  describeWindow,
  fmtDuration,
  fmtTime,
  moduleOverlap,
  parseSlot,
  sharedClasses,
  toBusyEvents,
  windowsText,
} from '../lib/freeTime.js';

const PENDING_KEY = 'studystack_pending_friend';
const NAME_KEY = 'studystack_share_name';

function friendlyError(e) {
  const msg = String(e?.message || e || '');
  if (msg.includes('No shared timetable found')) {
    return "No timetable matches that link or code. Check it, or ask your friend to turn sharing on.";
  }
  if (msg.includes('your own link')) return "That's your own link! Send it to a friend instead.";
  if (e?.code === 'PGRST202' || e?.code === '42P01' || /does not exist|schema cache/i.test(msg)) {
    return "Sharing isn't set up on the database yet. Run supabase-share-friends.sql in Supabase.";
  }
  return msg || 'Something went wrong. Please try again.';
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
}

function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

// Generate a deterministic soft avatar color from a string
function getAvatarColor(name = '') {
  const colors = [
    { bg: '#e0f2fe', text: '#0369a1' }, // sky
    { bg: '#dcfce7', text: '#15803d' }, // green
    { bg: '#fef3c7', text: '#b45309' }, // amber
    { bg: '#f3e8ff', text: '#7e22ce' }, // purple
    { bg: '#ffe4e6', text: '#be123c' }, // rose
    { bg: '#e0e7ff', text: '#4338ca' }, // indigo
    { bg: '#ccfbf1', text: '#0f766e' }, // teal
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/* ------------------------------------------------------------------ */
/* State + syncing hook                                               */
/* ------------------------------------------------------------------ */
export function useFriendsShare({ userKey, events, semester, ready }) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(null); // { code, name, semester, enabled } | null
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState([]); // friend codes included in comparison
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const myBusy = useMemo(() => toBusyEvents(events), [events]);
  const mineRef = useRef(null);
  mineRef.current = mine;
  const lastSyncRef = useRef('');

  // Handle ?friend=CODE in URL query
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('friend');
      if (code) {
        localStorage.setItem(PENDING_KEY, code);
        url.searchParams.delete('friend');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    } catch { /* ignore */ }
  }, []);

  const addFriend = useCallback(async (input) => {
    const code = extractCode(input);
    if (!code) {
      setError("That doesn't look like a valid StudyStack friend link or code.");
      return false;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const f = await addFriendByCode(code);
      setFriends((prev) => [...prev.filter((x) => x.code !== f.code), f]);
      setSelected((prev) => (prev.includes(f.code) ? prev : [...prev, f.code]));
      setNotice(
        mineRef.current?.enabled
          ? `Added ${f.name} to your friends!`
          : `Added ${f.name}! Turn on sharing below so they can also see when you're free.`
      );
      return true;
    } catch (e) {
      setError(friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  // Load user share + friends on login
  useEffect(() => {
    if (!userKey) {
      setMine(null);
      setFriends([]);
      setSelected([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [m, f] = await Promise.all([loadMyShare(), loadFriends()]);
        if (cancelled) return;
        setMine(m);
        setFriends(f);
        setSelected(f.map((x) => x.code));
      } catch (e) {
        if (!cancelled) console.error('Could not load sharing data:', e);
      }
      let pending = null;
      try { pending = localStorage.getItem(PENDING_KEY); } catch { /* ignore */ }
      if (pending && !cancelled) {
        try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
        await addFriend(pending);
        if (!cancelled) setOpen(true);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userKey, addFriend]);

  // Keep shared timetable synced
  useEffect(() => {
    if (!mine?.enabled || !ready || !semester || myBusy.length === 0) return undefined;
    const payload = JSON.stringify([semester, mine.name, myBusy]);
    if (payload === lastSyncRef.current) return undefined;
    const t = setTimeout(async () => {
      try {
        await upsertMyShare(mineRef.current, { name: mine.name, semester, events: myBusy, enabled: true });
        lastSyncRef.current = payload;
      } catch (e) {
        console.error('Could not update shared timetable:', e);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [mine, ready, semester, myBusy]);

  const refresh = useCallback(async () => {
    try {
      setFriends(await loadFriends());
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useEffect(() => {
    if (open && userKey) refresh();
  }, [open, userKey, refresh]);

  const enableSharing = async (name) => {
    const clean = String(name || '').trim().slice(0, 30);
    if (!clean) {
      setError('Please enter your name so friends know who you are.');
      return;
    }
    if (myBusy.length === 0 || !semester) {
      setError('Upload & generate your timetable first before sharing.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const row = await upsertMyShare(mineRef.current, { name: clean, semester, events: myBusy, enabled: true });
      try { localStorage.setItem(NAME_KEY, clean); } catch { /* ignore */ }
      lastSyncRef.current = JSON.stringify([semester, clean, myBusy]);
      setMine(row);
      setNotice('Sharing link created! Copy and send it to your friends.');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const setSharing = async (enabled) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await setShareEnabled(enabled);
      lastSyncRef.current = '';
      setMine((m) => (m ? { ...m, enabled } : m));
      setNotice(enabled ? 'Sharing resumed. Friends can now see your timetable.' : 'Sharing paused. Friends cannot view your schedule.');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const rotateLink = async () => {
    if (!mineRef.current?.code) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const row = await rotateMyShare(mineRef.current);
      setMine(row);
      setNotice('New link generated! Your previous link has been deactivated.');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const removeFriend = async (code) => {
    setError('');
    try {
      await removeFriendByCode(code);
      setFriends((prev) => prev.filter((f) => f.code !== code));
      setSelected((prev) => prev.filter((c) => c !== code));
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const toggleSelected = (code) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  return {
    open,
    openModal: () => { setError(''); setNotice(''); setOpen(true); },
    closeModal: () => setOpen(false),
    mine, friends, selected, loading, busy, error, notice,
    myBusy, semester,
    hasTimetable: myBusy.length > 0 && !!semester,
    enableSharing,
    stopSharing: () => setSharing(false),
    resumeSharing: () => setSharing(true),
    rotateLink,
    addFriend, removeFriend, toggleSelected, refresh,
  };
}

/* ------------------------------------------------------------------ */
/* UI Helper Components                                               */
/* ------------------------------------------------------------------ */
const MIN_OPTIONS = [
  { label: '30m', value: 30 },
  { label: '1 hr', value: 60 },
  { label: '2 hr', value: 120 },
];

const VIEWS = [
  { id: 'best', label: 'Best Times', icon: '⚡' },
  { id: 'heat', label: 'Week Grid', icon: '📅' },
  { id: 'class', label: 'Same Classes', icon: '🎓' },
];

const PX_PER_MIN = 0.8;
const GRID_H = Math.round((DAY_END - DAY_START) * PX_PER_MIN);
const SHOW_FIRST = 10;
const lower = (t) => (t ? String(t).toLowerCase() : '');

function joinNames(list) {
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

function slotLabel(slot) {
  const { d, s, e } = parseSlot(slot);
  return `${d} ${fmtTime(s)}–${fmtTime(e)}`;
}

function busyText(busy) {
  return busy
    .map((b) => `${b.who} (${b.module}${b.activity ? ` ${lower(b.activity)}` : ''})`)
    .join(', ');
}

function uniqueNames(names) {
  const seen = new Map();
  return names.map((n) => {
    const count = (seen.get(n) || 0) + 1;
    seen.set(n, count);
    return count === 1 ? n : `${n} (${count})`;
  });
}

/* ------------------------------------------------------------------ */
/* Views for Free Together Tab                                        */
/* ------------------------------------------------------------------ */
function BestTimesView({ windows, total, showAll, onShowAll }) {
  if (windows.length === 0) {
    return (
      <div className="fs-empty-state">
        <div className="fs-empty-icon">⏳</div>
        <div className="fs-empty-title">No matching free times</div>
        <p className="fs-empty-desc">
          Try selecting a shorter minimum duration or comparing fewer friends at once.
        </p>
      </div>
    );
  }

  const list = showAll ? windows : windows.slice(0, SHOW_FIRST);

  return (
    <div className="fs-windows-list">
      {list.map((w, idx) => {
        const isFull = w.free === total;
        return (
          <div key={`${w.day}-${w.start}-${idx}`} className={`fs-window-card ${isFull ? 'perfect-match' : ''}`}>
            <div className="fs-window-badge">
              <span className="fs-window-day">{w.day}</span>
              <span className="fs-window-dur">{fmtDuration(w.minutes)}</span>
            </div>
            <div className="fs-window-main">
              <div className="fs-window-time">
                {w.wholeDay ? 'All Day Free' : `${fmtTime(w.start)} – ${fmtTime(w.end)}`}
              </div>
              <div className="fs-window-sub">
                {isFull ? (
                  <span className="fs-tag fs-tag-success">✓ Everyone free</span>
                ) : (
                  <span className="fs-tag fs-tag-muted">{w.free} of {total} free</span>
                )}
                <span className="fs-window-reason">
                  {isFull ? describeWindow(w) : `Busy: ${busyText(w.busy)}`}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {!showAll && windows.length > SHOW_FIRST && (
        <button className="fs-btn-show-more" onClick={onShowAll}>
          Show all {windows.length} free slots
        </button>
      )}
    </div>
  );
}

function WeekGridView({ grid, shared, picked, onPick }) {
  const hours = [];
  for (let t = DAY_START; t < DAY_END; t += 60) hours.push(t);
  const top = (m) => (m - DAY_START) * PX_PER_MIN;

  const pickedSeg = picked ? grid.days[picked.day]?.segments.find((sg) => sg.start === picked.start) : null;

  return (
    <div className="fs-grid-wrapper">
      <div className="fs-heat">
        <div className="fs-heat-axis" style={{ height: GRID_H }} aria-hidden="true">
          {hours.map((t) => (
            <span key={t} style={{ top: top(t) }}>{fmtTime(t)}</span>
          ))}
        </div>
        {WEEKDAYS.map((day) => (
          <div key={day} className="fs-heat-col">
            <div className="fs-heat-dayname">{day}</div>
            <div className="fs-heat-track" style={{ height: GRID_H }}>
              {grid.days[day]?.segments.map((seg) => {
                const f = seg.free / grid.total;
                const isPicked = picked && picked.day === day && picked.start === seg.start;
                return (
                  <button
                    key={seg.start}
                    type="button"
                    className={`fs-seg ${f >= 0.55 ? 'dark' : ''} ${isPicked ? 'picked' : ''}`}
                    style={{
                      top: top(seg.start),
                      height: (seg.end - seg.start) * PX_PER_MIN,
                      '--pct': `${Math.round((0.08 + 0.92 * f) * 100)}%`,
                    }}
                    onClick={() => onPick({ day, start: seg.start, end: seg.end })}
                    aria-label={`${FULL_DAY_NAMES[day]} ${fmtTime(seg.start)} to ${fmtTime(seg.end)}: ${seg.free} of ${grid.total} free`}
                  >
                    {f === 1 && seg.end - seg.start >= 45 ? 'All free' : ''}
                  </button>
                );
              })}
              {shared
                .filter((c) => c.d === day)
                .map((c) => (
                  <div
                    key={`${c.s}-${c.m}-${c.g}`}
                    className="fs-heat-class"
                    style={{ top: top(c.s), height: Math.max(18, (c.e - c.s) * PX_PER_MIN) }}
                    title={`${joinNames(c.who)}: ${c.m}${c.a ? ` ${lower(c.a)}` : ''}`}
                  >
                    {c.m}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="fs-legend" aria-hidden="true">
        <div className="fs-legend-item">
          <span className="fs-legend-bar" />
          <span>Gradient: busy to all free</span>
        </div>
        <div className="fs-legend-item">
          <span className="fs-legend-class-badge">ABC 123</span>
          <span>Shared class session</span>
        </div>
      </div>

      <div className="fs-inspector-box" aria-live="polite">
        {pickedSeg ? (
          <div>
            <div className="fs-inspector-head">
              <strong>{FULL_DAY_NAMES[picked.day]}</strong> {fmtTime(pickedSeg.start)} – {fmtTime(pickedSeg.end)}
            </div>
            <div className="fs-inspector-desc">
              {pickedSeg.free === grid.total ? (
                <span className="fs-tag fs-tag-success">✓ Everyone is free to meet!</span>
              ) : (
                <>
                  <span className="fs-tag fs-tag-muted">{pickedSeg.free} of {grid.total} free</span>
                  <span style={{ marginLeft: 6 }}>
                    Free: {pickedSeg.freeNames.length ? joinNames(pickedSeg.freeNames) : 'Nobody'}. Busy: {busyText(pickedSeg.busy)}.
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <span className="fs-inspector-hint">💡 Tap any block in the schedule to see who is free and who is in class.</span>
        )}
      </div>
    </div>
  );
}

function SameClassView({ shared, overlap }) {
  const apart = overlap.filter((o) => !o.together);

  if (shared.length === 0 && apart.length === 0) {
    return (
      <div className="fs-empty-state">
        <div className="fs-empty-icon">📚</div>
        <div className="fs-empty-title">No shared modules found</div>
        <p className="fs-empty-desc">
          When you and your selected friends are enrolled in the same modules, your overlapping lectures and practicals will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="fs-classes-container">
      {shared.length > 0 && (
        <div className="fs-class-section">
          <div className="fs-class-section-title">
            <span className="fs-indicator-dot success" /> In class together ({shared.length} sessions)
          </div>
          <div className="fs-class-cards">
            {shared.map((c, i) => (
              <div key={`${c.d}-${c.s}-${c.m}-${i}`} className="fs-class-card">
                <div className="fs-class-header">
                  <span className="fs-class-mod">{c.m}</span>
                  <span className="fs-class-badge">{c.a || 'Lecture'}</span>
                </div>
                <div className="fs-class-time">
                  {FULL_DAY_NAMES[c.d]} {fmtTime(c.s)} – {fmtTime(c.e)}
                </div>
                <div className="fs-class-who">
                  Attending together: <strong>{joinNames(c.who)}</strong> {c.g ? `(${c.g})` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {apart.length > 0 && (
        <div className="fs-class-section" style={{ marginTop: 20 }}>
          <div className="fs-class-section-title">
            <span className="fs-indicator-dot alert" /> Same module, different groups
          </div>
          <p className="fs-sub-help">
            You take these modules together but attend at different times. Switch into the same group to attend together!
          </p>
          <div className="fs-class-cards">
            {apart.map((o) => (
              <div key={`${o.m}-${o.a}`} className="fs-class-card group-swap">
                <div className="fs-class-header">
                  <span className="fs-class-mod">{o.m}</span>
                  <span className="fs-class-badge">{o.a || 'Lecture'}</span>
                </div>
                <div className="fs-clusters-list">
                  {o.clusters.map((c, idx) => (
                    <div key={idx} className="fs-cluster-item">
                      <span className="fs-cluster-who">{joinNames(c.who)}</span>
                      <span className="fs-cluster-group">{c.g || 'Default'}</span>
                      <span className="fs-cluster-slots">({c.slots.map(slotLabel).join(', ')})</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Modal Component                                               */
/* ------------------------------------------------------------------ */
export function FriendsModal({ share }) {
  const {
    open, closeModal, mine, friends, selected, loading, busy, error, notice,
    myBusy, semester, hasTimetable,
    enableSharing, stopSharing, resumeSharing, rotateLink, addFriend, removeFriend, toggleSelected,
  } = share;

  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'compare'
  const [nameInput, setNameInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [minMinutes, setMinMinutes] = useState(60);
  const [compareView, setCompareView] = useState('best'); // 'best' | 'heat' | 'class'
  const [needFree, setNeedFree] = useState(null);
  const [picked, setPicked] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    if (mine?.name) {
      setNameInput(mine.name);
    } else {
      try { setNameInput(localStorage.getItem(NAME_KEY) || ''); } catch { /* ignore */ }
    }
  }, [mine?.name]);

  // Esc key close listener
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeModal]);

  const link = mine?.code ? shareUrl(mine.code) : '';

  // Comparable friends
  const comparable = (f) => f.enabled && f.semester === semester;
  const chosen = friends.filter((f) => selected.includes(f.code) && comparable(f));

  const people = useMemo(() => {
    if (!hasTimetable || chosen.length === 0) return null;
    const names = uniqueNames(['You', ...chosen.map((f) => f.name)]);
    return [
      { name: names[0], events: myBusy },
      ...chosen.map((f, i) => ({ name: names[i + 1], events: f.events || [] })),
    ];
  }, [hasTimetable, myBusy, chosen]);

  const total = people ? people.length : 0;
  const need = Math.min(needFree ?? total, total);

  const grid = useMemo(() => (people ? availabilityGrid(people) : null), [people]);
  const shared = useMemo(() => (people ? sharedClasses(people) : []), [people]);
  const overlap = useMemo(() => (people ? moduleOverlap(people) : []), [people]);
  const windows = useMemo(() => (grid ? bestWindows(grid, need, minMinutes) : []), [grid, need, minMinutes]);
  const everyoneWindows = useMemo(() => (grid ? bestWindows(grid, total, minMinutes) : []), [grid, total, minMinutes]);

  const everyoneMinutes = everyoneWindows.reduce((sum, w) => sum + w.minutes, 0);

  useEffect(() => { setPicked(null); }, [people]);
  useEffect(() => { setShowAll(false); }, [need, minMinutes, people]);

  const flashCopied = (what) => {
    setCopied(what);
    setTimeout(() => setCopied(''), 1800);
  };

  const onCopyLink = async () => {
    if (await copyText(link)) flashCopied('link');
  };

  const onCopyCode = async () => {
    if (mine?.code && (await copyText(mine.code))) flashCopied('code');
  };

  const onCopyList = async () => {
    if (!people) return;
    const text = windowsText({ names: people.map((p) => p.name), semester, windows });
    if (await copyText(text)) flashCopied('list');
  };

  const onNativeShare = async () => {
    try {
      await navigator.share({
        title: 'My StudyStack Timetable',
        text: `Add my timetable on StudyStack so we can see when we're both free (${semester}):`,
        url: link,
      });
    } catch { /* cancelled */ }
  };

  const onAdd = async (e) => {
    if (e) e.preventDefault();
    if (!linkInput.trim()) return;
    if (await addFriend(linkInput)) setLinkInput('');
  };

  if (!open) return null;

  return (
    <div
      className="fs-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <style>{FS_CSS}</style>
      <div className="fs-modal-card" role="dialog" aria-modal="true" aria-labelledby="fs-modal-title">
        {/* Modal Header */}
        <div className="fs-modal-header">
          <div className="fs-modal-title-group">
            <div className="fs-modal-icon">👥</div>
            <div>
              <h2 id="fs-modal-title" className="fs-modal-title">Friends & Schedule Sharing</h2>
              <p className="fs-modal-subtitle">Share your timetable, compare free time, and sit together in classes.</p>
            </div>
          </div>
          <button className="fs-btn-close" onClick={closeModal} aria-label="Close modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Global Notifications / Errors */}
        {error && (
          <div className="fs-banner fs-banner-error" role="alert">
            <span>⚠️ {error}</span>
          </div>
        )}
        {notice && (
          <div className="fs-banner fs-banner-success" role="status">
            <span>✓ {notice}</span>
          </div>
        )}

        {/* Primary Tab Navigation */}
        <div className="fs-nav-tabs">
          <button
            type="button"
            className={`fs-nav-tab ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            <span>Friends & Sharing</span>
            {friends.length > 0 && <span className="fs-tab-count">{friends.length}</span>}
          </button>
          <button
            type="button"
            className={`fs-nav-tab ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
          >
            <span>Free Together</span>
            {chosen.length > 0 && <span className="fs-tab-count highlight">{chosen.length}</span>}
          </button>
        </div>

        {/* Body Content */}
        <div className="fs-modal-body">
          {activeTab === 'friends' ? (
            <div className="fs-tab-content">
              {/* SECTION 1: Your Sharing Card */}
              <div className="fs-card fs-sharing-card">
                <div className="fs-card-header">
                  <div className="fs-card-title-row">
                    <span className="fs-card-title">Your Share Link</span>
                    {mine && (
                      <span className={`fs-status-pill ${mine.enabled ? 'active' : 'paused'}`}>
                        <span className="fs-dot" />
                        {mine.enabled ? 'Sharing Active' : 'Sharing Paused'}
                      </span>
                    )}
                  </div>
                  <p className="fs-card-desc">
                    Friends who open your link can see your class times and module codes to find mutual free time. They cannot alter your timetable.
                  </p>
                </div>

                {!mine ? (
                  // State 1: Never created a link yet -> asks once for name
                  <div className="fs-create-box">
                    <label className="fs-field-label">What name should your friends see?</label>
                    <div className="fs-create-row">
                      <input
                        className="fs-input"
                        placeholder="e.g. Alex, James, Sarah"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        maxLength={30}
                        autoFocus
                      />
                      <button
                        className="fs-btn fs-btn-primary"
                        onClick={() => enableSharing(nameInput)}
                        disabled={busy || !hasTimetable || !nameInput.trim()}
                      >
                        {busy ? 'Creating...' : 'Create My Link'}
                      </button>
                    </div>
                    {!hasTimetable && (
                      <span className="fs-helper-warning">
                        ⚠️ Please upload and generate your timetable first to create a share link.
                      </span>
                    )}
                  </div>
                ) : (
                  // State 2: Link exists
                  <div className="fs-link-box">
                    {mine.enabled ? (
                      <>
                        <div className="fs-link-display-row">
                          <div className="fs-link-pill" title={link}>
                            <span className="fs-link-label">CODE:</span>
                            <strong className="fs-link-code">{mine.code}</strong>
                            <span className="fs-link-url">{link}</span>
                          </div>
                          <button
                            type="button"
                            className="fs-btn fs-btn-primary"
                            onClick={onCopyLink}
                          >
                            {copied === 'link' ? '✓ Copied!' : 'Copy Link'}
                          </button>
                          {typeof navigator !== 'undefined' && navigator.share && (
                            <button type="button" className="fs-btn fs-btn-subtle" onClick={onNativeShare}>
                              Share…
                            </button>
                          )}
                        </div>

                        <div className="fs-link-meta-row">
                          <div className="fs-meta-left">
                            {isEditingName ? (
                              <div className="fs-inline-edit">
                                <input
                                  className="fs-input-sm"
                                  value={nameInput}
                                  onChange={(e) => setNameInput(e.target.value)}
                                  maxLength={30}
                                />
                                <button
                                  className="fs-btn-sm fs-btn-primary"
                                  onClick={async () => {
                                    await enableSharing(nameInput);
                                    setIsEditingName(false);
                                  }}
                                  disabled={busy}
                                >
                                  Save
                                </button>
                                <button className="fs-btn-sm" onClick={() => setIsEditingName(false)}>Cancel</button>
                              </div>
                            ) : (
                              <span className="fs-share-as">
                                Showing as <strong>“{mine.name}”</strong> ({mine.semester || semester})
                                <button className="fs-text-btn" onClick={() => setIsEditingName(true)}>Change name</button>
                              </span>
                            )}
                          </div>

                          <div className="fs-meta-actions">
                            <button
                              type="button"
                              className="fs-text-btn text-muted"
                              onClick={stopSharing}
                              disabled={busy}
                            >
                              Pause sharing
                            </button>
                            <span className="fs-divider">•</span>
                            <button
                              type="button"
                              className="fs-text-btn text-danger"
                              onClick={() => {
                                if (window.confirm('Create a new link? Your current link will stop working for everyone.')) {
                                  rotateLink();
                                }
                              }}
                              disabled={busy}
                            >
                              New link
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="fs-paused-state">
                        <div className="fs-paused-text">
                          <strong>Sharing is currently paused.</strong> Friends cannot see your timetable.
                        </div>
                        <button
                          type="button"
                          className="fs-btn fs-btn-primary"
                          onClick={resumeSharing}
                          disabled={busy}
                        >
                          Resume Sharing
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: Add Friend Form */}
              <div className="fs-card fs-add-card">
                <div className="fs-card-title">Add a Friend</div>
                <p className="fs-card-desc">Paste a link or 8-letter code sent to you by a friend.</p>
                <form className="fs-add-row" onSubmit={onAdd}>
                  <input
                    className="fs-input"
                    placeholder="e.g. studystack.me/?friend=ABCDEFGH or code ABCDEFGH"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="fs-btn fs-btn-primary"
                    disabled={busy || !linkInput.trim()}
                  >
                    {busy ? 'Adding...' : '+ Add Friend'}
                  </button>
                </form>
              </div>

              {/* SECTION 3: Friends List */}
              <div className="fs-friends-section">
                <div className="fs-section-header">
                  <div className="fs-section-title">
                    Your Friends ({friends.length})
                  </div>
                  {friends.length > 0 && (
                    <span className="fs-section-tip">Check friends to include them in the Free Together comparison</span>
                  )}
                </div>

                {loading && friends.length === 0 && (
                  <div className="fs-loading-placeholder">Loading your friends…</div>
                )}

                {!loading && friends.length === 0 && (
                  <div className="fs-empty-friends">
                    <div className="fs-empty-icon">🤝</div>
                    <div className="fs-empty-title">No friends added yet</div>
                    <p className="fs-empty-desc">
                      Send your share link above to your classmates, or ask for their code to start comparing schedules!
                    </p>
                  </div>
                )}

                {friends.length > 0 && (
                  <div className="fs-friends-grid">
                    {friends.map((f) => {
                      const ok = comparable(f);
                      const isSelected = selected.includes(f.code) && ok;
                      const avatar = getAvatarColor(f.name);
                      const statusNote = !f.enabled
                        ? 'Paused sharing'
                        : f.semester !== semester
                        ? `Different semester (${f.semester || 'none'})`
                        : `Updated ${timeAgo(f.updatedAt)}`;

                      return (
                        <div key={f.code} className={`fs-friend-card ${isSelected ? 'selected' : ''} ${!ok ? 'disabled' : ''}`}>
                          <div className="fs-friend-avatar" style={{ backgroundColor: avatar.bg, color: avatar.text }}>
                            {f.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="fs-friend-info">
                            <div className="fs-friend-name">{f.name}</div>
                            <div className="fs-friend-status">{statusNote}</div>
                          </div>

                          <div className="fs-friend-controls">
                            <label className="fs-checkbox-toggle" title={ok ? 'Include in Free Together view' : 'Cannot compare: different semester or paused'}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!ok}
                                onChange={() => toggleSelected(f.code)}
                              />
                              <span className="fs-toggle-slider" />
                            </label>
                            <button
                              type="button"
                              className="fs-btn-remove"
                              onClick={() => removeFriend(f.code)}
                              title={`Remove ${f.name}`}
                              aria-label={`Remove ${f.name}`}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB 2: Free Together (Comparison) */
            <div className="fs-tab-content">
              {!hasTimetable ? (
                <div className="fs-empty-state">
                  <div className="fs-empty-icon">📅</div>
                  <div className="fs-empty-title">No Timetable Generated</div>
                  <p className="fs-empty-desc">Upload your UP schedule PDF and generate a timetable to compare with friends.</p>
                </div>
              ) : friends.length === 0 ? (
                <div className="fs-empty-state">
                  <div className="fs-empty-icon">👥</div>
                  <div className="fs-empty-title">Add Friends First</div>
                  <p className="fs-empty-desc">Switch to the "Friends & Sharing" tab to add friends by their share code or link.</p>
                  <button className="fs-btn fs-btn-primary" onClick={() => setActiveTab('friends')}>
                    Go to Friends tab
                  </button>
                </div>
              ) : chosen.length === 0 ? (
                <div className="fs-empty-state">
                  <div className="fs-empty-icon">🔍</div>
                  <div className="fs-empty-title">No Friends Selected</div>
                  <p className="fs-empty-desc">
                    Toggle at least one friend with active sharing on the same semester ({semester || 'active'}) in the Friends tab.
                  </p>
                  <button className="fs-btn fs-btn-primary" onClick={() => setActiveTab('friends')}>
                    Select friends to compare
                  </button>
                </div>
              ) : (
                <div className="fs-compare-wrapper">
                  {/* Summary Bar */}
                  <div className="fs-compare-summary-bar">
                    <div className="fs-summary-text">
                      <div className="fs-summary-heading">
                        Comparing <strong>{joinNames(people.map((p) => p.name))}</strong>
                      </div>
                      <div className="fs-summary-detail">
                        {everyoneMinutes > 0 ? (
                          <>
                            Free together for <strong>{fmtDuration(everyoneMinutes)}</strong> this week across mutual gaps of {MIN_OPTIONS.find((o) => o.value === minMinutes)?.label || '1 hr'}+.
                          </>
                        ) : (
                          <>No mutual gaps of {MIN_OPTIONS.find((o) => o.value === minMinutes)?.label} or more found. Try a shorter minimum duration below.</>
                        )}
                      </div>
                    </div>
                    {windows.length > 0 && (
                      <button className="fs-btn fs-btn-subtle fs-btn-sm" onClick={onCopyList}>
                        {copied === 'list' ? '✓ List Copied!' : 'Copy free times'}
                      </button>
                    )}
                  </div>

                  {/* Sub-navigation & Controls */}
                  <div className="fs-compare-controls-bar">
                    {/* View Switcher */}
                    <div className="fs-subtabs">
                      {VIEWS.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          className={`fs-subtab ${compareView === v.id ? 'active' : ''}`}
                          onClick={() => setCompareView(v.id)}
                        >
                          <span className="fs-subtab-icon">{v.icon}</span>
                          <span>{v.label}</span>
                          {v.id === 'class' && shared.length > 0 && (
                            <span className="fs-subtab-badge">{shared.length}</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Filter Controls (Duration / Threshold) */}
                    {compareView === 'best' && (
                      <div className="fs-filters-group">
                        <span className="fs-filter-label">Min gap:</span>
                        <div className="fs-mini-segmented">
                          {MIN_OPTIONS.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              className={`fs-mini-seg-btn ${minMinutes === o.value ? 'active' : ''}`}
                              onClick={() => setMinMinutes(o.value)}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>

                        {total > 2 && (
                          <div className="fs-threshold-slider">
                            <span>At least <strong>{need}</strong> of {total} free</span>
                            <input
                              type="range"
                              min={2}
                              max={total}
                              value={need}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setNeedFree(v >= total ? null : v);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Active Comparison View */}
                  {compareView === 'best' && (
                    <BestTimesView
                      windows={windows}
                      total={total}
                      showAll={showAll}
                      onShowAll={() => setShowAll(true)}
                    />
                  )}

                  {compareView === 'heat' && (
                    <WeekGridView
                      grid={grid}
                      shared={shared}
                      picked={picked}
                      onPick={setPicked}
                    />
                  )}

                  {compareView === 'class' && (
                    <SameClassView shared={shared} overlap={overlap} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Design Tokens & CSS                                                */
/* ------------------------------------------------------------------ */
const FS_CSS = `
  .fs-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(4px);
    animation: fsFadeIn 0.15s ease-out;
  }
  @keyframes fsFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .fs-modal-card {
    width: 100%;
    max-width: 760px;
    max-height: calc(100vh - 40px);
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 20px 48px -12px rgba(15, 23, 42, 0.25);
    overflow: hidden;
  }

  /* Header */
  .fs-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px 14px;
    border-bottom: 1px solid #f1f5f9;
    background: #ffffff;
  }
  .fs-modal-title-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .fs-modal-icon {
    font-size: 22px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 10px;
  }
  .fs-modal-title {
    font-size: 17px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
    margin: 0;
  }
  .fs-modal-subtitle {
    font-size: 13px;
    color: #64748b;
    margin-top: 2px;
  }
  .fs-btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s ease;
  }
  .fs-btn-close:hover {
    color: #0f172a;
    background: #f1f5f9;
  }

  /* Notifications */
  .fs-banner {
    padding: 10px 24px;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .fs-banner-error {
    background: #fef2f2;
    color: #b91c1c;
    border-bottom: 1px solid #fecaca;
  }
  .fs-banner-success {
    background: #f0fdf4;
    color: #15803d;
    border-bottom: 1px solid #bbf7d0;
  }

  /* Tabs Nav */
  .fs-nav-tabs {
    display: flex;
    padding: 0 24px;
    background: #fafaf9;
    border-bottom: 1px solid #e2e8f0;
    gap: 8px;
  }
  .fs-nav-tab {
    padding: 12px 16px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.15s ease;
  }
  .fs-nav-tab:hover {
    color: #0f172a;
  }
  .fs-nav-tab.active {
    color: #0e3868;
    border-bottom-color: #0e3868;
  }
  .fs-tab-count {
    font-size: 11px;
    font-family: monospace;
    font-weight: 700;
    background: #e2e8f0;
    color: #475569;
    padding: 2px 7px;
    border-radius: 999px;
  }
  .fs-tab-count.highlight {
    background: #e0f2fe;
    color: #0369a1;
  }

  /* Modal Body */
  .fs-modal-body {
    overflow-y: auto;
    padding: 20px 24px;
    max-height: calc(85vh - 120px);
    background: #f8fafc;
  }
  .fs-tab-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Generic Cards */
  .fs-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 18px 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  }
  .fs-card-header {
    margin-bottom: 14px;
  }
  .fs-card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .fs-card-title {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
  }
  .fs-card-desc {
    font-size: 12.5px;
    color: #64748b;
    margin-top: 4px;
    line-height: 1.45;
  }

  /* Status Pills */
  .fs-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 999px;
  }
  .fs-status-pill.active {
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }
  .fs-status-pill.paused {
    background: #f1f5f9;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }
  .fs-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  /* Link Display Card */
  .fs-link-display-row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .fs-link-pill {
    flex: 1 1 280px;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 12px;
    overflow: hidden;
  }
  .fs-link-label {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    font-family: monospace;
  }
  .fs-link-code {
    font-family: monospace;
    font-size: 13px;
    color: #0e3868;
    letter-spacing: 0.05em;
  }
  .fs-link-url {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fs-link-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    font-size: 12.5px;
    color: #64748b;
    flex-wrap: wrap;
    gap: 8px;
  }
  .fs-share-as {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .fs-meta-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .fs-divider {
    color: #cbd5e1;
  }

  /* Create Box */
  .fs-create-box {
    margin-top: 8px;
  }
  .fs-field-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 6px;
  }
  .fs-create-row {
    display: flex;
    gap: 10px;
  }
  .fs-helper-warning {
    display: block;
    font-size: 12px;
    color: #b45309;
    margin-top: 8px;
  }

  /* Add Friend Form */
  .fs-add-row {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }
  .fs-input {
    flex: 1;
    min-width: 0;
    font-family: inherit;
    font-size: 13.5px;
    padding: 9px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #ffffff;
    color: #0f172a;
    transition: border-color 0.1s;
  }
  .fs-input:focus {
    outline: none;
    border-color: #0284c7;
    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12);
  }
  .fs-input-sm {
    font-family: inherit;
    font-size: 12.5px;
    padding: 4px 8px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    width: 140px;
  }

  /* Buttons */
  .fs-btn {
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
    transition: all 0.1s ease;
  }
  .fs-btn-primary {
    background: #0e3868;
    color: #ffffff;
    border-color: #0e3868;
  }
  .fs-btn-primary:hover {
    background: #144b8a;
  }
  .fs-btn-subtle {
    background: #f1f5f9;
    color: #334155;
    border-color: #e2e8f0;
  }
  .fs-btn-subtle:hover {
    background: #e2e8f0;
  }
  .fs-btn-sm {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 4px;
  }
  .fs-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .fs-text-btn {
    background: none;
    border: none;
    font-size: 12px;
    font-weight: 600;
    color: #0284c7;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .fs-text-btn.text-muted { color: #64748b; }
  .fs-text-btn.text-danger { color: #dc2626; }
  .fs-text-btn:hover { opacity: 0.8; }
  .fs-inline-edit {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Friends Section & Cards */
  .fs-friends-section {
    margin-top: 4px;
  }
  .fs-section-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
    flex-wrap: wrap;
    gap: 6px;
  }
  .fs-section-title {
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
  }
  .fs-section-tip {
    font-size: 12px;
    color: #64748b;
  }
  .fs-friends-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }
  .fs-friend-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    transition: all 0.15s ease;
  }
  .fs-friend-card.selected {
    border-color: #93c5fd;
    background: #f8fafc;
    box-shadow: 0 1px 4px rgba(2, 132, 199, 0.08);
  }
  .fs-friend-card.disabled {
    opacity: 0.6;
    background: #f8fafc;
  }
  .fs-friend-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 15px;
    flex-shrink: 0;
  }
  .fs-friend-info {
    flex: 1;
    min-width: 0;
  }
  .fs-friend-name {
    font-size: 13.5px;
    font-weight: 600;
    color: #0f172a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fs-friend-status {
    font-size: 11.5px;
    color: #64748b;
    margin-top: 1px;
  }
  .fs-friend-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Switch Toggle */
  .fs-checkbox-toggle {
    position: relative;
    display: inline-block;
    width: 34px;
    height: 20px;
  }
  .fs-checkbox-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .fs-toggle-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: #cbd5e1;
    border-radius: 20px;
    transition: 0.2s;
  }
  .fs-toggle-slider:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: 0.2s;
  }
  .fs-checkbox-toggle input:checked + .fs-toggle-slider {
    background-color: #0e3868;
  }
  .fs-checkbox-toggle input:checked + .fs-toggle-slider:before {
    transform: translateX(14px);
  }
  .fs-checkbox-toggle input:disabled + .fs-toggle-slider {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .fs-btn-remove {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 13px;
    padding: 4px;
    border-radius: 4px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .fs-btn-remove:hover {
    color: #dc2626;
    background: #fef2f2;
  }

  /* Empty States */
  .fs-empty-friends, .fs-empty-state {
    text-align: center;
    padding: 36px 20px;
    background: #ffffff;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
  }
  .fs-empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
  .fs-empty-title {
    font-size: 15px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 4px;
  }
  .fs-empty-desc {
    font-size: 13px;
    color: #64748b;
    max-width: 420px;
    margin: 0 auto 14px;
    line-height: 1.5;
  }
  .fs-loading-placeholder {
    text-align: center;
    padding: 24px;
    color: #64748b;
    font-size: 13px;
  }

  /* Paused State */
  .fs-paused-state {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
  }
  .fs-paused-text {
    font-size: 13px;
    color: #64748b;
  }

  /* ------------------------------------------------------------------ */
  /* Free Together Tab Styles                                           */
  /* ------------------------------------------------------------------ */
  .fs-compare-wrapper {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .fs-compare-summary-bar {
    background: #e0f2fe;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .fs-summary-heading {
    font-size: 13.5px;
    color: #0369a1;
  }
  .fs-summary-detail {
    font-size: 12.5px;
    color: #0c4a6e;
    margin-top: 2px;
  }

  .fs-compare-controls-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }

  .fs-subtabs {
    display: flex;
    background: #e2e8f0;
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }
  .fs-subtab {
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: #475569;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.1s;
  }
  .fs-subtab.active {
    background: #ffffff;
    color: #0e3868;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  }
  .fs-subtab-badge {
    font-size: 10.5px;
    background: #0e3868;
    color: #ffffff;
    padding: 1px 5px;
    border-radius: 999px;
  }

  .fs-filters-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .fs-filter-label {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
  }
  .fs-mini-segmented {
    display: flex;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 2px;
  }
  .fs-mini-seg-btn {
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    padding: 3px 8px;
    border: none;
    background: transparent;
    color: #64748b;
    border-radius: 3px;
    cursor: pointer;
  }
  .fs-mini-seg-btn.active {
    background: #0e3868;
    color: #ffffff;
  }

  .fs-threshold-slider {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #475569;
  }
  .fs-threshold-slider input[type="range"] {
    width: 70px;
  }

  /* Best Times Cards */
  .fs-windows-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .fs-window-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    transition: border-color 0.1s;
  }
  .fs-window-card.perfect-match {
    border-left: 4px solid #16a34a;
  }
  .fs-window-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 68px;
    padding: 6px 10px;
    background: #f1f5f9;
    border-radius: 6px;
    text-align: center;
  }
  .fs-window-day {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    text-transform: uppercase;
  }
  .fs-window-dur {
    font-size: 11.5px;
    color: #0284c7;
    font-weight: 600;
  }
  .fs-window-main {
    flex: 1;
    min-width: 0;
  }
  .fs-window-time {
    font-family: monospace;
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
  }
  .fs-window-sub {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
    font-size: 12px;
    color: #64748b;
  }
  .fs-tag {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .fs-tag-success {
    background: #dcfce7;
    color: #15803d;
  }
  .fs-tag-muted {
    background: #f1f5f9;
    color: #475569;
  }
  .fs-btn-show-more {
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    padding: 8px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    color: #0e3868;
    cursor: pointer;
    text-align: center;
    margin-top: 6px;
  }
  .fs-btn-show-more:hover {
    background: #f8fafc;
  }

  /* Week Grid Styles */
  .fs-grid-wrapper {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 16px;
  }
  .fs-heat {
    display: flex;
    gap: 8px;
  }
  .fs-heat-axis {
    position: relative;
    width: 40px;
    flex: none;
    margin-top: 24px;
  }
  .fs-heat-axis span {
    position: absolute;
    right: 4px;
    transform: translateY(-50%);
    font-family: monospace;
    font-size: 10.5px;
    color: #94a3b8;
  }
  .fs-heat-col {
    flex: 1 1 0;
    min-width: 0;
  }
  .fs-heat-dayname {
    height: 24px;
    font-size: 12.5px;
    font-weight: 700;
    text-align: center;
    color: #1e293b;
  }
  .fs-heat-track {
    position: relative;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
    background: #f8fafc;
    background-image: repeating-linear-gradient(to bottom, #f1f5f9 0, #f1f5f9 1px, transparent 1px, transparent 48px);
  }
  .fs-seg {
    position: absolute;
    left: 0;
    right: 0;
    padding: 0;
    border: 0;
    border-top: 1px solid #ffffff;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    color: #0f172a;
    background: color-mix(in srgb, #0e3868 var(--pct), #f1f5f9);
    transition: transform 0.05s ease;
  }
  .fs-seg.dark { color: #ffffff; }
  .fs-seg.picked {
    outline: 2px solid #0284c7;
    outline-offset: -2px;
    z-index: 2;
  }
  .fs-heat-class {
    position: absolute;
    left: 3px;
    right: 3px;
    z-index: 3;
    pointer-events: none;
    border: 1.5px solid #d97706;
    border-radius: 4px;
    background: rgba(251, 191, 36, 0.35);
    color: #78350f;
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1.1;
    padding: 2px 4px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .fs-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    margin: 12px 0 0 46px;
    font-size: 11.5px;
    color: #64748b;
  }
  .fs-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .fs-legend-bar {
    width: 60px;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(to right, #f1f5f9, #0e3868);
  }
  .fs-legend-class-badge {
    padding: 1px 6px;
    border: 1px solid #d97706;
    border-radius: 3px;
    background: rgba(251, 191, 36, 0.3);
    color: #78350f;
    font-weight: 700;
  }
  .fs-inspector-box {
    margin: 12px 0 0 46px;
    padding: 10px 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 12.5px;
    color: #334155;
  }
  .fs-inspector-hint {
    color: #64748b;
  }
  .fs-inspector-head {
    font-size: 13px;
    margin-bottom: 2px;
  }

  /* Same Class View */
  .fs-classes-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .fs-class-section-title {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .fs-indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .fs-indicator-dot.success { background: #16a34a; }
  .fs-indicator-dot.alert { background: #d97706; }
  .fs-sub-help {
    font-size: 12.5px;
    color: #64748b;
    margin-bottom: 10px;
  }
  .fs-class-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }
  .fs-class-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 14px;
  }
  .fs-class-card.group-swap {
    border-left: 3px solid #d97706;
  }
  .fs-class-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .fs-class-mod {
    font-family: monospace;
    font-size: 13.5px;
    font-weight: 700;
    color: #0f172a;
  }
  .fs-class-badge {
    font-size: 11px;
    font-weight: 600;
    background: #f1f5f9;
    color: #475569;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .fs-class-time {
    font-family: monospace;
    font-size: 12.5px;
    color: #0284c7;
    font-weight: 600;
  }
  .fs-class-who {
    font-size: 12px;
    color: #64748b;
    margin-top: 4px;
  }
  .fs-clusters-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }
  .fs-cluster-item {
    font-size: 12px;
    color: #334155;
  }
  .fs-cluster-who {
    font-weight: 600;
  }
  .fs-cluster-group {
    font-family: monospace;
    margin-left: 4px;
    color: #b45309;
    font-weight: 600;
  }
  .fs-cluster-slots {
    font-family: monospace;
    font-size: 11px;
    color: #64748b;
    margin-left: 4px;
  }

  @media (max-width: 640px) {
    .fs-modal-card { max-height: 96vh; }
    .fs-modal-header { padding: 14px 16px; }
    .fs-modal-body { padding: 14px 16px; }
    .fs-nav-tabs { padding: 0 16px; }
    .fs-link-pill { flex-basis: 100%; }
    .fs-compare-summary-bar { flex-direction: column; align-items: flex-start; }
    .fs-legend, .fs-inspector-box { margin-left: 0; }
  }
`;
