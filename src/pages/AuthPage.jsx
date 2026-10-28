import React, { useEffect, useRef, useState } from 'react';
import {
  AuthError,
  MIN_PASSWORD_LENGTH,
  STUDENT_EMAIL_DOMAIN,
  STUDENT_NUMBER_LENGTH,
  buildStudentEmail,
  resendConfirmation,
  signIn,
  signUp,
} from '../lib/auth.js';

// A small clash-free week for the side panel: no two blocks share a slot in the same column.
const TONES = {
  blue: { bg: '#eff6ff', edge: '#93c5fd' },
  green: { bg: '#f0fdf4', edge: '#86efac' },
  amber: { bg: '#fffbeb', edge: '#fcd34d' },
  purple: { bg: '#faf5ff', edge: '#d8b4fe' },
  teal: { bg: '#f0fdfa', edge: '#5eead4' },
};

const PREVIEW_BLOCKS = [
  { col: 1, row: 1, span: 2, tone: 'blue' },
  { col: 1, row: 5, span: 1, tone: 'green' },
  { col: 2, row: 2, span: 1, tone: 'amber' },
  { col: 2, row: 4, span: 2, tone: 'purple' },
  { col: 3, row: 1, span: 1, tone: 'teal' },
  { col: 3, row: 3, span: 2, tone: 'blue' },
  { col: 4, row: 2, span: 2, tone: 'green' },
  { col: 4, row: 6, span: 1, tone: 'amber' },
  { col: 5, row: 1, span: 1, tone: 'purple' },
  { col: 5, row: 3, span: 1, tone: 'teal' },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Supabase allows one email per address every 60 seconds by default; the Resend button waits that long.
const RESEND_COOLDOWN_SECONDS = 60;

// Shown after sign-up (and after "resend" from a sign-in attempt): the account exists but the
// email hasn't been confirmed yet, so there's nothing to sign in to.
function CheckEmailView({ email, cooldown, resending, status, onResend, onEditNumber, onSignIn }) {
  const headingRef = useRef(null);

  // Move focus to the new heading so keyboard and screen-reader users land on the change.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const resendLabel = resending
    ? 'Sending…'
    : cooldown > 0
    ? `Resend email in ${cooldown}s`
    : 'Resend email';

  return (
    <div className="auth-sent">
      <span className="auth-sent-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2"></rect>
          <polyline points="3 7 12 13 21 7"></polyline>
        </svg>
      </span>
      <h1 className="auth-title" ref={headingRef} tabIndex={-1}>
        Check your inbox
      </h1>
      <p className="auth-sub">
        We sent a confirmation link to <span className="auth-sent-address">{email}</span>. Open it to
        finish setting up your account.
      </p>
      <p className="auth-hint">
        Nothing there? Check your junk folder. Mail to student inboxes can take a few minutes.
      </p>

      <button type="button" className="auth-secondary" onClick={onResend} disabled={resending || cooldown > 0}>
        {resendLabel}
      </button>
      <p className="auth-status" role="status" aria-live="polite" data-kind={status?.kind}>
        {status?.text}
      </p>

      <div className="auth-sent-links">
        <button type="button" className="auth-link-inline" onClick={onEditNumber}>
          Wrong student number?
        </button>
        <button type="button" className="auth-link-inline" onClick={onSignIn}>
          Already confirmed? Sign in
        </button>
      </div>
    </div>
  );
}

function describeError(err) {
  if (!(err instanceof AuthError)) {
    return { field: 'form', message: 'Something went wrong. Please try again.' };
  }
  switch (err.code) {
    case 'exists':
      return {
        field: 'email',
        message: 'An account for this email already exists.',
        action: 'signin',
      };
    case 'unconfirmed':
      return { field: 'form', message: err.message, action: 'resend' };
    case 'invalid_email':
      return { field: 'email', message: err.message };
    case 'weak_password':
    case 'bad_password':
      return { field: 'password', message: err.message };
    default:
      return { field: 'form', message: err.message };
  }
}

export function AuthPage({ onAuthenticated, onBack, onNavigate }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [digits, setDigits] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [pendingEmail, setPendingEmail] = useState(null); // set once a confirmation email is on its way
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

  const numberRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const isSignup = mode === 'signup';

  // Focus the student number on desktop only; on phones it would pop the keyboard open immediately.
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(min-width: 900px)').matches) {
      numberRef.current?.focus();
    }
  }, []);

  // Counts the resend cooldown down one second at a time.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function switchMode(next) {
    setMode(next);
    setErrors({});
    setConfirm('');
    setShowPassword(false);
    setAgreed(false);
  }

  function focusField(field) {
    const target = { email: numberRef, password: passwordRef, confirm: confirmRef }[field];
    target?.current?.focus();
  }

  // Accepts typed digits, or a pasted "u26080975@tuks.co.za" (e.g. from a password manager).
  function handleNumberChange(event) {
    const raw = event.target.value.trim().toLowerCase();
    if (raw.includes('@') && !raw.endsWith(`@${STUDENT_EMAIL_DOMAIN}`)) {
      setErrors((prev) => ({
        ...prev,
        email: `Only UP student emails ending in @${STUDENT_EMAIL_DOMAIN} can be used.`,
        action: undefined,
      }));
      return;
    }
    const next = raw
      .replace(/@.*$/, '')
      .replace(/^u/, '')
      .replace(/\D/g, '')
      .slice(0, STUDENT_NUMBER_LENGTH);
    setDigits(next);
    setErrors((prev) => ({ ...prev, email: undefined, action: undefined, form: undefined }));
  }

  function validate() {
    const next = {};
    if (digits.length !== STUDENT_NUMBER_LENGTH) {
      next.email = `Enter your ${STUDENT_NUMBER_LENGTH}-digit student number.`;
    }
    if (!password) {
      next.password = 'Enter your password.';
    } else if (isSignup && password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (isSignup && confirm !== password) {
      next.confirm = 'The two passwords don’t match.';
    }
    if (isSignup && !agreed) {
      next.agree = 'Please agree to the Terms of Service and Privacy Policy to continue.';
    }
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const found = validate();
    const firstInvalid = ['email', 'password', 'confirm'].find((f) => found[f]);
    if (firstInvalid) {
      setErrors(found);
      focusField(firstInvalid);
      return;
    }
    if (found.agree) {
      setErrors(found);
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      const email = buildStudentEmail(digits);
      if (isSignup) {
        const { session, needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          showCheckEmail(email);
          return;
        }
        onAuthenticated(session);
      } else {
        onAuthenticated(await signIn(email, password));
      }
    } catch (err) {
      const { field, message, action } = describeError(err);
      setErrors({ [field]: message, action });
      if (field !== 'form') focusField(field);
    } finally {
      setBusy(false);
    }
  }

  function showCheckEmail(email) {
    setPendingEmail(email);
    setResendStatus(null);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setPassword('');
    setConfirm('');
    setShowPassword(false);
    setErrors({});
  }

  function leaveCheckEmail(nextMode) {
    setPendingEmail(null);
    setResendStatus(null);
    setCooldown(0);
    switchMode(nextMode);
  }

  // "Resend email" on the check-your-inbox view.
  async function handleResend() {
    if (!pendingEmail || cooldown > 0 || resending) return;
    setResending(true);
    setResendStatus(null);
    try {
      await resendConfirmation(pendingEmail);
      setResendStatus({ kind: 'ok', text: 'Sent again. It can take a minute or two to arrive.' });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setResendStatus({
        kind: 'error',
        text: err instanceof AuthError ? err.message : 'Couldn’t resend the email. Please try again.',
      });
    } finally {
      setResending(false);
    }
  }

  // Shown under a sign-in attempt on an account whose email isn't confirmed yet.
  async function handleResendFromSignIn() {
    if (resending) return;
    const email = buildStudentEmail(digits);
    setResending(true);
    try {
      await resendConfirmation(email);
      showCheckEmail(email);
    } catch (err) {
      setErrors({
        form: err instanceof AuthError ? err.message : 'Couldn’t resend the email. Please try again.',
      });
    } finally {
      setResending(false);
    }
  }

  const passwordType = showPassword ? 'text' : 'password';

  return (
    <div className="auth-root">
      <style>{`
        .auth-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          background: #ffffff;
          /* Pin to the viewport so no parent padding, margin or max-width can leave white
             strips around the blue panel. Taller content (sign-up) scrolls inside. */
          position: fixed;
          inset: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          -webkit-text-size-adjust: 100%;
          display: grid;
          grid-template-columns: minmax(340px, 5fr) 6fr;
        }

        /* Side panel */
        .auth-aside {
          background: #0e3868;
          color: #ffffff;
          padding: 36px clamp(28px, 4vw, 56px);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 32px;
        }
        .auth-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .auth-brand-plate {
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
        .auth-brand-plate img {
          width: 32px;
          height: 32px;
          object-fit: contain;
          display: block;
        }
        .auth-brand-name {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .auth-brand-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.16);
          letter-spacing: 0.05em;
        }
        .auth-preview {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 12px;
          padding: 16px 16px 18px;
          max-width: 420px;
        }
        .auth-preview-days,
        .auth-preview-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }
        .auth-preview-days {
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          text-align: center;
        }
        .auth-preview-grid {
          grid-template-rows: repeat(6, 26px);
        }
        .auth-preview-block {
          border-radius: 5px;
          border-left: 3px solid;
        }
        .auth-aside-copy {
          font-size: 17px;
          font-weight: 500;
          line-height: 1.5;
          max-width: 32ch;
          color: rgba(255, 255, 255, 0.92);
        }

        /* Form column */
        .auth-main {
          display: flex;
          flex-direction: column;
          padding: 24px clamp(20px, 5vw, 72px) 40px;
          min-width: 0;
        }
        .auth-back {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          padding: 6px 8px;
          margin-left: -8px;
          border-radius: 6px;
          font: inherit;
          font-size: 14px;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
        }
        .auth-back:hover { color: #0e3868; background: #f1f5f9; }
        .auth-card {
          width: 100%;
          max-width: 400px;
          margin: auto;
          padding: 24px 0;
        }
        .auth-brand-mobile { display: none; margin-bottom: 28px; }
        .auth-brand-mobile .auth-brand-name { color: #0e3868; }
        .auth-brand-mobile .auth-brand-plate { border: 1px solid #cbd5e1; }
        .auth-brand-mobile .auth-brand-badge { background: #0e3868; color: #ffffff; }

        .auth-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.15;
          color: #0e3868;
          margin: 0 0 8px;
        }
        .auth-sub {
          font-size: 15px;
          color: #475569;
          line-height: 1.5;
          margin: 0 0 24px;
        }

        .auth-switch {
          display: flex;
          gap: 2px;
          padding: 3px;
          background: #f1f5f9;
          border-radius: 8px;
          margin-bottom: 24px;
        }
        .auth-switch button {
          flex: 1;
          border: none;
          background: transparent;
          font: inherit;
          font-size: 13.5px;
          font-weight: 600;
          color: #64748b;
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .auth-switch button:hover { color: #0e3868; }
        .auth-switch button[aria-pressed="true"] {
          background: #ffffff;
          color: #0e3868;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.14);
        }

        .auth-field { margin-bottom: 18px; }
        .auth-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 6px;
        }
        .auth-input-wrap {
          display: flex;
          align-items: stretch;
          height: 46px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
          transition: border-color 0.12s ease, box-shadow 0.12s ease;
        }
        .auth-input-wrap:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
        }
        .auth-input-wrap[data-invalid="true"] { border-color: #dc2626; }
        .auth-input-wrap[data-invalid="true"]:focus-within {
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.16);
        }
        .auth-input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          padding: 0 12px;
          font: inherit;
          font-size: 16px; /* 16px stops iOS from zooming on focus */
          color: #0f172a;
        }
        .auth-input-mono {
          font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace;
          letter-spacing: 0.06em;
        }
        .auth-affix {
          display: flex;
          align-items: center;
          padding: 0 12px;
          background: #f8fafc;
          font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace;
          font-size: 14px;
          color: #64748b;
          user-select: none;
        }
        .auth-affix-lead {
          color: #0e3868;
          font-weight: 700;
          border-right: 1px solid #e2e8f0;
        }
        .auth-affix-trail { border-left: 1px solid #e2e8f0; }
        .auth-toggle {
          border: none;
          background: transparent;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          color: #2563eb;
          padding: 0 14px;
          cursor: pointer;
        }
        .auth-toggle:hover { color: #0e3868; }

        .auth-hint {
          margin: 6px 0 0;
          font-size: 12.5px;
          color: #64748b;
          line-height: 1.45;
        }
        .auth-error {
          margin: 6px 0 0;
          font-size: 13px;
          color: #b91c1c;
          line-height: 1.45;
        }
        .auth-link {
          background: none;
          border: none;
          padding: 0;
          margin-left: 4px;
          font: inherit;
          font-weight: 600;
          color: #2563eb;
          cursor: pointer;
        }
        .auth-link:hover { text-decoration: underline; }
        .auth-form-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.45;
          margin-bottom: 18px;
        }

        .auth-submit {
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
          margin-top: 6px;
          transition: background 0.12s ease;
        }
        .auth-submit:hover:not(:disabled) { background: #144e8c; }
        .auth-submit:disabled { opacity: 0.65; cursor: progress; }
        .auth-note {
          margin: 16px 0 0;
          font-size: 12.5px;
          color: #64748b;
          line-height: 1.5;
        }
        .auth-note button { margin-left: 0; }

        .auth-consent-field {
          margin-bottom: 18px;
        }
        .auth-consent-label {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          font-size: 13px;
          line-height: 1.5;
          color: #334155;
          cursor: pointer;
        }
        .auth-consent-label input[type='checkbox'] {
          margin-top: 3px;
          width: 15px;
          height: 15px;
          flex-shrink: 0;
          accent-color: #0e3868;
          cursor: pointer;
        }
        .auth-link-inline {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          font: inherit;
          font-weight: 600;
          color: #2563eb;
          cursor: pointer;
        }
        .auth-link-inline:hover { text-decoration: underline; }

        .auth-form-error .auth-link {
          color: #991b1b;
          text-decoration: underline;
        }
        .auth-form-error .auth-link:disabled { opacity: 0.6; cursor: progress; }

        /* Check-your-inbox view */
        .auth-sent-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #0e3868;
          margin-bottom: 20px;
        }
        .auth-sent .auth-title:focus { outline: none; }
        .auth-sent .auth-sub { margin-bottom: 12px; }
        .auth-sent .auth-hint { margin: 0 0 22px; }
        .auth-sent-address {
          font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace;
          font-size: 14px;
          font-weight: 600;
          color: #0e3868;
          overflow-wrap: anywhere;
        }
        .auth-secondary {
          width: 100%;
          height: 46px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #0e3868;
          font: inherit;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .auth-secondary:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
        .auth-secondary:disabled { color: #64748b; cursor: default; }
        .auth-status {
          min-height: 20px;
          margin: 10px 0 0;
          font-size: 13px;
          line-height: 1.45;
          color: #475569;
        }
        .auth-status[data-kind="ok"] { color: #15803d; }
        .auth-status[data-kind="error"] { color: #b91c1c; }
        .auth-sent-links {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 18px;
          margin-top: 14px;
          font-size: 13.5px;
        }

        .auth-root button:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        @media (max-width: 900px) {
          .auth-input-mono { font-size: 16px; } /* iOS zooms into fields under 16px */
          .auth-back { min-height: 44px; }
          .auth-root { grid-template-columns: 1fr; }
          .auth-aside { display: none; }
          .auth-brand-mobile { display: flex; }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-root * { transition: none !important; }
        }
      `}</style>

      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-brand">
          <span className="auth-brand-plate">
            <img src="/studystack-mark.png" alt="" />
          </span>
          <span className="auth-brand-name">StudyStack</span>
          <span className="auth-brand-badge">UP</span>
        </div>

        <div className="auth-preview">
          <div className="auth-preview-days">
            {DAY_LABELS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="auth-preview-grid">
            {PREVIEW_BLOCKS.map((b, i) => (
              <div
                key={i}
                className="auth-preview-block"
                style={{
                  gridColumn: b.col,
                  gridRow: `${b.row} / span ${b.span}`,
                  background: TONES[b.tone].bg,
                  borderLeftColor: TONES[b.tone].edge,
                }}
              />
            ))}
          </div>
        </div>

        <p className="auth-aside-copy">
          Upload your UP_MOD_XLS PDF, pick your modules, and get a weekly schedule with no clashes.
        </p>
      </aside>

      <main className="auth-main">
        <button type="button" className="auth-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to home
        </button>

        <div className="auth-card">
          <div className="auth-brand auth-brand-mobile">
            <span className="auth-brand-plate">
              <img src="/studystack-mark.png" alt="" />
            </span>
            <span className="auth-brand-name">StudyStack</span>
            <span className="auth-brand-badge">UP</span>
          </div>

          {pendingEmail ? (
            <CheckEmailView
              email={pendingEmail}
              cooldown={cooldown}
              resending={resending}
              status={resendStatus}
              onResend={handleResend}
              onEditNumber={() => leaveCheckEmail(mode)}
              onSignIn={() => leaveCheckEmail('signin')}
            />
          ) : (
            <>
              <h1 className="auth-title">{isSignup ? 'Create your account' : 'Sign in to StudyStack'}</h1>
              <p className="auth-sub">
                {isSignup
                  ? 'Use your UP student email to set up an account. It takes a few seconds.'
                  : 'Use your UP student email to open the timetable generator.'}
              </p>

              <div className="auth-switch" role="group" aria-label="Sign in or create an account">
                <button type="button" aria-pressed={!isSignup} onClick={() => switchMode('signin')}>
                  Sign in
                </button>
                <button type="button" aria-pressed={isSignup} onClick={() => switchMode('signup')}>
                  Create account
                </button>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                {errors.form && (
                  <div className="auth-form-error" role="alert">
                    {errors.form}
                    {errors.action === 'resend' && (
                      <button type="button" className="auth-link" onClick={handleResendFromSignIn} disabled={resending}>
                        {resending ? 'Sending…' : 'Resend the email'}
                      </button>
                    )}
                  </div>
                )}

                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-student-number">
                    Student email
                  </label>
                  <div className="auth-input-wrap" data-invalid={Boolean(errors.email)}>
                    <span className="auth-affix auth-affix-lead" aria-hidden="true">u</span>
                    <input
                      id="auth-student-number"
                      ref={numberRef}
                      className="auth-input auth-input-mono"
                      type="text"
                      name="username"
                      inputMode="numeric"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="12345678"
                      value={digits}
                      onChange={handleNumberChange}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'auth-email-error' : 'auth-email-hint'}
                    />
                    <span className="auth-affix auth-affix-trail" aria-hidden="true">@{STUDENT_EMAIL_DOMAIN}</span>
                  </div>
                  {errors.email ? (
                    <p id="auth-email-error" className="auth-error" role="alert">
                      {errors.email}
                      {errors.action === 'signin' && (
                        <button type="button" className="auth-link" onClick={() => switchMode('signin')}>
                          Sign in instead
                        </button>
                      )}
                      {errors.action === 'signup' && (
                        <button type="button" className="auth-link" onClick={() => switchMode('signup')}>
                          Create an account
                        </button>
                      )}
                    </p>
                  ) : (
                    <p id="auth-email-hint" className="auth-hint">
                      Enter your 8 digit student number.
                    </p>
                  )}
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-password">
                    Password
                  </label>
                  <div className="auth-input-wrap" data-invalid={Boolean(errors.password)}>
                    <input
                      id="auth-password"
                      ref={passwordRef}
                      className="auth-input"
                      type={passwordType}
                      name="password"
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((prev) => ({ ...prev, password: undefined, form: undefined }));
                      }}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? 'auth-password-error' : isSignup ? 'auth-password-hint' : undefined}
                    />
                    <button
                      type="button"
                      className="auth-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-pressed={showPassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {errors.password ? (
                    <p id="auth-password-error" className="auth-error" role="alert">
                      {errors.password}
                    </p>
                  ) : (
                    isSignup && (
                      <p id="auth-password-hint" className="auth-hint">
                        At least {MIN_PASSWORD_LENGTH} characters.
                      </p>
                    )
                  )}
                </div>

                {isSignup && (
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="auth-confirm">
                      Confirm password
                    </label>
                    <div className="auth-input-wrap" data-invalid={Boolean(errors.confirm)}>
                      <input
                        id="auth-confirm"
                        ref={confirmRef}
                        className="auth-input"
                        type={passwordType}
                        name="confirm-password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => {
                          setConfirm(e.target.value);
                          setErrors((prev) => ({ ...prev, confirm: undefined }));
                        }}
                        aria-invalid={Boolean(errors.confirm)}
                        aria-describedby={errors.confirm ? 'auth-confirm-error' : undefined}
                      />
                    </div>
                    {errors.confirm && (
                      <p id="auth-confirm-error" className="auth-error" role="alert">
                        {errors.confirm}
                      </p>
                    )}
                  </div>
                )}

                {isSignup && (
                  <div className="auth-consent-field">
                    <label className="auth-consent-label" htmlFor="auth-agree">
                      <input
                        id="auth-agree"
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => {
                          setAgreed(e.target.checked);
                          setErrors((prev) => ({ ...prev, agree: undefined }));
                        }}
                        aria-invalid={Boolean(errors.agree)}
                        aria-describedby={errors.agree ? 'auth-agree-error' : undefined}
                      />
                      <span>
                        I agree to StudyStack's{' '}
                        <button type="button" className="auth-link-inline" onClick={() => onNavigate?.('terms')}>
                          Terms of Service
                        </button>{' '}
                        and{' '}
                        <button type="button" className="auth-link-inline" onClick={() => onNavigate?.('privacy')}>
                          Privacy Policy
                        </button>.
                      </span>
                    </label>
                    {errors.agree && (
                      <p id="auth-agree-error" className="auth-error" role="alert">
                        {errors.agree}
                      </p>
                    )}
                  </div>
                )}

                <button type="submit" className="auth-submit" disabled={busy}>
                  {busy
                    ? isSignup
                      ? 'Creating account…'
                      : 'Signing in…'
                    : isSignup
                    ? 'Create account'
                    : 'Sign in'}
                </button>
              </form>

              {!isSignup && (
                <p className="auth-note">
                  By signing in, you agree to StudyStack's{' '}
                  <button type="button" className="auth-link-inline" onClick={() => onNavigate?.('terms')}>
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button type="button" className="auth-link-inline" onClick={() => onNavigate?.('privacy')}>
                    Privacy Policy
                  </button>.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default AuthPage;
