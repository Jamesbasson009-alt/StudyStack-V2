/**
 * Single shared Supabase client for StudyStack.
 *
 * Assumes a Vite project, so env vars come from import.meta.env and must be prefixed
 * VITE_ (Vite only exposes prefixed vars to browser code). If this is a Create React App
 * project instead, swap the two lines below for:
 *   const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
 *   const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
 * and rename the keys in your .env file to match.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env file ' +
    'at your project root (see .env.example), then restart the dev server.'
  );
}

// The anon key is meant to be public - it's safe in browser code. Real enforcement
// (password hashing, sessions, rate limiting) happens on Supabase's servers, gated by
// the Row Level Security rules you set up in the dashboard/SQL editor.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
