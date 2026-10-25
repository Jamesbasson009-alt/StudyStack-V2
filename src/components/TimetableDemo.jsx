import React, { useMemo, useState } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIOD_COUNT = 10;

// Period n starts at 07:30 + (n - 1) hours and lasts 50 minutes.
const fmt = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const periodStart = (p) => 450 + (p - 1) * 60;
const periodEnd = (p) => periodStart(p) + 50;

const MODULES = [
  { code: 'COS 132', color: '#1d4ed8', bg: '#dbeafe', room: 'IT 2-26' },
  { code: 'WTW 114', color: '#6d28d9', bg: '#ede9fe', room: 'Centenary 4-15' },
  { code: 'STK 110', color: '#0f766e', bg: '#ccfbf1', room: 'Aldoel 2-14' },
  { code: 'INF 154', color: '#c2410c', bg: '#ffedd5', room: 'IT 4-40' },
];
const TYPES = { L: 'Lecture', P: 'Practical', T: 'Tutorial' };

// One string per weekday (Mon to Fri). Token = module index, type, period or period-range.
// Every option has the same 17 periods of teaching so the comparison is fair.
const RAW = {
  morning: [
    ['0L1 1L2 2L3', '3L1 1L2 0P3-4', '0L1 2P2-3 1T4', '1L1 3L2 2L3', '0L1 3P2-3'],
    ['3L1 0L2 1L3 2L4', '0L1 1L2 3P3-4', '2P1-2 1T3', '1L1 0L2 2L3', '3L1 0P2-3'],
    ['0L1 1L2 3L3 0P4-5', '1L1 2L2 3P3-4', '0L1 2P2-3 1T4', '1L1 0L2 2L3', '3L1'],
  ],
  afternoon: [
    ['0L5 1L6 2L7 0P8-9', '3L5 1L6 2P7-8', '0L5 3P6-7 1T9', '1L5 3L6 2L7', '0L5'],
    ['3L5 0L6 1L7 2L8', '0L6 1L7 0P8-9', '2P6-7 1T8', '1L6 0L7 2L8', '3L6 3P7-8'],
    ['0L5 1L6 2L7', '3L5 0L6 1L7 0P9-10', '2P5-6 1T7', '1L6 2L7 3L8', '0L6 3P7-8'],
  ],
  freeday: [
    ['0L2 1L3 2L4 3L6 0P7-8', '0L2 1L3 2P5-6 3P7-8', '', '0L3 1L4 2L5 3L6 1T7', ''],
    ['', '0L3 1L4 2L5 0P7-8', '3L2 0L3 1L4 2P6-7 1T8', '0L3 1L4 2L5 3L6 3P7-8', ''],
    ['0L2 1L3 2L4 3L5 0P7-8', '', '0L2 1L3 2P5-6 3P7-8', '', '0L2 1L3 2L4 3L5 1T6'],
  ],
  earlyfriday: [
    ['0L2 1L3 2L5 0P7-8', '3L3 1L4 2P6-7', '0L2 3P4-5 1T7', '0L3 1L4 3L6', '2L1'],
    ['0L2 1L3 0P5-6', '0L3 1L4 2P6-7', '1L3 3P5-6 1T8', '0L2 3L4 2L5', '3L1 2L2'],
    ['2L3 3L4 0P6-7', '0L2 1L3 3P5-6', '0L3 2L4 2P6-7 1T9', '1L3 3L5', '0L1 1L2'],
  ],
};

const parse = (week) =>
  week.flatMap((day, d) =>
    day
      .split(' ')
      .filter(Boolean)
      .map((tok) => {
        const [, m, t, a, b] = tok.match(/^(\d)([LPT])(\d+)(?:-(\d+))?$/);
        const start = Number(a);
        const end = b ? Number(b) : start;
        return { day: d, start, end, mod: MODULES[Number(m)], type: t };
      })
  );

export const PREFERENCES = [
  { id: 'morning', label: 'Morning', blurb: 'Everything starts at 07:30 and wraps up before lunch, so your afternoons are yours.' },
  { id: 'afternoon', label: 'Afternoon', blurb: 'Nothing before 11:30. Sleep in, then work through a compact afternoon block.' },
  { id: 'freeday', label: 'Free Day', blurb: 'Classes are packed into three days, which frees up two whole weekdays.' },
  { id: 'earlyfriday', label: 'Early Friday', blurb: 'Mondays to Thursdays carry the load so Friday is done by mid-morning.' },
];

function summarise(sessions) {
  const days = DAYS.map((_, d) => sessions.filter((s) => s.day === d));
  const free = days.map((s, d) => (s.length === 0 ? d : -1)).filter((d) => d >= 0);
  const first = Math.min(...sessions.map((s) => s.start));
  const last = Math.max(...sessions.map((s) => s.end));
  const fri = days[4];
  return {
    free,
    starts: fmt(periodStart(first)),
    ends: fmt(periodEnd(last)),
    friday: fri.length ? fmt(periodEnd(Math.max(...fri.map((s) => s.end)))) : null,
  };
}

export function TimetableDemo({ onLaunchGenerator, preference, onPreferenceChange }) {
  const [localPref, setLocalPref] = useState('morning');
  const pref = preference ?? localPref;
  const [option, setOption] = useState(0);

  const setPref = (id) => {
    setOption(0);
    onPreferenceChange ? onPreferenceChange(id) : setLocalPref(id);
  };

  const options = useMemo(() => Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, v.map(parse)])), []);
  const current = PREFERENCES.find((p) => p.id === pref) ?? PREFERENCES[0];
  const sessions = options[current.id][option] ?? options[current.id][0];
  const stats = summarise(sessions);
  const total = options[current.id].length;

  const statItems = [
    { label: 'Days off', value: stats.free.length ? stats.free.map((d) => DAYS[d]).join(' + ') : 'None' },
    { label: 'Earliest start', value: stats.starts },
    { label: 'Latest finish', value: stats.ends },
    { label: 'Friday ends', value: stats.friday ?? 'Day off' },
  ];

  return (
    <div className="td-root">
      <style>{`
        .td-root { max-width: 940px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 30px rgba(14,56,104,.07); overflow: hidden; }
        .td-top { padding: 20px 20px 0; display: flex; flex-direction: column; gap: 14px; }
        .td-tabs { display: flex; flex-wrap: wrap; gap: 6px; background: #f1f5f9; padding: 5px; border-radius: 10px; }
        .td-tab { flex: 1 1 110px; font: inherit; font-size: 14px; font-weight: 600; color: #475569; background: transparent; border: none; border-radius: 7px; padding: 9px 12px; cursor: pointer; transition: all .15s ease; }
        .td-tab:hover { color: #0e3868; }
        .td-tab[aria-selected="true"] { background: #0e3868; color: #fff; box-shadow: 0 2px 6px rgba(14,56,104,.25); }
        .td-blurb { font-size: 14px; color: #475569; margin: 0; min-height: 22px; }
        .td-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .td-stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; }
        .td-stat-label { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
        .td-stat-value { font-size: 16px; font-weight: 700; color: #0e3868; margin-top: 2px; }
        .td-scroll { overflow-x: auto; padding: 16px 20px 6px; }
        .td-grid { display: grid; grid-template-columns: 52px repeat(5, minmax(96px, 1fr)); grid-template-rows: 30px repeat(${PERIOD_COUNT}, 42px); min-width: 620px; border-top: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0; }
        .td-head, .td-time, .td-cell { border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
        .td-head { display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #475569; background: #f8fafc; }
        .td-head.is-off { color: #94a3b8; }
        .td-head.is-friday-hl { color: #0e3868; background: #dbeafe; }
        .td-time { font-size: 10px; line-height: 1.2; color: #94a3b8; display: flex; align-items: center; justify-content: center; text-align: center; background: #fcfdff; }
        .td-off { grid-row: 2 / span ${PERIOD_COUNT}; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #94a3b8; background: repeating-linear-gradient(45deg, #f8fafc, #f8fafc 8px, #f1f5f9 8px, #f1f5f9 16px); border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; z-index: 1; }
        .td-session { z-index: 2; margin: 2px; border-radius: 6px; padding: 4px 7px; font-size: 11px; line-height: 1.3; border-left: 3px solid; overflow: hidden; animation: td-in .25s ease both; }
        .td-session strong { display: block; font-size: 12px; }
        @keyframes td-in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .td-session { animation: none; } }
        .td-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px 20px; }
        .td-nav { display: inline-flex; align-items: center; gap: 10px; }
        .td-nav button { font: inherit; width: 34px; height: 34px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; color: #0e3868; cursor: pointer; font-size: 16px; }
        .td-nav button:hover { border-color: #0e3868; background: #f8fafc; }
        .td-nav span { font-size: 13px; font-weight: 600; color: #475569; min-width: 84px; text-align: center; }
        .td-cta { font: inherit; font-size: 14px; font-weight: 700; background: #0e3868; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; cursor: pointer; }
        .td-cta:hover { background: #144e8c; }
        .td-note { font-size: 12px; color: #94a3b8; padding: 0 20px 14px; margin: 0; }
        .td-root button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
      `}</style>

      <div className="td-top">
        <div className="td-tabs" role="tablist" aria-label="Schedule preference">
          {PREFERENCES.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === current.id} className="td-tab" onClick={() => setPref(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="td-blurb" aria-live="polite">{current.blurb}</p>
        <div className="td-stats">
          {statItems.map((s) => (
            <div key={s.label} className="td-stat">
              <div className="td-stat-label">{s.label}</div>
              <div className="td-stat-value">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="td-scroll">
        <div className="td-grid" key={`${current.id}-${option}`}>
          <div className="td-head" style={{ gridColumn: 1, gridRow: 1 }} />
          {DAYS.map((d, i) => (
            <div
              key={d}
              className={`td-head${stats.free.includes(i) ? ' is-off' : ''}${current.id === 'earlyfriday' && i === 4 ? ' is-friday-hl' : ''}`}
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              {d}
            </div>
          ))}
          {Array.from({ length: PERIOD_COUNT }, (_, p) => (
            <React.Fragment key={p}>
              <div className="td-time" style={{ gridColumn: 1, gridRow: p + 2 }}>{fmt(periodStart(p + 1))}</div>
              {DAYS.map((d, i) => (
                <div key={d} className="td-cell" style={{ gridColumn: i + 2, gridRow: p + 2 }} />
              ))}
            </React.Fragment>
          ))}
          {stats.free.map((d) => (
            <div key={d} className="td-off" style={{ gridColumn: d + 2 }}>Free day</div>
          ))}
          {sessions.map((s, i) => (
            <div
              key={i}
              className="td-session"
              title={`${s.mod.code} ${TYPES[s.type]} · ${s.mod.room} · ${fmt(periodStart(s.start))}–${fmt(periodEnd(s.end))}`}
              style={{
                gridColumn: s.day + 2,
                gridRow: `${s.start + 1} / ${s.end + 2}`,
                background: s.mod.bg,
                borderColor: s.mod.color,
                color: s.mod.color,
              }}
            >
              <strong>{s.mod.code}</strong>
              {TYPES[s.type]} · {s.mod.room}
            </div>
          ))}
        </div>
      </div>

      <div className="td-foot">
        <div className="td-nav">
          <button type="button" aria-label="Previous option" onClick={() => setOption((option - 1 + total) % total)}>‹</button>
          <span>Option {option + 1} of {total}</span>
          <button type="button" aria-label="Next option" onClick={() => setOption((option + 1) % total)}>›</button>
        </div>
        <button type="button" className="td-cta" onClick={onLaunchGenerator}>Generate yours from your PDF →</button>
      </div>
      <p className="td-note">Sample modules and venues for illustration. Your real timetable comes from your own PDF.</p>
    </div>
  );
}

export default TimetableDemo;
