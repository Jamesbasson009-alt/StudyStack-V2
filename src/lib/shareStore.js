// src/lib/shareStore.js
// Sharing a timetable's busy slots with friends. One row per student in
// shared_timetables; friends are read through the add_friend / get_friend_timetables
// database functions so nobody can read other rows directly.
import { supabase } from './supabaseClient.js';

const SHARE = 'shared_timetables';
const FRIENDS = 'timetable_friends';

// No 0/O/1/I so codes are easy to read out loud.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

function makeCode(len = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

export function shareUrl(code) {
  return `${window.location.origin}${window.location.pathname}?friend=${code}`;
}

/** Accepts a full share link or a bare code; returns the normalised code or null. */
export function extractCode(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  try {
    const fromUrl = new URL(text).searchParams.get('friend');
    if (fromUrl) {
      const c = fromUrl.trim().toUpperCase();
      return CODE_RE.test(c) ? c : null;
    }
  } catch {
    /* not a URL, fall through */
  }
  const m = text.toUpperCase().match(/\b[A-HJ-NP-Z2-9]{8}\b/);
  return m ? m[0] : null;
}

/** { code, name, semester, enabled } or null when the student has never shared. */
export async function loadMyShare() {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from(SHARE)
    .select('share_code, display_name, semester, enabled')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { code: data.share_code, name: data.display_name, semester: data.semester, enabled: data.enabled };
}

/** Creates the share row (new code) or updates it (same code). */
export async function upsertMyShare(existing, { name, semester, events, enabled = true }) {
  const uid = await currentUserId();
  if (!uid) throw new Error('Not signed in');
  const patch = {
    display_name: name,
    semester,
    events,
    enabled,
    updated_at: new Date().toISOString(),
  };

  if (existing?.code) {
    const { error } = await supabase.from(SHARE).update(patch).eq('user_id', uid);
    if (error) throw error;
    return { code: existing.code, name, semester, enabled };
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const code = makeCode();
    const { error } = await supabase.from(SHARE).insert({ user_id: uid, share_code: code, ...patch });
    if (!error) return { code, name, semester, enabled };
    if (error.code !== '23505') throw error; // anything but "code already taken"
  }
  throw new Error('Could not create a share link. Try again.');
}

export async function setShareEnabled(enabled) {
  const uid = await currentUserId();
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase
    .from(SHARE)
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('user_id', uid);
  if (error) throw error;
}

export async function addFriendByCode(code) {
  const { data, error } = await supabase.rpc('add_friend', { p_code: code });
  if (error) throw error;
  return data;
}

export async function loadFriends() {
  const { data, error } = await supabase.rpc('get_friend_timetables');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function removeFriendByCode(code) {
  const uid = await currentUserId();
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase.from(FRIENDS).delete().eq('user_id', uid).eq('share_code', code);
  if (error) throw error;
}

/**
 * Gives my share a brand-new code. The old link stops working for everyone, including
 * friends who already added you; they have to add the new link. Use it if a link leaked.
 */
export async function rotateMyShare(existing) {
  const uid = await currentUserId();
  if (!uid) throw new Error('Not signed in');
  if (!existing?.code) throw new Error('Create a link first.');

  for (let attempt = 0; attempt < 4; attempt++) {
    const code = makeCode();
    const { error } = await supabase
      .from(SHARE)
      .update({ share_code: code, updated_at: new Date().toISOString() })
      .eq('user_id', uid);
    if (!error) return { ...existing, code };
    if (error.code !== '23505') throw error;
  }
  throw new Error('Could not create a new link. Try again.');
}
