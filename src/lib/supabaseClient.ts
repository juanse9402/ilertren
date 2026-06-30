import { createClient } from '@supabase/supabase-js';

// COMBINACIÓN TESTEADA Y FUNCIONAL: URL sin 'x' + Key aportada por el usuario
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.trim() !== "") ? import.meta.env.VITE_SUPABASE_URL.trim() : 'https://thdnxmzkrnwxvbqnxsdv.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_SUPABASE_ANON_KEY.trim() !== "") ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim() : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZG54bXprcm53eHZicW54c2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTA2MjYsImV4cCI6MjA5MTA4NjYyNn0.nuU_rDUmjGerkT7dTBqw3Y-n0NmzuSVXEuSYGFpAwB4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
