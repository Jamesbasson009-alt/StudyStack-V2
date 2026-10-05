/**
 * StudyStack auth service.
 *
 * Backed by Supabase (hosted Postgres + Auth, free tier: supabase.com). AuthPage and App
 * only ever call signUp / signIn / signOut / getSession / onSessionChange, so this file is
 * the only place that knows Supabase exists - same shape as the old localStorage version.
 *
 * Setup this file assumes you've already done in the Supabase dashboard:
 *   1. Authentication -> Providers -> Email -> turn OFF "Confirm email".
 *      Without this, signUp() succeeds but returns no session (Supabase is waiting on a
 *      confirmation click), so the UI would look like the "Create account" button did
 *      nothing. Turning it off keeps the same instant-session behaviour the old version had.
 *   2. (Optional hardening) A "before user created" Postgres hook that rejects non-tuks.co.za
 *      emails server-side - see the setup guide for the SQL. Not required: the UI already
 *      only lets people type a u########@tuks.co.za address, this just closes the gap for
 *      someone calling the Supabase API directly.
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
  if (error?.code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    // Supabase deliberately won't say whether the email or the password was wrong -
    // revealing that lets an attacker discover which emails have accounts.
    return new AuthError('bad_password', 'Incorrect email or password.');
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

/* ---------- account actions ---------- */

export async function signUp(email, password) {
  const normalized = normalizeEmail(email);
  assertStudentEmail(normalized);

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError('weak_password', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const { data, error } = await supabase.auth.signUp({ email: normalized, password });
  if (error) throw toAuthError(error);
  return toSession(data.session);
}

export async function signIn(email, password) {
  const normalized = normalizeEmail(email);
  assertStudentEmail(normalized);

  const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error) throw toAuthError(error);
  return toSession(data.session);
}
