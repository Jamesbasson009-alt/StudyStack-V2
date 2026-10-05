import React, { useMemo, useState } from 'react';
import { generateTimetable } from '../lib/timetableGenerator.js';
import { DEMO_MODULES, DEMO_RECORDS } from '../lib/demoData.js';

const PREFS = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'free_day', label: 'Free day' },
  { key: 'early_friday', label: 'Early Friday' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' };
const START_HOUR = 7;
const END_HOUR = 18;
const ROW_H = 38; // px per hour

const THEMES = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8' },
];

const hourLabels = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

export function TimetableDemo({ onLaunchGenerator }) {
  const [pref, setPref] = useState('morning');
  const [optionIdx, setOptionIdx] = useState(0);

  // Run the real solver once per preference on the sample data.
  const results = useMemo(() => {
    const out = {};
    for (const p of PREFS) {
      out[p.key] = generateTimetable(DEMO_RECORDS, DEMO_MODULES, p.key, 'S2', [], 50);
    }
    return out;
  }, []);

  const result = results[pref];
  const solutions = result?.allSolutions || [];
  const solution = solutions[optionIdx] || result?.bestSolution;
  const meetings = solution?.meetings || [];

  const choosePref = (key) => {
    setPref(key);
    setOptionIdx(0);
  };
  const step = (dir) => {
    if (!solutions.length) return;
    setOptionIdx((i) => (i + dir + solutions.length) % solutions.length);
  };

  return (
    <div className="td-wrap">
      <style>{`
        .td-wrap {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 10px 40px rgba(14, 56, 104, 0.08);
          overflow: hidden;
          text-align: left;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .td-toolbar {
          display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
          padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
        }
        .td-pills { display: flex; flex-wrap: wrap; gap: 6px; }
        .td-pill {
          border: 1px solid #e2e8f0; background: #ffffff; color: #475569;
          font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 8px; cursor: pointer;
          font-family: inherit;
        }
        .td-pill:hover { border-color: #93c5fd; color: #0e3868; }
        .td-pill.active { background: #0e3868; border-color: #0e3868; color: #ffffff; }
        .td-stepper { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #64748b;
          font-family: 'JetBrains Mono', monospace; }
        .td-step-btn {
          width: 28px; height: 28px; border: 1px solid #e2e8f0; background: #ffffff; border-radius: 6px;
          cursor: pointer; color: #0e3868; font-size: 14px; line-height: 1; font-family: inherit;
        }
        .td-step-btn:hover { background: #eef2f7; }

        .td-summary {
          display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between;
          padding: 12px 18px; font-size: 13px; color: #334155; border-bottom: 1px solid #eef2f7;
        }
        .td-summary strong { color: #166534; }
        .td-legend { display: flex; flex-wrap: wrap; gap: 8px; }
        .td-chip {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
          padding: 3px 8px; border-radius: 5px; border: 1px solid;
        }

        .td-scroll { overflow-x: auto; }
        .td-grid {
          display: grid; grid-template-columns: 48px repeat(5, minmax(96px, 1fr)); min-width: 600px;
        }
        .td-head {
          font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;
          text-align: center; padding: 9px 0; border-bottom: 1px solid #e2e8f0; background: #ffffff;
        }
        .td-times { position: relative; }
        .td-time {
          position: absolute; left: 0; right: 0; text-align: center;
          font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: #94a3b8;
        }
        .td-col { position: relative; border-left: 1px solid #eef2f7; }
        .td-line { position: absolute; left: 0; right: 0; border-top: 1px solid #f1f5f9; }
        .td-block {
          position: absolute; left: 3px; right: 3px; border: 1px solid; border-radius: 6px;
          padding: 3px 6px; overflow: hidden; font-size: 11px; line-height: 1.25;
          transition: top 0.25s ease, height 0.25s ease;
        }
        .td-block-top { display: flex; justify-content: space-between; gap: 4px; align-items: baseline; }
        .td-block-mod { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 11px; }
        .td-block-act {
          font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 700;
          border: 1px solid currentColor; border-radius: 3px; padding: 0 3px; opacity: 0.8;
        }
        .td-block-sub { color: #475569; font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .td-footer {
          display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between;
          padding: 14px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; font-size: 12.5px; color: #64748b;
        }
        .td-cta {
          background: #0e3868; color: #ffffff; border: 1px solid #0e3868; border-radius: 8px;
          padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .td-cta:hover { background: #144e8c; }
      `}</style>

      <div className="td-toolbar">
        <div className="td-pills" role="tablist" aria-label="Schedule preference">
          {PREFS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={pref === p.key}
              className={`td-pill${pref === p.key ? ' active' : ''}`}
              onClick={() => choosePref(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="td-stepper">
          <button type="button" className="td-step-btn" onClick={() => step(-1)} aria-label="Previous option">‹</button>
          <span>Option {solutions.length ? optionIdx + 1 : 0} of {solutions.length}</span>
          <button type="button" className="td-step-btn" onClick={() => step(1)} aria-label="Next option">›</button>
        </div>
      </div>

      <div className="td-summary">
        <span>
          <strong>{solution?.summaryPrompt || 'No schedule found'}</strong>
          {' · '}{result?.totalValidSolutions?.toLocaleString() || 0} clash-free combinations found
        </span>
        <div className="td-legend">
          {DEMO_MODULES.map((m, i) => (
            <span
              key={m}
              className="td-chip"
              style={{ background: THEMES[i].bg, borderColor: THEMES[i].border, color: THEMES[i].text }}
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="td-scroll">
        <div className="td-grid">
          <div className="td-head" />
          {DAYS.map((d) => (
            <div key={d} className="td-head">{DAY_SHORT[d]}</div>
          ))}

          <div className="td-times" style={{ height: hourLabels.length * ROW_H }}>
            {hourLabels.map((h, i) => (
              <span key={h} className="td-time" style={{ top: i * ROW_H + 2 }}>
                {String(h).padStart(2, '0')}:30
              </span>
            ))}
          </div>

          {DAYS.map((day) => (
            <div key={day} className="td-col" style={{ height: hourLabels.length * ROW_H }}>
              {hourLabels.map((h, i) => (
                <div key={h} className="td-line" style={{ top: i * ROW_H }} />
              ))}
              {meetings
                .filter((m) => m.day === day)
                .map((m, idx) => {
                  const theme = THEMES[Math.max(0, DEMO_MODULES.indexOf(m.module))];
                  // grid rows start at 07:30, so shift by 7.5h
                  const top = ((m.startMinutes - (START_HOUR * 60 + 30)) / 60) * ROW_H;
                  const height = Math.max(22, (m.durationMinutes / 60) * ROW_H - 2);
                  return (
                    <div
                      key={`${m.module}-${m.activity}-${m.startMinutes}-${idx}`}
                      className="td-block"
                      style={{ top, height, background: theme.bg, borderColor: theme.border, color: theme.text }}
                    >
                      <div className="td-block-top">
                        <span className="td-block-mod">{m.module}</span>
                        <span className="td-block-act">{m.activity}</span>
                      </div>
                      {height > 34 && (
                        <div className="td-block-sub">{m.group}</div>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <div className="td-footer">
        <span>Sample data. This runs the same solver as the real app, right in your browser.</span>
        <button type="button" className="td-cta" onClick={onLaunchGenerator}>
          Try it with your own PDF →
        </button>
      </div>
    </div>
  );
}

export default TimetableDemo;
