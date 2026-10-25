import React, { useEffect, useRef, useState } from 'react';
import { getSession } from '../lib/auth.js';

/**
 * Where the link in the confirmation email lands.
 *
 *   landing   { status: 'success' } | { status: 'error', message }  - from getAuthLanding()
 *   onContinue()  open the app (used when the person is already signed in)
 *   onSignIn()    go to the sign-in form (falls back to onContinue when omitted)
 *
 * On success, supabase-js has usually signed the person in already (the link carries the
 * tokens), so we check for a session and offer "Open StudyStack". If the link was opened on a
 * different device or browser there's no session, so we send them to sign in instead.
 */
export function EmailConfirmedPage({ landing, onContinue, onSignIn }) {
  const isError = landing?.status === 'error';
  const [signedIn, setSignedIn] = useState(isError ? false : null); // null = still checking
  const headingRef = useRef(null);

  useEffect(() => {
    if (isError) {
      setSignedIn(false);
      return undefined;
    }
    let live = true;
    // getSession() waits for supabase-js to finish reading the tokens out of the URL.
    getSession()
      .then((session) => live && setSignedIn(Boolean(session)))
      .catch(() => live && setSignedIn(false));
    return () => {
      live = false;
    };
  }, [isError]);

  useEffect(() => {
    if (signedIn !== null) headingRef.current?.focus();
  }, [signedIn]);

  const checking = signedIn === null;
  const goSignIn = onSignIn || onContinue;

  let tone = 'checking';
  let title = 'Confirming your email…';
  let body = 'One moment.';
  let action = null;

  if (!checking && isError) {
    tone = 'error';
    title = 'That link didn’t work';
    body = landing?.message || 'This confirmation link isn’t valid.';
    action = { label: 'Back to sign in', run: goSignIn };
  } else if (!checking && signedIn) {
    tone = 'success';
    title = 'Email confirmed';
    body = 'Your StudyStack account is ready and you’re signed in.';
    action = { label: 'Open StudyStack', run: onContinue };
  } else if (!checking) {
    tone = 'success';
    title = 'Email confirmed';
    body = 'Your account is ready. Sign in with your student number and password to continue.';
    action = { label: 'Sign in', run: goSignIn };
  }

  return (
    <div className="confirm-root">
      <style>{`
        .confirm-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          background: #ffffff;
          position: fixed;
          inset: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .confirm-bar {
          background: #0e3868;
          color: #ffffff;
          padding: 14px clamp(20px, 5vw, 56px);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .confirm-plate {
          width: 40px;
          height: 40px;
          background: #ffffff;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        .confirm-plate img { width: 32px; height: 32px; object-fit: contain; display: block; }
        .confirm-name { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
        .confirm-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.16);
          letter-spacing: 0.05em;
        }
        .confirm-main {
          flex: 1;
          display: flex;
          padding: 24px clamp(20px, 5vw, 72px) 40px;
        }
        .confirm-card {
          width: 100%;
          max-width: 400px;
          margin: auto;
          padding: 24px 0;
        }
        .confirm-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 14px;
          border: 1px solid;
          margin-bottom: 22px;
        }
        .confirm-icon[data-tone="checking"] { background: #eff6ff; border-color: #bfdbfe; color: #0e3868; }
        .confirm-icon[data-tone="success"] { background: #f0fdf4; border-color: #86efac; color: #15803d; }
        .confirm-icon[data-tone="error"] { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
        .confirm-tick {
          stroke-dasharray: 24;
          stroke-dashoffset: 0;
          animation: confirm-draw 0.45s ease-out 0.1s backwards;
        }
        @keyframes confirm-draw { from { stroke-dashoffset: 24; } }
        .confirm-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.15;
          color: #0e3868;
          margin: 0 0 8px;
        }
        .confirm-title:focus { outline: none; }
        .confirm-sub {
          font-size: 15px;
          color: #475569;
          line-height: 1.5;
          margin: 0 0 24px;
        }
        .confirm-hint {
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
          margin: -10px 0 24px;
        }
        .confirm-action {
          width: 100%;
          height: 46px;
          border: none;
          border-radius: 8px;
          background: #0e3868;
          color: #ffffff;
          font: inherit;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .confirm-action:hover { background: #144e8c; }
        .confirm-root button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .confirm-tick { animation: none; }
          .confirm-root * { transition: none !important; }
        }
      `}</style>

      <header className="confirm-bar">
        <span className="confirm-plate">
          <img src="/studystack-mark.png" alt="" />
        </span>
        <span className="confirm-name">StudyStack</span>
        <span className="confirm-badge">UP</span>
      </header>

      <main className="confirm-main">
        <div className="confirm-card">
          <span className="confirm-icon" data-tone={tone} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {tone === 'success' && <polyline className="confirm-tick" points="5 12.5 10 17.5 19 7.5"></polyline>}
              {tone === 'error' && (
                <>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                </>
              )}
              {tone === 'checking' && (
                <>
                  <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                  <polyline points="3 7 12 13 21 7"></polyline>
                </>
              )}
            </svg>
          </span>

          <h1 className="confirm-title" ref={headingRef} tabIndex={-1}>
            {title}
          </h1>
          <p className="confirm-sub" role="status">
            {body}
          </p>
          {tone === 'error' && (
            <p className="confirm-hint">
              Sign in with your student number and password. If your email still needs confirming,
              we’ll offer to send a new link.
            </p>
          )}

          {action && (
            <button type="button" className="confirm-action" onClick={action.run}>
              {action.label}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

export default EmailConfirmedPage;
