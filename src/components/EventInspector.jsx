import React from 'react';
import { Icons } from './Icons.jsx';

/** Slide-over with the full details of one timetable block. Renders nothing when event is null. */
export function EventInspector({ event, onClose }) {
  if (!event) return null;
  return (
    <div className="inspector-overlay" role="presentation" onClick={onClose}>
      <div
        className="inspector-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        tabIndex={-1}
      >
        <div className="inspector-header">
          <h3 id="inspector-title" className="inspector-title">{event.title}</h3>
          <button className="inspector-close-btn" onClick={onClose} title="Close inspector" aria-label="Close">
            <Icons.Close />
          </button>
        </div>
        <div className="inspector-grid">
          <span className="inspector-key">Activity</span>
          <span className="inspector-val">
            {event.activityLabel} ({event.activityCode || 'L'})
          </span>

          <span className="inspector-key">Time</span>
          <span className="inspector-val mono">
            {event.day} · {event.fullTime || event.time}
          </span>

          <span className="inspector-key">Venue(s)</span>
          <span className="inspector-val">{event.venues?.join(', ') || event.room}</span>

          <span className="inspector-key">Group / Sem</span>
          <span className="inspector-val mono">
            {event.group} (Semester: {event.semester})
          </span>

          <span className="inspector-key">Campus</span>
          <span className="inspector-val">{event.campus || event.raw?.campus || '–'}</span>

          <span className="inspector-key">Language</span>
          <span className="inspector-val mono">{event.language || event.raw?.language || '–'}</span>
        </div>
        <div className="inspector-footer">
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
