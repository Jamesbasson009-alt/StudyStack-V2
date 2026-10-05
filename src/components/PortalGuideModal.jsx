import React, { useEffect } from 'react';

/**
 * Step-by-step "where do I get this file?" guide, shown as a modal.
 * Used by the sidebar upload widget and empty-state screen (App.jsx) and the
 * landing page FAQ, so the steps only need updating in one place.
 */

const STEPS = [
  {
    title: 'Go to the UP Portal',
    body: (
      <>
        Open {' '}
        <a href="https://www.up.ac.za" target="_blank" rel="noreferrer">up.ac.za</a> and click{' '}
        <strong>"My UP Login"</strong>. This is the same portal you use for registration, fees, and results —
        not clickUP, which is only for course content.
      </>
    ),
  },
  {
    title: 'Log in with your student number',
    body: (
      <>
        Your username is <strong>u</strong> followed by your 8-digit student number (e.g.{' '}
        <code>u12345678</code>), with your UP Portal password.
      </>
    ),
  },
  {
    title: 'Open "Student Centre"',
    body: (
      <>
        After logging in, look for a portlet or tab called <strong>"Student Centre"</strong> — this is where
        your registration, timetable, and results all live.
      </>
    ),
  },
  {
    title: 'Find your class schedule',
    body: (
      <>
        Inside Student Centre, Click on <strong>"Timetable"</strong>  Make sure the correct year and semester is selected and click on <strong>Lectures</strong>.
      </>
    ),
  },
  {
    title: 'Export it as a PDF',
    body: (
      <>
        Use the download button Directly above all your lecture times to save it as a PDF. UP names this file starting with{' '}
        <code>UP_MOD_XLS</code> — that's the file StudyStack is looking for, so don't rename it.
      </>
    ),
  },
];

export function PortalGuideModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="portal-guide-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-guide-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <style>{`
        .portal-guide-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 20px;
        }
        .portal-guide-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          width: min(520px, 100%);
          max-height: min(680px, 90vh);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .portal-guide-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          flex-shrink: 0;
        }
        .portal-guide-title {
          font-size: 15px;
          font-weight: 700;
          color: #0e3868;
          margin: 0;
        }
        .portal-guide-close-btn {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 5px;
          border-radius: 5px;
          display: flex;
          line-height: 0;
        }
        .portal-guide-close-btn:hover { color: #0e3868; background: #e2e8f0; }

        .portal-guide-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .portal-guide-steps {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .portal-guide-step {
          display: flex;
          gap: 12px;
        }
        .portal-guide-step-num {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #0e3868;
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .portal-guide-step-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 3px;
        }
        .portal-guide-step-body {
          font-size: 13px;
          line-height: 1.55;
          color: #475569;
          margin: 0;
        }
        .portal-guide-step-body code {
          font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
          background: #eef2f7;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 12px;
        }
        .portal-guide-step-body a {
          color: #2563eb;
          font-weight: 600;
          text-decoration: none;
        }
        .portal-guide-step-body a:hover { text-decoration: underline; }

        .portal-guide-note {
          margin-top: 18px;
          padding: 12px 14px;
          border-radius: 6px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          font-size: 12px;
          line-height: 1.5;
          color: #0c4a6e;
        }

        .portal-guide-footer {
          padding: 12px 20px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-shrink: 0;
        }
        .portal-guide-done-btn {
          background: #0e3868;
          color: #ffffff;
          border: 1px solid #0e3868;
          border-radius: 6px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .portal-guide-done-btn:hover { background: #144e8c; }
      `}</style>

      <div className="portal-guide-panel">
        <div className="portal-guide-header">
          <h2 id="portal-guide-title" className="portal-guide-title">Where do I get my timetable PDF?</h2>
          <button type="button" className="portal-guide-close-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="portal-guide-body">
          <div className="portal-guide-steps">
            {STEPS.map((step, i) => (
              <div className="portal-guide-step" key={step.title}>
                <div className="portal-guide-step-num">{i + 1}</div>
                <div>
                  <p className="portal-guide-step-title">{step.title}</p>
                  <p className="portal-guide-step-body">{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="portal-guide-note">
            Menu names on the UP Portal shift around sometimes. If a step doesn't match what you see,
            the IT Help Desk (012 420 3051) can point you to the right page — the file you're after is
            just your official class schedule, exported or printed as a PDF.
          </div>
        </div>

        <div className="portal-guide-footer">
          <button type="button" className="portal-guide-done-btn" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default PortalGuideModal;
