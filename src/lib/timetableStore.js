// src/lib/timetableStore.js
// Reads/writes the signed-in student's saved timetable (one row per account).
import { supabase } from './supabaseClient.js';

const TABLE = 'saved_timetables';

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

// Returns { parsedData, settings, updatedAt } or null when nothing is saved yet.
export async function loadTimetable() {
  const uid = await currentUserId();
  if (!uid) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select('parsed_data, settings, updated_at')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { parsedData: data.parsed_data, settings: data.settings, updatedAt: data.updated_at };
}

// Creates the row on first save, updates it afterwards.
export async function saveTimetable({ parsedData, settings }) {
  const uid = await currentUserId();
  if (!uid) throw new Error('Not signed in');

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: uid,
      parsed_data: parsedData,
      settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}
