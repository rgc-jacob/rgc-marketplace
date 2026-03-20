import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'RGC Marketplace: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required. Add them to .env (see .env.example).'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
