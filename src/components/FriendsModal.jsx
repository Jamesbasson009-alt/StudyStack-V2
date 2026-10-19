// src/components/FriendsModal.jsx
// "Share with friends": create a share link, add friends' links, and see when
// you're all free. useFriendsShare holds the state (and keeps your shared copy
// in sync); FriendsModal is the UI.
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
    return "No timetable matches that link. Check it, or ask your friend to turn sharing on.";
  }
  if (msg.includes('your own link')) return "That's your own link. Send it to a friend instead.";
  if (e?.code === 'PGRST202' || e?.code === '42P01' || /does not exist|schema cache/i.test(msg)) {
    return "Sharing isn't set up on the server yet. Run supabase-share-friends.sql in Supabase.";
  }
  return msg || 'Something went wrong. Try again.';
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
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/* ------------------------------------------------------------------ */
/* State + syncing                                                     */
/* ------------------------------------------------------------------ */
export function useFriendsShare({ userKey, events, semester, ready }) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(null); // { code, name, semester, enabled } | null
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState([]); // friend codes included in the comparison
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const myBusy = useMemo(() => toBusyEvents(events), [events]);
  const mineRef = useRef(null);
  mineRef.current = mine;
  const lastSyncRef = useRef('');

  // A friend's link (?friend=CODE) may be opened while signed out. Remember it,
  // tidy the URL, and add the friend once we know who the user is.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('friend');
      if (code) {
        localStorage.setItem(PENDING_KEY, code);
        url.searchParams.delete('friend');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    } catch { /* storage or URL unavailable: ignore */ }
  }, []);

  const addFriend = useCallback(async (input) => {
    const code = extractCode(input);
    if (!code) {
      setError("That doesn't look like a StudyStack friend link or code.");
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
          ? `Added ${f.name}.`
          : `Added ${f.name}. They can't see your timetable yet. Create your link below and send it back.`
      );
      return true;
    } catch (e) {
      setError(friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  // Load my share + friends when a user signs in; then handle a pending link.
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

  // Keep my shared copy current whenever my timetable changes.
  // Skipped until the saved timetable has been restored, so we never publish an empty one.
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

  // Fresh friend timetables every time the modal opens.
  useEffect(() => {
    if (open && userKey) refresh();
  }, [open, userKey, refresh]);

  const enableSharing = async (name) => {
    const clean = String(name || '').trim().slice(0, 30);
    if (!clean) {
      setError('Enter the name your friends will see.');
      return;
    }
    if (myBusy.length === 0 || !semester) {
      setError('Generate your timetable first, then create a link.');
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
      lastSyncRef.current = ''; // push fresh times when turned back on
      setMine((m) => (m ? { ...m, enabled } : m));
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
      setNotice('New link created. The old one no longer works, so friends need to add the new one.');
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
/* UI                                                                  */
/* ------------------------------------------------------------------ */
const MIN_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: '2 hr', value: 120 },
];

const VIEWS = [
  { id: 'heat', label: 'Week grid' },
  { id: 'best', label: 'Best times' },
  { id: 'class', label: 'Same class' },
];

const PX_PER_MIN = 0.8;
const GRID_H = Math.round((DAY_END - DAY_START) * PX_PER_MIN);
const SHOW_FIRST = 8;

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

// "You" and friends can share a name; the comparison keys people by name, so make them unique.
function uniqueNames(names) {
  const seen = new Map();
  return names.map((n) => {
    const count = (seen.get(n) || 0) + 1;
    seen.set(n, count);
    return count === 1 ? n : `${n} (${count})`;
  });
}

function WeekGrid({ grid, shared, picked, onPick }) {
  const hours = [];
  for (let t = DAY_START; t < DAY_END; t += 60) hours.push(t);
  const top = (m) => (m - DAY_START) * PX_PER_MIN;

  const pickedSeg = picked ? grid.days[picked.day].segments.find((sg) => sg.start === picked.start) : null;

  return (
    <>
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
              {grid.days[day].segments.map((seg) => {
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
                      '--pct': `${Math.round((0.06 + 0.94 * f) * 100)}%`,
                    }}
                    onClick={() => onPick({ day, start: seg.start, end: seg.end })}
                    aria-label={`${FULL_DAY_NAMES[day]} ${fmtTime(seg.start)} to ${fmtTime(seg.end)}: ${seg.free} of ${grid.total} free`}
                  >
                    {f === 1 && seg.end - seg.start >= 50 ? 'All free' : ''}
                  </button>
                );
              })}
              {shared
                .filter((c) => c.d === day)
                .map((c) => (
                  <div
                    key={`${c.s}-${c.m}-${c.g}`}
                    className="fs-heat-class"
                    style={{ top: top(c.s), height: (c.e - c.s) * PX_PER_MIN }}
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
        <span>Nobody free</span>
        <span className="fs-legend-bar" />
        <span>Everyone free</span>
        <span className="fs-legend-class">In class together</span>
      </div>

      <p className="fs-pick" aria-live="polite">
        {pickedSeg ? (
          <>
            <strong>{FULL_DAY_NAMES[picked.day]} {fmtTime(pickedSeg.start)}–{fmtTime(pickedSeg.end)}.</strong>{' '}
            {pickedSeg.free === grid.total
              ? 'Everyone is free.'
              : `Free: ${pickedSeg.freeNames.length ? joinNames(pickedSeg.freeNames) : 'nobody'}. Busy: ${busyText(pickedSeg.busy)}.`}
          </>
        ) : (
          'Tap a block to see who is free and who is in class.'
        )}
      </p>
    </>
  );
}

function BestTimes({ windows, total, showAll, onShowAll }) {
  if (windows.length === 0) {
    return <p className="fs-help">Nothing matches. Try a shorter minimum{total > 2 ? ' or fewer people' : ''}.</p>;
  }
  const list = showAll ? windows : windows.slice(0, SHOW_FIRST);
  return (
    <>
      {list.map((w) => (
        <div key={`${w.day}-${w.start}`} className="fs-window">
          <span className="fs-time">
            {w.day} {w.wholeDay ? 'all day' : `${fmtTime(w.start)}–${fmtTime(w.end)}`}
          </span>
          <span className="fs-dur">{fmtDuration(w.minutes)}</span>
          <span className="fs-why">
            {w.free === total
              ? describeWindow(w)
              : `${w.free} of ${total} free. Busy: ${busyText(w.busy)}`}
          </span>
        </div>
      ))}
      {!showAll && windows.length > SHOW_FIRST && (
        <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={onShowAll}>
          Show all {windows.length}
        </button>
      )}
    </>
  );
}

function SameClass({ shared, overlap }) {
  const apart = overlap.filter((o) => !o.together);
  if (shared.length === 0 && apart.length === 0) {
    return (
      <p className="fs-help">
        No shared modules yet. When you and a friend take the same module, it shows up here.
      </p>
    );
  }
  return (
    <>
      {shared.length > 0 && (
        <>
          <h4 className="fs-sub">In class together</h4>
          {WEEKDAYS.filter((d) => shared.some((c) => c.d === d)).map((day) => (
            <div key={day} className="fs-day">
              <div className="fs-day-head"><span>{FULL_DAY_NAMES[day]}</span></div>
              {shared.filter((c) => c.d === day).map((c) => (
                <div key={`${c.s}-${c.m}-${c.g}`} className="fs-window">
                  <span className="fs-time">{fmtTime(c.s)} – {fmtTime(c.e)}</span>
                  <span className="fs-dur">{c.m}</span>
                  <span className="fs-why">
                    {joinNames(c.who)}{c.a ? ` · ${lower(c.a)}` : ''}{c.g ? ` · ${c.g}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
      {apart.length > 0 && (
        <>
          <h4 className="fs-sub">Same module, different group</h4>
          <p className="fs-help">
            You take these together but attend at different times. Switch to the same group to sit together.
          </p>
          {apart.map((o) => (
            <div key={`${o.m}-${o.a}`} className="fs-window fs-window-wide">
              <span className="fs-dur">{o.m}{o.a ? ` ${lower(o.a)}` : ''}</span>
              <span className="fs-why">
                {o.clusters
                  .map((c) => `${joinNames(c.who)}${c.g ? ` in ${c.g}` : ''} (${c.slots.map(slotLabel).join(', ')})`)
                  .join(' · ')}
              </span>
            </div>
          ))}
        </>
      )}
    </>
  );
}

export function FriendsModal({ share }) {
  const {
    open, closeModal, mine, friends, selected, loading, busy, error, notice,
    myBusy, semester, hasTimetable,
    enableSharing, stopSharing, resumeSharing, rotateLink, addFriend, removeFriend, toggleSelected,
  } = share;

  const [nameInput, setNameInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [minMinutes, setMinMinutes] = useState(60);
  const [view, setView] = useState('heat');
  const [needFree, setNeedFree] = useState(null); // null = everyone must be free
  const [picked, setPicked] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (mine?.name) {
      setNameInput(mine.name);
    } else {
      try { setNameInput(localStorage.getItem(NAME_KEY) || ''); } catch { /* ignore */ }
    }
  }, [mine?.name]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeModal]);

  const link = mine?.code ? shareUrl(mine.code) : '';

  // Friends we can compare against: sharing on and the same semester as ours.
  const comparable = (f) => f.enabled && f.semester === semester;
  const chosen = friends.filter((f) => selected.includes(f.code) && comparable(f));

  const people = useMemo(() => {
    if (!hasTimetable || chosen.length === 0) return null;
    const names = uniqueNames(['You', ...chosen.map((f) => f.name)]);
    return [
      { name: names[0], events: myBusy },
      ...chosen.map((f, i) => ({ name: names[i + 1], events: f.events || [] })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTimetable, myBusy, friends, selected, semester]);

  const total = people ? people.length : 0;
  const need = Math.min(needFree ?? total, total);

  const grid = useMemo(() => (people ? availabilityGrid(people) : null), [people]);
  const shared = useMemo(() => (people ? sharedClasses(people) : []), [people]);
  const overlap = useMemo(() => (people ? moduleOverlap(people) : []), [people]);
  const windows = useMemo(() => (grid ? bestWindows(grid, need, minMinutes) : []), [grid, need, minMinutes]);
  const everyoneWindows = useMemo(() => (grid ? bestWindows(grid, total, minMinutes) : []), [grid, total, minMinutes]);

  const everyoneMinutes = everyoneWindows.reduce((sum, w) => sum + w.minutes, 0);
  const longest = everyoneWindows.reduce((best, w) => (!best || w.minutes > best.minutes ? w : best), null);

  // A friend being removed or unselected can leave a stale pick behind.
  useEffect(() => { setPicked(null); }, [people]);
  useEffect(() => { setShowAll(false); }, [need, minMinutes, people]);

  const flashCopied = (what) => {
    setCopied(what);
    setTimeout(() => setCopied(''), 1800);
  };

  const onCopyLink = async () => { if (await copyText(link)) flashCopied('link'); };
  const onCopyList = async () => {
    if (!people) return;
    const text = windowsText({ names: people.map((p) => p.name), semester, windows });
    if (await copyText(text)) flashCopied('list');
  };
  const onNativeShare = async () => {
    try {
      await navigator.share({
        title: 'My timetable on StudyStack',
        text: `Add my timetable on StudyStack so we can see when we're both free (${semester}):`,
        url: link,
      });
    } catch { /* cancelled */ }
  };
  const onAdd = async () => {
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
      <div className="fs-panel" role="dialog" aria-modal="true" aria-labelledby="fs-title">
        <div className="fs-head">
          <h2 id="fs-title">Share with friends</h2>
          <button className="btn btn-sm" onClick={closeModal}>Close</button>
        </div>

        <div className="fs-body">
          {error && <div className="fs-alert fs-alert-error" role="alert">{error}</div>}
          {notice && <div className="fs-alert fs-alert-ok" role="status">{notice}</div>}

          {/* ---- Your link ---- */}
          <section className="fs-section">
            <h3>Your link</h3>
            {(!mine || !mine.enabled) && (
              <p className="fs-help">
                Friends who open your link can see which days and times you have class, and your
                module codes. Nothing else. You can stop sharing at any time.
              </p>
            )}

            {!mine && (
              <div className="fs-row">
                <input
                  className="fs-input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Name your friends will see"
                  maxLength={30}
                  aria-label="Name your friends will see"
                />
                <button
                  className="btn btn-primary"
                  onClick={() => enableSharing(nameInput)}
                  disabled={busy || !hasTimetable || !nameInput.trim()}
                >
                  Create link
                </button>
              </div>
            )}
            {!mine && !hasTimetable && (
              <p className="fs-help">Generate your timetable first, then come back to create a link.</p>
            )}

            {mine && mine.enabled && (
              <>
                <div className="fs-row">
                  <input className="fs-input fs-mono" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Your share link" />
                  <button className="btn btn-primary" onClick={onCopyLink}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button className="btn" onClick={onNativeShare}>Share…</button>
                  )}
                </div>
                <div className="fs-row">
                  <input
                    className="fs-input"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={30}
                    aria-label="Name your friends will see"
                  />
                  {nameInput.trim() && nameInput.trim() !== mine.name && (
                    <button className="btn" onClick={() => enableSharing(nameInput)} disabled={busy}>Save name</button>
                  )}
                  <button className="btn" onClick={stopSharing} disabled={busy}>Stop sharing</button>
                  <button
                    className="btn"
                    onClick={() => {
                      if (window.confirm('Make a new link? The old one stops working, including for friends who already added you.')) rotateLink();
                    }}
                    disabled={busy}
                  >
                    New link
                  </button>
                </div>
                <p className="fs-help">
                  Shows as “{mine.name}” · {mine.semester || semester}. Your link updates itself when
                  you change your timetable.
                </p>
              </>
            )}

            {mine && !mine.enabled && (
              <div className="fs-row">
                <span className="fs-help" style={{ margin: 0 }}>Sharing is off. Friends can't see your timetable.</span>
                <button className="btn" onClick={resumeSharing} disabled={busy}>Turn sharing on</button>
              </div>
            )}
          </section>

          {/* ---- Friends ---- */}
          <section className="fs-section">
            <h3>Friends</h3>
            <div className="fs-row">
              <input
                className="fs-input"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
                placeholder="Paste a friend's link or code"
                aria-label="Friend's link or code"
              />
              <button className="btn" onClick={onAdd} disabled={busy || !linkInput.trim()}>Add friend</button>
            </div>

            {loading && friends.length === 0 && <p className="fs-help">Loading…</p>}
            {!loading && friends.length === 0 && (
              <p className="fs-help">No friends yet. Send them your link, or paste theirs above.</p>
            )}

            {friends.length > 0 && (
              <ul className="fs-friends">
                {friends.map((f) => {
                  const ok = comparable(f);
                  const on = selected.includes(f.code) && ok;
                  const reason = !f.enabled
                    ? 'Stopped sharing'
                    : f.semester !== semester
                      ? `Timetable is for ${f.semester || 'another semester'}, yours is ${semester || 'not set'}`
                      : `Updated ${timeAgo(f.updatedAt)}`;
                  return (
                    <li key={f.code} className="fs-friend">
                      <button
                        className={`fs-chip ${on ? 'on' : ''}`}
                        onClick={() => toggleSelected(f.code)}
                        aria-pressed={on}
                        disabled={!ok}
                      >
                        {f.name}
                      </button>
                      <span className="fs-friend-note">{reason}</span>
                      <button className="fs-link" onClick={() => removeFriend(f.code)} aria-label={`Remove ${f.name}`}>Remove</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ---- Compare ---- */}
          <section className="fs-section">
            <div className="fs-section-head">
              <h3>Compare</h3>
              <div className="segmented-group" role="group" aria-label="View">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    className={`segmented-btn ${view === v.id ? 'active' : ''}`}
                    onClick={() => setView(v.id)}
                    aria-pressed={view === v.id}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {!hasTimetable && <p className="fs-help">Generate your timetable to compare it with your friends.</p>}
            {hasTimetable && friends.length === 0 && <p className="fs-help">Add a friend to see when you're both free.</p>}
            {hasTimetable && friends.length > 0 && chosen.length === 0 && (
              <p className="fs-help">Select a friend above. Only friends on the same semester ({semester}) can be compared.</p>
            )}

            {people && grid && (
              <>
                <div className="fs-summary">
                  <p>
                    <strong>{joinNames(people.map((p) => p.name))}</strong>
                    {everyoneMinutes > 0 ? (
                      <> {total === 2 ? 'are' : 'are all'} free together for <strong>{fmtDuration(everyoneMinutes)}</strong> this week
                        (gaps of {MIN_OPTIONS.find((o) => o.value === minMinutes).label} or more, 07:30 to 18:30).
                        {longest && (
                          <> Longest: {FULL_DAY_NAMES[longest.day]} {fmtTime(longest.start)}–{fmtTime(longest.end)}.</>
                        )}
                      </>
                    ) : (
                      <> {total === 2 ? 'have' : 'have all'} no shared gap of {MIN_OPTIONS.find((o) => o.value === minMinutes).label} or more.
                        {total > 2 ? ' Lower "At least" in Best times to see slots most of you share.' : ' Try a shorter minimum.'}</>
                    )}
                  </p>
                  {windows.length > 0 && (
                    <button className="btn btn-sm" onClick={onCopyList}>{copied === 'list' ? 'Copied' : 'Copy list'}</button>
                  )}
                </div>

                {view === 'heat' && (
                  <WeekGrid grid={grid} shared={shared} picked={picked} onPick={setPicked} />
                )}

                {view === 'best' && (
                  <>
                    <div className="fs-row fs-controls">
                      <div className="segmented-group" role="group" aria-label="Minimum free time">
                        {MIN_OPTIONS.map((o) => (
                          <button
                            key={o.value}
                            className={`segmented-btn ${minMinutes === o.value ? 'active' : ''}`}
                            onClick={() => setMinMinutes(o.value)}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                      {total > 2 && (
                        <label className="fs-slider">
                          <span>At least {need} of {total} free</span>
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
                        </label>
                      )}
                    </div>
                    <BestTimes windows={windows} total={total} showAll={showAll} onShowAll={() => setShowAll(true)} />
                  </>
                )}

                {view === 'class' && <SameClass shared={shared} overlap={overlap} />}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const FS_CSS = `
  .fs-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15, 23, 42, 0.45); }
  .fs-panel { width: 100%; max-width: 720px; max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.2); }
  .fs-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-color); }
  .fs-head h2 { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
  .fs-body { overflow-y: auto; padding: 4px 18px 18px; }
  .fs-section { padding: 16px 0 4px; }
  .fs-section + .fs-section { border-top: 1px solid var(--border-subtle); margin-top: 12px; }
  .fs-section h3 { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  .fs-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .fs-section-head h3 { margin: 0; }
  .fs-help { font-size: 12.5px; color: var(--text-muted); margin: 0 0 10px; max-width: 62ch; }
  .fs-muted { color: var(--text-muted); font-weight: 400; }
  .fs-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
  .fs-input { flex: 1 1 220px; min-width: 0; font-family: var(--font-sans); font-size: 13px; padding: 7px 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-surface); color: var(--text-primary); }
  .fs-input:focus-visible, .fs-chip:focus-visible, .fs-link:focus-visible { outline: 2px solid var(--accent-blue); outline-offset: 1px; }
  .fs-mono { font-family: var(--font-mono); font-size: 12px; }
  .fs-alert { font-size: 13px; padding: 8px 10px; border-radius: 4px; margin-top: 14px; border: 1px solid var(--border-color); background: var(--bg-subtle); }
  .fs-alert-error { color: var(--danger); background: var(--danger-bg); border-color: var(--danger-border); }
  .fs-alert-ok { color: var(--success); background: var(--success-bg); border-color: var(--success-border); }
  .fs-friends { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .fs-friend { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .fs-chip { font-family: var(--font-sans); font-size: 13px; font-weight: 500; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); cursor: pointer; }
  .fs-chip.on { background: var(--action-primary); border-color: var(--action-primary); color: #fff; }
  .fs-chip:disabled { opacity: 0.55; cursor: not-allowed; }
  .fs-friend-note { flex: 1 1 160px; font-size: 12px; color: var(--text-muted); }
  .fs-link { background: none; border: none; padding: 2px 4px; font-family: var(--font-sans); font-size: 12px; color: var(--text-muted); cursor: pointer; text-decoration: underline; }
  .fs-link:hover { color: var(--danger); }
  .fs-summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 10px 12px; margin-bottom: 8px; background: var(--accent-blue-subtle); border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; }
  .fs-day { margin-top: 12px; }
  .fs-day-head { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
  .fs-window { display: grid; grid-template-columns: 150px 64px 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border-subtle); font-size: 13px; align-items: baseline; }
  .fs-time { font-family: var(--font-mono); font-size: 12.5px; font-weight: 600; }
  .fs-dur { color: var(--text-secondary); }
  .fs-why { color: var(--text-muted); font-size: 12.5px; }
  .fs-sub { font-size: 12.5px; font-weight: 600; margin: 14px 0 4px; }
  .fs-controls { justify-content: space-between; margin-top: 4px; }
  .fs-slider { display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; color: var(--text-secondary); min-width: 160px; }
  .fs-window-wide { grid-template-columns: 150px 1fr; }
  .fs-heat { display: flex; gap: 6px; margin-top: 4px; }
  .fs-heat-axis { position: relative; width: 38px; flex: none; margin-top: 22px; }
  .fs-heat-axis span { position: absolute; right: 2px; transform: translateY(-50%); font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); }
  .fs-heat-col { flex: 1 1 0; min-width: 0; }
  .fs-heat-dayname { height: 22px; font-size: 12px; font-weight: 600; text-align: center; }
  .fs-heat-track { position: relative; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; background: var(--bg-subtle); background-image: repeating-linear-gradient(to bottom, var(--border-subtle) 0, var(--border-subtle) 1px, transparent 1px, transparent 48px); }
  .fs-seg { position: absolute; left: 0; right: 0; padding: 0; border: 0; border-top: 1px solid var(--bg-surface); cursor: pointer; font-family: var(--font-sans); font-size: 11px; font-weight: 600; color: var(--text-primary); background: var(--bg-subtle); background: color-mix(in srgb, var(--action-primary) var(--pct), var(--bg-subtle)); }
  .fs-seg.dark { color: #fff; }
  .fs-seg.picked { outline: 2px solid var(--accent-blue); outline-offset: -2px; z-index: 2; }
  .fs-seg:focus-visible { outline: 2px solid var(--accent-blue); outline-offset: -2px; z-index: 2; }
  .fs-heat-class { position: absolute; left: 3px; right: 3px; z-index: 1; pointer-events: none; border: 2px solid #b45309; border-radius: 3px; background: rgba(245, 158, 11, 0.28); color: #78350f; font-size: 10.5px; font-weight: 700; line-height: 1.1; padding: 1px 3px; overflow: hidden; }
  .fs-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0 0 44px; font-size: 11.5px; color: var(--text-muted); }
  .fs-legend-bar { width: 72px; height: 8px; border-radius: 4px; background: linear-gradient(to right, color-mix(in srgb, var(--action-primary) 6%, var(--bg-subtle)), var(--action-primary)); }
  .fs-legend-class { margin-left: 8px; padding: 0 6px; border: 2px solid #b45309; border-radius: 3px; background: rgba(245, 158, 11, 0.28); color: #78350f; }
  .fs-pick { min-height: 20px; margin: 8px 0 0 44px; font-size: 12.5px; color: var(--text-secondary); }
  @media (max-width: 560px) {
    .fs-window-wide { grid-template-columns: 1fr; }
    .fs-legend, .fs-pick { margin-left: 0; }
  }
  @media (max-width: 560px) {
    .fs-window { grid-template-columns: 1fr auto; }
    .fs-why { grid-column: 1 / -1; }
    .fs-summary { flex-direction: column; }
  }
`;
