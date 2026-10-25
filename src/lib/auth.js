/**
 * StudyStack auth service.
 *
 * Backed by Supabase (hosted Postgres + Auth, free tier: supabase.com). AuthPage and App
 * only ever call signUp / signIn / signOut / getSession / onSessionChange (plus the email
 * confirmation helpers below), so this file is the only place that knows Supabase exists.
 *
 * Email confirmation is ON (Authentication -> Providers -> Email -> "Confirm email"), with
 * Brevo as the custom SMTP provider (Authentication -> Emails -> SMTP Settings). That means:
 *   - signUp() creates the account but returns NO session. It resolves to
 *     { session: null, needsConfirmation: true } and AuthPage shows "Check your inbox".
 *   - The link in the email sends the person back to `${origin}/?confirmed=1`. supabase-js
 *     picks the tokens out of the URL and signs them in; getAuthLanding() tells App to show
 *     the "Email confirmed" page first (see EmailConfirmedPage.jsx).
 *   - signIn() on an unconfirmed account fails with AuthError code 'unconfirmed'.
 *
 * Supabase dashboard -> Authentication -> URL Configuration must have:
 *   Site URL:       your production URL (the default is http://localhost:3000, which is
 *                   where confirmation links end up if this is left alone)
 *   Redirect URLs:  https://your-domain/**   and   http://localhost:5173/**   (dev)
 *
 * (Optional hardening) A "before user created" Postgres hook that rejects non-tuks.co.za
 * emails server-side. Not required: the UI only lets people type a u########@tuks.co.za
 * address, this just closes the gap for someone calling the Supabase API directly.
 */

import { supabase } from './supabaseClient.js';

export const STUDENT_NUMBER_LENGTH = 8;
export const STUDENT_EMAIL_DOMAIN = 'tuks.co.za';
export const MIN_PASSWORD_LENGTH = 8;

// The one rule for who may use the app: "u" + 8-digit student number + @tuks.co.za
export const STUDENT_EMAIL_RE = /^u(\d{8})@tuks\.co\.za$/;

export class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidStudentEmail(value) {
  return STUDENT_EMAIL_RE.test(normalizeEmail(value));
}

export function buildStudentEmail(studentNumber) {
  return `u${studentNumber}@${STUDENT_EMAIL_DOMAIN}`;
}

function assertStudentEmail(email) {
  if (!isValidStudentEmail(email)) {
    throw new AuthError(
      'invalid_email',
      `Use your UP student email: u, your ${STUDENT_NUMBER_LENGTH}-digit student number, then @${STUDENT_EMAIL_DOMAIN}.`
    );
  }
}

/* ---------- Supabase session -> StudyStack session ---------- */

function toSession(supabaseSession) {
  if (!supabaseSession?.user?.email) return null;
  const email = normalizeEmail(supabaseSession.user.email);
  const match = STUDENT_EMAIL_RE.exec(email);
  if (!match) return null; // not a u########@tuks.co.za account - treat as signed out
  return { email, studentNumber: match[1], signedInAt: Date.now() };
}

/** Maps a Supabase Auth error onto the AuthError codes AuthPage already knows how to display. */
function toAuthError(error) {
  const msg = error?.message || '';

  if (error?.code === 'user_already_exists' || /already registered/i.test(msg)) {
    return new AuthError('exists', 'An account for this email already exists.');
  }
  if (error?.code === 'weak_password') {
    return new AuthError('weak_password', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (error?.code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return new AuthError(
      'unconfirmed',
      'Confirm your email first. We sent you a link when you created your account.'
    );
  }
  if (error?.code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    // Supabase deliberately won't say whether the email or the password was wrong -
    // revealing that lets an attacker discover which emails have accounts.
    return new AuthError('bad_password', 'Incorrect email or password.');
  }
  if (
    error?.code === 'over_email_send_rate_limit' ||
    error?.code === 'over_request_rate_limit' ||
    /rate limit|after \d+ seconds/i.test(msg)
  ) {
    return new AuthError('rate_limited', 'Too many attempts. Wait a minute, then try again.');
  }
  // Supabase reports SMTP failures (bad Brevo credentials, unverified sender, ...) as
  // "Error sending confirmation email". The real reason is only in Supabase -> Logs -> Auth.
  if (/error sending .*email/i.test(msg)) {
    console.error('[auth] Supabase could not send the email. Check Logs -> Auth in the dashboard.', error);
    return new AuthError(
      'email_failed',
      'We couldn’t send your confirmation email. Please try again in a few minutes.'
    );
  }
  return new AuthError('unknown', msg || 'Something went wrong. Please try again.');
}

/* ---------- sessions ---------- */

/** Returns the current session (or null). Prefer onSessionChange for reactive UI - this is for one-off checks. */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return toSession(data.session);
}

/** Calls back with the session whenever it changes: sign-in, sign-out, token refresh, or another tab. */
export function onSessionChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
    callback(toSession(supabaseSession));
  });
  return () => data.subscription.unsubscribe();
}

export async function signOut() {
  await supabase.auth.signOut();
}

/* ---------- email confirmation ---------- */

/** Where the link in the confirmation email sends the person. Must match a Redirect URL in Supabase. */
function confirmRedirectUrl() {
  return `${window.location.origin}/?confirmed=1`;
}

/**
 * Reads, once at page load, whether this visit came from a confirmation email.
 * It runs at import time on purpose: supabase-js strips its own tokens from the URL as
 * soon as it initialises, and a failed link (expired / already used) arrives as
 * #error=access_denied&error_code=otp_expired&... which we need to see before that.
 */
const LANDING = readLanding();

function readLanding() {
  if (typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const pick = (key) => hash.get(key) || query.get(key);

  if (pick('error') || pick('error_code')) {
    const code = pick('error_code') || '';
    return {
      status: 'error',
      code,
      message:
        code === 'otp_expired'
          ? 'This confirmation link has expired or was already used.'
          : 'This confirmation link isn’t valid.',
    };
  }
  if (query.get('confirmed') === '1') return { status: 'success' };
  return null;
}

/** { status: 'success' } | { status: 'error', code, message } | null */
export function getAuthLanding() {
  return LANDING;
}

/** Removes our confirmation markers from the address bar so a refresh doesn't show the page again. */
export function clearAuthLanding() {
  const url = new URL(window.location.href);
  ['confirmed', 'error', 'error_code', 'error_description'].forEach((key) =>
    url.searchParams.delete(key)
  );
  if (/error/.test(url.hash)) url.hash = ''; // supabase-js clears its own token hash
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

/** Sends the confirmation email again. Supabase allows one per address every 60 seconds by default. */
export async function resendConfirmation(email) {
  const normalized = normalizeEmail(email);
  assertStudentEmail(normalized);

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalized,
    options: { emailRedirectTo: confirmRedirectUrl() },
  });
  if (error) throw toAuthError(error);
}

/* ---------- account actions ---------- */

/**
 * Creates the account. Resolves to { session, needsConfirmation }:
 *   needsConfirmation true  -> a confirmation email was sent; there is no session yet.
 *   needsConfirmation false -> "Confirm email" is off in Supabase; session is ready to use.
 */
export async function signUp(email, password) {
  const normalized = normalizeEmail(email);
  assertStudentEmail(normalized);

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError('weak_password', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: { emailRedirectTo: confirmRedirectUrl() },
  });
  if (error) throw toAuthError(error);

  // With "Confirm email" on, Supabase doesn't error when the address is already registered
  // (that would leak which emails have accounts). It returns a placeholder user with no
  // identities instead, and sends nothing - so without this check the person would wait
  // for an email that never comes.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AuthError('exists', 'An account for this email already exists.');
  }

  return { session: toSession(data.session), needsConfirmation: !data.session };
}

export async function signIn(email, password) {
  const normalized = normalizeEmail(email);
  assertStudentEmail(normalized);

  const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error) throw toAuthError(error);
  return toSession(data.session);
}
